import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, PDFName, PDFArray, PDFRef } from 'pdf-lib'
import { inflateSync, inflateRawSync } from 'zlib'

export const runtime = 'nodejs'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/** Decompress a raw stream object — handles FlateDecode, raw bytes */
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

/** Resolve a Contents ref/array to a combined content string */
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

/** Tokenize a PDF content stream into tokens (handles strings, hex, comments) */
function tokenize(content: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < content.length) {
    const ch = content[i]
    // Skip whitespace
    if (' \t\n\r\f\0'.includes(ch)) { i++; continue }
    // Comment
    if (ch === '%') { while (i < content.length && content[i] !== '\n') i++; continue }
    // String literal — skip content
    if (ch === '(') {
      tokens.push('(STR)')
      let depth = 1; i++
      while (i < content.length && depth > 0) {
        if (content[i] === '\\\\') { i += 2; continue }
        if (content[i] === '(') depth++
        else if (content[i] === ')') depth--
        i++
      }
      continue
    }
    // Hex string
    if (ch === '<' && content[i+1] !== '<') {
      tokens.push('<HEX>')
      i++; while (i < content.length && content[i] !== '>') i++; i++
      continue
    }
    // Dict <<
    if (ch === '<' && content[i+1] === '<') { tokens.push('<<'); i += 2; continue }
    if (ch === '>' && content[i+1] === '>') { tokens.push('>>'); i += 2; continue }
    // Array
    if (ch === '[' || ch === ']') { tokens.push(ch); i++; continue }
    // Name object
    if (ch === '/') {
      let name = '/'
      i++
      while (i < content.length && !' \t\n\r\f\0()[]{}<>/%'.includes(content[i])) name += content[i++]
      tokens.push(name)
      continue
    }
    // Number or operator
    let tok = ''
    while (i < content.length && !' \t\n\r\f\0()[]{}<>/%'.includes(content[i])) tok += content[i++]
    if (tok) tokens.push(tok)
  }
  return tokens
}

interface DrawResult {
  lines: Array<{ x: number; y: number; width: number; height: number }>
  checkboxes: Array<{ x: number; y: number; width: number; height: number }>
}

