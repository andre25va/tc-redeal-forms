// Locked conversation script for the AI chat mode.
// For scripted sections, the ChatWizard follows these steps exactly instead
// of letting GPT decide what to ask. This ensures 100% consistency.

export interface ScriptContext {
  s1name?: string
  s2name?: string
  address?: string
}

export interface ScriptStep {
  id: string
  question: (ctx: ScriptContext) => string
  questionEs: (ctx: ScriptContext) => string
  /** Direct form field key to set with the answer */
  fieldKey?: string
  /** Temporary storage key (prefixed with _), not sent to form */
  tempKey?: string
  /** Quick-reply chips (English) */
  options?: string[]
  /** Quick-reply chips (Spanish) */
  optionsEs?: string[]
  /** Allow free-text input even when options are shown */
  freeText?: boolean
  /** Skip this step if the condition is met */
  skipIf?: (vals: Record<string, unknown>) => boolean
  /** After collecting the answer, return extra field updates to apply */
  onAnswer?: (answer: string, vals: Record<string, unknown>) => Record<string, unknown>
  /** Multi-select: user toggles chips, then taps Continue to submit all at once */
  multiSelect?: boolean
}

// ── HEADER: Seller names + marital status + property address ─────────────────
export const HEADER_SCRIPT: ScriptStep[] = [
  {
    id: 'seller1_name',
    question: () => "What is Seller 1's full name?",
    questionEs: () => '¿Cuál es el nombre completo del Vendedor 1?',
    tempKey: '_s1_name',
    freeText: true,
  },
  {
    id: 'seller1_marital',
    question: ({ s1name }) => `What is ${s1name || 'Seller 1'}'s marital status?`,
    questionEs: ({ s1name }) => `¿Cuál es el estado civil de ${s1name || 'el Vendedor 1'}?`,
    tempKey: '_s1_marital',
    options: ['Married', 'Single', 'Divorced', 'Separated'],
    optionsEs: ['Casado/a', 'Soltero/a', 'Divorciado/a', 'Separado/a'],
    onAnswer: (answer, vals) => ({
      seller_1_name: `${(vals['_s1_name'] as string) || ''}, ${answer}`,
    }),
  },
  {
    id: 'has_seller2',
    question: () => 'Is there a Seller 2?',
    questionEs: () => '¿Hay un Vendedor 2?',
    tempKey: '_has_seller2',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
  },
  {
    id: 'seller2_name',
    question: () => "What is Seller 2's full name?",
    questionEs: () => '¿Cuál es el nombre completo del Vendedor 2?',
    tempKey: '_s2_name',
    freeText: true,
    skipIf: (vals) => vals['_has_seller2'] !== 'Yes' && vals['_has_seller2'] !== 'Sí',
  },
  {
    id: 'seller2_marital',
    question: ({ s2name }) => `What is ${s2name || 'Seller 2'}'s marital status?`,
    questionEs: ({ s2name }) => `¿Cuál es el estado civil de ${s2name || 'el Vendedor 2'}?`,
    tempKey: '_s2_marital',
    options: ['Married', 'Single', 'Divorced', 'Separated'],
    optionsEs: ['Casado/a', 'Soltero/a', 'Divorciado/a', 'Separado/a'],
    skipIf: (vals) => vals['_has_seller2'] !== 'Yes' && vals['_has_seller2'] !== 'Sí',
    onAnswer: (answer, vals) => ({
      seller_2_name: `${(vals['_s2_name'] as string) || ''}, ${answer}`,
    }),
  },
  // ── Address: stored as temp until confirmed ──────────────────────────────
  {
    id: 'property_address',
    question: () => 'What is the property address?',
    questionEs: () => '¿Cuál es la dirección de la propiedad?',
    tempKey: '_pending_address',
    freeText: true,
  },
  {
    id: 'address_confirm',
    question: (ctx) =>
      `Just to confirm — is this the right address?\n\n📍 **${ctx.address || ''}**`,
    questionEs: (ctx) =>
      `Solo para confirmar — ¿es esta la dirección correcta?\n\n📍 **${ctx.address || ''}**`,
    tempKey: '_addr_confirmed',
    options: ["Yes, that's correct ✓", 'Let me fix it'],
    optionsEs: ['Sí, es correcto ✓', 'Necesito corregirlo'],
    skipIf: (vals) => !vals['_pending_address'],
    onAnswer: (answer, vals) => {
      const needsFix = /let me fix|fix it|necesito corregir/i.test(answer)
      if (needsFix) {
        return { _pending_address: '', _addr_confirmed: 'fix' }
      }
      return {
        property_address: (vals['_pending_address'] as string) || '',
        _addr_confirmed: 'yes',
      }
    },
  },
  {
    id: 'property_address_fix',
    question: () => 'What is the correct address?',
    questionEs: () => '¿Cuál es la dirección correcta?',
    tempKey: '_pending_address',
    freeText: true,
    skipIf: (vals) => vals['_addr_confirmed'] !== 'fix',
    onAnswer: (answer) => ({
      property_address: answer,
      _addr_confirmed: 'yes',
    }),
  },
]

// ── OCCUPANCY ────────────────────────────────────────────────────────────────
export const OCCUPANCY_SCRIPT: ScriptStep[] = [
  {
    id: 'occ_property_age',
    question: ({ address }) =>
      `What is the approximate age of the property${address ? ` at ${address}` : ''}? (years)`,
    questionEs: ({ address }) =>
      `¿Cuál es la edad aproximada de la propiedad${address ? ` en ${address}` : ''}? (años)`,
    fieldKey: 'occ_property_age',
    freeText: true,
    skipIf: (vals) => !!vals['occ_property_age'],
  },
  {
    id: 'occ_years_owned',
    question: () => 'How long have you owned the property?',
    questionEs: () => '¿Cuánto tiempo ha sido dueño de la propiedad?',
    fieldKey: 'occ_years_owned',
    freeText: true,
  },
  {
    id: 'occ_seller_occupies',
    question: () => 'Do you currently live in the property?',
    questionEs: () => '¿Actualmente vive en la propiedad?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      occ_seller_occupies: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
    }),
  },
  {
    id: 'occ_not_occupied_years',
    question: () => 'How long has it been since someone lived there?',
    questionEs: () => '¿Cuánto tiempo ha pasado desde que alguien vivió allí?',
    fieldKey: 'occ_not_occupied_years',
    freeText: true,
    skipIf: (vals) => vals['occ_seller_occupies'] === 'yes',
  },
]

// ── CONSTRUCTION TYPE ────────────────────────────────────────────────────────
export const CONSTRUCTION_SCRIPT: ScriptStep[] = [
  {
    id: 'construction_type',
    question: () => 'What type of construction is the property?',
    questionEs: () => '¿Qué tipo de construcción es la propiedad?',
    options: ['Conventional/Wood Frame', 'Modular', 'Manufactured', 'Mobile', 'Other'],
    optionsEs: ['Convencional/Madera', 'Modular', 'Fabricada', 'Móvil', 'Otro'],
    tempKey: '_const_type',
    onAnswer: (answer) => ({
      const_conventional: answer === 'Conventional/Wood Frame' || answer === 'Convencional/Madera',
      const_modular: answer === 'Modular',
      const_manufactured: answer === 'Manufactured' || answer === 'Fabricada',
      const_mobile: answer === 'Mobile' || answer === 'Móvil',
      _const_is_other: answer === 'Other' || answer === 'Otro',
    }),
  },
  {
    id: 'construction_other',
    question: () => 'Describe the construction type:',
    questionEs: () => 'Describa el tipo de construcción:',
    fieldKey: 'const_other',
    freeText: true,
    skipIf: (vals) => !vals['_const_is_other'],
  },
]

// ── LAND, SOILS & BOUNDARIES ─────────────────────────────────────────────────
const LAND_ITEM_MAP: Record<string, string> = {
  'Fill or Expansive Soil':              'land_a',
  'Sliding / Settling / Earth Movement': 'land_b',
  'Flood Zone / Wetlands (FEMA)':        'land_c',
  'Drainage or Flood Problems':          'land_d',
  'Flood Insurance Premiums Paid':       'land_e',
  'Need for Flood Insurance':            'land_f',
  'Boundaries Marked':                   'land_g',
  'Stake Survey':                        'land_h',
  'Encroachments / Boundary Disputes':   'land_i',
  'Fencing on Property':                 'land_j',
  'Diseased / Dead / Damaged Trees':     'land_k',
  'Gas/Oil Wells or Lines on Property':  'land_l',
  'Oil/Gas Leases / Mineral Rights':     'land_m',
}

export const LAND_SCRIPT: ScriptStep[] = [
  {
    id: 'land_batch',
    multiSelect: true,
    question: () => 'For Land, Soils & Boundaries — tap everything that applies:',
    questionEs: () => 'Para Terreno, Suelos y Límites — seleccione todo lo que aplique:',
    options: Object.keys(LAND_ITEM_MAP),
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const updates: Record<string, unknown> = {}
      Object.entries(LAND_ITEM_MAP).forEach(([label, fieldKey]) => {
        updates[fieldKey] = selected.has(label) ? 'yes' : 'no'
      })
      updates['_land_has_yes'] = selected.size > 0
      updates['_land_has_fencing'] = selected.has('Fencing on Property')
      return updates
    },
  },
  {
    id: 'land_fencing_belongs',
    question: () => 'Does the fencing belong to the property?',
    questionEs: () => '¿Pertenece la cerca a la propiedad?',
    options: ['Yes – Belongs to Property', 'No – Shared / Not Part of Property', 'N/A'],
    optionsEs: ['Sí – Pertenece a la propiedad', 'No – Compartida / No pertenece', 'N/A'],
    skipIf: (vals) => !vals['_land_has_fencing'],
    onAnswer: (answer) => ({
      land_j_belongs:
        answer.startsWith('Yes') || answer.startsWith('Sí') ? 'yes'
        : answer.startsWith('No') ? 'no'
        : 'na',
    }),
  },
  {
    id: 'land_comments',
    question: () => 'Briefly explain any items you flagged:',
    questionEs: () => 'Explique brevemente los elementos marcados:',
    fieldKey: 'land_comments',
    freeText: true,
    skipIf: (vals) => !vals['_land_has_yes'],
  },
]

