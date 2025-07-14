'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import Layout from '@/components/Layout'
import Image from 'next/image'
import PhotoModal from '@/components/PhotoModal'
import ReactionSummary from '@/components/ReactionSummary'
import ReactionButton from '@/components/ReactionButton'
import CreateAlbumModal from '@/components/CreateAlbumModal'
import { 
  loadMultiplePhotoReactions, 
  addHeartReaction,
  type PhotoReactions 
} from '@/lib/reactions'
import { useClickHandler } from '@/hooks/useClickHandler'
import { getDisplayName, getAvatarUrl, type Profile } from '@/lib/supabase/profiles'
import { User as UserIcon, Check, X, FolderPlus } from 'lucide-react'

interface Photo {
  id: string
  filename: string
  original_filename: string
  caption: string | null
  file_path: string
  uploaded_at: string
  uploaded_by: string
}

interface PhotoWithProfile extends Photo {
  imageUrl: string | null
  uploader_profile: Profile | null
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState<PhotoWithProfile[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [email, setEmail] = useState('')
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const [photoReactions, setPhotoReactions] = useState<PhotoReactions>({})
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set())
  const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  const getImageUrl = useCallback(async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('family-photos')
        .createSignedUrl(filePath, 60 * 60) // 1 hour expiry
      
      if (error) {
        console.error('Error creating signed URL:', error)
        return null
      }
      
      return data.signedUrl
    } catch (error) {
      console.error('Error getting image URL:', error)
      return null
    }
  }, [supabase])

  const loadPhotos = useCallback(async () => {
    setLoadingPhotos(true)
    try {
      // First get photos
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Error loading photos:', error)
      } else if (data) {
        // Get unique uploader IDs
        const uploaderIds = [...new Set(data.map(photo => photo.uploaded_by))]
        
        // Get profiles for all uploaders
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', uploaderIds)
        
        // Create a map of profiles by ID
        const profileMap = new Map(profiles?.map(profile => [profile.id, profile]) || [])
        
        // Get signed URLs for all photos and add profile data
        const photosWithUrls = await Promise.all(
          data.map(async (photo) => ({
            ...photo,
            imageUrl: await getImageUrl(photo.file_path),
            uploader_profile: profileMap.get(photo.uploaded_by) || null
          }))
        )
        setPhotos(photosWithUrls)
        
        // Load reactions for all photos
        const photoIds = photosWithUrls.map(photo => photo.id)
        if (photoIds.length > 0) {
          try {
            const reactions = await loadMultiplePhotoReactions(photoIds)
            setPhotoReactions(reactions)
          } catch (error) {
            console.error('Error loading photo reactions:', error)
            // Set empty reactions if loading fails
            setPhotoReactions({})
          }
        }
      }
    } catch (error) {
      console.error('Error loading photos:', error)
    } finally {
      setLoadingPhotos(false)
    }
  }, [supabase, getImageUrl])

  useEffect(() => {
    if (user) {
      loadPhotos()
    }
  }, [user, loadPhotos])

  const signIn = async () => {
    if (!email) {
      alert('Please enter your email')
      return
    }
    
    // Import signInWithMagicLink dynamically to avoid SSR issues
    const { signInWithMagicLink } = await import('@/lib/auth')
    const result = await signInWithMagicLink(email)
    
    if (result.success) {
      alert('Check your email for the login link!')
    } else {
      alert('Error: ' + result.error?.message)
    }
  }

  const openModal = (photoIndex: number) => {
    setSelectedPhotoIndex(photoIndex)
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

  // Handle heart reaction for gallery photos
  const handleGalleryHeartReaction = useCallback(async (photoId: string) => {
    try {
      await addHeartReaction(photoId)
      // Reload reactions for this specific photo
      const reactions = await loadMultiplePhotoReactions([photoId])
      setPhotoReactions(prev => ({ ...prev, ...reactions }))
    } catch (error) {
      if (error instanceof Error && error.message === 'REACTION_REMOVED') {
        // Heart was removed, reload reactions
        const reactions = await loadMultiplePhotoReactions([photoId])
        setPhotoReactions(prev => ({ ...prev, ...reactions }))
      } else {
        console.error('Error adding heart reaction:', error)
      }
    }
  }, [])

  // Handle reaction change from ReactionButton in gallery
  const handleGalleryReactionChange = useCallback(async (photoId: string) => {
    try {
      // Reload reactions for this specific photo
      const reactions = await loadMultiplePhotoReactions([photoId])
      setPhotoReactions(prev => ({ ...prev, ...reactions }))
    } catch (error) {
      console.error('Error updating gallery reactions:', error)
    }
  }, [])

  // Helper function to show heart animation
  const showHeartAnimation = useCallback((clientX: number, clientY: number) => {
    const heart = document.createElement('div')
    heart.innerHTML = '❤️'
    heart.className = 'fixed pointer-events-none z-50 text-2xl'
    heart.style.left = `${clientX - 12}px`
    heart.style.top = `${clientY - 12}px`
    heart.style.animation = 'heartPop 1s ease-out forwards'

    // Add styles if not already added
    if (!document.querySelector('#heart-animation-styles')) {
      const style = document.createElement('style')
      style.id = 'heart-animation-styles'
      style.textContent = `
        @keyframes heartPop {
          0% { transform: scale(0) rotate(0deg); opacity: 1; }
          50% { transform: scale(1.2) rotate(-10deg); opacity: 1; }
          100% { transform: scale(0.8) rotate(0deg) translateY(-20px); opacity: 0; }
        }
      `
      document.head.appendChild(style)
    }

    document.body.appendChild(heart)
    setTimeout(() => {
      if (document.body.contains(heart)) {
        document.body.removeChild(heart)
      }
    }, 1000)
  }, [])

  // Selection mode helper functions
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    if (isSelectionMode) {
      // Clear selections when exiting selection mode
      setSelectedPhotoIds(new Set())
    }
  }

  const togglePhotoSelection = (photoId: string) => {
    const newSelection = new Set(selectedPhotoIds)
    if (newSelection.has(photoId)) {
      newSelection.delete(photoId)
    } else {
      newSelection.add(photoId)
    }
    setSelectedPhotoIds(newSelection)
  }

  const clearSelection = () => {
    setSelectedPhotoIds(new Set())
  }

  const createAlbumFromSelection = () => {
    if (selectedPhotoIds.size >= 2) {
      setShowCreateAlbumModal(true)
    }
  }

  const handleAlbumCreated = (albumId: string) => {
    // Exit selection mode and clear selections
    setIsSelectionMode(false)
    setSelectedPhotoIds(new Set())
    // Optionally navigate to the new album
    console.log('Album created with ID:', albumId)
  }

  // Component for individual gallery photo with reactions
  const GalleryPhoto = ({ photo, index }: { photo: PhotoWithProfile; index: number }) => {
    const photoReactionsList = photoReactions[photo.id] || []
    const isSelected = selectedPhotoIds.has(photo.id)

    // Handle single vs double click/tap
    const clickHandler = useClickHandler({
      onSingleClick: () => {
        if (isSelectionMode) {
          togglePhotoSelection(photo.id)
        } else {
          openModal(index)
        }
      },
      onDoubleClick: ({ clientX, clientY }) => {
        if (!isSelectionMode) {
          handleGalleryHeartReaction(photo.id)
          showHeartAnimation(clientX, clientY)
        }
      },
      delay: 300,
      touchMoveThreshold: 10 // 10px movement threshold for distinguishing tap vs scroll
    })

    return (
      <div key={photo.id} className="bg-white rounded-lg shadow overflow-hidden">
        <div 
          className={`aspect-square relative cursor-pointer transition-all duration-200 select-none ${
            isSelectionMode 
              ? (isSelected ? 'ring-4 ring-blue-500 opacity-80' : 'hover:ring-2 hover:ring-gray-300') 
              : 'hover:opacity-90'
          }`}
          onClick={clickHandler.onClick}
          onTouchStart={clickHandler.onTouchStart}
          onTouchMove={clickHandler.onTouchMove}
          onTouchEnd={clickHandler.onTouchEnd}
        >
          {/* Selection checkbox */}
          {isSelectionMode && (
            <div className="absolute top-2 right-2 z-10">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                isSelected 
                  ? 'bg-blue-500 border-blue-500' 
                  : 'bg-white border-gray-300 hover:border-blue-500'
              }`}>
                {isSelected && <Check className="w-4 h-4 text-white" />}
              </div>
            </div>
          )}
          {photo.imageUrl ? (
            <Image
              src={photo.imageUrl}
              alt={photo.original_filename}
              fill
              className="object-cover"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <p className="text-gray-500">Loading...</p>
            </div>
          )}
        </div>
        
        {/* Reactions below photo */}
        <div className="px-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {photoReactionsList.length > 0 ? (
                <ReactionSummary
                  reactions={photoReactionsList}
                  size="sm"
                  layout="compact"
                  maxDisplay={3}
                />
              ) : (
                <div className="text-xs text-gray-500">
                  Double-tap for ❤️ or click to react
                </div>
              )}
            </div>
            <div className="ml-2">
              <ReactionButton
                photoId={photo.id}
                onReactionChange={() => handleGalleryReactionChange(photo.id)}
                size="sm"
                showText={photoReactionsList.length === 0}
              />
            </div>
          </div>
        </div>
        
        {photo.caption && (
          <div className="px-3 pb-2">
            <p className="text-sm text-gray-700">{photo.caption}</p>
          </div>
        )}
        
        {/* Uploader info */}
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getAvatarUrl(photo.uploader_profile) ? (
                <Image
                  src={getAvatarUrl(photo.uploader_profile)!}
                  alt="Uploader"
                  width={20}
                  height={20}
                  className="rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-xs text-gray-600">
                {getDisplayName(photo.uploader_profile)}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {new Date(photo.uploaded_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    )
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

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold mb-8">Sadiebug🐞</h1>
          <p className="text-gray-600 mb-8">
            A private space for our family to share precious moments
          </p>
          <div className="mb-4">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  signIn()
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button 
            onClick={signIn}
            className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Sign In with Magic Link
          </button>
          <p className="mt-4 text-sm text-gray-600">
            We&apos;ll send you a secure login link
          </p>
        </div>
      </main>
    )
  }

  return (
    <>
    <Layout user={user}>
      <div>
        {/* Header with selection mode controls */}
        <div className="flex justify-between items-center mb-8">
          {isSelectionMode ? (
            <>
              <div className="flex items-center space-x-4">
                <button
                  onClick={clearSelection}
                  className="inline-flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear Selection
                </button>
                <span className="text-lg font-medium text-gray-900">
                  {selectedPhotoIds.size} photo{selectedPhotoIds.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center space-x-3">
                {selectedPhotoIds.size >= 2 && (
                  <button
                    onClick={createAlbumFromSelection}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FolderPlus className="w-4 h-4 mr-2" />
                    Create Album
                  </button>
                )}
                <button
                  onClick={toggleSelectionMode}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900">Our Photos</h1>
              <div className="flex items-center space-x-4">
                <p className="text-gray-600">{photos.length} photos</p>
                {photos.length > 0 && (
                  <button
                    onClick={toggleSelectionMode}
                    className="inline-flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Select Photos
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {loadingPhotos ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading photos...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No photos yet. Start sharing your memories!</p>
            <a 
              href="/upload"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Upload First Photo
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <GalleryPhoto key={photo.id} photo={photo} index={index} />
            ))}
          </div>
        )}
      </div>
    </Layout>

    {/* Photo Modal */}
    {selectedPhotoIndex !== null && (
      <PhotoModal
        photos={photos}
        currentIndex={selectedPhotoIndex}
        isOpen={selectedPhotoIndex !== null}
        onClose={closeModal}
        onNext={goToNext}
        onPrevious={goToPrevious}
      />
    )}

    {/* Create Album Modal */}
    <CreateAlbumModal
      isOpen={showCreateAlbumModal}
      onClose={() => setShowCreateAlbumModal(false)}
      selectedPhotoIds={Array.from(selectedPhotoIds)}
      onSuccess={handleAlbumCreated}
    />
  </>
  )
}