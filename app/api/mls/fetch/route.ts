import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 90; // Vercel Pro: up to 300s

const VPS_BASE = 'https://mls.srv1462857.hstgr.cloud';

export async function POST(req: NextRequest) {
  try {
    const { mlsNumber, address: rawAddress } = await req.json();

    let address = rawAddress?.trim();

    // If MLS# provided, resolve it to an address via OpenAI web_search_preview
    if (!address && mlsNumber) {
      const openAiKey = process.env.OPENAI_API_KEY;
      if (!openAiKey) {
        return NextResponse.json({ found: false, error: 'OPENAI_API_KEY not configured' });
      }

      const prompt = `Search Zillow, Realtor.com, Redfin, or any real estate website for MLS listing number ${mlsNumber} in the Kansas City metro area (Heartland MLS, Missouri and Kansas).
Find a page that shows "MLS #${mlsNumber}" or "MLS: ${mlsNumber}" or "MLS${mlsNumber}".
Return ONLY a valid JSON object with NO explanation:
{"address": "123 Main St", "city": "Kansas City", "state": "MO", "zip": "64112"}
If not found, return: null`;

      const aiRes = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          tools: [{ type: 'web_search_preview' }],
          input: prompt,
        }),
        signal: AbortSignal.timeout(80000),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error(`[mls/fetch] OpenAI error ${aiRes.status}: ${errText.substring(0, 200)}`);
        return NextResponse.json({ found: false, error: `OpenAI ${aiRes.status}` });
      }

      const aiData = await aiRes.json();
      const text = (aiData.output || [])
        .filter((i: any) => i.type === 'message')
        .flatMap((i: any) => i.content || [])
        .filter((c: any) => c.type === 'output_text')
        .map((c: any) => c.text)
        .join('')
        .trim();

      console.log(`[mls/fetch] OpenAI raw: ${text.substring(0, 300)}`);

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        return NextResponse.json({ found: false, error: 'MLS# could not be resolved to an address' });
      }

      let parsed: any;
      try { parsed = JSON.parse(jsonMatch[0]); } catch {
        return NextResponse.json({ found: false, error: 'Could not parse address from OpenAI response' });
      }

      if (!parsed?.address) {
        return NextResponse.json({ found: false, error: 'MLS# could not be resolved to an address' });
      }

      address = `${parsed.address}, ${parsed.city || ''}, ${parsed.state || ''} ${parsed.zip || ''}`.trim().replace(/,\s*,/g, ',');
    }

    if (!address) {
      return NextResponse.json({ found: false, error: 'address or mlsNumber required' });
    }

    // Call VPS for full property data
    const vpsRes = await fetch(`${VPS_BASE}/property?address=${encodeURIComponent(address)}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!vpsRes.ok) {
      return NextResponse.json({ found: false, error: `VPS error ${vpsRes.status}` });
    }

    const data = await vpsRes.json();

    if (!data || data.error) {
      return NextResponse.json({ found: false, error: data?.error || 'Property not found' });
    }

    return NextResponse.json({
      found: true,
      address: data.address || address,
      city: data.city || '',
      state: data.state || '',
      zip: data.zip || '',
      county: data.county || '',
      price: data.price || data.listPrice || '',
      beds: data.beds || data.bedrooms || '',
      baths: data.baths || data.bathrooms || '',
      sqft: data.sqft || data.squareFeet || '',
      yearBuilt: data.yearBuilt || '',
      subdivision: data.subdivision || '',
      status: data.status || '',
      legalDescription: data.legalDescription || data.legal_description || '',
    });
  } catch (err: any) {
    console.error('[mls/fetch] Error:', err.message);
    return NextResponse.json({ found: false, error: err.message || 'Server error' });
  }
}
