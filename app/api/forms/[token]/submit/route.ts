import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { SELLER_DISCLOSURE_FIELDS } from '@/lib/forms/seller-disclosure/fields'
import { overlayFormData, generateSummaryPdf } from '@/lib/pdf/overlay'
import { sendFormCompletionEmails } from '@/lib/email'

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

    // Try to load PDF template from storage
    const { data: templateFile } = await supabase.storage
      .from('form-templates')
      .download('seller-disclosure/template.pdf')

    if (templateFile) {
      const arrayBuffer = await templateFile.arrayBuffer()
      pdfBytes = await overlayFormData(new Uint8Array(arrayBuffer), form_data, SELLER_DISCLOSURE_FIELDS)
    } else {
      // Generate summary PDF if no template
      pdfBytes = await generateSummaryPdf(
        form_data,
        SELLER_DISCLOSURE_FIELDS,
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
        // Don't fail submission if email fails
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
