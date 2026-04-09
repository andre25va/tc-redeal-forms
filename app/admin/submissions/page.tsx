'use client'

import { useEffect, useState } from 'react'

interface Submission {
  id: string
  submitted_at: string | null
  pdf_url: string | null
  last_saved_at: string | null
}

interface Invitation {
  id: string
  token: string
  form_slug: string
  seller_name: string | null
  seller_email: string
  property_address: string | null
  realtor_name: string | null
  realtor_email: string | null
  status: 'pending' | 'in_progress' | 'submitted'
  created_at: string
  expires_at: string | null
  form_submissions: Submission[]
}

const FORM_LABELS: Record<string, string> = {
  'seller-disclosure': 'Seller Disclosure',
  'residential-sale-contract': 'Sale Contract',
  'exclusive-right-to-sell': 'Listing Agreement',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  submitted: 'bg-green-100 text-green-800',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  submitted: 'Submitted',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function SubmissionsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'submitted'>('all')
  const [search, setSearch] = useState('')
  const [resending, setResending] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/invitations')
      const data = await res.json()
      setInvitations(data.invitations || [])
    } catch {
      showToast('Failed to load submissions', false)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/forms/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  async function resendLink(inv: Invitation) {
    setResending(inv.token)
    try {
      const res = await fetch('/api/admin/resend-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inv.token,
          seller_email: inv.seller_email,
          seller_name: inv.seller_name,
          property_address: inv.property_address,
          form_slug: inv.form_slug,
        }),
      })
      if (!res.ok) throw new Error()
      showToast(`Link resent to ${inv.seller_email}`, true)
    } catch {
      showToast('Failed to resend link', false)
    }
    setResending(null)
  }

  const filtered = invitations.filter(inv => {
    if (filter !== 'all' && inv.status !== filter) return false
    const q = search.toLowerCase()
    if (!q) return true
    return (
      (inv.seller_name || '').toLowerCase().includes(q) ||
      inv.seller_email.toLowerCase().includes(q) ||
      (inv.property_address || '').toLowerCase().includes(q)
    )
  })

  const counts = {
    all: invitations.length,
    pending: invitations.filter(i => i.status === 'pending').length,
    in_progress: invitations.filter(i => i.status === 'in_progress').length,
    submitted: invitations.filter(i => i.status === 'submitted').length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Admin</a>
            <h1 className="text-xl font-bold text-gray-900">Submissions</h1>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats + Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {(['all', 'pending', 'in_progress', 'submitted'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === s
                  ? 'bg-sky-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s]} ({counts[s]})
            </button>
          ))}

          <div className="ml-auto">
            <input
              type="text"
              placeholder="Search name, email, address…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 w-64"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No submissions found</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Seller</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Form</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Property</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Activity</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(inv => {
                  const sub = inv.form_submissions?.[0]
                  const lastActivity = sub?.last_saved_at || sub?.submitted_at || inv.created_at
                  const formUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://tc-redeal-forms.vercel.app'}/forms/${inv.token}`

                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      {/* Seller */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{inv.seller_name || '—'}</div>
                        <div className="text-gray-400 text-xs">{inv.seller_email}</div>
                      </td>

                      {/* Form */}
                      <td className="px-4 py-3">
                        <span className="text-gray-700">{FORM_LABELS[inv.form_slug] || inv.form_slug}</span>
                      </td>

                      {/* Property */}
                      <td className="px-4 py-3">
                        <span className="text-gray-600">{inv.property_address || '—'}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[inv.status]}`}>
                          {STATUS_LABELS[inv.status]}
                        </span>
                      </td>

                      {/* Activity */}
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {timeAgo(lastActivity)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* Copy Link */}
                          <button
                            onClick={() => copyLink(inv.token)}
                            title="Copy form link"
                            className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                          >
                            {copied === inv.token ? (
                              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>

                          {/* Open Form */}
                          <a
                            href={formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open form"
                            className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>

                          {/* Resend Email */}
                          {inv.status !== 'submitted' && (
                            <button
                              onClick={() => resendLink(inv)}
                              disabled={resending === inv.token}
                              title="Resend link via email"
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors disabled:opacity-40"
                            >
                              {resending === inv.token ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          )}

                          {/* View PDF */}
                          {sub?.pdf_url && (
                            <a
                              href={sub.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View submitted PDF"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
