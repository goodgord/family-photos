import { createClient } from './client'
import { type Profile } from './profiles'

export interface Album {
  id: string
  name: string
  description: string | null
  created_by: string
  share_token: string
  is_public: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
  photo_count?: number
  creator?: Profile | null
}

export interface AlbumPhoto {
  id: string
  album_id: string
  photo_id: string
  added_by: string
  position: number
  added_at: string
  photo?: any // Will be filled with photo data when needed
}

export interface CreateAlbumData {
  name: string
  description?: string
  photoIds?: string[]
}

export interface UpdateAlbumData {
  name?: string
  description?: string
  is_public?: boolean
  expires_at?: string | null
}

/**
 * Create a new album
 */
export async function createAlbum(data: CreateAlbumData): Promise<Album> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User must be authenticated to create albums')
  }

  // Create the album
  const { data: album, error: albumError } = await supabase
    .from('albums')
    .insert({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      created_by: user.id
    })
    .select('*')
    .single()

  if (albumError) {
    console.error('Error creating album:', albumError)
    throw new Error(`Failed to create album: ${albumError.message}`)
  }

  // Add photos to album if provided
  if (data.photoIds && data.photoIds.length > 0) {
    await addPhotosToAlbum(album.id, data.photoIds)
  }

  return album
}

/**
 * Get all albums for the current user's family
 */
export async function getAlbums(): Promise<Album[]> {
  const supabase = createClient()
  
  const { data: albums, error } = await supabase
    .from('albums')
    .select(`
      *,
      creator:profiles!albums_created_by_fkey(*),
      album_photos(count)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching albums:', error)
    throw new Error(`Failed to fetch albums: ${error.message}`)
  }

  // Transform the data to include photo count
  return albums.map(album => ({
    ...album,
    photo_count: album.album_photos?.[0]?.count || 0,
    creator: album.creator || null
  }))
}

/**
 * Get a single album by ID
 */
export async function getAlbum(id: string): Promise<Album | null> {
  const supabase = createClient()
  
  const { data: album, error } = await supabase
    .from('albums')
    .select(`
      *,
      creator:profiles!albums_created_by_fkey(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Album not found
    }
    console.error('Error fetching album:', error)
    throw new Error(`Failed to fetch album: ${error.message}`)
  }

  return {
    ...album,
    creator: album.creator || null
  }
}

/**
 * Get an album by its share token (for public access)
 */
export async function getAlbumByToken(token: string): Promise<Album | null> {
  const supabase = createClient()
  
  const { data: album, error } = await supabase
    .from('albums')
    .select(`
      *,
      creator:profiles!albums_created_by_fkey(*)
    `)
    .eq('share_token', token)
    .eq('is_public', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Album not found
    }
    console.error('Error fetching album by token:', error)
    throw new Error(`Failed to fetch album: ${error.message}`)
  }

  // Check if album is expired
  if (album.expires_at && new Date(album.expires_at) < new Date()) {
    return null
  }

  return {
    ...album,
    creator: album.creator || null
  }
}

/**
 * Update an album
 */
export async function updateAlbum(id: string, updates: UpdateAlbumData): Promise<Album> {
  const supabase = createClient()
  
  const { data: album, error } = await supabase
    .from('albums')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating album:', error)
    throw new Error(`Failed to update album: ${error.message}`)
  }

  return album
}

/**
 * Delete an album
 */
export async function deleteAlbum(id: string): Promise<void> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('albums')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting album:', error)
    throw new Error(`Failed to delete album: ${error.message}`)
  }
}

/**
 * Get photos in an album
 */
export async function getAlbumPhotos(albumId: string): Promise<AlbumPhoto[]> {
  const supabase = createClient()
  
  const { data: albumPhotos, error } = await supabase
    .from('album_photos')
    .select(`
      *,
      photo:photos(*)
    `)
    .eq('album_id', albumId)
    .order('position', { ascending: true })

  if (error) {
    console.error('Error fetching album photos:', error)
    throw new Error(`Failed to fetch album photos: ${error.message}`)
  }

  return albumPhotos || []
}

