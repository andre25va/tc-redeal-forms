import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';

export const runtime = 'nodejs';
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── E-signature platform detection ──────────────────────────────────────────

export type EsigPlatform = 'dotloop' | 'docusign' | 'hellosign' | 'adobe-sign' | 'unknown';

function detectEsigPlatform(textSample: string): EsigPlatform {
  const t = textSample.toLowerCase();
  if (t.includes('dtlp.us') || t.includes('dotloop')) return 'dotloop';
  if (t.includes('docusign.net') || t.includes('docusign')) return 'docusign';
  if (t.includes('hellosign.com') || t.includes('dropboxsign.com')) return 'hellosign';
  if (t.includes('adobesign.com') || t.includes('echosign.com')) return 'adobe-sign';
  return 'unknown';
}

const PLATFORM_LABELS: Record<EsigPlatform, string> = {
  dotloop:      'Dotloop',
  docusign:     'DocuSign',
  hellosign:    'HelloSign / Dropbox Sign',
  'adobe-sign': 'Adobe Sign',
  unknown:      'E-Signature',
};

function platformHashHint(platform: EsigPlatform): string {
  switch (platform) {
    case 'dotloop':    return 'Dotloop verification hashes look like: dtlp.us/XXXX-XXXX-XXXX';
    case 'docusign':   return 'DocuSign verification includes an envelope ID (UUID format) and/or a docusign.net URL';
    case 'hellosign':  return 'HelloSign/Dropbox Sign includes a hellosign.com or dropboxsign.com URL';
    case 'adobe-sign': return 'Adobe Sign includes an adobesign.com or echosign.com URL';
    default:           return 'Look for any verification URL, hash, or code stamped near the signature block';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'error' | 'warning' | 'review';

interface PageResult {
  page: number;
  initials: {
    seller: { present: boolean; value: string | null; confidence: number };
    buyer:  { present: boolean; value: string | null; confidence: number };
  };
  signatures: Array<{
    label: string;
    signer: string | null;
    signed: boolean;
    timestamp: string | null;
    esig_hash: string | null;
    confidence: number;
  }>;
  checkboxes: Array<{ label: string; checked: boolean; confidence: number }>;
  filled_fields: Array<{ label: string; value: string; blank: boolean; confidence: number }>;
  compliance_flags: Array<{ severity: Severity; message: string; confidence: number }>;
  parseError?: boolean;
}

interface Violation {
  page: number;
  message: string;
  severity: Severity;
}

interface ViolationBox {
  fieldId: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  severity: Severity;
  type: string;
  label: string;
}

interface FieldCoord {
  field_key: string;
  page_num: number;
  x: number;
  y: number;
  width: number;
  height: number;
  field_type: string;
  is_signature: boolean;
  is_initial: boolean;
}

const PAGE_W = 612;
const PAGE_H = 792;

// Confidence threshold — below this, downgrade to 'review' instead of error/warning
const REVIEW_THRESHOLD = 0.70;

function toSeverity(rawSeverity: string, confidence: number): Severity {
  if (confidence < REVIEW_THRESHOLD) return 'review';
  if (rawSeverity === 'error') return 'error';
  if (rawSeverity === 'warning') return 'warning';
  if (rawSeverity === 'review') return 'review';
  return 'warning';
}

// ─── Build GPT prompt ─────────────────────────────────────────────────────────

function buildPrompt(
  pageNumber: number,
  totalPages: number,
  formProfile: { seller_count: number; buyer_count: number; initials_pages: number[] } | null,
  platform: EsigPlatform
): string {
  const initialsRequired = formProfile?.initials_pages?.includes(pageNumber) ?? true;
  const sellerCount = formProfile?.seller_count ?? 1;
  const buyerCount  = formProfile?.buyer_count  ?? 1;
  const platformLabel = PLATFORM_LABELS[platform];
  const hashHint = platformHashHint(platform);

  return `You are a real estate contract compliance checker analyzing page ${pageNumber} of ${totalPages}.

This PDF was electronically signed via ${platformLabel}.
${hashHint}

IMPORTANT: Initial stamps from ${platformLabel} are often rasterized IMAGE overlays baked into the page — they appear as small boxes or badges with initials and a date stamp (e.g. "B 05/14/25" or "MB" with a date). Look carefully at the VISUAL content of the entire page, especially the footer/margin areas, for any stamp-like visual element containing initials.

${initialsRequired
  ? `INITIALS REQUIRED: Look for ${sellerCount} seller and ${buyerCount} buyer initial stamp(s), typically in the footer or bottom margin. These may appear as image overlays with a colored border, initials text, and a date.`
  : `Initials are NOT required on this page.`}

Return ONLY valid JSON, no markdown fences:

{
  "page": ${pageNumber},
  "initials": {
    "seller": { "present": boolean, "value": "initials or null", "confidence": 0.0-1.0 },
    "buyer":  { "present": boolean, "value": "initials or null", "confidence": 0.0-1.0 }
  },
  "signatures": [
    {
      "label": "description",
      "signer": "name or null",
      "signed": boolean,
      "timestamp": "string or null",
      "esig_hash": "verification code/URL or null",
      "confidence": 0.0-1.0
    }
  ],
  "checkboxes": [
    { "label": "text", "checked": boolean, "confidence": 0.0-1.0 }
  ],
  "filled_fields": [
    { "label": "field label", "value": "value or empty", "blank": boolean, "confidence": 0.0-1.0 }
  ],
  "compliance_flags": [
    { "severity": "error|warning|review", "message": "description", "confidence": 0.0-1.0 }
  ]
}

Severity guide:
- "error"   = definite violation (missing required sig/initials, unsigned block)
- "warning" = soft issue (optional blank, unusual value)
- "review"  = you are unsure — handwriting unclear, partially filled, ambiguous checkbox, value hard to read

Confidence guide (0.0–1.0):
- 1.0 = crystal clear, no ambiguity
- 0.7–0.9 = mostly clear, minor uncertainty
- 0.5–0.7 = uncertain — use severity "review"
- < 0.5 = very unclear — still report but use severity "review"

Rules:
- Filled checkbox (darkened/checked box) = checked; empty outline = unchecked
- E-sig stamp + verification code = signed; blank line = unsigned
- N/A, 0, dashes = NOT blank; truly empty lines/boxes = blank
- Do not flag unchecked checkboxes as errors unless both-option logic requires it
- If you see a visual stamp/badge with initials and date in the footer, that IS the initials — mark present: true`;
}

// ─── Analyze a single page with GPT-4o (image-based) ─────────────────────────

async function analyzePageWithGPT4o(
  pageBase64: string,          // PDF page bytes (base64) — fallback only
  pageImageBase64: string | null, // JPEG image (base64) — preferred; sees rasterized stamps
  pageNumber: number,
  totalPages: number,
  formProfile: { seller_count: number; buyer_count: number; initials_pages: number[] } | null,
  platform: EsigPlatform
): Promise<PageResult> {
  const prompt = buildPrompt(pageNumber, totalPages, formProfile, platform);

  let response: Response;

  if (pageImageBase64) {
    // ── Preferred path: send rendered JPEG → GPT-4o sees all visual content ──
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${pageImageBase64}`,
                detail: 'high',
              },
            },
            { type: 'input_text', text: prompt },
          ],
        }],
        max_tokens: 2000,
      }),
    });
  } else {
    // ── Fallback: raw PDF bytes via Responses API ─────────────────────────────
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                filename: `page_${pageNumber}.pdf`,
                file_data: `data:application/pdf;base64,${pageBase64}`,
              },
              { type: 'input_text', text: prompt },
            ],
          },
        ],
        max_output_tokens: 2000,
      }),
    });
  }

  if (!response.ok) {
    const err = await response.text();
    console.error(`GPT-4o error on page ${pageNumber}:`, err);
    return {
      page: pageNumber, parseError: true,
      initials: {
        seller: { present: false, value: null, confidence: 0 },
        buyer:  { present: false, value: null, confidence: 0 },
      },
      signatures: [], checkboxes: [], filled_fields: [],
      compliance_flags: [{ severity: 'error', message: `GPT-4o API error: ${err.slice(0, 100)}`, confidence: 1 }],
    };
  }

  const data = await response.json();

  // Extract text depending on which API was used
  const raw: string = pageImageBase64
    ? (data.choices?.[0]?.message?.content ?? '')
    : (data.output?.[0]?.content?.[0]?.text ?? '');

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Fix: use == null (not falsy !) so confidence=0 stays as 0 and doesn't
    // bypass the REVIEW_THRESHOLD check — this was the false-positive root cause
    if (parsed.initials?.seller?.confidence == null) parsed.initials.seller.confidence = 0.9;
    if (parsed.initials?.buyer?.confidence  == null) parsed.initials.buyer.confidence  = 0.9;
    for (const s of parsed.signatures ?? [])     if (s.confidence == null) s.confidence = 0.9;
    for (const c of parsed.checkboxes ?? [])     if (c.confidence == null) c.confidence = 0.9;
    for (const f of parsed.filled_fields ?? [])  if (f.confidence == null) f.confidence = 0.9;
    for (const flag of parsed.compliance_flags ?? []) if (flag.confidence == null) flag.confidence = 0.9;

    return parsed as PageResult;
  } catch (e) {
    console.error(`JSON parse error on page ${pageNumber}:`, e, '\nRaw:', raw.slice(0, 300));
    return {
      page: pageNumber, parseError: true,
      initials: {
        seller: { present: false, value: null, confidence: 0 },
        buyer:  { present: false, value: null, confidence: 0 },
      },
      signatures: [], checkboxes: [], filled_fields: [],
      compliance_flags: [{ severity: 'error', message: 'Failed to parse AI response', confidence: 1 }],
    };
  }
}

// ─── Aggregate results ────────────────────────────────────────────────────────

function aggregateResults(
  pageResults: PageResult[],
  matchedSlug: string,
  initialsPages: number[],
  platform: EsigPlatform
) {
  const errors:   Violation[] = [];
  const warnings: Violation[] = [];
  const reviews:  Violation[] = [];

  let totalSigs = 0, signedSigs = 0;
  let totalFields = 0, blankFields = 0;
  let totalBoxes = 0, checkedBoxes = 0;

  const esigHashes: Array<{ signer: string; hash: string; timestamp: string }> = [];
  const initialsGrid: Array<{
    page: number; seller: string | null; buyer: string | null;
    sellerOk: boolean; buyerOk: boolean;
    sellerReview: boolean; buyerReview: boolean;
  }> = [];

  for (const page of pageResults) {
    if (page.parseError) {
      errors.push({ page: page.page, message: 'AI analysis failed for this page', severity: 'error' });
      continue;
    }

    const needsInitials = initialsPages.length === 0 || initialsPages.includes(page.page);

    const sellerSev = toSeverity('error', page.initials.seller.confidence);
    const buyerSev  = toSeverity('error', page.initials.buyer.confidence);
    initialsGrid.push({
      page:         page.page,
      seller:       page.initials.seller.value,
      buyer:        page.initials.buyer.value,
      sellerOk:     !needsInitials || page.initials.seller.present,
      buyerOk:      !needsInitials || page.initials.buyer.present,
      sellerReview: sellerSev === 'review',
      buyerReview:  buyerSev  === 'review',
    });

    if (needsInitials && !page.initials.seller.present) {
      const list = sellerSev === 'review' ? reviews : errors;
      list.push({ page: page.page, message: 'Seller initials missing', severity: sellerSev });
    }
    if (needsInitials && !page.initials.buyer.present) {
      const list = buyerSev === 'review' ? reviews : errors;
      list.push({ page: page.page, message: 'Buyer initials missing', severity: buyerSev });
    }

    for (const sig of page.signatures) {
      totalSigs++;
      if (sig.signed) {
        signedSigs++;
        if (sig.esig_hash) {
          esigHashes.push({
            signer:    sig.signer ?? sig.label,
            hash:      sig.esig_hash,
            timestamp: sig.timestamp ?? '',
          });
        }
      } else {
        const sev = toSeverity('error', sig.confidence);
        const list = sev === 'review' ? reviews : errors;
        list.push({ page: page.page, message: `Unsigned: "${sig.label}"`, severity: sev });
      }
    }

    totalBoxes   += page.checkboxes.length;
    checkedBoxes += page.checkboxes.filter(c => c.checked).length;

    for (const field of page.filled_fields) {
      totalFields++;
      if (field.blank) {
        blankFields++;
        const sev = toSeverity('warning', field.confidence);
        const list = sev === 'review' ? reviews : warnings;
        list.push({ page: page.page, message: `Blank field: "${field.label}"`, severity: sev });
      }
    }

    for (const flag of page.compliance_flags) {
      const sev = toSeverity(flag.severity, flag.confidence);
      const list = sev === 'error' ? errors : sev === 'review' ? reviews : warnings;
      list.push({ page: page.page, message: flag.message, severity: sev });
    }
  }

  const isCompliant = errors.length === 0;

  return {
    status: isCompliant ? (reviews.length > 0 ? 'NEEDS-REVIEW' : 'COMPLIANT') : 'NON-COMPLIANT',
    method: 'vision-per-page-gpt4o',
    platform,
    platformLabel: PLATFORM_LABELS[platform],
    summary: {
      totalPages:              pageResults.length,
      pagesWithBothInitials:   initialsGrid.filter(r => r.sellerOk && r.buyerOk).length,
      signaturesComplete:      `${signedSigs}/${totalSigs}`,
      checkboxesFilled:        `${checkedBoxes}/${totalBoxes}`,
      fieldsFilled:            `${totalFields - blankFields}/${totalFields}`,
      criticalErrors:          errors.length,
      warnings:                warnings.length,
      reviewItems:             reviews.length,
      esigHashes,
    },
    initialsGrid,
    violations: [...errors, ...warnings, ...reviews],
    pages: pageResults,
  };
}

// ─── Map violations → coordinate boxes ───────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchViolationsToCoords(
  violations: Violation[],
  coordsByPage: Record<number, FieldCoord[]>
): ViolationBox[] {
  const boxes: ViolationBox[] = [];
  const usedKeys = new Set<string>();

  for (const v of violations) {
    const pageCoords = coordsByPage[v.page] ?? [];
    let matched: FieldCoord | null = null;
    let shortLabel = '';

    if (v.message === 'Seller initials missing' || v.message === 'Buyer initials missing') {
      const isSeller = v.message.startsWith('Seller');
      shortLabel = isSeller ? 'INIT-S' : 'INIT-B';
      matched = pageCoords.find(c =>
        (c.is_initial || c.field_type === 'initial') &&
        c.field_key.includes(isSeller ? 'seller' : 'buyer') &&
        !usedKeys.has(c.field_key)
      ) ?? pageCoords.find(c =>
        (c.is_initial || c.field_type === 'initial') && !usedKeys.has(c.field_key)
      ) ?? null;

    } else if (v.message.startsWith('Unsigned:')) {
      shortLabel = v.severity === 'review' ? 'SIG?' : 'SIG';
      const sigLabel = (v.message.match(/Unsigned: "(.+?)"/) ?? [])[1] ?? '';
      const sigNorm = normalize(sigLabel);
      let best: FieldCoord | null = null;
      let bestScore = 0;
      for (const c of pageCoords) {
        if (!(c.is_signature || c.field_type === 'signature')) continue;
        if (usedKeys.has(c.field_key)) continue;
        const keyNorm = normalize(c.field_key);
        let score = 0;
        if (sigNorm && keyNorm.includes(sigNorm.slice(0, 4))) score += 2;
        if (sigNorm.includes('seller') && keyNorm.includes('seller')) score += 3;
        if (sigNorm.includes('buyer') && keyNorm.includes('buyer')) score += 3;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (!best) best = pageCoords.find(c => (c.is_signature || c.field_type === 'signature') && !usedKeys.has(c.field_key)) ?? null;
      matched = best;

    } else if (v.message.startsWith('Blank field:')) {
      shortLabel = v.severity === 'review' ? 'BLANK?' : 'BLANK';
      const rawLabel = (v.message.match(/Blank field: "(.+?)"/) ?? [])[1] ?? '';
      const labelNorm = normalize(rawLabel);
      let best: FieldCoord | null = null;
      let bestScore = 0;
      for (const c of pageCoords) {
        if (c.is_signature || c.is_initial || c.field_type === 'signature' || c.field_type === 'initial') continue;
        if (usedKeys.has(c.field_key)) continue;
        const keyNorm = normalize(c.field_key);
        let score = 0;
        if (labelNorm.length >= 3 && keyNorm.includes(labelNorm.slice(0, Math.min(6, labelNorm.length)))) score += labelNorm.length;
        if (keyNorm.length >= 3 && labelNorm.includes(keyNorm.slice(0, Math.min(6, keyNorm.length)))) score += keyNorm.length;
        const words = rawLabel.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
        for (const word of words) {
          if (keyNorm.includes(normalize(word))) score += word.length;
        }
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (bestScore >= 3) matched = best;

    } else {
      shortLabel = v.severity === 'error' ? 'ERR' : v.severity === 'review' ? 'REVIEW' : 'WARN';
    }

    if (matched) {
      usedKeys.add(matched.field_key);
      boxes.push({
        fieldId:  matched.field_key,
        page:     v.page,
        x:        (matched.x / PAGE_W) * 100,
        y:        (matched.y / PAGE_H) * 100,
        w:        (matched.width / PAGE_W) * 100,
        h:        Math.max(matched.height / PAGE_H * 100, 1.5),
        severity: v.severity,
        type:     matched.field_type,
        label:    shortLabel,
      });
    }
  }

  return boxes;
}

// ─── Main route ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    const formSlug = (formData.get('formSlug') as string) || '';

    if (!file) return NextResponse.json({ error: 'No PDF uploaded' }, { status: 400 });

    // ── Collect pre-rendered page images from client (if sent) ───────────────
    // Client renders pages with pdf.js → JPEG base64 → pageImage_1, pageImage_2, ...
    // This lets GPT-4o see rasterized XObjects (Dotloop/DocuSign stamp images)
    // that are invisible when sending raw PDF bytes via input_file.
    const pageImages: Map<number, string> = new Map();
    for (let i = 1; i <= 50; i++) {
      const img = formData.get(`pageImage_${i}`) as string | null;
      if (!img) break;
      pageImages.set(i, img);
    }
    const hasPageImages = pageImages.size > 0;
    console.log(`[compliance/check] Received ${pageImages.size} pre-rendered page images`);

    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);

    const textSample = Buffer.from(pdfBytes).toString('latin1').slice(0, 50000);
    const platform = detectEsigPlatform(textSample);

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const numPages = pdfDoc.getPageCount();

    let matchedSlug = formSlug;
    if (!matchedSlug) {
      const { data: templates } = await supabase
        .from('form_templates')
        .select('slug, page_count')
        .eq('page_count', numPages)
        .limit(5);
      if (templates && templates.length === 1) matchedSlug = templates[0].slug;
    }

    let formProfile: { seller_count: number; buyer_count: number; initials_pages: number[] } | null = null;
    if (matchedSlug) {
      const { data: profile } = await supabase
        .from('form_profiles')
        .select('seller_count, buyer_count, initials_pages')
        .eq('form_slug', matchedSlug)
        .single();
      if (profile) {
        formProfile = {
          seller_count:   profile.seller_count ?? 1,
          buyer_count:    profile.buyer_count  ?? 1,
          initials_pages: profile.initials_pages ?? [],
        };
      }
    }

    const coordsByPage: Record<number, FieldCoord[]> = {};
    if (matchedSlug) {
      const { data: coords } = await supabase
        .from('field_coordinates')
        .select('field_key, page_num, x, y, width, height, field_type, is_signature, is_initial')
        .eq('form_slug', matchedSlug);
      if (coords) {
        for (const c of coords) {
          if (!coordsByPage[c.page_num]) coordsByPage[c.page_num] = [];
          coordsByPage[c.page_num].push(c as FieldCoord);
        }
      }
    }

    const initialsPages: number[] = formProfile?.initials_pages ?? [];

    const pageResults: PageResult[] = [];
    for (let i = 0; i < numPages; i++) {
      // Extract single page as PDF bytes (fallback path)
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const pageBytes = await singlePageDoc.save();
      const pageBase64 = Buffer.from(pageBytes).toString('base64');

      // Use pre-rendered JPEG if client sent it (preferred: GPT sees visual stamps)
      const pageImageBase64 = pageImages.get(i + 1) ?? null;

      const result = await analyzePageWithGPT4o(
        pageBase64,
        pageImageBase64,
        i + 1,
        numPages,
        formProfile,
        platform
      );
      pageResults.push(result);

      if (i < numPages - 1) await new Promise(r => setTimeout(r, 300));
    }

    const report = aggregateResults(pageResults, matchedSlug, initialsPages, platform);

    const violationBoxes = Object.keys(coordsByPage).length > 0
      ? matchViolationsToCoords(report.violations, coordsByPage)
      : [];

    return NextResponse.json({
      ...report,
      formSlug: matchedSlug,
      numPages,
      violationBoxes,
      hasCoordinates: Object.keys(coordsByPage).length > 0,
      isDotloop: platform === 'dotloop',
      usedPageImages: hasPageImages,
    });

  } catch (err: any) {
    console.error('Compliance check error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
