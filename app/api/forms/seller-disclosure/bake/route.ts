import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, PDFName } from 'pdf-lib'
import { createServiceClient } from '@/lib/supabase'

export const maxDuration = 60

/**
 * POST /api/forms/seller-disclosure/bake
 *
 * Reads the original blank PDF (from storage or public library fallback),
 * adds real AcroForm text/checkbox widgets at the positions stored in
 * field_coordinates, then saves the result as the fillable template
 * (seller-disclosure/template.pdf in form-templates bucket).
 *
 * Fully dynamic — no hardcoded field definitions required.
 * Any field drawn in the mapper and saved to Supabase will be baked automatically.
 *
 * Coordinate system: field_coordinates stores pixel positions at 150 DPI.
 * PDF uses points at 72 DPI. Conversion: pts = px * (72/150) = px * 0.48
 * PDF y-axis is bottom-up; image y-axis is top-down.
 * Formula: pdf_y = page_height_pts - (pixel_y * scale) - (field_height_pts)
 */

const PX_TO_PT = 72 / 150  // 0.48
const PAGE_H_PT = 792       // standard letter page height in points

// Public URL of the original blank PDF (served from /public/library/)
const PUBLIC_ORIGINAL_URL = 'https://tc-redeal-forms.vercel.app/library/seller-disclosure-blank.pdf'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient()

    // ── 1. Load original PDF ───────────────────────────────────────────────
    // Try storage first; fall back to public library file
    let originalBytes: Uint8Array | null = null

    const { data: storedFile } = await supabase.storage
      .from('form-templates')
      .download('seller-disclosure/original.pdf')

    if (storedFile) {
      originalBytes = new Uint8Array(await storedFile.arrayBuffer())
    } else {
      // Fall back to public library PDF
      const host = req.headers.get('host') ?? 'tc-redeal-forms.vercel.app'
      const protocol = host.includes('localhost') ? 'http' : 'https'
      const publicUrl = `${protocol}://${host}/library/seller-disclosure-blank.pdf`

      const res = await fetch(publicUrl)
      if (!res.ok) {
        // Last resort: try the hardcoded production URL
        const prodRes = await fetch(PUBLIC_ORIGINAL_URL)
        if (!prodRes.ok) {
          return NextResponse.json(
            { error: 'Original PDF not found. Please upload seller-disclosure-blank.pdf to /public/library/ and redeploy.' },
            { status: 404 }
          )
        }
        originalBytes = new Uint8Array(await prodRes.arrayBuffer())
      } else {
        originalBytes = new Uint8Array(await res.arrayBuffer())
      }

      // Cache it in storage so we don't fetch the public URL every time
      await supabase.storage
        .from('form-templates')
        .upload('seller-disclosure/original.pdf', originalBytes, {
          contentType: 'application/pdf',
          upsert: true,
        })
    }

    const pdfDoc = await PDFDocument.load(originalBytes)

    // ── 2. Load ALL field coordinates from Supabase ────────────────────────
    const { data: coords, error: coordError } = await supabase
      .from('field_coordinates')
      .select('*')
      .eq('form_slug', 'seller-disclosure')
      .order('page_num', { ascending: true })

    if (coordError || !coords || coords.length === 0) {
      return NextResponse.json(
        { error: 'No field coordinates found. Map at least one field first.' },
        { status: 400 }
      )
    }

    const pages = pdfDoc.getPages()
    const form = pdfDoc.getForm()

    // Track used field names — AcroForm requires unique names
    const usedNames = new Set<string>()

    let added = 0
    let skipped = 0

    for (const coord of coords) {
      const pageIndex = (coord.page_num ?? 1) - 1
      const page = pages[pageIndex]
      if (!page) { skipped++; continue }

      // Convert pixel coords → PDF points
      const x  = (coord.x  ?? 0) * PX_TO_PT
      const w  = Math.max((coord.width  ?? 80) * PX_TO_PT, 8)
      const h  = Math.max((coord.height ?? 14) * PX_TO_PT, 6)
      // PDF y is bottom-up; image y is top-down
      const y  = PAGE_H_PT - (coord.y ?? 0) * PX_TO_PT - h

      // Ensure unique AcroForm field name
      let fieldName = coord.field_key
      if (usedNames.has(fieldName)) {
        fieldName = `${fieldName}_p${coord.page_num}`
      }
      usedNames.add(fieldName)

      try {
        const fieldType = coord.field_type ?? 'text'

        if (fieldType === 'checkbox') {
          const field = form.createCheckBox(fieldName)
          field.addToPage(page, {
            x, y,
            width: w,
            height: h,
            borderWidth: 1,
          })
        } else {
          // text, textarea, initial, signature, choice — all become text fields
          const field = form.createTextField(fieldName)
          field.addToPage(page, {
            x, y,
            width: w,
            height: h,
            borderWidth: 0,
          })
          field.setFontSize(coord.font_size ?? 9)

          if (fieldType === 'textarea') {
            field.enableMultiline()
          }

          // Transparent background so PDF artwork shows through
          const widgets = field.acroField.getWidgets()
          for (const widget of widgets) {
            const mk = widget.getOrCreateAppearanceCharacteristics()
            mk.dict.set(PDFName.of('BG'), pdfDoc.context.obj([]))
          }
        }

        added++
      } catch (err) {
        console.warn(`[bake] Failed to add field "${fieldName}":`, err)
        skipped++
      }
    }

    // ── 3. Save baked PDF ──────────────────────────────────────────────────
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
      message: `Baked ${added} AcroForm fields into template PDF.${skipped ? ` (${skipped} skipped — duplicate names or missing page)` : ''}`,
      added,
      skipped,
    })
  } catch (err: unknown) {
    console.error('[bake] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
