import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { InvitationRequest, InvitationResponse } from '@/types/family'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is an active family member
    const { data: currentMember, error: memberError } = await supabase
      .from('family_members')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (memberError || !currentMember) {
      return NextResponse.json({ error: 'Access denied. You must be an active family member to invite others.' }, { status: 403 })
    }

    // Parse request body
    const body: InvitationRequest = await request.json()
    const { email, full_name } = body

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Check if email is already invited or is a member
    const { data: existingMember, error: checkError } = await supabase
      .from('family_members')
      .select('id, email, status')
      .eq('email', email.toLowerCase())
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error checking existing member:', checkError)
      return NextResponse.json({ error: 'Failed to check existing member' }, { status: 500 })
    }

    if (existingMember) {
      if (existingMember.status === 'invited') {
        return NextResponse.json({ error: 'This email has already been invited' }, { status: 400 })
      } else if (existingMember.status === 'active') {
        return NextResponse.json({ error: 'This email is already an active family member' }, { status: 400 })
      }
    }

    // Create invitation - use a temporary UUID for user_id since it's required
    // This will be updated when the user actually accepts the invitation
    const tempUserId = crypto.randomUUID()
    
    const { data: invitation, error: inviteError } = await supabase
      .from('family_members')
      .insert({
        email: email.toLowerCase(),
        status: 'invited',
        invited_by: user.id,
        invited_at: new Date().toISOString(),
        user_id: tempUserId // Temporary UUID, will be updated when they accept
      })
      .select('*')
      .single()

    if (inviteError) {
      console.error('Error creating invitation:', inviteError)
      console.error('Full error details:', JSON.stringify(inviteError, null, 2))
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
    }

    if (!invitation) {
      console.error('No invitation data returned from insert')
      return NextResponse.json({ error: 'Failed to create invitation - no data returned' }, { status: 500 })
    }

    // Create a profile entry for the invited user if full_name is provided
    if (full_name) {
      // We'll store this in a separate table or handle it when they accept
      // For now, we'll just note that this would be where we'd store additional invite info
    }

    const response: InvitationResponse = {
      id: invitation.id,
      email: invitation.email,
      invitation_token: invitation.invitation_token,
      invited_at: invitation.invited_at,
      status: invitation.status as 'invited'
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error in invite API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}