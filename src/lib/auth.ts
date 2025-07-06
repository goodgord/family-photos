import { createClient } from '@/lib/supabase/client'

export interface AuthError {
  message: string
  code?: string
}

export async function signInWithMagicLink(email: string): Promise<{ success: boolean; error?: AuthError }> {
  try {
    const supabase = createClient()
    
    // Check if email is invited before sending magic link
    const { data: invitation, error: inviteError } = await supabase.rpc('is_email_invited', {
      user_email: email.toLowerCase()
    })
    
    if (inviteError) {
      console.error('Error checking invitation:', inviteError)
      return {
        success: false,
        error: { message: 'Unable to verify invitation status. Please try again.' }
      }
    }
    
    if (!invitation) {
      return {
        success: false,
        error: { 
          message: 'This email address has not been invited to join the family. Please ask an existing family member to invite you.',
          code: 'NOT_INVITED'
        }
      }
    }
    
    // Send magic link
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })
    
    if (authError) {
      console.error('Error sending magic link:', authError)
      return {
        success: false,
        error: { 
          message: authError.message || 'Failed to send magic link. Please try again.',
          code: authError.message
        }
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Unexpected error in signInWithMagicLink:', error)
    return {
      success: false,
      error: { message: 'An unexpected error occurred. Please try again.' }
    }
  }
}

export async function checkUserFamilyStatus(userId: string): Promise<{
  isFamilyMember: boolean
  status: string | null
  error?: string
}> {
  try {
    const supabase = createClient()
    
    const { data: member, error } = await supabase
      .from('family_members')
      .select('status')
      .eq('user_id', userId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return { isFamilyMember: false, status: null }
      }
      console.error('Error checking family status:', error)
      return { 
        isFamilyMember: false, 
        status: null, 
        error: 'Unable to verify family member status' 
      }
    }
    
    return { 
      isFamilyMember: member.status === 'active', 
      status: member.status 
    }
  } catch (error) {
    console.error('Unexpected error in checkUserFamilyStatus:', error)
    return { 
      isFamilyMember: false, 
      status: null, 
      error: 'An unexpected error occurred' 
    }
  }
}