/** Parse drawing operators from tokenized stream */
function parseDrawingOps(tokens: string[], pageH: number): DrawResult {
  const lines: DrawResult['lines'] = []
  const checkboxes: DrawResult['checkboxes'] = []
  const stack: number[] = []

  // Path state
  let pathX = 0, pathY = 0
  let moveX = 0, moveY = 0
  interface Seg { x1: number; y1: number; x2: number; y2: number }
  let pathSegs: Seg[] = []

  // Graphics state stack (save/restore)
  type GState = { ctm: number[] }
  const gsStack: GState[] = []
  let ctm = [1,0,0,1,0,0] // identity

  /** Apply CTM to a point */
  const applyCtm = (x: number, y: number) => [
    ctm[0]*x + ctm[2]*y + ctm[4],
    ctm[1]*x + ctm[3]*y + ctm[5],
  ]

  const flushPath = (doStroke: boolean) => {
    if (!doStroke) { pathSegs = []; return }
    // Group adjacent horizontal segments and merge
    const segs = pathSegs.filter(s => {
      const dy = Math.abs(s.y2 - s.y1)
      const dx = Math.abs(s.x2 - s.x1)
      return dy < 2.5 && dx >= 18 && dx <= 500
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
    if (!isNaN(num) && tok !== '') {
      stack.push(num); i++; continue
    }

    switch (tok) {
      // Graphics state
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
      // Path construction
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
          // Checkbox: small square 6-22pt
          if (aw >= 6 && aw <= 22 && ah >= 6 && ah <= 22) {
            checkboxes.push({ x: Math.min(tx, tx2), y: pageH - Math.max(ty, ty2), width: aw, height: ah })
          }
          // Also add as a rect path for stroke detection
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
      // Path painting
      case 'S': case 's': flushPath(true); stack.length = 0; break
      case 'f': case 'F': case 'f*': flushPath(false); stack.length = 0; break
      case 'B': case 'B*': case 'b': case 'b*': flushPath(true); stack.length = 0; break
      case 'n': flushPath(false); stack.length = 0; break
      // Text — just clear stack
      case 'BT': case 'ET': stack.length = 0; break
      default:
        // Unknown operator — clear stack
        if (/^[a-zA-Z*'"]/.test(tok)) stack.length = 0
        break
    }
    i++
  }

  // Dedupe checkboxes within 4pt of each other
  const dedupedCB: typeof checkboxes = []
  for (const cb of checkboxes) {
    if (!dedupedCB.some(d => Math.abs(d.x - cb.x) < 4 && Math.abs(d.y - cb.y) < 4)) dedupedCB.push(cb)
  }

  // Dedupe lines within 8pt of each other (same y)
  const dedupedLines: typeof lines = []
  for (const ln of lines) {
    if (!dedupedLines.some(d => Math.abs(d.x - ln.x) < 8 && Math.abs(d.y - ln.y) < 4)) dedupedLines.push(ln)
  }

  return { lines: dedupedLines, checkboxes: dedupedCB }
}

/** Convert a label string to snake_case field key */
function toSnakeCase(label: string, type: string, used: Set<string>): string {
  let key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
  if (!key) key = type === 'checkbox' ? 'checkbox' : 'field'
  // Add suffix to dedupe
  let candidate = key
  let n = 2
  while (used.has(candidate)) candidate = `${key}_${n++}`
  used.add(candidate)
  return candidate
}

export async function POST(req: NextRequest) {
  try {
    const { form_slug } = await req.json()
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
    const pageCount = pdfDoc.getPageCount()

    // 3. Extract OCR text from Supabase (already stored)
    const { data: ocrRows } = await supabase
      .from('pdf_ocr_lines')
      .select('page_num, text, x, y, width, height')
      .eq('form_slug', form_slug)
      .order('page_num')
      .order('y')

    // Group OCR by page
    const ocrByPage: Record<number, Array<{ text: string; x: number; y: number; width: number; height: number }>> = {}
    for (const row of (ocrRows || [])) {
      if (!ocrByPage[row.page_num]) ocrByPage[row.page_num] = []
      ocrByPage[row.page_num].push(row)
    }

    /** Find nearest OCR text to a given point */
    function findLabel(px: number, py: number, pageNum: number, maxDist = 120): string {
      const items = ocrByPage[pageNum] || []
      let best = '', bestDist = maxDist
      for (const it of items) {
        // Prefer items to the left/above the field
        const cx = it.x + it.width / 2
        const cy = it.y + it.height / 2
        const dx = px - (cx + it.width / 2) // positive = field is to the right of text
        const dy = Math.abs(py - cy)
        if (dx < -20 || dy > 30) continue // text must be to left or above
        const dist = Math.sqrt(dx*dx + dy*dy)
        if (dist < bestDist) { bestDist = dist; best = it.text }
      }
      // fallback: any text within 80pt
      if (!best) {
        for (const it of items) {
          const cx = it.x + it.width / 2, cy = it.y + it.height / 2
          const dist = Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2))
          if (dist < bestDist) { bestDist = dist; best = it.text }
        }
      }
      return best
    }

    const allFields: any[] = []
    const usedKeys = new Set<string>()

    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
      const pageNum = pageIdx + 1
      const page = pdfDoc.getPage(pageIdx)
      const { height: pageH } = page.getSize()

      // Get content stream
      const contentsRef = page.node.get(PDFName.of('Contents'))
      const contentStr = resolveContents(pdfDoc, contentsRef)
      if (!contentStr) continue

      const tokens = tokenize(contentStr)
      const { lines, checkboxes } = parseDrawingOps(tokens, pageH)

      // Filter long table borders (> 490pt wide)
      const filteredLines = lines.filter(ln => ln.width <= 490)

      for (const ln of filteredLines) {
        const label = findLabel(ln.x + ln.width / 2, ln.y, pageNum)
        const key = toSnakeCase(label, 'text', usedKeys)
        allFields.push({
          field_key: key,
          field_type: 'text',
          page_num: pageNum,
          x: Math.round(ln.x * 100) / 100,
          y: Math.round(ln.y * 100) / 100,
          width: Math.round(ln.width * 100) / 100,
          height: 12,
          label,
        })
      }

      for (const cb of checkboxes) {
        const label = findLabel(cb.x + cb.width, cb.y + cb.height / 2, pageNum)
        const key = toSnakeCase(label, 'checkbox', usedKeys)
        allFields.push({
          field_key: key,
          field_type: 'checkbox',
          page_num: pageNum,
          x: Math.round(cb.x * 100) / 100,
          y: Math.round(cb.y * 100) / 100,
          width: Math.round(cb.width * 100) / 100,
          height: Math.round(cb.height * 100) / 100,
          label,
        })
      }
    }

    return NextResponse.json({
      fields: allFields,
      count: allFields.length,
      lines: allFields.filter(f => f.field_type !== 'checkbox').length,
      checkboxes: allFields.filter(f => f.field_type === 'checkbox').length,
      pages: pageCount,
    })
  } catch (e: any) {
    console.error('detect-fields error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
