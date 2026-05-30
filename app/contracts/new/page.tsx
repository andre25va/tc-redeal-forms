'use client';
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ContractForm {
  id: string;
  form_number: number; // display order
  mls_board: string;
  state_code: string;
  form_name: string;
  form_slug: string;
  form_version: string;
  active: boolean;
}

type WizardData = Record<string, string | boolean>;

// Generate unique contract ID
function generateContractId(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.random().toString(36).substring(2,6).toUpperCase();
  return `CTR-${date}-${rand}`;
}

function ContractsNewInner() {
  const params = useSearchParams();
  const router = useRouter();

  // URL params from TC app
  const dealId   = params.get('dealId') ?? '';
  const address  = params.get('address') ?? '';
  const buyerPre = params.get('buyer') ?? '';
  const sellerPre= params.get('seller') ?? '';
  const closingPre = params.get('closing') ?? '';
  const preformSlug = params.get('form') ?? '';
  const stateParam  = params.get('state') ?? '';

  // Form selection state
  const [forms, setForms] = useState<ContractForm[]>([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedForm, setSelectedForm] = useState<ContractForm | null>(null);
  const [showPicker, setShowPicker] = useState(!preformSlug);

  // Wizard state
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    buyerName:          buyerPre,
    sellerName:         sellerPre,
    propertyAddress:    address,
    closingDate:        closingPre,
    purchasePrice:      '',
    earnestMoney:       '',
    earnestDueDate:     '',
    closingCity:        '',
    closingCosts:       'split',
    possessionDate:     '',
    possessionTime:     'closing',
    financeType:        'conventional',
    loanAmount:         '',
    loanTerm:           '30',
    interestRate:       '',
    financeContingency: true,
    financeContDays:    '21',
    appraisalContingency: true,
    appraisalContDays:  '14',
    inspectionDays:     '10',
    inspectionContingency: true,
    saleContingency:    false,
    saleContingencyAddress: '',
    saleContingencyDays: '',
    optionPeriod:       false,
    optionDays:         '10',
    optionFee:          '',
    homeWarranty:       false,
    homeWarrantyAmount: '',
    homeWarrantyPaidBy: 'seller',
    addendaHOA:         false,
    addendaLead:        false,
    addendaRadon:       false,
    addendaInspection:  false,
    addendaSeptic:      false,
    addendaMold:        false,
    additionalTerms:    '',
  });

  const [submitting, setSaving] = useState(false);
  const [savedId, setSavedId] = useState('');
  const [contractUid, setContractUid] = useState('');
  const [error, setError] = useState('');

  const isMO = (stateParam || '').toUpperCase() === 'MO' ||
    (data.propertyAddress as string)?.match(/,\s*MO\b/i) !== null;
  const isKS = !isMO;

  // Load all active forms
  useEffect(() => {
    (async () => {
      const { data: rows, error } = await supabase
        .from('contract_forms')
        .select('id, mls_board, state_code, form_name, form_slug, form_version, active')
        .eq('active', true)
        .order('created_at', { ascending: true });
      if (rows) {
        const numbered = rows.map((r, i) => ({ ...r, form_number: i + 1 }));
        setForms(numbered);
        if (preformSlug) {
          const match = numbered.find(f => f.form_slug === preformSlug);
          if (match) { setSelectedForm(match); setShowPicker(false); }
        }
      }
      setLoadingForms(false);
    })();
  }, [preformSlug]);

  const filteredForms = useMemo(() => {
    if (!search.trim()) return forms;
    const q = search.toLowerCase();
    return forms.filter(f =>
      f.form_name.toLowerCase().includes(q) ||
      f.mls_board.toLowerCase().includes(q) ||
      f.state_code.toLowerCase().includes(q) ||
      String(f.form_number).includes(q)
    );
  }, [forms, search]);

  function up(field: string, value: string | boolean) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  const totalSteps = 6;

  async function handleSave(isDraft: boolean) {
    setSaving(true); setError('');
    try {
      const uid = contractUid || generateContractId();
      if (!contractUid) setContractUid(uid);

      const payload = {
        deal_id: dealId || null,
        contract_form_id: selectedForm?.id,
        submitted_data: { ...data, contract_uid: uid },
        status: isDraft ? 'draft' : 'submitted',
        ...(savedId ? {} : { id: undefined }),
      };

      let result;
      if (savedId) {
        const { data: row, error: e } = await supabase
          .from('contract_submissions')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', savedId)
          .select('id')
          .single();
        if (e) throw e;
        result = row;
      } else {
        const { data: row, error: e } = await supabase
          .from('contract_submissions')
          .insert(payload)
          .select('id')
          .single();
        if (e) throw e;
        result = row;
        setSavedId(result.id);
      }

      if (!isDraft) setStep(7); // confirmation
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
    setSaving(false);
  }

  // ─── FORM PICKER ────────────────────────────────────────────────────────────
  if (showPicker) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-lg">
          <div className="card-body">
            <h1 className="card-title text-2xl mb-1">New Contract</h1>
            <p className="text-base-content/60 text-sm mb-4">
              Select the contract form for this transaction.
            </p>

            {/* Search */}
            <div className="form-control mb-3">
              <div className="input-group">
                <span className="bg-base-200 px-3 flex items-center">🔍</span>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Search by form name, board, or state..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {loadingForms ? (
              <div className="text-center py-8 text-base-content/50">Loading forms…</div>
            ) : filteredForms.length === 0 ? (
              <div className="text-center py-8 text-base-content/50">No forms match &quot;{search}&quot;</div>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                {filteredForms.map(f => (
                  <button
                    key={f.id}
                    className="btn btn-outline justify-start gap-3 text-left h-auto py-3 normal-case"
                    onClick={() => { setSelectedForm(f); setShowPicker(false); }}
                  >
                    <span className="badge badge-primary badge-sm font-mono min-w-[2.5rem]">
                      #{f.form_number}
                    </span>
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="font-semibold">{f.form_name}</span>
                      <span className="text-xs text-base-content/50">
                        {f.mls_board} · {f.state_code} · v{f.form_version}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {dealId && (
              <p className="text-xs text-base-content/40 mt-4">Deal ID: {dealId}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── CONFIRMATION ────────────────────────────────────────────────────────────
  if (step === 7) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md text-center">
          <div className="card-body gap-4">
            <div className="text-5xl">✅</div>
            <h2 className="text-2xl font-bold">Contract Submitted</h2>
            <div className="badge badge-primary badge-lg font-mono text-base px-4 py-3">
              {contractUid}
            </div>
            <p className="text-base-content/60 text-sm">
              Your contract ID above is the permanent reference for this submission.
              The TC app will update the deal&apos;s contract status automatically.
            </p>
            <div className="bg-base-200 rounded-lg p-4 text-left text-sm space-y-1">
              <div><span className="font-semibold">Form:</span> {selectedForm?.form_name}</div>
              <div><span className="font-semibold">Property:</span> {data.propertyAddress as string}</div>
              <div><span className="font-semibold">Buyer:</span> {data.buyerName as string}</div>
              <div><span className="font-semibold">Seller:</span> {data.sellerName as string}</div>
              <div><span className="font-semibold">Price:</span> ${(data.purchasePrice as string).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</div>
              <div><span className="font-semibold">Closing:</span> {data.closingDate as string}</div>
            </div>
            {dealId && (
              <button className="btn btn-primary" onClick={() => router.back()}>
                ← Back to Deal
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── WIZARD ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-200 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost btn-xs" onClick={() => setShowPicker(true)}>←</button>
              <h1 className="text-xl font-bold">{selectedForm?.form_name}</h1>
              <span className="badge badge-outline badge-sm font-mono">
                Form #{selectedForm?.form_number}
              </span>
            </div>
            {contractUid && (
              <span className="text-xs font-mono text-primary">{contractUid}</span>
            )}
            {address && <p className="text-sm text-base-content/60 mt-0.5">{address}</p>}
          </div>
          <div className="text-right text-sm text-base-content/50">
            Step {step} of {totalSteps}
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1 mb-6">
          {Array.from({length: totalSteps}, (_,i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-all ${
                i+1 < step ? 'bg-success' : i+1 === step ? 'bg-primary' : 'bg-base-300'
              }`}
            />
          ))}
        </div>

        {/* State Banner */}
        {isMO && (
          <div className="alert alert-info text-sm mb-4 py-2">
            <span>🏛️ <strong>Missouri:</strong> Dual agency allowed (written consent required). Option period is contractually defined.</span>
          </div>
        )}
        {isKS && (
          <div className="alert alert-warning text-sm mb-4 py-2">
            <span>🏛️ <strong>Kansas:</strong> Dual agency is NOT permitted. Seller disclosure &amp; radon disclosure required by law.</span>
          </div>
        )}

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body gap-5">

            {/* ── STEP 1: PARTIES ─────────────────────────────────────── */}
            {step === 1 && (
              <>
                <h2 className="text-lg font-bold">Step 1 — Parties &amp; Property</h2>
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Buyer Name(s)</span></label>
                  <input className="input input-bordered" value={data.buyerName as string}
                    onChange={e => up('buyerName', e.target.value)} placeholder="Full legal name(s)" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Seller Name(s)</span></label>
                  <input className="input input-bordered" value={data.sellerName as string}
                    onChange={e => up('sellerName', e.target.value)} placeholder="Full legal name(s)" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Property Address</span></label>
                  <input className="input input-bordered" value={data.propertyAddress as string}
                    onChange={e => up('propertyAddress', e.target.value)} placeholder="Full street address, City, State, ZIP" />
                </div>
              </>
            )}

            {/* ── STEP 2: PRICE & CLOSING ─────────────────────────────── */}
            {step === 2 && (
              <>
                <h2 className="text-lg font-bold">Step 2 — Price &amp; Closing</h2>
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Purchase Price ($)</span></label>
                  <input className="input input-bordered" type="number" value={data.purchasePrice as string}
                    onChange={e => up('purchasePrice', e.target.value)} placeholder="e.g. 350000" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label"><span className="label-text font-medium">Earnest Money ($)</span></label>
                    <input className="input input-bordered" type="number" value={data.earnestMoney as string}
                      onChange={e => up('earnestMoney', e.target.value)} placeholder="e.g. 5000" />
                  </div>
                  <div className="form-control">
                    <label className="label"><span className="label-text font-medium">Earnest Due Date</span></label>
                    <input className="input input-bordered" type="date" value={data.earnestDueDate as string}
                      onChange={e => up('earnestDueDate', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label"><span className="label-text font-medium">Closing Date</span></label>
                    <input className="input input-bordered" type="date" value={data.closingDate as string}
                      onChange={e => up('closingDate', e.target.value)} />
                  </div>
                  <div className="form-control">
                    <label className="label"><span className="label-text font-medium">Closing City</span></label>
                    <input className="input input-bordered" value={data.closingCity as string}
                      onChange={e => up('closingCity', e.target.value)} placeholder="City where closing occurs" />
                  </div>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Closing Costs</span></label>
                  <select className="select select-bordered" value={data.closingCosts as string}
                    onChange={e => up('closingCosts', e.target.value)}>
                    <option value="buyer">Buyer pays all</option>
                    <option value="seller">Seller pays all</option>
                    <option value="split">Split equally</option>
                    <option value="custom">Custom (add to terms)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label"><span className="label-text font-medium">Possession Date</span></label>
                    <input className="input input-bordered" type="date" value={data.possessionDate as string}
                      onChange={e => up('possessionDate', e.target.value)} />
                  </div>
                  <div className="form-control">
                    <label className="label"><span className="label-text font-medium">Possession Time</span></label>
                    <select className="select select-bordered" value={data.possessionTime as string}
                      onChange={e => up('possessionTime', e.target.value)}>
                      <option value="closing">At closing</option>
                      <option value="24hours">Within 24 hours</option>
                      <option value="48hours">Within 48 hours</option>
                      <option value="custom">Other (add to terms)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 3: FINANCING ───────────────────────────────────── */}
            {step === 3 && (
              <>
                <h2 className="text-lg font-bold">Step 3 — Financing</h2>
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Finance Type</span></label>
                  <select className="select select-bordered" value={data.financeType as string}
                    onChange={e => up('financeType', e.target.value)}>
                    <option value="conventional">Conventional</option>
                    <option value="fha">FHA</option>
                    <option value="va">VA</option>
                    <option value="usda">USDA</option>
                    <option value="cash">Cash</option>
                    <option value="seller_finance">Seller Finance</option>
                    <option value="assumption">Assumption</option>
                  </select>
                </div>
                {data.financeType !== 'cash' && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="form-control">
                        <label className="label"><span className="label-text font-medium">Loan Amount ($)</span></label>
                        <input className="input input-bordered" type="number" value={data.loanAmount as string}
                          onChange={e => up('loanAmount', e.target.value)} />
                      </div>
                      <div className="form-control">
                        <label className="label"><span className="label-text font-medium">Term (years)</span></label>
                        <select className="select select-bordered" value={data.loanTerm as string}
                          onChange={e => up('loanTerm', e.target.value)}>
                          <option value="10">10</option>
                          <option value="15">15</option>
                          <option value="20">20</option>
                          <option value="25">25</option>
                          <option value="30">30</option>
                        </select>
                      </div>
                      <div className="form-control">
                        <label className="label"><span className="label-text font-medium">Max Rate (%)</span></label>
                        <input className="input input-bordered" type="number" step="0.125" value={data.interestRate as string}
                          onChange={e => up('interestRate', e.target.value)} placeholder="e.g. 7.5" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-base-200 px-4 py-3">
                      <div>
                        <p className="font-medium">Finance Contingency</p>
                        <p className="text-xs text-base-content/50">Buyer must obtain loan approval within N days</p>
                      </div>
                      <input type="checkbox" className="toggle toggle-primary" checked={data.financeContingency as boolean}
                        onChange={e => up('financeContingency', e.target.checked)} />
                    </div>
                    {data.financeContingency && (
                      <div className="form-control">
                        <label className="label"><span className="label-text font-medium">Finance Contingency Days</span></label>
                        <input className="input input-bordered" type="number" value={data.financeContDays as string}
                          onChange={e => up('financeContDays', e.target.value)} />
                      </div>
                    )}
                    <div className="flex items-center justify-between rounded-lg bg-base-200 px-4 py-3">
                      <div>
                        <p className="font-medium">Appraisal Contingency</p>
                        <p className="text-xs text-base-content/50">Sale contingent on property appraising at or above price</p>
                      </div>
                      <input type="checkbox" className="toggle toggle-primary" checked={data.appraisalContingency as boolean}
                        onChange={e => up('appraisalContingency', e.target.checked)} />
                    </div>
                    {data.appraisalContingency && (
                      <div className="form-control">
                        <label className="label"><span className="label-text font-medium">Appraisal Days</span></label>
                        <input className="input input-bordered" type="number" value={data.appraisalContDays as string}
                          onChange={e => up('appraisalContDays', e.target.value)} />
                      </div>
                    )}
                  </>
                )}
                {/* Sale contingency */}
                <div className="flex items-center justify-between rounded-lg bg-base-200 px-4 py-3">
                  <div>
                    <p className="font-medium">Sale Contingency</p>
                    <p className="text-xs text-base-content/50">Purchase contingent on buyer selling another property</p>
                  </div>
                  <input type="checkbox" className="toggle toggle-warning" checked={data.saleContingency as boolean}
                    onChange={e => up('saleContingency', e.target.checked)} />
                </div>
                {data.saleContingency && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label"><span className="label-text font-medium">Property to Sell Address</span></label>
                      <input className="input input-bordered" value={data.saleContingencyAddress as string}
                        onChange={e => up('saleContingencyAddress', e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text font-medium">Days to Sell</span></label>
                      <input className="input input-bordered" type="number" value={data.saleContingencyDays as string}
                        onChange={e => up('saleContingencyDays', e.target.value)} />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── STEP 4: INSPECTION ──────────────────────────────────── */}
            {step === 4 && (
              <>
                <h2 className="text-lg font-bold">Step 4 — Inspection &amp; Option Period</h2>
                <div className="flex items-center justify-between rounded-lg bg-base-200 px-4 py-3">
                  <div>
                    <p className="font-medium">Inspection Contingency</p>
                    <p className="text-xs text-base-content/50">Buyer has right to inspect and request repairs</p>
                  </div>
                  <input type="checkbox" className="toggle toggle-primary" checked={data.inspectionContingency as boolean}
                    onChange={e => up('inspectionContingency', e.target.checked)} />
                </div>
                {data.inspectionContingency && (
                  <div className="form-control">
                    <label className="label"><span className="label-text font-medium">Inspection Period (days)</span></label>
                    <input className="input input-bordered" type="number" value={data.inspectionDays as string}
                      onChange={e => up('inspectionDays', e.target.value)} />
                  </div>
                )}

                {/* Option period — MO shows by default */}
                <div className="flex items-center justify-between rounded-lg bg-base-200 px-4 py-3">
                  <div>
                    <p className="font-medium">
                      Option Period
                      {isMO && <span className="badge badge-info badge-xs ml-2">MO — common</span>}
                    </p>
                    <p className="text-xs text-base-content/50">
                      Buyer pays option fee for unrestricted right to terminate
                    </p>
                  </div>
                  <input type="checkbox" className="toggle toggle-secondary" checked={data.optionPeriod as boolean}
                    onChange={e => up('optionPeriod', e.target.checked)} />
                </div>
                {data.optionPeriod && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label"><span className="label-text font-medium">Option Days</span></label>
                      <input className="input input-bordered" type="number" value={data.optionDays as string}
                        onChange={e => up('optionDays', e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text font-medium">Option Fee ($)</span></label>
                      <input className="input input-bordered" type="number" value={data.optionFee as string}
                        onChange={e => up('optionFee', e.target.value)} />
                    </div>
                  </div>
                )}

                {/* Home warranty */}
                <div className="flex items-center justify-between rounded-lg bg-base-200 px-4 py-3">
                  <div>
                    <p className="font-medium">Home Warranty</p>
                    <p className="text-xs text-base-content/50">Include a home warranty in the contract</p>
                  </div>
                  <input type="checkbox" className="toggle toggle-success" checked={data.homeWarranty as boolean}
                    onChange={e => up('homeWarranty', e.target.checked)} />
                </div>
                {data.homeWarranty && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label"><span className="label-text font-medium">Warranty Amount ($)</span></label>
                      <input className="input input-bordered" type="number" value={data.homeWarrantyAmount as string}
                        onChange={e => up('homeWarrantyAmount', e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text font-medium">Paid By</span></label>
                      <select className="select select-bordered" value={data.homeWarrantyPaidBy as string}
                        onChange={e => up('homeWarrantyPaidBy', e.target.value)}>
                        <option value="seller">Seller</option>
                        <option value="buyer">Buyer</option>
                        <option value="split">Split</option>
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── STEP 5: ADDENDA ─────────────────────────────────────── */}
            {step === 5 && (
              <>
                <h2 className="text-lg font-bold">Step 5 — Addenda &amp; Disclosures</h2>
                <p className="text-sm text-base-content/60">Select all addenda that apply to this transaction.</p>
                {[
                  { key: 'addendaHOA',        label: 'HOA / CIC Addendum',              desc: 'Homeowners association documents and disclosures' },
                  { key: 'addendaLead',        label: 'Lead-Based Paint Disclosure',      desc: 'Required for homes built before 1978' },
                  { key: 'addendaRadon',       label: 'Radon Disclosure',                 desc: isKS ? 'Required by Kansas law' : 'Recommended — MO does not require' },
                  { key: 'addendaInspection',  label: 'Inspection Addendum',              desc: 'Additional inspection terms and repair negotiation' },
                  { key: 'addendaSeptic',      label: 'Septic / Well Addendum',           desc: 'Property has private well or septic system' },
                  { key: 'addendaMold',        label: 'Mold Disclosure Addendum',         desc: 'Known mold history or remediation' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between rounded-lg bg-base-200 px-4 py-3">
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-base-content/50">{desc}</p>
                    </div>
                    <input type="checkbox" className="toggle toggle-primary" checked={data[key] as boolean}
                      onChange={e => up(key, e.target.checked)} />
                  </div>
                ))}
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Additional Terms / Special Conditions</span></label>
                  <textarea className="textarea textarea-bordered h-28" value={data.additionalTerms as string}
                    onChange={e => up('additionalTerms', e.target.value)}
                    placeholder="Any additional terms, conditions, or inclusions/exclusions..." />
                </div>
              </>
            )}

            {/* ── STEP 6: REVIEW ──────────────────────────────────────── */}
            {step === 6 && (
              <>
                <h2 className="text-lg font-bold">Step 6 — Review &amp; Submit</h2>
                {!contractUid && (
                  <div className="alert alert-info py-2 text-sm">
                    A unique contract ID will be assigned when you submit.
                  </div>
                )}
                {contractUid && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Contract ID:</span>
                    <span className="badge badge-primary font-mono">{contractUid}</span>
                  </div>
                )}
                <div className="bg-base-200 rounded-lg p-4 text-sm space-y-2">
                  <div className="font-semibold text-base border-b border-base-300 pb-2 mb-2">
                    {selectedForm?.form_name}
                    <span className="badge badge-outline badge-sm font-mono ml-2">Form #{selectedForm?.form_number}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-base-content/60">Buyer</span><span>{data.buyerName as string || '—'}</span>
                    <span className="text-base-content/60">Seller</span><span>{data.sellerName as string || '—'}</span>
                    <span className="text-base-content/60">Property</span><span className="col-span-1 truncate">{data.propertyAddress as string || '—'}</span>
                    <span className="text-base-content/60">Price</span><span>${(data.purchasePrice as string || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span>
                    <span className="text-base-content/60">Earnest</span><span>${(data.earnestMoney as string || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span>
                    <span className="text-base-content/60">Closing</span><span>{data.closingDate as string || '—'}</span>
                    <span className="text-base-content/60">Finance</span><span className="capitalize">{data.financeType as string}</span>
                    {data.financeType !== 'cash' && <><span className="text-base-content/60">Loan</span><span>${(data.loanAmount as string || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span></>}
                    <span className="text-base-content/60">Inspection</span><span>{data.inspectionContingency ? `${data.inspectionDays} days` : 'Waived'}</span>
                    <span className="text-base-content/60">Option Period</span><span>{data.optionPeriod ? `${data.optionDays} days / $${data.optionFee}` : 'None'}</span>
                  </div>
                  {(data.addendaHOA || data.addendaLead || data.addendaRadon || data.addendaInspection || data.addendaSeptic || data.addendaMold) && (
                    <div className="border-t border-base-300 pt-2 mt-2">
                      <span className="text-base-content/60">Addenda: </span>
                      {[
                        data.addendaHOA && 'HOA',
                        data.addendaLead && 'Lead Paint',
                        data.addendaRadon && 'Radon',
                        data.addendaInspection && 'Inspection',
                        data.addendaSeptic && 'Septic/Well',
                        data.addendaMold && 'Mold',
                      ].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                {error && <div className="alert alert-error text-sm py-2">{error}</div>}
                <div className="flex gap-3">
                  <button className="btn btn-outline flex-1" disabled={submitting}
                    onClick={() => handleSave(true)}>
                    {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Save Draft'}
                  </button>
                  <button className="btn btn-primary flex-1" disabled={submitting}
                    onClick={() => handleSave(false)}>
                    {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Submit Contract →'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>

        {/* Navigation */}
        {step < 6 && (
          <div className="flex justify-between mt-4">
            <button className="btn btn-ghost" onClick={() => step === 1 ? setShowPicker(true) : setStep(s => s-1)}>
              ← Back
            </button>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => handleSave(true)} disabled={submitting}>
                Save Draft
              </button>
              <button className="btn btn-primary" onClick={() => setStep(s => s+1)}>
                Next →
              </button>
            </div>
          </div>
        )}
        {step === 6 && (
          <div className="flex justify-start mt-4">
            <button className="btn btn-ghost" onClick={() => setStep(5)}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContractsNewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <ContractsNewInner />
    </Suspense>
  );
}
