import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';

export const maxDuration = 60;

interface ViolationBox {
  fieldId: string;
  page: number;
  x: number; // percentage 0–100
  y: number; // percentage 0–100
  w: number; // percentage 0–100
  h: number; // percentage 0–100
  type: string;
  severity: 'error' | 'warning' | 'review';
  label?: string;
}

interface InitialsRow {
  page: number;
  seller?: string;
  buyer?: string;
  sellerOk: boolean;
  buyerOk: boolean;
}

interface EsigHash {
  signer: string;
  hash: string;
  timestamp?: string;
}

interface Violation {
  message: string;
  page: number;
  severity: 'error' | 'warning' | 'review' | 'info';
}

interface ExportBody {
  pdfBase64: string;
  formName: string;
  status: 'COMPLIANT' | 'NEEDS-REVIEW' | 'NON-COMPLIANT';
  platformLabel: string;
  summary: {
    totalPages: number;
    pagesWithBothInitials: number;
    signaturesComplete: string;
    fieldsFilled: string;
    criticalErrors: number;
    warnings?: number;
    reviewItems?: number;
  };
  violations: Violation[];
  violationBoxes: ViolationBox[];
  initialsGrid: InitialsRow[];
  esigHashes: EsigHash[];
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// Draw a wrapped text block, returns next Y
function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  font: any,
  color: { r: number; g: number; b: number },
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    const w = font.widthOfTextAtSize(test, fontSize);
    if (w > maxWidth && line) {
      page.drawText(line, { x, y: curY, size: fontSize, font, color: rgb(color.r, color.g, color.b) });
      curY -= lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x, y: curY, size: fontSize, font, color: rgb(color.r, color.g, color.b) });
    curY -= lineHeight;
  }
  return curY;
}

