// /lib/formStandards.ts
// Central definition of standard fields every form should have,
// derived from the form's profile (party counts, initials pages, etc.)

export interface FormProfile {
  form_slug: string;
  mls_board: string | null;
  state: string | null;
  document_name: string | null;
  document_number: string | null;
  page_count: number | null;
  buyer_count: number;
  seller_count: number;
  initials_pages: number[];
  has_broker_fields: boolean;
  notes: string | null;
}

export interface StandardField {
  key: string;
  page: number;
  field_type: 'text' | 'initial' | 'signature' | 'date';
  group: 'parties' | 'initials' | 'signatures' | 'broker';
  label: string; // Human-readable label for mapper checklist
}

/**
 * Returns all standard fields that SHOULD exist for a form
 * based on its profile. Mapper uses this to show a checklist
 * of required fields and warn when any are missing.
 */
export function getStandardFields(profile: FormProfile): StandardField[] {
  const fields: StandardField[] = [];

  // ── Party fields (page 1) ──────────────────────────────────────────
  for (let i = 1; i <= profile.buyer_count; i++) {
    fields.push({
      key: `buyer_name_${i}`,
      page: 1,
      field_type: 'text',
      group: 'parties',
      label: `Buyer Name ${i}`,
    });
  }
  for (let i = 1; i <= profile.seller_count; i++) {
    fields.push({
      key: `seller_name_${i}`,
      page: 1,
      field_type: 'text',
      group: 'parties',
      label: `Seller Name ${i}`,
    });
  }
  fields.push({
    key: 'property_address',
    page: 1,
    field_type: 'text',
    group: 'parties',
    label: 'Property Address',
  });

  // ── Initials (one set of 4 per initials page) ──────────────────────
  for (const page of profile.initials_pages) {
    const suffix = page === 1 ? '' : `_p${page}`;
    for (let i = 1; i <= profile.buyer_count; i++) {
      fields.push({
        key: `buyer_${i}_initials${suffix}`,
        page,
        field_type: 'initial',
        group: 'initials',
        label: `Buyer ${i} Initials (p${page})`,
      });
    }
    for (let i = 1; i <= profile.seller_count; i++) {
      fields.push({
        key: `seller_${i}_initials${suffix}`,
        page,
        field_type: 'initial',
        group: 'initials',
        label: `Seller ${i} Initials (p${page})`,
      });
    }
  }

  // ── Signatures (last page) ─────────────────────────────────────────
  if (profile.page_count) {
    const sigPage = profile.page_count;
    for (let i = 1; i <= profile.buyer_count; i++) {
      fields.push({
        key: `buyer_signature_${i}`,
        page: sigPage,
        field_type: 'signature',
        group: 'signatures',
        label: `Buyer Signature ${i}`,
      });
    }
    for (let i = 1; i <= profile.seller_count; i++) {
      fields.push({
        key: `seller_signature_${i}`,
        page: sigPage,
        field_type: 'signature',
        group: 'signatures',
        label: `Seller Signature ${i}`,
      });
    }
  }

  // ── Broker fields (optional) ───────────────────────────────────────
  if (profile.has_broker_fields) {
    const sigPage = profile.page_count ?? 1;
    fields.push(
      { key: 'buyers_broker_name', page: sigPage, field_type: 'text', group: 'broker', label: "Buyer's Broker Name" },
      { key: 'sellers_broker_name', page: sigPage, field_type: 'text', group: 'broker', label: "Seller's Broker Name" },
      { key: 'buyers_broker_firm', page: sigPage, field_type: 'text', group: 'broker', label: "Buyer's Broker Firm" },
      { key: 'sellers_broker_firm', page: sigPage, field_type: 'text', group: 'broker', label: "Seller's Broker Firm" },
    );
  }

  return fields;
}

/**
 * Groups standard fields by their group label for display in the mapper checklist.
 */
export function groupStandardFields(fields: StandardField[]): Record<string, StandardField[]> {
  return fields.reduce((acc, f) => {
    if (!acc[f.group]) acc[f.group] = [];
    acc[f.group].push(f);
    return acc;
  }, {} as Record<string, StandardField[]>);
}

export const MLS_BOARDS: Record<string, { name: string; state: string }> = {
  'Heartland MLS':           { name: 'Heartland MLS (KC Metro)',          state: 'KS' },
  'South Central Kansas MLS':{ name: 'South Central KS MLS (Wichita)',    state: 'KS' },
  KCRAR:                     { name: 'KC Regional Association of Realtors',state: 'MO' },
  KCREP:                     { name: 'KC Regional — KS Side',             state: 'KS' },
  SLMLS:                     { name: 'St. Louis MLS',                     state: 'MO' },
  BV:                        { name: 'Bagnell Dam / Lake of the Ozarks',  state: 'MO' },
  SWMO:                      { name: 'SW Missouri MLS',                   state: 'MO' },
  WICHITA:                   { name: 'Wichita Area MLS',                  state: 'KS' },
  CUSTOM:                    { name: 'Custom / Other',                    state: ''   },
};
