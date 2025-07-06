-- Initial Family Member Setup Script
-- This script helps you add yourself as the first active family member

-- Step 1: Check if you already have a user account
-- Replace 'your-email@example.com' with your actual email address
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users 
WHERE email = 'your-email@example.com';

-- Step 2: If you have a user account, use this query to add yourself as an active family member
-- Replace 'your-email@example.com' with your actual email address
INSERT INTO family_members (user_id, email, status, invited_at, accepted_at)
SELECT 
  u.id,
  u.email,
  'active',
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'your-email@example.com'
AND NOT EXISTS (
  SELECT 1 FROM family_members fm WHERE fm.email = u.email
);

-- Step 3: If you DON'T have a user account yet, create an invitation for yourself first
-- Replace 'your-email@example.com' with your actual email address
-- You can then sign up using the magic link process
INSERT INTO family_members (email, status, invited_at, invitation_token)
SELECT 
  'your-email@example.com',
  'invited',
  NOW(),
  gen_random_uuid()
WHERE NOT EXISTS (
  SELECT 1 FROM family_members WHERE email = 'your-email@example.com'
);

-- Step 4: Verify the setup
SELECT 
  fm.id,
  fm.email,
  fm.status,
  fm.user_id,
  fm.invited_at,
  fm.accepted_at,
  p.full_name
FROM family_members fm
LEFT JOIN profiles p ON fm.user_id = p.id
WHERE fm.email = 'your-email@example.com';