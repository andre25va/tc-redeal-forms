export interface FormSection {
  key: string
  title: string
  titleEs?: string
  prefixes: string[]
}

export interface ChatField {
  key: string
  type: 'choice' | 'text' | 'checkbox' | 'signature' | 'initial' | string
  label: string
  choices?: string[]
}

export const FORM_SECTIONS: Record<string, FormSection[]> = {
  'seller-disclosure': [
    { key: 'intro',        title: 'Property & Seller Info',     titleEs: 'Información del Vendedor',       prefixes: ['sellerName', 'propertyAddress', 'yearBuilt', 'ownershipYears', 'howLong', 'occ_', 'const_'] },
    { key: 'land',         title: 'Land & Lot',                 titleEs: 'Terreno y Lote',                 prefixes: ['land_', 'landExp'] },
    { key: 'roof',         title: 'Roof',                       titleEs: 'Techo',                          prefixes: ['roof', 'if_any_of_the_answers_in_this_section_are_yes'] },
    { key: 'infestation',  title: 'Infestation',                titleEs: 'Infestación',                    prefixes: ['infest_', 'pestControl', 'pestWarranty'] },
    { key: 'structural',   title: 'Structural',                 titleEs: 'Estructura',                     prefixes: ['struct_', 'fireplace', 'sec_8_'] },
    { key: 'additions',    title: 'Additions & Plumbing',       titleEs: 'Adiciones y Plomería',           prefixes: ['add_', 'plumb_', 'septicLocation'] },
    { key: 'hvac',         title: 'HVAC & Electrical',          titleEs: 'Clima y Electricidad',           prefixes: ['hvac_', 'electricalPanel', 'elec_a', 'elec_b', 'elec_c'] },
    { key: 'hazardous',    title: 'Hazardous Conditions',       titleEs: 'Condiciones Peligrosas',         prefixes: ['haz_'] },
    { key: 'taxes_hoa',    title: 'Taxes & HOA',                titleEs: 'Impuestos y HOA',                prefixes: ['tax_', 'tax14'] },
    { key: 'inspections',  title: 'Inspections',                titleEs: 'Inspecciones',                   prefixes: ['inspect_'] },
    { key: 'other_matters',title: 'Other Matters',              titleEs: 'Otros Asuntos',                  prefixes: ['other_', 'sec16', 'elec_sys', 'electricCompany', 'electricPhone', 'gasPhone', 'gasCompany', 'waterCompany', 'waterPhone', 'trashPhone', 'trashCompany', 'otherUtility'] },
    { key: 'comments',     title: 'Additional Comments',        titleEs: 'Comentarios Adicionales',        prefixes: ['additionalComments'] },
  ],

  'exclusive-right-to-sell': [
    {
      key: 'property_info',
      title: 'Property & Listing Info',
      titleEs: 'Información de la Propiedad',
      prefixes: ['text_7b43', 'text_2271', 'text_66d2', 'text_09d6', 'text_ba8f', 'text_d851', 'text_2af3', 'text_9b4d', 'text_aafa', 'text_aa36', 'text_7d47', 'text_4614'],
    },
    {
      key: 'mls_property_type',
      title: 'MLS Entry & Property Type',
      titleEs: 'Entrada MLS y Tipo de Propiedad',
      prefixes: ['checkbox_72a7', 'text_6637', 'checkbox_50af', 'checkbox_6534', 'checkbox_a38e'],
    },
    {
      key: 'marketing',
      title: 'Marketing Distribution',
      titleEs: 'Distribución de Mercadeo',
      prefixes: ['checkbox_667d', 'checkbox_2cc6', 'checkbox_4c2b', 'checkbox_da12', 'checkbox_70ff', 'text_0b2a'],
    },
    {
      key: 'seller_obligations',
      title: 'Seller Obligations',
      titleEs: 'Obligaciones del Vendedor',
      prefixes: ['text_17d6'],
    },
    {
      key: 'broker_authorization',
      title: 'Broker Authorization to Disclose',
      titleEs: 'Autorización al Corredor para Divulgar',
      prefixes: ['checkbox_0b84', 'checkbox_b20b', 'checkbox_e3f8', 'checkbox_c1e8', 'checkbox_e36d'],
    },
    {
      key: 'brokerage_relationships',
      title: 'Brokerage Relationships',
      titleEs: 'Relaciones de Corretaje',
      prefixes: ['checkbox_63bb', 'checkbox_233e', 'checkbox_38d2', 'checkbox_8d52', 'checkbox_ff84', 'checkbox_93b4', 'checkbox_4bf8', 'checkbox_6d73', 'checkbox_ccc5', 'checkbox_e33b', 'checkbox_51cc', 'checkbox_bb1e'],
    },
    {
      key: 'compensation',
      title: 'Compensation',
      titleEs: 'Compensación',
      prefixes: ['text_553d', 'text_c328', 'text_fa0f', 'checkbox_0565', 'checkbox_de7d', 'text_1df4', 'text_b309'],
    },
    {
      key: 'title_warranty',
      title: 'Title & Home Warranty',
      titleEs: 'Título y Garantía del Hogar',
      prefixes: ['text_8bde', 'text_6089', 'text_324c', 'text_7098', 'text_aff6', 'text_df30', 'checkbox_b19f', 'checkbox_89af', 'text_45ab', 'checkbox_fc9f'],
    },
    {
      key: 'additional_terms',
      title: 'Additional Terms',
      titleEs: 'Términos Adicionales',
      prefixes: ['checkbox_457b', 'text_e03a', 'text_88f8', 'text_c470', 'text_0990'],
    },
    {
      key: 'signatures',
      title: 'Signatures & Contact Info',
      titleEs: 'Firmas e Información de Contacto',
      prefixes: ['text_a0fd', 'text_2780', 'text_fca0', 'text_a78e', 'text_c621', 'text_056c', 'text_f47a', 'text_5d08', 'text_f4d2', 'text_e9ad', 'text_e6cf', 'text_13d2', 'text_7fd1', 'text_4be4'],
    },
  ],
}

