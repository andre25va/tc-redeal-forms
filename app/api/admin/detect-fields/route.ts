import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, PDFName, PDFArray, PDFRef } from 'pdf-lib'
import { inflateSync, inflateRawSync } from 'zlib'

export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Stream helpers ──────────────────────────────────────────────────────────

function streamToString(obj: any): string {
  try {
    const bytes: Uint8Array = obj?.contents
    if (!bytes?.length) return ''
    let isFlate = false
    try {
      const filter = obj?.dict?.lookup?.(PDFName.of('Filter'))
      if (filter) {
        const fs = filter.toString()
        isFlate = fs.includes('FlateDecode') || fs.includes('/Fl')
      }
    } catch { isFlate = true }
    if (isFlate) {
      try { return new TextDecoder('latin1').decode(inflateSync(Buffer.from(bytes))) } catch {}
      try { return new TextDecoder('latin1').decode(inflateRawSync(Buffer.from(bytes))) } catch {}
    }
    return new TextDecoder('latin1').decode(bytes)
  } catch { return '' }
}

function resolveContents(pdfDoc: PDFDocument, ref: any): string {
  if (!ref) return ''
  try {
    if (ref instanceof PDFRef) {
      const obj = pdfDoc.context.lookup(ref)
      if (obj && 'contents' in obj) return streamToString(obj)
      if (obj instanceof PDFArray) return resolveContents(pdfDoc, obj)
      return ''
    }
    if (ref instanceof PDFArray) {
      return ref.asArray().map((r: any) => resolveContents(pdfDoc, r)).join(' ')
    }
    if ('contents' in ref) return streamToString(ref)
  } catch {}
  return ''
}

// ─── Tokenizer ───────────────────────────────────────────────────────────────

function tokenize(content: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < content.length) {
    const ch = content[i]
    if (' \t\n\r\f\0'.includes(ch)) { i++; continue }
    if (ch === '%') { while (i < content.length && content[i] !== '\n') i++; continue }
    if (ch === '(') {
      tokens.push('(STR)')
      let depth = 1; i++
      while (i < content.length && depth > 0) {
        if (content[i] === '\\') { i += 2; continue }
        if (content[i] === '(') depth++
        else if (content[i] === ')') depth--
        i++
      }
      continue
    }
    if (ch === '<' && content[i+1] !== '<') {
      tokens.push('<HEX>'); i++
      while (i < content.length && content[i] !== '>') i++; i++
      continue
    }
    if (ch === '<' && content[i+1] === '<') { tokens.push('<<'); i += 2; continue }
    if (ch === '>' && content[i+1] === '>') { tokens.push('>>'); i += 2; continue }
    if (ch === '[' || ch === ']') { tokens.push(ch); i++; continue }
    if (ch === '/') {
      let name = '/'; i++
      while (i < content.length && !' \t\n\r\f\0()[]{}<>/%'.includes(content[i])) name += content[i++]
      tokens.push(name); continue
    }
    let tok = ''
    while (i < content.length && !' \t\n\r\f\0()[]{}<>/%'.includes(content[i])) tok += content[i++]
    if (tok) tokens.push(tok)
  }
  return tokens
}

// ─── Drawing parser ──────────────────────────────────────────────────────────

interface DrawResult {
  lines: Array<{ x: number; y: number; width: number; height: number }>
  checkboxes: Array<{ x: number; y: number; width: number; height: number }>
}

