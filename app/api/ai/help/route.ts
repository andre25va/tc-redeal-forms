import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { fieldLabel, sectionTitle, language } = await req.json()

    if (!fieldLabel) {
      return NextResponse.json({ error: 'Missing fieldLabel' }, { status: 400 })
    }

    const lang = language === 'es' ? 'Spanish' : 'English'

    const systemPrompt = `You are a helpful real estate assistant explaining fields on a Missouri Seller's Disclosure and Condition of Property form. Sellers are filling this out to disclose the condition of their home to potential buyers. Keep explanations concise (2-3 sentences), friendly, and in plain language. Avoid legal jargon. Always respond in ${lang}.`

    const userPrompt = `Explain what this form field means and what the seller should think about when answering it:

Field: "${fieldLabel}"
Section: "${sectionTitle}"

What does it mean, and what should I consider?`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 180,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('OpenAI error:', err)
      return NextResponse.json({ error: 'OpenAI request failed' }, { status: 500 })
    }

    const data = await response.json()
    const explanation = data.choices?.[0]?.message?.content?.trim() || ''

    return NextResponse.json({ explanation })
  } catch (e) {
    console.error('AI help error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