const FIELD_LABEL_MAP: Record<string, string> = {
  // ── Seller Disclosure ──────────────────────────────────────────────────────
  sellerName1: 'Seller 1 Full Name',
  sellerName2: 'Seller 2 Full Name',
  propertyAddress: 'Property Address',
  yearBuilt: 'Year Built',
  ownershipYears: 'Years Owned',
  howLongSinceOccupied: 'How long since you last occupied the property',
  occ_seller_occupies: 'Seller currently occupies the property',
  occ_never_occupied: 'Seller has never occupied the property',
  const_conventional: 'Conventional construction',
  const_modular: 'Modular',
  const_manufactured: 'Manufactured',
  const_mobile: 'Mobile home',
  const_other_cb: 'Other construction type',
  landExplanation: 'Land issues explanation',
  roofAge: 'Roof age (years)',
  roofType: 'Roof type / material',
  roofIssuesDesc: 'Description of roof issues',
  roofRepairCompany: 'Roof repair company name',
  roofRepairDate: 'Date of roof repair',
  roofLayers: 'Number of roof layers',
  pestControlInfo: 'Pest control company info',
  pestWarrantyCost: 'Pest warranty annual cost',
  pestWarrantyTime: 'Pest warranty time remaining',
  fireplaceInspectionDate: 'Last fireplace inspection date',
  septicLocation: 'Septic system location',
  electricalPanelLocation: 'Electrical panel location',
  electricalPanelSize: 'Electrical panel size (amps)',
  tax14aBondsAmount: 'Outstanding bond amount',
  tax14lAmount: 'HOA fee amount',
  tax14mDueDate: 'Assessment due date',
  tax14mAmount: 'Assessment amount',
  tax14mIncludes: 'Assessment includes',
  tax14mContact: 'HOA contact info',
  sec16iLocks: 'Electronic lock / security system details',
  electricCompany: 'Electric company name',
  electricPhone: 'Electric company phone',
  gasCompany: 'Gas company name',
  gasPhone: 'Gas company phone',
  waterCompany: 'Water company name',
  waterPhone: 'Water company phone',
  trashCompany: 'Trash company name',
  trashPhone: 'Trash company phone',
  otherUtility1: 'Other utility name',
  otherUtilityPhone1: 'Other utility phone',
  additionalComments: 'Additional comments or disclosures',

  // ── Exclusive Right to Sell ────────────────────────────────────────────────
  // Section 1 – Property & Listing Info
  text_7b43: 'Contract Date',
  text_2271: 'Seller Name & Marital Status',
  text_66d2: 'Broker / Brokerage Name',
  text_09d6: 'Property Address',
  text_ba8f: 'Legal Description Addendum Reference',
  text_d851: 'Legal Description (Line 1)',
  text_2af3: 'Legal Description (Line 2)',
  text_9b4d: 'Legal Description (Line 3)',
  text_aafa: 'Property Description / Parcel ID',
  text_aa36: 'Listing Start Date',
  text_7d47: 'Listing End Date',
  text_4614: 'List Price ($)',

  // Section 2 – MLS & Property Type
  checkbox_72a7: 'Authorize delayed MLS entry (showings on hold until MLS active date)',
  text_6637: 'MLS Active Date (if delayed entry)',
  checkbox_50af: 'Property Type: Residential Resale',
  checkbox_6534: 'Property Type: New Home Construction',
  checkbox_a38e: 'Property Type: Land',

  // Section 3 – Marketing Distribution
  checkbox_667d: 'Active with Full Distribution',
  checkbox_2cc6: 'Active with Limited Marketing Distribution',
  checkbox_4c2b: 'Coming Soon with Full Distribution',
  checkbox_da12: 'Coming Soon with No Distribution',
  checkbox_70ff: 'Private Office Exclusive / No Distribution',
  text_0b2a: 'Full Distribution Conversion Date',

  // Section 4 – Seller Obligations
  text_17d6: 'Forfeited Deposit Retained by Broker (%)',

  // Section 5 – Broker Authorization
  checkbox_0b84: 'Seller does NOT authorize broker to disclose reason for sale',
  checkbox_b20b: 'Seller authorizes broker to disclose motivating factors for sale',
  checkbox_e3f8: 'Seller does NOT authorize broker to disclose other offers',
  checkbox_c1e8: 'Seller authorizes broker to disclose existence of other offers',
  checkbox_e36d: 'Seller authorizes broker to disclose existence AND TERMS of other offers',

  // Section 6 – Brokerage Relationships
  checkbox_63bb: 'Seller Agency – Yes',
  checkbox_233e: 'Seller Agency – No',
  checkbox_38d2: 'Transaction Broker – Yes',
  checkbox_8d52: 'Transaction Broker – No',
  checkbox_ff84: 'Subagency – Yes',
  checkbox_93b4: 'Subagency – No',
  checkbox_4bf8: 'Dual Agency (Missouri only) – Yes',
  checkbox_6d73: 'Dual Agency (Missouri only) – No',
  checkbox_ccc5: 'Designated Agent for Seller (Kansas) – Yes',
  checkbox_e33b: 'Designated Agent for Seller (Kansas) – No',
  checkbox_51cc: 'Designated Agent for Buyer (Kansas) – Yes',
  checkbox_bb1e: 'Designated Agent for Buyer (Kansas) – No',

  // Section 7 – Compensation
  text_553d: 'Compensation to Listing Broker (description)',
  text_c328: 'Unrepresented Buyer – Additional Compensation',
  text_fa0f: 'Total Compensation to Listing Broker',
  checkbox_0565: 'Additional compensation applies if buyer is unrepresented',
  checkbox_de7d: 'Other Compensation (check if applicable)',
  text_1df4: 'Other Compensation Details',
  text_b309: 'Protection Period (calendar days)',

  // Section 8 – Title & Home Warranty
  text_8bde: 'Title Evidence Through (company/source)',
  text_6089: 'Title Vested in Name of',
  text_324c: 'Title Vesting Detail (Line 1)',
  text_7098: 'Title Vesting Detail (Line 2 — marital status, trust, LLC)',
  text_aff6: 'Home Warranty – Max Cost (not to exceed $)',
  text_df30: 'Home Warranty Vendor',
  checkbox_b19f: 'Seller agrees to purchase a home warranty',
  checkbox_89af: 'Seller does NOT agree to purchase a home warranty',
  text_45ab: 'Home Warranty Amount ($)',
  checkbox_fc9f: 'Seller does NOT agree to purchase a home warranty (alt)',

  // Section 9 – Additional Terms
  checkbox_457b: 'Franchise Disclosure (broker is a franchise member)',
  text_e03a: 'Additional Terms & Conditions (Line 1)',
  text_88f8: 'Additional Terms & Conditions (Line 2)',
  text_c470: 'Additional Terms & Conditions (Line 3)',
  text_0990: 'Additional Terms & Conditions (Line 4)',

  // Section 10 – Signatures & Contact
  text_a0fd: 'Brokerage Name',
  text_2780: 'Seller 1 – Printed Name',
  text_fca0: 'Seller 1 – Signature Date',
  text_a78e: 'Licensee Assisting Seller',
  text_c621: 'Licensee Date',
  text_056c: 'Seller 2 – Printed Name',
  text_f47a: 'Seller 2 – Signature Date',
  text_5d08: 'Seller Address',
  text_f4d2: 'Seller City, State, ZIP',
  text_e9ad: 'Seller Phone',
  text_e6cf: 'Seller Email',
  text_13d2: 'Designated Agent Name (Line 1)',
  text_7fd1: 'Designated Agent Name (Line 2)',
  text_4be4: "Broker's Signature Name",

  // Initials (page footers — shown but not in main sections)
  text_bed0: 'Seller 1 Initials',
  text_785a: 'Seller 2 Initials',
  text_5a7b: 'Seller 1 Initials',
  text_e2bb: 'Seller 2 Initials',
  text_f99b: 'Seller 1 Initials',
  text_9933: 'Seller 2 Initials',
  text_a2c8: 'Seller 1 Initials',
  text_365d: 'Seller 2 Initials',
  text_c8f2: 'Seller 1 Initials',
  text_9c24: 'Seller 2 Initials',
  text_c5f0: 'Seller 1 Initials',
  text_8d7c: 'Seller 2 Initials',
  text_98e7: 'Seller 1 Initials',
  text_6da7: 'Seller 2 Initials',
}

