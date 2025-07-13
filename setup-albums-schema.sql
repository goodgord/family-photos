-- Album Sharing Feature Database Setup
-- Run this SQL in your Supabase SQL editor

-- Albums table
CREATE TABLE albums (
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
CREATE TABLE album_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) NOT NULL,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(album_id, photo_id)
);

-- Album access logs (optional, for future analytics)
CREATE TABLE album_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Indexes for performance
CREATE INDEX idx_albums_share_token ON albums(share_token);
CREATE INDEX idx_album_photos_album_id ON album_photos(album_id);
CREATE INDEX idx_album_photos_photo_id ON album_photos(photo_id);
CREATE INDEX idx_albums_created_by ON albums(created_by);
CREATE INDEX idx_album_photos_position ON album_photos(album_id, position);

-- Enable RLS
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_views ENABLE ROW LEVEL SECURITY;

-- Albums policies
CREATE POLICY "Family members can view all albums" ON albums
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM family_members WHERE status = 'active')
  );

CREATE POLICY "Family members can create albums" ON albums
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM family_members WHERE status = 'active')
  );

CREATE POLICY "Family members can update any album" ON albums
  FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM family_members WHERE status = 'active')
  );

CREATE POLICY "Family members can delete any album" ON albums
  FOR DELETE USING (
    auth.uid() IN (SELECT user_id FROM family_members WHERE status = 'active')
  );

-- Album photos policies (same pattern)
CREATE POLICY "Family members can manage album photos" ON album_photos
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM family_members WHERE status = 'active')
  );

-- Public album access (for shared links)
CREATE POLICY "Public can view shared albums" ON albums
  FOR SELECT USING (
    is_public = true AND 
    (expires_at IS NULL OR expires_at > NOW())
  );

-- Album views policy
CREATE POLICY "Anyone can log album views" ON album_views
  FOR INSERT WITH CHECK (true);

-- Create updated_at trigger for albums
CREATE OR REPLACE FUNCTION update_albums_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_albums_updated_at
    BEFORE UPDATE ON albums
    FOR EACH ROW
    EXECUTE FUNCTION update_albums_updated_at();

-- Verify setup
SELECT 'Albums table created' as status;
SELECT 'Album photos table created' as status;
SELECT 'Album views table created' as status;
SELECT 'RLS policies created' as status;