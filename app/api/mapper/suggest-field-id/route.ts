import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FORM_LABELS: Record<string, string> = {
  'seller-disclosure': 'Sellers Disclosure Addendum',
  'residential-sale-contract': 'Residential Real Estate Sale Contract',
};

const NAMING_EXAMPLES: Record<string, string> = {
  'seller-disclosure': `Existing field key examples for this form:
- Text: sellerName1, sellerName2, sellerAddress, occ_property_age, roofAge, roofMaterial
- Checkbox yes/no/na: occ_seller_occupies_yes, occ_seller_occupies_no, occ_never_occupied
- Land: land_a_yes, land_a_no, land_a_na, land_j_belongs_na
- Roof: roof_b_yes, roof_d_complete, roof_age_unknown
- Structural: struct_h_na, struct_i_yes
- Plumbing: plumb_water_public, plumb_sewer_septic, plumb_n_copper
- HVAC: hvac_a_central_elec, hvac_b_natural_gas, hvac_d_tankless
- Electric: elec_a_copper, elec_b_breaker
- Hazardous: haz_k_yes
- Tax/HOA: tax_j, tax_m, tax_m_freq_quarterly
- Other: other_a_party_walls
- Infestation: infest_a_yes, infest_e_stays
- Initials: initials_s1_p1, initials_s2_p7
- Signatures: seller1_signature, seller2_signature`,
  'residential-sale-contract': `Existing field key examples for this form:
- Parties: buyer_name_1, buyer_name_2, seller_name_1, seller_name_2
- Property: property_address, legal_description
- Price: purchase_price, earnest_money, down_payment
- Dates: closing_date, possession_date, offer_expiration
- Financing: financing_conv_yes, financing_fha_yes, financing_va_yes, financing_cash_yes
- Contingencies: contingency_inspection_yes, contingency_appraisal_yes, contingency_financing_yes
- Signatures: buyer_signature_1, seller_signature_1, agent_signature
- Initials: initials_buyer_p1, initials_seller_p1`,
};

export async function POST(req: NextRequest) {
  try {
    const { form_slug, page_num, x, y, w, h, field_type, base_url } = await req.json();

    if (!form_slug || !page_num || !base_url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const formLabel = FORM_LABELS[form_slug] || form_slug;
    const namingExamples = NAMING_EXAMPLES[form_slug] || '';

    // Build the image URL for the page
    const prefix = form_slug === 'seller-disclosure' ? 'sd' : 'pc';
    const imageUrl = `${base_url}/mapper-pages/${prefix}-page-${page_num}.jpg`;

    // Fetch the page image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch page image (${imgRes.status})`);
    const imgBuffer = await imgRes.arrayBuffer();
    const imgBase64 = Buffer.from(imgBuffer).toString('base64');

    const prompt = `You are helping map form fields in a "${formLabel}" PDF.

This is page ${page_num} of the form. A field has been drawn at these pixel coordinates:
- x (left edge): ${Math.round(x)}, y (top edge): ${Math.round(y)}
- width: ${Math.round(w)}, height: ${Math.round(h)}
- field type: ${field_type || 'unknown'}

The image is approximately 1275px wide x 1650px tall (150 DPI letter page).

Look at the text label, question, or context near those coordinates to understand what this field represents.

${namingExamples}

Based on what you see near that position, suggest ONE concise snake_case field key.
Rules:
- All lowercase, underscores only (no spaces or hyphens)
- Semantic and specific - describes what the field contains
- For checkbox groups use suffixes: _yes, _no, _na as appropriate
- Under 45 characters
- Return ONLY the field key string, nothing else`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 60,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imgBase64}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || 'field_name';
    // Sanitize: lowercase, only a-z 0-9 underscores
    const suggestion = raw
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 50);

    return NextResponse.json({ suggestion });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('suggest-field-id error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
