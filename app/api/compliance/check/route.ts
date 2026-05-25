import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — 16 pages × ~10s each

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
    case 'hellosign':  return 'HelloSign/Dropbox Sign verification includes a hellosign.com or dropboxsign.com URL';
    case 'adobe-sign': return 'Adobe Sign verification includes an adobesign.com or echosign.com URL';
    default:           return 'Look for any verification URL, hash, or code stamped near the signature block by the e-signature platform';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageResult {
  page: number;
  initials: {
    seller: { present: boolean; value: string | null };
    buyer:  { present: boolean; value: string | null };
  };
  signatures: Array<{
    label: string;
    signer: string | null;
    signed: boolean;
    timestamp: string | null;
    esig_hash: string | null;
  }>;
  checkboxes: Array<{ label: string; checked: boolean }>;
  filled_fields: Array<{ label: string; value: string; blank: boolean }>;
  compliance_flags: Array<{ severity: 'error' | 'warning' | 'info'; message: string }>;
  parseError?: boolean;
}

interface Violation {
  page: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ViolationBox {
  fieldId: string;
  page: number;
  x: number;  // % of page width
  y: number;  // % of page height (y=0 at top)
  w: number;
  h: number;
  severity: 'error' | 'warning' | 'info';
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

// Standard US Letter page dimensions in PDF points (72 dpi)
const PAGE_W = 612;
const PAGE_H = 792;

// ─── Analyze a single page PDF with GPT-4o ────────────────────────────────────

async function analyzePageWithGPT4o(
  pageBase64: string,
  pageNumber: number,
  totalPages: number,
  formProfile: { seller_count: number; buyer_count: number; initials_pages: number[] } | null,
  platform: EsigPlatform
): Promise<PageResult> {
  const initialsRequired = formProfile?.initials_pages?.includes(pageNumber) ?? true;
  const sellerCount = formProfile?.seller_count ?? 1;
  const buyerCount  = formProfile?.buyer_count  ?? 1;
  const platformLabel = PLATFORM_LABELS[platform];
  const hashHint = platformHashHint(platform);

  const prompt = `You are a real estate contract compliance checker analyzing page ${pageNumber} of ${totalPages}.

This is an electronically signed PDF processed through ${platformLabel}.
${platformLabel} overlays signature/initial stamps and verification codes on top of the base PDF.
${hashHint}

${initialsRequired
  ? `INITIALS REQUIRED ON THIS PAGE: Look for ${sellerCount} seller initial(s) and ${buyerCount} buyer initial(s). They appear as small stamped boxes, typically in the bottom margin or footer.`
  : `Initials are NOT required on this page.`}

Return ONLY valid JSON, no markdown fences, no explanation:

{
  "page": ${pageNumber},
  "initials": {
    "seller": { "present": boolean, "value": "initials string or null" },
    "buyer":  { "present": boolean, "value": "initials string or null" }
  },
  "signatures": [
    {
      "label": "description of signature block",
      "signer": "name or null",
      "signed": boolean,
      "timestamp": "timestamp string or null",
      "esig_hash": "verification hash/URL/code or null"
    }
  ],
  "checkboxes": [
    { "label": "checkbox label text", "checked": boolean }
  ],
  "filled_fields": [
    { "label": "field label", "value": "filled value or empty string", "blank": boolean }
  ],
  "compliance_flags": [
    { "severity": "error | warning | info", "message": "description" }
  ]
}

Rules:
- For checkboxes: look at the visual image carefully — a filled/darkened box is checked, empty outline is unchecked
- For signatures: an e-signature stamp with a verification hash/code = signed; blank line = unsigned
- For fields: any value including "N/A", "0", dashes = NOT blank; only truly empty = blank
- Flag missing initials as "error", blank optional fields as "warning"
- Do not flag unchecked checkboxes as errors unless the contract logic requires one of a pair to be checked`;

  const response = await fetch('https://api.openai.com/v1/responses', {
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

  if (!response.ok) {
    const err = await response.text();
    console.error(`GPT-4o error on page ${pageNumber}:`, err);
    return {
      page: pageNumber, parseError: true,
      initials: { seller: { present: false, value: null }, buyer: { present: false, value: null } },
      signatures: [], checkboxes: [], filled_fields: [],
      compliance_flags: [{ severity: 'error', message: `GPT-4o API error: ${err.slice(0, 100)}` }],
    };
  }

  const data = await response.json();
  const raw: string = data.output?.[0]?.content?.[0]?.text ?? '';

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error(`JSON parse error on page ${pageNumber}:`, e, '\nRaw:', raw.slice(0, 300));
    return {
      page: pageNumber, parseError: true,
      initials: { seller: { present: false, value: null }, buyer: { present: false, value: null } },
      signatures: [], checkboxes: [], filled_fields: [],
      compliance_flags: [{ severity: 'error', message: 'Failed to parse AI response' }],
    };
  }
}

// ─── Aggregate results across all pages ──────────────────────────────────────

function aggregateResults(
  pageResults: PageResult[],
  matchedSlug: string,
  initialsPages: number[],
  platform: EsigPlatform
) {
  const errors:   Violation[] = [];
  const warnings: Violation[] = [];

  let totalSigs = 0, signedSigs = 0;
  let totalFields = 0, blankFields = 0;
  let totalBoxes = 0, checkedBoxes = 0;

  const esigHashes: Array<{ signer: string; hash: string; timestamp: string }> = [];
  const initialsGrid: Array<{
    page: number; seller: string | null; buyer: string | null;
    sellerOk: boolean; buyerOk: boolean;
  }> = [];

  for (const page of pageResults) {
    if (page.parseError) {
      errors.push({ page: page.page, message: 'AI analysis failed for this page', severity: 'error' });
      continue;
    }

    // Initials
    const needsInitials = initialsPages.length === 0 || initialsPages.includes(page.page);
    initialsGrid.push({
      page: page.page,
      seller: page.initials.seller.value,
      buyer:  page.initials.buyer.value,
      sellerOk: !needsInitials || page.initials.seller.present,
      buyerOk:  !needsInitials || page.initials.buyer.present,
    });
    if (needsInitials && !page.initials.seller.present)
      errors.push({ page: page.page, message: 'Seller initials missing', severity: 'error' });
    if (needsInitials && !page.initials.buyer.present)
      errors.push({ page: page.page, message: 'Buyer initials missing', severity: 'error' });

    // Signatures
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
        errors.push({ page: page.page, message: `Unsigned: "${sig.label}"`, severity: 'error' });
      }
    }

    // Checkboxes
    totalBoxes   += page.checkboxes.length;
    checkedBoxes += page.checkboxes.filter(c => c.checked).length;

    // Fields
    for (const field of page.filled_fields) {
      totalFields++;
      if (field.blank) {
        blankFields++;
        warnings.push({ page: page.page, message: `Blank field: "${field.label}"`, severity: 'warning' });
      }
    }

    // AI flags
    for (const flag of page.compliance_flags) {
      const list = flag.severity === 'error' ? errors : warnings;
      list.push({ page: page.page, message: flag.message, severity: flag.severity });
    }
  }

  const isCompliant = errors.length === 0;

  return {
    status: isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT',
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
      esigHashes,
    },
    initialsGrid,
    violations: [...errors, ...warnings],
    pages: pageResults,
  };
}

