-- ============================================================
-- Add personal client discount columns to orders
--
-- discount_percent: the client's permanent discount percent
--   (always stored for the record; > 0 only for registered clients)
-- discount_sum:     the KZT amount actually applied at checkout.
--   Because the RPC applies GREATEST(rule_discount, personal_discount),
--   only ONE of discount_kzt / discount_sum is ever > 0 on an order.
-- ============================================================

alter table public.orders
  add column if not exists discount_percent integer not null default 0,
  add column if not exists discount_sum numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_discount_percent_check'
  ) then
    alter table public.orders
      add constraint orders_discount_percent_check
        check (discount_percent >= 0 and discount_percent <= 100);
  end if;
end;
$$;
