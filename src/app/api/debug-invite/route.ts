import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Test a simple insert without auth requirements
    console.log('Testing family_members table insertion...')
    
    const testEmail = `test-${Date.now()}@example.com`
    
    const { data: result, error } = await supabase
      .from('family_members')
      .insert({
        email: testEmail,
        status: 'invited',
        invited_by: null,
        invited_at: new Date().toISOString(),
        user_id: null
      })
      .select('*')
      .single()

    if (error) {
      console.error('Debug insert error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: error,
        testEmail 
      })
    }

    console.log('Debug insert success:', result)
    return NextResponse.json({ 
      success: true, 
      data: result,
      testEmail 
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Unexpected error',
      details: error 
    })
  }
}