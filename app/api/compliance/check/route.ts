import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Convert PDF point coords → % of letter page (612×792pt)
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

// Normalize a field name for fuzzy matching:
// "Seller Name 1" → "sellername1"
// "seller_name_1" → "sellername1"
// "SellerName1"   → "sellername1"
function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[\s_.\-()[\]]/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') ?? '';
    let formSlug = '';
    let extracted: Record<string, string> = {};
    let isFlattened = false;
    let rawFieldCount = 0;

    if (ct.includes('multipart')) {
      const fd = await req.formData();
      formSlug = (fd.get('form_slug') as string) ?? '';
      const file = fd.get('pdf') as File | null;

      if (file) {
        const bytes = await file.arrayBuffer();
        try {
          const pdfDoc = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
          const form = pdfDoc.getForm();
          const fields = form.getFields();
          rawFieldCount = fields.length;

          if (fields.length === 0) {
            isFlattened = true;
          } else {
            // Build a map of normalized name → value from the PDF's AcroForm fields
            const normalizedExtracted: Record<string, string> = {};
            const rawExtracted: Record<string, string> = {};

            for (const field of fields) {
              const name = field.getName();
              const type = field.constructor.name;
              let val = '';
              try {
                if (type === 'PDFTextField') {
                  val = form.getTextField(name).getText() ?? '';
                } else if (type === 'PDFCheckBox') {
                  val = form.getCheckBox(name).isChecked() ? 'yes' : '';
                } else if (type === 'PDFDropdown') {
                  val = form.getDropdown(name).getSelected()[0] ?? '';
                } else if (type === 'PDFRadioGroup') {
                  val = form.getRadioGroup(name).getSelected() ?? '';
                } else if (type === 'PDFSignature') {
                  val = '__signature__';
                }
              } catch {}
              rawExtracted[name] = val;
              normalizedExtracted[normalizeKey(name)] = val;
            }

            // Now fetch our DB keys and try to match:
            // 1) Exact match on field_key
            // 2) Normalized match
            const { data: allCoords } = await supabase
              .from('field_coordinates')
              .select('field_key')
              .eq('form_slug', formSlug);

            for (const coord of (allCoords ?? [])) {
              const key = coord.field_key;
              if (rawExtracted[key] !== undefined) {
                // Exact match
                extracted[key] = rawExtracted[key];
              } else {
                // Normalized match
                const normKey = normalizeKey(key);
                const normVal = normalizedExtracted[normKey];
                if (normVal !== undefined) {
                  extracted[key] = normVal;
                }
              }
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

    // Fetch signature/initial/required fields
    const { data: coords } = await supabase
      .from('field_coordinates')
      .select('field_key, page_num, x, y, width, height, field_type, is_signature, is_initial, required')
      .eq('form_slug', formSlug)
      .or('is_signature.eq.true,is_initial.eq.true,required.eq.true');

    // Fetch custom rules
    const { data: rules } = await supabase
      .from('form_compliance_rules')
      .select('*')
      .eq('form_slug', formSlug);

    const violations: any[] = [];

    if (isFlattened) {
      // Can't auto-verify flattened PDF — flag all sig/initial fields as unverifiable warnings
      for (const coord of (coords ?? [])) {
        if (!coord.is_signature && !coord.is_initial) continue;
        const pct = toPct(coord.x, coord.y, coord.width, coord.height);
        violations.push({
          field_key: coord.field_key,
          page_num: coord.page_num,
          type: coord.is_signature ? 'missing_signature' : 'missing_initial',
          severity: 'warning',
          message: `Cannot auto-verify (flattened PDF): ${labelFromKey(coord.field_key)}`,
          ...pct,
        });
      }
    } else {
      for (const coord of (coords ?? [])) {
        const val = extracted[coord.field_key] ?? '';

        if (coord.is_signature && !val) {
          const pct = toPct(coord.x, coord.y, coord.width, coord.height);
          violations.push({
            field_key: coord.field_key,
            page_num: coord.page_num,
            type: 'missing_signature',
            severity: 'error',
            message: `Missing signature: ${labelFromKey(coord.field_key)}`,
            ...pct,
          });
        } else if (coord.is_initial && !val) {
          const pct = toPct(coord.x, coord.y, coord.width, coord.height);
          violations.push({
            field_key: coord.field_key,
            page_num: coord.page_num,
            type: 'missing_initial',
            severity: 'error',
            message: `Missing initials: ${labelFromKey(coord.field_key)}`,
            ...pct,
          });
        } else if (coord.required && !coord.is_signature && !coord.is_initial && !val) {
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

      // Run custom rules
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
    }

    const errors = violations.filter(v => v.severity === 'error').length;
    const warnings = violations.filter(v => v.severity === 'warning').length;

    return NextResponse.json({
      passed: errors === 0 && !isFlattened,
      is_flattened: isFlattened,
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
