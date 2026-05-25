import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const OPENAI_KEY = process.env.OPENAI_API_KEY!;

function toPct(x: number, y: number, w: number, h: number) {
  return {
    x: parseFloat(((x / 612) * 100).toFixed(2)),
    y: parseFloat(((y / 792) * 100).toFixed(2)),
    w: parseFloat(((w / 612) * 100).toFixed(2)),
    h: Math.max(parseFloat(((h / 792) * 100).toFixed(2)), 1.5),
  };
}

function labelFromKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[\s_.\-()[\]]/g, '');
}

// ─── Vision-based compliance via GPT-4o Responses API ───────────────────────
async function visionCheck(
  pdfBase64: string,
  fileName: string,
  templateName: string,
  profile: any,
  allFields: Array<{ field_key: string; page_num: number; is_signature: boolean; is_initial: boolean; required: boolean }>
): Promise<any[]> {
  const initialsPages: number[] = profile?.initials_pages ?? [];
  const sellerCount: number = profile?.seller_count ?? 1;
  const buyerCount: number = profile?.buyer_count ?? 1;

  // Build field lists for the prompt (cap at 60 to avoid token bloat)
  const requiredText = allFields
    .filter((f) => f.required && !f.is_signature && !f.is_initial)
    .slice(0, 60)
    .map((f) => `  - ${f.field_key} (page ${f.page_num})`)
    .join('\n');

  const sigList = allFields
    .filter((f) => f.is_signature)
    .slice(0, 20)
    .map((f) => `  - ${f.field_key} (page ${f.page_num})`)
    .join('\n');

  const iniList = allFields
    .filter((f) => f.is_initial)
    .slice(0, 30)
    .map((f) => `  - ${f.field_key} (page ${f.page_num})`)
    .join('\n');

  const prompt = `You are a licensed real estate transaction coordinator (TC) performing a compliance review of a completed contract.

FORM: ${templateName}
PARTIES: ${sellerCount} seller(s), ${buyerCount} buyer(s)
PAGES THAT REQUIRE INITIALS FROM ALL PARTIES: ${initialsPages.length > 0 ? initialsPages.join(', ') : 'none specified'}

This document was likely signed via Dotloop. Dotloop embeds a short verification URL (dtlp.us/...) near every signature and initial block to confirm authenticity. A signature or initial WITH a dtlp.us hash is fully verified — do not flag it.

━━━ WHAT TO CHECK ━━━

1. REQUIRED TEXT FIELDS — for each field below, read the text at that location. If it is blank or contains only underscores/lines, flag it.
${requiredText || '  (none)'}

2. SIGNATURES — for each signature line below, look for: (a) a handwritten or typed signature AND (b) a nearby dtlp.us verification link. Flag if either is missing.
${sigList || '  (none)'}

3. INITIALS — for each initials field below, check that all ${sellerCount + buyerCount} parties have initialed. Flag any that are blank.
${iniList || '  (none)'}

4. DATES — flag any date field left completely blank.

5. CHECKBOXES — flag any required checkbox section where no option has been selected.

━━━ RULES ━━━
- A field containing ANY value (name, date, "N/A", "---", "0", a strike-through, or even a single character) counts as FILLED — do NOT flag it.
- Only flag genuinely blank/empty fields.
- Signatures confirmed by a dtlp.us hash are VALID.
- Use severity "error" for blank required fields and missing signatures.
- Use severity "warning" for items you cannot fully verify visually (e.g., initials you can see but cannot confirm are from the right party).

━━━ OUTPUT ━━━
Return ONLY a valid JSON array — no markdown, no explanation:
[
  {
    "field_key": "seller_name_1",
    "page": 1,
    "severity": "error",
    "type": "required",
    "message": "Seller name 1 appears blank"
  }
]
type must be one of: required | signature | initial | date | checkbox
If the document looks fully complete with no issues, return an empty array: []`;

  const body = {
    model: 'gpt-4o',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_file',
            filename: fileName,
            file_data: `data:application/pdf;base64,${pdfBase64}`,
          },
          {
            type: 'input_text',
            text: prompt,
          },
        ],
      },
    ],
  };

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('OpenAI Responses API error:', errText);
    throw new Error(`OpenAI vision check failed: ${res.status} — ${errText.slice(0, 200)}`);
  }

  const data = await res.json();

  let violations: any[] = [];
  try {
    const raw: string = data.output?.[0]?.content?.[0]?.text ?? '[]';
    // Strip markdown code fences if GPT wraps in them despite instructions
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    violations = JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse GPT-4o vision response:', JSON.stringify(data).slice(0, 500));
  }

  return violations;
}

