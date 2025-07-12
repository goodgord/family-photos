import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
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

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('family_members')
      .insert({
        email: email.toLowerCase(),
        status: 'invited',
        invited_by: user.id,
        invited_at: new Date().toISOString(),
        user_id: null // Will be set when they accept the invitation
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

    // Send invitation email
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        
        const { data: emailResult, error: emailError } = await resend.emails.send({
          from: 'Family Photos <noreply@family-photos.com>',
          to: [email.toLowerCase()],
          subject: 'You\'re invited to join our family photos!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #333; text-align: center;">You're Invited!</h1>
              <p>Hi${full_name ? ` ${full_name}` : ''},</p>
              <p>You've been invited to join our private family photo sharing app. You can now sign in to view and share photos with the family.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://family-photos-three.vercel.app'}" 
                   style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Sign In to Family Photos
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                Simply click the link above and enter your email address (${email.toLowerCase()}) to get started. 
                We'll send you a magic link to sign in securely.
              </p>
            </div>
          `
        })

        if (emailError) {
          console.error('Error sending invitation email:', emailError)
          // Don't fail the whole invitation if email fails
        } else {
          console.log('Invitation email sent successfully:', emailResult)
        }
      } catch (emailError) {
        console.error('Error with email service:', emailError)
        // Don't fail the whole invitation if email fails
      }
    } else {
      console.warn('RESEND_API_KEY not configured - invitation email not sent')
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