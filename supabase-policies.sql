-- Enable Row Level Security on comments table
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to insert comments
CREATE POLICY "Users can insert comments" 
ON comments FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow everyone to view comments (for family sharing)
CREATE POLICY "Anyone can view comments" 
ON comments FOR SELECT 
TO authenticated 
USING (true);

-- Policy: Allow users to update their own comments
CREATE POLICY "Users can update own comments" 
ON comments FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to delete their own comments
CREATE POLICY "Users can delete own comments" 
ON comments FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at timestamp
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();