// ── ROOF ─────────────────────────────────────────────────────────────────────
export const ROOF_SCRIPT: ScriptStep[] = [
  {
    id: 'roof_age',
    question: () => 'Approximately how old is the roof? (years)',
    questionEs: () => '¿Aproximadamente cuántos años tiene el techo? (años)',
    fieldKey: 'roof_age',
    freeText: true,
  },
  {
    id: 'roof_type',
    question: () => 'What type of roof is it?',
    questionEs: () => '¿Qué tipo de techo tiene?',
    fieldKey: 'roof_type',
    options: ['Shingle', 'Tile', 'Flat/TPO', 'Metal', 'Shake/Wood', 'Other'],
    optionsEs: ['Teja asfáltica', 'Teja de barro', 'Plano/TPO', 'Metal', 'Madera', 'Otro'],
    freeText: true,
  },
  {
    id: 'roof_layers',
    question: () => 'How many layers of roofing material are there?',
    questionEs: () => '¿Cuántas capas de material de techo hay?',
    fieldKey: 'roof_layers',
    options: ['1', '2', '3+', "Don't know"],
    optionsEs: ['1', '2', '3+', 'No sé'],
    freeText: true,
  },
  {
    id: 'roof_b',
    question: () => 'Have there been any problems with the roof, flashing, or gutters?',
    questionEs: () => '¿Ha habido algún problema con el techo, destellos o canalones?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      roof_b: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _roof_b_yes: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'roof_b_date',
    question: () => 'When did the roof problem occur? (date or approximate year)',
    questionEs: () => '¿Cuándo ocurrió el problema con el techo?',
    fieldKey: 'roof_b_date',
    freeText: true,
    skipIf: (vals) => !vals['_roof_b_yes'],
  },
  {
    id: 'roof_c',
    question: () => 'Have any repairs been made to the roof, flashing, or gutters?',
    questionEs: () => '¿Se han realizado reparaciones al techo, destellos o canalones?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      roof_c: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _roof_c_yes: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'roof_c_date_company',
    question: () => 'Who did the repairs and when? (company name and date)',
    questionEs: () => '¿Quién hizo las reparaciones y cuándo? (nombre de empresa y fecha)',
    fieldKey: 'roof_c_date_company',
    freeText: true,
    skipIf: (vals) => !vals['_roof_c_yes'],
  },
  {
    id: 'roof_d',
    question: () => 'Has the roof ever been replaced?',
    questionEs: () => '¿Se ha reemplazado el techo alguna vez?',
    options: ['Yes – Complete', 'Yes – Partial', 'No'],
    optionsEs: ['Sí – Completo', 'Sí – Parcial', 'No'],
    onAnswer: (answer) => {
      const isComplete = answer === 'Yes – Complete' || answer === 'Sí – Completo'
      const isPartial = answer === 'Yes – Partial' || answer === 'Sí – Parcial'
      return {
        roof_d: isComplete || isPartial ? 'yes' : 'no',
        roof_d_complete: isComplete,
        roof_d_partial: isPartial,
      }
    },
  },
]

// ── INFESTATION ───────────────────────────────────────────────────────────────
export const INFESTATION_SCRIPT: ScriptStep[] = [
  {
    id: 'infest_batch',
    multiSelect: true,
    question: () => 'Infestation — tap everything that applies:',
    questionEs: () => 'Infestación — seleccione todo lo que aplique:',
    options: [
      'Termites / Wood Destroying Insects',
      'Other Pests (rodents, bats, wildlife)',
      'Damage by Pests',
      'Pest Control Treatment in Last 5 Years',
    ],
    optionsEs: [
      'Termitas / Insectos destructores de madera',
      'Otras plagas (roedores, murciélagos, fauna)',
      'Daño por plagas',
      'Tratamiento de control de plagas en los últimos 5 años',
    ],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const labels = [
        'Termites / Wood Destroying Insects',
        'Other Pests (rodents, bats, wildlife)',
        'Damage by Pests',
        'Pest Control Treatment in Last 5 Years',
      ]
      const keys = ['infest_a', 'infest_b', 'infest_c', 'infest_d']
      const updates: Record<string, unknown> = {}
      labels.forEach((label, i) => {
        updates[keys[i]] = selected.has(label) ? 'yes' : 'no'
      })
      updates['_infest_treatment'] = selected.has('Pest Control Treatment in Last 5 Years')
      updates['_infest_has_yes'] = selected.size > 0
      return updates
    },
  },
  {
    id: 'infest_d_details',
    question: () => 'For the pest treatment — company name, when, and where treated:',
    questionEs: () => 'Para el tratamiento de plagas — nombre de la empresa, cuándo y dónde:',
    fieldKey: 'infest_d_details',
    freeText: true,
    skipIf: (vals) => !vals['_infest_treatment'],
  },
  {
    id: 'infest_e',
    question: () => 'Is there a current pest warranty or bait station coverage?',
    questionEs: () => '¿Existe actualmente una garantía de plagas o cobertura de estación de cebo?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      infest_e: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _infest_warranty: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'infest_e_cost',
    question: () => 'Annual renewal cost? ($)',
    questionEs: () => '¿Costo anual de renovación? ($)',
    fieldKey: 'infest_e_cost',
    freeText: true,
    skipIf: (vals) => !vals['_infest_warranty'],
  },
  {
    id: 'infest_e_time',
    question: () => 'How much time is remaining on the contract?',
    questionEs: () => '¿Cuánto tiempo queda en el contrato?',
    fieldKey: 'infest_e_time',
    freeText: true,
    skipIf: (vals) => !vals['_infest_warranty'],
  },
  {
    id: 'infest_e_stays',
    question: () => 'Does the treatment system stay with the property?',
    questionEs: () => '¿El sistema de tratamiento se queda con la propiedad?',
    options: ['Stays with Property', 'Subject to Removal'],
    optionsEs: ['Se queda con la propiedad', 'Sujeto a retiro'],
    skipIf: (vals) => !vals['_infest_warranty'],
    onAnswer: (answer) => ({
      infest_e_stays: answer === 'Stays with Property' || answer === 'Se queda con la propiedad',
      infest_e_removable: answer === 'Subject to Removal' || answer === 'Sujeto a retiro',
    }),
  },
  {
    id: 'infest_comments',
    question: () => 'Briefly explain:',
    questionEs: () => 'Explique brevemente:',
    fieldKey: 'infest_comments',
    freeText: true,
    skipIf: (vals) => !vals['_infest_has_yes'],
  },
]

// ── STRUCTURAL & BASEMENT ─────────────────────────────────────────────────────
export const STRUCTURAL_SCRIPT: ScriptStep[] = [
  {
    id: 'struct_batch',
    multiSelect: true,
    question: () => 'Structural & Basement — tap everything that applies:',
    questionEs: () => 'Estructura y Sótano — seleccione todo lo que aplique:',
    options: [
      'Movement / Shifting / Foundations',
      'Cracks in Walls / Ceilings / Slab',
      'Corrective Action (piering/bracing)',
      'Water Leakage / Dampness',
      'Dry Rot / Wood Rot',
      'Problems with Windows / Exterior Doors',
      'Driveways / Patios / Decks / Retaining Walls',
    ],
    optionsEs: [
      'Movimiento / Desplazamiento / Cimientos',
      'Grietas en paredes / techos / losa',
      'Acción correctiva (pilotes/refuerzos)',
      'Filtración de agua / Humedad',
      'Pudrición seca / Pudrición de madera',
      'Problemas con ventanas / puertas exteriores',
      'Entradas / Patios / Terrazas / Muros de contención',
    ],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const labels = [
        'Movement / Shifting / Foundations',
        'Cracks in Walls / Ceilings / Slab',
        'Corrective Action (piering/bracing)',
        'Water Leakage / Dampness',
        'Dry Rot / Wood Rot',
        'Problems with Windows / Exterior Doors',
        'Driveways / Patios / Decks / Retaining Walls',
      ]
      const keys = ['struct_a', 'struct_b', 'struct_c', 'struct_d', 'struct_e', 'struct_f', 'struct_g']
      const updates: Record<string, unknown> = {}
      labels.forEach((label, i) => {
        updates[keys[i]] = selected.has(label) ? 'yes' : 'no'
      })
      updates['_struct_has_yes'] = selected.size > 0
      return updates
    },
  },
  {
    id: 'struct_h',
    question: () => 'Any problems with the fireplace, firebox, or chimney?',
    questionEs: () => '¿Algún problema con la chimenea, el hogar o el conducto de humos?',
    options: ['Yes', 'No', 'N/A – No Fireplace'],
    optionsEs: ['Sí', 'No', 'N/A – Sin chimenea'],
    onAnswer: (answer) => {
      let val: string
      if (answer === 'Yes' || answer === 'Sí') val = 'yes'
      else if (answer === 'No') val = 'no'
      else val = 'na'
      return {
        struct_h: val,
        _struct_h_yes: val === 'yes',
      }
    },
  },
  {
    id: 'struct_h_repairs_date',
    question: () => 'Date of last fireplace repairs or inspection:',
    questionEs: () => 'Fecha de la última reparación o inspección de la chimenea:',
    fieldKey: 'struct_h_repairs_date',
    freeText: true,
    skipIf: (vals) => vals['struct_h'] !== 'yes',
  },
  {
    id: 'struct_h_last_use',
    question: () => 'Date of last fireplace use:',
    questionEs: () => 'Fecha del último uso de la chimenea:',
    fieldKey: 'struct_h_last_use',
    freeText: true,
    skipIf: (vals) => vals['struct_h'] !== 'yes',
  },
  {
    id: 'struct_i',
    question: () => 'Is there a sump pump?',
    questionEs: () => '¿Hay una bomba de sumidero?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      struct_i: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _struct_sump: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'struct_i_location',
    question: () => 'Where is the sump pump located?',
    questionEs: () => '¿Dónde está ubicada la bomba de sumidero?',
    fieldKey: 'struct_i_location',
    freeText: true,
    skipIf: (vals) => !vals['_struct_sump'],
  },
  {
    id: 'struct_j',
    question: () => 'Have any repairs been made to control structural problems?',
    questionEs: () => '¿Se han realizado reparaciones para controlar problemas estructurales?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      struct_j: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
    }),
  },
  {
    id: 'struct_comments',
    question: () => 'Briefly explain any structural items:',
    questionEs: () => 'Explique brevemente los elementos estructurales:',
    fieldKey: 'struct_comments',
    freeText: true,
    skipIf: (vals) => !vals['_struct_has_yes'] && !vals['_struct_h_yes'],
  },
]

// ── ADDITIONS & STRUCTURAL CHANGES ────────────────────────────────────────────
export const ADDITIONS_SCRIPT: ScriptStep[] = [
  {
    id: 'add_a',
    question: () => 'Have any additions or structural changes been made to the property?',
    questionEs: () => '¿Se han realizado adiciones o cambios estructurales en la propiedad?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      add_a: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _add_a_yes: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'add_a_details',
    question: () => 'Describe the additions or changes:',
    questionEs: () => 'Describa las adiciones o cambios:',
    fieldKey: 'add_a_details',
    freeText: true,
    skipIf: (vals) => !vals['_add_a_yes'],
  },
  {
    id: 'add_b',
    question: () => 'Were permits and approvals obtained?',
    questionEs: () => '¿Se obtuvieron permisos y aprobaciones?',
    options: ['Yes', 'No', 'N/A'],
    optionsEs: ['Sí', 'No', 'N/A'],
    skipIf: (vals) => !vals['_add_a_yes'],
    onAnswer: (answer) => {
      let val: string
      if (answer === 'Yes' || answer === 'Sí') val = 'yes'
      else if (answer === 'No') val = 'no'
      else val = 'na'
      return {
        add_b: val,
        _add_b_no: val === 'no',
      }
    },
  },
  {
    id: 'add_b_details',
    question: () => 'Explain why permits were not obtained:',
    questionEs: () => 'Explique por qué no se obtuvieron los permisos:',
    fieldKey: 'add_b_details',
    freeText: true,
    skipIf: (vals) => !vals['_add_b_no'],
  },
]

