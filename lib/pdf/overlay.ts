import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { PdfField } from '@/types'

/**
 * overlayFormData
 *
 * Fills a PDF template with form data.
 *
 * Strategy:
 *   1. If the PDF was "baked" (has AcroForm fields), fill text by field name.
 *   2. Checkboxes: NEVER call cb.check() — instead track positions and draw
 *      checkmarks (✓) AFTER form.flatten() so they sit on top.
 *   3. Fallback fields (not in AcroForm) get coordinate-based text drawing.
 *   4. Signatures (data-URL PNGs) are embedded as images.
 *   5. Flatten the AcroForm at the end (empty checkbox "off" state = plain box outline).
 */

/** Returns true only for explicitly affirmative values — prevents 'no'/'false' strings
 *  from being treated as truthy and incorrectly drawing a checkmark. */
function isAffirmative(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (typeof value === 'string') {
    const v = value.toLowerCase().trim()
    return v === 'true' || v === 'yes' || v === '1' || v === 'checked'
  }
  return false
}

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

  // Expand yes/no/na string values into individual _yes/_no/_na checkbox keys
  const expandedFormData = expandYesNoNa(formData, acroFieldNames)

  // Track checkbox positions for checkmark drawing (done after flatten)
  const checkedBoxes: PdfField[] = []

  // Collect signatures for image overlay (done after AcroForm fill)
  const signatureQueue: PdfField[] = []

  for (const field of fields) {
    const value = expandedFormData[field.key]
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
          // Don't call cb.check() — we draw checkmarks after flatten instead
          const cb = form.getCheckBox(field.key)
          cb.uncheck()
          // Only affirmative values draw a checkmark (yes/true/'1') —
          // 'no'/'false' strings are falsy in intent but truthy in JS, so we check explicitly
          if (isAffirmative(value)) checkedBoxes.push(field)
        } else {
          const tf = form.getTextField(field.key)
          tf.setText(formatValue(field, value))
        }
      } catch (err) {
        console.warn(`[overlay] AcroForm fill failed for "${field.key}":`, err)
      }
      continue
    }

    // ── Coordinate overlay (fallback for un-baked / missing fields) ──────────
    if (!field.x || !field.y || (field.x === 0 && field.y === 0)) continue

    const page = pages[field.page - 1]
    if (!page) continue

    if (field.type === 'checkbox') {
      if (isAffirmative(value)) checkedBoxes.push(field)
    } else {
      const fontSize = field.fontSize ?? 9
      const color    = rgb(0, 0, 0)
      const text     = formatValue(field, value)

      if (field.type === 'textarea') {
        drawWrappedText(page, text, field.x, field.y, field.width ?? 400, fontSize, font, color)
      } else {
        page.drawText(text, { x: field.x, y: field.y, size: fontSize, font, color })
      }
    }
  }

  // ── Flatten AcroForm BEFORE drawing checkmarks ────────────────────────────
  if (acroFieldNames.size > 0) {
    try {
      form.flatten()
    } catch (err) {
      console.warn('[overlay] AcroForm flatten failed:', err)
    }
  }

  // ── Draw checkmarks (✓) for all checked checkboxes ────────────────────────
  for (const field of checkedBoxes) {
    const page = pages[(field.page ?? 1) - 1]
    if (!page || !field.x || !field.y) continue

    const w   = field.width  ?? 8
    const h   = field.height ?? 8
    const cx  = field.x + w / 2
    const cy  = field.y + h / 2
    const arm = Math.min(w, h) / 2 - 1.0

    // ✓ checkmark: short left-down stroke + long right-up stroke
    // Valley point (bottom of the check)
    const vx = cx - arm * 0.1
    const vy = cy - arm * 0.55

    // Left arm: from upper-left down to valley
    page.drawLine({
      start:     { x: cx - arm * 0.65, y: cy + arm * 0.1 },
      end:       { x: vx, y: vy },
      thickness: 1.3,
      color:     rgb(0, 0, 0),
    })
    // Right arm: from valley up to upper-right
    page.drawLine({
      start:     { x: vx, y: vy },
      end:       { x: cx + arm * 0.85, y: cy + arm * 0.85 },
      thickness: 1.3,
      color:     rgb(0, 0, 0),
    })
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

  return pdfDoc.save()
}


/**
 * expandYesNoNa
 */
function expandYesNoNa(
  formData: Record<string, unknown>,
  acroFieldNames: Set<string>
): Record<string, unknown> {
  const expanded = { ...formData }
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value !== 'string') continue
    const norm = value.toLowerCase().trim()
    if (norm !== 'yes' && norm !== 'no' && norm !== 'na') continue
    const yesKey = `${key}_yes`
    const noKey  = `${key}_no`
    const naKey  = `${key}_na`
    if (acroFieldNames.has(yesKey) || acroFieldNames.has(noKey) || acroFieldNames.has(naKey)) {
      expanded[yesKey] = norm === 'yes'
      expanded[noKey]  = norm === 'no'
      if (acroFieldNames.has(naKey)) expanded[naKey] = norm === 'na'
    }
  }
  return expanded
}

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
