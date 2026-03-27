export type PdfFieldType = 'text' | 'textarea' | 'choice' | 'date' | 'signature' | 'fixture_status'

export interface PdfField {
  key: string
  label: string
  page: number
  type: PdfFieldType
  x: number
  y: number
  width?: number
  height?: number
  fontSize?: number
  multiline?: boolean
  choices?: string[]
  section: string
}

export interface FormTemplate {
  id: string
  slug: string
  name: string
  description?: string
  pdf_template_path?: string
  field_registry: PdfField[]
  is_active: boolean
  created_at: string
}

export interface FormInvitation {
  id: string
  token: string
  form_slug: string
  property_address?: string
  seller_name?: string
  seller_email: string
  realtor_name?: string
  realtor_email?: string
  broker_name?: string
  broker_email?: string
  created_by?: string
  status: 'pending' | 'in_progress' | 'submitted'
  expires_at: string
  created_at: string
}

export interface FormSubmission {
  id: string
  invitation_id: string
  form_data: Record<string, unknown>
  pdf_path?: string
  pdf_url?: string
  submitted_at?: string
  last_saved_at: string
  created_at: string
}

export type FormSection = {
  id: string
  title: string
  description?: string
  fields: PdfField[]
}