// ── PLUMBING ──────────────────────────────────────────────────────────────────
export const PLUMBING_SCRIPT: ScriptStep[] = [
  {
    id: 'plumb_water_source',
    question: () => 'What is the water source?',
    questionEs: () => '¿Cuál es la fuente de agua?',
    options: ['Public', 'Private', 'Well', 'Cistern', 'Other'],
    optionsEs: ['Pública', 'Privada', 'Pozo', 'Cisterna', 'Otra'],
    onAnswer: (answer) => ({
      plumb_water_public: answer === 'Public' || answer === 'Pública',
      plumb_water_private: answer === 'Private' || answer === 'Privada',
      plumb_water_well: answer === 'Well' || answer === 'Pozo',
      plumb_water_cistern: answer === 'Cistern' || answer === 'Cisterna',
      plumb_water_other: answer === 'Other' || answer === 'Otra' ? answer : false,
      _plumb_is_well: answer === 'Well' || answer === 'Pozo',
      _plumb_water_other: answer === 'Other' || answer === 'Otra',
    }),
  },
  {
    id: 'plumb_water_other_desc',
    question: () => 'Describe the water source:',
    questionEs: () => 'Describa la fuente de agua:',
    fieldKey: 'plumb_water_other',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_water_other'],
  },
  {
    id: 'plumb_well_type',
    question: () => 'Well type:',
    questionEs: () => 'Tipo de pozo:',
    fieldKey: 'plumb_well_type',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_is_well'],
  },
  {
    id: 'plumb_well_depth',
    question: () => 'Well depth (ft):',
    questionEs: () => 'Profundidad del pozo (pies):',
    fieldKey: 'plumb_well_depth',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_is_well'],
  },
  {
    id: 'plumb_well_diameter',
    question: () => 'Well diameter (in):',
    questionEs: () => 'Diámetro del pozo (pulgadas):',
    fieldKey: 'plumb_well_diameter',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_is_well'],
  },
  {
    id: 'plumb_well_age',
    question: () => 'Approximate well age (years):',
    questionEs: () => 'Edad aproximada del pozo (años):',
    fieldKey: 'plumb_well_age',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_is_well'],
  },
  {
    id: 'plumb_b',
    question: () => 'Has well water been tested for safety?',
    questionEs: () => '¿Se ha probado el agua del pozo para verificar su seguridad?',
    options: ['Yes', 'No', 'N/A'],
    optionsEs: ['Sí', 'No', 'N/A'],
    skipIf: (vals) => !vals['_plumb_is_well'],
    onAnswer: (answer) => {
      let val: string
      if (answer === 'Yes' || answer === 'Sí') val = 'yes'
      else if (answer === 'No') val = 'no'
      else val = 'na'
      return {
        plumb_b: val,
        _plumb_water_tested: val === 'yes',
      }
    },
  },
  {
    id: 'plumb_b_date',
    question: () => 'When was it last tested?',
    questionEs: () => '¿Cuándo fue la última prueba?',
    fieldKey: 'plumb_b_date',
    freeText: true,
    skipIf: (vals) => vals['plumb_b'] !== 'yes',
  },
  {
    id: 'plumb_c',
    question: () => 'Is there a water softener?',
    questionEs: () => '¿Hay un suavizador de agua?',
    options: ['Yes – Owned', 'Yes – Leased', 'No'],
    optionsEs: ['Sí – Propio', 'Sí – Arrendado', 'No'],
    onAnswer: (answer) => {
      const isOwned = answer === 'Yes – Owned' || answer === 'Sí – Propio'
      const isLeased = answer === 'Yes – Leased' || answer === 'Sí – Arrendado'
      return {
        plumb_c: isOwned || isLeased ? 'yes' : 'no',
        plumb_c_owned: isOwned,
        plumb_c_leased: isLeased,
      }
    },
  },
  {
    id: 'plumb_d',
    question: () => 'Is there a water purification system?',
    questionEs: () => '¿Hay un sistema de purificación de agua?',
    options: ['Yes – Owned', 'Yes – Leased', 'No'],
    optionsEs: ['Sí – Propio', 'Sí – Arrendado', 'No'],
    onAnswer: (answer) => {
      const isOwned = answer === 'Yes – Owned' || answer === 'Sí – Propio'
      const isLeased = answer === 'Yes – Leased' || answer === 'Sí – Arrendado'
      return {
        plumb_d: isOwned || isLeased ? 'yes' : 'no',
        plumb_d_owned: isOwned,
        plumb_d_leased: isLeased,
      }
    },
  },
  {
    id: 'plumb_sewage',
    question: () => 'Sewage system type?',
    questionEs: () => '¿Tipo de sistema de alcantarillado?',
    options: ['Public Sewer', 'Private Sewer', 'Septic System', 'Cesspool', 'Lagoon', 'Other'],
    optionsEs: ['Alcantarillado público', 'Alcantarillado privado', 'Sistema séptico', 'Pozo negro', 'Laguna', 'Otro'],
    onAnswer: (answer) => ({
      plumb_sewer_public: answer === 'Public Sewer' || answer === 'Alcantarillado público',
      plumb_sewer_private: answer === 'Private Sewer' || answer === 'Alcantarillado privado',
      plumb_sewer_septic: answer === 'Septic System' || answer === 'Sistema séptico',
      plumb_sewer_cesspool: answer === 'Cesspool' || answer === 'Pozo negro',
      plumb_sewer_lagoon: answer === 'Lagoon' || answer === 'Laguna',
      _plumb_is_septic: answer === 'Septic System' || answer === 'Sistema séptico',
      _plumb_sewer_other: answer === 'Other' || answer === 'Otro',
    }),
  },
  {
    id: 'plumb_sewer_other_desc',
    question: () => 'Describe the sewage system:',
    questionEs: () => 'Describa el sistema de alcantarillado:',
    fieldKey: 'plumb_sewer_other',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_sewer_other'],
  },
  {
    id: 'plumb_septic_tanks',
    question: () => 'How many septic tanks?',
    questionEs: () => '¿Cuántos tanques sépticos hay?',
    options: ['1', '2', '3+'],
    optionsEs: ['1', '2', '3+'],
    fieldKey: 'plumb_septic_tanks',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_is_septic'],
  },
  {
    id: 'plumb_f',
    question: () => 'Where is the septic tank / absorption field located?',
    questionEs: () => '¿Dónde está ubicado el tanque séptico / campo de absorción?',
    fieldKey: 'plumb_f',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_is_septic'],
  },
  {
    id: 'plumb_g',
    question: () => 'Where is the sewer line clean-out trap?',
    questionEs: () => '¿Dónde está la trampa de limpieza de la línea de alcantarillado?',
    fieldKey: 'plumb_g',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_is_septic'],
  },
  {
    id: 'plumb_h',
    question: () => 'Is there a sewage pump on the septic?',
    questionEs: () => '¿Hay una bomba de aguas residuales en el séptico?',
    options: ['Yes', 'No', 'N/A'],
    optionsEs: ['Sí', 'No', 'N/A'],
    skipIf: (vals) => !vals['_plumb_is_septic'],
    onAnswer: (answer) => {
      let val: string
      if (answer === 'Yes' || answer === 'Sí') val = 'yes'
      else if (answer === 'No') val = 'no'
      else val = 'na'
      return { plumb_h: val }
    },
  },
  {
    id: 'plumb_i',
    question: () => 'Is there a grinder pump system?',
    questionEs: () => '¿Hay un sistema de bomba trituradora?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    skipIf: (vals) => !vals['_plumb_is_septic'],
    onAnswer: (answer) => ({
      plumb_i: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
    }),
  },
  {
    id: 'plumb_j',
    question: () => 'When was the septic last serviced, and by whom?',
    questionEs: () => '¿Cuándo fue el último servicio del séptico y quién lo realizó?',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_is_septic'],
    onAnswer: (answer) => ({
      plumb_j_date: answer,
    }),
  },
  {
    id: 'plumb_k',
    question: () => 'Is there a lawn sprinkler system?',
    questionEs: () => '¿Hay un sistema de aspersores para el jardín?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      plumb_k: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _plumb_sprinkler: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'plumb_k_full_yard',
    question: () => 'Does it cover the full yard?',
    questionEs: () => '¿Cubre todo el jardín?',
    options: ['Yes', 'No', 'N/A'],
    optionsEs: ['Sí', 'No', 'N/A'],
    skipIf: (vals) => !vals['_plumb_sprinkler'],
    onAnswer: (answer) => {
      let val: string
      if (answer === 'Yes' || answer === 'Sí') val = 'yes'
      else if (answer === 'No') val = 'no'
      else val = 'na'
      return { plumb_k_full_yard: val }
    },
  },
  {
    id: 'plumb_k_last_use',
    question: () => 'When was the sprinkler last used? (month/year)',
    questionEs: () => '¿Cuándo se usó el aspersor por última vez? (mes/año)',
    fieldKey: 'plumb_k_last_use',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_sprinkler'],
  },
  {
    id: 'plumb_k_last_service',
    question: () => 'When was it last serviced? (month/year)',
    questionEs: () => '¿Cuándo fue el último servicio? (mes/año)',
    fieldKey: 'plumb_k_last_service',
    freeText: true,
    skipIf: (vals) => !vals['_plumb_sprinkler'],
  },
  {
    id: 'plumb_l',
    question: () => 'Is there a swimming pool?',
    questionEs: () => '¿Hay una piscina?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      plumb_l: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
    }),
  },
  {
    id: 'plumb_m',
    question: () => 'Any plumbing leaks, backups, or problems?',
    questionEs: () => '¿Alguna fuga, respaldo o problema de plomería?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      plumb_m: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _plumb_m_yes: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'plumb_materials',
    multiSelect: true,
    question: () => 'What types of pipe are in the home?',
    questionEs: () => '¿Qué tipos de tubería hay en la casa?',
    options: ['Copper', 'Galvanized', 'PVC', 'PEX', 'Polybutylene', 'Unknown'],
    optionsEs: ['Cobre', 'Galvanizado', 'PVC', 'PEX', 'Polibutileno', 'Desconocido'],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      return {
        plumb_mat_copper: selected.has('Copper'),
        plumb_mat_galvanized: selected.has('Galvanized'),
        plumb_mat_pvc: selected.has('PVC'),
        plumb_mat_pex: selected.has('PEX'),
        plumb_mat_polybutylene: selected.has('Polybutylene'),
        plumb_mat_unknown: selected.has('Unknown'),
      }
    },
  },
  {
    id: 'plumb_shutoff',
    question: () => 'Where is the main water shut-off?',
    questionEs: () => '¿Dónde está la llave de paso principal del agua?',
    fieldKey: 'plumb_shutoff_location',
    freeText: true,
  },
  {
    id: 'plumb_o',
    question: () => 'Is there a backflow prevention device?',
    questionEs: () => '¿Hay un dispositivo de prevención de reflujo?',
    options: ['Yes', 'No', 'N/A'],
    optionsEs: ['Sí', 'No', 'N/A'],
    onAnswer: (answer) => {
      let val: string
      if (answer === 'Yes' || answer === 'Sí') val = 'yes'
      else if (answer === 'No') val = 'no'
      else val = 'na'
      return { plumb_o: val }
    },
  },
]

