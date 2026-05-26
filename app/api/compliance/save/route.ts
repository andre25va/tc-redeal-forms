import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function generateReferenceId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `CHK-${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      dealId,
      documentId,
      source,
      board,
      filename,
      passedCount,
      violationCount,
      warningCount,
      results,
    } = body;

    const referenceId = generateReferenceId();
    const supabase = createServiceClient();

    const { data, error } = await supabase.from('compliance_checks').insert({
      deal_id:         dealId    || null,
      document_id:     documentId || null,
      check_type:      'vision',
      source:          source || (dealId ? 'myredeal' : 'standalone'),
      form_type:       board    || null,
      filename:        filename || null,
      passed_count:    passedCount    ?? 0,
      violation_count: violationCount ?? 0,
      warning_count:   warningCount   ?? 0,
      results:         results ?? {},
      reference_id:    referenceId,
    }).select('id').single();

    if (error) {
      console.error('[compliance/save] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, referenceId, checkId: data?.id });
  } catch (err: any) {
    console.error('[compliance/save] error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
