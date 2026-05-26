import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const {
      checkId,
      referenceId,
      board,
      formName,
      violationMessage,
      violationPage,
      violationType,
      verdict,
    } = await req.json();

    if (!violationMessage || !verdict) {
      return NextResponse.json({ error: 'violationMessage and verdict are required' }, { status: 400 });
    }

    if (verdict !== 'correct' && verdict !== 'false_positive') {
      return NextResponse.json({ error: 'verdict must be correct or false_positive' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { error } = await supabase.from('compliance_feedback').insert({
      check_id: checkId ?? null,
      reference_id: referenceId ?? null,
      board: board ?? null,
      form_name: formName ?? null,
      violation_message: violationMessage,
      violation_page: violationPage ?? null,
      violation_type: violationType ?? null,
      verdict,
    });

    if (error) {
      console.error('[compliance/feedback] insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[compliance/feedback] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
