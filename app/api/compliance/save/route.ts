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

interface AddendaMapRow {
  raw_text: string;
  display_name: string;
  form_slug: string | null;
  mls_board: string | null;
  notes: string | null;
}

interface CheckedAdendum {
  raw_text: string;
  display_name: string;
  form_slug: string | null;
  mls_board: string | null;
}

async function computeCheckedAddenda(
  supabase: any,
  results: any[],
  board: string
): Promise<CheckedAdendum[]> {
  try {
    // Flatten all checked checkboxes across all pages
    const allChecked: string[] = [];
    for (const page of results) {
      for (const cb of (page.checkboxes ?? [])) {
        if (cb.checked && cb.label) {
          allChecked.push(cb.label as string);
        }
      }
    }
    if (allChecked.length === 0) return [];

    // Fetch addenda map - board-specific + universal (null board)
    const { data: addendaMap, error } = await supabase
      .from('addenda_display_map')
      .select('raw_text, display_name, form_slug, mls_board, notes');

    if (error || !addendaMap) return [];

    const matched: CheckedAdendum[] = [];
    const seenDisplayNames = new Set<string>();

    for (const checkedLabel of allChecked) {
      const lower = checkedLabel.toLowerCase().trim();
      const match = (addendaMap as AddendaMapRow[]).find(row => {
        const rowLower = row.raw_text.toLowerCase().trim();
        // Board filter: match if row.mls_board is null (universal) OR matches current board
        const boardMatch = !row.mls_board || !board || row.mls_board === board;
        if (!boardMatch) return false;
        // Text match: substring in either direction
        return lower.includes(rowLower) || rowLower.includes(lower);
      });
      if (match && !seenDisplayNames.has(match.display_name)) {
        seenDisplayNames.add(match.display_name);
        matched.push({
          raw_text: checkedLabel,
          display_name: match.display_name,
          form_slug: match.form_slug,
          mls_board: match.mls_board,
        });
      }
    }
    return matched;
  } catch (e) {
    console.warn('[compliance/save] computeCheckedAddenda error:', e);
    return [];
  }
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

    // Compute checked addenda from page results
    const checkedAddenda = Array.isArray(results)
      ? await computeCheckedAddenda(supabase, results, board ?? '')
      : [];

    const { data, error } = await supabase.from('compliance_checks').insert({
      deal_id:          dealId    || null,
      document_id:      documentId || null,
      check_type:       'vision',
      source:           source || (dealId ? 'myredeal' : 'standalone'),
      form_type:        board    || null,
      filename:         filename || null,
      passed_count:     passedCount    ?? 0,
      violation_count:  violationCount ?? 0,
      warning_count:    warningCount   ?? 0,
      results:          results ?? {},
      reference_id:     referenceId,
      checked_addenda:  checkedAddenda,
    }).select('id').single();

    if (error) {
      console.error('[compliance/save] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      referenceId,
      checkId: data?.id,
      checkedAddenda,
    });
  } catch (err: any) {
    console.error('[compliance/save] error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
