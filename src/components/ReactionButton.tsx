'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Smile } from 'lucide-react'
import { COMMON_EMOJIS, addOrUpdateReaction, getUserReaction, type Reaction } from '@/lib/reactions'

interface ReactionButtonProps {
  photoId: string
  onReactionChange?: (reaction: Reaction | null) => void
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export default function ReactionButton({ 
  photoId, 
  onReactionChange, 
  size = 'md',
  showText = true 
}: ReactionButtonProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [userReaction, setUserReaction] = useState<Reaction | null>(null)
  const [loading, setLoading] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const loadUserReaction = useCallback(async () => {
    try {
      const reaction = await getUserReaction(photoId)
      setUserReaction(reaction)
    } catch (error) {
      console.error('Error loading user reaction:', error)
    }
  }, [photoId])

  // Load user's current reaction when component mounts
  useEffect(() => {
    loadUserReaction()
  }, [loadUserReaction])

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPicker])

  const handleEmojiClick = async (emoji: string) => {
    if (loading) return

    setLoading(true)
    try {
      let newReaction: Reaction | null = null
      
      try {
        newReaction = await addOrUpdateReaction(photoId, emoji)
        setUserReaction(newReaction)
      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'REACTION_REMOVED') {
          // User clicked same emoji, reaction was removed
          setUserReaction(null)
          newReaction = null
        } else {
          throw error
        }
      }

      setShowPicker(false)
      onReactionChange?.(newReaction)
    } catch (error) {
      console.error('Error handling reaction:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePicker = () => {
    setShowPicker(!showPicker)
  }

  const sizeClasses = {
    sm: 'p-1 text-sm',
    md: 'p-2 text-base',
    lg: 'p-3 text-lg'
  }

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={togglePicker}
        disabled={loading}
        className={`
          inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 
          rounded-full transition-colors duration-200 disabled:opacity-50
          ${sizeClasses[size]}
          ${userReaction ? 'bg-blue-100 hover:bg-blue-200 border border-blue-300' : ''}
        `}
        title={userReaction ? `You reacted with ${userReaction.emoji}` : 'Add reaction'}
      >
        {userReaction ? (
          <span className="text-lg">{userReaction.emoji}</span>
        ) : (
          <Smile size={iconSizes[size]} className="text-gray-600" />
        )}
        {showText && (
          <span className="text-xs text-gray-600 hidden sm:inline">
            {userReaction ? 'Change' : 'React'}
          </span>
        )}
      </button>

      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50 min-w-max"
        >
          <div className="flex gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                disabled={loading}
                className={`
                  p-2 rounded-lg hover:bg-gray-100 transition-colors duration-150
                  text-lg disabled:opacity-50 relative
                  ${userReaction?.emoji === emoji ? 'bg-blue-100 ring-2 ring-blue-300' : ''}
                `}
                title={`React with ${emoji}`}
              >
                {emoji}
                {userReaction?.emoji === emoji && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
                )}
              </button>
            ))}
          </div>
          
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200"></div>
        </div>
      )}
    </div>
  )
}