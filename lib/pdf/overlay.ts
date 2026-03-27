import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { PdfField } from '@/types'

/**
 * overlayFormData
 *
 * Fills a PDF template with form data.
 *
 * Strategy:
 *   1. If the PDF was "baked" (has AcroForm fields), fill by field name — 
 *      pixel-perfect, no coordinate math.
 *   2. For any field NOT in the AcroForm (fallback), draw text directly at
 *      the stored x/y coordinates.
 *   3. Signatures (data-URL PNGs) are always drawn as embedded images.
 *   4. Flatten the AcroForm at the end so the PDF is non-editable.
 */
export async function overlayFormData(
  pdfBytes: Uint8Array,
  formData: Record<string, unknown>,
  fields: PdfField[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const pages  = pdfDoc.getPages()
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const form   = pdfDoc.getForm()

  // Build a set of field names that exist in the baked AcroForm
  const acroFieldNames = new Set(form.getFields().map(f => f.getName()))

  // Collect signatures for image overlay (done after AcroForm fill)
  const signatureQueue: PdfField[] = []

  for (const field of fields) {
    const value = formData[field.key]
    if (value === undefined || value === null || value === '') continue

    // ── Signature: always image overlay ─────────────────────────────────────
    if (field.type === 'signature') {
      if (typeof value === 'string' && value.startsWith('data:')) {
        signatureQueue.push(field)
      }
      continue
    }

    // ── AcroForm field: fill by name ─────────────────────────────────────────
    if (acroFieldNames.has(field.key)) {
      try {
        if (field.type === 'checkbox') {
          const cb = form.getCheckBox(field.key)
          value ? cb.check() : cb.uncheck()
        } else {
          const tf = form.getTextField(field.key)
          tf.setText(formatValue(field, value))
        }
      } catch (err) {
        console.warn(`[overlay] AcroForm fill failed for "${field.key}":`, err)
        // fall through to coordinate overlay below
      }
      continue
    }

    // ── Coordinate overlay (fallback for un-baked / missing fields) ──────────
    if (!field.x || !field.y || (field.x === 0 && field.y === 0)) continue

    const page = pages[field.page - 1]
    if (!page) continue

    const fontSize = field.fontSize ?? 9
    const color    = rgb(0, 0, 0)
    const text     = formatValue(field, value)

    if (field.type === 'textarea') {
      drawWrappedText(page, text, field.x, field.y, field.width ?? 400, fontSize, font, color)
    } else {
      page.drawText(text, { x: field.x, y: field.y, size: fontSize, font, color })
    }
  }

  // ── Embed signature images ─────────────────────────────────────────────────
  for (const field of signatureQueue) {
    const value = formData[field.key] as string
    if (!field.x || !field.y) continue
    const page = pages[field.page - 1]
    if (!page) continue
    try {
      const base64   = value.split(',')[1]
      const imgBytes = Buffer.from(base64, 'base64')
      const image    = await pdfDoc.embedPng(imgBytes)
      page.drawImage(image, {
        x:      field.x,
        y:      field.y,
        width:  field.width  ?? 150,
        height: field.height ?? 40,
      })
    } catch (err) {
      console.warn(`[overlay] Signature embed failed for "${field.key}":`, err)
    }
  }

  // ── Flatten AcroForm (makes it a static, non-editable PDF) ──────────────────
  if (acroFieldNames.size > 0) {
    try {
      form.flatten()
    } catch (err) {
      console.warn('[overlay] AcroForm flatten failed:', err)
    }
  }

  return pdfDoc.save()
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(field: PdfField, value: unknown): string {
  const str = String(value)
  if (field.type === 'choice' || field.type === 'fixture_status') {
    return str.toUpperCase()
  }
  return str
}

function drawWrappedText(
  page: ReturnType<PDFDocument['getPages']>[number],
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  color: ReturnType<typeof rgb>
) {
  const lineHeight = fontSize * 1.35
  const words  = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)

  lines.forEach((line, i) => {
    page.drawText(line, { x, y: y - i * lineHeight, size: fontSize, font, color })
  })
}

// ── Summary PDF (fallback when no template exists at all) ─────────────────────

export async function generateSummaryPdf(
  formData: Record<string, unknown>,
  fields: PdfField[],
  propertyAddress: string,
  sellerName: string
): Promise<Uint8Array> {
  const pdfDoc   = await PDFDocument.create()
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage([612, 792])
  const { width, height } = page.getSize()
  let y      = height - 50
  const margin     = 50
  const lineHeight = 18

  const ensureSpace = () => {
    if (y < 70) {
      page = pdfDoc.addPage([612, 792])
      y    = height - 50
    }
  }

  const draw = (text: string, x: number, cy: number, size: number, bold = false) => {
    ensureSpace()
    page.drawText(text, { x, y: cy, size, font: bold ? boldFont : font, color: rgb(0, 0, 0) })
  }

  draw('SELLER DISCLOSURE ADDENDUM', margin, y, 16, true);  y -= lineHeight * 1.5
  draw(`Property: ${propertyAddress}`,  margin, y, 11);     y -= lineHeight
  draw(`Seller: ${sellerName}`,         margin, y, 11);     y -= lineHeight
  draw(`Date: ${new Date().toLocaleDateString()}`, margin, y, 11); y -= lineHeight * 2

  page.drawLine({
    start: { x: margin, y },
    end:   { x: width - margin, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  })
  y -= lineHeight * 1.5

  // Group by section
  const sectionMap = new Map<string, PdfField[]>()
  for (const f of fields) {
    const arr = sectionMap.get(f.section) ?? []
    arr.push(f)
    sectionMap.set(f.section, arr)
  }

  for (const [, sectionFields] of sectionMap) {
    ensureSpace()
    const title = sectionFields[0]?.section ?? ''
    draw(title, margin, y, 12, true);  y -= lineHeight * 1.2

    for (const field of sectionFields) {
      const value = formData[field.key]
      if (value === undefined || value === null || value === '') continue
      if (field.type === 'signature') continue

      ensureSpace()
      const displayValue = String(value)
      draw(`${field.label}:`, margin, y, 9, true)
      if (displayValue.length > 55) {
        y -= lineHeight * 0.8
        drawWrappedText(page, `  ${displayValue}`, margin, y, width - margin * 2, 9, font, rgb(0, 0, 0))
        y -= lineHeight * 0.9
      } else {
        draw(displayValue, 250, y, 9)
        y -= lineHeight
      }
    }
    y -= 12
  }

  return pdfDoc.save()
}