// ── HVAC ──────────────────────────────────────────────────────────────────────
export const HVAC_SCRIPT: ScriptStep[] = [
  {
    id: 'hvac_a',
    question: () => 'Does the property have air conditioning?',
    questionEs: () => '¿La propiedad tiene aire acondicionado?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      hvac_a: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _hvac_has_ac: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'hvac_a_types',
    multiSelect: true,
    question: () => 'What type(s) of AC?',
    questionEs: () => '¿Qué tipo(s) de aire acondicionado?',
    options: ['Central Electric', 'Central Gas', 'Heat Pump', 'Window Units'],
    optionsEs: ['Eléctrico central', 'Gas central', 'Bomba de calor', 'Unidades de ventana'],
    skipIf: (vals) => !vals['_hvac_has_ac'],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      return {
        hvac_a_central_elec: selected.has('Central Electric'),
        hvac_a_central_gas: selected.has('Central Gas'),
        hvac_a_heat_pump: selected.has('Heat Pump'),
        hvac_a_window: selected.has('Window Units'),
      }
    },
  },
  {
    id: 'hvac_a_using',
    question: () => 'Is the AC currently in use?',
    questionEs: () => '¿El aire acondicionado está actualmente en uso?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    skipIf: (vals) => !vals['_hvac_has_ac'],
    onAnswer: (answer) => ({
      hvac_a_using: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _hvac_ac_not_using: answer === 'No',
    }),
  },
  {
    id: 'hvac_a_last_use',
    question: () => 'When was the AC last used?',
    questionEs: () => '¿Cuándo se usó el aire acondicionado por última vez?',
    fieldKey: 'hvac_a_last_use',
    freeText: true,
    skipIf: (vals) => !vals['_hvac_ac_not_using'],
  },
  {
    id: 'hvac_a_unit1',
    question: () => 'AC Unit 1 — make, model, approximate age:',
    questionEs: () => 'Unidad de AC 1 — marca, modelo, edad aproximada:',
    fieldKey: 'hvac_a_unit1',
    freeText: true,
    skipIf: (vals) => !vals['_hvac_has_ac'],
  },
  {
    id: 'hvac_b',
    question: () => 'Is there a heating system?',
    questionEs: () => '¿Hay un sistema de calefacción?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      hvac_b: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _hvac_has_heat: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'hvac_b_types',
    multiSelect: true,
    question: () => 'What type(s) of heating?',
    questionEs: () => '¿Qué tipo(s) de calefacción?',
    options: ['Electric', 'Fuel Oil', 'Natural Gas', 'Heat Pump', 'Propane', 'Fuel Tank', 'Other'],
    optionsEs: ['Eléctrico', 'Aceite combustible', 'Gas natural', 'Bomba de calor', 'Propano', 'Tanque de combustible', 'Otro'],
    skipIf: (vals) => !vals['_hvac_has_heat'],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      return {
        hvac_b_electric: selected.has('Electric'),
        hvac_b_fuel_oil: selected.has('Fuel Oil'),
        hvac_b_natural_gas: selected.has('Natural Gas'),
        hvac_b_heat_pump: selected.has('Heat Pump'),
        hvac_b_propane: selected.has('Propane'),
        hvac_b_fuel_tank: selected.has('Fuel Tank'),
        _hvac_b_other: selected.has('Other'),
      }
    },
  },
  {
    id: 'hvac_b_other_desc',
    question: () => 'Describe the heating type:',
    questionEs: () => 'Describa el tipo de calefacción:',
    fieldKey: 'hvac_b_other',
    freeText: true,
    skipIf: (vals) => !vals['_hvac_b_other'],
  },
  {
    id: 'hvac_b_using',
    question: () => 'Is the heating currently in use?',
    questionEs: () => '¿La calefacción está actualmente en uso?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    skipIf: (vals) => !vals['_hvac_has_heat'],
    onAnswer: (answer) => ({
      hvac_b_using: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _hvac_heat_not_using: answer === 'No',
    }),
  },
  {
    id: 'hvac_b_last_use',
    question: () => 'When was heating last used?',
    questionEs: () => '¿Cuándo se usó la calefacción por última vez?',
    fieldKey: 'hvac_b_last_use',
    freeText: true,
    skipIf: (vals) => !vals['_hvac_heat_not_using'],
  },
  {
    id: 'hvac_b_unit1',
    question: () => 'Heating Unit 1 — make, model, approximate age:',
    questionEs: () => 'Unidad de calefacción 1 — marca, modelo, edad aproximada:',
    fieldKey: 'hvac_b_unit1',
    freeText: true,
    skipIf: (vals) => !vals['_hvac_has_heat'],
  },
  {
    id: 'hvac_c',
    question: () => 'Are there any rooms without heat or AC?',
    questionEs: () => '¿Hay habitaciones sin calefacción o aire acondicionado?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      hvac_c: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _hvac_c_yes: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'hvac_c_rooms',
    question: () => 'Which rooms?',
    questionEs: () => '¿Qué habitaciones?',
    fieldKey: 'hvac_c_rooms',
    freeText: true,
    skipIf: (vals) => !vals['_hvac_c_yes'],
  },
  {
    id: 'hvac_d',
    question: () => 'Is there a water heater?',
    questionEs: () => '¿Hay un calentador de agua?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      hvac_d: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _hvac_has_wh: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'hvac_d_type',
    question: () => 'What type of water heater?',
    questionEs: () => '¿Qué tipo de calentador de agua?',
    options: ['Electric', 'Gas', 'Solar', 'Tankless'],
    optionsEs: ['Eléctrico', 'Gas', 'Solar', 'Sin tanque'],
    skipIf: (vals) => !vals['_hvac_has_wh'],
    onAnswer: (answer) => ({
      hvac_d_electric: answer === 'Electric' || answer === 'Eléctrico',
      hvac_d_gas: answer === 'Gas',
      hvac_d_solar: answer === 'Solar',
      hvac_d_tankless: answer === 'Tankless' || answer === 'Sin tanque',
    }),
  },
  {
    id: 'hvac_d_unit1',
    question: () => 'Water Heater — make, model, approximate age:',
    questionEs: () => 'Calentador de agua — marca, modelo, edad aproximada:',
    fieldKey: 'hvac_d_unit1',
    freeText: true,
    skipIf: (vals) => !vals['_hvac_has_wh'],
  },
  {
    id: 'hvac_e',
    question: () => 'Have there been any HVAC problems?',
    questionEs: () => '¿Ha habido algún problema con el HVAC?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      hvac_e: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _hvac_e_yes: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'hvac_e_details',
    question: () => 'Describe the HVAC problems:',
    questionEs: () => 'Describa los problemas de HVAC:',
    fieldKey: 'hvac_e_details',
    freeText: true,
    skipIf: (vals) => !vals['_hvac_e_yes'],
  },
]

// ── ELECTRICAL ────────────────────────────────────────────────────────────────
export const ELECTRICAL_SCRIPT: ScriptStep[] = [
  {
    id: 'elec_materials',
    multiSelect: true,
    question: () => 'What type of electrical wiring?',
    questionEs: () => '¿Qué tipo de cableado eléctrico?',
    options: ['Copper', 'Aluminum', 'Unknown'],
    optionsEs: ['Cobre', 'Aluminio', 'Desconocido'],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      return {
        elec_mat_copper: selected.has('Copper'),
        elec_mat_aluminum: selected.has('Aluminum'),
        elec_mat_unknown: selected.has('Unknown'),
      }
    },
  },
  {
    id: 'elec_panel_type',
    question: () => 'What type of electrical panel?',
    questionEs: () => '¿Qué tipo de panel eléctrico?',
    options: ['Breaker', 'Fuse'],
    optionsEs: ['Interruptor', 'Fusible'],
    onAnswer: (answer) => ({
      elec_panel_breaker: answer === 'Breaker' || answer === 'Interruptor',
      elec_panel_fuse: answer === 'Fuse' || answer === 'Fusible',
    }),
  },
  {
    id: 'elec_panel_location',
    question: () => 'Where is the electrical panel located?',
    questionEs: () => '¿Dónde está ubicado el panel eléctrico?',
    fieldKey: 'elec_panel_location',
    freeText: true,
  },
  {
    id: 'elec_panel_amps',
    question: () => 'Panel size (amps):',
    questionEs: () => 'Tamaño del panel (amperios):',
    fieldKey: 'elec_panel_amps',
    freeText: true,
  },
  {
    id: 'elec_c',
    question: () => 'Have there been any electrical system problems?',
    questionEs: () => '¿Ha habido algún problema con el sistema eléctrico?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      elec_c: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _elec_c_yes: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'elec_c_details',
    question: () => 'Describe the electrical problems:',
    questionEs: () => 'Describa los problemas eléctricos:',
    fieldKey: 'elec_c_details',
    freeText: true,
    skipIf: (vals) => !vals['_elec_c_yes'],
  },
]

// ── HAZARDOUS CONDITIONS ──────────────────────────────────────────────────────
export const HAZARDOUS_SCRIPT: ScriptStep[] = [
  {
    id: 'haz_batch',
    multiSelect: true,
    question: () => 'Hazardous Conditions — tap anything that applies:',
    questionEs: () => 'Condiciones peligrosas — seleccione todo lo que aplique:',
    options: [
      'Underground Storage Tanks',
      'Landfill on Property',
      'Toxic Substances (tires, batteries, etc.)',
      'Radioactive / Hazardous Contamination',
      'Testing for Hazardous Items',
      'Professional Radon Testing',
      'Radon Mitigation System',
      'Mold Testing / Mitigation',
      'Other Environmental Issues',
      'Controlled Substances Manufactured',
      'Methamphetamine Manufactured',
    ],
    optionsEs: [
      'Tanques de almacenamiento subterráneo',
      'Vertedero en la propiedad',
      'Sustancias tóxicas (llantas, baterías, etc.)',
      'Contaminación radioactiva / peligrosa',
      'Pruebas de artículos peligrosos',
      'Prueba profesional de radón',
      'Sistema de mitigación de radón',
      'Prueba / mitigación de moho',
      'Otros problemas ambientales',
      'Sustancias controladas fabricadas',
      'Metanfetamina fabricada',
    ],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const labels = [
        'Underground Storage Tanks',
        'Landfill on Property',
        'Toxic Substances (tires, batteries, etc.)',
        'Radioactive / Hazardous Contamination',
        'Testing for Hazardous Items',
        'Professional Radon Testing',
        'Radon Mitigation System',
        'Mold Testing / Mitigation',
        'Other Environmental Issues',
        'Controlled Substances Manufactured',
        'Methamphetamine Manufactured',
      ]
      const keys = ['haz_a', 'haz_b', 'haz_c', 'haz_d', 'haz_e', 'haz_f', 'haz_g', 'haz_h', 'haz_i', 'haz_j', 'haz_k']
      const updates: Record<string, unknown> = {}
      labels.forEach((label, i) => {
        updates[keys[i]] = selected.has(label) ? 'yes' : 'no'
      })
      updates['_haz_has_yes'] = selected.size > 0
      return updates
    },
  },
  {
    id: 'haz_comments',
    question: () => 'Briefly explain any hazardous items:',
    questionEs: () => 'Explique brevemente los elementos peligrosos:',
    fieldKey: 'haz_comments',
    freeText: true,
    skipIf: (vals) => !vals['_haz_has_yes'],
  },
]

