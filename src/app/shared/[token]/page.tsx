'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { 
  getAlbumByToken, 
  getAlbumPhotos,
  logAlbumView,
  type Album,
  type AlbumPhoto 
} from '@/lib/supabase/albums'
import { getDisplayName } from '@/lib/supabase/profiles'
import { 
  Images,
  Calendar,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'

interface PhotoWithUrl extends AlbumPhoto {
  imageUrl?: string | null
}

export default function SharedAlbumPage() {
  const params = useParams()
  const token = params.token as string
  const [album, setAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (token) {
      loadSharedAlbum()
    }
  }, [token])

  const loadSharedAlbum = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Get album by token
      const albumData = await getAlbumByToken(token)
      if (!albumData) {
        setError('Album not found or link has expired')
        return
      }

      setAlbum(albumData)

      // Log the view (optional analytics)
      try {
        await logAlbumView(albumData.id, 
          // Get client IP if possible (would need server-side for real IP)
          undefined, 
          navigator.userAgent
        )
      } catch (viewError) {
        // Don't fail if view logging fails
        console.error('Failed to log album view:', viewError)
      }

      // Get album photos
      const albumPhotos = await getAlbumPhotos(albumData.id)
      
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
      console.error('Error loading shared album:', error)
      setError('Failed to load album')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (index: number) => {
    setSelectedPhotoIndex(index)
  }

  const closeModal = () => {
    setSelectedPhotoIndex(null)
  }

  const goToNext = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1)
    }
  }

  const goToPrevious = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading album...</p>
        </div>
      </div>
    )
  }

  if (error || !album) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Images className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error || 'Album Not Found'}
          </h1>
          <p className="text-gray-600">
            This album link may have expired or been removed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{album.name}</h1>
              {album.description && (
                <p className="text-gray-600 mb-4">{album.description}</p>
              )}
              <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center">
                  <Images className="w-4 h-4 mr-1" />
                  {photos.length} photo{photos.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center">
                  <UserIcon className="w-4 h-4 mr-1" />
                  {getDisplayName(album.creator || null)}
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {formatDate(album.created_at)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Photos Grid */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          {photos.length === 0 ? (
            <div className="text-center py-12">
              <Images className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No photos in this album</h3>
              <p className="text-gray-600">This album doesn&apos;t contain any photos yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((albumPhoto, index) => (
                <div 
                  key={albumPhoto.id} 
                  className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => openModal(index)}
                >
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
                    <div className="p-3">
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

        {/* Powered by footer */}
        <div className="text-center py-8 border-t border-gray-200 mt-12">
          <p className="text-sm text-gray-500">
            Shared with ❤️ by Sadiebug🐞
          </p>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhotoIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="relative w-full h-full max-w-4xl max-h-4xl mx-4">
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full p-2"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation buttons */}
            {selectedPhotoIndex > 0 && (
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full p-2"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            
            {selectedPhotoIndex < photos.length - 1 && (
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full p-2"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Image */}
            <div className="w-full h-full flex items-center justify-center">
              {photos[selectedPhotoIndex]?.imageUrl ? (
                <div className="relative max-w-full max-h-full">
                  <Image
                    src={photos[selectedPhotoIndex].imageUrl!}
                    alt={photos[selectedPhotoIndex].photo?.original_filename || 'Photo'}
                    width={800}
                    height={600}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-64 h-64 bg-gray-700 flex items-center justify-center rounded">
                  <Images className="w-16 h-16 text-gray-500" />
                </div>
              )}
            </div>

            {/* Photo info */}
            {photos[selectedPhotoIndex]?.photo?.caption && (
              <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded">
                <p className="text-sm">{photos[selectedPhotoIndex].photo!.caption}</p>
              </div>
            )}

            {/* Photo counter */}
            <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded">
              {selectedPhotoIndex + 1} of {photos.length}
            </div>
          </div>
        </div>
      )}
    </>
  )
}