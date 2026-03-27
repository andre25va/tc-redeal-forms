'use client'
import dynamic from 'next/dynamic'
import { FormSection } from '@/types'

const FormWizard = dynamic(() => import('@/components/FormWizard'), { ssr: false })

interface FormClientProps {
  sections: FormSection[]
  token: string
  initialData: Record<string, unknown>
  invitation: { seller_name?: string; property_address?: string; seller_email: string }
}

export default function FormClient({ sections, token, initialData, invitation }: FormClientProps) {
  return <FormWizard sections={sections} token={token} initialData={initialData} invitation={invitation} />
}
