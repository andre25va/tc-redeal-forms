export interface FormSection {
  key: string
  title: string
  titleEs?: string
  prefixes: string[]
}

export interface ChatField {
  key: string
  type: 'choice' | 'text' | 'checkbox' | 'signature' | 'initial' | string
  label: string
  choices?: string[]
}

export const FORM_SECTIONS: Record<string, FormSection[]> = {
  'seller-disclosure': [
    { key: 'intro',        title: 'Property & Seller Info',     titleEs: 'Información del Vendedor',       prefixes: ['sellerName', 'propertyAddress', 'yearBuilt', 'ownershipYears', 'howLong', 'occ_', 'const_'] },
    { key: 'land',         title: 'Land & Lot',                 titleEs: 'Terreno y Lote',                 prefixes: ['land_', 'landExp'] },
    { key: 'roof',         title: 'Roof',                       titleEs: 'Techo',                          prefixes: ['roof', 'if_any_of_the_answers_in_this_section_are_yes'] },
    { key: 'infestation',  title: 'Infestation',                titleEs: 'Infestación',                    prefixes: ['infest_', 'pestControl', 'pestWarranty'] },
    { key: 'structural',   title: 'Structural',                 titleEs: 'Estructura',                     prefixes: ['struct_', 'fireplace', 'sec_8_'] },
    { key: 'additions',    title: 'Additions & Plumbing',       titleEs: 'Adiciones y Plomería',           prefixes: ['add_', 'plumb_', 'septicLocation'] },
    { key: 'hvac',         title: 'HVAC & Electrical',          titleEs: 'Clima y Electricidad',           prefixes: ['hvac_', 'electricalPanel', 'elec_a', 'elec_b', 'elec_c'] },
    { key: 'hazardous',    title: 'Hazardous Conditions',       titleEs: 'Condiciones Peligrosas',         prefixes: ['haz_'] },
    { key: 'taxes_hoa',    title: 'Taxes & HOA',                titleEs: 'Impuestos y HOA',                prefixes: ['tax_', 'tax14'] },
    { key: 'inspections',  title: 'Inspections',                titleEs: 'Inspecciones',                   prefixes: ['inspect_'] },
    { key: 'other_matters',title: 'Other Matters',              titleEs: 'Otros Asuntos',                  prefixes: ['other_', 'sec16', 'elec_sys', 'electricCompany', 'electricPhone', 'gasPhone', 'gasCompany', 'waterCompany', 'waterPhone', 'trashPhone', 'trashCompany', 'otherUtility'] },
    { key: 'comments',     title: 'Additional Comments',        titleEs: 'Comentarios Adicionales',        prefixes: ['additionalComments'] },
  ],

  'exclusive-right-to-sell': [
    {
      key: 'property_info',
      title: 'Property & Listing Info',
      titleEs: 'Información de la Propiedad',
      prefixes: ['text_7b43', 'text_2271', 'text_66d2', 'text_09d6', 'text_ba8f', 'text_d851', 'text_2af3', 'text_9b4d', 'text_aafa', 'text_aa36', 'text_7d47', 'text_4614'],
    },
    {
      key: 'mls_property_type',
      title: 'MLS Entry & Property Type',
      titleEs: 'Entrada MLS y Tipo de Propiedad',
      prefixes: ['checkbox_72a7', 'text_6637', 'checkbox_50af', 'checkbox_6534', 'checkbox_a38e'],
    },
    {
      key: 'marketing',
      title: 'Marketing Distribution',
      titleEs: 'Distribución de Mercadeo',
      prefixes: ['checkbox_667d', 'checkbox_2cc6', 'checkbox_4c2b', 'checkbox_da12', 'checkbox_70ff', 'text_0b2a'],
    },
    {
      key: 'seller_obligations',
      title: 'Seller Obligations',
      titleEs: 'Obligaciones del Vendedor',
      prefixes: ['text_17d6'],
    },
    {
      key: 'broker_authorization',
      title: 'Broker Authorization to Disclose',
      titleEs: 'Autorización al Corredor para Divulgar',
      prefixes: ['checkbox_0b84', 'checkbox_b20b', 'checkbox_e3f8', 'checkbox_c1e8', 'checkbox_e36d'],
    },
    {
      key: 'brokerage_relationships',
      title: 'Brokerage Relationships',
      titleEs: 'Relaciones de Corretaje',
      prefixes: ['checkbox_63bb', 'checkbox_233e', 'checkbox_38d2', 'checkbox_8d52', 'checkbox_ff84', 'checkbox_93b4', 'checkbox_4bf8', 'checkbox_6d73', 'checkbox_ccc5', 'checkbox_e33b', 'checkbox_51cc', 'checkbox_bb1e'],
    },
    {
      key: 'compensation',
      title: 'Compensation',
      titleEs: 'Compensación',
      prefixes: ['text_553d', 'text_c328', 'text_fa0f', 'checkbox_0565', 'checkbox_de7d', 'text_1df4', 'text_b309'],
    },
    {
      key: 'title_warranty',
      title: 'Title & Home Warranty',
      titleEs: 'Título y Garantía del Hogar',
      prefixes: ['text_8bde', 'text_6089', 'text_324c', 'text_7098', 'text_aff6', 'text_df30', 'checkbox_b19f', 'checkbox_89af', 'text_45ab', 'checkbox_fc9f'],
    },
    {
      key: 'additional_terms',
      title: 'Additional Terms',
      titleEs: 'Términos Adicionales',
      prefixes: ['checkbox_457b', 'text_e03a', 'text_88f8', 'text_c470', 'text_0990'],
    },
    {
      key: 'signatures',
      title: 'Signatures & Contact Info',
      titleEs: 'Firmas e Información de Contacto',
      prefixes: ['text_a0fd', 'text_2780', 'text_fca0', 'text_a78e', 'text_c621', 'text_056c', 'text_f47a', 'text_5d08', 'text_f4d2', 'text_e9ad', 'text_e6cf', 'text_13d2', 'text_7fd1', 'text_4be4'],
    },
  ],

  'residential-sale-contract': [
    {
      key: 'parties',
      title: 'Parties & Property',
      titleEs: 'Partes y Propiedad',
      prefixes: ['seller_name_', 'buyer_name_', 'bank_owned_check', 'manufactured_home_check', 'property_address', 'county', 'legal_desc_'],
    },
    {
      key: 'inclusions_exclusions',
      title: 'Inclusions & Exclusions',
      titleEs: 'Inclusiones y Exclusiones',
      prefixes: ['additional_inclusions_', 'exclusions_'],
    },
    {
      key: 'additional_terms',
      title: 'Additional Terms & Warranty',
      titleEs: 'Términos Adicionales y Garantía',
      prefixes: ['additional_terms_', 'warranty_'],
    },
    {
      key: 'addenda',
      title: 'Addenda',
      titleEs: 'Addenda',
      prefixes: ['addendum_', 'other '],
    },
    {
      key: 'broker_disclosure',
      title: 'Licensed Broker Disclosure',
      titleEs: 'Divulgación de Corredor Licenciado',
      prefixes: ['p3_'],
    },
    {
      key: 'purchase_price',
      title: 'Purchase Price & Earnest Money',
      titleEs: 'Precio de Compra y Dinero de Garantía',
      prefixes: ['purchase_price', 'earnest_', 'add_earnest_', 'total_amount_financed', 'balance_purchase_price', 'buyer_broker_compensation', 'seller_additional_costs', 'costs_not_payable_buyer', 'total_seller_expenses'],
    },
    {
      key: 'closing',
      title: 'Closing & Possession',
      titleEs: 'Cierre y Posesión',
      prefixes: ['closing_date', 'possession_', 'cash_appraisal_days', 'appraisal_notify_days', 'appraisal_negotiation_days', 'offer_expiration_'],
    },
    {
      key: 'financing',
      title: 'Financing',
      titleEs: 'Financiamiento',
      prefixes: ['sale_not_contingent_check', 'sale_contingent_check', 'cash_sale_', 'financed_sale_check', 'loan_change_', 'primary_', 'secondary_'],
    },
    {
      key: 'loan_details',
      title: 'Loan Details & Approval',
      titleEs: 'Detalles y Aprobación de Préstamo',
      prefixes: ['buyer_preapproved_check', 'buyer_not_preapproved_check', 'lender_name', 'not_preapproved_days', 'loan_approval_days', 'loan_approval_alt_days', 'lender_appraisal_amount'],
    },
    {
      key: 'inspection',
      title: 'Inspection, Survey & Repairs',
      titleEs: 'Inspección, Topografía y Reparaciones',
      prefixes: ['survey_days', 'inspection_period_days', 'renegotiation_period_days', 'additional_structures_', 'unacceptable_exclusions_'],
    },
    {
      key: 'brokerage',
      title: 'Brokerage Relationships',
      titleEs: 'Relaciones de Corretaje',
      prefixes: ['seller_agent_', 'buyer_agent_', 'seller_designated_', 'buyer_designated_', 'seller_transaction_', 'buyer_transaction_', 'seller_disclosed_', 'buyer_disclosed_', 'subagent_', 'brokers_compensated_check', 'lic_seller_date', 'lic_buyer_date', 'lic_seller_sig', 'lic_buyer_sig', 'buyer_brokerage_', 'seller_brokerage_'],
    },
    {
      key: 'signatures',
      title: 'Signatures & Contact Info',
      titleEs: 'Firmas e Información de Contacto',
      prefixes: ['seller_sig_', 'buyer_sig_', 'seller_date_', 'buyer_date_', 'brokerage_seller', 'brokerage_buyer', 'lic_seller_name_print', 'lic_buyer_name_print', 'lic_seller_contact', 'lic_buyer_contact', 'brokerage_seller_contact', 'brokerage_buyer_contact', 'lic_seller_email', 'lic_buyer_email', 'licensee_preparing_sig', 'rejection_'],
    },
  ],
}

