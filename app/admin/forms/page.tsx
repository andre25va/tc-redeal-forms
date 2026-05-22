'use client';
// /app/admin/forms/page.tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MLS_BOARDS } from '@/lib/formStandards';

interface FormTemplate {
  slug: string;
  name: string;
  pdf_template_path: string;
  page_count: number;
}

interface FormProfile {
  form_slug: string;
  mls_board: string | null;
  state: string | null;
  document_name: string | null;
  document_number: string | null;
  page_count: number | null;
  buyer_count: number;
  seller_count: number;
  initials_pages: number[];
  has_broker_fields: boolean;
  notes: string | null;
}

const defaultProfile = (slug: string): FormProfile => ({
  form_slug: slug,
  mls_board: null,
  state: null,
  document_name: null,
  document_number: null,
  page_count: null,
  buyer_count: 2,
  seller_count: 2,
  initials_pages: [],
  has_broker_fields: false,
  notes: null,
});

// ── Fill Form Modal ────────────────────────────────────────────────────────────
function FillFormModal({ form, onClose }: { form: FormTemplate; onClose: () => void }) {
  const [sellerName, setSellerName] = useState('');
  const [sellerEmail, setSellerEmail] = useState('tc@myredeal.com');
  const [address, setAddress] = useState('');
  const [mls, setMls] = useState('');
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_slug: form.slug,
        seller_name: sellerName,
        seller_email: sellerEmail,
        property_address: address,
        mls_number: mls,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.formUrl) setLink(data.formUrl);
    else alert(data.error || 'Failed to create invitation');
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Fill Form</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{form.name}</p>

        {link ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 font-medium">✅ Invitation created! Share this link:</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 break-all text-xs text-blue-600 font-mono">{link}</div>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(link)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700">Copy Link</button>
              <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200">Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seller Name</label>
              <input value={sellerName} onChange={e => setSellerName(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seller Email</label>
              <input type="email" value={sellerEmail} onChange={e => setSellerEmail(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="123 Main St, Kansas City, MO" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MLS # <span className="text-gray-400">(optional)</span></label>
              <input value={mls} onChange={e => setMls(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="2412345" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={loading} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {loading ? 'Creating…' : 'Create Link'}
              </button>
              <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Profile Modal ──────────────────────────────────────────────────────────────
function ProfileModal({ form, onClose }: { form: FormTemplate; onClose: () => void }) {
  const [profile, setProfile] = useState<FormProfile>(defaultProfile(form.slug));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [initialsInput, setInitialsInput] = useState('');

  useEffect(() => {
    fetch(`/api/admin/forms/${form.slug}/profile`)
      .then(r => r.json())
      .then(d => {
        if (d.profile) {
          setProfile(d.profile);
          setInitialsInput((d.profile.initials_pages || []).join(', '));
        } else {
          // Pre-fill page count from form template
          setProfile(p => ({ ...p, page_count: form.page_count, document_name: form.name }));
        }
        setLoading(false);
      });
  }, [form.slug, form.page_count, form.name]);

  function set(key: keyof FormProfile, val: unknown) {
    setProfile(p => ({ ...p, [key]: val }));
    setSaved(false);
  }

  function parseInitialsPages(raw: string): number[] {
    return raw.split(/[\s,]+/).map(Number).filter(n => !isNaN(n) && n > 0);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...profile, initials_pages: parseInitialsPages(initialsInput) };
    const res = await fetch(`/api/admin/forms/${form.slug}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (data.profile) { setSaved(true); setProfile(data.profile); }
    else alert(data.error || 'Save failed');
  }

  // Auto-fill state when MLS board changes
  function handleMlsChange(board: string) {
    set('mls_board', board);
    const mlsInfo = MLS_BOARDS[board];
    if (mlsInfo?.state) set('state', mlsInfo.state);
  }

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 text-gray-500">Loading profile…</div>
    </div>
  );

  const allPages = profile.page_count ? Array.from({ length: profile.page_count }, (_, i) => i + 1) : [];
  const parsedInitialsPages = parseInitialsPages(initialsInput);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Form Profile</h2>
            <p className="text-xs text-gray-500 mt-0.5">{form.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-5">
          {/* MLS + State */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">MLS Board</label>
              <select
                value={profile.mls_board ?? ''}
                onChange={e => handleMlsChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select —</option>
                {Object.entries(MLS_BOARDS).map(([k, v]) => (
                  <option key={k} value={k}>{k} — {v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">State</label>
              <select
                value={profile.state ?? ''}
                onChange={e => set('state', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select —</option>
                <option value="MO">Missouri (MO)</option>
                <option value="KS">Kansas (KS)</option>
                <option value="IL">Illinois (IL)</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Document info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Document Name</label>
              <input
                value={profile.document_name ?? ''}
                onChange={e => set('document_name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Contract for Purchase and Sale"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Doc # / Version</label>
              <input
                value={profile.document_number ?? ''}
                onChange={e => set('document_number', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1200 Rel. 12"
              />
            </div>
          </div>

          {/* Pages + Party counts */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Pages</label>
              <input
                type="number" min={1} max={50}
                value={profile.page_count ?? ''}
                onChange={e => set('page_count', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Buyers</label>
              <select
                value={profile.buyer_count}
                onChange={e => set('buyer_count', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Sellers</label>
              <select
                value={profile.seller_count}
                onChange={e => set('seller_count', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
          </div>

          {/* Initials pages */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Initials Pages
              <span className="text-gray-400 font-normal ml-1">(pages where all parties initial)</span>
            </label>
            {allPages.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-2">
                {allPages.map(p => {
                  const active = parsedInitialsPages.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        const current = parsedInitialsPages;
                        const next = active ? current.filter(x => x !== p) : [...current, p].sort((a, b) => a - b);
                        setInitialsInput(next.join(', '));
                        setSaved(false);
                      }}
                      className={`w-9 h-9 rounded-lg text-sm font-semibold border-2 transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-2">Enter page count above to see page buttons</p>
            )}
            <input
              value={initialsInput}
              onChange={e => { setInitialsInput(e.target.value); setSaved(false); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 1, 2, 3, 4, 5, 6"
            />
            <p className="text-xs text-gray-400 mt-1">
              {parsedInitialsPages.length > 0
                ? `→ Will generate ${parsedInitialsPages.length * (profile.buyer_count + profile.seller_count)} initials fields (${profile.buyer_count} buyer + ${profile.seller_count} seller × ${parsedInitialsPages.length} pages)`
                : 'Click page numbers above or type comma-separated page numbers'}
            </p>
          </div>

          {/* Broker fields toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('has_broker_fields', !profile.has_broker_fields)}
              className={`relative w-10 h-6 rounded-full transition-colors ${profile.has_broker_fields ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${profile.has_broker_fields ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-sm text-gray-700">Include broker/agent signature fields</span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Notes</label>
            <textarea
              value={profile.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Any special notes about this form…"
            />
          </div>

          {/* Standard fields preview */}
          <div className="bg-indigo-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-indigo-700 mb-1">📋 Standard fields that will be required in mapper:</p>
            <div className="text-xs text-indigo-600 space-y-0.5">
              <div>• {profile.buyer_count} buyer name field{profile.buyer_count > 1 ? 's' : ''} + {profile.seller_count} seller name field{profile.seller_count > 1 ? 's' : ''} + property address (page 1)</div>
              {parsedInitialsPages.length > 0 && (
                <div>• {profile.buyer_count + profile.seller_count} initials fields × {parsedInitialsPages.length} pages = {parsedInitialsPages.length * (profile.buyer_count + profile.seller_count)} total initials fields</div>
              )}
              {profile.page_count && (
                <div>• {profile.buyer_count} buyer signature{profile.buyer_count > 1 ? 's' : ''} + {profile.seller_count} seller signature{profile.seller_count > 1 ? 's' : ''} (page {profile.page_count})</div>
              )}
              {profile.has_broker_fields && <div>• 4 broker/agent fields</div>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Profile'}
            </button>
            <button type="button" onClick={onClose} className="px-4 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200">
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function FormsPage() {
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [profiles, setProfiles] = useState<Record<string, FormProfile>>({});
  const [fillForm, setFillForm] = useState<FormTemplate | null>(null);
  const [profileForm, setProfileForm] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/forms')
      .then(r => r.json())
      .then(async d => {
        const formList: FormTemplate[] = d.forms ?? [];
        setForms(formList);

        // Load all profiles in parallel
        const profileResults = await Promise.all(
          formList.map(f =>
            fetch(`/api/admin/forms/${f.slug}/profile`).then(r => r.json())
          )
        );
        const profileMap: Record<string, FormProfile> = {};
        formList.forEach((f, i) => {
          if (profileResults[i]?.profile) profileMap[f.slug] = profileResults[i].profile;
        });
        setProfiles(profileMap);
        setLoading(false);
      });
  }, []);

  function refreshProfile(slug: string) {
    fetch(`/api/admin/forms/${slug}/profile`)
      .then(r => r.json())
      .then(d => {
        if (d.profile) setProfiles(p => ({ ...p, [slug]: d.profile }));
      });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Forms Manager</h1>
            <p className="text-sm text-gray-500 mt-1">Manage PDF form templates, profiles, and field mappings</p>
          </div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Admin</Link>
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-20">Loading forms…</div>
        ) : (
          <div className="space-y-4">
            {forms.map(form => {
              const prof = profiles[form.slug];
              const hasProfile = !!prof;
              return (
                <div key={form.slug} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Form info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-semibold text-gray-900 truncate">{form.name}</h2>
                        {hasProfile && prof.mls_board && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{prof.mls_board}</span>
                        )}
                        {hasProfile && prof.state && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{prof.state}</span>
                        )}
                        {!hasProfile && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">⚠ No profile</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 font-mono">{form.slug}</p>

                      {/* Profile summary row */}
                      {hasProfile && (
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                          {prof.document_number && <span>📄 {prof.document_number}</span>}
                          {prof.page_count && <span>📃 {prof.page_count} pages</span>}
                          <span>👥 {prof.buyer_count} buyer{prof.buyer_count > 1 ? 's' : ''} / {prof.seller_count} seller{prof.seller_count > 1 ? 's' : ''}</span>
                          {prof.initials_pages.length > 0 && (
                            <span>✍️ Initials: pp. {prof.initials_pages.join(', ')}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        onClick={() => setProfileForm(form)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          hasProfile
                            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        }`}
                      >
                        {hasProfile ? '📋 Profile' : '📋 Add Profile'}
                      </button>
                      <Link
                        href={`/admin/forms/${form.slug}/mapper`}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-medium"
                      >
                        🗺 Mapper
                      </Link>
                      <Link
                        href={`/admin/forms/${form.slug}/compare`}
                        className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-medium"
                      >
                        ⚖ Compare
                      </Link>
                      <button
                        onClick={() => setFillForm(form)}
                        className="px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg text-xs font-medium"
                      >
                        ✉ Fill Form
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {fillForm && <FillFormModal form={fillForm} onClose={() => setFillForm(null)} />}
      {profileForm && (
        <ProfileModal
          form={profileForm}
          onClose={() => {
            refreshProfile(profileForm.slug);
            setProfileForm(null);
          }}
        />
      )}
    </div>
  );
}
