'use client'

import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { User as UserIcon, Settings } from 'lucide-react'
import { getCurrentUserProfile, getDisplayName, getAvatarUrl, type Profile } from '@/lib/supabase/profiles'

interface LayoutProps {
  children: React.ReactNode
  user: User
}

export default function Layout({ children, user }: LayoutProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const loadProfile = async () => {
      const userProfile = await getCurrentUserProfile()
      setProfile(userProfile)
    }
    
    if (user) {
      loadProfile()
    }
  }, [user])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-900">
                Sadiebug🐞
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link 
                href="/upload" 
                className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Upload Photos
              </Link>
              <Link 
                href="/family" 
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Family
              </Link>
              
              {/* Profile Section */}
              <div className="flex items-center space-x-3">
                {/* Profile Link with Avatar */}
                <Link 
                  href="/profile" 
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  {getAvatarUrl(profile) ? (
                    <Image
                      src={getAvatarUrl(profile)!}
                      alt="Profile"
                      width={24}
                      height={24}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-5 h-5" />
                  )}
                  <span className="hidden sm:block">
                    {getDisplayName(profile)}
                  </span>
                </Link>
                
                {/* Profile Settings Link */}
                <Link 
                  href="/profile" 
                  className="text-gray-500 hover:text-gray-700 p-1 rounded"
                  title="Profile Settings"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </div>
              
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}