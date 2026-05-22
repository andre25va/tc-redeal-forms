// /app/api/admin/forms/[slug]/profile/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/admin/forms/[slug]/profile
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  const { data, error } = await supabase
    .from('form_profiles')
    .select('*')
    .eq('form_slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

// POST /api/admin/forms/[slug]/profile
// Body: FormProfile fields (upserts)
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  const body = await req.json();

  const payload = {
    form_slug: slug,
    mls_board: body.mls_board ?? null,
    state: body.state ?? null,
    document_name: body.document_name ?? null,
    document_number: body.document_number ?? null,
    page_count: body.page_count ? Number(body.page_count) : null,
    buyer_count: Number(body.buyer_count ?? 2),
    seller_count: Number(body.seller_count ?? 2),
    initials_pages: body.initials_pages ?? [],
    has_broker_fields: Boolean(body.has_broker_fields),
    notes: body.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('form_profiles')
    .upsert(payload, { onConflict: 'form_slug' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
