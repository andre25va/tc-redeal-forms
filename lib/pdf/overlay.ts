import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { PdfField } from '@/types'

export async function overlayFormData(
  pdfBytes: Uint8Array,
  formData: Record<string, unknown>,
  fields: PdfField[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  for (const field of fields) {
    const value = formData[field.key]
    if (!value || field.x === 0 || field.y === 0) continue

    const page = pages[field.page - 1]
    if (!page) continue

    const fontSize = field.fontSize || 10
    const color = rgb(0, 0, 0)

    if (field.type === 'text' || field.type === 'date') {
      page.drawText(String(value), {
        x: field.x,
        y: field.y,
        size: fontSize,
        font,
        color,
      })
    } else if (field.type === 'textarea') {
      const text = String(value)
      const maxWidth = field.width || 400
      const lineHeight = fontSize * 1.4
      const words = text.split(' ')
      const lines: string[] = []
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const textWidth = font.widthOfTextAtSize(testLine, fontSize)
        if (textWidth > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) lines.push(currentLine)

      lines.forEach((line, i) => {
        page.drawText(line, {
          x: field.x,
          y: field.y - (i * lineHeight),
          size: fontSize,
          font,
          color,
        })
      })
    } else if (field.type === 'choice' || field.type === 'fixture_status') {
      page.drawText(String(value).toUpperCase(), {
        x: field.x,
        y: field.y,
        size: fontSize,
        font,
        color,
      })
    } else if (field.type === 'signature' && typeof value === 'string' && value.startsWith('data:image')) {
      try {
        const base64 = value.split(',')[1]
        const imageBytes = Buffer.from(base64, 'base64')
        const image = await pdfDoc.embedPng(imageBytes)
        const imgWidth = field.width || 150
        const imgHeight = 40
        page.drawImage(image, {
          x: field.x,
          y: field.y,
          width: imgWidth,
          height: imgHeight,
        })
      } catch (e) {
        // Skip if signature fails
      }
    }
  }

  return await pdfDoc.save()
}

// Generate a clean summary PDF when no template is available
export async function generateSummaryPdf(
  formData: Record<string, unknown>,
  fields: PdfField[],
  propertyAddress: string,
  sellerName: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage([612, 792])
  const { width, height } = page.getSize()
  let y = height - 50
  const margin = 50
  const lineHeight = 18
  const sectionSpacing = 12

  const ensureSpace = (neededY: number) => {
    if (neededY < 60) {
      page = pdfDoc.addPage([612, 792])
      y = height - 50
    }
  }

  const addText = (text: string, x: number, currentY: number, size: number, isBold = false) => {
    ensureSpace(currentY)
    page.drawText(text, {
      x,
      y: currentY,
      size,
      font: isBold ? boldFont : font,
      color: rgb(0, 0, 0),
    })
    return currentY
  }

  // Header
  addText('SELLER DISCLOSURE ADDENDUM', margin, y, 16, true)
  y -= lineHeight * 1.5
  addText(`Property: ${propertyAddress}`, margin, y, 11)
  y -= lineHeight
  addText(`Seller: ${sellerName}`, margin, y, 11)
  y -= lineHeight
  addText(`Date: ${new Date().toLocaleDateString()}`, margin, y, 11)
  y -= lineHeight * 2

  // Draw separator line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  })
  y -= lineHeight * 1.5

  // Group fields by section
  const sectionMap = new Map<string, PdfField[]>()
  for (const field of fields) {
    const sectionFields = sectionMap.get(field.section) || []
    sectionFields.push(field)
    sectionMap.set(field.section, sectionFields)
  }

  const sectionTitles: Record<string, string> = {
    seller_property: 'Seller & Property Information',
    occupancy: 'Occupancy',
    construction: 'Construction',
    land: 'Land',
    roof: 'Roof',
    plumbing: 'Plumbing',
    hvac: 'HVAC',
    electrical: 'Electrical',
    tax_hoa: 'Tax & HOA',
    utilities: 'Utilities',
    electronics: 'Electronic Systems',
    fixtures: 'Fixtures & Appliances',
    final: 'Material Information',
    signatures: 'Signatures',
  }

  for (const [sectionId, sectionFields] of sectionMap) {
    ensureSpace(y - 60)

    addText(sectionTitles[sectionId] || sectionId, margin, y, 12, true)
    y -= lineHeight * 1.2

    for (const field of sectionFields) {
      const value = formData[field.key]
      if (value === undefined || value === null || value === '') continue
      if (field.type === 'signature') continue // skip signatures in summary

      ensureSpace(y - 40)

      const displayValue = String(value)
      const labelText = `${field.label}:`

      addText(labelText, margin, y, 9, true)

      // Handle long values
      if (displayValue.length > 60) {
        y -= lineHeight * 0.8
        const words = displayValue.split(' ')
        const lines: string[] = []
        let currentLine = ''
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word
          if (testLine.length > 80 && currentLine) {
            lines.push(currentLine)
            currentLine = word
          } else {
            currentLine = testLine
          }
        }
        if (currentLine) lines.push(currentLine)

        for (const line of lines) {
          ensureSpace(y - 20)
          addText(`  ${line}`, margin, y, 9)
          y -= lineHeight * 0.9
        }
      } else {
        addText(displayValue, 250, y, 9)
        y -= lineHeight
      }
    }

    y -= sectionSpacing
  }

  return await pdfDoc.save()
}
