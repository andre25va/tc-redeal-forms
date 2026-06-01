import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const { address, city, state, zipCode, mlsNumber } = await req.json();

    if (!address && !mlsNumber) {
      return NextResponse.json({ error: 'address or mlsNumber is required' }, { status: 400 });
    }

    const supabase = anonClient();

    const { data, error } = await (supabase as any).functions.invoke('fetch-mls-number', {
      body: { address, city, state, zipCode, mlsNumber },
    });

    if (error) {
      console.error('fetch-mls-number edge fn error:', error);
      return NextResponse.json({ found: false, error: error.message }, { status: 200 });
    }

    return NextResponse.json(data ?? { found: false });
  } catch (err: any) {
    console.error('MLS fetch error:', err);
    return NextResponse.json({ found: false, error: err.message }, { status: 200 });
  }
}