function parseDrawingOps(tokens: string[], pageH: number): DrawResult {
  const lines: DrawResult['lines'] = []
  const checkboxes: DrawResult['checkboxes'] = []
  const stack: number[] = []

  let pathX = 0, pathY = 0, moveX = 0, moveY = 0
  interface Seg { x1: number; y1: number; x2: number; y2: number }
  let pathSegs: Seg[] = []

  type GState = { ctm: number[] }
  const gsStack: GState[] = []
  let ctm = [1,0,0,1,0,0]

  const applyCtm = (x: number, y: number) => [
    ctm[0]*x + ctm[2]*y + ctm[4],
    ctm[1]*x + ctm[3]*y + ctm[5],
  ]

  const flushPath = (doStroke: boolean) => {
    if (!doStroke) { pathSegs = []; return }
    const segs = pathSegs.filter(s => {
      const dy = Math.abs(s.y2 - s.y1)
      const dx = Math.abs(s.x2 - s.x1)
      return dy < 2.5 && dx >= 18 && dx <= 550
    })
    segs.sort((a, b) => Math.abs(a.y1 - b.y1) < 3 ? a.x1 - b.x1 : a.y1 - b.y1)
    let j = 0
    while (j < segs.length) {
      let { x1, y1, x2 } = { x1: Math.min(segs[j].x1, segs[j].x2), y1: segs[j].y1, x2: Math.max(segs[j].x1, segs[j].x2) }
      while (j + 1 < segs.length && Math.abs(segs[j+1].y1 - y1) < 3 && segs[j+1].x1 <= x2 + 8) {
        x2 = Math.max(x2, Math.max(segs[j+1].x1, segs[j+1].x2)); j++
      }
      if (x2 - x1 >= 18) {
        lines.push({ x: x1, y: pageH - y1 - 12, width: x2 - x1, height: 12 })
      }
      j++
    }
    pathSegs = []
  }

  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    const num = parseFloat(tok)
    if (!isNaN(num) && tok !== '') { stack.push(num); i++; continue }

    switch (tok) {
      case 'q': gsStack.push({ ctm: [...ctm] }); stack.length = 0; break
      case 'Q': { const gs = gsStack.pop(); if (gs) ctm = gs.ctm; stack.length = 0; break }
      case 'cm': {
        if (stack.length >= 6) {
          const [a,b,c,d,e,f] = stack.slice(-6)
          ctm = [
            ctm[0]*a + ctm[2]*b, ctm[1]*a + ctm[3]*b,
            ctm[0]*c + ctm[2]*d, ctm[1]*c + ctm[3]*d,
            ctm[0]*e + ctm[2]*f + ctm[4], ctm[1]*e + ctm[3]*f + ctm[5]
          ]
        }
        stack.length = 0; break
      }
      case 'm': {
        if (stack.length >= 2) {
          const [px, py] = applyCtm(stack[stack.length-2], stack[stack.length-1])
          pathX = moveX = px; pathY = moveY = py
        }
        stack.length = 0; break
      }
      case 'l': {
        if (stack.length >= 2) {
          const [tx, ty] = applyCtm(stack[stack.length-2], stack[stack.length-1])
          pathSegs.push({ x1: pathX, y1: pathY, x2: tx, y2: ty })
          pathX = tx; pathY = ty
        }
        stack.length = 0; break
      }
      case 'c': {
        if (stack.length >= 6) {
          const [tx, ty] = applyCtm(stack[stack.length-2], stack[stack.length-1])
          pathX = tx; pathY = ty
        }
        stack.length = 0; break
      }
      case 'v': case 'y': {
        if (stack.length >= 4) {
          const [tx, ty] = applyCtm(stack[stack.length-2], stack[stack.length-1])
          pathX = tx; pathY = ty
        }
        stack.length = 0; break
      }
      case 'h': { pathX = moveX; pathY = moveY; break }
      case 're': {
        if (stack.length >= 4) {
          const rx = stack[stack.length-4], ry = stack[stack.length-3]
          const rw = stack[stack.length-2], rh = stack[stack.length-1]
          const [tx, ty] = applyCtm(rx, ry)
          const [tx2, ty2] = applyCtm(rx + rw, ry + rh)
          const aw = Math.abs(tx2 - tx), ah = Math.abs(ty2 - ty)
          if (aw >= 6 && aw <= 22 && ah >= 6 && ah <= 22) {
            checkboxes.push({ x: Math.min(tx, tx2), y: pageH - Math.max(ty, ty2), width: aw, height: ah })
          }
          const bx = Math.min(tx, tx2), by = Math.min(ty, ty2)
          pathSegs.push(
            { x1: bx, y1: by, x2: bx+aw, y2: by },
            { x1: bx+aw, y1: by, x2: bx+aw, y2: by+ah },
            { x1: bx+aw, y1: by+ah, x2: bx, y2: by+ah },
            { x1: bx, y1: by+ah, x2: bx, y2: by }
          )
        }
        stack.length = 0; break
      }
      case 'S': case 's': flushPath(true); stack.length = 0; break
      case 'f': case 'F': case 'f*': flushPath(false); stack.length = 0; break
      case 'B': case 'B*': case 'b': case 'b*': flushPath(true); stack.length = 0; break
      case 'n': flushPath(false); stack.length = 0; break
      case 'BT': case 'ET': stack.length = 0; break
      default:
        if (/^[a-zA-Z*'"]/.test(tok)) stack.length = 0
        break
    }
    i++
  }

  // Dedup checkboxes within 4pt
  const dedupedCB: typeof checkboxes = []
  for (const cb of checkboxes) {
    if (!dedupedCB.some(d => Math.abs(d.x - cb.x) < 4 && Math.abs(d.y - cb.y) < 4)) dedupedCB.push(cb)
  }
  // Dedup lines within 8pt same y
  const dedupedLines: typeof lines = []
  for (const ln of lines) {
    if (!dedupedLines.some(d => Math.abs(d.x - ln.x) < 8 && Math.abs(d.y - ln.y) < 4)) dedupedLines.push(ln)
  }

  return { lines: dedupedLines, checkboxes: dedupedCB }
}

// ─── Improvement 1: Paragraph number filter ──────────────────────────────────

function isParagraphNumber(text: string): boolean {
  if (!text) return false
  const t = text.trim()
  // Catches: "11", "27.", "(a)", "(1)", "11.", "A.", "a.", "i.", "ii."
  return (
    /^\(?\d+[\.\):]?$/.test(t) ||
    /^\(?[a-zA-Z]{1,3}[\.\):]$/.test(t) ||
    /^[ivxIVX]+[\.\):]?$/.test(t) ||
    t.length <= 2 && /^\d+$/.test(t)
  )
}

