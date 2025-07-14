'use client'

import { useState } from 'react'
import { createAlbum } from '@/lib/supabase/albums'
import { X, FolderPlus, Loader2 } from 'lucide-react'

interface CreateAlbumModalProps {
  isOpen: boolean
  onClose: () => void
  selectedPhotoIds?: string[]
  onSuccess?: (albumId: string) => void
}

export default function CreateAlbumModal({ 
  isOpen, 
  onClose, 
  selectedPhotoIds = [], 
  onSuccess 
}: CreateAlbumModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Album name is required')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      const album = await createAlbum({
        name: name.trim(),
        description: description.trim() || undefined,
        photoIds: selectedPhotoIds.length > 0 ? selectedPhotoIds : undefined
      })

      // Reset form
      setName('')
      setDescription('')
      onClose()
      
      if (onSuccess) {
        onSuccess(album.id)
      }
    } catch (error) {
      console.error('Error creating album:', error)
      setError(error instanceof Error ? error.message : 'Failed to create album')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    if (!isCreating) {
      setName('')
      setDescription('')
      setError('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <FolderPlus className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Create Album</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {selectedPhotoIds.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                This album will include {selectedPhotoIds.length} selected photo{selectedPhotoIds.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="albumName" className="block text-sm font-medium text-gray-700 mb-2">
              Album Name *
            </label>
            <input
              type="text"
              id="albumName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              placeholder="Enter album name..."
              maxLength={100}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="albumDescription" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="albumDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              placeholder="Optional description..."
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center space-x-2"
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isCreating ? 'Creating...' : 'Create Album'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}