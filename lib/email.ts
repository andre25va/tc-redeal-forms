import nodemailer from 'nodemailer'

export function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function sendFormCompletionEmails({
  sellerEmail,
  sellerName,
  realtorEmail,
  realtorName,
  brokerEmail,
  brokerName,
  propertyAddress,
  pdfBuffer,
  fileName,
}: {
  sellerEmail: string
  sellerName?: string
  realtorEmail?: string
  realtorName?: string
  brokerEmail?: string
  brokerName?: string
  propertyAddress?: string
  pdfBuffer: Buffer
  fileName: string
}) {
  const transporter = createTransport()

  const recipients = [
    sellerEmail,
    realtorEmail,
    brokerEmail,
  ].filter(Boolean) as string[]

  const subject = `Seller Disclosure Addendum - ${propertyAddress || 'Form Completed'}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0284c7; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">ReDeal Forms</h1>
      </div>
      <div style="padding: 30px; background: #f9fafb;">
        <h2 style="color: #111827;">Seller Disclosure Addendum Completed</h2>
        <p style="color: #374151;">The Seller Disclosure Addendum for the following property has been completed and is attached to this email.</p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: #374151;"><strong>Property:</strong> ${propertyAddress || 'N/A'}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Seller:</strong> ${sellerName || sellerEmail}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Completed:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        <p style="color: #374151;">Please find the completed disclosure document attached as a PDF.</p>
        <p style="color: #6b7280; font-size: 12px;">This is an automated message from ReDeal Forms. Please do not reply to this email.</p>
      </div>
    </div>
  `

  const mailOptions = {
    from: `ReDeal Forms <${process.env.GMAIL_USER}>`,
    to: recipients,
    subject,
    html,
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  }

  return await transporter.sendMail(mailOptions)
}
