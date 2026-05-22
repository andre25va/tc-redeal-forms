import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { blanks, formName } = await req.json()
    if (!blanks?.length) return NextResponse.json({ suggestions: [] })

    // Dedupe very close blanks (within 5pt of each other on same page)
    const deduped: any[] = []
    for (const b of blanks) {
      const dup = deduped.find(
        (d: any) => d.page === b.page && Math.abs(d.x - b.x) < 5 && Math.abs(d.y - b.y) < 5
      )
      if (!dup) deduped.push(b)
    }

    const capped = deduped.slice(0, 120) // GPT context limit

    const prompt = `You are mapping fillable form fields for a real estate document: "${formName}".

Below are blank fields found in the PDF (each with nearest label text and page/position).
For each blank, provide a descriptive snake_case field_key and a field_type (text, checkbox, date, number, signature).

Rules:
- field_key must be unique, descriptive, snake_case, max 60 chars
- Prefer common real estate field names: buyer_name, seller_name, property_address, purchase_price, closing_date, etc.
- If label is blank or unclear, infer from surrounding context or position
- For dollar amounts use field_type "number"
- For dates use field_type "date"  
- For checkboxes/yes-no questions use field_type "checkbox"
- For signature lines use field_type "signature"
- Otherwise use field_type "text"
- Number fields sequentially if duplicates exist (e.g. buyer_name_1, buyer_name_2)

Blanks:
${capped.map((b: any, i: number) =>
  `${i + 1}. label="${b.label}" page=${b.page} x=${Math.round(b.x)} y=${Math.round(b.y)} w=${Math.round(b.width)}`
).join('\n')}

Respond ONLY with valid JSON: {"fields": [{"index": 1, "field_key": "buyer_name", "field_type": "text"}, ...]}`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'GPT error: ' + err }, { status: 500 })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '{}'
    let parsed: any = {}
    try { parsed = JSON.parse(content) } catch { parsed = {} }

    const gptFields: any[] = Array.isArray(parsed) ? parsed : (parsed.fields || parsed.suggestions || [])

    // Dedupe field_keys from GPT
    const usedKeys = new Set<string>()
    const suggestions = gptFields.map((s: any) => {
      const blank = capped[s.index - 1]
      if (!blank) return null
      let key = (s.field_key || 'field').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 60)
      if (usedKeys.has(key)) {
        let i = 2; while (usedKeys.has(`${key}_${i}`)) i++; key = `${key}_${i}`
      }
      usedKeys.add(key)
      return {
        field_key: key,
        field_type: s.field_type || 'text',
        page_num: blank.page,
        x: Math.round(blank.x * 100) / 100,
        y: Math.round(blank.y * 100) / 100,
        width: Math.round(Math.max(blank.width, 60) * 100) / 100,
        height: Math.round(Math.max(blank.height, 12) * 100) / 100,
        label: blank.label,
      }
    }).filter(Boolean)

    return NextResponse.json({ suggestions, total: blanks.length, sent: capped.length })
  } catch (e: any) {
    console.error('field-suggest error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
