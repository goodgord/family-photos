-- ========================================
-- FAMILY PHOTOS DATABASE INTEGRITY FIX
-- ========================================
-- This script fixes missing tables and conflicting RLS policies
-- Run this in your Supabase SQL editor

-- ===== DROP CONFLICTING POLICIES =====
-- Clean up reactions table policies first
DROP POLICY IF EXISTS "Users can insert reactions" ON reactions;
DROP POLICY IF EXISTS "Anyone can view reactions" ON reactions;
DROP POLICY IF EXISTS "Users can update own reactions" ON reactions;
DROP POLICY IF EXISTS "Users can delete own reactions" ON reactions;
DROP POLICY IF EXISTS "Active family members can insert reactions" ON reactions;
DROP POLICY IF EXISTS "Active family members can view reactions" ON reactions;
DROP POLICY IF EXISTS "Active family members can update own reactions" ON reactions;
DROP POLICY IF EXISTS "Active family members can delete own reactions" ON reactions;

-- ===== CREATE CORE TABLES IF MISSING =====

-- Photos table (core dependency)
CREATE TABLE IF NOT EXISTS photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  caption TEXT,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Family members table (core dependency)
CREATE TABLE IF NOT EXISTS family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  email TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive', 'invited')),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  invitation_token UUID DEFAULT gen_random_uuid(),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles table (core dependency)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments table (core dependency)
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reactions table (already exists but might have issues)
CREATE TABLE IF NOT EXISTS reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(photo_id, user_id)
);

-- Albums table (needed for album functionality)
CREATE TABLE IF NOT EXISTS albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  share_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  is_public BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Album photos junction table
CREATE TABLE IF NOT EXISTS album_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) NOT NULL,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(album_id, photo_id)
);

-- Album views table
CREATE TABLE IF NOT EXISTS album_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- ===== CREATE INDEXES =====
CREATE INDEX IF NOT EXISTS idx_photos_uploaded_by ON photos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_photos_uploaded_at ON photos(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_email ON family_members(email);
CREATE INDEX IF NOT EXISTS idx_family_members_status ON family_members(status);
CREATE INDEX IF NOT EXISTS idx_reactions_photo_id ON reactions(photo_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_photo_id ON comments(photo_id);
CREATE INDEX IF NOT EXISTS idx_albums_created_by ON albums(created_by);
CREATE INDEX IF NOT EXISTS idx_albums_share_token ON albums(share_token);
CREATE INDEX IF NOT EXISTS idx_album_photos_album_id ON album_photos(album_id);
CREATE INDEX IF NOT EXISTS idx_album_photos_photo_id ON album_photos(photo_id);

-- ===== ENABLE RLS =====
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members DISABLE ROW LEVEL SECURITY; -- Disabled as per user request
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_views ENABLE ROW LEVEL SECURITY;

-- ===== SIMPLIFIED RLS POLICIES =====

-- Photos policies - simplified to allow all authenticated users
DROP POLICY IF EXISTS "Allow authenticated viewing" ON photos;
DROP POLICY IF EXISTS "Active family members can view photos" ON photos;
CREATE POLICY "Authenticated users can view photos" ON photos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated uploads" ON photos;
DROP POLICY IF EXISTS "Active family members can upload photos" ON photos;
CREATE POLICY "Authenticated users can upload photos" ON photos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Allow owner updates" ON photos;
DROP POLICY IF EXISTS "Active family members can update own photos" ON photos;
CREATE POLICY "Users can update own photos" ON photos
  FOR UPDATE TO authenticated 
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Allow owner deletes" ON photos;
DROP POLICY IF EXISTS "Active family members can delete own photos" ON photos;
CREATE POLICY "Users can delete own photos" ON photos
  FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

-- Profiles policies - simplified
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Active family members can view profiles" ON profiles;
CREATE POLICY "Authenticated users can view profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = id);

-- Comments policies - simplified
DROP POLICY IF EXISTS "Users can insert comments" ON comments;
DROP POLICY IF EXISTS "Active family members can insert comments" ON comments;
CREATE POLICY "Authenticated users can insert comments" ON comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
DROP POLICY IF EXISTS "Active family members can view comments" ON comments;
CREATE POLICY "Authenticated users can view comments" ON comments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Active family members can update own comments" ON comments;
CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
DROP POLICY IF EXISTS "Active family members can delete own comments" ON comments;
CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reactions policies - simplified to fix 406 errors
CREATE POLICY "Authenticated users can view reactions" ON reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert reactions" ON reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions" ON reactions
  FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions" ON reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Albums policies - simplified
CREATE POLICY "Authenticated users can view albums" ON albums
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create albums" ON albums
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own albums" ON albums
  FOR UPDATE TO authenticated 
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own albums" ON albums
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Album photos policies
CREATE POLICY "Authenticated users can manage album photos" ON album_photos
  FOR ALL TO authenticated USING (true);

-- Album views policy
CREATE POLICY "Anyone can log album views" ON album_views
  FOR INSERT WITH CHECK (true);

-- ===== CREATE FUNCTIONS =====

-- Updated at function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ===== CREATE TRIGGERS =====

-- Updated at triggers for all tables
DROP TRIGGER IF EXISTS update_photos_updated_at ON photos;
CREATE TRIGGER update_photos_updated_at
    BEFORE UPDATE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reactions_updated_at ON reactions;
CREATE TRIGGER update_reactions_updated_at
    BEFORE UPDATE ON reactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_albums_updated_at ON albums;
CREATE TRIGGER update_albums_updated_at
    BEFORE UPDATE ON albums
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_family_members_updated_at ON family_members;
CREATE TRIGGER update_family_members_updated_at
    BEFORE UPDATE ON family_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===== VERIFICATION =====
SELECT 'Database integrity fix completed successfully' as status;

-- Show tables that exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('photos', 'family_members', 'profiles', 'comments', 'reactions', 'albums', 'album_photos', 'album_views')
ORDER BY table_name;