/**
 * Add photos to an album
 */
export async function addPhotosToAlbum(albumId: string, photoIds: string[]): Promise<void> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User must be authenticated to add photos to albums')
  }

  // Get the current highest position in the album
  const { data: lastPhoto } = await supabase
    .from('album_photos')
    .select('position')
    .eq('album_id', albumId)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const startPosition = (lastPhoto?.position || 0) + 1

  // Create album photo entries
  const albumPhotoEntries = photoIds.map((photoId, index) => ({
    album_id: albumId,
    photo_id: photoId,
    added_by: user.id,
    position: startPosition + index
  }))

  const { error } = await supabase
    .from('album_photos')
    .insert(albumPhotoEntries)

  if (error) {
    console.error('Error adding photos to album:', error)
    throw new Error(`Failed to add photos to album: ${error.message}`)
  }
}

/**
 * Remove a photo from an album
 */
export async function removePhotoFromAlbum(albumId: string, photoId: string): Promise<void> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('album_photos')
    .delete()
    .eq('album_id', albumId)
    .eq('photo_id', photoId)

  if (error) {
    console.error('Error removing photo from album:', error)
    throw new Error(`Failed to remove photo from album: ${error.message}`)
  }
}

/**
 * Reorder photos in an album
 */
export async function reorderAlbumPhotos(
  albumId: string, 
  photoOrders: { id: string; position: number }[]
): Promise<void> {
  const supabase = createClient()
  
  // Update each photo's position
  const updates = photoOrders.map(({ id, position }) =>
    supabase
      .from('album_photos')
      .update({ position })
      .eq('id', id)
  )

  const results = await Promise.all(updates)
  
  // Check if any updates failed
  const errors = results.filter(result => result.error)
  if (errors.length > 0) {
    console.error('Error reordering album photos:', errors)
    throw new Error('Failed to reorder some photos')
  }
}

/**
 * Log an album view (for analytics)
 */
export async function logAlbumView(albumId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('album_views')
    .insert({
      album_id: albumId,
      ip_address: ipAddress || null,
      user_agent: userAgent || null
    })

  if (error) {
    // Don't throw error for view logging failures, just log them
    console.error('Error logging album view:', error)
  }
}

/**
 * Generate a new share token for an album
 */
export async function regenerateShareToken(albumId: string): Promise<string> {
  const supabase = createClient()
  
  const { data: album, error } = await supabase
    .rpc('gen_random_uuid')
    .single()

  if (error) {
    throw new Error('Failed to generate new token')
  }

  const newToken = album

  const { error: updateError } = await supabase
    .from('albums')
    .update({ share_token: newToken })
    .eq('id', albumId)

  if (updateError) {
    console.error('Error updating share token:', updateError)
    throw new Error(`Failed to update share token: ${updateError.message}`)
  }

  return newToken
}

/**
 * Get album statistics
 */
export async function getAlbumStats(albumId: string): Promise<{
  photoCount: number
  viewCount: number
  lastViewed: string | null
}> {
  const supabase = createClient()
  
  // Get photo count
  const { count: photoCount } = await supabase
    .from('album_photos')
    .select('*', { count: 'exact', head: true })
    .eq('album_id', albumId)

  // Get view stats
  const { count: viewCount } = await supabase
    .from('album_views')
    .select('*', { count: 'exact', head: true })
    .eq('album_id', albumId)

  const { data: lastView } = await supabase
    .from('album_views')
    .select('viewed_at')
    .eq('album_id', albumId)
    .order('viewed_at', { ascending: false })
    .limit(1)
    .single()

  return {
    photoCount: photoCount || 0,
    viewCount: viewCount || 0,
    lastViewed: lastView?.viewed_at || null
  }
}