const CHOICE_LABELS: Record<string, string> = {
  land_a: 'Encroachments, easements, rights-of-way, or boundary disputes',
  land_b: 'Fill, sub-surface anomalies, or soil problems',
  land_c: 'Hazardous materials on or near the property',
  land_d: 'Drainage or flooding issues',
  land_e: 'Mine shafts or underground storage tanks',
  land_f: 'Located in a flood plain or flood zone',
  land_g: 'Proposed road, utility, or projects affecting property',
  land_h: 'Deed restrictions, covenants, or conditions',
  land_i: 'Septic system or leach field on neighboring property',
  land_j: 'Property in or near a special use district',
  land_j_belongs: 'Special district affects value or use',
  land_k: 'Neighborhood issues (noise, odors, nuisances)',
  land_l: 'Zoning violations or non-conforming use',
  land_m: 'Known planned development nearby',
  roof_b: 'Current roof leaks or moisture damage',
  roof_c: 'Roof repairs made in last 5 years',
  roof_d: 'Roof ever been replaced',
  infest_a: 'Active wood-destroying insect infestation',
  infest_b: 'Prior wood-destroying insect infestation',
  infest_c: 'Evidence of previous infestation damage',
  infest_d: 'Pest control treatments in last 5 years',
  infest_e: 'Pest control warranty in effect',
  infest_e_stays: 'Pest warranty transfers to buyer',
  struct_a: 'Settling, movement, or structural defects',
  struct_b: 'Cracks in walls, floors, or ceilings',
  struct_c: 'Water intrusion or moisture in basement/crawl space',
  struct_d: 'Exterior drainage or water runoff issues',
  struct_e: 'Structural repairs or modifications',
  struct_f: 'Fireplace or wood-burning stove',
  struct_g: 'Fireplace inspected in last 5 years',
  struct_h: 'Pool, spa, or hot tub on property',
  struct_i: 'Sauna or steam room',
  struct_j: 'Elevator or lift',
  add_a: 'Additions or improvements to structure',
  add_b: 'Permits obtained for all work',
  plumb_b: 'Plumbing issues or leaks',
  plumb_c: 'Water softener on property',
  plumb_d: 'Water filtration / treatment system',
  plumb_h: 'Septic system issues or repairs needed',
  plumb_i: 'Gas service to property',
  plumb_k: 'Sprinkler / irrigation system',
  plumb_k_covers: 'Sprinkler system covers entire property',
  plumb_l: 'Plumbing defects or known problems',
  plumb_m: 'Sump pump',
  hvac_a: 'Air conditioning system',
  hvac_b: 'Heating system',
  hvac_c: 'HVAC malfunctions or issues in last 5 years',
  hvac_d: 'Water heater',
  hvac_e: 'Any known HVAC issues',
  elec_c: 'Known electrical deficiencies',
  haz_a: 'Asbestos or asbestos-containing materials',
  haz_b: 'Radon testing done',
  haz_c: 'Lead-based paint or hazards',
  haz_d: 'Underground storage tanks (other than propane)',
  haz_e: 'Mold or mildew issues',
  haz_f: 'Environmental contamination',
  haz_g: 'Chinese drywall',
  haz_h: 'Substances requiring government cleanup',
  haz_i: 'Property used for commercial purposes',
  haz_j: 'Carbon monoxide detectors present',
  haz_k: 'Smoke detectors present',
  tax_a_outside_city: 'Property is outside city limits',
  tax_a_bonds: 'Outstanding special assessment bonds',
  tax_b: 'Delinquent property taxes',
  tax_c: 'Pending special assessments',
  tax_d: 'Property subject to abatement or tax credits',
  tax_e: 'Agricultural tax status',
  tax_f: "Mechanic's or materialman's liens",
  tax_g: 'Pending litigation affecting property',
  tax_h: 'Property in a Community Improvement District (CID)',
  tax_i: 'Property in a Transportation Development District (TDD)',
  tax_j: 'Subject to a solar energy system lease',
  tax_k: 'Subject to HOA',
  tax_l: 'HOA special assessment pending',
  tax_m: 'Regular HOA dues',
  tax_n: 'Property subject to right of first refusal',
  inspect: 'Any inspections completed in last 2 years',
  other_a: 'Shared driveways, party walls, or common areas',
  other_b: 'Deed restrictions or CC&Rs',
  other_c: 'Current or threatened legal action',
  other_d: 'Governmental notices or violations',
  other_e: 'Property used as rental or investment',
  other_f: 'Tenant currently occupying property',
  other_g: 'Underground oil tank ever on property',
  other_h: 'Known disputes with neighbors',
  other_i: 'Electronic security system or smart locks',
  other_j: 'Property located in historic district',
  other_k: 'Property subject to conservation easement',
  other_l: 'Liens or encumbrances',
  other_m: 'Known death on property in last 3 years',
  other_n: 'Other material defects not disclosed above',
  other_o: 'Pet odor or damage',
  other_p: 'Property used for drug manufacturing',
  other_q: 'Foundation treated for wood-destroying insects',
  other_r: 'Flood, fire, or other damage in past 5 years',
  other_r_repairs: 'Repairs completed after damage',
  other_s: 'Additional voluntary disclosures',
  elec_sys: 'Electrical system in good working order',
}

