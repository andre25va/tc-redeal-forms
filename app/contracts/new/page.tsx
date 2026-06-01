'use client';
import React, { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import {
  ChevronRight, ChevronLeft, CheckCircle2, Building2, DollarSign,
  Calendar, CreditCard, Search, FileText, Save, Send, Loader2, AlertCircle, Hash,
  UserPlus, Users, X
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ContactResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}
interface ContractForm {
  id: string;
  form_name: string;
  mls_board: string;
  state_code: string;
  form_slug: string;
  form_version: string;
}

interface ContractFormData {
  // Step 1 – Parties & Property
  seller_name_1: string;
  seller_name_2: string;
  buyer_name_1: string;
  buyer_name_2: string;
  bank_owned_check: boolean;
  manufactured_home_check: boolean;
  property_address: string;
  county: string;
  legal_description: string;
  state_code: 'KS' | 'MO' | '';
  mls_number: string;
  property_city: string;
  property_zip: string;

  // Step 2 – Purchase Price & Earnest
  purchase_price: string;
  earnest_money_amount: string;
  earnest_delivery_days: string;
  earnest_deposited_with: string;
  earnest_nonrefundable_check: boolean;
  add_earnest_amount: string;
  add_earnest_date: string;
  buyer_broker_compensation: string;
  seller_additional_costs: string;

  // Step 3 – Closing & Offer Terms
  closing_date: string;
  possession_time: string;
  possession_am_pm: 'AM' | 'PM' | '';
  possession_location: string;
  offer_expiration_date: string;
  offer_expiration_time: string;
  cash_appraisal_days: string;
  appraisal_notify_days: string;
  appraisal_negotiation_days: string;

  // Step 4 – Financing
  sale_not_contingent_check: boolean;
  sale_contingent_check: boolean;
  cash_sale_check: boolean;
  financed_sale_check: boolean;
  cash_sale_verify_days: string;
  primary_conventional_check: boolean;
  primary_fha_check: boolean;
  primary_va_check: boolean;
  primary_usda_check: boolean;
  primary_owner_financing_check: boolean;
  primary_other_check: boolean;
  primary_other_text: string;
  primary_rate_fixed_check: boolean;
  primary_rate_adjustable_check: boolean;
  primary_amortization_years: string;
  primary_ltv: string;
  primary_loan_rate_pct: string;
  buyer_preapproved_check: boolean;
  buyer_not_preapproved_check: boolean;
  lender_name: string;
  not_preapproved_days: string;
  loan_approval_days: string;
  lender_appraisal_amount: string;

  // Step 5 – Inspection, Survey & Warranty
  inspection_period_days: string;
  renegotiation_period_days: string;
  survey_days: string;
  warranty_waive_check: boolean;
  limited_home_warranty: boolean;
  warranty_seller_check: boolean;
  warranty_buyer_check: boolean;
  warranty_cost: string;
  warranty_vendor: string;
  warranty_deductible: string;

  // Step 6 – Addenda & Additional Terms
  addendum_sellers_disc_check: boolean;
  addendum_lead_check: boolean;
  addendum_contingency_check: boolean;
  addendum_other_1: string;
  addendum_other_2: string;
  addendum_other_3: string;
  additional_inclusions_1: string;
  additional_inclusions_2: string;
  exclusions_1: string;
  additional_terms_1: string;
  additional_terms_2: string;
}

// ─── Step Config ──────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Parties & Property', icon: Building2 },
  { id: 2, label: 'Price & Earnest', icon: DollarSign },
  { id: 3, label: 'Closing & Terms', icon: Calendar },
  { id: 4, label: 'Financing', icon: CreditCard },
  { id: 5, label: 'Inspection & Warranty', icon: Search },
  { id: 6, label: 'Addenda & Review', icon: FileText },
];

// ─── Contract UID generator ────────────────────────────────────────────────────
function generateContractUID(): string {
  const now = new Date();
  const datePart = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `CTR-${datePart}-${rand}`;
}

