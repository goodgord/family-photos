# Family Invitation System Setup Guide

This guide explains how to set up and use the new family invitation system for your family photo sharing app.

## Database Setup

1. **Run the schema updates**:
   Execute the SQL commands in `supabase-schema-updates.sql` in your Supabase SQL Editor. This will:
   - Add invitation fields to the `family_members` table
   - Create database functions for invitation management
   - Update RLS policies for secure access control
   - Create a view for easier family member management

2. **Verify the setup**:
   After running the SQL, verify these tables and functions exist:
   - `family_members` table with new columns: `email`, `invited_at`, `accepted_at`, `invitation_token`
   - Function: `is_email_invited(user_email TEXT)`
   - View: `family_members_with_profiles`

## Initial Family Member Setup

Since this is now an invite-only system, you'll need to add yourself as the first family member. Use the `initial-family-member-setup.sql` file for step-by-step setup:

### Option 1: If you already have a user account
```sql
-- Replace 'your-email@example.com' with your actual email
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
```

### Option 2: If you don't have a user account yet
```sql
-- First, create an invitation for yourself
INSERT INTO family_members (email, status, invited_at, invitation_token)
SELECT 
  'your-email@example.com',
  'invited',
  NOW(),
  gen_random_uuid()
WHERE NOT EXISTS (
  SELECT 1 FROM family_members WHERE email = 'your-email@example.com'
);
```

Then sign up normally through the app - the system will automatically activate your membership.

## How the Invitation System Works

### 1. Invitation Process
- Active family members can invite new people via the `/family` page
- Each invitation creates a record with status `'invited'`
- Invitations include a unique token for security

### 2. Sign-up Process
- When someone tries to sign in, the system checks if their email is invited
- Only invited emails can receive magic links
- Upon successful login, the invitation status changes to `'active'`

### 3. Access Control
- All photo viewing, uploading, and commenting requires active family member status
- RLS policies automatically enforce these restrictions at the database level

## Using the Family Management Interface

### Accessing Family Management
1. Sign in to your family photos app
2. Click the "Family" link in the navigation
3. You'll see the family management dashboard

### Inviting New Members
1. Go to the Family Management page
2. Fill out the "Invite Family Member" form
3. Enter the email address (required)
4. Optionally enter their full name
5. Click "Send Invitation"

### Managing Existing Members
- View all family members and their status
- See pending invitations
- Cancel invitations or remove members as needed
- View invitation statistics

## Security Features

### Database-Level Security
- Row Level Security (RLS) policies prevent unauthorized access
- Only active family members can view/upload photos
- Invitation tokens prevent unauthorized access

### Application-Level Security
- Email validation before sending magic links
- Duplicate invitation prevention
- Self-removal protection (users can't remove themselves)

## API Endpoints

The system provides these API endpoints:

- `GET /api/family` - List all family members and invitations
- `POST /api/family/invite` - Send a new invitation
- `DELETE /api/family/[id]` - Remove a member or cancel invitation

## Troubleshooting

### Common Issues

**"Email not invited" error**:
- Ensure the email is in the `family_members` table with status `'invited'`
- Check for typos in the email address
- Verify the `is_email_invited` function is working

**Unable to access photos after signing in**:
- Verify the user's `family_members` record has status `'active'`
- Check that the auth callback properly updated the invitation status

**Database function errors**:
- Ensure all functions were created with `SECURITY DEFINER`
- Verify the `family_members_with_profiles` view exists
- Check Supabase logs for detailed error messages

### Migration from Open System

If you're migrating from an open signup system:

1. **Identify existing users**:
   ```sql
   SELECT u.email, p.full_name
   FROM auth.users u
   LEFT JOIN profiles p ON u.id = p.id;
   ```

2. **Add existing users as active family members**:
   ```sql
   INSERT INTO family_members (user_id, email, status, invited_at, accepted_at)
   SELECT u.id, u.email, 'active', NOW(), NOW()
   FROM auth.users u
   WHERE NOT EXISTS (
     SELECT 1 FROM family_members fm WHERE fm.user_id = u.id
   );
   ```

## Testing the System

1. **Test invitation flow**:
   - Invite a test email address
   - Verify the invitation appears in the family management page
   - Try to sign in with the invited email
   - Confirm the invitation status changes to 'active'

2. **Test access control**:
   - Try signing in with a non-invited email (should fail)
   - Verify that only active members can view photos
   - Test family management permissions

3. **Test removal process**:
   - Remove a test invitation
   - Verify the user can no longer sign in
   - Test removing an active member (ensure they lose access)

## Best Practices

- **Regular review**: Periodically review family members and remove inactive ones
- **Clear communication**: Let family members know about the invitation system
- **Backup considerations**: Remember that removing someone also removes their access to photos
- **Email accuracy**: Double-check email addresses before sending invitations

The invitation system provides a secure, family-focused approach to photo sharing while maintaining privacy and control over who can access your family memories.