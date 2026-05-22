import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, PDFName, PDFRef, PDFArray, PDFDict, PDFNumber } from 'pdf-lib'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/** Safely extract {x, y, width, height} from a widget — never throws */
function safeRect(widget: any): { x: number; y: number; width: number; height: number } | null {
  // Attempt 1: high-level API
  try {
    const r = widget.getRectangle?.()
    if (r && typeof r.x === 'number' && r.width > 0) return r
  } catch { /* fall through */ }

  // Attempt 2: raw PDFArray from widget's own dict
  try {
    const dict: PDFDict | undefined = widget?.dict
    if (!dict) return null
    const raw = dict.lookup(PDFName.of('Rect'))
    if (!(raw instanceof PDFArray) || raw.size() < 4) return null
    const n = (i: number) => {
      const v = raw.get(i)
      return v instanceof PDFNumber ? v.asNumber() : 0
    }
    const [llx, lly, urx, ury] = [n(0), n(1), n(2), n(3)]
    const w = Math.abs(urx - llx)
    const h = Math.abs(ury - lly)
    if (w <= 0 || h <= 0) return null
    return { x: Math.min(llx, urx), y: Math.min(lly, ury), width: w, height: h }
  } catch { /* fall through */ }

  return null
}

/** Safely get widgets for a field — never throws */
function safeWidgets(field: any): any[] {
  try {
    const ws = field?.acroField?.getWidgets?.()
    return Array.isArray(ws) ? ws : []
  } catch { return [] }
}

/** Detect field type — never throws */
function safeFieldType(field: any): { type: string; isSignature: boolean } {
  try {
    const name = field?.constructor?.name ?? ''
    if (name === 'PDFCheckBox') return { type: 'checkbox', isSignature: false }
    if (name === 'PDFDropdown' || name === 'PDFOptionList') return { type: 'select', isSignature: false }
    if (name === 'PDFRadioGroup') return { type: 'radio', isSignature: false }
    // Check for /Sig FT
    try {
      const ft = field?.acroField?.dict?.lookup?.(PDFName.of('FT'))
      if (ft?.toString() === '/Sig') return { type: 'text', isSignature: true }
    } catch { /* ignore */ }
  } catch { /* ignore */ }
  return { type: 'text', isSignature: false }
}

export async function POST(req: NextRequest) {
  let slug = ''
  try {
    ;({ slug } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  // 1. Download PDF
  let fileData: Blob | null = null
  try {
    const result = await supabase.storage
      .from('form-templates')
      .download(`${slug}/${slug}.pdf`)
    if (result.error || !result.data) throw new Error(result.error?.message ?? 'not found')
    fileData = result.data
  } catch (e: any) {
    return NextResponse.json({ fieldsFound: 0, message: `PDF not found: ${e.message}` })
  }

  // 2. Parse PDF
  let pdfDoc: PDFDocument
  try {
    const bytes = await fileData.arrayBuffer()
    pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  } catch (e: any) {
    console.error('pdf-lib load failed:', e)
    return NextResponse.json({ fieldsFound: 0, message: 'Could not parse PDF — use Map Fields manually.' })
  }

  // 3. Get fields
  let fields: any[] = []
  try {
    fields = pdfDoc.getForm().getFields() ?? []
  } catch (e: any) {
    console.error('getFields failed:', e)
    return NextResponse.json({ fieldsFound: 0, message: 'No AcroForm fields found — use Map Fields manually.' })
  }
  if (!fields.length) {
    return NextResponse.json({ fieldsFound: 0, message: 'No AcroForm fields found — use Map Fields manually.' })
  }

  // 4. Build widget dict → page index map
  //
  // KEY FIX: Some PDFs embed annotations as direct PDFDict objects (not indirect
  // PDFRef) in the Annots array. The old approach only stored PDFRef entries in
  // refToPage, so direct-object widgets were never found and all defaulted to
  // page 0. Now we resolve every annotation to its PDFDict and use dict identity.
  const pages = pdfDoc.getPages()
  const dictToPage = new Map<PDFDict, number>()

  for (let i = 0; i < pages.length; i++) {
    try {
      const annotsRaw = pages[i].node.lookup(PDFName.of('Annots'))
      if (!(annotsRaw instanceof PDFArray)) continue
      for (let j = 0; j < annotsRaw.size(); j++) {
        const entry = annotsRaw.get(j)
        try {
          let dict: unknown
          if (entry instanceof PDFRef) {
            // Indirect object — resolve it
            dict = pdfDoc.context.lookup(entry)
          } else {
            // Direct object — use as-is
            dict = entry
          }
          if (dict instanceof PDFDict) {
            dictToPage.set(dict, i)
          }
        } catch { /* skip this annot */ }
      }
    } catch { /* skip this page */ }
  }

  // 5. Extract coordinates — every step guarded
  const coordinates: any[] = []
  const usedKeys = new Set<string>()

  for (const field of fields) {
    const widgets = safeWidgets(field)
    const { type: fieldType, isSignature } = safeFieldType(field)

    let rawName = 'field'
    try { rawName = field.getName?.() ?? 'field' } catch { /* use default */ }

    for (const widget of widgets) {
      if (!widget) continue

      const rect = safeRect(widget)
      if (!rect) continue

      // Find page via dict identity (works for both direct and indirect annots)
      let pageIndex = 0
      try {
        if (widget?.dict instanceof PDFDict) {
          pageIndex = dictToPage.get(widget.dict) ?? 0
        }
      } catch { /* default page 0 */ }

      const page = pages[pageIndex]
      let pageHeight = 792
      try { pageHeight = page.getSize().height } catch { /* use default */ }

      // PDF bottom-left origin → screen-space top-left
      const yFromTop = pageHeight - rect.y - rect.height

      // Sanitize key
      let key = (rawName || 'field')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || 'field'
      if (usedKeys.has(key)) {
        let c = 2
        while (usedKeys.has(`${key}_${c}`)) c++
        key = `${key}_${c}`
      }
      usedKeys.add(key)

      coordinates.push({
        form_slug: slug,
        field_key: key,
        page_num: pageIndex + 1,
        x: Math.round(rect.x),
        y: Math.round(yFromTop),
        width: Math.round(rect.width),
        height: Math.max(12, Math.round(rect.height)),
        field_type: fieldType,
        is_signature: isSignature,
        is_initial: false,
        required: false,
      })
    }
  }

  if (!coordinates.length) {
    return NextResponse.json({ fieldsFound: 0, message: 'Fields found but coordinates could not be extracted — use Map Fields manually.' })
  }

  // 6. Upsert
  const { error: insertErr } = await supabase
    .from('field_coordinates')
    .upsert(coordinates, { onConflict: 'form_slug,field_key,page_num' })

  if (insertErr) {
    console.error('upsert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    fieldsFound: coordinates.length,
    message: `Auto-mapped ${coordinates.length} fields successfully.`,
  })
}
