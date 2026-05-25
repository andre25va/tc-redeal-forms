// lib/compliance/types.ts

export type ViewPage = 'upload' | 'library' | 'report';

/** Three-tier severity:
 *  error   = definite violation (missing required sig/initials, unsigned)
 *  warning = soft rule (optional blank, unusual value)
 *  review  = GPT uncertain — handwriting unclear, ambiguous checkbox, partial value
 */
export type Severity = 'error' | 'warning' | 'review';

export interface MissingField {
  fieldId: string;
  page: number;
  x: number;  // percentage of page width (0–100)
  y: number;  // percentage of page height (0–100), y=0 at top
  w: number;  // percentage of page width
  h: number;  // percentage of page height
  type: 'initial' | 'signature' | 'required' | 'blank' | 'warning' | 'text' | 'date' | 'number' | 'checkbox' | 'review';
  severity?: Severity;
  label?: string;  // short human-readable label for badge
}

export interface MissingFieldGroup {
  page: number;
  count: number;
  fields: MissingField[];
}

export type PartyRole = 'buyer' | 'seller' | 'agent' | 'broker';

export interface FieldTrigger {
  id: string;
  fieldLabel: string;
  condition: string;
  requiresFormId: string;
  requiresFormName: string;
  note: string;
  enabled: boolean;
}

export interface FormTemplate {
  id: string;
  formName: string;
  shortName?: string;
  version: string;
  pages: number;
  requiredSignatures: number;
  requiredInitials: number;
  parties: PartyRole[];
  conditionalTriggers?: FieldTrigger[];
  pdfUrl?: string;
}

export interface MlsBoard {
  id: string;
  name: string;
  fullName: string;
  state: string;
  region: string;
  forms: FormTemplate[];
}

export interface Contract {
  id: string;
  shortName: string;
  passed: boolean;
  missingFields: MissingField[];
}

export interface ComplianceRule {
  id: string;
  form_slug: string;
  field_key: string;
  rule_type: 'required' | 'required_if' | 'not_blank_if' | 'date_format';
  condition?: string;
  message: string;
  severity: Severity;
}