const FIELD_LABEL_MAP: Record<string, string> = {
  // ── Seller Disclosure ──────────────────────────────────────────────────────
  sellerName1: 'Seller 1 Full Name',
  sellerName2: 'Seller 2 Full Name',
  propertyAddress: 'Property Address',
  yearBuilt: 'Year Built',
  ownershipYears: 'Years Owned',
  howLongSinceOccupied: 'How long since you last occupied the property',
  occ_seller_occupies: 'Seller currently occupies the property',
  occ_never_occupied: 'Seller has never occupied the property',
  const_conventional: 'Conventional construction',
  const_modular: 'Modular',
  const_manufactured: 'Manufactured',
  const_mobile: 'Mobile home',
  const_other_cb: 'Other construction type',
  landExplanation: 'Land issues explanation',
  roofAge: 'Roof age (years)',
  roofType: 'Roof type / material',
  roofIssuesDesc: 'Description of roof issues',
  roofRepairCompany: 'Roof repair company name',
  roofRepairDate: 'Date of roof repair',
  roofLayers: 'Number of roof layers',
  pestControlInfo: 'Pest control company info',
  pestWarrantyCost: 'Pest warranty annual cost',
  pestWarrantyTime: 'Pest warranty time remaining',
  fireplaceInspectionDate: 'Last fireplace inspection date',
  septicLocation: 'Septic system location',
  electricalPanelLocation: 'Electrical panel location',
  electricalPanelSize: 'Electrical panel size (amps)',
  tax14aBondsAmount: 'Outstanding bond amount',
  tax14lAmount: 'HOA fee amount',
  tax14mDueDate: 'Assessment due date',
  tax14mAmount: 'Assessment amount',
  tax14mIncludes: 'Assessment includes',
  tax14mContact: 'HOA contact info',
  sec16iLocks: 'Electronic lock / security system details',
  electricCompany: 'Electric company name',
  electricPhone: 'Electric company phone',
  gasCompany: 'Gas company name',
  gasPhone: 'Gas company phone',
  waterCompany: 'Water company name',
  waterPhone: 'Water company phone',
  trashCompany: 'Trash company name',
  trashPhone: 'Trash company phone',
  otherUtility1: 'Other utility name',
  otherUtilityPhone1: 'Other utility phone',
  additionalComments: 'Additional comments or disclosures',

  // ── Exclusive Right to Sell ────────────────────────────────────────────────
  // Section 1 – Property & Listing Info
  text_7b43: 'Contract Date',
  text_2271: 'Seller Name & Marital Status',
  text_66d2: 'Broker / Brokerage Name',
  text_09d6: 'Property Address',
  text_ba8f: 'Legal Description Addendum Reference',
  text_d851: 'Legal Description (Line 1)',
  text_2af3: 'Legal Description (Line 2)',
  text_9b4d: 'Legal Description (Line 3)',
  text_aafa: 'Property Description / Parcel ID',
  text_aa36: 'Listing Start Date',
  text_7d47: 'Listing End Date',
  text_4614: 'List Price ($)',

  // Section 2 – MLS & Property Type
  checkbox_72a7: 'Authorize delayed MLS entry (showings on hold until MLS active date)',
  text_6637: 'MLS Active Date (if delayed entry)',
  checkbox_50af: 'Property Type: Residential Resale',
  checkbox_6534: 'Property Type: New Home Construction',
  checkbox_a38e: 'Property Type: Land',

  // Section 3 – Marketing Distribution
  checkbox_667d: 'Active with Full Distribution',
  checkbox_2cc6: 'Active with Limited Marketing Distribution',
  checkbox_4c2b: 'Coming Soon with Full Distribution',
  checkbox_da12: 'Coming Soon with No Distribution',
  checkbox_70ff: 'Private Office Exclusive / No Distribution',
  text_0b2a: 'Full Distribution Conversion Date',

  // Section 4 – Seller Obligations
  text_17d6: 'Forfeited Deposit Retained by Broker (%)',

  // Section 5 – Broker Authorization
  checkbox_0b84: 'Seller does NOT authorize broker to disclose reason for sale',
  checkbox_b20b: 'Seller authorizes broker to disclose motivating factors for sale',
  checkbox_e3f8: 'Seller does NOT authorize broker to disclose other offers',
  checkbox_c1e8: 'Seller authorizes broker to disclose existence of other offers',
  checkbox_e36d: 'Seller authorizes broker to disclose existence AND TERMS of other offers',

  // Section 6 – Brokerage Relationships
  checkbox_63bb: 'Seller Agency – Yes',
  checkbox_233e: 'Seller Agency – No',
  checkbox_38d2: 'Transaction Broker – Yes',
  checkbox_8d52: 'Transaction Broker – No',
  checkbox_ff84: 'Subagency – Yes',
  checkbox_93b4: 'Subagency – No',
  checkbox_4bf8: 'Dual Agency (Missouri only) – Yes',
  checkbox_6d73: 'Dual Agency (Missouri only) – No',
  checkbox_ccc5: 'Designated Agent for Seller (Kansas) – Yes',
  checkbox_e33b: 'Designated Agent for Seller (Kansas) – No',
  checkbox_51cc: 'Designated Agent for Buyer (Kansas) – Yes',
  checkbox_bb1e: 'Designated Agent for Buyer (Kansas) – No',

  // Section 7 – Compensation
  text_553d: 'Compensation to Listing Broker (description)',
  text_c328: 'Unrepresented Buyer – Additional Compensation',
  text_fa0f: 'Total Compensation to Listing Broker',
  checkbox_0565: 'Additional compensation applies if buyer is unrepresented',
  checkbox_de7d: 'Other Compensation (check if applicable)',
  text_1df4: 'Other Compensation Details',
  text_b309: 'Protection Period (calendar days)',

  // Section 8 – Title & Home Warranty
  text_8bde: 'Title Evidence Through (company/source)',
  text_6089: 'Title Vested in Name of',
  text_324c: 'Title Vesting Detail (Line 1)',
  text_7098: 'Title Vesting Detail (Line 2 — marital status, trust, LLC)',
  text_aff6: 'Home Warranty – Max Cost (not to exceed $)',
  text_df30: 'Home Warranty Vendor',
  checkbox_b19f: 'Seller agrees to purchase a home warranty',
  checkbox_89af: 'Seller does NOT agree to purchase a home warranty',
  text_45ab: 'Home Warranty Amount ($)',
  checkbox_fc9f: 'Seller does NOT agree to purchase a home warranty (alt)',

  // Section 9 – Additional Terms
  checkbox_457b: 'Franchise Disclosure (broker is a franchise member)',
  text_e03a: 'Additional Terms & Conditions (Line 1)',
  text_88f8: 'Additional Terms & Conditions (Line 2)',
  text_c470: 'Additional Terms & Conditions (Line 3)',
  text_0990: 'Additional Terms & Conditions (Line 4)',

  // Section 10 – Signatures & Contact
  text_a0fd: 'Brokerage Name',
  text_2780: 'Seller 1 – Printed Name',
  text_fca0: 'Seller 1 – Signature Date',
  text_a78e: 'Licensee Assisting Seller',
  text_c621: 'Licensee Date',
  text_056c: 'Seller 2 – Printed Name',
  text_f47a: 'Seller 2 – Signature Date',
  text_5d08: 'Seller Address',
  text_f4d2: 'Seller City, State, ZIP',
  text_e9ad: 'Seller Phone',
  text_e6cf: 'Seller Email',
  text_13d2: 'Designated Agent Name (Line 1)',
  text_7fd1: 'Designated Agent Name (Line 2)',
  text_4be4: "Broker's Signature Name",

  // Initials (page footers — shown but not in main sections)
  text_bed0: 'Seller 1 Initials',
  text_785a: 'Seller 2 Initials',
  text_5a7b: 'Seller 1 Initials',
  text_e2bb: 'Seller 2 Initials',
  text_f99b: 'Seller 1 Initials',
  text_9933: 'Seller 2 Initials',
  text_a2c8: 'Seller 1 Initials',
  text_365d: 'Seller 2 Initials',
  text_c8f2: 'Seller 1 Initials',
  text_9c24: 'Seller 2 Initials',
  text_c5f0: 'Seller 1 Initials',
  text_8d7c: 'Seller 2 Initials',
  text_98e7: 'Seller 1 Initials',
  text_6da7: 'Seller 2 Initials',

  // ── Residential Sale Contract ──────────────────────────────────────────────
  seller_name_1: 'Seller 1 Full Name / Marital Status',
  seller_name_2: 'Seller 2 Full Name / Marital Status',
  buyer_name_1: 'Buyer 1 Full Name / Marital Status',
  buyer_name_2: 'Buyer 2 Full Name / Marital Status',
  bank_owned_check: 'Bank-Owned / REO Property',
  manufactured_home_check: 'Manufactured Home',
  property_address: 'Property Address',
  county: 'County',
  legal_desc_1: 'Legal Description (Line 1)',
  legal_desc_2: 'Legal Description (Line 2)',
  legal_desc_3: 'Legal Description (Line 3)',
  warranty_waive_check: 'Waive Home Warranty',
  limited_home_warranty: 'Include Limited Home Warranty',
  warranty_seller_check: 'Warranty paid by: Seller',
  warranty_buyer_check: 'Warranty paid by: Buyer',
  warranty_cost: 'Warranty Cost ($)',
  warranty_vendor: 'Warranty Vendor',
  warranty_deductible: 'Warranty Deductible ($)',
  warranty_lic_buyer_check: "Warranty to Buyer's Licensee",
  warranty_lic_seller_check: "Warranty to Seller's Licensee",
  addendum_sellers_disc_check: "Seller's Disclosure Addendum",
  addendum_lead_check: 'Lead-Based Paint Addendum',
  addendum_contingency_check: 'Sale Contingency Addendum',
  addendum_other_1: 'Other Addendum 1 Name',
  addendum_other_2: 'Other Addendum 2 Name',
  addendum_other_3: 'Other Addendum 3 Name',
  addendum_other_4b: 'Other Addendum 4 Name',
  addendum_other_5a: 'Other Addendum 5a Name',
  addendum_other_5b: 'Other Addendum 5b Name',
  addendum_other_6a: 'Other Addendum 6a Name',
  addendum_other_6b: 'Other Addendum 6b Name',
  'other 0': 'Other Addendum — Applies',
  'other 01': 'Other Addendum — Applies',
  'other 1': 'Other Addendum 1 — Applies',
  'other 2': 'Other Addendum 2 — Applies',
  'other 3': 'Other Addendum 3 — Applies',
  p3_is_licensed_broker: 'Seller is a licensed real estate broker',
  p3_seller_licensed_mo: 'Seller licensed in Missouri',
  p3_seller_licensed_ks: 'Seller licensed in Kansas',
  p3_seller_licensed_other_check: 'Seller licensed in other state',
  p3_seller_licensed_other_text: 'Other state (seller)',
  p3_buyer_licensed_ks: 'Buyer licensed in Kansas',
  p3_buyer_licensed_mo: 'Buyer licensed in Missouri',
  p3_buyer_licensed_other_check: 'Buyer licensed in other state',
  p3_buyer_licensed_other_text: 'Other state (buyer)',
  p3_lic_seller_family: 'Seller is related to a licensed agent',
  p3_lic_seller_fam_seller: "Agent related to seller (seller's side)",
  p3_lic_seller_fam_buyer: "Agent related to seller (buyer's side)",
  p3_lic_buyer_family: 'Buyer is related to a licensed agent',
  p3_lic_buyer_fam_seller: "Agent related to buyer (seller's side)",
  p3_lic_buyer_fam_buyer: "Agent related to buyer (buyer's side)",
  purchase_price: 'Purchase Price ($)',
  earnest_delivery_days: 'Earnest Money Delivery (days)',
  earnest_money_amount: 'Earnest Money Amount ($)',
  earnest_form_other: 'Earnest Money Form (other)',
  earnest_form_check_eft: 'Earnest Money via EFT',
  earnest_deposited_with: 'Earnest Money Deposited With',
  earnest_nonrefundable_check: 'Earnest Money is Non-Refundable',
  earnest_refundable_check: 'Earnest Money is Refundable',
  add_earnest_amount: 'Additional Earnest Money Amount ($)',
  add_earnest_date: 'Additional Earnest Money Due Date',
  add_earnest_form_other: 'Additional Earnest Money Form (other)',
  add_earnest_form_check_eft: 'Additional Earnest Money via EFT',
  add_earnest_deposited_with: 'Additional Earnest Money Deposited With',
  add_earnest_nonrefundable_check: 'Additional Earnest Money Non-Refundable',
  add_earnest_refundable_check: 'Additional Earnest Money Refundable',
  total_amount_financed: 'Total Amount Financed ($)',
  balance_purchase_price: 'Balance of Purchase Price ($)',
  buyer_broker_compensation: "Buyer's Broker Compensation ($)",
  seller_additional_costs: 'Seller Additional Costs ($)',
  costs_not_payable_buyer: 'Costs Not Payable by Buyer ($)',
  total_seller_expenses: 'Total Seller Expenses ($)',
  closing_date: 'Closing Date',
  possession_location: 'Possession Location',
  possession_time: 'Possession Time',
  possession_am_pm: 'AM / PM',
  cash_appraisal_days: 'Cash Sale Appraisal Deadline (days)',
  appraisal_notify_days: 'Appraisal Notification Deadline (days)',
  appraisal_negotiation_days: 'Appraisal Negotiation Period (days)',
  offer_expiration_date: 'Offer Expiration Date',
  offer_expiration_time: 'Offer Expiration Time',
  offer_expiration_hour: 'Offer Expiration Hour',
  sale_not_contingent_check: 'Sale is NOT contingent on sale of other property',
  sale_contingent_check: 'Sale IS contingent on sale of other property',
  cash_sale_verify_days: 'Cash Verification Deadline (days)',
  cash_sale_check: 'Cash Sale',
  financed_sale_check: 'Financed Sale',
  loan_change_days_before_closing: 'Loan Change Notice (days before closing)',
  primary_conventional_check: 'Primary Loan: Conventional',
  primary_fha_check: 'Primary Loan: FHA',
  primary_va_check: 'Primary Loan: VA',
  primary_usda_check: 'Primary Loan: USDA',
  primary_owner_financing_check: 'Primary Loan: Owner Financing',
  primary_other_check: 'Primary Loan: Other',
  primary_other_text: 'Primary Loan: Other (describe)',
  primary_rate_fixed_check: 'Primary Rate: Fixed',
  primary_rate_adjustable_check: 'Primary Rate: Adjustable',
  primary_rate_interest_only_check: 'Primary Rate: Interest Only',
  primary_rate_other_check: 'Primary Rate: Other',
  primary_rate_other_text: 'Primary Rate: Other (describe)',
  primary_amortization_years: 'Primary Loan Amortization (years)',
  primary_ltv: 'Primary LTV (%)',
  primary_loan_rate_pct: 'Primary Loan Rate (%)',
  secondary_conventional_check: 'Secondary Loan: Conventional',
  secondary_fha_check: 'Secondary Loan: FHA',
  secondary_va_check: 'Secondary Loan: VA',
  secondary_usda_check: 'Secondary Loan: USDA',
  secondary_owner_financing_check: 'Secondary Loan: Owner Financing',
  secondary_other_check: 'Secondary Loan: Other',
  secondary_rate_fixed_check: 'Secondary Rate: Fixed',
  secondary_rate_adjustable_check: 'Secondary Rate: Adjustable',
  secondary_rate_interest_only_check: 'Secondary Rate: Interest Only',
  secondary_rate_other_check: 'Secondary Rate: Other',
  secondary_amortization_years: 'Secondary Loan Amortization (years)',
  secondary_ltv: 'Secondary LTV (%)',
  secondary_loan_rate_pct: 'Secondary Loan Rate (%)',
  buyer_preapproved_check: 'Buyer is Pre-Approved',
  buyer_not_preapproved_check: 'Buyer is NOT Pre-Approved',
  lender_name: 'Lender Name',
  not_preapproved_days: 'Pre-Approval Deadline (days)',
  loan_approval_days: 'Loan Approval Deadline (days)',
  loan_approval_alt_days: 'Alternative Loan Approval Deadline (days)',
  lender_appraisal_amount: 'Lender Appraisal Amount ($)',
  survey_days: 'Survey Deadline (days)',
  inspection_period_days: 'Inspection Period (days)',
  renegotiation_period_days: 'Renegotiation Period (days)',
  additional_structures_1: 'Additional Structures / Improvements (1)',
  additional_structures_2: 'Additional Structures / Improvements (2)',
  additional_structures_3: 'Additional Structures / Improvements (3)',
  unacceptable_exclusions_1: 'Unacceptable Title Exceptions (1)',
  unacceptable_exclusions_2: 'Unacceptable Title Exceptions (2)',
  unacceptable_exclusions_3: 'Unacceptable Title Exceptions (3)',
  seller_agent_check: "Seller's Agent — Seller's Side",
  seller_agent_check_right: "Seller's Agent — Right Column",
  buyer_agent_check_left: "Buyer's Agent — Left Column",
  buyer_agent_check_right: "Buyer's Agent — Right Column",
  seller_designated_agent_check: 'Seller Designated Agent',
  buyer_designated_agent_check_right: 'Buyer Designated Agent',
  buyer_designated_check_left: 'Buyer Designated (left)',
  seller_designated_check_right: 'Seller Designated (right)',
  seller_transaction_broker_check: "Transaction Broker — Seller's Side",
  buyer_transaction_broker_check_right: "Transaction Broker — Buyer's Side",
  seller_disclosed_dual_check: "Disclosed Dual Agent — Seller's Side",
  buyer_disclosed_dual_check_right: "Disclosed Dual Agent — Buyer's Side",
  subagent_seller_check: "Subagent — Seller's Side",
  subagent_buyer_check_right: "Subagent — Buyer's Side",
  brokers_compensated_check: 'Both Brokers Compensated',
  lic_seller_date: 'Seller Licensee Date',
  lic_buyer_date: 'Buyer Licensee Date',
  lic_seller_sig: 'Seller Licensee Signature',
  lic_buyer_sig: 'Buyer Licensee Signature',
  buyer_brokerage_date_1: 'Buyer Brokerage Date 1',
  seller_brokerage_date_1: 'Seller Brokerage Date 1',
  buyer_brokerage_sig_1: 'Buyer Brokerage Signature 1',
  seller_brokerage_sig_1: 'Seller Brokerage Signature 1',
  buyer_brokerage_date_2: 'Buyer Brokerage Date 2',
  seller_brokerage_date_2: 'Seller Brokerage Date 2',
  buyer_brokerage_sig_2: 'Buyer Brokerage Signature 2',
  seller_brokerage_sig_2: 'Seller Brokerage Signature 2',
  seller_sig_1: 'Seller 1 Signature',
  seller_sig_2: 'Seller 2 Signature',
  buyer_sig_1: 'Buyer 1 Signature',
  buyer_sig_2: 'Buyer 2 Signature',
  seller_date_1: 'Seller 1 Signature Date',
  seller_date_2: 'Seller 2 Signature Date',
  buyer_date_1: 'Buyer 1 Signature Date',
  buyer_date_2: 'Buyer 2 Signature Date',
  brokerage_seller: "Seller's Brokerage Name",
  brokerage_buyer: "Buyer's Brokerage Name",
  brokerage_seller_address: "Seller's Brokerage Address",
  brokerage_buyer_address: "Buyer's Brokerage Address",
  lic_seller_name_print: 'Seller Licensee Name (printed)',
  lic_buyer_name_print: 'Buyer Licensee Name (printed)',
  lic_seller_contact: 'Seller Licensee Contact',
  brokerage_seller_contact: "Seller's Brokerage Contact",
  lic_buyer_contact: 'Buyer Licensee Contact',
  brokerage_buyer_contact: "Buyer's Brokerage Contact",
  lic_seller_email: 'Seller Licensee Email',
  lic_buyer_email: 'Buyer Licensee Email',
  licensee_preparing_sig: 'Licensee Preparing Contract Signature',
  rejection_presentation_date: 'Rejection / Presentation Date',
  rejection_licensee_sig: 'Rejection Licensee Signature',
}

