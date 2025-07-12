import { createClient } from '@/lib/supabase/client'
import { type Profile } from '@/lib/supabase/profiles'

export interface Comment {
  id: string
  photo_id: string
  user_id: string
  comment_text: string
  created_at: string
  updated_at: string
  user_email?: string
  user_profile?: Profile | null
}

const supabase = createClient()

/**
 * Load all comments for a specific photo with user email information
 */
export async function loadComments(photoId: string): Promise<Comment[]> {
  try {
    // First get all comments
    const { data: commentsData, error } = await supabase
      .from('comments')
      .select(`
        id,
        photo_id,
        user_id,
        comment_text,
        created_at,
        updated_at
      `)
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading comments:', error)
      throw error
    }

    if (!commentsData || commentsData.length === 0) {
      return []
    }

    // Get unique user IDs
    const userIds = [...new Set(commentsData.map(comment => comment.user_id))]
    
    // Get profiles for all comment authors
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)
    
    // Create a map of profiles by ID
    const profileMap = new Map(profiles?.map(profile => [profile.id, profile]) || [])
    
    // Get current user for email fallback
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    // Map comments with profile and email information
    const commentsWithProfiles = commentsData.map(comment => {
      const profile = profileMap.get(comment.user_id)
      let userEmail = 'Unknown user'
      
      if (profile) {
        userEmail = profile.email || 'Family member'
      } else if (currentUser && currentUser.id === comment.user_id) {
        userEmail = currentUser.email || 'Unknown user'
      }
      
      return {
        ...comment,
        user_email: userEmail,
        user_profile: profile || null
      }
    })

    return commentsWithProfiles
  } catch (error) {
    console.error('Error in loadComments:', error)
    throw error
  }
}

/**
 * Add a new comment to a photo
 */
export async function addComment(photoId: string, commentText: string): Promise<Comment> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated to comment')
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        photo_id: photoId,
        user_id: user.id,
        comment_text: commentText
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding comment:', error)
      throw error
    }

    return {
      ...data,
      user_email: user.email || 'Unknown user'
    }
  } catch (error) {
    console.error('Error in addComment:', error)
    throw error
  }
}

/**
 * Update an existing comment (only by the comment owner)
 */
export async function updateComment(commentId: string, newText: string): Promise<Comment> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated to edit comments')
    }

    const { data, error } = await supabase
      .from('comments')
      .update({ 
        comment_text: newText,
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .eq('user_id', user.id) // Ensure user can only edit their own comments
      .select()
      .single()

    if (error) {
      console.error('Error updating comment:', error)
      throw error
    }

    return {
      ...data,
      user_email: user.email || 'Unknown user'
    }
  } catch (error) {
    console.error('Error in updateComment:', error)
    throw error
  }
}

/**
 * Delete a comment (only by the comment owner)
 */
export async function deleteComment(commentId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated to delete comments')
    }

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id) // Ensure user can only delete their own comments

    if (error) {
      console.error('Error deleting comment:', error)
      throw error
    }
  } catch (error) {
    console.error('Error in deleteComment:', error)
    throw error
  }
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}