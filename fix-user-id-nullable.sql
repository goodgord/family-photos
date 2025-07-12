-- Make user_id nullable for invitations
-- This allows invited users to have null user_id until they accept

-- First, drop the foreign key constraint if it exists
ALTER TABLE family_members DROP CONSTRAINT IF EXISTS family_members_user_id_fkey;

-- Make user_id nullable
ALTER TABLE family_members ALTER COLUMN user_id DROP NOT NULL;

-- Re-add the foreign key constraint but allow nulls
ALTER TABLE family_members ADD CONSTRAINT family_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Verify the change
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'family_members' AND column_name = 'user_id';