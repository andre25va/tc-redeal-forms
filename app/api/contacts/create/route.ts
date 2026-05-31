import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const { first_name, last_name, email, phone, contact_type } = await req.json();

    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'first_name and last_name are required' }, { status: 400 });
    }

    const supabase = serviceClient();

    // Check for existing contact with same name to avoid duplicates
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone')
      .ilike('first_name', first_name.trim())
      .ilike('last_name', last_name.trim())
      .maybeSingle();

    if (existing) {
      // Return existing contact instead of creating a duplicate
      return NextResponse.json({ contact: existing, created: false });
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        contact_type: contact_type || 'client',
      })
      .select()
      .single();

    if (error) {
      console.error('contacts create error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contact: data, created: true });
  } catch (err: any) {
    console.error('contacts create exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
