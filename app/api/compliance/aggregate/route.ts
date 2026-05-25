// /app/api/compliance/aggregate/route.ts
// Accepts accumulated pageResults from batched analysis → returns full VisionCheckResult

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EsigPlatform = 'dotloop' | 'docusign' | 'hellosign' | 'adobe-sign' | 'unknown';
type Severity = 'error' | 'warning' | 'review';

const PLATFORM_LABELS: Record<EsigPlatform, string> = {
  dotloop:      'Dotloop',
  docusign:     'DocuSign',
  hellosign:    'HelloSign / Dropbox Sign',
  'adobe-sign': 'Adobe Sign',
  unknown:      'E-Signature',
};

const REVIEW_THRESHOLD = 0.70;

function toSeverity(rawSeverity: string, confidence: number): Severity {
  if (confidence < REVIEW_THRESHOLD) return 'review';
  if (rawSeverity === 'error')   return 'error';
  if (rawSeverity === 'warning') return 'warning';
  if (rawSeverity === 'review')  return 'review';
  return 'warning';
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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchViolationsToCoords(
  violations: Array<{ page: number; message: string; severity: Severity }>,
  coordsByPage: Record<number, FieldCoord[]>
) {
  const boxes: any[] = [];
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
        if (sigNorm.includes('buyer')  && keyNorm.includes('buyer'))  score += 3;
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
        w:        (matched.width  / PAGE_W) * 100,
        h:        Math.max(matched.height / PAGE_H * 100, 1.5),
        severity: v.severity,
        type:     matched.field_type,
        label:    shortLabel,
      });
    }
  }

  return boxes;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      pageResults = [],
      formSlug    = '',
      platform    = 'unknown',
      formProfile: incomingProfile = null,
      totalPages  = pageResults.length,
    } = body;

    if (!pageResults.length) {
      return NextResponse.json({ error: 'No page results to aggregate' }, { status: 400 });
    }

    // Load formProfile from DB if not provided
    let formProfile = incomingProfile;
    let initialsPages: number[] = formProfile?.initials_pages ?? [];

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
        initialsPages = formProfile.initials_pages;
      }
    }

    // Load field coordinates for violation box mapping
    const coordsByPage: Record<number, FieldCoord[]> = {};
    if (formSlug) {
      const { data: coords } = await supabase
        .from('field_coordinates')
        .select('field_key, page_num, x, y, width, height, field_type, is_signature, is_initial')
        .eq('form_slug', formSlug);
      if (coords) {
        for (const c of coords) {
          if (!coordsByPage[c.page_num]) coordsByPage[c.page_num] = [];
          coordsByPage[c.page_num].push(c as FieldCoord);
        }
      }
    }

    // ── Aggregate page results ────────────────────────────────────────────
    const errors:   Array<{ page: number; message: string; severity: Severity }> = [];
    const warnings: Array<{ page: number; message: string; severity: Severity }> = [];
    const reviews:  Array<{ page: number; message: string; severity: Severity }> = [];

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

      const sellerSev = toSeverity('error', page.initials?.seller?.confidence ?? 0);
      const buyerSev  = toSeverity('error', page.initials?.buyer?.confidence  ?? 0);
      initialsGrid.push({
        page:         page.page,
        seller:       page.initials?.seller?.value ?? null,
        buyer:        page.initials?.buyer?.value  ?? null,
        sellerOk:     !needsInitials || (page.initials?.seller?.present ?? false),
        buyerOk:      !needsInitials || (page.initials?.buyer?.present  ?? false),
        sellerReview: sellerSev === 'review',
        buyerReview:  buyerSev  === 'review',
      });

      if (needsInitials && !(page.initials?.seller?.present)) {
        (sellerSev === 'review' ? reviews : errors).push({ page: page.page, message: 'Seller initials missing', severity: sellerSev });
      }
      if (needsInitials && !(page.initials?.buyer?.present)) {
        (buyerSev === 'review' ? reviews : errors).push({ page: page.page, message: 'Buyer initials missing', severity: buyerSev });
      }

      for (const sig of (page.signatures ?? [])) {
        totalSigs++;
        if (sig.signed) {
          signedSigs++;
          if (sig.esig_hash) {
            esigHashes.push({ signer: sig.signer ?? sig.label, hash: sig.esig_hash, timestamp: sig.timestamp ?? '' });
          }
        } else {
          const sev = toSeverity('error', sig.confidence);
          (sev === 'review' ? reviews : errors).push({ page: page.page, message: `Unsigned: "${sig.label}"`, severity: sev });
        }
      }

      totalBoxes   += (page.checkboxes ?? []).length;
      checkedBoxes += (page.checkboxes ?? []).filter((c: any) => c.checked).length;

      for (const field of (page.filled_fields ?? [])) {
        totalFields++;
        if (field.blank) {
          blankFields++;
          const sev = toSeverity('warning', field.confidence);
          (sev === 'review' ? reviews : warnings).push({ page: page.page, message: `Blank field: "${field.label}"`, severity: sev });
        }
      }

      for (const flag of (page.compliance_flags ?? [])) {
        const sev = toSeverity(flag.severity, flag.confidence);
        (sev === 'error' ? errors : sev === 'review' ? reviews : warnings).push({ page: page.page, message: flag.message, severity: sev });
      }
    }

    const isCompliant = errors.length === 0;
    const status = isCompliant ? (reviews.length > 0 ? 'NEEDS-REVIEW' : 'COMPLIANT') : 'NON-COMPLIANT';

    const allViolations = [...errors, ...warnings, ...reviews];
    const violationBoxes = Object.keys(coordsByPage).length > 0
      ? matchViolationsToCoords(allViolations, coordsByPage)
      : [];

    return NextResponse.json({
      status,
      method: 'vision-per-page-gpt4o',
      platform,
      platformLabel: PLATFORM_LABELS[platform as EsigPlatform] ?? 'E-Signature',
      summary: {
        totalPages,
        pagesWithBothInitials: initialsGrid.filter(r => r.sellerOk && r.buyerOk).length,
        signaturesComplete:    `${signedSigs}/${totalSigs}`,
        checkboxesFilled:      `${checkedBoxes}/${totalBoxes}`,
        fieldsFilled:          `${totalFields - blankFields}/${totalFields}`,
        criticalErrors:        errors.length,
        warnings:              warnings.length,
        reviewItems:           reviews.length,
        esigHashes,
        dotloopHashes:         esigHashes, // legacy compat
      },
      initialsGrid,
      violations: allViolations,
      violationBoxes,
      hasCoordinates: Object.keys(coordsByPage).length > 0,
      pages:       pageResults,
      formSlug,
      numPages:    totalPages,
      isDotloop:   platform === 'dotloop',
      usedPageImages: true,
    });

  } catch (err: any) {
    console.error('Compliance aggregate error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
