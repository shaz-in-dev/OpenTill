
create table if not exists shifts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id), -- Or text if using the custom staff_directory table w/o foreign keys to auth
  staff_name text, -- Snapshot of name/email for easier display
  clock_in timestamp with time zone default now(),
  clock_out timestamp with time zone,
  hourly_rate numeric, -- Snapshot of rate at time of shift
  total_pay numeric, -- Calculated on clock out
  status text default 'ACTIVE' -- ACTIVE, COMPLETED
);

-- Note: user_id reference depends on how staff_directory is set up. 
-- Based on AdminDashboard, staff_directory seems to use 'id' which might be auth.users id.
-- If staff_directory is a public table, we reference that.
-- Let's assume user_id links to the ID in staff_directory.
