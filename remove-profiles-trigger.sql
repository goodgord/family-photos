-- Remove the problematic updated_at trigger from profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

-- Verify trigger is removed
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'profiles';