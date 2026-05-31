import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { address, city, state, zipCode } = await req.json();

    if (!address) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error } = await (supabase as any).functions.invoke('fetch-mls-number', {
      body: { address, city, state, zipCode },
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
