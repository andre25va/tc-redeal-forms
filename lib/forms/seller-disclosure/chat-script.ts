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
      // Check specifically for fix phrases — NOT general words like "correct"
      const needsFix =
        /let me fix|fix it|necesito corregir/i.test(answer)
      if (needsFix) {
        return { _pending_address: '', _addr_confirmed: 'fix' }
      }
      // Confirmed — commit to form
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
      const_conventional:
        answer === 'Conventional/Wood Frame' || answer === 'Convencional/Madera',
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

// Map of section IDs → their locked script
export const SCRIPTED_SECTIONS: Record<string, ScriptStep[]> = {
  header: HEADER_SCRIPT,
  occupancy: OCCUPANCY_SCRIPT,
  construction: CONSTRUCTION_SCRIPT,
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
    // Show pending address in confirm question, fall back to committed address
    address:
      (vals['_pending_address'] as string) ||
      (vals['property_address'] as string) ||
      fallbackAddress ||
      undefined,
  }
}
