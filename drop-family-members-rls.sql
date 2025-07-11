-- Drop RLS policies and disable RLS for family_members table
-- This will allow proper authorization checks without RLS interference

-- Drop all existing policies on family_members table
DROP POLICY IF EXISTS "Active family members can view all members" ON family_members;
DROP POLICY IF EXISTS "Allow invitation checks and family member viewing" ON family_members;
DROP POLICY IF EXISTS "Public can check invitations, members can see all" ON family_members;

-- Disable RLS on the family_members table
ALTER TABLE family_members DISABLE ROW LEVEL SECURITY;

-- Verify the change
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'family_members';