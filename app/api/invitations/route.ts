import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      seller_email, seller_name, property_address,
      realtor_email, realtor_name, broker_email, broker_name,
      created_by
    } = body

    if (!seller_email) {
      return NextResponse.json({ error: 'seller_email is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('form_invitations')
      .insert({
        seller_email,
        seller_name,
        property_address,
        realtor_email,
        realtor_name,
        broker_email,
        broker_name,
        created_by: created_by || 'tc@myredeal.com',
        form_slug: 'seller-disclosure',
      })
      .select()
      .single()

    if (error) throw error

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const formUrl = `${appUrl}/forms/${data.token}`

    return NextResponse.json({
      invitation: data,
      formUrl
    })
  } catch (error: unknown) {
    console.error('Create invitation error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('form_invitations')
      .select(`
        *,
        form_submissions (id, submitted_at, pdf_url, last_saved_at)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ invitations: data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
