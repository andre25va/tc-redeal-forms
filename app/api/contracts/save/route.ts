import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { dealId, agentContactId, formSlug, status, contractUID, submittedData } = await req.json();

    if (!formSlug) {
      return NextResponse.json({ error: 'formSlug is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Look up the contract_form id from slug
    const { data: formRow, error: formErr } = await (supabase as any)
      .from('contract_forms')
      .select('id')
      .eq('form_slug', formSlug)
      .single();

    if (formErr || !formRow) {
      return NextResponse.json({ error: 'Contract form not found for slug: ' + formSlug }, { status: 404 });
    }

    // If contractUID already exists in DB, update — otherwise insert
    const existingUID = submittedData?.contract_uid;
    let result;

    if (existingUID) {
      // Try to find existing draft with this UID
      const { data: existing } = await (supabase as any)
        .from('contract_submissions')
        .select('id')
        .eq('submitted_data->>contract_uid', existingUID)
        .maybeSingle();

      if (existing?.id) {
        const { data, error } = await (supabase as any)
          .from('contract_submissions')
          .update({
            status,
            submitted_data: submittedData,
            ...(agentContactId ? { agent_contact_id: agentContactId } : {}),
            buyer_name: [submittedData?.buyer_name_1, submittedData?.buyer_name_2].filter(Boolean).join(' & ') || null,
            seller_name: [submittedData?.seller_name_1, submittedData?.seller_name_2].filter(Boolean).join(' & ') || null,
            updated_at: new Date().toISOString(),
            ...(status === 'submitted' ? { sent_at: new Date().toISOString() } : {}),
          })
          .eq('id', existing.id)
          .select('id')
          .single();
        if (error) throw error;
        result = data;
      }
    }

    if (!result) {
      // Insert new
      const { data, error } = await (supabase as any)
        .from('contract_submissions')
        .insert({
          deal_id: dealId || null,
          agent_contact_id: agentContactId || null,
          contract_form_id: formRow.id,
          status,
          submitted_data: submittedData,
          ...(status === 'submitted' ? { sent_at: new Date().toISOString() } : {}),
        })
        .select('id')
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ id: result.id, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
