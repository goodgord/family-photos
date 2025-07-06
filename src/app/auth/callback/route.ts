import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Check if this is a new user accepting an invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('family_members')
        .select('id, status')
        .eq('email', data.user.email)
        .eq('status', 'invited')
        .single()
      
      if (!inviteError && invitation) {
        // Update invitation to active
        await supabase
          .from('family_members')
          .update({
            user_id: data.user.id,
            status: 'active',
            accepted_at: new Date().toISOString()
          })
          .eq('id', invitation.id)
        
        // Create profile
        await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.user_metadata?.full_name || null,
            avatar_url: data.user.user_metadata?.avatar_url || null,
            created_at: new Date().toISOString()
          })
      }
      
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}