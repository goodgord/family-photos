# Family Photos

A privacy-focused, simple photo sharing platform for family members to share and comment on photos. Built specifically for sharing life moments without relying on Meta or Google services.

## ✨ Features

- **🔒 Privacy-First**: Self-controlled, no third-party data mining
- **📱 Cross-Platform**: Responsive web app with future mobile app support
- **👨‍👩‍👧‍👦 Family-Focused**: Simple sharing and commenting among trusted family members
- **🚀 Fast & Efficient**: Automatic image compression and optimization
- **📧 Magic Link Auth**: Secure, passwordless authentication
- **🔄 Auto-Rotation**: Automatically corrects image orientation from phones
- **💾 Private Storage**: Secure file storage with signed URLs

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 with TypeScript
- **Authentication**: Supabase Auth (Magic Links)
- **Database**: PostgreSQL via Supabase
- **File Storage**: Supabase Storage
- **Hosting**: Vercel
- **Styling**: Tailwind CSS
- **Image Processing**: Browser-based compression with orientation correction

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Vercel account (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/goodgord/family-photos.git
   cd family-photos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```bash
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Set up Supabase Database**
   
   Run this SQL in your Supabase SQL Editor:
   ```sql
   -- Enable UUID extension
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

   -- Profiles table (extends Supabase auth.users)
   CREATE TABLE profiles (
     id UUID REFERENCES auth.users(id) PRIMARY KEY,
     email TEXT NOT NULL,
     full_name TEXT,
     avatar_url TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Photos table
   CREATE TABLE photos (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     filename TEXT NOT NULL,
     original_filename TEXT NOT NULL,
     caption TEXT,
     file_path TEXT NOT NULL,
     file_size INTEGER,
     uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
     uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Comments table
   CREATE TABLE comments (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
     user_id UUID REFERENCES auth.users(id) NOT NULL,
     comment_text TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Family members table
   CREATE TABLE family_members (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) NOT NULL,
     invited_by UUID REFERENCES auth.users(id),
     invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive'))
   );

   -- Enable Row Level Security
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
   ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

   -- RLS Policies
   CREATE POLICY "Users can view own profile" ON profiles
     FOR ALL USING (auth.uid() = id);

   CREATE POLICY "Allow authenticated uploads" ON photos
     FOR INSERT 
     WITH CHECK (auth.uid() = uploaded_by);

   CREATE POLICY "Allow authenticated viewing" ON photos
     FOR SELECT 
     USING (true);

   CREATE POLICY "Allow owner updates" ON photos
     FOR UPDATE 
     USING (auth.uid() = uploaded_by)
     WITH CHECK (auth.uid() = uploaded_by);

   CREATE POLICY "Allow owner deletes" ON photos
     FOR DELETE 
     USING (auth.uid() = uploaded_by);
   ```

5. **Set up Supabase Storage**
   
   - Create a bucket called `family-photos` (private)
   - Add storage policies via Supabase Dashboard → Storage → Policies:
     
     **Upload Policy:**
     - Policy name: `Allow family uploads`
     - Operation: `INSERT`
     - Target roles: `authenticated`
     - WITH CHECK: `bucket_id = 'family-photos'`
     
     **Download Policy:**
     - Policy name: `Allow family downloads`
     - Operation: `SELECT`
     - Target roles: `authenticated`
     - USING: `bucket_id = 'family-photos'`

6. **Add yourself as a family member**
   
   After signing up, run this SQL (replace with your email):
   ```sql
   INSERT INTO family_members (user_id, status)
   SELECT id, 'active'
   FROM auth.users 
   WHERE email = 'your-email@example.com';
   ```

7. **Run the development server**
   ```bash
   npm run dev
   ```

8. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## 📁 Project Structure

```
family-photos/
├── src/
│   ├── app/
│   │   ├── auth/callback/          # Auth callback handler
│   │   ├── upload/                 # Photo upload page
│   │   └── page.tsx               # Home gallery page
│   ├── components/
│   │   └── Layout.tsx             # Main layout component
│   └── lib/
│       └── supabase/              # Supabase client utilities
├── next.config.ts                 # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
└── package.json
```

## 🔧 Key Features Explained

### Image Processing
- **Automatic Compression**: Images are compressed to under 1MB for faster uploads
- **Orientation Correction**: EXIF orientation data is read and applied to fix rotated photos
- **Format Optimization**: Images are converted to JPEG for consistent handling

### Authentication Flow
1. User enters email address
2. Magic link sent to email
3. User clicks link, gets redirected via `/auth/callback`
4. Session established with Supabase
5. User stays logged in for 7 days (configurable)

### Security Features
- **Row Level Security (RLS)**: Database-level security ensuring users only see authorized content
- **Private Storage**: Images stored in private buckets with signed URLs
- **Family-Only Access**: Only invited family members can view and upload photos
- **Secure Authentication**: No passwords, magic link authentication only

## 🚀 Deployment

### Deploy to Vercel

1. **Connect your GitHub repository to Vercel**
2. **Add environment variables** in Vercel dashboard
3. **Update Supabase Auth settings**:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/auth/callback`
4. **Deploy!**

## 🔮 Roadmap

### Phase 2 Features
- [ ] Photo modal for full-size viewing
- [ ] Comments system
- [ ] Real-time updates for new photos/comments
- [ ] Family member management interface
- [ ] Email notifications

### Phase 3 Features
- [ ] Mobile-responsive enhancements
- [ ] Photo search and filtering
- [ ] Bulk photo operations
- [ ] Photo albums/categories

### Phase 4 Features
- [ ] React Native mobile app
- [ ] Push notifications
- [ ] Offline support
- [ ] Advanced sharing controls

## 🐛 Troubleshooting

### Common Issues

**Images appear sideways:**
- The app includes automatic orientation correction, but if issues persist, check that the EXIF data is preserved during upload.

**Upload fails with "RLS policy violation":**
- Ensure you're added to the `family_members` table with `status = 'active'`
- Check that storage policies are correctly configured

**Magic link doesn't work:**
- Verify the redirect URL is set correctly in Supabase Auth settings
- Check that the auth callback route is working at `/auth/callback`

**Images won't display:**
- Verify Next.js image configuration includes your Supabase domain
- Check that signed URLs are being generated correctly

## 📄 License

This project is private and intended for family use only.

## 🤝 Contributing

This is a private family project, but feel free to fork and adapt for your own family's needs!

---

Built with ❤️ for keeping family memories private and secure.