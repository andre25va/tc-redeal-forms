import { NextRequest, NextResponse } from 'next/server'
import { createTransport } from '@/lib/email'

const FORM_LABELS: Record<string, string> = {
  'seller-disclosure': 'Seller Disclosure Addendum',
  'residential-sale-contract': 'Residential Sale Contract',
  'exclusive-right-to-sell': 'Exclusive Right to Sell Agreement',
}

export async function POST(req: NextRequest) {
  try {
    const { token, seller_email, seller_name, property_address, form_slug } = await req.json()

    if (!token || !seller_email) {
      return NextResponse.json({ error: 'token and seller_email required' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tc-redeal-forms.vercel.app'
    const formUrl = `${appUrl}/forms/${token}`
    const formLabel = FORM_LABELS[form_slug] || 'Form'
    const displayName = seller_name || seller_email

    const transporter = createTransport()

    await transporter.sendMail({
      from: `ReDeal Forms <${process.env.GMAIL_USER}>`,
      to: seller_email,
      subject: `Your ${formLabel} – Continue Where You Left Off`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0284c7; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">ReDeal Forms</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 16px; margin-top: 0;">Hi ${displayName},</p>
            <p style="color: #374151;">Here is your link to continue filling out your <strong>${formLabel}</strong>${property_address ? ` for <strong>${property_address}</strong>` : ''}.</p>
            <p style="color: #374151;">Your progress has been saved — you can pick up right where you left off.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${formUrl}"
                 style="background: #0284c7; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">
                Continue My Form →
              </a>
            </div>

            <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">
              If the button doesn't work, copy and paste this link into your browser:<br/>
              <a href="${formUrl}" style="color: #0284c7;">${formUrl}</a>
            </p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[resend-link] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
