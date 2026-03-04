
create table if not exists customers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  email text unique,
  phone text,
  loyalty_points int default 0,
  total_spend bigint default 0, -- Stored in cents
  last_visit timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Link orders to customers if not already (optional migration, usually orders have user_id or similar, but for CRM we might want a specific customer_id column on orders)
do $$ 
begin
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'customer_id') then
        alter table orders add column customer_id uuid references customers(id);
    end if;
end $$;
