import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function toPct(x: number, y: number, w: number, h: number) {
  return {
    x: parseFloat(((x / 612) * 100).toFixed(2)),
    y: parseFloat(((y / 792) * 100).toFixed(2)),
    w: parseFloat(((w / 612) * 100).toFixed(2)),
    h: Math.max(parseFloat(((h / 792) * 100).toFixed(2)), 1.5),
  };
}

function labelFromKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[\s_.\-()[\]]/g, '');
}

// Extract text at known field coordinates from a flattened PDF using pdfjs-dist
async function extractFlattenedFields(
  bytes: Uint8Array,
  coords: Array<{ field_key: string; page_num: number; x: number; y: number; width: number; height: number }>
): Promise<Record<string, string>> {
  // Lazy-load pdfjs-dist so it doesn't affect non-flattened fast path
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    disableWorker: true,
    verbosity: 0,
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  // Group coords by page
  const byPage: Record<number, typeof coords> = {};
  for (const c of coords) {
    if (!byPage[c.page_num]) byPage[c.page_num] = [];
    byPage[c.page_num].push(c);
  }

  const result: Record<string, string> = {};
  const PADDING = 6; // pt — how far outside field rect we still consider "in" the field

  for (const pageNumStr of Object.keys(byPage)) {
    const pageNum = parseInt(pageNumStr);
    if (pageNum < 1 || pageNum > numPages) continue;

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height; // typically 792 for letter
    const textContent = await page.getTextContent();

    const fieldsOnPage = byPage[pageNum];

    for (const field of fieldsOnPage) {
      // Our DB coords: y from top (screen-space). PDF coords: y from bottom.
      const fieldLeft   = field.x - PADDING;
      const fieldRight  = field.x + field.width + PADDING;
      const fieldBottom = pageHeight - field.y - field.height - PADDING; // PDF y-from-bottom
      const fieldTop    = pageHeight - field.y + PADDING;                // PDF y-from-bottom

      const parts: string[] = [];

      for (const item of textContent.items as any[]) {
        if (!item.str || item.str.trim() === '') continue;
        const tx = item.transform[4]; // x in PDF space
        const ty = item.transform[5]; // y in PDF space (from bottom)

        if (
          tx >= fieldLeft && tx <= fieldRight &&
          ty >= fieldBottom && ty <= fieldTop
        ) {
          parts.push(item.str.trim());
        }
      }

      if (parts.length > 0) {
        result[field.field_key] = parts.join(' ');
      }
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') ?? '';
    let formSlug = '';
    let extracted: Record<string, string> = {};
    let isFlattened = false;
    let rawFieldCount = 0;
    let flattenedExtracted = false;

    if (ct.includes('multipart')) {
      const fd = await req.formData();
      formSlug = (fd.get('form_slug') as string) ?? '';
      const file = fd.get('pdf') as File | null;

      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer());

        try {
          const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const form = pdfDoc.getForm();
          const fields = form.getFields();
          rawFieldCount = fields.length;

          // Build extracted map from AcroForm fields
          const rawExtracted: Record<string, string> = {};
          const normalizedExtracted: Record<string, string> = {};

          for (const field of fields) {
            const name = field.getName();
            const type = field.constructor.name;
            let val = '';
            try {
              if (type === 'PDFTextField')   val = form.getTextField(name).getText() ?? '';
              else if (type === 'PDFCheckBox') val = form.getCheckBox(name).isChecked() ? 'yes' : '';
              else if (type === 'PDFDropdown') val = form.getDropdown(name).getSelected()[0] ?? '';
              else if (type === 'PDFRadioGroup') val = form.getRadioGroup(name).getSelected() ?? '';
              else if (type === 'PDFSignature') val = '__signature__';
            } catch {}
            rawExtracted[name] = val;
            normalizedExtracted[normalizeKey(name)] = val;
          }

          // Fetch all DB field keys for this form
          const { data: allCoords } = await supabase
            .from('field_coordinates')
            .select('field_key, page_num, x, y, width, height')
            .eq('form_slug', formSlug);

          const dbFieldCount = (allCoords ?? []).length;

          // Map AcroForm values to our DB keys
          let matchCount = 0;
          for (const coord of (allCoords ?? [])) {
            const key = coord.field_key;
            if (rawExtracted[key] !== undefined) {
              extracted[key] = rawExtracted[key];
              matchCount++;
            } else {
              const normVal = normalizedExtracted[normalizeKey(key)];
              if (normVal !== undefined) {
                extracted[key] = normVal;
                matchCount++;
              }
            }
          }

          // If fewer than 10% of DB fields matched, treat as flattened
          // (e.g. DocuSign left 1-2 AcroForm widgets but flattened the rest)
          if (dbFieldCount > 10 && matchCount < dbFieldCount * 0.1) {
            isFlattened = true;

            // Extract text at coordinates using pdfjs-dist
            try {
              extracted = await extractFlattenedFields(bytes, allCoords ?? []);
              flattenedExtracted = true;
            } catch (e) {
              console.error('pdfjs text extraction failed:', e);
              extracted = {};
            }
          }
        } catch {
          isFlattened = true;
        }
      }
    } else {
      const body = await req.json();
      formSlug = body.form_slug ?? '';
      extracted = body.fields ?? {};
    }

    if (!formSlug) return NextResponse.json({ error: 'form_slug required' }, { status: 400 });

    // Fetch the fields we need to check
    const { data: coords } = await supabase
      .from('field_coordinates')
      .select('field_key, page_num, x, y, width, height, field_type, is_signature, is_initial, required')
      .eq('form_slug', formSlug)
      .or('is_signature.eq.true,is_initial.eq.true,required.eq.true');

    const { data: rules } = await supabase
      .from('form_compliance_rules')
      .select('*')
      .eq('form_slug', formSlug);

    const violations: any[] = [];

    for (const coord of (coords ?? [])) {
      const val = extracted[coord.field_key] ?? '';

      if (coord.is_signature) {
        if (!val) {
          const pct = toPct(coord.x, coord.y, coord.width, coord.height);
          violations.push({
            field_key: coord.field_key,
            page_num: coord.page_num,
            // If flattened and we extracted text, it's still an error (no sig detected).
            // If flattened with NO text extraction, downgrade to warning.
            type: 'missing_signature',
            severity: flattenedExtracted ? 'error' : (isFlattened ? 'warning' : 'error'),
            message: isFlattened && !flattenedExtracted
              ? `Cannot auto-verify (flattened PDF): ${labelFromKey(coord.field_key)}`
              : `Missing signature: ${labelFromKey(coord.field_key)}`,
            ...pct,
          });
        }
      } else if (coord.is_initial) {
        if (!val) {
          const pct = toPct(coord.x, coord.y, coord.width, coord.height);
          violations.push({
            field_key: coord.field_key,
            page_num: coord.page_num,
            type: 'missing_initial',
            severity: flattenedExtracted ? 'error' : (isFlattened ? 'warning' : 'error'),
            message: isFlattened && !flattenedExtracted
              ? `Cannot auto-verify (flattened PDF): ${labelFromKey(coord.field_key)}`
              : `Missing initials: ${labelFromKey(coord.field_key)}`,
            ...pct,
          });
        }
      } else if (coord.required) {
        if (!val) {
          const pct = toPct(coord.x, coord.y, coord.width, coord.height);
          violations.push({
            field_key: coord.field_key,
            page_num: coord.page_num,
            type: 'missing_required',
            severity: 'error',
            message: `Required field empty: ${labelFromKey(coord.field_key)}`,
            ...pct,
          });
        }
      }
    }

    // Custom rules
    for (const rule of (rules ?? [])) {
      if (rule.rule_type === 'required') {
        if (!(extracted[rule.field_key] ?? '')) {
          violations.push({ field_key: rule.field_key, page_num: 0, type: 'rule', severity: rule.severity, message: rule.message });
        }
      } else if (rule.rule_type === 'required_if') {
        const condVal = extracted[rule.condition_field] ?? '';
        if (condVal === rule.condition_value && !(extracted[rule.field_key] ?? '')) {
          violations.push({ field_key: rule.field_key, page_num: 0, type: 'rule', severity: rule.severity, message: rule.message });
        }
      }
    }

    const errors = violations.filter(v => v.severity === 'error').length;
    const warnings = violations.filter(v => v.severity === 'warning').length;

    return NextResponse.json({
      passed: errors === 0,
      is_flattened: isFlattened,
      flattened_extracted: flattenedExtracted,
      violations,
      errors,
      warnings,
      fields_extracted: Object.keys(extracted).length,
      fields_checked: (coords ?? []).length,
      rules_checked: (rules ?? []).length,
      raw_pdf_fields: rawFieldCount,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
