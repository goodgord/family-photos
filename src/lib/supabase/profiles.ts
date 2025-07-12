import { createClient } from './client'
import imageCompression from 'browser-image-compression'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface ProfileUpdate {
  full_name?: string
  avatar_url?: string
}

/**
 * Get a user's profile by their ID
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }
  
  return data
}

/**
 * Get the current user's profile
 */
export async function getCurrentUserProfile(): Promise<Profile | null> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  return getProfile(user.id)
}

/**
 * Update a user's profile
 */
export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single()
  
  if (error) {
    console.error('Error updating profile:', error)
    throw new Error(`Failed to update profile: ${error.message}`)
  }
  
  return data
}

/**
 * Compress and upload an avatar image
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = createClient()
  
  try {
    // Compress the image
    const compressedFile = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 500,
      useWebWorker: true,
      fileType: 'image/jpeg'
    })
    
    // Generate unique filename
    const fileExt = 'jpg' // Always use jpg after compression
    const fileName = `${userId}/avatar.${fileExt}`
    
    // Delete existing avatar first
    await supabase.storage
      .from('avatars')
      .remove([fileName])
    
    // Upload new avatar
    const { error } = await supabase.storage
      .from('avatars')
      .upload(fileName, compressedFile, {
        upsert: true,
        contentType: 'image/jpeg'
      })
    
    if (error) {
      throw new Error(`Upload failed: ${error.message}`)
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)
    
    return urlData.publicUrl
  } catch (error) {
    console.error('Error uploading avatar:', error)
    throw new Error(`Failed to upload avatar: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Delete a user's avatar
 */
export async function deleteAvatar(userId: string): Promise<void> {
  const supabase = createClient()
  
  const fileName = `${userId}/avatar.jpg`
  
  const { error } = await supabase.storage
    .from('avatars')
    .remove([fileName])
  
  if (error) {
    console.error('Error deleting avatar:', error)
    throw new Error(`Failed to delete avatar: ${error.message}`)
  }
}

/**
 * Get profiles for multiple users (useful for displaying with photos/comments)
 */
export async function getProfiles(userIds: string[]): Promise<Profile[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds)
  
  if (error) {
    console.error('Error fetching profiles:', error)
    return []
  }
  
  return data || []
}

/**
 * Get display name for a user (full_name or fallback to email)
 */
export function getDisplayName(profile: Profile | null): string {
  if (!profile) return 'Unknown User'
  return profile.full_name || profile.email || 'Unknown User'
}

/**
 * Get avatar URL or return null for default avatar handling
 */
export function getAvatarUrl(profile: Profile | null): string | null {
  return profile?.avatar_url || null
}