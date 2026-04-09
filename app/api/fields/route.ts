import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const form_slug = searchParams.get('form_slug')
  if (!form_slug) return NextResponse.json({ error: 'Missing form_slug' }, { status: 400 })

  const { data, error } = await supabase
    .from('field_coordinates')
    .select('field_key, field_type, page_num, x, y, width, height')
    .eq('form_slug', form_slug)
    .order('page_num')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fields: data ?? [] })
}
