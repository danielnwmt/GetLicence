alter table public.licenses add column if not exists block_schedule_enabled boolean;
alter table public.licenses add column if not exists block_start_time text;
alter table public.licenses add column if not exists block_end_time text;