// ─── Improvement 2: Stitch nearby text fragments ─────────────────────────────

type OcrItem = { text: string; x: number; y: number; width: number; height: number }

function stitchLabels(items: OcrItem[]): OcrItem[] {
  if (!items.length) return items
  // Sort by y then x
  const sorted = [...items].sort((a, b) => Math.abs(a.y - b.y) < 4 ? a.x - b.x : a.y - b.y)
  const result: OcrItem[] = []
  let i = 0
  while (i < sorted.length) {
    let cur = { ...sorted[i] }
    // Merge with next if on same row (y within 4pt) and close x (within 20pt gap)
    while (
      i + 1 < sorted.length &&
      Math.abs(sorted[i+1].y - cur.y) < 4 &&
      sorted[i+1].x <= cur.x + cur.width + 20
    ) {
      i++
      const next = sorted[i]
      const mergedText = cur.text.trimEnd() + ' ' + next.text.trimStart()
      const newWidth = (next.x + next.width) - cur.x
      cur = { text: mergedText, x: cur.x, y: cur.y, width: Math.max(newWidth, cur.width), height: Math.max(cur.height, next.height) }
    }
    result.push(cur)
    i++
  }
  return result
}

// ─── Improvement 3: Column detection ─────────────────────────────────────────

function detectColumns(items: OcrItem[]): number[] {
  // Cluster x-positions of text starts to find column boundaries
  const xs = items.map(it => it.x).sort((a, b) => a - b)
  if (xs.length < 4) return []
  const cols: number[] = [xs[0]]
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] - xs[i-1] > 80) cols.push(xs[i])
  }
  return cols
}

function sameColumn(fieldX: number, textX: number, columns: number[]): boolean {
  if (columns.length < 2) return true
  // Find which column each belongs to
  const colOf = (x: number) => {
    let col = 0
    for (let i = 0; i < columns.length; i++) {
      if (x >= columns[i] - 20) col = i
    }
    return col
  }
  return colOf(fieldX) === colOf(textX)
}

// ─── Improvement 4: Smart label finder ───────────────────────────────────────