// ── TAXES & HOA ───────────────────────────────────────────────────────────────
export const TAXES_HOA_SCRIPT: ScriptStep[] = [
  {
    id: 'tax_batch',
    multiSelect: true,
    question: () => 'Taxes & Neighborhood — tap everything that applies:',
    questionEs: () => 'Impuestos y Vecindario — seleccione todo lo que aplique:',
    options: [
      'Outside City Limits',
      'Bonds or Special Taxes',
      'Tax Credits or Tax Freeze',
      'Tax Abatement',
      'Neighborhood Condition / Proposed Change',
      'Common Area Defects',
      'Change in Assessments or Fees',
      'Privately Owned Streets',
      'Historic / Conservation District',
      'Right of First Refusal',
    ],
    optionsEs: [
      'Fuera de los límites de la ciudad',
      'Bonos o impuestos especiales',
      'Créditos fiscales o congelación de impuestos',
      'Reducción de impuestos',
      'Condición del vecindario / Cambio propuesto',
      'Defectos en áreas comunes',
      'Cambio en evaluaciones o tarifas',
      'Calles de propiedad privada',
      'Distrito histórico / de conservación',
      'Derecho de primera negativa',
    ],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const labels = [
        'Outside City Limits',
        'Bonds or Special Taxes',
        'Tax Credits or Tax Freeze',
        'Tax Abatement',
        'Neighborhood Condition / Proposed Change',
        'Common Area Defects',
        'Change in Assessments or Fees',
        'Privately Owned Streets',
        'Historic / Conservation District',
        'Right of First Refusal',
      ]
      const keys = ['tax_a_outside_city', 'tax_a_bonds', 'tax_b', 'tax_c', 'tax_d', 'tax_e', 'tax_f', 'tax_g', 'tax_h', 'tax_i']
      const updates: Record<string, unknown> = {}
      labels.forEach((label, i) => {
        updates[keys[i]] = selected.has(label) ? 'yes' : 'no'
      })
      updates['_tax_bonds'] = selected.has('Bonds or Special Taxes')
      updates['_tax_rofr'] = selected.has('Right of First Refusal')
      updates['_tax_has_yes'] = selected.size > 0
      return updates
    },
  },
  {
    id: 'tax_a_bonds_amount',
    question: () => 'Bond/special tax amount ($):',
    questionEs: () => 'Monto del bono/impuesto especial ($):',
    fieldKey: 'tax_a_bonds_amount',
    freeText: true,
    skipIf: (vals) => !vals['_tax_bonds'],
  },
  {
    id: 'tax_i_days',
    question: () => 'How many days notice required for right of first refusal?',
    questionEs: () => '¿Cuántos días de aviso se requieren para el derecho de primera negativa?',
    fieldKey: 'tax_i_days',
    freeText: true,
    skipIf: (vals) => !vals['_tax_rofr'],
  },
  {
    id: 'tax_j',
    question: () => 'Is the property subject to an HOA or subdivision restrictions?',
    questionEs: () => '¿La propiedad está sujeta a una HOA o restricciones de subdivisión?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      tax_j: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _tax_hoa: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'tax_k',
    question: () => 'Any violations of HOA covenants?',
    questionEs: () => '¿Alguna violación de los convenios de la HOA?',
    options: ['Yes', 'No', 'N/A'],
    optionsEs: ['Sí', 'No', 'N/A'],
    skipIf: (vals) => !vals['_tax_hoa'],
    onAnswer: (answer) => {
      let val: string
      if (answer === 'Yes' || answer === 'Sí') val = 'yes'
      else if (answer === 'No') val = 'no'
      else val = 'na'
      return { tax_k: val }
    },
  },
  {
    id: 'tax_l',
    question: () => 'Is there an HOA transfer or initiation fee?',
    questionEs: () => '¿Hay una tarifa de transferencia o inicio de HOA?',
    options: ['Yes', 'No', 'N/A'],
    optionsEs: ['Sí', 'No', 'N/A'],
    skipIf: (vals) => !vals['_tax_hoa'],
    onAnswer: (answer) => {
      let val: string
      if (answer === 'Yes' || answer === 'Sí') val = 'yes'
      else if (answer === 'No') val = 'no'
      else val = 'na'
      return {
        tax_l: val,
        _tax_l_yes: val === 'yes',
      }
    },
  },
  {
    id: 'tax_l_amount',
    question: () => 'HOA transfer/initiation fee amount ($):',
    questionEs: () => 'Monto de la tarifa de transferencia/inicio de HOA ($):',
    fieldKey: 'tax_l_amount',
    freeText: true,
    skipIf: (vals) => !vals['_tax_l_yes'],
  },
  {
    id: 'tax_m',
    question: () => 'Is the property subject to regular HOA dues?',
    questionEs: () => '¿La propiedad está sujeta a cuotas regulares de HOA?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    skipIf: (vals) => !vals['_tax_hoa'],
    onAnswer: (answer) => ({
      tax_m: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
      _tax_m_yes: answer === 'Yes' || answer === 'Sí',
    }),
  },
  {
    id: 'tax_m_paid_until',
    question: () => 'HOA dues paid through (date):',
    questionEs: () => 'Cuotas de HOA pagadas hasta (fecha):',
    fieldKey: 'tax_m_paid_until',
    freeText: true,
    skipIf: (vals) => !vals['_tax_m_yes'],
  },
  {
    id: 'tax_m_amount',
    question: () => 'HOA dues amount ($):',
    questionEs: () => 'Monto de las cuotas de HOA ($):',
    fieldKey: 'tax_m_amount',
    freeText: true,
    skipIf: (vals) => !vals['_tax_m_yes'],
  },
  {
    id: 'tax_m_freq',
    question: () => 'HOA dues frequency:',
    questionEs: () => 'Frecuencia de las cuotas de HOA:',
    options: ['Monthly', 'Quarterly', 'Semi-Annually', 'Yearly'],
    optionsEs: ['Mensual', 'Trimestral', 'Semestral', 'Anual'],
    skipIf: (vals) => !vals['_tax_m_yes'],
    onAnswer: (answer) => ({
      tax_m_freq_monthly: answer === 'Monthly' || answer === 'Mensual',
      tax_m_freq_quarterly: answer === 'Quarterly' || answer === 'Trimestral',
      tax_m_freq_semi: answer === 'Semi-Annually' || answer === 'Semestral',
      tax_m_freq_yearly: answer === 'Yearly' || answer === 'Anual',
    }),
  },
  {
    id: 'tax_m_sent_to',
    question: () => 'HOA dues paid to (name/address):',
    questionEs: () => 'Cuotas de HOA pagadas a (nombre/dirección):',
    fieldKey: 'tax_m_sent_to',
    freeText: true,
    skipIf: (vals) => !vals['_tax_m_yes'],
  },
  {
    id: 'tax_m_includes',
    question: () => 'What do dues include?',
    questionEs: () => '¿Qué incluyen las cuotas?',
    fieldKey: 'tax_m_includes',
    freeText: true,
    skipIf: (vals) => !vals['_tax_m_yes'],
  },
  {
    id: 'tax_m_contact',
    question: () => 'HOA contact name, phone, and website:',
    questionEs: () => 'Nombre de contacto, teléfono y sitio web de la HOA:',
    fieldKey: 'tax_m_contact',
    freeText: true,
    skipIf: (vals) => !vals['_tax_m_yes'],
  },
  {
    id: 'tax_n',
    question: () => 'Is there a secondary master HOA?',
    questionEs: () => '¿Hay una HOA maestra secundaria?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      tax_n: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
    }),
  },
]

// ── INSPECTIONS ───────────────────────────────────────────────────────────────
export const INSPECTIONS_SCRIPT: ScriptStep[] = [
  {
    id: 'inspect_last_12mo',
    question: () => 'Has the property been inspected in the last 12 months?',
    questionEs: () => '¿Ha sido inspeccionada la propiedad en los últimos 12 meses?',
    options: ['Yes', 'No'],
    optionsEs: ['Sí', 'No'],
    onAnswer: (answer) => ({
      inspect_last_12mo: answer === 'Yes' || answer === 'Sí' ? 'yes' : 'no',
    }),
  },
]

// ── OTHER MATTERS ─────────────────────────────────────────────────────────────
export const OTHER_MATTERS_SCRIPT: ScriptStep[] = [
  {
    id: 'other_batch1',
    multiSelect: true,
    question: () => 'Other Matters (Part 1) — tap everything that applies:',
    questionEs: () => 'Otros Asuntos (Parte 1) — seleccione todo lo que aplique:',
    options: [
      'Party Walls / Easements / Common Areas',
      'Fire Damage',
      'Liens (other than mortgage)',
      'Violations of Laws or Regulations',
      'Other Conditions Affecting Value',
      'Conditions Preventing Sale',
      'Animals / Pets in Property',
      'Pet or General Stains on Flooring',
      'Missing Keys for Exterior Doors',
      'Zoning / Setback Violations',
      'Unrecorded Interests',
    ],
    optionsEs: [
      'Paredes divisorias / Servidumbres / Áreas comunes',
      'Daño por incendio',
      'Gravámenes (distintos de hipoteca)',
      'Violaciones de leyes o regulaciones',
      'Otras condiciones que afectan el valor',
      'Condiciones que impiden la venta',
      'Animales / Mascotas en la propiedad',
      'Manchas de mascotas o generales en el piso',
      'Llaves faltantes para puertas exteriores',
      'Violaciones de zonificación / retroceso',
      'Intereses no registrados',
    ],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const labels = [
        'Party Walls / Easements / Common Areas',
        'Fire Damage',
        'Liens (other than mortgage)',
        'Violations of Laws or Regulations',
        'Other Conditions Affecting Value',
        'Conditions Preventing Sale',
        'Animals / Pets in Property',
        'Pet or General Stains on Flooring',
        'Missing Keys for Exterior Doors',
        'Zoning / Setback Violations',
        'Unrecorded Interests',
      ]
      const keys = ['other_a', 'other_b', 'other_c', 'other_d', 'other_e', 'other_f', 'other_g', 'other_h', 'other_i', 'other_j', 'other_k']
      const updates: Record<string, unknown> = {}
      labels.forEach((label, i) => {
        updates[keys[i]] = selected.has(label) ? 'yes' : 'no'
      })
      updates['_other_missing_keys'] = selected.has('Missing Keys for Exterior Doors')
      updates['_other1_has_yes'] = selected.size > 0
      return updates
    },
  },
  {
    id: 'other_i_locks',
    question: () => 'List which locks are missing keys:',
    questionEs: () => 'Liste qué cerraduras tienen llaves faltantes:',
    fieldKey: 'other_i_locks',
    freeText: true,
    skipIf: (vals) => !vals['_other_missing_keys'],
  },
  {
    id: 'other_batch2',
    multiSelect: true,
    question: () => 'Other Matters (Part 2) — tap everything that applies:',
    questionEs: () => 'Otros Asuntos (Parte 2) — seleccione todo lo que aplique:',
    options: [
      'Clear Title Interference',
      'Existing or Threatened Legal Action',
      'Litigation or Settlement',
      'Added Insulation Since Ownership',
      'Replaced Appliances in Last 5 Years',
      'Transferable Warranties',
      'Insurance Claims in Last 5 Years',
      'Synthetic Stucco (EIFS)',
    ],
    optionsEs: [
      'Interferencia con título limpio',
      'Acción legal existente o amenazada',
      'Litigio o acuerdo',
      'Aislamiento añadido desde la compra',
      'Electrodomésticos reemplazados en los últimos 5 años',
      'Garantías transferibles',
      'Reclamaciones de seguro en los últimos 5 años',
      'Estuco sintético (EIFS)',
    ],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const labels = [
        'Clear Title Interference',
        'Existing or Threatened Legal Action',
        'Litigation or Settlement',
        'Added Insulation Since Ownership',
        'Replaced Appliances in Last 5 Years',
        'Transferable Warranties',
        'Insurance Claims in Last 5 Years',
        'Synthetic Stucco (EIFS)',
      ]
      const keys = ['other_l', 'other_m', 'other_n', 'other_o', 'other_p', 'other_q', 'other_r', 'other_s']
      const updates: Record<string, unknown> = {}
      labels.forEach((label, i) => {
        updates[keys[i]] = selected.has(label) ? 'yes' : 'no'
      })
      updates['_other_claims'] = selected.has('Insurance Claims in Last 5 Years')
      updates['_other2_has_yes'] = selected.size > 0
      return updates
    },
  },
  {
    id: 'other_r_repairs',
    question: () => 'Were repairs from the insurance claims completed?',
    questionEs: () => '¿Se completaron las reparaciones de las reclamaciones de seguro?',
    options: ['Yes', 'No', 'N/A'],
    optionsEs: ['Sí', 'No', 'N/A'],
    skipIf: (vals) => !vals['_other_claims'],
    onAnswer: (answer) => {
      let val: string
      if (answer === 'Yes' || answer === 'Sí') val = 'yes'
      else if (answer === 'No') val = 'no'
      else val = 'na'
      return { other_r_repairs: val }
    },
  },
  {
    id: 'other_comments',
    question: () => 'Briefly explain any flagged items:',
    questionEs: () => 'Explique brevemente los elementos marcados:',
    fieldKey: 'other_comments',
    freeText: true,
    skipIf: (vals) => !vals['_other1_has_yes'] && !vals['_other2_has_yes'],
  },
]

