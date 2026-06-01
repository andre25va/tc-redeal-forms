import { NextRequest, NextResponse } from 'next/server';

const VPS_BASE = 'https://mls.srv1462857.hstgr.cloud';

export async function POST(req: NextRequest) {
  try {
    const { address, city, state, zipCode, mlsNumber } = await req.json();

    if (!address && !mlsNumber) {
      return NextResponse.json({ error: 'address or mlsNumber is required' }, { status: 400 });
    }

    let propertyAddress = address;

    // Step 1: If MLS# provided, resolve to address via VPS
    if (mlsNumber && !address) {
      const resolveRes = await fetch(`${VPS_BASE}/resolve-mls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mlsNumber }),
        signal: AbortSignal.timeout(60000),
      });
      const resolveData = await resolveRes.json();
      if (!resolveData.address) {
        return NextResponse.json({ found: false, error: 'MLS# could not be resolved to an address' });
      }
      propertyAddress = resolveData.address;
    }

    // Step 2: Fetch property data from VPS
    const encodedAddress = encodeURIComponent(propertyAddress);
    const propRes = await fetch(`${VPS_BASE}/property?address=${encodedAddress}`, {
      signal: AbortSignal.timeout(60000),
    });
    const propData = await propRes.json();

    if (!propData || propData.error) {
      return NextResponse.json({ found: false, error: propData?.error ?? 'Property not found' });
    }

    return NextResponse.json({ found: true, ...propData });
  } catch (err: any) {
    console.error('MLS fetch error:', err);
    return NextResponse.json({ found: false, error: err.message }, { status: 200 });
  }
}
