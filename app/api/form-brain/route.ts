// app/api/form-brain/route.ts
// Returns form_template_sections + field keys for a given form_slug.
// Used by client components and the AI extraction pipeline (Phase 3).

import { NextRequest, NextResponse } from 'next/server'
import { fetchFormBrainSections } from '@/lib/formBrain'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const form_slug = searchParams.get('form_slug')
  if (!form_slug) {
    return NextResponse.json({ error: 'Missing form_slug' }, { status: 400 })
  }

  const sections = await fetchFormBrainSections(form_slug)
  return NextResponse.json({ sections })
}
