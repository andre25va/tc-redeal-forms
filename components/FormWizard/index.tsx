'use client'
import { useState, useCallback } from 'react'
import { FormSection, PdfField } from '@/types'
import ChoiceField from '@/components/fields/ChoiceField'
import FixtureStatusField from '@/components/fields/FixtureStatusField'
import SignatureField from '@/components/fields/SignatureField'
import Button from '@/components/ui/Button'
import { CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react'

interface FormWizardProps {
  sections: FormSection[]
  token: string
  initialData: Record<string, unknown>
  invitation: {
    seller_name?: string
    property_address?: string
    seller_email: string
  }
}

export default function FormWizard({ sections, token, initialData, invitation }: FormWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pdfUrl, setPdfUrl] = useState('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState('')

  const totalSteps = sections.length + 1 // +1 for review step
  const isReviewStep = currentStep === sections.length
  const currentSection = !isReviewStep ? sections[currentStep] : null
  const progress = Math.round((currentStep / totalSteps) * 100)

  const setFieldValue = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const autoSave = useCallback(async (data: Record<string, unknown>) => {
    try {
      setSaving(true)
      await fetch(`/api/forms/${token}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_data: data }),
      })
      setLastSaved(new Date())
    } catch {
      // Silent fail on auto-save
    } finally {
      setSaving(false)
    }
  }, [token])

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
        <div key={field.key} className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
          <textarea
            value={value}
            onChange={e => setFieldValue(field.key, e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        </div>
      )
    }

    return (
      <div key={field.key} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
        <input
          type={field.type === 'date' ? 'date' : 'text'}
          value={value}
          onChange={e => setFieldValue(field.key, e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          placeholder={field.type !== 'date' ? `Enter ${field.label.toLowerCase()}...` : undefined}
        />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Submitted!</h1>
          <p className="text-gray-600 mb-6">
            Your Seller Disclosure Addendum has been submitted successfully. Copies have been sent to all parties via email.
          </p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors"
            >
              Download Your PDF
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-bold text-gray-900">Seller Disclosure Addendum</h1>
              <p className="text-xs text-gray-500">{invitation.property_address || 'Property Form'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">
                {saving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Not saved yet'}
              </p>
              <p className="text-xs font-medium text-gray-600">Step {currentStep + 1} of {totalSteps}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-brand-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {!isReviewStep && currentSection && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">{currentSection.title}</h2>
              {currentSection.description && (
                <p className="text-sm text-gray-500 mt-1">{currentSection.description}</p>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {currentSection.fields.map(field => renderField(field))}
            </div>
          </div>
        )}

        {isReviewStep && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Review & Submit</h2>
              <p className="text-sm text-gray-500 mt-1">Please review your answers before submitting.</p>
            </div>
            {sections.map(section => {
              const filledFields = section.fields.filter(f => formData[f.key])
              if (filledFields.length === 0) return null
              return (
                <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
                  <h3 className="font-semibold text-gray-900 mb-3">{section.title}</h3>
                  <div className="space-y-2">
                    {filledFields.filter(f => f.type !== 'signature').map(field => (
                      <div key={field.key} className="flex text-sm">
                        <span className="text-gray-500 w-48 flex-shrink-0">{field.label}:</span>
                        <span className="text-gray-900 font-medium">
                          {String(formData[field.key] || '').slice(0, 80)}
                        </span>
                      </div>
                    ))}
                    {filledFields.filter(f => f.type === 'signature').map(field => (
                      <div key={field.key} className="flex text-sm items-center">
                        <span className="text-gray-500 w-48 flex-shrink-0">{field.label}:</span>
                        <span className="text-green-600 font-medium">✓ Signed</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700 text-sm">{error}</div>
            )}
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="secondary" onClick={goBack} disabled={currentStep === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {isReviewStep ? (
            <Button onClick={handleSubmit} loading={submitting} className="gap-2">
              Submit Form <CheckCircle className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={goNext} loading={saving}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
