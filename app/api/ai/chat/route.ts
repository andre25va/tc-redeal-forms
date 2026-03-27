import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

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
    const isFirstMessage = !messages || messages.length === 0

    const fieldList = (fields as Array<{
      key: string; type: string; label: string; choices?: string[]
    }>)
      .filter(f => f.type !== 'signature')
      .map(f => {
        let desc = `- ${f.key} (${f.type}): "${f.label}"`
        if (f.choices?.length) desc += ` [options: ${f.choices.join(' / ')}]`
        return desc
      })
      .join('\n')

    const answered = (fields as Array<{ key: string; label: string }>)
      .filter(f => formValues?.[f.key] !== undefined && formValues[f.key] !== '' && formValues[f.key] !== null)
      .map(f => `  ${f.key}: ${JSON.stringify(formValues[f.key])}`)
      .join('\n')

    const isFixtures = sectionKey === 'fixtures'

    const fixtureInstructions = isFixtures ? `
SPECIAL INSTRUCTIONS FOR FIXTURES SECTION:
This section is a long list of items. Present them in groups of 5-7 at a time.
For each item ask if it: Stays with the house (OS), Seller is taking it (EX), Not applicable/don't have it (NA), or Not sure (NS).
Group logically: kitchen appliances together, outdoor items together, etc.
Be fast and efficient - present multiple items at once.
Always include OPTIONS for fixture groups: ["Stays (OS)", "Taking it (EX)", "N/A (NA)", "Not sure (NS)"]
` : ''

    const systemPrompt = `You are a friendly real estate assistant helping a seller fill out a Missouri Seller's Disclosure form.
Property: ${propertyAddress || 'the property'}
Seller: ${sellerName || 'the seller'}
Current section: "${sectionTitle}"
Language: ${lang}

YOUR JOB: Have a natural conversation to gather answers for these form fields:
${fieldList}
${answered ? `\nAlready answered:\n${answered}` : ''}
${fixtureInstructions}

CONVERSATION RULES:
- Be warm, conversational, and concise (2-4 sentences per message)
- Group related yes/no questions together when possible
- Accept natural answers: "yeah", "nope", "not really", "we fixed it a few years ago"
- For yes answers, ask a brief follow-up for relevant detail fields
- For fixture_status fields: OS = staying, EX = seller taking it, NA = doesn't apply, NS = not sure
- When you've covered all fields in this section, set COMPLETE to true
- Always respond in ${lang}
${isFirstMessage ? `- Start by briefly introducing this section (1 sentence) then ask your first question` : ''}

QUICK REPLY OPTIONS:
- When your question has 2-5 clear discrete choices, include an OPTIONS tag with the choices
- Examples of when to use OPTIONS:
  * Yes/No questions -> ["Yes", "No"]
  * Yes/No/Not Sure -> ["Yes", "No", "Not sure"]
  * Seller identity -> ["Seller 1", "Seller 2", "Both sellers"]
  * Fixture status -> ["Stays (OS)", "Taking it (EX)", "N/A", "Not sure"]
  * Known choice fields -> use the actual option labels
- For open-ended questions (dates, names, dollar amounts, descriptions) do NOT include OPTIONS
- OPTIONS appear as tappable buttons the user can tap instead of typing

RESPONSE FORMAT - You MUST include these tags at the END of every response:
<OPTIONS>["option1", "option2"]</OPTIONS>  <- include only when discrete choices apply, otherwise omit
<UPDATES>{"fieldKey": "value"}</UPDATES>
<COMPLETE>true|false</COMPLETE>

Field value formats:
- choice (yes/no/na): use exactly "yes", "no", or "na"
- fixture_status: use exactly "OS", "EX", "NA", or "NS"  
- checkbox: use true or false
- text/textarea/date: use the string value
- Only include fields you're confident about from THIS message exchange
- Empty object {} is fine if no new fields were answered`

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
        max_tokens: 500,
        temperature: 0.65,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('OpenAI error:', err)
      return NextResponse.json({ error: 'OpenAI request failed' }, { status: 500 })
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content || ''

    // Parse hidden tags — use [\s\S] instead of s-flag for ES2017 compat
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