function findLabelForTextField(
  fieldX: number,
  fieldY: number,
  fieldWidth: number,
  pageNum: number,
  stitched: OcrItem[],
  columns: number[],
  pageH: number,
): string {
  // Skip if in header/footer zone (50pt from top or bottom)
  if (fieldY < 50 || fieldY > pageH - 50) return ''

  // 1. LEFT PRIORITY: text ending before field start, on same row (y within 8pt)
  const leftCandidates = stitched
    .filter(it => {
      if (isParagraphNumber(it.text)) return false
      const textRightEdge = it.x + it.width
      const textCenterY = it.y + it.height / 2
      return (
        textRightEdge <= fieldX + 15 &&        // text ends before field starts
        textRightEdge >= fieldX - 150 &&        // not too far left
        Math.abs(textCenterY - fieldY) <= 10 && // same row
        !sameColumn(fieldX, it.x, columns) === false // same or adjacent column
      )
    })
    .sort((a, b) => (b.x + b.width) - (a.x + a.width)) // closest left first

  if (leftCandidates.length > 0) return leftCandidates[0].text.trim()

  // 2. ABOVE: text directly above with x-overlap
  const aboveCandidates = stitched
    .filter(it => {
      if (isParagraphNumber(it.text)) return false
      const textCenterY = it.y + it.height / 2
      const overlap = Math.min(it.x + it.width, fieldX + fieldWidth) - Math.max(it.x, fieldX)
      return (
        textCenterY < fieldY &&
        textCenterY >= fieldY - 30 &&
        overlap > 10
      )
    })
    .sort((a, b) => b.y - a.y) // closest above first

  if (aboveCandidates.length > 0) return aboveCandidates[0].text.trim()

  // 3. Fallback: any text within 80pt
  let best = '', bestDist = 80
  for (const it of stitched) {
    if (isParagraphNumber(it.text)) continue
    const cx = it.x + it.width / 2, cy = it.y + it.height / 2
    const dist = Math.sqrt(Math.pow(fieldX + fieldWidth/2 - cx, 2) + Math.pow(fieldY - cy, 2))
    if (dist < bestDist) { bestDist = dist; best = it.text }
  }
  return best.trim()
}

function findLabelForCheckbox(
  cbX: number,
  cbY: number,
  cbW: number,
  cbH: number,
  pageNum: number,
  stitched: OcrItem[],
  pageH: number,
): string {
  // Skip header/footer
  if (cbY < 50 || cbY > pageH - 50) return ''

  // 1. RIGHT PRIORITY: text starting after checkbox right edge, same row
  const rightCandidates = stitched
    .filter(it => {
      if (isParagraphNumber(it.text)) return false
      const textCenterY = it.y + it.height / 2
      return (
        it.x >= cbX + cbW - 5 &&           // text starts at or after cb right edge
        it.x <= cbX + cbW + 100 &&         // not too far right
        Math.abs(textCenterY - cbY) <= 8   // same row
      )
    })
    .sort((a, b) => a.x - b.x) // closest right first

  if (rightCandidates.length > 0) return rightCandidates[0].text.trim()

  // 2. LEFT: text ending just before checkbox
  const leftCandidates = stitched
    .filter(it => {
      if (isParagraphNumber(it.text)) return false
      const textRightEdge = it.x + it.width
      const textCenterY = it.y + it.height / 2
      return (
        textRightEdge <= cbX + 5 &&
        textRightEdge >= cbX - 120 &&
        Math.abs(textCenterY - cbY) <= 8
      )
    })
    .sort((a, b) => (b.x + b.width) - (a.x + a.width))

  if (leftCandidates.length > 0) return leftCandidates[0].text.trim()

  // 3. ABOVE: x-overlap
  const aboveCandidates = stitched
    .filter(it => {
      if (isParagraphNumber(it.text)) return false
      const overlap = Math.min(it.x + it.width, cbX + cbW) - Math.max(it.x, cbX)
      return it.y + it.height < cbY && it.y + it.height >= cbY - 25 && overlap > 4
    })
    .sort((a, b) => b.y - a.y)

  if (aboveCandidates.length > 0) return aboveCandidates[0].text.trim()

  return ''
}

// ─── Improvement 5: Split compound lines ─────────────────────────────────────

function splitCompoundLine(
  line: { x: number; y: number; width: number; height: number },
  stitched: OcrItem[],
  pageH: number,
): Array<{ x: number; y: number; width: number; height: number }> {
  // A compound line is one that spans > 180pt
  // Look for OCR text whose x position falls INSIDE the line span at approximately the same y
  if (line.width <= 180) return [line]

  const lineEndY = line.y  // screen-space y = top of field = where the line is drawn
  // In screen-space y increases downward. Line was drawn at pageH - pdfY.
  // Text at approximately the same y level in screen-space

  const dividers = stitched
    .filter(it => {
      const textCenterY = it.y + it.height / 2
      const textMidX = it.x + it.width / 2
      return (
        // Text x falls inside the line span (with a margin)
        textMidX > line.x + 10 &&
        textMidX < line.x + line.width - 10 &&
        // Text is at approximately the same y (within 12pt above or 4pt below the line)
        Math.abs(textCenterY - lineEndY) <= 12 &&
        !isParagraphNumber(it.text) &&
        it.text.trim().length > 0
      )
    })
    .sort((a, b) => a.x - b.x)

  if (dividers.length === 0) return [line]

  // Build split points: start of each divider text
  const splitPoints = dividers.map(d => d.x)
  const segments: Array<{ x: number; y: number; width: number; height: number }> = []
  let currentX = line.x

  for (const sp of splitPoints) {
    if (sp - currentX >= 20) {
      segments.push({ x: currentX, y: line.y, width: sp - currentX - 2, height: line.height })
    }
    currentX = sp + dividers.find(d => d.x === sp)!.width + 2
  }
  // Last segment
  const lastEnd = line.x + line.width
  if (lastEnd - currentX >= 20) {
    segments.push({ x: currentX, y: line.y, width: lastEnd - currentX, height: line.height })
  }

  return segments.length > 0 ? segments : [line]
}