function autoLabel(key: string): string {
  const label = key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
}

export function getFieldLabel(key: string): string {
  if (FIELD_LABEL_MAP[key]) return FIELD_LABEL_MAP[key]
  const baseKey = key.replace(/_(yes|no|na)$/, '')
  if (CHOICE_LABELS[baseKey]) return CHOICE_LABELS[baseKey]
  return autoLabel(key)
}

export function getChoiceLabel(baseKey: string): string {
  if (CHOICE_LABELS[baseKey]) return CHOICE_LABELS[baseKey]
  return autoLabel(baseKey)
}

interface FieldCoordLite {
  field_key: string
  field_type: string
}

export function groupFieldsForSection(sectionFields: FieldCoordLite[]): ChatField[] {
  const grouped: ChatField[] = []
  const seen = new Set<string>()

  for (const f of sectionFields) {
    const key = f.field_key
    if (f.field_type === 'initial' || f.field_type === 'signature') continue

    const choiceMatch = key.match(/^(.+)_(yes|no|na|stays|removable)$/)
    if (choiceMatch) {
      const baseKey = choiceMatch[1]
      if (!seen.has(baseKey)) {
        seen.add(baseKey)
        const variants = ['yes', 'no', 'na', 'stays', 'removable'].filter(v =>
          sectionFields.some(x => x.field_key === `${baseKey}_${v}`)
        )
        grouped.push({ key: baseKey, type: 'choice', label: getChoiceLabel(baseKey), choices: variants })
      }
      continue
    }

    if (!seen.has(key)) {
      seen.add(key)
      grouped.push({ key, type: f.field_type, label: getFieldLabel(key) })
    }
  }

  return grouped
}