const CHOICE_LABELS: Record<string, string> = {
  land_a: 'Encroachments, easements, rights-of-way, or boundary disputes',
  land_b: 'Fill, sub-surface anomalies, or soil problems',
  land_c: 'Hazardous materials on or near the property',
  land_d: 'Drainage or flooding issues',
  land_e: 'Mine shafts or underground storage tanks',
  land_f: 'Located in a flood plain or flood zone',
  land_g: 'Proposed road, utility, or projects affecting property',
  land_h: 'Deed restrictions, covenants, or conditions',
  land_i: 'Septic system or leach field on neighboring property',
  land_j: 'Property in or near a special use district',
  land_j_belongs: 'Special district affects value or use',
  land_k: 'Neighborhood issues (noise, odors, nuisances)',
  land_l: 'Zoning violations or non-conforming use',
  land_m: 'Known planned development nearby',
  roof_b: 'Current roof leaks or moisture damage',
  roof_c: 'Roof repairs made in last 5 years',
  roof_d: 'Roof ever been replaced',
  infest_a: 'Active wood-destroying insect infestation',
  infest_b: 'Prior wood-destroying insect infestation',
  infest_c: 'Evidence of previous infestation damage',
  infest_d: 'Pest control treatments in last 5 years',
  infest_e: 'Pest control warranty in effect',
  infest_e_stays: 'Pest warranty transfers to buyer',
  struct_a: 'Settling, movement, or structural defects',
  struct_b: 'Cracks in walls, floors, or ceilings',
  struct_c: 'Water intrusion or moisture in basement/crawl space',
  struct_d: 'Exterior drainage or water runoff issues',
  struct_e: 'Structural repairs or modifications',
  struct_f: 'Fireplace or wood-burning stove',
  struct_g: 'Fireplace inspected in last 5 years',
  struct_h: 'Pool, spa, or hot tub on property',
  struct_i: 'Sauna or steam room',
  struct_j: 'Elevator or lift',
  add_a: 'Additions or improvements to structure',
  add_b: 'Permits obtained for all work',
  plumb_b: 'Plumbing issues or leaks',
  plumb_c: 'Water softener on property',
  plumb_d: 'Water filtration / treatment system',
  plumb_h: 'Septic system issues or repairs needed',
  plumb_i: 'Gas service to property',
  plumb_k: 'Sprinkler / irrigation system',
  plumb_k_covers: 'Sprinkler system covers entire property',
  plumb_l: 'Plumbing defects or known problems',
  plumb_m: 'Sump pump',
  hvac_a: 'Air conditioning system',
  hvac_b: 'Heating system',
  hvac_c: 'HVAC malfunctions or issues in last 5 years',
  hvac_d: 'Water heater',
  hvac_e: 'Any known HVAC issues',
  elec_c: 'Known electrical deficiencies',
  haz_a: 'Asbestos or asbestos-containing materials',
  haz_b: 'Radon testing done',
  haz_c: 'Lead-based paint or hazards',
  haz_d: 'Underground storage tanks (other than propane)',
  haz_e: 'Mold or mildew issues',
  haz_f: 'Environmental contamination',
  haz_g: 'Chinese drywall',
  haz_h: 'Substances requiring government cleanup',
  haz_i: 'Property used for commercial purposes',
  haz_j: 'Carbon monoxide detectors present',
  haz_k: 'Smoke detectors present',
  tax_a_outside_city: 'Property is outside city limits',
  tax_a_bonds: 'Outstanding special assessment bonds',
  tax_b: 'Delinquent property taxes',
  tax_c: 'Pending special assessments',
  tax_d: 'Property subject to abatement or tax credits',
  tax_e: 'Agricultural tax status',
  tax_f: "Mechanic's or materialman's liens",
  tax_g: 'Pending litigation affecting property',
  tax_h: 'Property in a Community Improvement District (CID)',
  tax_i: 'Property in a Transportation Development District (TDD)',
  tax_j: 'Subject to a solar energy system lease',
  tax_k: 'Subject to HOA',
  tax_l: 'HOA special assessment pending',
  tax_m: 'Regular HOA dues',
  tax_n: 'Property subject to right of first refusal',
  inspect: 'Any inspections completed in last 2 years',
  other_a: 'Shared driveways, party walls, or common areas',
  other_b: 'Deed restrictions or CC&Rs',
  other_c: 'Current or threatened legal action',
  other_d: 'Governmental notices or violations',
  other_e: 'Property used as rental or investment',
  other_f: 'Tenant currently occupying property',
  other_g: 'Underground oil tank ever on property',
  other_h: 'Known disputes with neighbors',
  other_i: 'Electronic security system or smart locks',
  other_j: 'Property located in historic district',
  other_k: 'Property subject to conservation easement',
  other_l: 'Liens or encumbrances',
  other_m: 'Known death on property in last 3 years',
  other_n: 'Other material defects not disclosed above',
  other_o: 'Pet odor or damage',
  other_p: 'Property used for drug manufacturing',
  other_q: 'Foundation treated for wood-destroying insects',
  other_r: 'Flood, fire, or other damage in past 5 years',
  other_r_repairs: 'Repairs completed after damage',
  other_s: 'Additional voluntary disclosures',
  elec_sys: 'Electrical system in good working order',
}

