import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { SELLER_DISCLOSURE_FIELDS } from '@/lib/forms/seller-disclosure/fields'
import { overlayFormData, generateSummaryPdf } from '@/lib/pdf/overlay'
import { sendFormCompletionEmails } from '@/lib/email'
import { PdfField } from '@/types'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { form_data } = await req.json()
    const supabase = createServiceClient()

    // Load invitation
    const { data: invitation, error: invError } = await supabase
      .from('form_invitations')
      .select('*')
      .eq('token', params.token)
      .single()

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }
    if (invitation.status === 'submitted') {
      return NextResponse.json({ error: 'Already submitted' }, { status: 410 })
    }

    // Get existing submission
    const { data: existingSubmission } = await supabase
      .from('form_submissions')
      .select('id')
      .eq('invitation_id', invitation.id)
      .single()

    let pdfBytes: Uint8Array

    // ── Load field coordinates from Supabase ───────────────────────────────
    // Coordinates are the source of truth for PDF positions.
    // We merge them with SELLER_DISCLOSURE_FIELDS for labels/section metadata.
    const { data: coords } = await supabase
      .from('field_coordinates')
      .select('*')
      .eq('form_slug', 'seller-disclosure')

    // Build a coordinate lookup by field_key
    const coordMap = new Map<string, Record<string, unknown>>()
    if (coords) {
      for (const c of coords) coordMap.set(c.field_key, c)
    }

    // Build the unified PdfField list:
    // 1. Start with SELLER_DISCLOSURE_FIELDS (has labels, sections, type info)
    // 2. Inject real coordinates from Supabase
    // 3. Add any coordinate-only fields (no matching wizard definition)
    const PX_TO_PT = 72 / 150
    const PAGE_H_PT = 792

    const coordToPagePt = (c: Record<string, unknown>, fieldH: number): { x: number; y: number; w: number; h: number } => {
      const px = (c.x as number) ?? 0
      const py = (c.y as number) ?? 0
      const pw = (c.width as number) ?? 80
      const ph = (c.height as number) ?? 14
      const w = Math.max(pw * PX_TO_PT, 8)
      const h = Math.max(ph * PX_TO_PT, fieldH)
      const x = px * PX_TO_PT
      const y = PAGE_H_PT - py * PX_TO_PT - h
      return { x, y, w, h }
    }

    // Wizard fields with injected coordinates
    const wizardFields: PdfField[] = SELLER_DISCLOSURE_FIELDS.map(f => {
      const coord = coordMap.get(f.key)
      if (!coord) return f
      const { x, y, w, h } = coordToPagePt(coord, f.type === 'textarea' ? 40 : 12)
      return { ...f, x, y, width: w, height: h, page: (coord.page_num as number) ?? f.page }
    })

    // Additional coordinate-only fields (drawn in mapper but not in wizard definition)
    const wizardKeys = new Set(SELLER_DISCLOSURE_FIELDS.map(f => f.key))
    const extraFields: PdfField[] = []
    if (coords) {
      for (const c of coords) {
        if (wizardKeys.has(c.field_key)) continue  // already handled above
        const { x, y, w, h } = coordToPagePt(c, 12)
        const val = form_data[c.field_key]
        if (val === undefined && c.field_type !== 'initial' && c.field_type !== 'signature') continue
        extraFields.push({
          key: c.field_key,
          label: c.field_key,
          page: c.page_num ?? 1,
          type: c.field_type ?? 'text',
          x, y,
          width: w,
          height: h,
          section: 'extra',
        } as PdfField)
      }
    }

    const allFields = [...wizardFields, ...extraFields]

    // Try to load PDF template from storage
    const { data: templateFile } = await supabase.storage
      .from('form-templates')
      .download('seller-disclosure/template.pdf')

    if (templateFile) {
      const arrayBuffer = await templateFile.arrayBuffer()
      pdfBytes = await overlayFormData(new Uint8Array(arrayBuffer), form_data, allFields)
    } else {
      // Fallback: generate a text summary PDF if no template has been baked yet
      pdfBytes = await generateSummaryPdf(
        form_data,
        allFields,
        invitation.property_address || '',
        invitation.seller_name || invitation.seller_email
      )
    }

    // Store PDF in Supabase Storage
    const fileName = `seller-disclosure-${invitation.token}-${Date.now()}.pdf`
    const storagePath = `submissions/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('form-pdfs')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf' })

    let pdfUrl = ''
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('form-pdfs').getPublicUrl(storagePath)
      pdfUrl = urlData.publicUrl
    }

    // Update or create submission
    const submissionData = {
      form_data,
      pdf_path: storagePath,
      pdf_url: pdfUrl,
      submitted_at: new Date().toISOString(),
      last_saved_at: new Date().toISOString(),
    }

    if (existingSubmission) {
      await supabase.from('form_submissions').update(submissionData).eq('id', existingSubmission.id)
    } else {
      await supabase.from('form_submissions').insert({ invitation_id: invitation.id, ...submissionData })
    }

    // Mark invitation as submitted
    await supabase.from('form_invitations').update({ status: 'submitted' }).eq('id', invitation.id)

    // Send emails if configured
    if (process.env.GMAIL_APP_PASSWORD) {
      try {
        await sendFormCompletionEmails({
          sellerEmail: invitation.seller_email,
          sellerName: invitation.seller_name,
          realtorEmail: invitation.realtor_email,
          realtorName: invitation.realtor_name,
          brokerEmail: invitation.broker_email,
          brokerName: invitation.broker_name,
          propertyAddress: invitation.property_address,
          pdfBuffer: Buffer.from(pdfBytes),
          fileName,
        })
      } catch (emailError) {
        console.error('Email send error:', emailError)
        // Don't fail the submission if email send fails
      }
    }

    return NextResponse.json({
      success: true,
      pdfUrl: pdfUrl || null,
    })
  } catch (error: unknown) {
    console.error('Submit error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
