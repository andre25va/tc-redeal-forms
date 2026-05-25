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
  dotloop:     'Dotloop',
  docusign:    'DocuSign',
  hellosign:   'HelloSign / Dropbox Sign',
  'adobe-sign':'Adobe Sign',
  unknown:     'E-Signature',
};

/** Returns the platform-specific verification hash pattern hint for the GPT prompt */
function platformHashHint(platform: EsigPlatform): string {
  switch (platform) {
    case 'dotloop':
      return 'Dotloop verification hashes look like: dtlp.us/XXXX-XXXX-XXXX';
    case 'docusign':
      return 'DocuSign verification includes an envelope ID (UUID format) and/or a docusign.net URL';
    case 'hellosign':
      return 'HelloSign/Dropbox Sign verification includes a hellosign.com or dropboxsign.com URL';
    case 'adobe-sign':
      return 'Adobe Sign verification includes an adobesign.com or echosign.com URL';
    default:
      return 'Look for any verification URL, hash, or code stamped near the signature block by the e-signature platform';
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
    esig_hash: string | null;      // was dotloop_hash — now platform-agnostic
  }>;
  checkboxes: Array<{
    label: string;
    checked: boolean;
  }>;
  filled_fields: Array<{
    label: string;
    value: string;
    blank: boolean;
  }>;
  compliance_flags: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
  }>;
  parseError?: boolean;
}

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
    {
      "label": "checkbox label text",
      "checked": boolean
    }
  ],
  "filled_fields": [
    {
      "label": "field label",
      "value": "filled value or empty string",
      "blank": boolean
    }
  ],
  "compliance_flags": [
    {
      "severity": "error | warning | info",
      "message": "description"
    }
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
            {
              type: 'input_text',
              text: prompt,
            },
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
  formSlug: string,
  initialsPages: number[],
  platform: EsigPlatform
) {
  const errors:   Array<{ page: number; message: string; severity: 'error' | 'warning' | 'info' }> = [];
  const warnings: Array<{ page: number; message: string; severity: 'error' | 'warning' | 'info' }> = [];

  let totalSigs = 0, signedSigs = 0;
  let totalFields = 0, blankFields = 0;
  let totalBoxes = 0, checkedBoxes = 0;

  // Platform-agnostic — was "dotloopHashes", now "esigHashes"
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
    totalBoxes    += page.checkboxes.length;
    checkedBoxes  += page.checkboxes.filter(c => c.checked).length;

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
    platform,                         // ← new field
    platformLabel: PLATFORM_LABELS[platform],
    summary: {
      totalPages: pageResults.length,
      pagesWithBothInitials: initialsGrid.filter(r => r.sellerOk && r.buyerOk).length,
      signaturesComplete: `${signedSigs}/${totalSigs}`,
      checkboxesFilled: `${checkedBoxes}/${totalBoxes}`,
      fieldsFilled: `${totalFields - blankFields}/${totalFields}`,
      criticalErrors: errors.length,
      warnings: warnings.length,
      esigHashes,                     // ← renamed from dotloopHashes
    },
    initialsGrid,
    violations: [...errors, ...warnings],
    pages: pageResults,
  };
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
          seller_count: profile.seller_count ?? 1,
          buyer_count:  profile.buyer_count  ?? 1,
          initials_pages: profile.initials_pages ?? [],
        };
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

      // Small delay between pages to avoid rate limits
      if (i < numPages - 1) await new Promise(r => setTimeout(r, 300));
    }

    // Aggregate
    const report = aggregateResults(pageResults, matchedSlug, initialsPages, platform);

    return NextResponse.json({
      ...report,
      formSlug: matchedSlug,
      numPages,
      // Legacy compat alias
      isDotloop: platform === 'dotloop',
    });

  } catch (err: any) {
    console.error('Compliance check error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