// ── UTILITIES ─────────────────────────────────────────────────────────────────
export const UTILITIES_SCRIPT: ScriptStep[] = [
  {
    id: 'util_electric',
    question: () => 'Electric company — name and phone number:',
    questionEs: () => 'Compañía eléctrica — nombre y número de teléfono:',
    freeText: true,
    onAnswer: (answer) => ({
      util_electric_name: answer,
      util_electric_phone: answer,
    }),
  },
  {
    id: 'util_gas',
    question: () => "Gas company — name and phone (type 'none' if no gas):",
    questionEs: () => "Compañía de gas — nombre y teléfono (escriba 'ninguno' si no hay gas):",
    freeText: true,
    onAnswer: (answer) => {
      if (/^none$/i.test(answer.trim()) || /^ninguno$/i.test(answer.trim())) {
        return {}
      }
      return {
        util_gas_name: answer,
        util_gas_phone: answer,
      }
    },
  },
  {
    id: 'util_water',
    question: () => 'Water company — name and phone:',
    questionEs: () => 'Compañía de agua — nombre y teléfono:',
    freeText: true,
    onAnswer: (answer) => ({
      util_water_name: answer,
      util_water_phone: answer,
    }),
  },
  {
    id: 'util_trash',
    question: () => 'Trash company — name and phone:',
    questionEs: () => 'Compañía de basura — nombre y teléfono:',
    freeText: true,
    onAnswer: (answer) => ({
      util_trash_name: answer,
      util_trash_phone: answer,
    }),
  },
  {
    id: 'util_other1',
    question: () => 'Any other utilities? Name and phone (or skip):',
    questionEs: () => '¿Alguna otra utilidad? Nombre y teléfono (o saltar):',
    freeText: true,
    tempKey: '_util_other1_raw',
    onAnswer: (answer) => {
      if (/^(skip|none|no|ninguno|saltar)$/i.test(answer.trim())) return {}
      return { util_other1_name: answer }
    },
  },
]

// ── ELECTRONICS ───────────────────────────────────────────────────────────────
export const ELECTRONICS_SCRIPT: ScriptStep[] = [
  {
    id: 'elec_sys_present',
    question: () => 'Are there electronic systems (smart home, AV, etc.) staying with the property?',
    questionEs: () => '¿Hay sistemas electrónicos (hogar inteligente, AV, etc.) que se queden con la propiedad?',
    options: ['Yes', 'No', 'N/A'],
    optionsEs: ['Sí', 'No', 'N/A'],
    onAnswer: (answer) => {
      let val: string
      if (answer === 'Yes' || answer === 'Sí') val = 'yes'
      else if (answer === 'No') val = 'no'
      else val = 'na'
      return {
        elec_sys_present: val,
        _elec_sys_yes: val === 'yes',
      }
    },
  },
  {
    id: 'elec_sys_list',
    question: () => 'List the electronic systems staying:',
    questionEs: () => 'Liste los sistemas electrónicos que se quedan:',
    fieldKey: 'elec_sys_list',
    freeText: true,
    skipIf: (vals) => !vals['_elec_sys_yes'],
  },
]

