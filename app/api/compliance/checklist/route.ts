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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const checkId = searchParams.get('checkId');
    const referenceId = searchParams.get('referenceId');

    if (!checkId && !referenceId) {
      return NextResponse.json({ error: 'checkId or referenceId required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    let query = supabase
      .from('compliance_checks')
      .select('id, reference_id, checked_addenda, board:form_type, filename, created_at');

    if (checkId) {
      query = query.eq('id', checkId);
    } else {
      query = query.eq('reference_id', referenceId!);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      checkId: data.id,
      referenceId: data.reference_id,
      board: data.board,
      filename: data.filename,
      createdAt: data.created_at,
      checkedAddenda: data.checked_addenda ?? [],
    });
  } catch (err: any) {
    console.error('[compliance/checklist] error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
