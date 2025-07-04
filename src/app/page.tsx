'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import Layout from '@/components/Layout'
import Image from 'next/image'
import PhotoModal from '@/components/PhotoModal'
import ReactionSummary from '@/components/ReactionSummary'
import ReactionButton from '@/components/ReactionButton'
import { 
  loadMultiplePhotoReactions, 
  addHeartReaction,
  type PhotoReactions 
} from '@/lib/reactions'
import { useClickHandler } from '@/hooks/useClickHandler'

interface Photo {
  id: string
  filename: string
  original_filename: string
  caption: string | null
  file_path: string
  uploaded_at: string
  uploaded_by: string
}

interface PhotoWithUrl extends Photo {
  imageUrl: string | null
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [email, setEmail] = useState('')
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const [photoReactions, setPhotoReactions] = useState<PhotoReactions>({})
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
      (event, session) => {
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
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Error loading photos:', error)
      } else if (data) {
        // Get signed URLs for all photos
        const photosWithUrls = await Promise.all(
          data.map(async (photo) => ({
            ...photo,
            imageUrl: await getImageUrl(photo.file_path)
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
    
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
    })
    
    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('Check your email for the login link!')
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

  // Component for individual gallery photo with reactions
  const GalleryPhoto = ({ photo, index }: { photo: PhotoWithUrl; index: number }) => {
    const photoReactionsList = photoReactions[photo.id] || []

    // Handle single vs double click/tap
    const clickHandler = useClickHandler({
      onSingleClick: () => {
        openModal(index)
      },
      onDoubleClick: ({ clientX, clientY }) => {
        handleGalleryHeartReaction(photo.id)
        showHeartAnimation(clientX, clientY)
      },
      delay: 300,
      touchMoveThreshold: 10 // 10px movement threshold for distinguishing tap vs scroll
    })

    return (
      <div key={photo.id} className="bg-white rounded-lg shadow overflow-hidden">
        <div 
          className="aspect-square relative cursor-pointer hover:opacity-90 transition-opacity duration-200 select-none"
          onClick={clickHandler.onClick}
          onTouchStart={clickHandler.onTouchStart}
          onTouchMove={clickHandler.onTouchMove}
          onTouchEnd={clickHandler.onTouchEnd}
        >
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
          <div className="p-3">
            <p className="text-sm text-gray-700">{photo.caption}</p>
          </div>
        )}
        <div className="px-3 pb-3">
          <p className="text-xs text-gray-500">
            {new Date(photo.uploaded_at).toLocaleDateString()}
          </p>
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
          <h1 className="text-4xl font-bold mb-8">Family Photos</h1>
          <p className="text-gray-600 mb-8">
            A private space for our family to share precious moments
          </p>
          <div className="mb-4">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => {
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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Our Family Photos</h1>
          <p className="text-gray-600">{photos.length} photos</p>
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
  </>
  )
}