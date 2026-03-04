
-- Run this in Supabase SQL Editor to enable Role-Based Access Control

-- 1. Ensure Staff Directory has user_id link
ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Create View for Frontend to query roles easily
-- This view maps the authenticated user ID to their role in the staff directory
CREATE OR REPLACE VIEW user_roles AS
SELECT 
  sd.user_id as id, 
  sd.role 
FROM staff_directory sd
WHERE sd.user_id IS NOT NULL;

-- 3. Row Level Security for Staff Directory
ALTER TABLE staff_directory ENABLE ROW LEVEL SECURITY;

-- Policy: Managers can view/edit all staff
CREATE POLICY "Managers can manage all staff" ON staff_directory
FOR ALL
USING (
  auth.uid() IN (
    SELECT user_id FROM staff_directory WHERE role = 'manager'
  )
);

-- Policy: Employees can view their own record
CREATE POLICY "Staff can view own record" ON staff_directory
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Function to auto-create staff record on user signup (Optional helper)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.staff_directory (user_id, first_name, last_name, email, role, branch_id)
  VALUES (new.id, 'New', 'User', new.email, 'cashier', NULL);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Seed the first user as Manager (Backdoor for setup)
-- If you are the first user and locked out, run this with your specific UUID:
-- UPDATE staff_directory SET role = 'manager' WHERE email = 'your_email@example.com';
