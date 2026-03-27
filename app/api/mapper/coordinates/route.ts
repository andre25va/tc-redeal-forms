import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const formSlug = searchParams.get('form_slug') || 'seller-disclosure'

  const { data, error } = await supabase
    .from('field_coordinates')
    .select('*')
    .eq('form_slug', formSlug)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ coordinates: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { form_slug, field_key, page_num, x, y, width, height, font_size } = body

  const { data, error } = await supabase
    .from('field_coordinates')
    .upsert({
      form_slug: form_slug || 'seller-disclosure',
      field_key,
      page_num: page_num || 1,
      x,
      y,
      width,
      height,
      font_size,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'form_slug,field_key' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ coordinate: data })
}
