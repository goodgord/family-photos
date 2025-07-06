import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Get the current user from the session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Check if user has an invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('family_members')
      .select('id, email, status, invitation_token')
      .eq('email', user.email)
      .eq('status', 'invited')
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ 
        error: 'No invitation found for this email address' 
      }, { status: 403 })
    }

    // Update the invitation to mark as accepted
    const { error: updateError } = await supabase
      .from('family_members')
      .update({
        user_id: user.id,
        status: 'active',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitation.id)

    if (updateError) {
      console.error('Error updating invitation:', updateError)
      return NextResponse.json({ 
        error: 'Failed to activate family member status' 
      }, { status: 500 })
    }

    // Create or update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        created_at: new Date().toISOString()
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Don't fail the request for profile errors
    }

    return NextResponse.json({ 
      message: 'Welcome to the family! Your account has been activated.',
      status: 'active'
    })
  } catch (error) {
    console.error('Error in signup API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}