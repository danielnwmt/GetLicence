create or replace function public.refresh_license_statuses() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_grace integer := 0;
  v_auto boolean := true;
begin
  select coalesce(block_grace_days,0), coalesce(block_auto,true)
    into v_grace, v_auto
    from public.payment_settings limit 1;

  if v_auto then
    update public.licenses l set status='blocked'
     where l.status in ('active','pending')
       and coalesce(l.courtesy,false) = false
       and exists (select 1 from public.payments p
                    where p.license_id=l.id
                      and p.status in ('pending','failed')
                      and p.due_date is not null
                      and p.due_date < (current_date - v_grace));

    update public.licenses l set status='blocked'
     where l.status in ('active','pending')
       and coalesce(l.courtesy,false) = false
       and not exists (select 1 from public.payments p
                        where p.license_id=l.id
                          and p.created_at >= (now() - interval '15 days'));
  end if;

  update public.licenses set status='expired'
   where status in ('active','blocked','pending')
     and coalesce(courtesy,false) = false
     and expires_at < now();
end $$;