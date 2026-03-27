import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

// Sections that are primarily yes/no scan lists — batch them
const BATCH_SCAN_SECTIONS = [
  'land', 'infestation', 'structural', 'hazardous',
  'other_matters', 'additions', 'taxes_hoa', 'inspections'
]

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      sectionKey,
      sectionTitle,
      fields,
      formValues,
      language,
      sellerName,
      propertyAddress,
    } = await req.json()

    if (!fields || !sectionKey) {
      return NextResponse.json({ error: 'Missing fields or sectionKey' }, { status: 400 })
    }

    const lang = language === 'es' ? 'Spanish' : 'English'
    const isBatchSection = BATCH_SCAN_SECTIONS.includes(sectionKey)
    const isFixtures = sectionKey === 'fixtures'
    const isFirstMessage = !messages || messages.length === 0

    type FieldDef = { key: string; type: string; label: string; choices?: string[] }
    const allFields = fields as FieldDef[]

    // Separate yes/no choice fields from detail/text fields
    const choiceFields = allFields.filter(f =>
      f.type === 'choice' && (f.choices?.includes('yes') || f.choices?.includes('no'))
    )
    const detailFields = allFields.filter(f =>
      f.type !== 'choice' || (!f.choices?.includes('yes') && !f.choices?.includes('no'))
    )

    const fieldList = allFields
      .filter(f => f.type !== 'signature')
      .map(f => {
        let desc = `- ${f.key} (${f.type}): "${f.label}"`
        if (f.choices?.length) desc += ` [options: ${f.choices.join(' / ')}]`
        return desc
      })
      .join('\n')

    const answered = allFields
      .filter(f => formValues?.[f.key] !== undefined && formValues[f.key] !== '' && formValues[f.key] !== null)
      .map(f => `  ${f.key}: ${JSON.stringify(formValues[f.key])}`)
      .join('\n')

    // Build the batch scan list for yes/no sections
    const batchList = isBatchSection && choiceFields.length > 0
      ? choiceFields
          .filter(f => !formValues?.[f.key]) // skip already answered
          .map((f, i) => `  ${i + 1}. ${f.label.replace(/^\d+[a-z]?\s*[–-]\s*/i, '')} [key: ${f.key}]`)
          .join('\n')
      : ''

    const batchOptions = isBatchSection && choiceFields.length > 0
      ? choiceFields
          .filter(f => !formValues?.[f.key])
          .map(f => f.label.replace(/^\d+[a-z]?\s*[–-]\s*/i, '').replace(/\s*\([^)]+\)\s*$/, '').trim())
          .slice(0, 10) // cap chips at 10
      : []

    const fixtureInstructions = isFixtures ? `
SPECIAL INSTRUCTIONS FOR FIXTURES SECTION:
This section is a long list of items. Present them in groups of 6-8 at a time.
For each group ask what happens to each: Stays with the house (OS), Seller taking it (EX), Not applicable (NA), or Not sure (NS).
Group logically: kitchen appliances, outdoor items, entertainment, etc.
Always include OPTIONS: ["Stays (OS)", "Taking it (EX)", "N/A", "Not sure"]
` : ''

    const batchInstructions = isBatchSection && isFirstMessage && batchList ? `
SPECIAL INSTRUCTIONS FOR THIS SECTION — BATCH SCAN MODE:
This section has ${choiceFields.length} yes/no questions. DO NOT ask them one by one.

INSTEAD, on your FIRST message:
1. Say: "For [section name], tap anything that applies — or say None if none do."
2. Show the full list as a numbered checklist (clean short labels, no form codes)
3. Include OPTIONS tag with each item as a short chip label PLUS "None of these" at the end

When the user taps an item or says which ones apply:
- Ask ONLY the follow-up detail questions for the items they flagged (dates, descriptions, etc.)
- Auto-set all un-flagged yes/no fields to "no" in your UPDATES tag
- Be concise — just get the details you need for flagged items

When user says "None of these" or "None":
- Set ALL yes/no fields in this section to "no" in UPDATES
- Set COMPLETE to true immediately

The goal: one scan question → user taps what applies → quick drill-down → done.
` : ''

    const systemPrompt = `You are a real estate assistant helping a seller fill out a Missouri Seller's Disclosure form.
Property: ${propertyAddress || 'the property'}
Seller: ${sellerName || 'the seller'}
Current section: "${sectionTitle}" (key: ${sectionKey})
Language: ${lang}

FORM FIELDS TO COLLECT:
${fieldList}
${answered ? `\nAlready answered:\n${answered}` : ''}
${batchInstructions}
${fixtureInstructions}

CONVERSATION RULES:
- Be direct. NO filler phrases: never say "Great!", "Thank you!", "Perfect!", "Got it!", "Awesome!", "Sure!", "Of course!"
- No pleasantries between questions. One word acknowledgement max ("Noted.") then next question.
- Keep messages to 1-3 sentences max. Ask one thing at a time unless doing a batch scan.
- Accept natural answers: "yeah", "nope", "not really", "we fixed it a few years ago"
- When you've covered all fields, set COMPLETE to true
- Always respond in ${lang}

QUICK REPLY OPTIONS:
- When question has 2-10 clear discrete choices, include OPTIONS tag
- For yes/no: ["Yes", "No"] or ["Yes", "No", "Not sure"]
- For seller identity: ["Seller 1", "Seller 2", "Both sellers"]
- For batch scan: list each item as a short chip + "None of these" at end
- For open-ended (dates, names, amounts, descriptions): NO OPTIONS

RESPONSE FORMAT — include these tags at END of every response:
<OPTIONS>["option1", "option2"]</OPTIONS>  (only when discrete choices apply)
<UPDATES>{"fieldKey": "value"}</UPDATES>
<COMPLETE>true|false</COMPLETE>

Field value formats:
- choice yes/no/na: use exactly "yes", "no", or "na"
- fixture_status: use exactly "OS", "EX", "NA", or "NS"
- checkbox: true or false
- text/textarea/date: string value
- For batch scan "None of these": set ALL yes/no fields in section to "no" in UPDATES
- Only include fields you're confident about — empty object {} is fine`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(messages || []),
        ],
        max_tokens: 600,
        temperature: 0.4,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('OpenAI error:', err)
      return NextResponse.json({ error: 'OpenAI request failed' }, { status: 500 })
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content || ''

    // Parse hidden tags
    const optionsMatch = raw.match(/<OPTIONS>([\s\S]*?)<\/OPTIONS>/)
    const updatesMatch = raw.match(/<UPDATES>([\s\S]*?)<\/UPDATES>/)
    const completeMatch = raw.match(/<COMPLETE>(true|false)<\/COMPLETE>/)

    let fieldUpdates: Record<string, unknown> = {}
    let sectionComplete = false
    let options: string[] = []

    try {
      if (updatesMatch?.[1]) fieldUpdates = JSON.parse(updatesMatch[1].trim())
    } catch { /* ignore */ }

    try {
      if (optionsMatch?.[1]) {
        const parsed = JSON.parse(optionsMatch[1].trim())
        if (Array.isArray(parsed)) options = parsed
      }
    } catch { /* ignore */ }

    if (completeMatch?.[1] === 'true') sectionComplete = true

    // If no options from AI but it's first message of a batch section, inject them
    if (!options.length && isBatchSection && isFirstMessage && batchOptions.length > 0) {
      options = [...batchOptions, 'None of these']
    }

    const message = raw
      .replace(/<OPTIONS>[\s\S]*?<\/OPTIONS>/g, '')
      .replace(/<UPDATES>[\s\S]*?<\/UPDATES>/g, '')
      .replace(/<COMPLETE>[\s\S]*?<\/COMPLETE>/g, '')
      .trim()

    return NextResponse.json({ message, fieldUpdates, sectionComplete, options })
  } catch (e) {
    console.error('Chat error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