function autoLabel(key: string): string {
  const label = key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
}

export function getFieldLabel(key: string): string {
  if (FIELD_LABEL_MAP[key]) return FIELD_LABEL_MAP[key]
  const baseKey = key.replace(/_(yes|no|na)$/, '')
  if (CHOICE_LABELS[baseKey]) return CHOICE_LABELS[baseKey]
  return autoLabel(key)
}

export function getChoiceLabel(baseKey: string): string {
  if (CHOICE_LABELS[baseKey]) return CHOICE_LABELS[baseKey]
  return autoLabel(baseKey)
}

interface FieldCoordLite {
  field_key: string
  field_type: string
}

export function groupFieldsForSection(sectionFields: FieldCoordLite[]): ChatField[] {
  const grouped: ChatField[] = []
  const seen = new Set<string>()

  for (const f of sectionFields) {
    const key = f.field_key
    if (f.field_type === 'initial' || f.field_type === 'signature') continue

    const choiceMatch = key.match(/^(.+)_(yes|no|na|stays|removable)$/)
    if (choiceMatch) {
      const baseKey = choiceMatch[1]
      if (!seen.has(baseKey)) {
        seen.add(baseKey)
        const variants = ['yes', 'no', 'na', 'stays', 'removable'].filter(v =>
          sectionFields.some(x => x.field_key === `${baseKey}_${v}`)
        )
        grouped.push({ key: baseKey, type: 'choice', label: getChoiceLabel(baseKey), choices: variants })
      }
      continue
    }

    if (!seen.has(key)) {
      seen.add(key)
      grouped.push({ key, type: f.field_type, label: getFieldLabel(key) })
    }
  }

  return grouped
}

