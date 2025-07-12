-- Fix the updated_at trigger function for profiles table
-- Run this SQL in your Supabase SQL editor

-- Drop the existing trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

-- Create a more robust updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if the table has an updated_at column
    IF TG_TABLE_NAME = 'profiles' THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Re-create the trigger
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify the trigger exists
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'profiles';