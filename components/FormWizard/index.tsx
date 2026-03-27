'use client'
import { useState, useCallback } from 'react'
import { FormSection, PdfField } from '@/types'
import ChoiceField from '@/components/fields/ChoiceField'
import FixtureStatusField from '@/components/fields/FixtureStatusField'
import SignatureField from '@/components/fields/SignatureField'
import { CheckCircle, ChevronRight, ChevronLeft, Home, Clock } from 'lucide-react'

interface FormWizardProps {
  sections: FormSection[]
  token: string
  initialData: Record<string, unknown>
  invitation: {
    seller_name?: string
    property_address?: string
    seller_email: string
  }
  isDemo?: boolean
}

const SECTION_ICONS: Record<string, string> = {
  seller_property: '👤',
  occupancy: '🏠',
  construction: '🏗️',
  land: '🌍',
  roof: '🏚️',
  plumbing: '🚿',
  hvac: '❄️',
  electrical: '⚡',
  tax_hoa: '📋',
  utilities: '🔌',
  electronics: '📡',
  fixtures: '🔧',
  final: '📝',
  signatures: '✍️',
}

export default function FormWizard({ sections, token, initialData, invitation, isDemo }: FormWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pdfUrl, setPdfUrl] = useState('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState('')

  const totalSteps = sections.length + 1
  const isReviewStep = currentStep === sections.length
  const currentSection = !isReviewStep ? sections[currentStep] : null
  const progress = Math.round((currentStep / totalSteps) * 100)

  const setFieldValue = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const autoSave = useCallback(async (data: Record<string, unknown>) => {
    if (isDemo) return
    try {
      setSaving(true)
      await fetch(`/api/forms/${token}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_data: data }),
      })
      setLastSaved(new Date())
    } catch {
      // Silent fail
    } finally {
      setSaving(false)
    }
  }, [token, isDemo])

  const goNext = async () => {
    await autoSave(formData)
    setCurrentStep(s => Math.min(s + 1, totalSteps - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goBack = () => {
    setCurrentStep(s => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    if (isDemo) {
      setSubmitted(true)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/forms/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_data: formData }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setPdfUrl(data.pdfUrl || '')
      setSubmitted(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (field: PdfField) => {
    const value = (formData[field.key] as string) || ''

    if (field.type === 'fixture_status') {
      return (
        <FixtureStatusField
          key={field.key}
          label={field.label}
          value={value}
          onChange={v => setFieldValue(field.key, v)}
        />
      )
    }

    if (field.type === 'choice') {
      return (
        <ChoiceField
          key={field.key}
          label={field.label}
          value={value}
          onChange={v => setFieldValue(field.key, v)}
          choices={field.choices || []}
        />
      )
    }

    if (field.type === 'signature') {
      return (
        <SignatureField
          key={field.key}
          label={field.label}
          value={value}
          onChange={v => setFieldValue(field.key, v)}
        />
      )
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key} className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{field.label}</label>
          <textarea
            value={value}
            onChange={e => setFieldValue(field.key, e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-gray-50 placeholder-gray-400 transition"
            placeholder={`Enter details...`}
          />
        </div>
      )
    }

    return (
      <div key={field.key} className="mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">{field.label}</label>
        <input
          type={field.type === 'date' ? 'date' : 'text'}
          value={value}
          onChange={e => setFieldValue(field.key, e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 placeholder-gray-400 transition"
          placeholder={field.type !== 'date' ? `Enter ${field.label.toLowerCase()}...` : undefined}
        />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center border border-gray-100">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {isDemo ? 'Demo Complete!' : 'Form Submitted!'}
          </h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            {isDemo
              ? 'This was a preview of the Seller Disclosure form. In the real form, a filled PDF would be emailed to all parties.'
              : 'Your Seller Disclosure Addendum has been submitted. Copies have been emailed to all parties.'
            }
          </p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-7 rounded-xl transition-colors shadow-md shadow-indigo-200"
            >
              Download Your PDF
            </a>
          )}
          {isDemo && (
            <a href="/admin" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium mt-4">
              ← Back to Dashboard
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                <Home className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 text-sm leading-tight">Seller Disclosure Addendum</h1>
                <p className="text-xs text-gray-400 truncate max-w-[200px]">
                  {invitation.property_address || invitation.seller_name || 'Property Form'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end text-xs text-gray-400 mb-0.5">
                {saving ? (
                  <>
                    <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : lastSaved ? (
                  <>
                    <Clock className="w-3 h-3" />
                    Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </>
                ) : null}
              </div>
              <p className="text-xs font-semibold text-gray-600">
                Step {currentStep + 1} of {totalSteps}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Step dots */}
          <div className="flex gap-1 mt-2 justify-center overflow-x-auto py-0.5">
            {sections.map((s, i) => (
              <button
                key={s.id}
                onClick={() => i <= currentStep && setCurrentStep(i)}
                className={`h-1.5 rounded-full transition-all shrink-0 ${
                  i < currentStep
                    ? 'bg-indigo-400 w-4 cursor-pointer'
                    : i === currentStep
                    ? 'bg-indigo-600 w-6'
                    : 'bg-gray-200 w-1.5 cursor-default'
                }`}
                title={s.title}
              />
            ))}
            <div
              className={`h-1.5 rounded-full transition-all shrink-0 ${
                isReviewStep ? 'bg-indigo-600 w-6' : 'bg-gray-200 w-1.5'
              }`}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {!isReviewStep && currentSection && (
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl">{SECTION_ICONS[currentSection.id] || '📄'}</span>
                <h2 className="text-xl font-bold text-gray-900">{currentSection.title}</h2>
              </div>
              {currentSection.description && (
                <p className="text-sm text-gray-500 ml-10">{currentSection.description}</p>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              {currentSection.fields.map(field => renderField(field))}
            </div>
          </div>
        )}

        {isReviewStep && (
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl">✅</span>
                <h2 className="text-xl font-bold text-gray-900">Review & Submit</h2>
              </div>
              <p className="text-sm text-gray-500 ml-10">Please review your answers before submitting.</p>
            </div>

            <div className="space-y-3">
              {sections.map(section => {
                const filledFields = section.fields.filter(f => formData[f.key])
                if (filledFields.length === 0) return null
                return (
                  <div key={section.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                      <span className="text-base">{SECTION_ICONS[section.id] || '📄'}</span>
                      <h3 className="font-semibold text-gray-900 text-sm">{section.title}</h3>
                      <span className="ml-auto text-xs text-gray-400">
                        {filledFields.length} field{filledFields.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="p-5 space-y-2">
                      {filledFields.filter(f => f.type !== 'signature').map(field => (
                        <div key={field.key} className="flex text-sm gap-3">
                          <span className="text-gray-400 w-44 shrink-0 text-xs pt-0.5">{field.label}</span>
                          <span className="text-gray-900 font-medium text-xs">
                            {String(formData[field.key] || '').slice(0, 80)}
                          </span>
                        </div>
                      ))}
                      {filledFields.filter(f => f.type === 'signature').map(field => (
                        <div key={field.key} className="flex text-sm gap-3 items-center">
                          <span className="text-gray-400 w-44 shrink-0 text-xs">{field.label}</span>
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <CheckCircle className="w-3 h-3" /> Signed
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
            )}
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={goBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          {!isReviewStep && (
            <span className="text-xs text-gray-400">
              {currentSection?.title}
            </span>
          )}

          {isReviewStep ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> {isDemo ? 'Finish Preview' : 'Submit Form'}</>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={saving}
              className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-200 disabled:opacity-60 transition-all"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Next <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
