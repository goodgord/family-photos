import { createClient } from '@/lib/supabase/client'

export interface Comment {
  id: string
  photo_id: string
  user_id: string
  comment_text: string
  created_at: string
  updated_at: string
  user_email?: string
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
    
    // Create a map to store user emails (for now using user_id as fallback)
    const userEmailMap: { [key: string]: string } = {}
    
    // For each user ID, try to get email from current session or use fallback
    for (const userId of userIds) {
      try {
        // Check if this is the current user
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser && currentUser.id === userId) {
          userEmailMap[userId] = currentUser.email || 'Unknown user'
        } else {
          // For other users, we'll use a fallback since we can't access their emails directly
          userEmailMap[userId] = 'Family member'
        }
      } catch {
        userEmailMap[userId] = 'Unknown user'
      }
    }

    // Map comments with user emails
    const commentsWithEmails = commentsData.map(comment => ({
      ...comment,
      user_email: userEmailMap[comment.user_id] || 'Unknown user'
    }))

    return commentsWithEmails
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