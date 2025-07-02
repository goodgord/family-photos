'use client'

import { useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'

interface AddCommentProps {
  photoId: string
  onAddComment: (photoId: string, commentText: string) => Promise<void>
  disabled?: boolean
}

export default function AddComment({ photoId, onAddComment, disabled = false }: AddCommentProps) {
  const [commentText, setCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!commentText.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onAddComment(photoId, commentText.trim())
      setCommentText('')
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-1">
          <MessageCircle size={16} className="text-gray-400" />
        </div>
        <div className="flex-1">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
            className="w-full p-3 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            rows={3}
            disabled={disabled || isSubmitting}
            maxLength={1000}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">
              {commentText.length}/1000 characters
            </span>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-400 hidden sm:inline">
                Cmd/Ctrl + Enter to post
              </span>
              <button
                type="submit"
                disabled={!commentText.trim() || isSubmitting || disabled}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={14} />
                {isSubmitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}