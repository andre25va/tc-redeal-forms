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
}

const FIELD_LABEL_MAP: Record<string, string> = {
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
