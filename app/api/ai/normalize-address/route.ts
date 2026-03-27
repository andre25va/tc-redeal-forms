import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json()
    if (!address) return NextResponse.json({ candidates: [] })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a US address normalizer. The user gives you a partial or informal property address. ' +
              'Return a JSON array of the most likely full formatted US addresses (up to 3 candidates). ' +
              'Format each as: "123 Street Name Ave, City, ST 12345" — capitalize properly, include state abbreviation. ' +
              'If there is only one obvious match, return a single-item array. ' +
              'If the city name exists in multiple states (e.g. Burbank CA and Burbank IL), include both. ' +
              'If zip code is unknown, omit it. ' +
              'Return ONLY a raw JSON array — no markdown, no explanation, no code fences. ' +
              'Example: ["7923 Mansfield Ave, Burbank, CA 91505", "7923 Mansfield Ave, Burbank, IL 60459"]',
          },
          { role: 'user', content: address },
        ],
        max_tokens: 150,
        temperature: 0,
      }),
    })

    const data = await response.json()
    const raw = (data.choices?.[0]?.message?.content as string)?.trim() || '[]'

    let candidates: string[] = []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        candidates = parsed.filter((s): s is string => typeof s === 'string' && s.length > 0)
      }
    } catch {
      // If GPT returned plain text instead of JSON, treat it as single candidate
      candidates = raw ? [raw] : [address]
    }

    if (candidates.length === 0) candidates = [address]

    return NextResponse.json({ candidates })
  } catch {
    return NextResponse.json({ candidates: [] }, { status: 500 })
  }
}