// ─── Shared field components ───────────────────────────────────────────────
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
function Input({ reg, placeholder, type = 'text' }: { reg: any; placeholder?: string; type?: string }) {
  return (
    <input
      {...reg}
      type={type}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
    />
  );
}
function CheckRow({ reg, label }: { reg: any; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input {...reg} type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
function RadioGroup({ name, options, value, onChange }: {
  name: string; options: { val: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(o => (
        <label key={o.val} className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={name}
            checked={value === o.val}
            onChange={() => onChange(o.val)}
            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">{o.label}</span>
        </label>
      ))}
    </div>
  );
}


interface MlsResult {
  mlsNumber?: string | null;
  mlsBoardName?: string | null;
  listPrice?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqftLiving?: number | null;
  yearBuilt?: number | null;
  listingStatus?: string | null;
  propertyType?: string | null;
  listingAgentName?: string | null;
  listingOfficeName?: string | null;
}

// ─── Form Picker ──────────────────────────────────────────────────────────────
function FormPicker({ onSelect }: { onSelect: (f: ContractForm) => void }) {
  const [forms, setForms] = useState<ContractForm[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/contracts/forms')
      .then(r => r.json())
      .then(data => { setForms(data.forms || []); setLoading(false); })
      .catch(() => { setError('Could not load contract forms.'); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return forms;
    const q = search.toLowerCase();
    return forms.filter(f =>
      f.form_name.toLowerCase().includes(q) ||
      f.mls_board.toLowerCase().includes(q) ||
      f.state_code.toLowerCase().includes(q)
    );
  }, [forms, search]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-blue-500" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
      <AlertCircle size={14} /> {error}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Select Contract Form</h1>
        <p className="text-sm text-gray-500">Choose the contract form for this transaction.</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, board, or state..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Form list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No forms match your search.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((form, idx) => (
            <button
              key={form.id}
              onClick={() => onSelect(form)}
              className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all text-left group"
            >
              {/* Number badge */}
              <div className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center text-xs font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                #{idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{form.form_name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-gray-500">{form.mls_board}</span>
                  {form.state_code && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                      form.state_code === 'KS' ? 'bg-blue-100 text-blue-700' :
                      form.state_code === 'MO' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {form.state_code}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">v{form.form_version}</span>
                </div>
              </div>
              <ChevronRight size={16} className="flex-shrink-0 text-gray-300 group-hover:text-blue-500 mt-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 1: Parties & Property ───────────────────────────────────────────────

// ─── MaritalToggle ────────────────────────────────────────────────────────────
function MaritalToggle({ value, onChange }: { value: 'ASP' | 'AMP' | ''; onChange: (v: 'ASP' | 'AMP' | '') => void }) {
  return (
    <div className="flex gap-2 mt-1.5">
      {(['ASP', 'AMP'] as const).map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? '' : opt)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            value === opt
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400 hover:text-blue-600'
          }`}
        >
          {opt} <span className="font-normal opacity-80">({opt === 'ASP' ? 'single' : 'married'})</span>
        </button>
      ))}
    </div>
  );
}

function combineParty(name: string, marital: 'ASP' | 'AMP' | '') {
  if (!name.trim()) return name;
  if (!marital) return name;
  return `${name}, ${marital === 'ASP' ? 'a single person' : 'a married person'}`;
}

// ─── SellerField (plain text + marital toggle) ────────────────────────────────
function SellerField({ label, value = '', onChange, placeholder }: {
  label: string;
  value?: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  const [name, setName] = useState(() => {
    // strip known marital suffix on mount if pre-filled
    return value.replace(/, a (single|married) person$/, '').trim();
  });
  const [marital, setMarital] = useState<'ASP' | 'AMP' | ''>(() => {
    if (value.endsWith(', a single person')) return 'ASP';
    if (value.endsWith(', a married person')) return 'AMP';
    return '';
  });

  const update = (n: string, m: 'ASP' | 'AMP' | '') => {
    setName(n); setMarital(m);
    onChange(combineParty(n, m));
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input
        type="text"
        value={name}
        onChange={e => update(e.target.value, marital)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />
      <MaritalToggle value={marital} onChange={m => update(name, m)} />
    </div>
  );
}

// ─── BuyerField (combobox + marital toggle) ───────────────────────────────────
function BuyerField({ label, value = '', onChange, placeholder }: {
  label: string;
  value?: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState(() => value.replace(/, a (single|married) person$/, '').trim());
  const [marital, setMarital] = useState<'ASP' | 'AMP' | ''>(() => {
    if (value.endsWith(', a single person')) return 'ASP';
    if (value.endsWith(', a married person')) return 'AMP';
    return '';
  });
  const [results, setResults] = useState<ContactResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBuyer, setNewBuyer] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapRef = useRef<HTMLDivElement>(null);

  // sync external value changes (e.g. URL param pre-fill) — name only
  useEffect(() => {
    if (value && !query) {
      const namePart = value.replace(/, a (single|married) person$/, '').trim();
      setQuery(namePart);
    }
  }, [value]);

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.contacts || []);
        setOpen(true);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 300);
  }, [query]);

  const handleSelect = (c: ContactResult) => {
    const name = `${c.first_name} ${c.last_name}`;
    setQuery(name); onChange(combineParty(name, marital)); setOpen(false); setResults([]);
  };

  const openAddForm = () => {
    const parts = query.trim().split(' ');
    setNewBuyer({ first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '', email: '', phone: '' });
    setOpen(false); setShowAddForm(true);
  };

  const handleSaveBuyer = async () => {
    if (!newBuyer.first_name || !newBuyer.last_name) return;
    setSaving(true);
    try {
      const res = await fetch('/api/contacts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newBuyer, contact_type: 'client' }),
      });
      if (res.ok) {
        const name = `${newBuyer.first_name} ${newBuyer.last_name}`;
        setQuery(name); onChange(combineParty(name, marital)); setShowAddForm(false);
      }
    } catch { } finally { setSaving(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(combineParty(e.target.value, marital)); }}
          onFocus={() => { if (query.length >= 2 && results.length > 0) setOpen(true); }}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
        />
        {searching && <Loader2 className="absolute right-2.5 top-2.5 animate-spin text-gray-400" size={14} />}
      </div>
      <MaritalToggle value={marital} onChange={m => { setMarital(m); onChange(combineParty(query, m)); }} />

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {results.map(c => (
            <button key={c.id} type="button" onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center gap-2 border-b border-gray-50 last:border-0">
              <Users size={12} className="text-gray-400 shrink-0" />
              <span className="font-medium">{c.first_name} {c.last_name}</span>
              {c.email && <span className="text-gray-400 text-xs truncate">{c.email}</span>}
            </button>
          ))}
          {query.length >= 2 && (
            <button type="button" onClick={openAddForm}
              className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm text-green-700 font-medium flex items-center gap-2 border-t border-gray-100">
              <UserPlus size={12} /> Add &quot;{query}&quot; as new buyer
            </button>
          )}
        </div>
      )}

      {showAddForm && (
        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600">New buyer → saved to TC Contacts</p>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={newBuyer.first_name} onChange={e => setNewBuyer(p => ({...p, first_name: e.target.value}))} placeholder="First name *" className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <input value={newBuyer.last_name} onChange={e => setNewBuyer(p => ({...p, last_name: e.target.value}))} placeholder="Last name *" className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <input value={newBuyer.email} onChange={e => setNewBuyer(p => ({...p, email: e.target.value}))} placeholder="Email (optional)" className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <input value={newBuyer.phone} onChange={e => setNewBuyer(p => ({...p, phone: e.target.value}))} placeholder="Phone (optional)" className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleSaveBuyer} disabled={saving || !newBuyer.first_name || !newBuyer.last_name}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />}
              {saving ? 'Saving…' : 'Save & Add to Contract'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Step1({ register, watch, setValue, stateCode, onFetchMls, onFetchMlsByNumber, mlsFetching, mlsFetchStatus, mlsData, onFetchLegalDesc, legalFetching, legalError }: {
  register: UseFormRegister<ContractFormData>;
  watch: UseFormWatch<ContractFormData>;
  setValue: UseFormSetValue<ContractFormData>;
  stateCode: string;
  onFetchMls: () => void;
  onFetchMlsByNumber: () => void;
  mlsFetching: boolean;
  mlsFetchStatus: '' | 'found' | 'not_found';
  mlsData: MlsResult | null;
  onFetchLegalDesc: () => void;
  legalFetching: boolean;
  legalError: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="md:col-span-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">State</span>
          {stateCode && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stateCode === 'KS' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {stateCode === 'KS' ? 'Kansas' : 'Missouri'} Auto-Detected
            </span>
          )}
        </div>
        <RadioGroup
          name="state_code"
          options={[{ val: 'KS', label: 'Kansas' }, { val: 'MO', label: 'Missouri' }]}
          value={watch('state_code') || stateCode}
          onChange={v => setValue('state_code', v as 'KS' | 'MO')}
        />
        {watch('state_code') === 'MO' && (
          <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
            <AlertCircle size={11} /> Missouri: Option period applies. Dual agency allowed with written consent.
          </p>
        )}
        {watch('state_code') === 'KS' && (
          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
            <AlertCircle size={11} /> Kansas: No dual agency. Seller disclosure required by law. Radon disclosure required.
          </p>
        )}
      </div>

      <SellerField
        label="Seller 1 Name / Marital Status"
        value={watch('seller_name_1')}
        onChange={v => setValue('seller_name_1', v)}
        placeholder="e.g. John Smith"
      />
      <SellerField
        label="Seller 2 Name / Marital Status"
        value={watch('seller_name_2')}
        onChange={v => setValue('seller_name_2', v)}
        placeholder="(if applicable)"
      />
      <BuyerField
        label="Buyer 1 Name / Marital Status"
        value={watch('buyer_name_1')}
        onChange={v => setValue('buyer_name_1', v)}
        placeholder="e.g. Jane Doe, a single person"
      />
      <BuyerField
        label="Buyer 2 Name / Marital Status"
        value={watch('buyer_name_2')}
        onChange={v => setValue('buyer_name_2', v)}
        placeholder="(if applicable — search or add)"
      />

      <div className="md:col-span-2">
        <Field label="Property Address">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input reg={register('property_address')} placeholder="Full street address" />
            </div>
            <button
              type="button"
              onClick={onFetchMls}
              disabled={mlsFetching || !watch('property_address')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {mlsFetching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              {mlsFetching ? 'Fetching…' : 'Fetch MLS Info'}
            </button>
          </div>
        </Field>
        {mlsFetchStatus === 'found' && mlsData && (
          <div className="mt-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800 flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-green-700">✓ Property Found</span>
            {mlsData.mlsNumber && <span><span className="text-green-600 font-medium">MLS#:</span> {mlsData.mlsNumber}</span>}
            {mlsData.propertyType && <span>{mlsData.propertyType}</span>}
            {mlsData.bedrooms != null && <span>{mlsData.bedrooms} bed</span>}
            {mlsData.bathrooms != null && <span>{mlsData.bathrooms} bath</span>}
            {mlsData.sqftLiving != null && <span>{mlsData.sqftLiving.toLocaleString()} sqft</span>}
            {mlsData.listPrice && <span><span className="text-green-600 font-medium">List:</span> {mlsData.listPrice}</span>}
            {mlsData.listingStatus && <span className="font-medium">{mlsData.listingStatus}</span>}
          </div>
        )}
        {mlsFetchStatus === 'not_found' && (
          <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
            <AlertCircle size={11} /> Property not found — you can still continue manually.
          </p>
        )}
      </div>

      <Field label="City">
        <Input reg={register('property_city')} placeholder="City" />
      </Field>
      <Field label="Zip Code">
        <Input reg={register('property_zip')} placeholder="Zip" />
      </Field>

      <div className="md:col-span-2">
        <Field label="MLS # (optional)">
          <div className="flex gap-2 items-center">
            <Input reg={register('mls_number')} placeholder="e.g. 2410567" />
            <button
              type="button"
              onClick={onFetchMlsByNumber}
              disabled={mlsFetching || !watch('mls_number')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {mlsFetching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              Fetch
            </button>
          </div>
        </Field>
      </div>

      <Field label="County">
        <Input reg={register('county')} placeholder="County name" />
      </Field>
      <div className="md:col-span-2">
        <Field label="Legal Description">
          <div className="flex gap-2 items-start">
            <textarea
              {...register('legal_description')}
              placeholder="e.g. Lot 14, Block 3, Timber Ridge Subdivision, City of Kansas City, Jackson County, Missouri"
              rows={3}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
            />
            <button
              type="button"
              onClick={onFetchLegalDesc}
              disabled={legalFetching || (!watch('mls_number') && !watch('property_address'))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap mt-0.5"
            >
              {legalFetching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              {legalFetching ? 'Fetching…' : 'Fetch Legal Desc'}
            </button>
          </div>
          {legalError && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={11} /> {legalError}
            </p>
          )}
        </Field>
      </div>

      <div className="md:col-span-2 flex gap-6">
        <CheckRow reg={register('bank_owned_check')} label="Bank-Owned / REO Property" />
        <CheckRow reg={register('manufactured_home_check')} label="Manufactured Home" />
      </div>
    </div>
  );
}

// ─── Step 2: Purchase Price & Earnest ─────────────────────────────────────────
function Step2({ register }: { register: UseFormRegister<ContractFormData> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Field label="Purchase Price ($)">
        <Input reg={register('purchase_price')} placeholder="0.00" type="text" />
      </Field>
      <div />
      <Field label="Earnest Money Amount ($)">
        <Input reg={register('earnest_money_amount')} placeholder="0.00" />
      </Field>
      <Field label="Earnest Money Delivery (days)">
        <Input reg={register('earnest_delivery_days')} placeholder="e.g. 3" />
      </Field>
      <Field label="Earnest Money Deposited With">
        <Input reg={register('earnest_deposited_with')} placeholder="Title company or escrow agent name" />
      </Field>
      <div className="flex items-end gap-4">
        <CheckRow reg={register('earnest_nonrefundable_check')} label="Earnest Money Non-Refundable" />
      </div>

      <div className="md:col-span-2 border-t pt-4 mt-1">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Additional Earnest Money (optional)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Additional Earnest Amount ($)">
            <Input reg={register('add_earnest_amount')} placeholder="0.00" />
          </Field>
          <Field label="Additional Earnest Due Date">
            <Input reg={register('add_earnest_date')} type="date" />
          </Field>
        </div>
      </div>

      <div className="md:col-span-2 border-t pt-4 mt-1">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Cost Allocation</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Buyer's Broker Compensation ($)">
            <Input reg={register('buyer_broker_compensation')} placeholder="0.00" />
          </Field>
          <Field label="Seller Additional Costs ($)">
            <Input reg={register('seller_additional_costs')} placeholder="0.00" />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Closing & Offer Terms ────────────────────────────────────────────
function Step3({ register }: { register: UseFormRegister<ContractFormData> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Field label="Closing Date">
        <Input reg={register('closing_date')} type="date" />
      </Field>
      <Field label="Possession Time">
        <Input reg={register('possession_time')} placeholder="e.g. 5:00" />
      </Field>
      <Field label="AM / PM">
        <select
          {...register('possession_am_pm')}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Select</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </Field>
      <Field label="Possession Location">
        <Input reg={register('possession_location')} placeholder="e.g. At closing, At recording, etc." />
      </Field>

      <div className="md:col-span-2 border-t pt-4 mt-1">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Offer Expiration</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Offer Expiration Date">
            <Input reg={register('offer_expiration_date')} type="date" />
          </Field>
          <Field label="Offer Expiration Time">
            <Input reg={register('offer_expiration_time')} placeholder="e.g. 5:00 PM" />
          </Field>
        </div>
      </div>

      <div className="md:col-span-2 border-t pt-4 mt-1">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Appraisal Deadlines</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Cash Appraisal Deadline (days)">
            <Input reg={register('cash_appraisal_days')} placeholder="e.g. 14" />
          </Field>
          <Field label="Appraisal Notification (days)">
            <Input reg={register('appraisal_notify_days')} placeholder="e.g. 3" />
          </Field>
          <Field label="Appraisal Negotiation (days)">
            <Input reg={register('appraisal_negotiation_days')} placeholder="e.g. 5" />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Financing ────────────────────────────────────────────────────────
function Step4({ register, watch, setValue }: {
  register: UseFormRegister<ContractFormData>;
  watch: UseFormWatch<ContractFormData>;
  setValue: UseFormSetValue<ContractFormData>;
}) {
  const isCash = watch('cash_sale_check');
  const isFinanced = watch('financed_sale_check');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Sale Contingency</p>
        <div className="flex gap-6">
          <CheckRow reg={register('sale_not_contingent_check')} label="NOT contingent on sale of other property" />
          <CheckRow reg={register('sale_contingent_check')} label="IS contingent on sale of other property" />
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Sale Type</p>
        <div className="flex gap-6 mb-3">
          <CheckRow reg={register('cash_sale_check')} label="Cash Sale" />
          <CheckRow reg={register('financed_sale_check')} label="Financed Sale" />
        </div>
        {isCash && (
          <Field label="Cash Verification Deadline (days)">
            <Input reg={register('cash_sale_verify_days')} placeholder="e.g. 5" />
          </Field>
        )}
      </div>

      {isFinanced && (
        <>
          <div className="border-t pt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Primary Loan Type</p>
            <div className="flex flex-wrap gap-4">
              <CheckRow reg={register('primary_conventional_check')} label="Conventional" />
              <CheckRow reg={register('primary_fha_check')} label="FHA" />
              <CheckRow reg={register('primary_va_check')} label="VA" />
              <CheckRow reg={register('primary_usda_check')} label="USDA" />
              <CheckRow reg={register('primary_owner_financing_check')} label="Owner Financing" />
              <CheckRow reg={register('primary_other_check')} label="Other" />
            </div>
            {watch('primary_other_check') && (
              <div className="mt-3">
                <Field label="Other Loan Type (describe)">
                  <Input reg={register('primary_other_text')} placeholder="Describe loan type" />
                </Field>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Rate Type</p>
            <div className="flex gap-6 mb-3">
              <CheckRow reg={register('primary_rate_fixed_check')} label="Fixed" />
              <CheckRow reg={register('primary_rate_adjustable_check')} label="Adjustable" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-3">
              <Field label="Amortization (years)">
                <Input reg={register('primary_amortization_years')} placeholder="e.g. 30" />
              </Field>
              <Field label="LTV (%)">
                <Input reg={register('primary_ltv')} placeholder="e.g. 95" />
              </Field>
              <Field label="Loan Rate (%)">
                <Input reg={register('primary_loan_rate_pct')} placeholder="e.g. 7.25" />
              </Field>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Pre-Approval Status</p>
            <div className="flex gap-6 mb-3">
              <CheckRow reg={register('buyer_preapproved_check')} label="Buyer is Pre-Approved" />
              <CheckRow reg={register('buyer_not_preapproved_check')} label="Buyer is NOT Pre-Approved" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Lender Name">
                <Input reg={register('lender_name')} placeholder="Lender name" />
              </Field>
              <Field label="Loan Approval Deadline (days)">
                <Input reg={register('loan_approval_days')} placeholder="e.g. 21" />
              </Field>
              {watch('buyer_not_preapproved_check') && (
                <Field label="Pre-Approval Deadline (days)">
                  <Input reg={register('not_preapproved_days')} placeholder="e.g. 7" />
                </Field>
              )}
              <Field label="Lender Appraisal Amount ($)">
                <Input reg={register('lender_appraisal_amount')} placeholder="0.00" />
              </Field>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step 5: Inspection, Survey & Warranty ───────────────────────────────────
function Step5({ register, watch }: {
  register: UseFormRegister<ContractFormData>;
  watch: UseFormWatch<ContractFormData>;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Inspection & Survey</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Inspection Period (days)">
            <Input reg={register('inspection_period_days')} placeholder="e.g. 10" />
          </Field>
          <Field label="Renegotiation Period (days)">
            <Input reg={register('renegotiation_period_days')} placeholder="e.g. 5" />
          </Field>
          <Field label="Survey Deadline (days)">
            <Input reg={register('survey_days')} placeholder="e.g. 14" />
          </Field>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Home Warranty</p>
        <div className="flex gap-6 mb-4">
          <CheckRow reg={register('limited_home_warranty')} label="Include Home Warranty" />
          <CheckRow reg={register('warranty_waive_check')} label="Waive Home Warranty" />
        </div>
        {watch('limited_home_warranty') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex gap-6 items-center">
              <CheckRow reg={register('warranty_seller_check')} label="Paid by Seller" />
              <CheckRow reg={register('warranty_buyer_check')} label="Paid by Buyer" />
            </div>
            <div />
            <Field label="Warranty Cost ($)">
              <Input reg={register('warranty_cost')} placeholder="0.00" />
            </Field>
            <Field label="Deductible ($)">
              <Input reg={register('warranty_deductible')} placeholder="0.00" />
            </Field>
            <Field label="Warranty Vendor">
              <Input reg={register('warranty_vendor')} placeholder="Warranty company name" />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 6: Addenda & Review ─────────────────────────────────────────────────
function Step6({ register, watch, contractUID }: {
  register: UseFormRegister<ContractFormData>;
  watch: UseFormWatch<ContractFormData>;
  contractUID: string;
}) {
  const data = watch();
  return (
    <div className="flex flex-col gap-5">
      {/* Contract UID banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
        <Hash size={13} className="text-blue-500 flex-shrink-0" />
        <span className="text-xs text-blue-700">Contract ID: <strong className="font-mono">{contractUID}</strong></span>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Standard Addenda</p>
        <div className="flex flex-col gap-2">
          <CheckRow reg={register('addendum_sellers_disc_check')} label="Seller's Disclosure Addendum" />
          <CheckRow reg={register('addendum_lead_check')} label="Lead-Based Paint Addendum" />
          <CheckRow reg={register('addendum_contingency_check')} label="Sale Contingency Addendum" />
        </div>
      </div>
      <div className="border-t pt-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Other Addenda</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Other Addendum 1">
            <Input reg={register('addendum_other_1')} placeholder="Addendum name" />
          </Field>
          <Field label="Other Addendum 2">
            <Input reg={register('addendum_other_2')} placeholder="Addendum name" />
          </Field>
          <Field label="Other Addendum 3">
            <Input reg={register('addendum_other_3')} placeholder="Addendum name" />
          </Field>
        </div>
      </div>
      <div className="border-t pt-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Inclusions & Exclusions</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Additional Inclusions (1)">
            <Input reg={register('additional_inclusions_1')} placeholder="Items included in sale" />
          </Field>
          <Field label="Additional Inclusions (2)">
            <Input reg={register('additional_inclusions_2')} placeholder="Items included in sale" />
          </Field>
          <Field label="Exclusions (1)">
            <Input reg={register('exclusions_1')} placeholder="Items excluded from sale" />
          </Field>
        </div>
      </div>
      <div className="border-t pt-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Additional Terms</p>
        <div className="flex flex-col gap-3">
          <Input reg={register('additional_terms_1')} placeholder="Additional terms (line 1)" />
          <Input reg={register('additional_terms_2')} placeholder="Additional terms (line 2)" />
        </div>
      </div>
      <div className="border-t pt-4 bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Quick Review</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { label: 'Contract ID', value: contractUID },
            { label: 'Property', value: data.property_address || '—' },
            { label: 'Purchase Price', value: data.purchase_price ? `$${data.purchase_price}` : '—' },
            { label: 'Closing Date', value: data.closing_date || '—' },
            { label: 'Earnest Money', value: data.earnest_money_amount ? `$${data.earnest_money_amount}` : '—' },
            { label: 'Sale Type', value: data.cash_sale_check ? 'Cash' : data.financed_sale_check ? 'Financed' : '—' },
            { label: 'Inspection (days)', value: data.inspection_period_days || '—' },
            { label: 'State', value: data.state_code || '—' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-2">
              <p className="text-gray-400 mb-0.5">{item.label}</p>
              <p className="font-semibold text-gray-800 truncate">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
function ContractsWizardInner() {
  const searchParams = useSearchParams();

  const dealId = searchParams.get('dealId') || null;
  const formSlugParam = searchParams.get('form') || null;
  const stateParam = (searchParams.get('state') || '').toUpperCase();
  const addressParam = searchParams.get('propertyAddress') || '';
  const agentContactId = searchParams.get('agentContactId') || null;
  const agentName = searchParams.get('agentName') || null;
  const agentEmail = searchParams.get('agentEmail') || null;
  const agentPhone = searchParams.get('agentPhone') || null;
  const agentCompany = searchParams.get('agentCompany') || null;

  const autoState = stateParam === 'KS' || stateParam === 'MO'
    ? stateParam as 'KS' | 'MO'
    : addressParam.toUpperCase().includes(', KS') ? 'KS'
    : addressParam.toUpperCase().includes(', MO') ? 'MO'
    : '';

  // If form slug passed via URL, skip picker and go straight to wizard
  const [selectedForm, setSelectedForm] = useState<ContractForm | null>(
    formSlugParam ? { id: '', form_name: '', mls_board: '', state_code: '', form_slug: formSlugParam, form_version: '' } : null
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Contract UID — generated once on first save and reused
  const [contractUID, setContractUID] = useState<string>('');
  const [mlsFetching, setMlsFetching] = useState(false);
  const [mlsFetchStatus, setMlsFetchStatus] = useState<'' | 'found' | 'not_found'>('');
  const [mlsData, setMlsData] = useState<MlsResult | null>(null);
  const [legalFetching, setLegalFetching] = useState(false);
  const [legalError, setLegalError] = useState('');

  const handleFetchMls = async () => {
    const address = watch('property_address');
    const city = watch('property_city');
    const stateVal = (watch('state_code') || autoState) as string;
    const zip = watch('property_zip');
    if (!address) return;
    setMlsFetching(true);
    setMlsFetchStatus('');
    try {
      const res = await fetch('/api/mls/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, city, state: stateVal, zipCode: zip }),
      });
      const result = await res.json();
      if (result.found && result.data) {
        setMlsData(result.data);
        setMlsFetchStatus('found');
        if (result.data.mlsNumber) setValue('mls_number', result.data.mlsNumber);
        if (result.data.zipCode && !watch('property_zip')) setValue('property_zip', result.data.zipCode);
        if (result.data.county) setValue('county', result.data.county);
        if (result.data.legalDescription) setValue('legal_description', result.data.legalDescription);
      } else {
        setMlsFetchStatus('not_found');
      }
    } catch {
      setMlsFetchStatus('not_found');
    } finally {
      setMlsFetching(false);
    }
  };

  const handleFetchMlsByNumber = async () => {
    const mlsNum = watch('mls_number');
    if (!mlsNum) return;
    setMlsFetching(true);
    setMlsFetchStatus('');
    try {
      const res = await fetch('/api/mls/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mlsNumber: mlsNum, state: (watch('state_code') || autoState) as string }),
      });
      const result = await res.json();
      if (result.found && result.data) {
        setMlsData(result.data);
        setMlsFetchStatus('found');
        if (result.data.address && !watch('property_address')) setValue('property_address', result.data.address);
        if (result.data.city && !watch('property_city')) setValue('property_city', result.data.city);
        if (result.data.zipCode && !watch('property_zip')) setValue('property_zip', result.data.zipCode);
        if (result.data.county) setValue('county', result.data.county);
        if (result.data.legalDescription) setValue('legal_description', result.data.legalDescription);
      } else {
        setMlsFetchStatus('not_found');
      }
    } catch {
      setMlsFetchStatus('not_found');
    } finally {
      setMlsFetching(false);
    }
  };

  const handleFetchLegalDesc = async () => {
    const mlsNum = watch('mls_number');
    const address = watch('property_address');
    if (!mlsNum && !address) return;
    setLegalFetching(true);
    setLegalError('');
    try {
      const body = mlsNum
        ? { mlsNumber: mlsNum, state: (watch('state_code') || autoState) as string }
        : { address, city: watch('property_city'), state: (watch('state_code') || autoState) as string, zipCode: watch('property_zip') };
      const res = await fetch('/api/mls/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.found && result.data?.legalDescription) {
        setValue('legal_description', result.data.legalDescription);
      } else {
        setLegalError('Legal description not found — enter manually.');
      }
    } catch {
      setLegalError('Could not fetch legal description.');
    } finally {
      setLegalFetching(false);
    }
  };

  const { register, handleSubmit, watch, setValue, getValues } = useForm<ContractFormData>({
    defaultValues: {
      property_address: addressParam,
      buyer_name_1: searchParams.get('buyerName') || '',
      seller_name_1: searchParams.get('sellerName') || '',
      closing_date: searchParams.get('closingDate') || '',
      state_code: autoState as 'KS' | 'MO' | '',
      mls_number: '',
      property_city: '',
      property_zip: '',
    },
  });

  async function saveContract(status: 'draft' | 'submitted') {
    setSaving(true);
    setSaveError(null);
    const data = getValues();
    const uid = contractUID || generateContractUID();
    if (!contractUID) setContractUID(uid);
    try {
      const res = await fetch('/api/contracts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          agentContactId,
          formSlug: selectedForm?.form_slug || formSlugParam || 'heartland-residential-sale',
          status,
          contractUID: uid,
          submittedData: { ...data, contract_uid: uid },
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      const result = await res.json();
      setSavedId(result.id);
      if (status === 'submitted') setSubmitted(true);
    } catch (e: any) {
      setSaveError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Form picker screen ──
  if (!selectedForm) {
    return (
      <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'sans-serif' }}>
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <span className="text-sm font-bold text-gray-800">myredeal contracts</span>
        </div>
        <FormPicker onSelect={setSelectedForm} />
      </div>
    );
  }

  // ── Success screen ──
  if (submitted && savedId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: 'sans-serif' }}>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full mx-4 text-center">
          <CheckCircle2 size={40} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Contract Submitted</h2>
          <p className="text-sm text-gray-500 mb-4">Your contract has been saved successfully.</p>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
            <p className="text-xs text-gray-500 mb-1">Contract ID</p>
            <p className="text-base font-mono font-bold text-blue-700">{contractUID}</p>
          </div>
          <p className="text-xs text-gray-400">You may close this window and return to the TC app.</p>
        </div>
      </div>
    );
  }

  const canGoNext = currentStep < STEPS.length;
  const canGoPrev = currentStep > 1;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedForm(null)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            ← Change form
          </button>
          <span className="text-sm font-bold text-gray-800">{selectedForm.form_name || 'Heartland MLS — Residential Sale Contract'}</span>
          {autoState && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${autoState === 'KS' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {autoState}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {agentName && (
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
              {agentName}{agentCompany ? ` · ${agentCompany}` : ''}
            </span>
          )}
          {contractUID && (
            <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
              <Hash size={11} /> {contractUID}
            </span>
          )}
          {savedId && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 size={12} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Step progress */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isDone = step.id < currentStep;
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive ? 'bg-blue-600 text-white' :
                    isDone ? 'bg-green-50 text-green-700 hover:bg-green-100' :
                    'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {isDone ? <CheckCircle2 size={13} /> : <Icon size={13} />}
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.id}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-5">
              Step {currentStep}: {STEPS[currentStep - 1].label}
            </h2>

            {currentStep === 1 && (
              <Step1 register={register} watch={watch} setValue={setValue} stateCode={autoState} onFetchMls={handleFetchMls} onFetchMlsByNumber={handleFetchMlsByNumber} mlsFetching={mlsFetching} mlsFetchStatus={mlsFetchStatus} mlsData={mlsData} onFetchLegalDesc={handleFetchLegalDesc} legalFetching={legalFetching} legalError={legalError} />
            )}
            {currentStep === 2 && <Step2 register={register} />}
            {currentStep === 3 && <Step3 register={register} />}
            {currentStep === 4 && (
              <Step4 register={register} watch={watch} setValue={setValue} />
            )}
            {currentStep === 5 && (
              <Step5 register={register} watch={watch} />
            )}
            {currentStep === 6 && (
              <Step6 register={register} watch={watch} contractUID={contractUID || '(saved on submit)'} />
            )}
          </div>

          {/* Error banner */}
          {saveError && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} />
              {saveError}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(s => s - 1)}
              disabled={!canGoPrev}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => saveContract('draft')}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Draft
              </button>

              {canGoNext ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(s => s + 1)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => saveContract('submitted')}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Submit Contract
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FallbackLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">Loading contract wizard...</p>
      </div>
    </div>
  );
}

export default function ContractsNewPage() {
  return (
    <Suspense fallback={<FallbackLoader />}>
      <ContractsWizardInner />
    </Suspense>
  );
}
