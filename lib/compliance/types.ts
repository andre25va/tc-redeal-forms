export type FieldStatus = 'signed' | 'missing' | 'n/a';
export type FieldType = 'signature' | 'initial';
export type PartyRole = 'buyer' | 'seller' | 'agent' | 'broker';

export interface PartyField {
  fieldId: string;
  label: string;
  page: number;
  type: FieldType;
  status: FieldStatus;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Party {
  id: string;
  role: PartyRole;
  label: string;
  name: string;
  fields: PartyField[];
}

export interface MissingField {
  fieldId: string;
  label: string;
  partyLabel: string;
  party: string;
  page: number;
  type: FieldType;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FieldTrigger {
  id: string;
  fieldLabel: string;
  condition: string;
  requiresFormId: string;
  requiresFormName: string;
  note: string;
  enabled: boolean;
}

export interface FiredTrigger {
  triggerId: string;
  fieldLabel: string;
  requiresFormId: string;
  requiresFormName: string;
  presentInPackage: boolean;
}

export interface FormTemplate {
  id: string;
  formName: string;
  shortName: string;
  version: string;
  pages: number;
  requiredSignatures: number;
  requiredInitials: number;
  parties: PartyRole[];
  conditionalTriggers?: FieldTrigger[];
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
  formName: string;
  shortName: string;
  mlsId?: string;
  templateId?: string;
  passed: boolean;
  totalPages: number;
  parties: Party[];
  missingFields: MissingField[];
  firedTriggers?: FiredTrigger[];
}

export interface TransactionPackage {
  fileName: string;
  uploadedAt: string;
  mlsId?: string;
  contracts: Contract[];
}

export type ViewPage = 'upload' | 'report' | 'library';
