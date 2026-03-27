import { SELLER_DISCLOSURE_FIELDS, SECTION_META } from './fields'
import { FormSection } from '@/types'

// Build all sections dynamically from the field registry
const SECTION_IDS = [
  'header',
  'occupancy',
  'construction',
  'land',
  'roof',
  'infestation',
  'structural',
  'additions',
  'plumbing',
  'hvac',
  'electrical',
  'hazardous',
  'taxes_hoa',
  'inspections',
  'other_matters',
  'utilities',
  'electronics',
  'fixtures',
  'final',
  'signatures',
]

export const SELLER_DISCLOSURE_SECTIONS: FormSection[] = SECTION_IDS.map(id => {
  const meta = SECTION_META[id] || { title: id, icon: '📄', page: 1 }
  return {
    id,
    title: meta.title,
    description: undefined,
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === id),
  }
}).filter(s => s.fields.length > 0)

export const SELLER_DISCLOSURE_CONFIG = {
  slug: 'seller-disclosure',
  name: 'Seller Disclosure Addendum',
  description: 'Missouri Seller\'s Disclosure and Condition of Property Addendum (Residential)',
  sections: SELLER_DISCLOSURE_SECTIONS,
  fields: SELLER_DISCLOSURE_FIELDS,
  totalPages: 8,
}
