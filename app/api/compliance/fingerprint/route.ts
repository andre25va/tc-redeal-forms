import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const file = fd.get('pdf') as File | null;
    if (!file) return NextResponse.json({ error: 'No PDF provided' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    let pageCount = 0;
    const fieldNames: string[] = [];

    try {
      const pdfDoc = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();
      try {
        const form = pdfDoc.getForm();
        form.getFields().forEach(f => fieldNames.push(f.getName()));
      } catch {}
    } catch (e: any) {
      return NextResponse.json({ error: `PDF parse error: ${e.message}` }, { status: 400 });
    }

    // Get all templates + page counts
    const { data: templates } = await supabase
      .from('form_templates')
      .select('slug, name, page_count');

    // Get all DB field keys grouped by slug for overlap scoring
    const { data: dbFields } = await supabase
      .from('field_coordinates')
      .select('form_slug, field_key');

    const dbFieldMap: Record<string, Set<string>> = {};
    for (const row of (dbFields ?? [])) {
      if (!dbFieldMap[row.form_slug]) dbFieldMap[row.form_slug] = new Set();
      dbFieldMap[row.form_slug].add(row.field_key);
    }

    // Normalise uploaded field names for comparison
    const uploadedNames = new Set(fieldNames.map(n => n.toLowerCase().replace(/[^a-z0-9]/g, '_')));

    const matches = (templates ?? [])
      .map(t => {
        let score = 0;

        // Page count (most reliable signal)
        if (t.page_count === pageCount) score += 60;
        else if (Math.abs((t.page_count ?? 0) - pageCount) <= 1) score += 25;

        // AcroForm field name overlap
        if (fieldNames.length > 0 && dbFieldMap[t.slug]) {
          const dbSet = dbFieldMap[t.slug];
          let overlap = 0;
          for (const name of uploadedNames) {
            if (dbSet.has(name)) overlap++;
          }
          const ratio = overlap / Math.max(uploadedNames.size, dbSet.size, 1);
          score += Math.round(ratio * 40);
        }

        return {
          form_slug: t.slug,
          name: t.name,
          confidence: Math.min(score, 100),
          page_count: t.page_count,
        };
      })
      .filter(m => m.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    return NextResponse.json({
      detected_pages: pageCount,
      detected_fields: fieldNames.length,
      matches,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
