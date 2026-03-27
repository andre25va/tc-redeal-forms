import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json()
    if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a real estate data assistant. Given a US property address, return what you know about it from your training data.

Return ONLY a valid JSON object — no explanation, no markdown, just raw JSON:
{
  "yearBuilt": number or null,
  "propertyType": "Single Family" | "Condo" | "Townhouse" | "Multi-Family" | "Other" | null,
  "hoa": "yes" | "no" | "unknown",
  "confidence": "high" | "medium" | "low"
}

If you don't know the property at all, still return the JSON with nulls and confidence "low".
Never return anything except the JSON object.`,
          },
          {
            role: 'user',
            content: `Property address: ${address}`,
          },
        ],
        max_tokens: 150,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
    }

    const data = await response.json()
    const raw = (data.choices?.[0]?.message?.content || '{}').trim()

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()

    try {
      const parsed = JSON.parse(cleaned)
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ error: 'Parse error', raw }, { status: 500 })
    }
  } catch (e) {
    console.error('Property lookup error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
