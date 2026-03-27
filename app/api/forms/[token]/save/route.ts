import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { form_data } = await req.json()
    const supabase = createServiceClient()

    const { data: invitation } = await supabase
      .from('form_invitations')
      .select('id, status')
      .eq('token', params.token)
      .single()

    if (!invitation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (invitation.status === 'submitted') return NextResponse.json({ error: 'Already submitted' }, { status: 410 })

    // Upsert submission
    const { data: existing } = await supabase
      .from('form_submissions')
      .select('id')
      .eq('invitation_id', invitation.id)
      .single()

    if (existing) {
      await supabase
        .from('form_submissions')
        .update({ form_data, last_saved_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('form_submissions')
        .insert({ invitation_id: invitation.id, form_data })
    }

    // Update invitation status to in_progress
    await supabase
      .from('form_invitations')
      .update({ status: 'in_progress' })
      .eq('id', invitation.id)
      .eq('status', 'pending')

    return NextResponse.json({ saved: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