export function expandChatUpdates(
  updates: Record<string, unknown>,
  allFields: FieldCoordLite[]
): Record<string, string> {
  const expanded: Record<string, string> = {}
  const fieldKeys = new Set(allFields.map(f => f.field_key))
  const variants = ['yes', 'no', 'na', 'stays', 'removable', 'partial', 'complete', 'owned', 'leased']

  for (const [key, value] of Object.entries(updates)) {
    if (fieldKeys.has(key)) {
      expanded[key] = String(value ?? '')
    } else {
      const matchingVariants = variants.filter(v => fieldKeys.has(`${key}_${v}`))
      if (matchingVariants.length > 0) {
        for (const v of matchingVariants) {
          expanded[`${key}_${v}`] = String(value) === v ? 'true' : ''
        }
      } else {
        expanded[key] = String(value ?? '')
      }
    }
  }
  return expanded
}

export function getFormValues(
  formData: Record<string, string>,
  chatFields: ChatField[]
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const f of chatFields) {
    if (f.type === 'choice' && f.choices) {
      for (const choice of f.choices) {
        if (formData[`${f.key}_${choice}`] === 'true') {
          values[f.key] = choice
          break
        }
      }
    } else if (formData[f.key] !== undefined && formData[f.key] !== '') {
      values[f.key] = formData[f.key]
    }
  }
  return values
}
