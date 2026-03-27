import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const maxDuration = 60

/**
 * HEAD /api/forms/seller-disclosure/upload-original
 * Returns 200 if original.pdf exists in storage, 404 otherwise.
 */
export async function HEAD() {
  const supabase = createServiceClient()
  const { data } = await supabase.storage
    .from('form-templates')
    .list('seller-disclosure', { search: 'original.pdf' })

  const exists = Array.isArray(data) && data.some(f => f.name === 'original.pdf')
  return new NextResponse(null, { status: exists ? 200 : 404 })
}

/**
 * POST /api/forms/seller-disclosure/upload-original
 * Accepts multipart/form-data with field "pdf" containing the blank PDF.
 * Stores it as form-templates/seller-disclosure/original.pdf
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient()

    const formData = await req.formData()
    const file = formData.get('pdf') as File | null

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())

    // Ensure the form-templates bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.name === 'form-templates')
    if (!bucketExists) {
      await supabase.storage.createBucket('form-templates', { public: false })
    }

    const { error } = await supabase.storage
      .from('form-templates')
      .upload('seller-disclosure/original.pdf', bytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
