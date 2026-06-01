import { NextRequest, NextResponse } from 'next/server';

// v4: call the Supabase edge function directly via fetch (not supabase.functions.invoke)
// This matches the proven pattern used by GuidedDealWizard — plain fetch with auth header.

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ found: false, error: 'Supabase env vars not configured' }, { status: 500 });
    }

    const edgeFnUrl = `${supabaseUrl}/functions/v1/fetch-mls-number`;

    console.log(`[mls/fetch v4] Calling edge function: ${edgeFnUrl}`, JSON.stringify(body));

    const res = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[mls/fetch v4] Edge function returned ${res.status}: ${errText.substring(0, 300)}`);
      return NextResponse.json({ found: false, error: `Edge function error ${res.status}` });
    }

    const data = await res.json();
    console.log(`[mls/fetch v4] Edge function result: found=${data.found}`);
    return NextResponse.json(data);

  } catch (err: any) {
    console.error('[mls/fetch v4] Error:', err.message);
    return NextResponse.json({ found: false, error: err.message || 'Server error' });
  }
}