// ─── Coordinate matching — map violations → red boxes on PDF ─────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchViolationsToCoords(
  violations: Violation[],
  coordsByPage: Record<number, FieldCoord[]>
): ViolationBox[] {
  const boxes: ViolationBox[] = [];
  const usedKeys = new Set<string>(); // avoid double-boxing same field

  for (const v of violations) {
    const pageCoords = coordsByPage[v.page] ?? [];
    let matched: FieldCoord | null = null;
    let shortLabel = '';

    if (v.message === 'Seller initials missing' || v.message === 'Buyer initials missing') {
      const isSeller = v.message.startsWith('Seller');
      shortLabel = isSeller ? 'INIT-S' : 'INIT-B';
      // Find initial field for correct party on this page
      matched = pageCoords.find(c =>
        (c.is_initial || c.field_type === 'initial') &&
        c.field_key.includes(isSeller ? 'seller' : 'buyer') &&
        !usedKeys.has(c.field_key)
      ) ?? null;
      // Fallback: any initial field on this page
      if (!matched) {
        matched = pageCoords.find(c =>
          (c.is_initial || c.field_type === 'initial') &&
          !usedKeys.has(c.field_key)
        ) ?? null;
      }

    } else if (v.message.startsWith('Unsigned:')) {
      shortLabel = 'SIG';
      const sigLabel = (v.message.match(/Unsigned: "(.+?)"/) ?? [])[1] ?? '';
      const sigNorm = normalize(sigLabel);
      // Try to match signature field by label similarity
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
      // Fallback: first unmatched signature on this page
      if (!best) best = pageCoords.find(c => (c.is_signature || c.field_type === 'signature') && !usedKeys.has(c.field_key)) ?? null;
      matched = best;

    } else if (v.message.startsWith('Blank field:')) {
      shortLabel = 'BLANK';
      const rawLabel = (v.message.match(/Blank field: "(.+?)"/) ?? [])[1] ?? '';
      const labelNorm = normalize(rawLabel);
      let best: FieldCoord | null = null;
      let bestScore = 0;
      for (const c of pageCoords) {
        if (c.is_signature || c.is_initial || c.field_type === 'signature' || c.field_type === 'initial') continue;
        if (usedKeys.has(c.field_key)) continue;
        const keyNorm = normalize(c.field_key);
        // Score based on substring overlap
        let score = 0;
        if (labelNorm.length >= 3 && keyNorm.includes(labelNorm.slice(0, Math.min(6, labelNorm.length)))) score += labelNorm.length;
        if (keyNorm.length >= 3 && labelNorm.includes(keyNorm.slice(0, Math.min(6, keyNorm.length)))) score += keyNorm.length;
        // Word-level match: split label on spaces and check if any word appears in key
        const words = rawLabel.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
        for (const word of words) {
          if (keyNorm.includes(normalize(word))) score += word.length;
        }
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (bestScore >= 3) matched = best;

    } else {
      // Generic AI flag — try to find any field on the page not already matched
      shortLabel = v.severity === 'error' ? 'ERR' : 'WARN';
      // Don't auto-match generic flags to avoid false positives
    }

    if (matched) {
      usedKeys.add(matched.field_key);
      boxes.push({
        fieldId:  matched.field_key,
        page:     v.page,
        x:        (matched.x / PAGE_W) * 100,
        y:        (matched.y / PAGE_H) * 100,
        w:        (matched.width / PAGE_W) * 100,
        h:        Math.max(matched.height / PAGE_H * 100, 1.5), // min visible height
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

    // Load PDF bytes
    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);

    // Detect e-signature platform from raw text
    const textSample = Buffer.from(pdfBytes).toString('latin1').slice(0, 50000);
    const platform = detectEsigPlatform(textSample);

    // Load and split into pages with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const numPages = pdfDoc.getPageCount();

    // Fingerprint — match template
    let matchedSlug = formSlug;
    if (!matchedSlug) {
      const { data: templates } = await supabase
        .from('form_templates')
        .select('slug, page_count')
        .eq('page_count', numPages)
        .limit(5);
      if (templates && templates.length === 1) matchedSlug = templates[0].slug;
    }

    // Load form profile
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

    // Load field coordinates for this template (used for red box overlay)
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

    // Split PDF and analyze each page
    const pageResults: PageResult[] = [];
    for (let i = 0; i < numPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const pageBytes = await singlePageDoc.save();
      const base64 = Buffer.from(pageBytes).toString('base64');

      const result = await analyzePageWithGPT4o(base64, i + 1, numPages, formProfile, platform);
      pageResults.push(result);

      if (i < numPages - 1) await new Promise(r => setTimeout(r, 300));
    }

    // Aggregate
    const report = aggregateResults(pageResults, matchedSlug, initialsPages, platform);

    // Map violations → coordinate boxes for PDF overlay
    const violationBoxes = Object.keys(coordsByPage).length > 0
      ? matchViolationsToCoords(report.violations, coordsByPage)
      : [];

    return NextResponse.json({
      ...report,
      formSlug: matchedSlug,
      numPages,
      violationBoxes,
      hasCoordinates: Object.keys(coordsByPage).length > 0,
      // Legacy compat alias
      isDotloop: platform === 'dotloop',
    });

  } catch (err: any) {
    console.error('Compliance check error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
