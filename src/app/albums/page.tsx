'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import Layout from '@/components/Layout'
import Image from 'next/image'
import Link from 'next/link'
import { 
  getAlbums, 
  getAlbumPhotos, 
  deleteAlbum,
  type Album 
} from '@/lib/supabase/albums'
import { getDisplayName, getAvatarUrl } from '@/lib/supabase/profiles'
import { 
  Plus, 
  Images, 
  Share2, 
  Trash2, 
  MoreVertical,
  Calendar,
  User as UserIcon
} from 'lucide-react'

interface AlbumWithPreview extends Album {
  previewPhotos: string[]
}

export default function AlbumsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [albums, setAlbums] = useState<AlbumWithPreview[]>([])
  const [loadingAlbums, setLoadingAlbums] = useState(false)
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

  useEffect(() => {
    if (user) {
      loadAlbums()
    }
  }, [user])

  const loadAlbums = async () => {
    setLoadingAlbums(true)
    try {
      const albumsData = await getAlbums()
      
      // Get preview photos for each album
      const albumsWithPreviews = await Promise.all(
        albumsData.map(async (album) => {
          try {
            const photos = await getAlbumPhotos(album.id)
            const previewPhotos = photos
              .slice(0, 4)
              .map(ap => ap.photo?.file_path)
              .filter((path): path is string => Boolean(path))
            return { ...album, previewPhotos }
          } catch (error) {
            console.error(`Error loading photos for album ${album.id}:`, error)
            return { ...album, previewPhotos: [] }
          }
        })
      )
      
      setAlbums(albumsWithPreviews)
    } catch (error) {
      console.error('Error loading albums:', error)
    } finally {
      setLoadingAlbums(false)
    }
  }

  const handleDeleteAlbum = async (albumId: string, albumName: string) => {
    if (!confirm(`Are you sure you want to delete the album "${albumName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteAlbum(albumId)
      await loadAlbums() // Refresh the list
    } catch (error) {
      console.error('Error deleting album:', error)
      alert('Failed to delete album. Please try again.')
    }
  }

  const copyShareLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/shared/${shareToken}`
    navigator.clipboard.writeText(shareUrl)
    // You could add a toast notification here
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

  return (
    <Layout user={user!}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Albums</h1>
            <p className="text-gray-600 mt-1">
              Create and share collections of your favorite photos
            </p>
          </div>
          
          <Link
            href="/albums/create"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Album
          </Link>
        </div>

        {/* Albums Grid */}
        {loadingAlbums ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading albums...</p>
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-12">
            <Images className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No albums yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first album to organize and share your photos
            </p>
            <Link
              href="/albums/create"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Album
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {albums.map((album) => (
              <div key={album.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {/* Album Preview */}
                <Link href={`/albums/${album.id}`}>
                  <div className="aspect-square bg-gray-100 relative cursor-pointer">
                    {album.previewPhotos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-1 h-full">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className="relative bg-gray-200">
                            {album.previewPhotos[index] ? (
                              <div className="w-full h-full bg-gray-300 rounded">
                                {/* Photo preview would go here - simplified for now */}
                                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                  <Images className="w-8 h-8 text-white opacity-70" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full bg-gray-200"></div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Images className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Album Info */}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Link href={`/albums/${album.id}`}>
                      <h3 className="font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-1">
                        {album.name}
                      </h3>
                    </Link>
                    
                    <div className="relative group">
                      <button className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                      
                      {/* Dropdown menu would go here */}
                      <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border py-1 min-w-[120px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        <button
                          onClick={() => copyShareLink(album.share_token)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Copy Link
                        </button>
                        <button
                          onClick={() => handleDeleteAlbum(album.id, album.name)}
                          className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">
                    {album.photo_count || 0} photo{(album.photo_count || 0) !== 1 ? 's' : ''}
                  </p>

                  {album.description && (
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                      {album.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500">
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
                      <Calendar className="w-3 h-3 mr-1" />
                      <span>{formatDate(album.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}