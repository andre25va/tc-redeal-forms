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

export interface PageResult {
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
- "review"  = you are unsure — handwriting unclear, partially filled, ambiguous checkbox

Confidence guide (0.0–1.0):
- 1.0 = crystal clear
- 0.7–0.9 = mostly clear
- 0.5–0.7 = uncertain — use severity "review"
- < 0.5 = very unclear — still report but use severity "review"

Rules:
- Filled checkbox = checked; empty outline = unchecked. A printed checkmark ✓, filled square ■, or typed X inside a box all count as checked.
- E-sig stamp + verification code = signed; blank line = unsigned
- N/A, 0, dashes = NOT blank; truly empty lines/boxes = blank
- Do not flag unchecked checkboxes as errors unless both-option logic requires it
- If you see a visual stamp/badge with initials and date in the footer, that IS the initials — mark present: true

CRITICAL — filled_fields vs checkboxes separation:
- NEVER put checkbox lines in filled_fields. If a line contains a checkbox (checked or unchecked), it goes ONLY in the checkboxes array.
- A line starting with ☑, ✓, ■, □, or typed X followed by label text (e.g. "☑ Check/Electronic Funds Transfer/ACH") is a CHECKBOX LINE — it goes in checkboxes ONLY, never in filled_fields, never flagged blank.
- filled_fields is ONLY for actual data-entry fields: text boxes, date lines, dollar amount lines, name/address lines, blank lines labeled for typed content.
- Addenda lists (e.g. "Lead Based Paint Disclosure Addendum", "Seller\'s Disclosure") are checkboxes — put them in checkboxes, NOT filled_fields.
- Blank spacer lines between paragraphs with no field label are NOT fields — do not include them in filled_fields at all.
- Only report blank: true in filled_fields when the field has a clear label AND the value area is genuinely empty. Confidence must be >= 0.7 to report blank: true. If unsure, set blank: false.
- Do NOT flag a line as blank if it contains any checkbox, pre-printed text, or is a section header/divider.
- FILLED TEXT ON DOTTED/UNDERLINED BASELINES: Many contract fields use dotted lines or underlines as the input area. If ANY non-whitespace text appears on or immediately above that line (e.g. "Alliance Title", "John Smith", "123 Main St"), the field is FILLED — do NOT flag it blank. Confidence must be >= 0.95 before flagging a line-baseline field as blank.
- A "Deposited with:" or similar label followed by a company name, person name, or any text value on the dotted/underlined area is FILLED — never blank.`;
}

// ─── Analyze a single page with GPT-4o ────────────────────────────────────────

async function analyzePageWithGPT4o(
  pageBase64: string | null,
  pageImageBase64: string | null,
  pageNumber: number,
  totalPages: number,
  formProfile: { seller_count: number; buyer_count: number; initials_pages: number[] } | null,
  platform: EsigPlatform,
  falsePositives: string[] = []
): Promise<PageResult> {
  let prompt = buildPrompt(pageNumber, totalPages, formProfile, platform);
  if (falsePositives.length > 0) {
    prompt += `\n\nKNOWN FALSE POSITIVES — do NOT flag these as violations or blank fields:\n${falsePositives.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}`;
  }

  let response: Response;

  if (pageImageBase64) {
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
            { type: 'text', text: prompt },
          ],
        }],
        max_tokens: 2000,
      }),
    });
  } else if (pageBase64) {
    // Fallback: raw PDF bytes
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [{
          role: 'user',
          content: [
            {
              type: 'input_file',
              filename: `page_${pageNumber}.pdf`,
              file_data: `data:application/pdf;base64,${pageBase64}`,
            },
            { type: 'input_text', text: prompt },
          ],
        }],
        max_output_tokens: 2000,
      }),
    });
  } else {
    return {
      page: pageNumber, parseError: true,
      initials: {
        seller: { present: false, value: null, confidence: 0 },
        buyer:  { present: false, value: null, confidence: 0 },
      },
      signatures: [], checkboxes: [], filled_fields: [],
      compliance_flags: [{ severity: 'error', message: 'No page data provided', confidence: 1 }],
    };
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
  const raw: string = pageImageBase64
    ? (data.choices?.[0]?.message?.content ?? '')
    : (data.output?.[0]?.content?.[0]?.text ?? '');

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Fix: use == null (not !) so confidence=0 stays 0 and isn't falsely upgraded
    if (parsed.initials?.seller?.confidence == null) parsed.initials.seller.confidence = 0.9;
    if (parsed.initials?.buyer?.confidence  == null) parsed.initials.buyer.confidence  = 0.9;
    for (const s of parsed.signatures ?? [])    if (s.confidence == null) s.confidence = 0.9;
    for (const c of parsed.checkboxes ?? [])    if (c.confidence == null) c.confidence = 0.9;
    for (const f of parsed.filled_fields ?? []) if (f.confidence == null) f.confidence = 0.9;
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

// ─── Fingerprint PDF (page count → form slug) ─────────────────────────────────

async function fingerprintPdf(
  pdfBytes: Uint8Array
): Promise<{ numPages: number; matchedSlug: string; platform: EsigPlatform }> {
  const textSample = Buffer.from(pdfBytes).toString('latin1').slice(0, 50000);
  const platform = detectEsigPlatform(textSample);

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const numPages = pdfDoc.getPageCount();

  const { data: templates } = await supabase
    .from('form_templates')
    .select('slug, page_count')
    .eq('page_count', numPages)
    .limit(5);

  const matchedSlug = (templates?.length === 1) ? templates[0].slug : '';

  return { numPages, matchedSlug, platform };
}

// ─── Main route handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;

    // ── Batch mode: client sends pages in groups of 4 ─────────────────────
    const batchMode   = formData.get('batchMode') === 'true';
    const batchStart  = parseInt((formData.get('batchStart') as string) ?? '1', 10);
    const totalPages  = parseInt((formData.get('totalPages') as string) ?? '0', 10);
    let   formSlug    = (formData.get('formSlug')  as string) ?? '';
    const board       = (formData.get('board')     as string) ?? '';
    let   platform    = ((formData.get('platform') as string) ?? 'unknown') as EsigPlatform;
    let   formProfile: { seller_count: number; buyer_count: number; initials_pages: number[] } | null = null;

    const rawFormProfile = formData.get('formProfile') as string | null;
    if (rawFormProfile) {
      try { formProfile = JSON.parse(rawFormProfile); } catch {}
    }

    // ── Load known false positives for this board ─────────────────────────
    let knownFalsePositives: string[] = [];
    if (board) {
      try {
        const { data: fpRows } = await supabase
          .from('compliance_feedback')
          .select('violation_message')
          .eq('verdict', 'false_positive')
          .eq('board', board)
          .limit(50);
        if (fpRows && fpRows.length > 0) {
          // Deduplicate by message
          const seen = new Set<string>();
          for (const row of fpRows) {
            if (!seen.has(row.violation_message)) {
              seen.add(row.violation_message);
              knownFalsePositives.push(row.violation_message);
            }
          }
        }
      } catch (e) {
        console.warn('[compliance/check] false positive fetch failed:', e);
      }
    }

    // Collect page images (supports both batch keys like pageImage_5 and sequential pageImage_1)
    const pageImages: Map<number, string> = new Map();
    for (let i = 1; i <= 200; i++) {
      const img = formData.get(`pageImage_${i}`) as string | null;
      if (!img) { if (i > batchStart + 20) break; continue; }
      pageImages.set(i, img);
    }

    console.log(`[compliance/check] batchMode=${batchMode} batchStart=${batchStart} totalPages=${totalPages} images=${pageImages.size}`);

    // ── If we have a PDF, fingerprint it (first batch or non-batch mode) ───
    let numPages = totalPages;
    let pdfDoc: PDFDocument | null = null;
    let pdfBytes: Uint8Array | null = null;

    if (file) {
      const ab = await file.arrayBuffer();
      pdfBytes = new Uint8Array(ab);
      const fp = await fingerprintPdf(pdfBytes);
      numPages  = fp.numPages;
      if (!formSlug) formSlug = fp.matchedSlug;
      if (platform === 'unknown') platform = fp.platform;
      pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    }

    // ── Load formProfile if not provided ─────────────────────────────────
    if (!formProfile && formSlug) {
      const { data: profile } = await supabase
        .from('form_profiles')
        .select('seller_count, buyer_count, initials_pages')
        .eq('form_slug', formSlug)
        .single();
      if (profile) {
        formProfile = {
          seller_count:   profile.seller_count ?? 1,
          buyer_count:    profile.buyer_count  ?? 1,
          initials_pages: profile.initials_pages ?? [],
        };
      }
    }

    // ── Process the pages in this batch ──────────────────────────────────
    const pageNumbers = Array.from(pageImages.keys()).sort((a, b) => a - b);
    if (pageNumbers.length === 0 && !batchMode) {
      return NextResponse.json({ error: 'No pages to analyze' }, { status: 400 });
    }

    const pageResults = [];
    for (const pageNum of pageNumbers) {
      const pageImageBase64 = pageImages.get(pageNum) ?? null;

      // Extract single-page PDF bytes (for fallback path)
      let pageBase64: string | null = null;
      if (pdfDoc && pageNum <= numPages) {
        const singlePageDoc = await PDFDocument.create();
        const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNum - 1]);
        singlePageDoc.addPage(copiedPage);
        const pageBytesSingle = await singlePageDoc.save();
        pageBase64 = Buffer.from(pageBytesSingle).toString('base64');
      }

      const result = await analyzePageWithGPT4o(
        pageBase64,
        pageImageBase64,
        pageNum,
        numPages || totalPages,
        formProfile,
        platform,
        knownFalsePositives
      );
      pageResults.push(result);

      if (pageNumbers.indexOf(pageNum) < pageNumbers.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // ── Return batch result (client will aggregate after all batches) ─────
    if (batchMode) {
      return NextResponse.json({
        batchResult:  true,
        pageResults,
        formSlug,
        platform,
        platformLabel: PLATFORM_LABELS[platform],
        formProfile,
        totalPages: numPages || totalPages,
      });
    }

    // ── Legacy non-batch mode: run full check for backward compat ─────────
    // (used by any older callers that pass all page images at once)
    // Defer to aggregate route logic inline for full result
    return NextResponse.json({
      batchResult: true,
      pageResults,
      formSlug,
      platform,
      platformLabel: PLATFORM_LABELS[platform],
      formProfile,
      totalPages: numPages || totalPages,
    });

  } catch (err: any) {
    console.error('Compliance check error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
