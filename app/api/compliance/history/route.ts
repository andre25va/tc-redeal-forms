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
    const source    = searchParams.get('source');
    const checkType = searchParams.get('check_type');
    const days      = searchParams.get('days');
    const status    = searchParams.get('status');

    const supabase = createServiceClient();

    let query = supabase
      .from('compliance_checks')
      .select(`
        id,
        deal_id,
        document_id,
        check_type,
        source,
        form_type,
        filename,
        state,
        total_rules_checked,
        passed_count,
        warning_count,
        violation_count,
        results,
        run_at,
        created_at
      `)
      .order('run_at', { ascending: false })
      .limit(200);

    if (source)    query = query.eq('source', source);
    if (checkType) query = query.eq('check_type', checkType);
    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      query = query.gte('run_at', since.toISOString());
    }
    if (status === 'passed')     query = query.eq('violation_count', 0).eq('warning_count', 0);
    if (status === 'violations') query = query.gt('violation_count', 0);
    if (status === 'warnings')   query = query.gt('warning_count', 0).eq('violation_count', 0);

    const { data, error } = await query;
    if (error) throw error;

    // Enrich linked checks with deal property_address
    const dealIds = [...new Set((data ?? []).filter(r => r.deal_id).map(r => r.deal_id as string))];
    let dealMap: Record<string, string> = {};

    if (dealIds.length > 0) {
      const { data: deals } = await supabase
        .from('deals')
        .select('id, property_address')
        .in('id', dealIds);
      if (deals) dealMap = Object.fromEntries(deals.map(d => [d.id, d.property_address]));
    }

    const enriched = (data ?? []).map(row => ({
      ...row,
      property_address: row.deal_id ? (dealMap[row.deal_id] ?? null) : null,
    }));

    return NextResponse.json({ checks: enriched });
  } catch (err: any) {
    console.error('[compliance/history]', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
