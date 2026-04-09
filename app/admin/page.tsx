'use client'
import { useState, useEffect } from 'react'
import { FormInvitation, FormSubmission } from '@/types'
import { Plus, CheckCircle, Clock, AlertCircle, ExternalLink, Copy, MapPin, Eye, ShieldCheck, FileText, ChevronDown } from 'lucide-react'

type InvitationWithSubmissions = FormInvitation & {
  form_submissions?: Pick<FormSubmission, 'id' | 'submitted_at' | 'pdf_url' | 'last_saved_at'>[]
}

const FORM_OPTIONS = [
  { slug: 'seller-disclosure',        label: "Seller's Disclosure",        pages: 8  },
  { slug: 'residential-sale-contract', label: 'Residential Sale Contract', pages: 16 },
  { slug: 'exclusive-right-to-sell',  label: 'Exclusive Right to Sell',    pages: 8  },
]

const FORM_LABELS: Record<string, string> = Object.fromEntries(
  FORM_OPTIONS.map(f => [f.slug, f.label])
)

export default function AdminDashboard() {
  const [invitations, setInvitations] = useState<InvitationWithSubmissions[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const [filterSlug, setFilterSlug] = useState<string>('all')

  useEffect(() => { loadInvitations() }, [])

  const loadInvitations = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/invitations')
      const data = await res.json()
      setInvitations(data.invitations || [])
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { icon: React.ReactNode; classes: string; label: string }> = {
      submitted:   { icon: <CheckCircle className="w-3 h-3" />,  classes: 'bg-green-100 text-green-700',  label: 'Submitted'   },
      in_progress: { icon: <Clock className="w-3 h-3" />,        classes: 'bg-yellow-100 text-yellow-700', label: 'In Progress' },
      pending:     { icon: <AlertCircle className="w-3 h-3" />,   classes: 'bg-gray-100 text-gray-600',    label: 'Pending'     },
    }
    const c = config[status] || config.pending
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${c.classes}`}>
        {c.icon}{c.label}
      </span>
    )
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/forms/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopyMsg(token)
      setTimeout(() => setCopyMsg(null), 2000)
    })
  }

  const filtered = filterSlug === 'all' ? invitations : invitations.filter(i => i.form_slug === filterSlug)
  const submitted   = invitations.filter(i => i.status === 'submitted').length
  const inProgress  = invitations.filter(i => i.status === 'in_progress').length

  return (
    <div className="min-h-screen bg-gray-50" style={{ colorScheme: 'light' }}>

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg font-bold">R</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">ReDeal Forms</h1>
              <p className="text-xs text-gray-400">tc@myredeal.com</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a href="/admin/forms" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <FileText className="w-4 h-4 text-indigo-500" /> Forms Manager
            </a>
            <a href="/admin/mapper" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <MapPin className="w-4 h-4 text-indigo-500" /> Legacy Mapper
            </a>
            <a href="/forms/demo" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <Eye className="w-4 h-4 text-indigo-500" /> Demo Form
            </a>
            <a href="/compliance" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Compliance
            </a>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-200 transition-all"
            >
              <Plus className="w-4 h-4" /> New Invitation
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Sent',   value: invitations.length, color: 'text-gray-900', bg: 'bg-gray-50',   icon: '📨' },
            { label: 'In Progress',  value: inProgress,         color: 'text-amber-600', bg: 'bg-amber-50', icon: '⏳' },
            { label: 'Submitted',    value: submitted,          color: 'text-green-600', bg: 'bg-green-50', icon: '✅' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center text-xl`}>{stat.icon}</div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                <p className={`text-3xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <h2 className="font-bold text-gray-900">Form Invitations</h2>
            <div className="flex items-center gap-3">
              {/* Filter by form type */}
              <div className="relative">
                <select
                  value={filterSlug}
                  onChange={e => setFilterSlug(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All forms</option>
                  {FORM_OPTIONS.map(f => (
                    <option key={f.slug} value={f.slug}>{f.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <button onClick={loadInvitations} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-16 text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm">Loading...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">📋</div>
              <p className="text-gray-500 text-sm mb-5">
                {filterSlug === 'all' ? 'No invitations sent yet.' : `No ${FORM_LABELS[filterSlug] || filterSlug} invitations yet.`}
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-200 transition-all"
              >
                <Plus className="w-4 h-4" /> Send First Invitation
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Seller</th>
                    <th className="px-6 py-3 text-left font-semibold">Property</th>
                    <th className="px-6 py-3 text-left font-semibold">Form</th>
                    <th className="px-6 py-3 text-left font-semibold">Realtor</th>
                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                    <th className="px-6 py-3 text-left font-semibold">Sent</th>
                    <th className="px-6 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900 text-sm">{inv.seller_name || inv.seller_email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{inv.seller_email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-[180px]">
                        <span className="truncate block">{inv.property_address || '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full whitespace-nowrap">
                          {FORM_LABELS[inv.form_slug] || inv.form_slug}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {inv.realtor_name || inv.realtor_email || '—'}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(inv.status)}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => copyLink(inv.token)}
                            title="Copy form link"
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg relative transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            {copyMsg === inv.token && (
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs bg-gray-800 text-white px-2 py-1 rounded-lg whitespace-nowrap">
                                Copied!
                              </span>
                            )}
                          </button>
                          <a
                            href={`/forms/${inv.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open form"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          {inv.form_submissions?.[0]?.pdf_url && (
                            <a
                              href={inv.form_submissions[0].pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Download submitted PDF"
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-colors"
                            >
                              PDF
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showForm && (
        <NewInvitationModal
          onClose={() => setShowForm(false)}
          onCreated={loadInvitations}
        />
      )}
    </div>
  )
}

// ── New Invitation Modal ────────────────────────────────────────────────────

function NewInvitationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    form_slug: 'seller-disclosure',
    seller_name: '', seller_email: '', property_address: '',
    realtor_name: '', realtor_email: '', broker_name: '', broker_email: '',
  })
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<{ formUrl: string } | null>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCreated(data)
      onCreated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const Field = ({ label, required, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
        {...props}
      />
    </div>
  )

  const selectedForm = FORM_OPTIONS.find(f => f.slug === form.form_slug)

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-xl">📋</div>
          <div>
            <h2 className="text-base font-bold text-gray-900">New Form Invitation</h2>
            <p className="text-xs text-gray-400">Send a unique fill-out link to a client</p>
          </div>
        </div>

        {created ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">✅</div>
            <p className="font-bold text-gray-900 mb-1">Invitation Created!</p>
            <p className="text-sm text-gray-500 mb-1">Form: <span className="font-medium text-indigo-600">{selectedForm?.label}</span></p>
            <p className="text-sm text-gray-500 mb-4">Share this link with the client:</p>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-5">
              <p className="text-xs font-mono text-indigo-700 break-all">{created.formUrl}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(created.formUrl)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Copy Link
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {/* Form type selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Form Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                {FORM_OPTIONS.map(option => (
                  <label
                    key={option.slug}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      form.form_slug === option.slug
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="form_slug"
                      value={option.slug}
                      checked={form.form_slug === option.slug}
                      onChange={e => setForm(p => ({ ...p, form_slug: e.target.value }))}
                      className="accent-indigo-600"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{option.label}</p>
                      <p className="text-xs text-gray-400">{option.pages} pages</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Seller Name" value={form.seller_name} onChange={e => setForm(p => ({ ...p, seller_name: e.target.value }))} placeholder="John Doe" />
              <Field label="Seller Email" required type="email" value={form.seller_email} onChange={e => setForm(p => ({ ...p, seller_email: e.target.value }))} placeholder="seller@email.com" />
            </div>
            <Field label="Property Address" value={form.property_address} onChange={e => setForm(p => ({ ...p, property_address: e.target.value }))} placeholder="123 Main St, City, MO 64100" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Realtor Name" value={form.realtor_name} onChange={e => setForm(p => ({ ...p, realtor_name: e.target.value }))} />
              <Field label="Realtor Email" type="email" value={form.realtor_email} onChange={e => setForm(p => ({ ...p, realtor_email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Broker Name" value={form.broker_name} onChange={e => setForm(p => ({ ...p, broker_name: e.target.value }))} />
              <Field label="Broker Email" type="email" value={form.broker_email} onChange={e => setForm(p => ({ ...p, broker_email: e.target.value }))} />
            </div>
            {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl p-3">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-60 transition-all"
              >
                {loading ? 'Creating...' : 'Create & Copy Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
