'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import CommentsList from './CommentsList'
import AddComment from './AddComment'
import { 
  loadComments, 
  addComment, 
  updateComment, 
  deleteComment, 
  getCurrentUser,
  type Comment 
} from '@/lib/comments'

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

interface PhotoModalProps {
  photos: PhotoWithUrl[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
}

export default function PhotoModal({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNext,
  onPrevious
}: PhotoModalProps) {
  const currentPhoto = photos[currentIndex]
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Comments state
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null)

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return

    switch (event.key) {
      case 'Escape':
        onClose()
        break
      case 'ArrowLeft':
        event.preventDefault()
        onPrevious()
        break
      case 'ArrowRight':
        event.preventDefault()
        onNext()
        break
    }
  }, [isOpen, onClose, onNext, onPrevious])

  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }, [onClose])

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && currentIndex < photos.length - 1) {
      onNext()
    } else if (isRightSwipe && currentIndex > 0) {
      onPrevious()
    }
  }

  // Load comments for current photo
  const loadPhotoComments = useCallback(async (photoId: string) => {
    setCommentsLoading(true)
    try {
      const photoComments = await loadComments(photoId)
      setComments(photoComments)
    } catch (error) {
      console.error('Error loading comments:', error)
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  // Handle adding a new comment
  const handleAddComment = useCallback(async (photoId: string, commentText: string) => {
    try {
      const newComment = await addComment(photoId, commentText)
      setComments(prev => [...prev, newComment])
    } catch (error) {
      console.error('Error adding comment:', error)
      throw error
    }
  }, [])

  // Handle editing a comment
  const handleEditComment = useCallback(async (commentId: string, newText: string) => {
    try {
      const updatedComment = await updateComment(commentId, newText)
      setComments(prev => 
        prev.map(comment => 
          comment.id === commentId ? updatedComment : comment
        )
      )
    } catch (error) {
      console.error('Error editing comment:', error)
      throw error
    }
  }, [])

  // Handle deleting a comment
  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await deleteComment(commentId)
      setComments(prev => prev.filter(comment => comment.id !== commentId))
    } catch (error) {
      console.error('Error deleting comment:', error)
      throw error
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleKeyDown])

  // Load current user when modal opens
  useEffect(() => {
    if (isOpen) {
      getCurrentUser().then(setCurrentUser)
    }
  }, [isOpen])

  // Load comments when photo changes
  useEffect(() => {
    if (isOpen && currentPhoto) {
      loadPhotoComments(currentPhoto.id)
    }
  }, [isOpen, currentPhoto, loadPhotoComments])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (!isOpen || !currentPhoto) return null

  const modalContent = (
    <div 
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm transition-opacity duration-300"
      onClick={handleBackdropClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 text-white hover:text-gray-300 transition-colors duration-200 bg-black bg-opacity-50 rounded-full"
        aria-label="Close modal"
      >
        <X size={24} />
      </button>

      {/* Navigation Buttons */}
      {photos.length > 1 && (
        <>
          <button
            onClick={onPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 text-white hover:text-gray-300 transition-colors duration-200 bg-black bg-opacity-50 rounded-full disabled:opacity-50"
            disabled={currentIndex === 0}
            aria-label="Previous photo"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 text-white hover:text-gray-300 transition-colors duration-200 bg-black bg-opacity-50 rounded-full disabled:opacity-50"
            disabled={currentIndex === photos.length - 1}
            aria-label="Next photo"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Main Content */}
      <div className="w-full h-full flex flex-col lg:flex-row items-start justify-center p-4 md:p-8 gap-6">
        {/* Image Container */}
        <div className="relative flex-1 w-full lg:w-2/3 flex items-center justify-center min-h-0">
          {currentPhoto.imageUrl ? (
            <div className="relative max-w-full max-h-full">
              <Image
                src={currentPhoto.imageUrl}
                alt={currentPhoto.original_filename}
                width={1200}
                height={800}
                className="max-w-full max-h-full object-contain transition-transform duration-300"
                priority
              />
            </div>
          ) : (
            <div className="w-64 h-64 bg-gray-800 flex items-center justify-center rounded-lg">
              <p className="text-white">Loading...</p>
            </div>
          )}
        </div>

        {/* Comments and Info Section */}
        <div className="w-full lg:w-1/3 lg:max-w-md flex flex-col max-h-full">
          {/* Photo Information */}
          <div className="text-white space-y-2 mb-6">
            <h2 className="text-lg md:text-xl font-semibold">
              {currentPhoto.original_filename}
            </h2>
            {currentPhoto.caption && (
              <p className="text-sm md:text-base text-gray-300">
                {currentPhoto.caption}
              </p>
            )}
            <p className="text-xs md:text-sm text-gray-400">
              Uploaded on {formatDate(currentPhoto.uploaded_at)}
            </p>
            {photos.length > 1 && (
              <p className="text-xs text-gray-500">
                {currentIndex + 1} of {photos.length}
              </p>
            )}
          </div>

          {/* Comments Section */}
          <div className="flex-1 bg-white rounded-lg p-4 overflow-hidden flex flex-col min-h-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Comments ({comments.length})
            </h3>
            
            {/* Comments List */}
            <div className="flex-1 overflow-y-auto mb-4 min-h-0">
              <CommentsList
                comments={comments}
                currentUserId={currentUser?.id || null}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
                loading={commentsLoading}
              />
            </div>

            {/* Add Comment Form */}
            {currentUser && (
              <div className="border-t border-gray-200 pt-4">
                <AddComment
                  photoId={currentPhoto.id}
                  onAddComment={handleAddComment}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Touch/Swipe Indicators for Mobile */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 md:hidden">
        {photos.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
              index === currentIndex ? 'bg-white' : 'bg-gray-500'
            }`}
          />
        ))}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}