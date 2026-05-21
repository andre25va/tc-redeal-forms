import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  PDFDocument, PDFName, PDFRef, PDFArray,
  PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup,
} from 'pdf-lib'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
    } catch (e) {
      return NextResponse.json({ fieldsFound: 0, message: 'Could not parse PDF' })
    }

    const pages = pdfDoc.getPages()

    // 3. Try to get AcroForm
    let form: any
    try {
      form = pdfDoc.getForm()
    } catch {
      return NextResponse.json({ fieldsFound: 0, message: 'No AcroForm found in this PDF. Use Map Fields to add fields manually.' })
    }

    const fields = form.getFields()
    if (!fields || fields.length === 0) {
      return NextResponse.json({ fieldsFound: 0, message: 'No AcroForm fields found. Use Map Fields to add fields manually.' })
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

      for (const widget of widgets) {
        let rect: any
        try { rect = widget.getRectangle() } catch { continue }
        if (!rect) continue

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
        let key = rawName
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
          // Check for signature field (FT = /Sig)
          try {
            const ft = field.acroField.dict.lookup(PDFName.of('FT'))
            if (ft && ft.toString() === '/Sig') {
              isSignature = true
              fieldType = 'text'
            }
          } catch { /* not a sig */ }
        }

        const height = Math.max(12, Math.round(rect.height))
        const y = Math.round(yFromTop)

        coordinates.push({
          form_slug: slug,
          field_key: key,
          page_num: pageIndex + 1,
          x: Math.round(rect.x),
          y,
          width: Math.round(rect.width),
          height,
          field_type: fieldType,
          is_signature: isSignature,
          is_initial: false,
          required: false,
        })
      }
    }

    if (coordinates.length === 0) {
      return NextResponse.json({ fieldsFound: 0, message: 'No mappable fields found. Use Map Fields to add fields manually.' })
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
