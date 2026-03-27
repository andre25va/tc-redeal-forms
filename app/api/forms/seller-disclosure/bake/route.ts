import { NextResponse } from 'next/server'
import { PDFDocument, PDFName } from 'pdf-lib'
import { createServiceClient } from '@/lib/supabase'
import { SELLER_DISCLOSURE_FIELDS } from '@/lib/forms/seller-disclosure/fields'

export const maxDuration = 60

/**
 * POST /api/forms/seller-disclosure/bake
 *
 * Reads the original blank PDF from storage, adds real AcroForm text/checkbox
 * widgets at the positions stored in field_coordinates, then saves the result
 * as the fillable template (seller-disclosure/template.pdf).
 *
 * After baking, form submissions can fill fields by name — no coordinate math.
 */
export async function POST() {
  try {
    const supabase = createServiceClient()

    // ── 1. Load original PDF ───────────────────────────────────────────────
    const { data: originalFile, error: dlError } = await supabase.storage
      .from('form-templates')
      .download('seller-disclosure/original.pdf')

    if (dlError || !originalFile) {
      return NextResponse.json(
        { error: 'Original PDF not found. Upload it first via the mapper.' },
        { status: 404 }
      )
    }

    const originalBytes = new Uint8Array(await originalFile.arrayBuffer())
    const pdfDoc = await PDFDocument.load(originalBytes)

    // ── 2. Load field coordinates ──────────────────────────────────────────
    const { data: coords, error: coordError } = await supabase
      .from('field_coordinates')
      .select('*')
      .eq('form_slug', 'seller-disclosure')

    if (coordError || !coords || coords.length === 0) {
      return NextResponse.json(
        { error: 'No field coordinates found. Map at least one field first.' },
        { status: 400 }
      )
    }

    // ── 3. Build lookup: field_key → field definition ──────────────────────
    const fieldDefs = new Map(SELLER_DISCLOSURE_FIELDS.map(f => [f.key, f]))
    const pages = pdfDoc.getPages()
    const form = pdfDoc.getForm()

    let added = 0
    let skipped = 0

    for (const coord of coords) {
      const def = fieldDefs.get(coord.field_key)
      if (!def) { skipped++; continue }

      const pageIndex = (coord.page_num ?? 1) - 1
      const page = pages[pageIndex]
      if (!page) { skipped++; continue }

      const x = coord.x ?? 0
      const y = coord.y ?? 0
      const w = Math.max(coord.width ?? 80, 10)
      const h = Math.max(coord.height ?? 14, 8)
      const fontSize = coord.font_size ?? 9

      try {
        if (def.type === 'checkbox') {
          // ── Checkbox widget ──────────────────────────────────────────────
          const field = form.createCheckBox(coord.field_key)
          field.addToPage(page, {
            x, y,
            width: w,
            height: h,
            borderWidth: 1,
          })
        } else {
          // ── Text field (covers text, textarea, choice, fixture_status, date, signature) ──
          const field = form.createTextField(coord.field_key)
          field.addToPage(page, {
            x, y,
            width: w,
            height: h,
            borderWidth: 0,          // invisible border — field overlays PDF text areas
            borderColor: undefined,
            backgroundColor: undefined,
          })
          field.setFontSize(fontSize)

          if (def.type === 'textarea') {
            field.enableMultiline()
          }

          // Make field transparent background so the PDF visual shines through
          const widgets = field.acroField.getWidgets()
          for (const widget of widgets) {
            // Set appearance characteristics: no background fill
            const mk = widget.getOrCreateAppearanceCharacteristics()
            mk.dict.set(PDFName.of('BG'), pdfDoc.context.obj([]))
          }
        }

        added++
      } catch (err) {
        console.warn(`[bake] Failed to add field "${coord.field_key}":`, err)
        skipped++
      }
    }

    // ── 4. Save baked PDF ──────────────────────────────────────────────────
    const bakedBytes = await pdfDoc.save({ useObjectStreams: false })

    const { error: uploadError } = await supabase.storage
      .from('form-templates')
      .upload('seller-disclosure/template.pdf', bakedBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Baked ${added} AcroForm fields into template PDF.${skipped ? ` (${skipped} skipped)` : ''}`,
      added,
      skipped,
    })
  } catch (err: unknown) {
    console.error('[bake] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
