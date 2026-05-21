import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  PDFDocument, PDFName, PDFRef, PDFArray, PDFDict, PDFNumber,
  PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup,
} from 'pdf-lib'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function safeGetRect(widget: any): { x: number; y: number; width: number; height: number } | null {
  try {
    // Try high-level API first
    const rect = widget.getRectangle()
    if (rect && typeof rect.x === 'number') return rect
  } catch {}

  try {
    // Fall back to raw dict lookup
    const dict: PDFDict = widget.dict ?? widget.acroField?.dict
    if (!dict) return null
    const rectArr = dict.lookup(PDFName.of('Rect'))
    if (!(rectArr instanceof PDFArray) || rectArr.size() < 4) return null
    const nums = [0, 1, 2, 3].map(i => {
      const v = rectArr.get(i)
      return v instanceof PDFNumber ? v.asNumber() : 0
    })
    // PDF rect = [llx, lly, urx, ury]
    const [llx, lly, urx, ury] = nums
    return {
      x: Math.min(llx, urx),
      y: Math.min(lly, ury),
      width: Math.abs(urx - llx),
      height: Math.abs(ury - lly),
    }
  } catch {}

  return null
}

export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json()
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

    // 1. Download PDF from Supabase storage
    const path = `${slug}/${slug}.pdf`
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('form-templates')
      .download(path)

    if (dlErr || !fileData) {
      return NextResponse.json({ error: 'PDF not found in storage' }, { status: 404 })
    }

    // 2. Parse with pdf-lib
    const pdfBytes = await fileData.arrayBuffer()
    let pdfDoc: PDFDocument
    try {
      pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
    } catch {
      return NextResponse.json({ fieldsFound: 0, message: 'Could not parse PDF — use Map Fields to add fields manually.' })
    }

    const pages = pdfDoc.getPages()

    // 3. Try to get AcroForm fields
    let fields: any[] = []
    try {
      const form = pdfDoc.getForm()
      fields = form.getFields() ?? []
    } catch {
      // getForm() failed — try raw AcroForm dict
      try {
        const catalog = pdfDoc.catalog
        const acroForm = catalog.lookup(PDFName.of('AcroForm'), PDFDict)
        const fieldsArr = acroForm?.lookup(PDFName.of('Fields'), PDFArray)
        if (!fieldsArr || fieldsArr.size() === 0) {
          return NextResponse.json({ fieldsFound: 0, message: 'No AcroForm fields found — use Map Fields to add fields manually.' })
        }
        // Can't easily iterate raw — fall through to 0 fields message
      } catch {}
      return NextResponse.json({ fieldsFound: 0, message: 'No AcroForm found — use Map Fields to add fields manually.' })
    }

    if (!fields.length) {
      return NextResponse.json({ fieldsFound: 0, message: 'No AcroForm fields found — use Map Fields to add fields manually.' })
    }

    // 4. Build annotation ref → page index map
    const refToPage = new Map<string, number>()
    for (let i = 0; i < pages.length; i++) {
      try {
        const annotsValue = pages[i].node.lookup(PDFName.of('Annots'))
        if (annotsValue instanceof PDFArray) {
          for (let j = 0; j < annotsValue.size(); j++) {
            const entry = annotsValue.get(j)
            if (entry instanceof PDFRef) {
              refToPage.set(`${entry.objectNumber}:${entry.generationNumber}`, i)
            }
          }
        }
      } catch { /* page has no annots */ }
    }

    // 5. Extract field coordinates
    const coordinates: any[] = []
    const usedKeys = new Set<string>()

    for (const field of fields) {
      let widgets: any[] = []
      try { widgets = field.acroField.getWidgets() } catch { continue }
      if (!Array.isArray(widgets)) continue

      for (const widget of widgets) {
        // Use robust rect extraction
        const rect = safeGetRect(widget)
        if (!rect || rect.width <= 0 || rect.height <= 0) continue

        // Find page
        let pageIndex = 0
        try {
          const wRef = widget.ref
          if (wRef instanceof PDFRef) {
            pageIndex = refToPage.get(`${wRef.objectNumber}:${wRef.generationNumber}`) ?? 0
          }
        } catch { /* default page 0 */ }

        const page = pages[pageIndex]
        const { height: pageHeight } = page.getSize()

        // Convert: PDF origin is bottom-left → screen-space top-left
        const yFromTop = pageHeight - rect.y - rect.height

        // Sanitize field name to a key
        let rawName = ''
        try { rawName = field.getName() } catch { rawName = 'field' }
        let key = (rawName || 'field')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '') || 'field'

        // Deduplicate
        if (usedKeys.has(key)) {
          let counter = 2
          while (usedKeys.has(`${key}_${counter}`)) counter++
          key = `${key}_${counter}`
        }
        usedKeys.add(key)

        // Detect field type
        let fieldType = 'text'
        let isSignature = false
        if (field instanceof PDFCheckBox) {
          fieldType = 'checkbox'
        } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
          fieldType = 'select'
        } else if (field instanceof PDFRadioGroup) {
          fieldType = 'radio'
        } else {
          try {
            const ft = field.acroField.dict.lookup(PDFName.of('FT'))
            if (ft && ft.toString() === '/Sig') {
              isSignature = true
              fieldType = 'text'
            }
          } catch { /* not a sig */ }
        }

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

    if (coordinates.length === 0) {
      return NextResponse.json({ fieldsFound: 0, message: 'No mappable fields extracted — use Map Fields to add fields manually.' })
    }

    // 6. Upsert into field_coordinates
    const { error: insertErr } = await supabase
      .from('field_coordinates')
      .upsert(coordinates, { onConflict: 'form_slug,field_key,page_num' })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      fieldsFound: coordinates.length,
      message: `Auto-mapped ${coordinates.length} fields successfully.`,
    })
  } catch (err: any) {
    console.error('auto-map error:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
