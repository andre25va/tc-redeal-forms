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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dealId, documentId, passedCount, violationCount, warningCount, results } = body;

    if (!dealId) {
      return NextResponse.json({ error: 'dealId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { error } = await supabase.from('compliance_checks').insert({
      deal_id:         dealId,
      document_id:     documentId || null,
      check_type:      'vision',
      source:          'myredeal',
      passed_count:    passedCount    ?? 0,
      violation_count: violationCount ?? 0,
      warning_count:   warningCount   ?? 0,
      results:         results ?? {},
    });

    if (error) {
      console.error('[compliance/save] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[compliance/save] error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
