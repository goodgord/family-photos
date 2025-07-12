'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Edit2, Trash2, Check, X, User as UserIcon } from 'lucide-react'
import { formatTimeAgo } from '@/lib/utils'
import { getDisplayName, getAvatarUrl, type Profile } from '@/lib/supabase/profiles'

interface Comment {
  id: string
  photo_id: string
  user_id: string
  comment_text: string
  created_at: string
  updated_at: string
  user_email?: string
  user_profile?: Profile | null
}

interface CommentsListProps {
  comments: Comment[]
  currentUserId: string | null
  onEditComment: (commentId: string, newText: string) => Promise<void>
  onDeleteComment: (commentId: string) => Promise<void>
  loading: boolean
}

export default function CommentsList({
  comments,
  currentUserId,
  onEditComment,
  onDeleteComment,
  loading
}: CommentsListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)

  const handleEditStart = (comment: Comment) => {
    setEditingId(comment.id)
    setEditText(comment.comment_text)
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditText('')
  }

  const handleEditSave = async (commentId: string) => {
    if (!editText.trim()) return

    setEditLoading(true)
    try {
      await onEditComment(commentId, editText.trim())
      setEditingId(null)
      setEditText('')
    } catch (error) {
      console.error('Error editing comment:', error)
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    setDeleteLoading(commentId)
    try {
      await onDeleteComment(commentId)
    } catch (error) {
      console.error('Error deleting comment:', error)
    } finally {
      setDeleteLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-2/3 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-4">
        No comments yet. Be the first to comment!
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div key={comment.id} className="border-b border-gray-200 pb-3 last:border-b-0">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {getAvatarUrl(comment.user_profile || null) ? (
                  <Image
                    src={getAvatarUrl(comment.user_profile || null)!}
                    alt="Commenter"
                    width={24}
                    height={24}
                    className="rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <UserIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {getDisplayName(comment.user_profile || null)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimeAgo(comment.created_at)}
                    {comment.updated_at !== comment.created_at && ' (edited)'}
                  </span>
                </div>
              </div>
              
              {editingId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    placeholder="Edit your comment..."
                    disabled={editLoading}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditSave(comment.id)}
                      disabled={editLoading || !editText.trim()}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check size={12} />
                      {editLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleEditCancel}
                      disabled={editLoading}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                    >
                      <X size={12} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                  {comment.comment_text}
                </p>
              )}
            </div>

            {/* Action buttons for comment owner */}
            {currentUserId === comment.user_id && editingId !== comment.id && (
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => handleEditStart(comment)}
                  className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                  title="Edit comment"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(comment.id)}
                  disabled={deleteLoading === comment.id}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  title="Delete comment"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}