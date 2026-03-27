import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json()
    if (!address) return NextResponse.json({ normalized: address })

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
              'Return ONLY the full formatted address as a single line string — no extra text, no explanation. ' +
              'Format: "123 Street Name Ave, City, ST 12345". ' +
              'If zip code is unknown omit it. If state is obvious from city include it. ' +
              'Capitalize properly. Never return more than one address.',
          },
          { role: 'user', content: address },
        ],
        max_tokens: 80,
        temperature: 0,
      }),
    })

    const data = await response.json()
    const normalized = (data.choices?.[0]?.message?.content as string)?.trim() || address
    return NextResponse.json({ normalized })
  } catch {
    return NextResponse.json({ normalized: '' }, { status: 500 })
  }
}
