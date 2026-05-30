import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dealId, formSlug, status, submittedData } = body;

    if (!formSlug || !status || !submittedData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Resolve contract_form_id from slug
    const { data: form, error: formErr } = await supabase
      .from('contract_forms')
      .select('id')
      .eq('form_slug', formSlug)
      .single();

    if (formErr || !form) {
      return NextResponse.json(
        { error: `Contract form not found: ${formSlug}` },
        { status: 404 }
      );
    }

    // Upsert: if dealId + formSlug already has a draft, update it
    let submissionId: string | null = null;

    if (dealId) {
      const { data: existing } = await supabase
        .from('contract_submissions')
        .select('id')
        .eq('deal_id', dealId)
        .eq('contract_form_id', form.id)
        .in('status', ['draft'])
        .maybeSingle();

      if (existing?.id) {
        // Update existing draft
        const { data: updated, error: upErr } = await supabase
          .from('contract_submissions')
          .update({
            submitted_data: submittedData,
            status,
            updated_at: new Date().toISOString(),
            ...(status === 'submitted' ? { sent_at: new Date().toISOString() } : {}),
          })
          .eq('id', existing.id)
          .select('id')
          .single();

        if (upErr) throw upErr;
        submissionId = updated?.id ?? null;
      }
    }

    if (!submissionId) {
      // Create new submission
      const { data: created, error: createErr } = await supabase
        .from('contract_submissions')
        .insert({
          deal_id: dealId || null,
          contract_form_id: form.id,
          submitted_data: submittedData,
          status,
          ...(status === 'submitted' ? { sent_at: new Date().toISOString() } : {}),
        })
        .select('id')
        .single();

      if (createErr) throw createErr;
      submissionId = created?.id ?? null;
    }

    return NextResponse.json({ id: submissionId, status });
  } catch (err: any) {
    console.error('[contracts/save]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
