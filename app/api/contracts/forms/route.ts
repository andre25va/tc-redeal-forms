import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await (supabase as any)
      .from('contract_forms')
      .select('id, form_name, mls_board, state_code, form_slug, form_version')
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ forms: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
