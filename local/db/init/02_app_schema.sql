-- Schema da aplicação (tabelas, RLS, triggers) — equivalente ao Supabase do Lovable.
-- Roda DEPOIS do `gotrue migrate`, então o schema auth e auth.users já existem.
create extension if not exists pgcrypto;

-- Helpers auth.uid()/jwt()/role()/email() criados como supabase_auth_admin
-- (o GoTrue tenta fazer CREATE OR REPLACE neles e precisa ser owner).
set role supabase_auth_admin;
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(coalesce(current_setting('request.jwt.claim.sub', true), auth.jwt()->>'sub'), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.jwt()->>'role') $$;
create or replace function auth.email() returns text language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claim.email', true), ''), auth.jwt()->>'email') $$;
reset role;

do $$ begin create type public.app_role as enum ('admin','client'); exception when duplicate_object then null; end $$;
do $$ begin create type public.license_status as enum ('pending','active','expired','cancelled','blocked'); exception when duplicate_object then null; end $$;
do $$ begin alter type public.license_status add value if not exists 'blocked'; exception when others then null; end $$;
do $$ begin create type public.license_plan as enum ('monthly','yearly'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('pending','paid','failed','refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_provider as enum ('asaas','sicredi','sicoob','manual'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null,
  customer_number bigint,
  full_name text, email text, cpf_cnpj text, phone text,
  address_zip text, address_street text, address_number text, address_complement text,
  address_neighborhood text, address_city text, address_state text,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists must_change_password boolean not null default false;
create sequence if not exists public.profiles_customer_number_seq start 1;
alter table public.profiles add column if not exists customer_number bigint;
alter table public.profiles alter column customer_number set default nextval('public.profiles_customer_number_seq');
with ordered as (
  select id, row_number() over (order by created_at) as rn
  from public.profiles
  where customer_number is null
)
update public.profiles p set customer_number = o.rn from ordered o where p.id = o.id;
select setval('public.profiles_customer_number_seq', coalesce((select max(customer_number) from public.profiles), 0) + 1, false);
alter table public.profiles alter column customer_number set not null;
create unique index if not exists profiles_customer_number_key on public.profiles(customer_number);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_monthly numeric not null default 0,
  price_yearly numeric not null default 0,
  active boolean not null default true,
  cost_vps numeric not null default 0, cost_storage numeric not null default 0, cost_other numeric not null default 0,
  profit_margin numeric not null default 0,
  vps_specs text default '',
  storage_amount numeric not null default 0, storage_unit text not null default 'GB',
  vps_storage_amount numeric not null default 0, vps_storage_unit text not null default 'GB',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null references public.products(id),
  license_key text not null default upper(
    substring(encode(gen_random_bytes(4),'hex') from 1 for 4) || '-' ||
    substring(encode(gen_random_bytes(4),'hex') from 1 for 4) || '-' ||
    substring(encode(gen_random_bytes(4),'hex') from 1 for 4) || '-' ||
    substring(encode(gen_random_bytes(4),'hex') from 1 for 4)
  ),
  plan public.license_plan not null default 'monthly',
  status public.license_status not null default 'pending',
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  activated_at timestamptz,
  last_seen_at timestamptz,
  device_ip text,
  device_hostname text,
  auto_renew boolean not null default true,
  notes text, provider public.payment_provider, provider_subscription_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.licenses add column if not exists activated_at timestamptz;
alter table public.licenses add column if not exists last_seen_at timestamptz;
alter table public.licenses add column if not exists device_ip text;
alter table public.licenses add column if not exists device_hostname text;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  license_id uuid not null references public.licenses(id) on delete cascade,
  amount numeric not null, method text,
  status public.payment_status not null default 'pending',
  paid_at timestamptz, reference text, notes text,
  provider public.payment_provider, provider_charge_id text,
  boleto_url text, pix_qr_code text, pix_copy_paste text,
  due_date date, barcode text, invoice_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  active_provider public.payment_provider not null default 'manual',
  asaas_env text not null default 'sandbox',
  webhook_token text not null default encode(gen_random_bytes(24),'hex'),
  notes text,
  asaas_api_key text,
  sicredi_client_id text, sicredi_client_secret text, sicredi_cert_pem text, sicredi_cert_key text,
  sicoob_client_id text, sicoob_access_token text, sicoob_cert_pem text, sicoob_cert_key text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.payment_settings (active_provider)
  select 'manual' where not exists (select 1 from public.payment_settings);

-- helper has_role
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','products','licenses','payments','payment_settings','user_roles']
  loop
    execute format('drop trigger if exists trg_%I_upd on public.%I;', t, t);
    execute format('create trigger trg_%I_upd before update on public.%I for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- handle_new_user: cria profile + role 'client' quando GoTrue insere em auth.users
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name, email)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
    on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'client')
    on conflict (user_id, role) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.products enable row level security;
alter table public.licenses enable row level security;
alter table public.payments enable row level security;
alter table public.payment_settings enable row level security;

drop policy if exists "Users view own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Admins view all profiles" on public.profiles;
drop policy if exists "Users view own roles" on public.user_roles;
drop policy if exists "Admins manage roles" on public.user_roles;
drop policy if exists "Anyone authed reads active products" on public.products;
drop policy if exists "Admins manage products" on public.products;
drop policy if exists "Users view own licenses" on public.licenses;
drop policy if exists "Admins view all licenses" on public.licenses;
drop policy if exists "Admins manage licenses" on public.licenses;
drop policy if exists "Users view own payments" on public.payments;
drop policy if exists "Admins view all payments" on public.payments;
drop policy if exists "Admins manage payments" on public.payments;
drop policy if exists "Admins manage payment settings" on public.payment_settings;

create policy "Users view own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = user_id);
create policy "Admins view all profiles" on public.profiles for select using (public.has_role(auth.uid(),'admin'));

create policy "Users view own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "Admins manage roles" on public.user_roles for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "Anyone authed reads active products" on public.products for select to authenticated using (active = true or public.has_role(auth.uid(),'admin'));
create policy "Admins manage products" on public.products for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "Users view own licenses" on public.licenses for select using (auth.uid() = user_id);
create policy "Admins view all licenses" on public.licenses for select using (public.has_role(auth.uid(),'admin'));
create policy "Admins manage licenses" on public.licenses for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "Users view own payments" on public.payments for select using (auth.uid() = user_id);
create policy "Admins view all payments" on public.payments for select using (public.has_role(auth.uid(),'admin'));
create policy "Admins manage payments" on public.payments for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "Admins manage payment settings" on public.payment_settings for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Permissões nas roles PostgREST
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;
grant all on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant all on tables to authenticated, service_role;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant all on sequences to authenticated, service_role;

-- ===== Automação de status da licença =====
create or replace function public.on_payment_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    update public.licenses
       set status = 'active'
     where id = new.license_id
       and status in ('pending','blocked')
       and expires_at > now();
  end if;
  return new;
end $$;
drop trigger if exists trg_on_payment_paid on public.payments;
create trigger trg_on_payment_paid after insert or update on public.payments
  for each row execute function public.on_payment_paid();

create or replace function public.refresh_license_statuses() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.licenses l set status='blocked'
   where l.status in ('active','pending')
     and exists (select 1 from public.payments p
                  where p.license_id=l.id
                    and p.status in ('pending','failed')
                    and p.due_date is not null
                    and p.due_date < current_date);
  update public.licenses set status='expired'
   where status in ('active','blocked','pending') and expires_at < now();
end $$;
