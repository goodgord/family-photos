-- ===== FAMILY MEMBER INVITATION SYSTEM =====
-- This file contains the database schema updates for the invitation system

-- Drop existing family_members table constraints if they exist
-- ALTER TABLE family_members DROP CONSTRAINT IF EXISTS family_members_status_check;

-- Add new columns to family_members table
ALTER TABLE family_members 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invitation_token UUID DEFAULT gen_random_uuid();

-- Update the status enum to include 'invited' status
ALTER TABLE family_members 
DROP CONSTRAINT IF EXISTS family_members_status_check;

ALTER TABLE family_members 
ADD CONSTRAINT family_members_status_check 
CHECK (status IN ('pending', 'active', 'inactive', 'invited'));

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_family_members_email ON family_members(email);
CREATE INDEX IF NOT EXISTS idx_family_members_invitation_token ON family_members(invitation_token);
CREATE INDEX IF NOT EXISTS idx_family_members_status ON family_members(status);

-- Make email required for invited members
-- We'll handle this in the application logic for now

-- Create function to check if an email is invited or already a family member
CREATE OR REPLACE FUNCTION is_email_invited(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM family_members 
    WHERE email = user_email 
    AND status IN ('invited', 'active')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user's email is in the invited list
  IF NOT EXISTS (
    SELECT 1 FROM family_members 
    WHERE email = NEW.email 
    AND status = 'invited'
  ) THEN
    -- If not invited, we'll let the application handle this
    -- For now, we'll just log this case
    -- The application should prevent signup before this point
    RAISE NOTICE 'User % not found in invited list', NEW.email;
  ELSE
    -- User is invited, update their invitation status
    UPDATE family_members 
    SET 
      user_id = NEW.id,
      status = 'active',
      accepted_at = NOW()
    WHERE email = NEW.email AND status = 'invited';
    
    -- Create a profile for the user
    INSERT INTO profiles (id, email, full_name, created_at)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = NEW.email,
      full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', profiles.full_name);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table for new signups
-- Note: This requires superuser privileges, so we'll handle it in the application for now
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user_signup();

-- Create function to validate invitation token
CREATE OR REPLACE FUNCTION validate_invitation_token(token_uuid UUID)
RETURNS TABLE(email TEXT, invited_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  RETURN QUERY
  SELECT fm.email, fm.invited_at
  FROM family_members fm
  WHERE fm.invitation_token = token_uuid 
  AND fm.status = 'invited';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get family member by email
CREATE OR REPLACE FUNCTION get_family_member_by_email(user_email TEXT)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  email TEXT,
  status TEXT,
  invited_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  invitation_token UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fm.id,
    fm.user_id,
    fm.email,
    fm.status,
    fm.invited_at,
    fm.accepted_at,
    fm.invitation_token
  FROM family_members fm
  WHERE fm.email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for family_members table
DROP POLICY IF EXISTS "Users can view family members" ON family_members;
DROP POLICY IF EXISTS "Users can insert family members" ON family_members;
DROP POLICY IF EXISTS "Users can update family members" ON family_members;
DROP POLICY IF EXISTS "Users can delete family members" ON family_members;

-- Policy: Allow public read access for invitation checking
-- This is needed because unauthenticated users need to check if they're invited
CREATE POLICY "Allow public read for invitations" ON family_members
  FOR SELECT 
  TO public
  USING (true);

-- Policy: Active family members can invite new members
CREATE POLICY "Active family members can invite" ON family_members
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
    AND status = 'invited'
  );

-- Policy: Active family members can update invitations (cancel, etc.)
CREATE POLICY "Active family members can update invitations" ON family_members
  FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

-- Policy: Active family members can delete invitations/members
CREATE POLICY "Active family members can delete" ON family_members
  FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

-- Update existing policies to ensure only active family members can access photos
-- First, let's check if we need to update photo policies to be more restrictive

-- Policy: Only active family members can view photos
DROP POLICY IF EXISTS "Allow authenticated viewing" ON photos;
CREATE POLICY "Active family members can view photos" ON photos
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

-- Policy: Only active family members can upload photos
DROP POLICY IF EXISTS "Allow authenticated uploads" ON photos;
CREATE POLICY "Active family members can upload photos" ON photos
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    auth.uid() = uploaded_by 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

-- Update other photo policies to check family member status
DROP POLICY IF EXISTS "Allow owner updates" ON photos;
CREATE POLICY "Active family members can update own photos" ON photos
  FOR UPDATE 
  TO authenticated 
  USING (
    auth.uid() = uploaded_by 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  )
  WITH CHECK (
    auth.uid() = uploaded_by 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Allow owner deletes" ON photos;
CREATE POLICY "Active family members can delete own photos" ON photos
  FOR DELETE 
  TO authenticated 
  USING (
    auth.uid() = uploaded_by 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

-- Update comments policies
DROP POLICY IF EXISTS "Users can insert comments" ON comments;
CREATE POLICY "Active family members can insert comments" ON comments
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
CREATE POLICY "Active family members can view comments" ON comments
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can update own comments" ON comments;
CREATE POLICY "Active family members can update own comments" ON comments
  FOR UPDATE 
  TO authenticated 
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
CREATE POLICY "Active family members can delete own comments" ON comments
  FOR DELETE 
  TO authenticated 
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

-- Update reactions policies
DROP POLICY IF EXISTS "Users can insert reactions" ON reactions;
CREATE POLICY "Active family members can insert reactions" ON reactions
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Anyone can view reactions" ON reactions;
CREATE POLICY "Active family members can view reactions" ON reactions
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can update own reactions" ON reactions;
CREATE POLICY "Active family members can update own reactions" ON reactions
  FOR UPDATE 
  TO authenticated 
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can delete own reactions" ON reactions;
CREATE POLICY "Active family members can delete own reactions" ON reactions
  FOR DELETE 
  TO authenticated 
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

-- Update profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Active family members can view profiles" ON profiles
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create a view for easier family member management
CREATE OR REPLACE VIEW family_members_with_profiles AS
SELECT 
  fm.id,
  fm.user_id,
  fm.email,
  fm.status,
  fm.invited_at,
  fm.accepted_at,
  fm.invitation_token,
  fm.invited_by,
  p.full_name,
  p.avatar_url,
  inviter.full_name as invited_by_name
FROM family_members fm
LEFT JOIN profiles p ON fm.user_id = p.id
LEFT JOIN profiles inviter ON fm.invited_by = inviter.id;

-- Grant access to the view
GRANT SELECT ON family_members_with_profiles TO authenticated;