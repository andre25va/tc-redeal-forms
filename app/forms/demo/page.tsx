import FormWizard from '@/components/FormWizard'
import { SELLER_DISCLOSURE_SECTIONS } from '@/lib/forms/seller-disclosure/config'

export default function DemoFormPage() {
  const mockInvitation = {
    seller_name: 'John & Jane Smith',
    property_address: '123 Main Street, Austin, TX 78701',
    seller_email: 'demo@example.com',
  }

  return (
    <div>
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 text-center py-1.5 text-xs font-semibold tracking-wide">
        📋 DEMO PREVIEW — This is a preview only. Submissions will not be saved.
      </div>
      <div className="pt-8">
        <FormWizard
          sections={SELLER_DISCLOSURE_SECTIONS}
          token="demo"
          initialData={{}}
          invitation={mockInvitation}
          isDemo={true}
        />
      </div>
    </div>
  )
}
