import { createServiceClient } from '@/lib/supabase'
import { SELLER_DISCLOSURE_SECTIONS } from '@/lib/forms/seller-disclosure/config'
import FormClient from './FormClient'

export default async function FormPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient()

  const { data: invitation, error } = await supabase
    .from('form_invitations')
    .select('*')
    .eq('token', params.token)
    .single()

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Not Found</h1>
          <p className="text-gray-500">This form link is invalid or has expired. Please contact your agent for a new link.</p>
        </div>
      </div>
    )
  }

  if (invitation.status === 'submitted') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Submitted</h1>
          <p className="text-gray-500">This form has already been completed. Thank you!</p>
        </div>
      </div>
    )
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-500">This form link has expired. Please contact your agent for a new link.</p>
        </div>
      </div>
    )
  }

  // Load saved data
  const { data: submission } = await supabase
    .from('form_submissions')
    .select('form_data')
    .eq('invitation_id', invitation.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <FormClient
      sections={SELLER_DISCLOSURE_SECTIONS}
      token={params.token}
      initialData={(submission?.form_data as Record<string, unknown>) || {}}
      invitation={{
        seller_name: invitation.seller_name,
        property_address: invitation.property_address,
        seller_email: invitation.seller_email,
      }}
    />
  )
}
