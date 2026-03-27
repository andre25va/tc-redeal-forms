import { SELLER_DISCLOSURE_FIELDS } from './fields'
import { FormSection } from '@/types'

export const SELLER_DISCLOSURE_SECTIONS: FormSection[] = [
  {
    id: 'seller_property',
    title: 'Seller & Property Information',
    description: 'Basic information about the sellers and property',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'seller_property'),
  },
  {
    id: 'occupancy',
    title: 'Occupancy',
    description: 'Information about how long the property has been occupied',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'occupancy'),
  },
  {
    id: 'construction',
    title: 'Construction',
    description: 'Type of construction',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'construction'),
  },
  {
    id: 'land',
    title: 'Land',
    description: 'Information about the land and any issues',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'land'),
  },
  {
    id: 'roof',
    title: 'Roof',
    description: 'Roof age and any known issues',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'roof'),
  },
  {
    id: 'plumbing',
    title: 'Plumbing',
    description: 'Plumbing systems and any known issues',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'plumbing'),
  },
  {
    id: 'hvac',
    title: 'HVAC',
    description: 'Heating, ventilation, and air conditioning',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'hvac'),
  },
  {
    id: 'electrical',
    title: 'Electrical',
    description: 'Electrical systems and any known issues',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'electrical'),
  },
  {
    id: 'tax_hoa',
    title: 'Tax & HOA',
    description: 'Property taxes and homeowner association details',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'tax_hoa'),
  },
  {
    id: 'utilities',
    title: 'Utilities',
    description: 'Utility providers and systems',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'utilities'),
  },
  {
    id: 'electronics',
    title: 'Electronic Systems',
    description: 'Electronic and smart home systems',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'electronics'),
  },
  {
    id: 'fixtures',
    title: 'Fixtures & Appliances',
    description: 'Status of fixtures (OS=Owned by Seller, EX=Excluded, NA=Not Applicable, NS=Not Sure)',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'fixtures'),
  },
  {
    id: 'final',
    title: 'Material Information',
    description: 'Any other material information about the property',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'final'),
  },
  {
    id: 'signatures',
    title: 'Signatures',
    description: 'Seller and buyer signatures',
    fields: SELLER_DISCLOSURE_FIELDS.filter(f => f.section === 'signatures'),
  },
]

export const SELLER_DISCLOSURE_CONFIG = {
  slug: 'seller-disclosure',
  name: 'Seller Disclosure Addendum',
  description: 'Texas Seller Disclosure Addendum form',
  sections: SELLER_DISCLOSURE_SECTIONS,
  fields: SELLER_DISCLOSURE_FIELDS,
  totalPages: 8,
}
