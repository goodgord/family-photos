import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      return NextResponse.json({ error: 'Access denied. You must be an active family member.' }, { status: 403 })
    }

    // Get the family member to be removed
    const { data: memberToRemove, error: fetchError } = await supabase
      .from('family_members')
      .select('id, email, status, user_id')
      .eq('id', params.id)
      .single()

    if (fetchError) {
      console.error('Error fetching member to remove:', fetchError)
      return NextResponse.json({ error: 'Family member not found' }, { status: 404 })
    }

    // Prevent users from removing themselves
    if (memberToRemove.user_id === user.id) {
      return NextResponse.json({ error: 'You cannot remove yourself from the family' }, { status: 400 })
    }

    // Remove the family member
    const { error: deleteError } = await supabase
      .from('family_members')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('Error removing family member:', deleteError)
      return NextResponse.json({ error: 'Failed to remove family member' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: memberToRemove.status === 'invited' 
        ? 'Invitation cancelled successfully' 
        : 'Family member removed successfully' 
    })
  } catch (error) {
    console.error('Error in family member removal API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}