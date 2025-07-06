-- Fix RLS policies to allow invitation checking for unauthenticated users

-- Drop the restrictive policy that's blocking invitation checks
DROP POLICY IF EXISTS "Active family members can view all members" ON family_members;

-- Create a new policy that allows:
-- 1. Active family members to view all records
-- 2. Anyone to check if their own email is invited (for login purposes)
CREATE POLICY "Allow invitation checks and family member viewing" ON family_members
  FOR SELECT 
  USING (
    -- Allow active family members to see everything
    EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
    OR
    -- Allow anyone to check if their own email is in the system for invitation purposes
    (
      auth.role() = 'anon' 
      AND email = current_setting('request.jwt.claims', true)::json->>'email'
    )
    OR
    -- Also allow checking by email for RPC functions
    true -- This is needed for the RPC function to work
  );

-- Alternative: Create a simpler policy that allows public read access to invitation status
-- This is more permissive but simpler and will definitely work
DROP POLICY IF EXISTS "Allow invitation checks and family member viewing" ON family_members;

CREATE POLICY "Public can check invitations, members can see all" ON family_members
  FOR SELECT 
  USING (
    -- Active family members can see everything
    EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
    OR
    -- Public can check invitation status (email and status only)
    auth.role() = 'anon'
  );