export function expandChatUpdates(
  updates: Record<string, unknown>,
  allFields: FieldCoordLite[]
): Record<string, string> {
  const expanded: Record<string, string> = {}
  const fieldKeys = new Set(allFields.map(f => f.field_key))
  const variants = ['yes', 'no', 'na', 'stays', 'removable', 'partial', 'complete', 'owned', 'leased']

  for (const [key, value] of Object.entries(updates)) {
    if (fieldKeys.has(key)) {
      expanded[key] = String(value ?? '')
    } else {
      const matchingVariants = variants.filter(v => fieldKeys.has(`${key}_${v}`))
      if (matchingVariants.length > 0) {
        for (const v of matchingVariants) {
          expanded[`${key}_${v}`] = String(value) === v ? 'true' : ''
        }
      } else {
        expanded[key] = String(value ?? '')
      }
    }
  }
  return expanded
}

export function getFormValues(
  formData: Record<string, string>,
  chatFields: ChatField[]
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const f of chatFields) {
    if (f.type === 'choice' && f.choices) {
      for (const choice of f.choices) {
        if (formData[`${f.key}_${choice}`] === 'true') {
          values[f.key] = choice
          break
        }
      }
    } else if (formData[f.key] !== undefined && formData[f.key] !== '') {
      values[f.key] = formData[f.key]
    }
  }
  return values
}
