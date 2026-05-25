// lib/compliance/types.ts

export type ViewPage = 'upload' | 'library' | 'report';

export interface MissingField {
  fieldId: string;
  page: number;
  x: number;  // percentage of page width (0–100)
  y: number;  // percentage of page height (0–100), y=0 at top
  w: number;  // percentage of page width
  h: number;  // percentage of page height
  type: 'initial' | 'signature' | 'required' | 'blank' | 'warning' | 'text' | 'date' | 'number' | 'checkbox';
  severity?: 'error' | 'warning' | 'info';
  label?: string;  // short human-readable label for badge
}

export interface MissingFieldGroup {
  page: number;
  count: number;
  fields: MissingField[];
}

export interface ComplianceRule {
  id: string;
  form_slug: string;
  field_key: string;
  rule_type: 'required' | 'required_if' | 'not_blank_if' | 'date_format';
  condition?: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}