// ─── snake_case helper ────────────────────────────────────────────────────────

function toSnakeCase(label: string, type: string, used: Set<string>): string {
  let key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
  if (!key) key = type === 'checkbox' ? 'checkbox' : 'field'
  let candidate = key
  let n = 2
  while (used.has(candidate)) candidate = `${key}_${n++}`
  used.add(candidate)
  return candidate
}

// ─── GPT naming ───────────────────────────────────────────────────────────────

async function gptNameFields(
  rawFields: Array<{ label: string; field_type: string; idx: number }>
): Promise<Map<number, string>> {
  const result = new Map<number, string>()
  if (!process.env.OPENAI_API_KEY || rawFields.length === 0) return result

  // Process in batches of 30
  const BATCH = 30
  for (let start = 0; start < rawFields.length; start += BATCH) {
    const batch = rawFields.slice(start, start + BATCH)
    const prompt = `You are mapping PDF form field labels to snake_case field keys.
For each field, return a JSON array with objects: { "idx": number, "field_key": "snake_case_key", "field_type": "text|checkbox|date|number|signature" }

Rules:
- Use concise snake_case names (e.g., "buyer_name", "purchase_price", "closing_date")
- Checkbox fields: use YES/NO pairs naming pattern if label suggests yes/no (e.g., "has_hoa_yes", "has_hoa_no")
- Date fields: end with _date
- Monetary fields: end with _amount or _price
- If label is empty or unclear, use field_N where N is the idx
- No duplicates — make keys unique within this batch

Fields:
${JSON.stringify(batch.map(f => ({ idx: f.idx, label: f.label, type: f.field_type })))}`

    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      })
      if (!resp.ok) continue
      const data = await resp.json()
      let content = data.choices?.[0]?.message?.content || '{}'
      // Handle both {fields:[...]} and [...] responses
      let parsed: any
      try { parsed = JSON.parse(content) } catch { continue }
      const arr = Array.isArray(parsed) ? parsed : (parsed.fields || parsed.results || Object.values(parsed)[0])
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item.idx !== undefined && item.field_key) {
            result.set(Number(item.idx), item.field_key)
          }
        }
      }
    } catch { /* continue without GPT for this batch */ }
  }
  return result
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { form_slug, use_gpt = true } = await req.json()
    if (!form_slug) return NextResponse.json({ error: 'form_slug required' }, { status: 400 })

    // 1. Get PDF path
    const { data: tmpl } = await supabase
      .from('form_templates')
      .select('pdf_template_path, page_count, name')
      .eq('slug', form_slug)
      .single()
    if (!tmpl) return NextResponse.json({ error: 'Form template not found' }, { status: 404 })

    const pdfPath = tmpl.pdf_template_path || `${form_slug}.pdf`

    // 2. Download PDF
    const { data: pdfBlob, error: dlErr } = await supabase.storage
      .from('form-templates')
      .download(pdfPath)
    if (dlErr || !pdfBlob) return NextResponse.json({ error: 'PDF download failed: ' + dlErr?.message }, { status: 500 })

    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer())
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
    let pageCount = 0
    try { pageCount = pdfDoc.getPageCount() } catch { pageCount = 0 }

    // 3. Load OCR text from Supabase
    const { data: ocrRows } = await supabase
      .from('pdf_ocr_lines')
      .select('page_num, text, x, y, width, height')
      .eq('form_slug', form_slug)
      .order('page_num')
      .order('y')

    // Group OCR by page and stitch fragments
    const stitchedByPage: Record<number, OcrItem[]> = {}
    const columnsByPage: Record<number, number[]> = {}

    const rawByPage: Record<number, OcrItem[]> = {}
    for (const row of (ocrRows || [])) {
      if (!rawByPage[row.page_num]) rawByPage[row.page_num] = []
      rawByPage[row.page_num].push(row)
    }
    for (const [pg, items] of Object.entries(rawByPage)) {
      const pgNum = Number(pg)
      stitchedByPage[pgNum] = stitchLabels(items)
      columnsByPage[pgNum] = detectColumns(items)
    }

    // 4. Per-page detection
    interface RawField {
      label: string
      field_type: string
      page_num: number
      x: number
      y: number
      width: number
      height: number
      idx: number
    }
    const rawFields: RawField[] = []
    let idx = 0

    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
      const pageNum = pageIdx + 1
      let page: any, pageH = 792
      try {
        page = pdfDoc.getPage(pageIdx)
        try { pageH = page.getSize().height } catch { pageH = 792 }
      } catch (pgErr) {
        console.error(`Page ${pageNum} load error:`, pgErr)
        continue
      }

      let contentsRef: any
      try { contentsRef = page.node.get(PDFName.of('Contents')) } catch { contentsRef = null }
      const contentStr = resolveContents(pdfDoc, contentsRef)
      if (!contentStr) continue

      let rawLines: DrawResult['lines'] = []
      let checkboxes: DrawResult['checkboxes'] = []
      try {
        const tokens = tokenize(contentStr)
        const result = parseDrawingOps(tokens, pageH)
        rawLines = result.lines
        checkboxes = result.checkboxes
      } catch (parseErr) {
        console.error(`Page ${pageNum} parse error:`, parseErr)
      }

      // Filter long table borders (> 490pt)
      const filteredLines = rawLines.filter(ln => ln.width <= 490)

      const stitched = stitchedByPage[pageNum] || []
      const columns = columnsByPage[pageNum] || []

      // ── Text fields (with compound line splitting) ──
      for (const ln of filteredLines) {
        const segments = splitCompoundLine(ln, stitched, pageH)
        for (const seg of segments) {
          // Skip header/footer
          if (seg.y < 50 || seg.y > pageH - 50) continue
          const label = findLabelForTextField(seg.x, seg.y, seg.width, pageNum, stitched, columns, pageH)
          rawFields.push({
            label,
            field_type: 'text',
            page_num: pageNum,
            x: Math.round(seg.x * 100) / 100,
            y: Math.round(seg.y * 100) / 100,
            width: Math.round(seg.width * 100) / 100,
            height: 12,
            idx: idx++,
          })
        }
      }

      // ── Checkboxes ──
      for (const cb of checkboxes) {
        if (cb.y < 50 || cb.y > pageH - 50) continue
        const label = findLabelForCheckbox(cb.x, cb.y, cb.width, cb.height, pageNum, stitched, pageH)
        rawFields.push({
          label,
          field_type: 'checkbox',
          page_num: pageNum,
          x: Math.round(cb.x * 100) / 100,
          y: Math.round(cb.y * 100) / 100,
          width: Math.round(cb.width * 100) / 100,
          height: Math.round(cb.height * 100) / 100,
          idx: idx++,
        })
      }
    }

    // 5. GPT naming (if enabled)
    let gptNames: Map<number, string> = new Map()
    if (use_gpt && rawFields.length > 0) {
      try {
        gptNames = await gptNameFields(rawFields.map(f => ({ label: f.label, field_type: f.field_type, idx: f.idx })))
      } catch { /* fallback to toSnakeCase */ }
    }

    // 6. Build final fields with deduped snake_case keys
    const usedKeys = new Set<string>()
    const allFields = rawFields.map(f => {
      // Use GPT name if available, else derive from label
      let baseKey = gptNames.get(f.idx) || toSnakeCase(f.label, f.field_type, new Set())
      // Dedup across all fields
      let candidate = baseKey
      let n = 2
      while (usedKeys.has(candidate)) candidate = `${baseKey}_${n++}`
      usedKeys.add(candidate)

      return {
        field_key: candidate,
        field_type: f.field_type,
        page_num: f.page_num,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        label: f.label,
      }
    })

    return NextResponse.json({
      fields: allFields,
      count: allFields.length,
      lines: allFields.filter(f => f.field_type !== 'checkbox').length,
      checkboxes: allFields.filter(f => f.field_type === 'checkbox').length,
      pages: pageCount,
      gpt_named: gptNames.size,
    })
  } catch (e: any) {
    console.error('detect-fields error', e)
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