// ── FIXTURES ──────────────────────────────────────────────────────────────────
export const FIXTURES_SCRIPT: ScriptStep[] = [
  // Group 1 — Kitchen Appliances
  {
    id: 'fix_kitchen_has',
    multiSelect: true,
    question: () => 'Kitchen — which appliances does the property have?',
    questionEs: () => 'Cocina — ¿qué electrodomésticos tiene la propiedad?',
    options: [
      'Stove / Range',
      'Built-in Oven',
      'Cooktop',
      'Range Hood',
      'Microwave',
      'Dishwasher',
      'Disposal',
      'Refrigerator',
      '2nd Refrigerator',
      'Freezer',
      'Trash Compactor',
    ],
    optionsEs: [
      'Estufa / Cocina',
      'Horno empotrado',
      'Placa de cocción',
      'Campana extractora',
      'Microondas',
      'Lavavajillas',
      'Triturador',
      'Refrigerador',
      '2do Refrigerador',
      'Congelador',
      'Compactador de basura',
    ],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const mapping: Array<[string, string]> = [
        ['Stove / Range', 'fix_stove_range'],
        ['Built-in Oven', 'fix_builtin_oven'],
        ['Cooktop', 'fix_cooktop'],
        ['Range Hood', 'fix_range_hood'],
        ['Microwave', 'fix_microwave'],
        ['Dishwasher', 'fix_dishwasher'],
        ['Disposal', 'fix_disposal'],
        ['Refrigerator', 'fix_fridge1'],
        ['2nd Refrigerator', 'fix_fridge2'],
        ['Freezer', 'fix_freezer'],
        ['Trash Compactor', 'fix_trash_compactor'],
      ]
      const updates: Record<string, unknown> = {}
      mapping.forEach(([label, key]) => {
        updates[key] = selected.has(label) ? 'OS' : 'NA'
      })
      updates['_has_stove'] = selected.has('Stove / Range')
      updates['_has_oven'] = selected.has('Built-in Oven')
      updates['_has_cooktop'] = selected.has('Cooktop')
      updates['_has_fridge1'] = selected.has('Refrigerator')
      updates['_has_fridge2'] = selected.has('2nd Refrigerator')
      updates['_has_freezer'] = selected.has('Freezer')
      return updates
    },
  },
  {
    id: 'fix_stove_type',
    question: () => 'Stove type?',
    questionEs: () => '¿Tipo de estufa?',
    options: ['Electric', 'Gas', 'Convection'],
    optionsEs: ['Eléctrica', 'Gas', 'Convección'],
    skipIf: (vals) => !vals['_has_stove'],
    onAnswer: (answer) => ({
      fix_stove_elec: answer === 'Electric' || answer === 'Eléctrica',
      fix_stove_gas: answer === 'Gas',
      fix_stove_convection: answer === 'Convection' || answer === 'Convección',
    }),
  },
  {
    id: 'fix_oven_type',
    question: () => 'Built-in oven type?',
    questionEs: () => '¿Tipo de horno empotrado?',
    options: ['Electric', 'Gas', 'Convection'],
    optionsEs: ['Eléctrico', 'Gas', 'Convección'],
    skipIf: (vals) => !vals['_has_oven'],
    onAnswer: (answer) => ({
      fix_oven_elec: answer === 'Electric' || answer === 'Eléctrico',
      fix_oven_gas: answer === 'Gas',
      fix_oven_convection: answer === 'Convection' || answer === 'Convección',
    }),
  },
  {
    id: 'fix_cooktop_type',
    question: () => 'Cooktop type?',
    questionEs: () => '¿Tipo de placa de cocción?',
    options: ['Electric', 'Gas'],
    optionsEs: ['Eléctrica', 'Gas'],
    skipIf: (vals) => !vals['_has_cooktop'],
    onAnswer: (answer) => ({
      fix_cooktop_elec: answer === 'Electric' || answer === 'Eléctrica',
      fix_cooktop_gas: answer === 'Gas',
    }),
  },
  {
    id: 'fix_fridge1_location',
    question: () => 'Where is the refrigerator located?',
    questionEs: () => '¿Dónde está ubicado el refrigerador?',
    fieldKey: 'fix_fridge1_location',
    freeText: true,
    skipIf: (vals) => !vals['_has_fridge1'],
  },
  {
    id: 'fix_fridge2_location',
    question: () => 'Where is the 2nd refrigerator?',
    questionEs: () => '¿Dónde está el 2do refrigerador?',
    fieldKey: 'fix_fridge2_location',
    freeText: true,
    skipIf: (vals) => !vals['_has_fridge2'],
  },
  {
    id: 'fix_freezer_location',
    question: () => 'Where is the freezer located?',
    questionEs: () => '¿Dónde está ubicado el congelador?',
    fieldKey: 'fix_freezer_location',
    freeText: true,
    skipIf: (vals) => !vals['_has_freezer'],
  },
  // Group 2 — Laundry
  {
    id: 'fix_laundry_has',
    multiSelect: true,
    question: () => "Laundry — what's included?",
    questionEs: () => 'Lavandería — ¿qué está incluido?',
    options: ['Washer', 'Dryer', 'Neither'],
    optionsEs: ['Lavadora', 'Secadora', 'Ninguno'],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const hasNeither = selected.has('Neither') || selected.has('Ninguno')
      return {
        fix_washer: (!hasNeither && selected.has('Washer')) ? 'OS' : 'NA',
        fix_dryer: (!hasNeither && selected.has('Dryer')) ? 'OS' : 'NA',
        _has_dryer: !hasNeither && selected.has('Dryer'),
      }
    },
  },
  {
    id: 'fix_dryer_type',
    question: () => 'Dryer type?',
    questionEs: () => '¿Tipo de secadora?',
    options: ['Electric', 'Gas'],
    optionsEs: ['Eléctrica', 'Gas'],
    skipIf: (vals) => !vals['_has_dryer'],
    onAnswer: (answer) => ({
      fix_dryer_elec: answer === 'Electric' || answer === 'Eléctrica',
      fix_dryer_gas: answer === 'Gas',
    }),
  },
  // Group 3 — Home Systems
  {
    id: 'fix_home_has',
    multiSelect: true,
    question: () => 'Home Systems — which are present?',
    questionEs: () => 'Sistemas del hogar — ¿cuáles están presentes?',
    options: [
      'Ceiling Fans',
      'Attic Fan',
      'AC Central System',
      'AC Window Units',
      'Furnace / Heating System',
      'Humidifier',
      'Electric Air Cleaner',
      'EV Charging Equipment',
      'Central Vacuum',
      'Exhaust Fans (Baths)',
      'Closet Systems',
      'Invisible Fence',
    ],
    optionsEs: [
      'Ventiladores de techo',
      'Ventilador de ático',
      'Sistema central de AC',
      'Unidades de AC de ventana',
      'Horno / Sistema de calefacción',
      'Humidificador',
      'Purificador de aire eléctrico',
      'Equipo de carga EV',
      'Aspiradora central',
      'Ventiladores de baño',
      'Sistemas de closet',
      'Cerca invisible',
    ],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const mapping: Array<[string, string]> = [
        ['Ceiling Fans', 'fix_ceiling_fans'],
        ['Attic Fan', 'fix_attic_fan'],
        ['AC Central System', 'fix_ac_central'],
        ['AC Window Units', 'fix_ac_window'],
        ['Furnace / Heating System', 'fix_furnace'],
        ['Humidifier', 'fix_humidifier'],
        ['Electric Air Cleaner', 'fix_elec_air_cleaner'],
        ['EV Charging Equipment', 'fix_ev_charging'],
        ['Central Vacuum', 'fix_central_vac'],
        ['Exhaust Fans (Baths)', 'fix_exhaust_fans_baths'],
        ['Closet Systems', 'fix_closet_systems'],
        ['Invisible Fence', 'fix_fences_invisible'],
      ]
      const updates: Record<string, unknown> = {}
      mapping.forEach(([label, key]) => {
        updates[key] = selected.has(label) ? 'OS' : 'NA'
      })
      updates['_has_ceiling_fans'] = selected.has('Ceiling Fans')
      updates['_has_ac_window'] = selected.has('AC Window Units')
      updates['_has_closet'] = selected.has('Closet Systems')
      return updates
    },
  },
  {
    id: 'fix_ceiling_fans_count',
    question: () => 'How many ceiling fans?',
    questionEs: () => '¿Cuántos ventiladores de techo?',
    fieldKey: 'fix_ceiling_fans_count',
    freeText: true,
    skipIf: (vals) => !vals['_has_ceiling_fans'],
  },
  {
    id: 'fix_ac_window_count',
    question: () => 'How many window AC units?',
    questionEs: () => '¿Cuántas unidades de AC de ventana?',
    fieldKey: 'fix_ac_window_count',
    freeText: true,
    skipIf: (vals) => !vals['_has_ac_window'],
  },
  {
    id: 'fix_closet_location',
    question: () => 'Where are the closet systems located?',
    questionEs: () => '¿Dónde están los sistemas de closet?',
    fieldKey: 'fix_closet_location',
    freeText: true,
    skipIf: (vals) => !vals['_has_closet'],
  },
  // Group 4 — Fireplaces
  {
    id: 'fix_fireplace_count',
    question: () => 'How many fireplaces?',
    questionEs: () => '¿Cuántas chimeneas?',
    options: ['0', '1', '2'],
    optionsEs: ['0', '1', '2'],
    onAnswer: (answer) => {
      const count = parseInt(answer, 10) || 0
      return {
        fix_fireplace_count: answer,
        _fp_count: count,
        _has_fp: count > 0,
      }
    },
  },
  {
    id: 'fix_fp1_location',
    question: () => 'Fireplace 1 — location (e.g. Living Room):',
    questionEs: () => 'Chimenea 1 — ubicación (ej. Sala de estar):',
    fieldKey: 'fix_fp1_location',
    freeText: true,
    skipIf: (vals) => (vals['_fp_count'] as number) < 1,
  },
  {
    id: 'fix_fp1_features',
    multiSelect: true,
    question: () => 'Fireplace 1 — which features does it have?',
    questionEs: () => 'Chimenea 1 — ¿qué características tiene?',
    options: ['Chimney', 'Gas Logs', 'Gas Starter', 'Heat Re-circulator', 'Insert', 'Wood Burning'],
    optionsEs: ['Conducto de humos', 'Troncos de gas', 'Encendedor de gas', 'Re-circulador de calor', 'Inserto', 'Leña'],
    skipIf: (vals) => (vals['_fp_count'] as number) < 1,
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      return {
        fix_fp1_chimney: selected.has('Chimney') ? 'OS' : 'NA',
        fix_fp1_gas_logs: selected.has('Gas Logs') ? 'OS' : 'NA',
        fix_fp1_gas_starter: selected.has('Gas Starter') ? 'OS' : 'NA',
        fix_fp1_heat_recirc: selected.has('Heat Re-circulator') ? 'OS' : 'NA',
        fix_fp1_insert: selected.has('Insert') ? 'OS' : 'NA',
        fix_fp1_wood_burning: selected.has('Wood Burning') ? 'OS' : 'NA',
      }
    },
  },
  {
    id: 'fix_fp2_location',
    question: () => 'Fireplace 2 — location:',
    questionEs: () => 'Chimenea 2 — ubicación:',
    fieldKey: 'fix_fp2_location',
    freeText: true,
    skipIf: (vals) => (vals['_fp_count'] as number) < 2,
  },
  {
    id: 'fix_fp2_features',
    multiSelect: true,
    question: () => 'Fireplace 2 — which features does it have?',
    questionEs: () => 'Chimenea 2 — ¿qué características tiene?',
    options: ['Chimney', 'Gas Logs', 'Gas Starter', 'Heat Re-circulator', 'Insert', 'Wood Burning'],
    optionsEs: ['Conducto de humos', 'Troncos de gas', 'Encendedor de gas', 'Re-circulador de calor', 'Inserto', 'Leña'],
    skipIf: (vals) => (vals['_fp_count'] as number) < 2,
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      return {
        fix_fp2_chimney: selected.has('Chimney') ? 'OS' : 'NA',
        fix_fp2_gas_logs: selected.has('Gas Logs') ? 'OS' : 'NA',
        fix_fp2_gas_starter: selected.has('Gas Starter') ? 'OS' : 'NA',
        fix_fp2_heat_recirc: selected.has('Heat Re-circulator') ? 'OS' : 'NA',
        fix_fp2_insert: selected.has('Insert') ? 'OS' : 'NA',
        fix_fp2_wood_burning: selected.has('Wood Burning') ? 'OS' : 'NA',
      }
    },
  },
  // Group 5 — Outdoor / Pool
  {
    id: 'fix_outdoor_has',
    multiSelect: true,
    question: () => 'Outdoor — which does the property have?',
    questionEs: () => 'Exterior — ¿cuáles tiene la propiedad?',
    options: [
      'Swimming Pool',
      'Pool Heater',
      'Pool Equipment',
      'Spa / Hot Tub',
      'Sauna',
      'Spa Equipment',
      'Sprinkler Auto Timer',
      'Sprinkler Back Flow Valve',
      'Sprinkler Controls',
      'Yard Light',
      'Fountain',
      'Outside Cooking Unit',
      'Propane Tank',
      'Swing Set / Playset',
      'Statuary / Yard Art',
      'Sheds',
      'Boat Dock',
    ],
    optionsEs: [
      'Piscina',
      'Calentador de piscina',
      'Equipo de piscina',
      'Spa / Jacuzzi',
      'Sauna',
      'Equipo de spa',
      'Temporizador automático de aspersores',
      'Válvula de reflujo de aspersores',
      'Controles de aspersores',
      'Luz de jardín',
      'Fuente',
      'Unidad de cocina exterior',
      'Tanque de propano',
      'Columpio / Juego de juegos',
      'Estatuaria / Arte de jardín',
      'Cobertizos',
      'Muelle para botes',
    ],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const mapping: Array<[string, string]> = [
        ['Swimming Pool', 'fix_pool'],
        ['Pool Heater', 'fix_pool_heater'],
        ['Pool Equipment', 'fix_pool_equipment'],
        ['Spa / Hot Tub', 'fix_spa_hot_tub'],
        ['Sauna', 'fix_spa_sauna'],
        ['Spa Equipment', 'fix_spa_equipment'],
        ['Sprinkler Auto Timer', 'fix_sprinkler_timer'],
        ['Sprinkler Back Flow Valve', 'fix_sprinkler_backflow'],
        ['Sprinkler Controls', 'fix_sprinkler_controls'],
        ['Yard Light', 'fix_yard_light'],
        ['Fountain', 'fix_fountain'],
        ['Outside Cooking Unit', 'fix_outside_cooking'],
        ['Propane Tank', 'fix_propane_tank'],
        ['Swing Set / Playset', 'fix_swing_set'],
        ['Statuary / Yard Art', 'fix_statuary'],
        ['Sheds', 'fix_sheds'],
        ['Boat Dock', 'fix_boat_dock'],
      ]
      const updates: Record<string, unknown> = {}
      mapping.forEach(([label, key]) => {
        updates[key] = selected.has(label) ? 'OS' : 'NA'
      })
      updates['_has_sheds'] = selected.has('Sheds')
      updates['_has_yard_light'] = selected.has('Yard Light')
      updates['_has_propane'] = selected.has('Propane Tank')
      updates['_has_boat_dock'] = selected.has('Boat Dock')
      return updates
    },
  },
  {
    id: 'fix_sheds_count',
    question: () => 'How many sheds?',
    questionEs: () => '¿Cuántos cobertizos?',
    fieldKey: 'fix_sheds_count',
    freeText: true,
    skipIf: (vals) => !vals['_has_sheds'],
  },
  {
    id: 'fix_yard_light_type',
    question: () => 'Yard light type?',
    questionEs: () => '¿Tipo de luz de jardín?',
    options: ['Electric', 'Gas'],
    optionsEs: ['Eléctrica', 'Gas'],
    skipIf: (vals) => !vals['_has_yard_light'],
    onAnswer: (answer) => ({
      fix_yard_light_elec: answer === 'Electric' || answer === 'Eléctrica',
      fix_yard_light_gas: answer === 'Gas',
    }),
  },
  {
    id: 'fix_propane_ownership',
    question: () => 'Is the propane tank owned or leased?',
    questionEs: () => '¿El tanque de propano es propio o arrendado?',
    options: ['Owned', 'Leased'],
    optionsEs: ['Propio', 'Arrendado'],
    skipIf: (vals) => !vals['_has_propane'],
    onAnswer: (answer) => ({
      fix_propane_owned: answer === 'Owned' || answer === 'Propio',
      fix_propane_leased: answer === 'Leased' || answer === 'Arrendado',
    }),
  },
  {
    id: 'fix_boat_dock_id',
    question: () => 'Boat dock ID #:',
    questionEs: () => 'ID # del muelle para botes:',
    fieldKey: 'fix_boat_dock_id',
    freeText: true,
    skipIf: (vals) => !vals['_has_boat_dock'],
  },
  // Group 6 — Garage
  {
    id: 'fix_garage_has',
    multiSelect: true,
    question: () => "Garage — what's included?",
    questionEs: () => 'Garaje — ¿qué está incluido?',
    options: ['Garage Door Opener', 'Garage Door Remote(s)', 'Keyless Entry', 'None'],
    optionsEs: ['Abridor de puerta de garaje', 'Control(es) remoto(s)', 'Entrada sin llave', 'Ninguno'],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const hasNone = selected.has('None') || selected.has('Ninguno')
      return {
        fix_garage_opener: (!hasNone && selected.has('Garage Door Opener')) ? 'OS' : 'NA',
        fix_garage_remote: (!hasNone && selected.has('Garage Door Remote(s)')) ? 'OS' : 'NA',
        fix_garage_keyless: (!hasNone && selected.has('Keyless Entry')) ? 'OS' : 'NA',
        _has_opener: !hasNone && selected.has('Garage Door Opener'),
        _has_remote: !hasNone && selected.has('Garage Door Remote(s)'),
      }
    },
  },
  {
    id: 'fix_garage_opener_count',
    question: () => 'How many garage door opener units?',
    questionEs: () => '¿Cuántas unidades de abridor de puerta de garaje?',
    fieldKey: 'fix_garage_opener_count',
    freeText: true,
    skipIf: (vals) => !vals['_has_opener'],
  },
  {
    id: 'fix_garage_remote_count',
    question: () => 'How many remotes?',
    questionEs: () => '¿Cuántos controles remotos?',
    fieldKey: 'fix_garage_remote_count',
    freeText: true,
    skipIf: (vals) => !vals['_has_remote'],
  },
  // Group 7 — Safety & Security
  {
    id: 'fix_safety_has',
    multiSelect: true,
    question: () => 'Safety & Security — which does the property have?',
    questionEs: () => 'Seguridad — ¿cuáles tiene la propiedad?',
    options: [
      'Smoke / Fire Detectors',
      'Security System',
      'Camera / Surveillance',
      'Video Doorbell',
      'Doorbell',
      'Intercom',
      'Generator',
    ],
    optionsEs: [
      'Detectores de humo / incendio',
      'Sistema de seguridad',
      'Cámara / Vigilancia',
      'Timbre de video',
      'Timbre',
      'Intercomunicador',
      'Generador',
    ],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const mapping: Array<[string, string]> = [
        ['Smoke / Fire Detectors', 'fix_smoke_detectors'],
        ['Security System', 'fix_security'],
        ['Camera / Surveillance', 'fix_camera_surveillance'],
        ['Video Doorbell', 'fix_video_doorbell'],
        ['Doorbell', 'fix_doorbell'],
        ['Intercom', 'fix_intercom'],
        ['Generator', 'fix_generator'],
      ]
      const updates: Record<string, unknown> = {}
      mapping.forEach(([label, key]) => {
        updates[key] = selected.has(label) ? 'OS' : 'NA'
      })
      updates['_has_smoke'] = selected.has('Smoke / Fire Detectors')
      updates['_has_security'] = selected.has('Security System')
      return updates
    },
  },
  {
    id: 'fix_smoke_count',
    question: () => 'How many smoke/fire detectors?',
    questionEs: () => '¿Cuántos detectores de humo/incendio?',
    fieldKey: 'fix_smoke_count',
    freeText: true,
    skipIf: (vals) => !vals['_has_smoke'],
  },
  {
    id: 'fix_security_ownership',
    question: () => 'Is the security system owned or leased?',
    questionEs: () => '¿El sistema de seguridad es propio o arrendado?',
    options: ['Owned', 'Leased'],
    optionsEs: ['Propio', 'Arrendado'],
    skipIf: (vals) => !vals['_has_security'],
    onAnswer: (answer) => ({
      fix_security_owned: answer === 'Owned' || answer === 'Propio',
      fix_security_leased: answer === 'Leased' || answer === 'Arrendado',
    }),
  },
  // Group 8 — Entertainment
  {
    id: 'fix_entertain_has',
    multiSelect: true,
    question: () => "Entertainment — what's mounted or installed?",
    questionEs: () => 'Entretenimiento — ¿qué está instalado o montado?',
    options: ["Mounted TV(s)", 'Mounted Speakers', 'TV Antenna / Satellite Dish', 'None'],
    optionsEs: ['Televisores montados', 'Altavoces montados', 'Antena de TV / Plato satelital', 'Ninguno'],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const hasNone = selected.has('None') || selected.has('Ninguno')
      return {
        fix_tv1: (!hasNone && selected.has("Mounted TV(s)")) ? 'OS' : 'NA',
        fix_speakers1: (!hasNone && selected.has('Mounted Speakers')) ? 'OS' : 'NA',
        fix_tv_antenna: (!hasNone && selected.has('TV Antenna / Satellite Dish')) ? 'OS' : 'NA',
        _has_tvs: !hasNone && selected.has("Mounted TV(s)"),
        _has_speakers: !hasNone && selected.has('Mounted Speakers'),
        _has_antenna: !hasNone && selected.has('TV Antenna / Satellite Dish'),
      }
    },
  },
  {
    id: 'fix_tv_count',
    question: () => 'How many mounted TVs?',
    questionEs: () => '¿Cuántos televisores montados?',
    options: ['1', '2', '3', '4'],
    optionsEs: ['1', '2', '3', '4'],
    skipIf: (vals) => !vals['_has_tvs'],
    onAnswer: (answer) => {
      const count = parseInt(answer, 10) || 1
      return {
        _tv_count: count,
        fix_tv2: count >= 2 ? 'OS' : 'NA',
        fix_tv3: count >= 3 ? 'OS' : 'NA',
        fix_tv4: count >= 4 ? 'OS' : 'NA',
      }
    },
  },
  {
    id: 'fix_tv1_location',
    question: () => 'TV 1 location (room):',
    questionEs: () => 'Ubicación del TV 1 (habitación):',
    fieldKey: 'fix_tv1_location',
    freeText: true,
    skipIf: (vals) => !vals['_has_tvs'],
  },
  {
    id: 'fix_tv2_location',
    question: () => 'TV 2 location:',
    questionEs: () => 'Ubicación del TV 2:',
    fieldKey: 'fix_tv2_location',
    freeText: true,
    skipIf: (vals) => (vals['_tv_count'] as number) < 2,
  },
  {
    id: 'fix_tv3_location',
    question: () => 'TV 3 location:',
    questionEs: () => 'Ubicación del TV 3:',
    fieldKey: 'fix_tv3_location',
    freeText: true,
    skipIf: (vals) => (vals['_tv_count'] as number) < 3,
  },
  {
    id: 'fix_tv4_location',
    question: () => 'TV 4 location:',
    questionEs: () => 'Ubicación del TV 4:',
    fieldKey: 'fix_tv4_location',
    freeText: true,
    skipIf: (vals) => (vals['_tv_count'] as number) < 4,
  },
  {
    id: 'fix_speakers_location',
    question: () => 'Speakers location:',
    questionEs: () => 'Ubicación de los altavoces:',
    fieldKey: 'fix_speakers1_location',
    freeText: true,
    skipIf: (vals) => !vals['_has_speakers'],
  },
  {
    id: 'fix_tv_antenna_type',
    question: () => 'TV antenna/dish — owned or leased?',
    questionEs: () => '¿La antena/plato de TV es propio o arrendado?',
    options: ['Owned', 'Leased'],
    optionsEs: ['Propio', 'Arrendado'],
    skipIf: (vals) => !vals['_has_antenna'],
    onAnswer: (answer) => ({
      fix_tv_antenna_owned: answer === 'Owned' || answer === 'Propio',
      fix_tv_antenna_leased: answer === 'Leased' || answer === 'Arrendado',
    }),
  },
  // Group 9 — Water & Other Systems
  {
    id: 'fix_water_sys_has',
    multiSelect: true,
    question: () => 'Water & Other Systems — which are present?',
    questionEs: () => 'Sistemas de agua y otros — ¿cuáles están presentes?',
    options: [
      'Water Heater',
      'Water Softener',
      'Water Purification System',
      'Sump Pump(s)',
      'Jetted Tub',
      'Wood Burning Stove',
    ],
    optionsEs: [
      'Calentador de agua',
      'Suavizador de agua',
      'Sistema de purificación de agua',
      'Bomba(s) de sumidero',
      'Bañera con chorros',
      'Estufa de leña',
    ],
    onAnswer: (answer) => {
      const selected = answer === 'None of these'
        ? new Set<string>()
        : new Set(answer.split(', '))
      const mapping: Array<[string, string]> = [
        ['Water Heater', 'fix_water_heater'],
        ['Water Softener', 'fix_water_softener'],
        ['Water Purification System', 'fix_water_purification'],
        ['Sump Pump(s)', 'fix_sump_pumps'],
        ['Jetted Tub', 'fix_jetted_tub'],
        ['Wood Burning Stove', 'fix_wood_stove'],
      ]
      const updates: Record<string, unknown> = {}
      mapping.forEach(([label, key]) => {
        updates[key] = selected.has(label) ? 'OS' : 'NA'
      })
      updates['_has_water_softener'] = selected.has('Water Softener')
      updates['_has_water_pur'] = selected.has('Water Purification System')
      updates['_has_sump'] = selected.has('Sump Pump(s)')
      return updates
    },
  },
  {
    id: 'fix_water_pur_own',
    question: () => 'Water purification — owned or leased?',
    questionEs: () => '¿El sistema de purificación de agua es propio o arrendado?',
    options: ['Owned', 'Leased'],
    optionsEs: ['Propio', 'Arrendado'],
    skipIf: (vals) => !vals['_has_water_pur'],
    onAnswer: (answer) => ({
      fix_water_pur_owned: answer === 'Owned' || answer === 'Propio',
      fix_water_pur_leased: answer === 'Leased' || answer === 'Arrendado',
    }),
  },
  {
    id: 'fix_sump_count',
    question: () => 'How many sump pumps?',
    questionEs: () => '¿Cuántas bombas de sumidero?',
    fieldKey: 'fix_sump_count',
    freeText: true,
    skipIf: (vals) => !vals['_has_sump'],
  },
]

