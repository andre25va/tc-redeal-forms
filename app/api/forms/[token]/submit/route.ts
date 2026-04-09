import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { overlayFormData, generateSummaryPdf } from '@/lib/pdf/overlay'
import { sendFormCompletionEmails } from '@/lib/email'
import { PdfField } from '@/types'

// PDF page height in points (letter size = 8.5" × 11" at 72 DPI)
const PAGE_H_PT = 792

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { form_data } = await req.json()
    const supabase = createServiceClient()

    // ── Load invitation ──────────────────────────────────────────────────────
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

    const formSlug: string = invitation.form_slug

    // ── Get existing submission (if any) ────────────────────────────────────
    const { data: existingSubmission } = await supabase
      .from('form_submissions')
      .select('id')
      .eq('invitation_id', invitation.id)
      .single()

    // ── Load field coordinates from Supabase ─────────────────────────────────
    // Coordinates are in PDF points (72 DPI), y measured from the TOP of the page.
    // pdf-lib uses y from the BOTTOM, so we flip: y_bottom = PAGE_H_PT - y_top - height
    const { data: coords } = await supabase
      .from('field_coordinates')
      .select('*')
      .eq('form_slug', formSlug)

    const allFields: PdfField[] = (coords ?? []).map(c => {
      const h = (c.height as number) ?? 14
      const w = (c.width  as number) ?? 80
      const xPt = (c.x as number) ?? 0
      const yPt = (c.y as number) ?? 0
      // Flip y-axis: top-origin (pdf.js/DB) → bottom-origin (pdf-lib)
      const yPdfLib = PAGE_H_PT - yPt - h
      return {
        key:    c.field_key,
        label:  c.field_key,
        page:   (c.page_num as number) ?? 1,
        type:   (c.field_type as string) ?? 'text',
        x:      xPt,
        y:      yPdfLib,
        width:  w,
        height: h,
        section: formSlug,
      } as PdfField
    })

    // ── Load PDF template from Supabase Storage ──────────────────────────────
    let pdfBytes: Uint8Array

    // Get the template path from form_templates table
    const { data: formTemplate } = await supabase
      .from('form_templates')
      .select('pdf_template_path, name')
      .eq('slug', formSlug)
      .single()

    const templatePath = formTemplate?.pdf_template_path

    const { data: templateFile, error: storageError } = templatePath
      ? await supabase.storage.from('form-templates').download(templatePath)
      : { data: null, error: 'no path' }

    if (templateFile && !storageError) {
      const arrayBuffer = await templateFile.arrayBuffer()
      pdfBytes = await overlayFormData(new Uint8Array(arrayBuffer), form_data, allFields)
    } else {
      // Fallback: text summary PDF
      pdfBytes = await generateSummaryPdf(
        form_data,
        allFields,
        invitation.property_address || '',
        invitation.seller_name || invitation.seller_email
      )
    }

    // ── Store PDF in Supabase Storage ────────────────────────────────────────
    const fileName = `${formSlug}-${invitation.token}-${Date.now()}.pdf`
    const storagePath = `submissions/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('form-pdfs')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf' })

    let pdfUrl = ''
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('form-pdfs').getPublicUrl(storagePath)
      pdfUrl = urlData.publicUrl
    }

    // ── Upsert form_submissions ──────────────────────────────────────────────
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

    // ── Mark invitation as submitted ─────────────────────────────────────────
    await supabase.from('form_invitations').update({ status: 'submitted' }).eq('id', invitation.id)

    // ── Send emails ───────────────────────────────────────────────────────────
    if (process.env.GMAIL_APP_PASSWORD) {
      try {
        await sendFormCompletionEmails({
          sellerEmail:      invitation.seller_email,
          sellerName:       invitation.seller_name,
          realtorEmail:     invitation.realtor_email,
          realtorName:      invitation.realtor_name,
          brokerEmail:      invitation.broker_email,
          brokerName:       invitation.broker_name,
          propertyAddress:  invitation.property_address,
          pdfBuffer:        Buffer.from(pdfBytes),
          fileName,
        })
      } catch (emailError) {
        console.error('[submit] Email send error:', emailError)
        // Don't fail the submission if email send fails
      }
    }

    return NextResponse.json({ success: true, pdfUrl: pdfUrl || null })
  } catch (error: unknown) {
    console.error('[submit] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
