'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import Image from 'next/image'
import Layout from '@/components/Layout'
import { 
  getCurrentUserProfile, 
  updateProfile, 
  uploadAvatar, 
  deleteAvatar,
  getDisplayName,
  getAvatarUrl,
  type Profile 
} from '@/lib/supabase/profiles'
import { User as UserIcon, Camera, Save, X } from 'lucide-react'

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)
      
      const userProfile = await getCurrentUserProfile()
      setProfile(userProfile)
      setFullName(userProfile?.full_name || '')
      setLoading(false)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          router.push('/')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, router])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleSaveProfile = async () => {
    if (!user) return

    setSaving(true)
    try {
      const updatedProfile = await updateProfile(user.id, {
        full_name: fullName.trim() || null
      })
      
      setProfile(updatedProfile)
      showMessage('success', 'Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      showMessage('error', 'Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Please select a valid image file.')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showMessage('error', 'Image must be smaller than 5MB.')
      return
    }

    // Create preview
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    // Upload avatar
    handleAvatarUpload(file)
  }

  const handleAvatarUpload = async (file: File) => {
    if (!user) return

    setUploading(true)
    try {
      const avatarUrl = await uploadAvatar(user.id, file)
      
      const updatedProfile = await updateProfile(user.id, {
        avatar_url: avatarUrl
      })
      
      setProfile(updatedProfile)
      setPreviewUrl(null) // Clear preview since we have the real URL now
      showMessage('success', 'Avatar updated successfully!')
    } catch (error) {
      console.error('Error uploading avatar:', error)
      showMessage('error', 'Failed to upload avatar. Please try again.')
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user) return

    setUploading(true)
    try {
      await deleteAvatar(user.id)
      
      const updatedProfile = await updateProfile(user.id, {
        avatar_url: null
      })
      
      setProfile(updatedProfile)
      setPreviewUrl(null)
      showMessage('success', 'Avatar removed successfully!')
    } catch (error) {
      console.error('Error removing avatar:', error)
      showMessage('error', 'Failed to remove avatar. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <Layout user={user}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading...</h1>
          </div>
        </div>
      </Layout>
    )
  }

  const currentAvatarUrl = previewUrl || getAvatarUrl(profile)

  return (
    <Layout user={user}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Settings</h1>
          <p className="text-gray-600">
            Manage your display name and avatar for the family photo app
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Profile Form */}
        <div className="bg-white rounded-lg shadow p-6">
          {/* Avatar Section */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Profile Photo
            </label>
            
            <div className="flex items-center space-x-6">
              {/* Avatar Display */}
              <div className="relative">
                {currentAvatarUrl ? (
                  <Image
                    src={currentAvatarUrl}
                    alt="Profile"
                    width={96}
                    height={96}
                    className="rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                    <UserIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                
                {uploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {/* Avatar Controls */}
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {profile?.avatar_url ? 'Change Photo' : 'Upload Photo'}
                </button>
                
                {profile?.avatar_url && (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={uploading}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove Photo
                  </button>
                )}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            
            <p className="mt-2 text-xs text-gray-500">
              Upload a photo to personalize your profile. Max size: 5MB. Supported formats: JPEG, PNG, WebP.
            </p>
          </div>

          {/* Display Name Section */}
          <div className="mb-8">
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your display name"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              maxLength={100}
            />
            <p className="mt-1 text-xs text-gray-500">
              This name will be shown when you upload photos or leave comments. 
              {!fullName.trim() && ' If left empty, your email will be displayed instead.'}
            </p>
          </div>

          {/* Email Display (Read-only) */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Your email address cannot be changed here. Contact support if you need to update it.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Current Profile Preview */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Preview</h3>
          <div className="flex items-center space-x-3">
            {getAvatarUrl(profile) ? (
              <Image
                src={getAvatarUrl(profile)!}
                alt="Profile"
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-gray-500" />
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">
                {getDisplayName(profile)}
              </p>
              <p className="text-sm text-gray-500">
                This is how you&apos;ll appear to other family members
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}