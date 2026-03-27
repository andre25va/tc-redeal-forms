import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const supabase = createServiceClient()

    const { data: invitation, error } = await supabase
      .from('form_invitations')
      .select('*')
      .eq('token', params.token)
      .single()

    if (error || !invitation) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    if (invitation.status === 'submitted') {
      return NextResponse.json({ error: 'Form already submitted', status: 'submitted' }, { status: 410 })
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Form link has expired' }, { status: 410 })
    }

    // Get existing submission if any
    const { data: submission } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('invitation_id', invitation.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      invitation,
      savedData: submission?.form_data || {},
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
