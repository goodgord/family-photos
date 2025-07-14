'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import Layout from '@/components/Layout'
import Image from 'next/image'
import Link from 'next/link'
import { 
  getAlbum, 
  getAlbumPhotos, 
  deleteAlbum,
  updateAlbum,
  type Album,
  type AlbumPhoto 
} from '@/lib/supabase/albums'
import { getDisplayName, getAvatarUrl } from '@/lib/supabase/profiles'
import { 
  ArrowLeft, 
  Share2, 
  Trash2, 
  Edit3,
  Save,
  X,
  Calendar,
  User as UserIcon,
  Images,
  Check
} from 'lucide-react'

interface PhotoWithUrl extends AlbumPhoto {
  imageUrl?: string | null
}

export default function AlbumDetailPage() {
  const params = useParams()
  const albumId = params.id as string
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [album, setAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [shareUrlCopied, setShareUrlCopied] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)
      setLoading(false)
    }
    getUser()
  }, [supabase, router])

  useEffect(() => {
    if (user && albumId) {
      loadAlbum()
      loadPhotos()
    }
  }, [user, albumId])

  const loadAlbum = async () => {
    try {
      const albumData = await getAlbum(albumId)
      if (!albumData) {
        router.push('/albums')
        return
      }
      setAlbum(albumData)
      setEditName(albumData.name)
      setEditDescription(albumData.description || '')
    } catch (error) {
      console.error('Error loading album:', error)
      router.push('/albums')
    }
  }

  const loadPhotos = async () => {
    setLoadingPhotos(true)
    try {
      const albumPhotos = await getAlbumPhotos(albumId)
      
      // Get signed URLs for photos
      const photosWithUrls = await Promise.all(
        albumPhotos.map(async (albumPhoto) => {
          if (!albumPhoto.photo) return { ...albumPhoto, imageUrl: null }
          
          try {
            const { data, error } = await supabase.storage
              .from('family-photos')
              .createSignedUrl(albumPhoto.photo.file_path, 60 * 60) // 1 hour

            return {
              ...albumPhoto,
              imageUrl: error ? null : data.signedUrl
            }
          } catch (error) {
            console.error('Error getting signed URL:', error)
            return { ...albumPhoto, imageUrl: null }
          }
        })
      )
      
      setPhotos(photosWithUrls)
    } catch (error) {
      console.error('Error loading album photos:', error)
    } finally {
      setLoadingPhotos(false)
    }
  }

  const handleSave = async () => {
    if (!album || !editName.trim()) return

    setIsSaving(true)
    try {
      const updatedAlbum = await updateAlbum(album.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined
      })
      setAlbum(updatedAlbum)
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating album:', error)
      alert('Failed to update album')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (album) {
      setEditName(album.name)
      setEditDescription(album.description || '')
    }
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!album) return

    const confirmed = confirm(`Are you sure you want to delete the album "${album.name}"? This action cannot be undone.`)
    if (!confirmed) return

    try {
      await deleteAlbum(album.id)
      router.push('/albums')
    } catch (error) {
      console.error('Error deleting album:', error)
      alert('Failed to delete album')
    }
  }

  const copyShareLink = () => {
    if (!album) return
    
    const shareUrl = `${window.location.origin}/shared/${album.share_token}`
    navigator.clipboard.writeText(shareUrl)
    setShareUrlCopied(true)
    setTimeout(() => setShareUrlCopied(false), 2000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8">Loading...</h1>
        </div>
      </main>
    )
  }

  if (!album) {
    return (
      <Layout user={user!}>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Album not found</h1>
          <Link href="/albums" className="text-blue-600 hover:text-blue-800">
            ← Back to Albums
          </Link>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user!}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Link 
              href="/albums"
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="w-5 h-5 mr-1" />
              Albums
            </Link>
          </div>

          <div className="flex justify-between items-start">
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-3xl font-bold bg-transparent border-b-2 border-blue-500 focus:outline-none w-full max-w-md"
                    placeholder="Album name..."
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="text-gray-600 bg-gray-50 border rounded-md p-2 w-full max-w-md resize-none"
                    placeholder="Album description..."
                    rows={2}
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !editName.trim()}
                      className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="flex items-center px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">{album.name}</h1>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-gray-500 hover:text-gray-700 p-1"
                      title="Edit album"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                  </div>
                  {album.description && (
                    <p className="text-gray-600 mb-3">{album.description}</p>
                  )}
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Images className="w-4 h-4 mr-1" />
                      {photos.length} photo{photos.length !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center">
                      {getAvatarUrl(album.creator || null) ? (
                        <Image
                          src={getAvatarUrl(album.creator || null)!}
                          alt="Creator"
                          width={16}
                          height={16}
                          className="rounded-full mr-1"
                        />
                      ) : (
                        <UserIcon className="w-4 h-4 mr-1" />
                      )}
                      <span>{getDisplayName(album.creator || null)}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(album.created_at)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!isEditing && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={copyShareLink}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {shareUrlCopied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </>
                  )}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Photos Grid */}
        {loadingPhotos ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading photos...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-12">
            <Images className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No photos in this album</h3>
            <p className="text-gray-600 mb-6">
              Add photos from the gallery to see them here
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Gallery
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {photos.map((albumPhoto) => (
              <div key={albumPhoto.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square relative">
                  {albumPhoto.imageUrl ? (
                    <Image
                      src={albumPhoto.imageUrl}
                      alt={albumPhoto.photo?.original_filename || 'Photo'}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <Images className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                {albumPhoto.photo?.caption && (
                  <div className="p-2">
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {albumPhoto.photo.caption}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}