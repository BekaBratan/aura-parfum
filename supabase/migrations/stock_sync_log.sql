create table stock_sync_log (
  id bigint primary key generated always as identity,
  triggered_by text not null,
  admin_email text,
  total_products int not null,
  updated_count int not null,
  errors jsonb,
  created_at timestamptz default now()
);
