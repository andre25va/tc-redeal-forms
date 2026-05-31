import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  if (q.length < 2) {
    return NextResponse.json({ contacts: [] });
  }

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, contact_type')
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .in('contact_type', ['client', 'buyer', 'seller'])
    .order('first_name')
    .limit(10);

  if (error) {
    console.error('contacts search error:', error);
    return NextResponse.json({ contacts: [] });
  }

  return NextResponse.json({ contacts: data || [] });
}
