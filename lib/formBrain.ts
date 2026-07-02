// lib/formBrain.ts
// Server-side helper that fetches form sections + field keys from Supabase.
// Phase 2: replaces hardcoded FORM_SECTIONS in formSections.ts.

import { createServiceClient } from '@/lib/supabase'

export interface FormBrainSection {
  key: string
  title: string
  titleEs?: string
  fieldKeys: string[]
}

/**
 * Fetches sections and their associated field keys from form_template_sections
 * and form_template_fields for the given form_slug.
 * Returns [] if the form is not in the DB (unknown slug, etc.).
 */
export async function fetchFormBrainSections(
  formSlug: string
): Promise<FormBrainSection[]> {
  const supabase = createServiceClient()

  const { data: sections, error: secErr } = await supabase
    .from('form_template_sections')
    .select('id, section_key, title, title_es, sort_order')
    .eq('form_slug', formSlug)
    .order('sort_order')

  if (secErr || !sections?.length) return []

  const sectionIds = sections.map((s) => s.id)

  const { data: fields, error: fieldErr } = await supabase
    .from('form_template_fields')
    .select('section_id, field_key, sort_order')
    .in('section_id', sectionIds)
    .order('sort_order')

  if (fieldErr) return []

  return sections.map((sec) => ({
    key: sec.section_key,
    title: sec.title,
    titleEs: sec.title_es ?? undefined,
    fieldKeys: (fields ?? [])
      .filter((f) => f.section_id === sec.id)
      .map((f) => f.field_key),
  }))
}