export async function POST(req: NextRequest) {
  try {
    const body: ExportBody = await req.json();
    const { pdfBase64, formName, status, platformLabel, summary, violations, violationBoxes, initialsGrid, esigHashes } = body;

    // ── Load original PDF ──────────────────────────────────────────────────
    const originalBytes = Buffer.from(pdfBase64, 'base64');
    const origDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });

    // ── Create output PDF ──────────────────────────────────────────────────
    const outDoc = await PDFDocument.create();
    const helvetica = await outDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await outDoc.embedFont(StandardFonts.HelveticaBold);

    // ── COVER PAGE ─────────────────────────────────────────────────────────
    const coverPage = outDoc.addPage([612, 792]); // US Letter
    const { width, height } = coverPage.getSize();
    const margin = 48;
    const contentW = width - margin * 2;
    let cy = height - margin;

    // Header bar
    const headerColor =
      status === 'COMPLIANT'    ? { r: 0.06, g: 0.63, b: 0.36 } :
      status === 'NEEDS-REVIEW' ? { r: 0.15, g: 0.39, b: 0.92 } :
                                  { r: 0.86, g: 0.15, b: 0.15 };
    coverPage.drawRectangle({ x: 0, y: height - 56, width, height: 56, color: rgb(headerColor.r, headerColor.g, headerColor.b) });

    // Title in header
    coverPage.drawText('COMPLIANCE REPORT', {
      x: margin, y: height - 36,
      size: 16, font: helveticaBold, color: rgb(1, 1, 1),
    });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const dateW = helvetica.widthOfTextAtSize(dateStr, 10);
    coverPage.drawText(dateStr, {
      x: width - margin - dateW, y: height - 32,
      size: 10, font: helvetica, color: rgb(0.9, 0.9, 0.9),
    });

    cy = height - 72;

    // Form name
    cy = drawWrappedText(coverPage, formName, margin, cy, contentW, 14, helveticaBold, { r: 0.12, g: 0.16, b: 0.24 }, 20) - 4;

    // Status badge
    const statusLabel =
      status === 'COMPLIANT'    ? '[OK]  COMPLIANT' :
      status === 'NEEDS-REVIEW' ? '[!]  NEEDS REVIEW' :
                                  '[X]  NON-COMPLIANT';
    const badgeBg =
      status === 'COMPLIANT'    ? { r: 0.94, g: 1.00, b: 0.96 } :
      status === 'NEEDS-REVIEW' ? { r: 0.94, g: 0.97, b: 1.00 } :
                                  { r: 1.00, g: 0.95, b: 0.95 };
    const badgeW = helveticaBold.widthOfTextAtSize(statusLabel, 12) + 20;
    coverPage.drawRectangle({ x: margin, y: cy - 20, width: badgeW, height: 24, color: rgb(badgeBg.r, badgeBg.g, badgeBg.b), borderColor: rgb(headerColor.r, headerColor.g, headerColor.b), borderWidth: 1 });
    coverPage.drawText(statusLabel, { x: margin + 8, y: cy - 14, size: 12, font: helveticaBold, color: rgb(headerColor.r, headerColor.g, headerColor.b) });
    cy -= 36;

    // Divider
    coverPage.drawLine({ start: { x: margin, y: cy }, end: { x: width - margin, y: cy }, thickness: 0.5, color: rgb(0.90, 0.90, 0.90) });
    cy -= 20;

    // Summary stats grid (2 columns)
    const statItems = [
      { label: 'Pages Initialed', value: `${summary.pagesWithBothInitials} / ${summary.totalPages}`, ok: summary.pagesWithBothInitials === summary.totalPages },
      { label: 'Signatures', value: summary.signaturesComplete, ok: !summary.signaturesComplete.includes('/') || summary.signaturesComplete.split('/')[0] === summary.signaturesComplete.split('/')[1] },
      { label: 'Fields Filled', value: summary.fieldsFilled, ok: summary.criticalErrors === 0 },
      { label: `${platformLabel} Hashes`, value: String(esigHashes.length), ok: esigHashes.length > 0 },
      { label: 'Critical Errors', value: String(summary.criticalErrors), ok: summary.criticalErrors === 0 },
      { label: 'Warnings', value: String(summary.warnings ?? 0), ok: (summary.warnings ?? 0) === 0 },
    ];
    const colW = (contentW - 12) / 2;
    const rowH = 42;
    statItems.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx = margin + col * (colW + 12);
      const sy = cy - row * (rowH + 6);
      const statColor = s.ok ? { r: 0.94, g: 1.00, b: 0.96 } : { r: 1.00, g: 0.95, b: 0.95 };
      const borderC = s.ok ? { r: 0.73, g: 0.97, b: 0.82 } : { r: 0.99, g: 0.75, b: 0.75 };
      const valColor = s.ok ? { r: 0.06, g: 0.63, b: 0.36 } : { r: 0.86, g: 0.15, b: 0.15 };
      coverPage.drawRectangle({ x: sx, y: sy - rowH, width: colW, height: rowH, color: rgb(statColor.r, statColor.g, statColor.b), borderColor: rgb(borderC.r, borderC.g, borderC.b), borderWidth: 0.5 });
      coverPage.drawText(s.value, { x: sx + 8, y: sy - 18, size: 16, font: helveticaBold, color: rgb(valColor.r, valColor.g, valColor.b) });
      coverPage.drawText(s.label, { x: sx + 8, y: sy - 32, size: 8, font: helvetica, color: rgb(0.50, 0.50, 0.50) });
    });
    cy -= Math.ceil(statItems.length / 2) * (rowH + 6) + 20;

    // Divider
    coverPage.drawLine({ start: { x: margin, y: cy }, end: { x: width - margin, y: cy }, thickness: 0.5, color: rgb(0.90, 0.90, 0.90) });
    cy -= 16;

    // Violations section
    const errors   = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');
    const reviews  = violations.filter(v => v.severity === 'review' || v.severity === 'info');

    if (violations.length === 0) {
      coverPage.drawText('No compliance issues found.', { x: margin, y: cy, size: 11, font: helveticaBold, color: rgb(0.06, 0.63, 0.36) });
      cy -= 20;
    } else {
      const groups = [
        { items: errors,   label: 'ERRORS',       color: { r: 0.86, g: 0.15, b: 0.15 } },
        { items: warnings, label: 'WARNINGS',      color: { r: 0.85, g: 0.47, b: 0.06 } },
        { items: reviews,  label: 'NEEDS REVIEW',  color: { r: 0.15, g: 0.39, b: 0.92 } },
      ];
      for (const g of groups) {
        if (g.items.length === 0) continue;
        if (cy < 80) break; // don't overflow off page
        coverPage.drawText(`${g.label}  (${g.items.length})`, {
          x: margin, y: cy, size: 8,
          font: helveticaBold,
          color: rgb(g.color.r, g.color.g, g.color.b),
        });
        cy -= 14;
        for (const v of g.items) {
          if (cy < 60) break;
          const bullet = `- ${v.message}  (p.${v.page})`;
          cy = drawWrappedText(coverPage, bullet, margin + 8, cy, contentW - 8, 9, helvetica, { r: 0.20, g: 0.25, b: 0.35 }, 13);
        }
        cy -= 8;
      }
    }

    // Initials grid (compact table at bottom of cover if room)
    if (initialsGrid.length > 0 && cy > 140) {
      coverPage.drawLine({ start: { x: margin, y: cy }, end: { x: width - margin, y: cy }, thickness: 0.5, color: rgb(0.90, 0.90, 0.90) });
      cy -= 14;
      coverPage.drawText('PAGE INITIALS', { x: margin, y: cy, size: 8, font: helveticaBold, color: rgb(0.40, 0.40, 0.40) });
      cy -= 12;
      for (const row of initialsGrid) {
        if (cy < 40) break;
        const sellerMark = row.sellerOk ? (row.seller ?? 'OK') : 'X';
        const buyerMark  = row.buyerOk  ? (row.buyer  ?? 'OK') : 'X';
        const sellerColor = row.sellerOk ? rgb(0.06, 0.63, 0.36) : rgb(0.86, 0.15, 0.15);
        const buyerColor  = row.buyerOk  ? rgb(0.06, 0.63, 0.36) : rgb(0.86, 0.15, 0.15);
        coverPage.drawText(`Page ${row.page}:`, { x: margin + 8, y: cy, size: 8, font: helvetica, color: rgb(0.40, 0.40, 0.40) });
        coverPage.drawText(`Seller ${sellerMark}`, { x: margin + 70, y: cy, size: 8, font: helvetica, color: sellerColor });
        coverPage.drawText(`Buyer ${buyerMark}`,   { x: margin + 130, y: cy, size: 8, font: helvetica, color: buyerColor });
        cy -= 12;
      }
    }

    // Footer
    coverPage.drawLine({ start: { x: margin, y: 36 }, end: { x: width - margin, y: 36 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    coverPage.drawText('Generated by myredeal compliance · tc-redeal-forms.vercel.app', {
      x: margin, y: 20, size: 7, font: helvetica, color: rgb(0.65, 0.65, 0.65),
    });

    // ── COPY ORIGINAL PAGES + DRAW VIOLATION BOXES ────────────────────────
    const origPages = origDoc.getPages();
    const copiedPages = await outDoc.copyPages(origDoc, origPages.map((_, i) => i));

    for (let i = 0; i < copiedPages.length; i++) {
      const page = outDoc.addPage(copiedPages[i]);
      const { width: pw, height: ph } = page.getSize();

      // Find boxes for this page (page numbers are 1-indexed)
      const pageBoxes = violationBoxes.filter(b => b.page === i + 1);
      for (const box of pageBoxes) {
        const bx = clamp(box.x / 100, 0, 1) * pw;
        const bw = clamp(box.w / 100, 0, 1) * pw;
        const bh = clamp(box.h / 100, 0, 1) * ph;
        // PDF y=0 is bottom; box.y is from top
        const by = ph - clamp(box.y / 100, 0, 1) * ph - bh;

        const borderColor =
          box.severity === 'error'   ? rgb(0.93, 0.27, 0.27) :
          box.severity === 'warning' ? rgb(0.96, 0.62, 0.07) :
                                       rgb(0.22, 0.52, 0.96);

        // Semi-transparent fill
        const fillColor =
          box.severity === 'error'   ? rgb(1, 0.92, 0.92) :
          box.severity === 'warning' ? rgb(1, 0.98, 0.90) :
                                       rgb(0.93, 0.96, 1.00);

        page.drawRectangle({ x: bx, y: by, width: bw, height: Math.max(bh, 8), color: fillColor, borderColor, borderWidth: 1.5, opacity: 0.6, borderOpacity: 1 });

        // Badge label
        const badge =
          box.type === 'initial'   ? (box.severity === 'error' ? 'INIT' : 'INIT?') :
          box.type === 'signature' ? 'SIG' :
          box.severity === 'error' ? 'ERR' :
          box.severity === 'review' ? 'REV' : 'WARN';
        const badgeFontSize = 5.5;
        const badgeTextW = helveticaBold.widthOfTextAtSize(badge, badgeFontSize) + 4;
        page.drawRectangle({ x: bx, y: by + Math.max(bh, 8) - 8, width: badgeTextW, height: 8, color: borderColor });
        page.drawText(badge, { x: bx + 2, y: by + Math.max(bh, 8) - 6, size: badgeFontSize, font: helveticaBold, color: rgb(1, 1, 1) });
      }
    }

    // ── Serialize and return ───────────────────────────────────────────────
    const pdfBytes = await outDoc.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compliance-report.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('[compliance/export] error:', err);
    return NextResponse.json({ error: String(err.message ?? err) }, { status: 500 });
  }
}
