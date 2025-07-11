import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is an active family member
    console.log('Checking family member status for user:', user.id, user.email)
    
    const { data: currentMember, error: memberError } = await supabase
      .from('family_members')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    console.log('Family member check result:', { currentMember, memberError })

    if (memberError || !currentMember) {
      console.log('Access denied for user:', user.id, 'Error:', memberError)
      return NextResponse.json({ error: 'Access denied. You must be an active family member.' }, { status: 403 })
    }

    // Get all family members and pending invitations with profiles
    const { data: familyMembers, error: familyError } = await supabase
      .from('family_members_with_profiles')
      .select('*')
      .order('invited_at', { ascending: false })

    if (familyError) {
      console.error('Error fetching family members:', familyError)
      return NextResponse.json({ error: 'Failed to fetch family members' }, { status: 500 })
    }

    // Calculate stats
    const stats = {
      total_members: familyMembers?.length || 0,
      active_members: familyMembers?.filter(m => m.status === 'active').length || 0,
      pending_invitations: familyMembers?.filter(m => m.status === 'invited').length || 0
    }

    return NextResponse.json({ 
      family_members: familyMembers || [],
      stats 
    })
  } catch (error) {
    console.error('Error in family API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}