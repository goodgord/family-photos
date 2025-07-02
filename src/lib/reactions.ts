import { createClient } from '@/lib/supabase/client'

export interface Reaction {
  id: string
  photo_id: string
  user_id: string
  emoji: string
  created_at: string
  updated_at: string
  user_email?: string
}

export interface ReactionSummary {
  emoji: string
  count: number
  users: Array<{
    user_id: string
    user_email: string
  }>
}

export interface PhotoReactions {
  [photoId: string]: ReactionSummary[]
}

// Common emoji reactions
export const COMMON_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍', '👎']

const supabase = createClient()

/**
 * Load all reactions for a specific photo
 */
export async function loadPhotoReactions(photoId: string): Promise<Reaction[]> {
  try {
    const { data, error } = await supabase
      .from('reactions')
      .select('*')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading reactions:', error)
      throw error
    }

    return data || []
  } catch (error) {
    console.error('Error in loadPhotoReactions:', error)
    throw error
  }
}

/**
 * Load reactions for multiple photos at once
 */
export async function loadMultiplePhotoReactions(photoIds: string[]): Promise<PhotoReactions> {
  try {
    if (photoIds.length === 0) return {}

    const { data, error } = await supabase
      .from('reactions')
      .select('*')
      .in('photo_id', photoIds)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading multiple reactions:', error)
      throw error
    }

    // Group reactions by photo_id and then by emoji
    const photoReactions: PhotoReactions = {}
    
    if (data) {
      for (const reaction of data) {
        if (!photoReactions[reaction.photo_id]) {
          photoReactions[reaction.photo_id] = []
        }
        
        // Find existing emoji summary or create new one
        let emojiSummary = photoReactions[reaction.photo_id].find(
          summary => summary.emoji === reaction.emoji
        )
        
        if (!emojiSummary) {
          emojiSummary = {
            emoji: reaction.emoji,
            count: 0,
            users: []
          }
          photoReactions[reaction.photo_id].push(emojiSummary)
        }
        
        emojiSummary.count++
        emojiSummary.users.push({
          user_id: reaction.user_id,
          user_email: reaction.user_email || 'Family member'
        })
      }
    }

    return photoReactions
  } catch (error) {
    console.error('Error in loadMultiplePhotoReactions:', error)
    throw error
  }
}

/**
 * Add or update a reaction to a photo
 */
export async function addOrUpdateReaction(photoId: string, emoji: string): Promise<Reaction> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated to react')
    }

    // First check if user already has a reaction for this photo
    const { data: existingReaction } = await supabase
      .from('reactions')
      .select('*')
      .eq('photo_id', photoId)
      .eq('user_id', user.id)
      .single()

    let result

    if (existingReaction) {
      // If same emoji, remove the reaction
      if (existingReaction.emoji === emoji) {
        await removeReaction(photoId)
        throw new Error('REACTION_REMOVED') // Special error to indicate removal
      } else {
        // Update existing reaction with new emoji
        const { data, error } = await supabase
          .from('reactions')
          .update({ 
            emoji,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingReaction.id)
          .select()
          .single()

        if (error) throw error
        result = data
      }
    } else {
      // Create new reaction
      const { data, error } = await supabase
        .from('reactions')
        .insert({
          photo_id: photoId,
          user_id: user.id,
          emoji
        })
        .select()
        .single()

      if (error) throw error
      result = data
    }

    return {
      ...result,
      user_email: user.email || 'Unknown user'
    }
  } catch (error) {
    console.error('Error in addOrUpdateReaction:', error)
    throw error
  }
}

/**
 * Remove a user's reaction from a photo
 */
export async function removeReaction(photoId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated to remove reactions')
    }

    const { error } = await supabase
      .from('reactions')
      .delete()
      .eq('photo_id', photoId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error removing reaction:', error)
      throw error
    }
  } catch (error) {
    console.error('Error in removeReaction:', error)
    throw error
  }
}

/**
 * Get user's current reaction for a photo
 */
export async function getUserReaction(photoId: string): Promise<Reaction | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return null
    }

    const { data, error } = await supabase
      .from('reactions')
      .select('*')
      .eq('photo_id', photoId)
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error getting user reaction:', error)
      throw error
    }

    return data || null
  } catch (error) {
    console.error('Error in getUserReaction:', error)
    return null
  }
}

/**
 * Get reaction summary for a photo (grouped by emoji with counts)
 */
export async function getReactionSummary(photoId: string): Promise<ReactionSummary[]> {
  try {
    const reactions = await loadPhotoReactions(photoId)
    
    // Group reactions by emoji
    const emojiMap: { [emoji: string]: ReactionSummary } = {}
    
    for (const reaction of reactions) {
      if (!emojiMap[reaction.emoji]) {
        emojiMap[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: []
        }
      }
      
      emojiMap[reaction.emoji].count++
      emojiMap[reaction.emoji].users.push({
        user_id: reaction.user_id,
        user_email: reaction.user_email || 'Family member'
      })
    }
    
    // Convert to array and sort by count (descending)
    return Object.values(emojiMap).sort((a, b) => b.count - a.count)
  } catch (error) {
    console.error('Error in getReactionSummary:', error)
    throw error
  }
}

/**
 * Quick method to add heart reaction (for double-tap)
 */
export async function addHeartReaction(photoId: string): Promise<Reaction> {
  return addOrUpdateReaction(photoId, '❤️')
}