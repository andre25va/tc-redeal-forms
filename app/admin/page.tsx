'use client'
import { useState, useEffect } from 'react'
import { FormInvitation, FormSubmission } from '@/types'
import Button from '@/components/ui/Button'
import { Plus, CheckCircle, Clock, AlertCircle, ExternalLink, Copy } from 'lucide-react'

type InvitationWithSubmissions = FormInvitation & {
  form_submissions?: Pick<FormSubmission, 'id' | 'submitted_at' | 'pdf_url' | 'last_saved_at'>[]
}

export default function AdminDashboard() {
  const [invitations, setInvitations] = useState<InvitationWithSubmissions[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)

  useEffect(() => {
    loadInvitations()
  }, [])

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
      submitted: {
        icon: <CheckCircle className="w-3 h-3" />,
        classes: 'bg-green-100 text-green-700',
        label: 'Submitted',
      },
      in_progress: {
        icon: <Clock className="w-3 h-3" />,
        classes: 'bg-yellow-100 text-yellow-700',
        label: 'In Progress',
      },
      pending: {
        icon: <AlertCircle className="w-3 h-3" />,
        classes: 'bg-gray-100 text-gray-600',
        label: 'Pending',
      },
    }
    const c = config[status] || config.pending
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.classes}`}>
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

  const submitted = invitations.filter(i => i.status === 'submitted').length
  const inProgress = invitations.filter(i => i.status === 'in_progress').length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">ReDeal Forms</h1>
            <p className="text-sm text-gray-500">Admin Dashboard · tc@myredeal.com</p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Invitation
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Sent', value: invitations.length, color: 'text-gray-900' },
            { label: 'In Progress', value: inProgress, color: 'text-yellow-600' },
            { label: 'Submitted', value: submitted, color: 'text-green-600' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Invitations Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Seller Disclosure Forms</h2>
            <button onClick={loadInvitations} className="text-sm text-brand-600 hover:text-brand-700">
              Refresh
            </button>
          </div>
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full mx-auto mb-3" />
              Loading...
            </div>
          ) : invitations.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 mb-4">No invitations sent yet.</p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" /> Send First Invitation
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left">Seller</th>
                    <th className="px-6 py-3 text-left">Property</th>
                    <th className="px-6 py-3 text-left">Realtor</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Sent</th>
                    <th className="px-6 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invitations.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{inv.seller_name || inv.seller_email}</p>
                          <p className="text-xs text-gray-400">{inv.seller_email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">
                        {inv.property_address || '—'}
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
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded relative"
                          >
                            <Copy className="w-4 h-4" />
                            {copyMsg === inv.token && (
                              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs bg-gray-800 text-white px-2 py-1 rounded whitespace-nowrap">
                                Copied!
                              </span>
                            )}
                          </button>
                          <a
                            href={`/forms/${inv.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View form"
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          {inv.form_submissions?.[0]?.pdf_url && (
                            <a
                              href={inv.form_submissions[0].pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Download PDF"
                              className="p-1.5 text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded text-xs font-bold"
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

      {showForm && <NewInvitationModal onClose={() => setShowForm(false)} onCreated={loadInvitations} />}
    </div>
  )
}

function NewInvitationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    seller_name: '',
    seller_email: '',
    property_address: '',
    realtor_name: '',
    realtor_email: '',
    broker_name: '',
    broker_email: '',
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-4">New Seller Disclosure Invitation</h2>

        {created ? (
          <div className="text-center py-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="font-medium text-gray-900 mb-2">Invitation Created!</p>
            <p className="text-sm text-gray-500 mb-4">Share this link with the seller:</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-mono text-brand-600 break-all">{created.formUrl}</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(created.formUrl)}
                className="flex-1"
              >
                Copy Link
              </Button>
              <Button onClick={onClose} className="flex-1">Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Seller Name</label>
                <input
                  className="input"
                  value={form.seller_name}
                  onChange={e => setForm(p => ({ ...p, seller_name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="label">Seller Email <span className="text-red-500">*</span></label>
                <input
                  className="input"
                  type="email"
                  required
                  value={form.seller_email}
                  onChange={e => setForm(p => ({ ...p, seller_email: e.target.value }))}
                  placeholder="seller@email.com"
                />
              </div>
            </div>
            <div>
              <label className="label">Property Address</label>
              <input
                className="input"
                value={form.property_address}
                onChange={e => setForm(p => ({ ...p, property_address: e.target.value }))}
                placeholder="123 Main St, City, TX 75000"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Realtor Name</label>
                <input
                  className="input"
                  value={form.realtor_name}
                  onChange={e => setForm(p => ({ ...p, realtor_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Realtor Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.realtor_email}
                  onChange={e => setForm(p => ({ ...p, realtor_email: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Broker Name</label>
                <input
                  className="input"
                  value={form.broker_name}
                  onChange={e => setForm(p => ({ ...p, broker_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Broker Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.broker_email}
                  onChange={e => setForm(p => ({ ...p, broker_email: e.target.value }))}
                />
              </div>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" loading={loading} className="flex-1">
                Create Invitation
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
