'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import Layout from '@/components/Layout'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'

// Helper function to read EXIF orientation
const getOrientation = (file: File, callback: (orientation: number) => void) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const view = new DataView(e.target?.result as ArrayBuffer)
    if (view.getUint16(0, false) !== 0xFFD8) {
      callback(1) // Not a JPEG
      return
    }
    
    const length = view.byteLength
    let offset = 2
    
    while (offset < length) {
      if (view.getUint16(offset + 2, false) <= 8) {
        callback(1)
        return
      }
      const marker = view.getUint16(offset, false)
      offset += 2
      if (marker === 0xFFE1) {
        const little = view.getUint16(offset + 8, false) === 0x4949
        offset += view.getUint16(offset, false)
        if (view.getUint32(offset + 4, little) !== 0x2A) {
          callback(1)
          return
        }
        const firstIFDOffset = view.getUint32(offset + 8, little)
        if (firstIFDOffset < 0x00000008) {
          callback(1)
          return
        }
        offset += firstIFDOffset
        const tags = view.getUint16(offset, little)
        offset += 2
        for (let i = 0; i < tags; i++) {
          if (view.getUint16(offset + (i * 12), little) === 0x0112) {
            callback(view.getUint16(offset + (i * 12) + 8, little))
            return
          }
        }
      } else if ((marker & 0xFF00) !== 0xFF00) {
        break
      } else {
        offset += view.getUint16(offset, false)
      }
    }
    callback(1) // Default orientation
  }
  reader.readAsArrayBuffer(file)
}

// Helper function to get rotated dimensions
const getRotatedDimensions = (width: number, height: number, orientation: number) => {
  if (orientation >= 5 && orientation <= 8) {
    return { width: height, height: width }
  }
  return { width, height }
}

export default function UploadPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const [caption, setCaption] = useState('')
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
      
      if (!user) {
        router.push('/')
      }
    }
    getUser()
  }, [supabase, router])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files)
    setUploadProgress('')
  }

  const correctImageOrientation = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      
      img.onload = () => {
        // Get EXIF orientation
        getOrientation(file, (orientation) => {
          console.log('Detected orientation:', orientation)
          const { width, height } = getRotatedDimensions(img.width, img.height, orientation)
          
          canvas.width = width
          canvas.height = height
          
          // Apply rotation based on orientation
          switch (orientation) {
            case 2:
              ctx.transform(-1, 0, 0, 1, width, 0)
              break
            case 3:
              ctx.transform(-1, 0, 0, -1, width, height)
              break
            case 4:
              ctx.transform(1, 0, 0, -1, 0, height)
              break
            case 5:
              ctx.transform(0, 1, 1, 0, 0, 0)
              break
            case 6:
              ctx.transform(0, 1, -1, 0, height, 0)
              break
            case 7:
              ctx.transform(0, -1, -1, 0, height, width)
              break
            case 8:
              ctx.transform(0, -1, 1, 0, 0, width)
              break
            default:
              // No rotation needed
              break
          }
          
          ctx.drawImage(img, 0, 0)
          
          canvas.toBlob((blob) => {
            if (blob) {
              const correctedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              })
              resolve(correctedFile)
            } else {
              resolve(file) // Fallback to original
            }
          }, 'image/jpeg', 0.9)
        })
      }
      
      img.src = URL.createObjectURL(file)
    })
  }

  const compressImage = async (file: File): Promise<File> => {
    try {
      // First, let's correct the orientation manually
      const correctedFile = await correctImageOrientation(file)
      
      // Then compress the corrected image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg' as const,
        quality: 0.8,
        // Don't preserve EXIF since we've already corrected orientation
        preserveExif: false
      }

      const compressedFile = await imageCompression(correctedFile, options)
      console.log(`Processed ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
      return compressedFile
    } catch (error) {
      console.error('Error processing image:', error)
      throw error
    }
  }

  const uploadPhotos = async () => {
    if (!selectedFiles || !user) return

    setUploading(true)
    setUploadProgress('Starting upload...')

    try {
      const totalFiles = selectedFiles.length

      for (let i = 0; i < totalFiles; i++) {
        const file = selectedFiles[i]
        setUploadProgress(`Processing ${i + 1}/${totalFiles}: ${file.name}`)

        // Compress the image
        setUploadProgress(`Compressing ${i + 1}/${totalFiles}: ${file.name}`)
        const compressedFile = await compressImage(file)

        // Generate unique filename
        const fileExt = 'jpg'
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        // Upload compressed file to Supabase Storage
        setUploadProgress(`Uploading ${i + 1}/${totalFiles}: ${file.name}`)
        console.log('Attempting to upload to path:', filePath)
        console.log('File size:', compressedFile.size)
        console.log('User ID:', user.id)

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('family-photos')
          .upload(filePath, compressedFile)

        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          throw new Error(`Storage upload failed: ${uploadError.message}`)
        }

        console.log('Upload successful:', uploadData)

        // Save photo metadata to database
        setUploadProgress(`Saving ${i + 1}/${totalFiles}: ${file.name}`)
        
        const photoData = {
          filename: fileName,
          original_filename: file.name,
          caption: caption || null,
          file_path: filePath,
          file_size: compressedFile.size,
          uploaded_by: user.id
        }
        
        console.log('Inserting photo data:', photoData)

        const { data: dbData, error: dbError } = await supabase
          .from('photos')
          .insert(photoData)

        if (dbError) {
          console.error('Database insert error:', dbError)
          throw new Error(`Database insert failed: ${dbError.message}`)
        }

        console.log('Database insert successful:', dbData)
      }

      setUploadProgress('Upload complete!')
      setTimeout(() => {
        setSelectedFiles(null)
        setCaption('')
        setUploadProgress('')
        router.push('/')
      }, 1000)
      
    } catch (error) {
      console.error('Detailed error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setUploadProgress(`Error: ${errorMessage}`)
      setTimeout(() => setUploadProgress(''), 5000)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <Layout user={user}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Upload Photos</h1>
        
        <div className="bg-white shadow rounded-lg p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Photos
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-500">
              Photos will be automatically rotated and compressed to under 1MB for faster sharing
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Caption (optional)
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={uploading}
              rows={3}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              placeholder="Add a caption for your photos..."
            />
          </div>

          {selectedFiles && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">
                {selectedFiles.length} file(s) selected
              </p>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {Array.from(selectedFiles).map((file, index) => (
                  <div key={index} className="flex justify-between text-xs text-gray-500">
                    <span className="truncate mr-2">{file.name}</span>
                    <span className="whitespace-nowrap">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadProgress && (
            <div className="mb-6 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">{uploadProgress}</p>
            </div>
          )}

          <div className="flex space-x-4">
            <button
              onClick={uploadPhotos}
              disabled={!selectedFiles || uploading}
              className="flex-1 bg-blue-500 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              {uploading ? 'Processing...' : 'Upload & Compress Photos'}
            </button>
            
            <button
              onClick={() => router.push('/')}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}