// ── FINAL ─────────────────────────────────────────────────────────────────────
export const FINAL_SCRIPT: ScriptStep[] = [
  {
    id: 'additional_disclosures',
    question: () => "Is there any other material information about the property you'd like to disclose?",
    questionEs: () => '¿Hay alguna otra información material sobre la propiedad que desee divulgar?',
    fieldKey: 'additional_disclosures',
    freeText: true,
  },
]

// Map of section IDs → their locked script
export const SCRIPTED_SECTIONS: Record<string, ScriptStep[]> = {
  header: HEADER_SCRIPT,
  occupancy: OCCUPANCY_SCRIPT,
  construction: CONSTRUCTION_SCRIPT,
  land: LAND_SCRIPT,
  roof: ROOF_SCRIPT,
  infestation: INFESTATION_SCRIPT,
  structural: STRUCTURAL_SCRIPT,
  additions: ADDITIONS_SCRIPT,
  plumbing: PLUMBING_SCRIPT,
  hvac: HVAC_SCRIPT,
  electrical: ELECTRICAL_SCRIPT,
  hazardous: HAZARDOUS_SCRIPT,
  taxes_hoa: TAXES_HOA_SCRIPT,
  inspections: INSPECTIONS_SCRIPT,
  other_matters: OTHER_MATTERS_SCRIPT,
  utilities: UTILITIES_SCRIPT,
  electronics: ELECTRONICS_SCRIPT,
  fixtures: FIXTURES_SCRIPT,
  final: FINAL_SCRIPT,
}

// Helper: find index of next non-skipped step after `currentIdx`
export function findNextStep(
  script: ScriptStep[],
  currentIdx: number,
  vals: Record<string, unknown>,
): number {
  let next = currentIdx + 1
  while (next < script.length && script[next].skipIf?.(vals)) {
    next++
  }
  return next
}

// Helper: build context object from current values
export function buildScriptCtx(
  vals: Record<string, unknown>,
  fallbackAddress?: string,
): ScriptContext {
  return {
    s1name: (vals['_s1_name'] as string) || undefined,
    s2name: (vals['_s2_name'] as string) || undefined,
    address:
      (vals['_pending_address'] as string) ||
      (vals['property_address'] as string) ||
      fallbackAddress ||
      undefined,
  }
}
