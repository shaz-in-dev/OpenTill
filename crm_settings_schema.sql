-- Add 'crm_enabled' setting if it doesn't exist
insert into settings (key, value)
select 'crm_enabled', 'false'
where not exists (select 1 from settings where key = 'crm_enabled');

-- Add 'crm_loyalty_points_per_unit' setting
insert into settings (key, value)
select 'crm_loyalty_points_per_unit', '10'
where not exists (select 1 from settings where key = 'crm_loyalty_points_per_unit');