// ─── Main route ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') ?? '';
    if (!ct.includes('multipart')) {
      return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
    }

    const fd = await req.formData();
    const formSlug = (fd.get('form_slug') as string) ?? '';
    const file = fd.get('pdf') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file uploaded' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // ── 1. Try AcroForm extraction ──────────────────────────────────────────
    const fieldValues: Record<string, string> = {};
    let rawFieldCount = 0;

    try {
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      rawFieldCount = fields.length;

      for (const field of fields) {
        const name = field.getName();
        const type = field.constructor.name;
        let val = '';
        try {
          if (type === 'PDFTextField')   val = form.getTextField(name).getText() ?? '';
          else if (type === 'PDFCheckBox')  val = form.getCheckBox(name).isChecked() ? 'yes' : '';
          else if (type === 'PDFDropdown')  val = form.getDropdown(name).getSelected()[0] ?? '';
          else if (type === 'PDFRadioGroup') val = form.getRadioGroup(name).getSelected() ?? '';
          else if (type === 'PDFSignature')  val = '__signature__';
        } catch {}
        if (val) fieldValues[name] = val;
      }
    } catch (e) {
      console.error('AcroForm load error:', e);
    }

    // ── 2. Load DB fields for this template ─────────────────────────────────
    const { data: dbFields } = await supabase
      .from('field_coordinates')
      .select('field_key, page_num, x, y, width, height, field_type, is_signature, is_initial, required')
      .eq('form_slug', formSlug);

    const totalDbFields = dbFields?.length ?? 0;

    // ── 3. Normalize-match AcroForm names → DB keys ─────────────────────────
    const dbNormMap: Record<string, string> = {};
    for (const f of dbFields ?? []) {
      dbNormMap[normalizeKey(f.field_key)] = f.field_key;
    }

    const matchedValues: Record<string, string> = {};
    for (const [acroName, val] of Object.entries(fieldValues)) {
      const dbKey = dbNormMap[normalizeKey(acroName)];
      if (dbKey) matchedValues[dbKey] = val;
    }

    const extractedCount = Object.keys(matchedValues).length;
    const matchPct = totalDbFields > 0 ? extractedCount / totalDbFields : 0;

    // ── 4. Decide path: AcroForm (≥10% match) or Vision (flattened) ─────────
    const isFlattened = rawFieldCount === 0 || matchPct < 0.1;

    // ── 5. Get template name + profile ──────────────────────────────────────
    const [{ data: template }, { data: profile }] = await Promise.all([
      supabase.from('form_templates').select('name').eq('slug', formSlug).single(),
      supabase.from('form_profiles').select('*').eq('form_slug', formSlug).single(),
    ]);

    const matchedTemplate = template?.name ?? formSlug;

    // ── 6. Run compliance check ─────────────────────────────────────────────
    let violations: any[] = [];
    let method = 'acroform';

    if (isFlattened) {
      // Vision path — GPT-4o reads the whole PDF
      method = 'vision-gpt4o';
      const base64 = Buffer.from(bytes).toString('base64');
      violations = await visionCheck(base64, file.name, matchedTemplate, profile, dbFields ?? []);
    } else {
      // AcroForm path — check matched values against required fields
      method = 'acroform';
      for (const f of (dbFields ?? []).filter((f) => f.required)) {
        const val = (matchedValues[f.field_key] ?? '').trim();
        if (!val || val === '__signature__') {
          violations.push({
            field_key: f.field_key,
            page: f.page_num,
            severity: 'error',
            type: f.is_signature ? 'signature' : f.is_initial ? 'initial' : 'required',
            message: `${labelFromKey(f.field_key)} is blank`,
          });
        }
      }
    }

    // ── 7. Map violations → overlay boxes using DB coordinates ──────────────
    const dbFieldMap = new Map((dbFields ?? []).map((f) => [f.field_key, f]));

    const boxes = violations
      .map((v: any) => {
        const dbField = dbFieldMap.get(v.field_key);
        if (!dbField) return null;
        const pct = toPct(dbField.x, dbField.y, dbField.width, dbField.height);
        return {
          field_key: v.field_key,
          page: v.page ?? dbField.page_num,
          severity: v.severity ?? 'error',
          type: v.type ?? 'required',
          message: v.message ?? `${labelFromKey(v.field_key)} needs attention`,
          ...pct,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      matched_template: matchedTemplate,
      is_flattened: isFlattened,
      is_dotloop: isFlattened,
      method,
      total_db_fields: totalDbFields,
      extracted_count: extractedCount,
      violations,
      boxes,
    });
  } catch (err: any) {
    console.error('Compliance check error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
