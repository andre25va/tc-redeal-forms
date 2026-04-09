'use client'
import { useState, useCallback, useRef } from 'react'
import { FormSection, PdfField } from '@/types'
import ChoiceField from '@/components/fields/ChoiceField'
import FixtureStatusField from '@/components/fields/FixtureStatusField'
import SignatureField from '@/components/fields/SignatureField'
import { CheckCircle, ChevronRight, ChevronLeft, Home, Clock, HelpCircle, X } from 'lucide-react'
import { Language, UI, SECTION_TITLES } from '@/lib/i18n/translations'

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
  initialLanguage?: Language
  onLanguageChange?: (lang: Language) => void
}

const SECTION_ICONS: Record<string, string> = {
  header:        '🏠',
  seller_property: '👤',
  occupancy:     '👤',
  construction:  '🏗️',
  land:          '🌍',
  roof:          '🏚️',
  infestation:   '🐛',
  structural:    '🧱',
  additions:     '🔨',
  plumbing:      '🚿',
  hvac:          '🌡️',
  electrical:    '⚡',
  hazardous:     '☢️',
  taxes_hoa:     '🏛️',
  tax_hoa:       '🏛️',
  inspections:   '🔍',
  other_matters: '📋',
  utilities:     '💡',
  electronics:   '📡',
  fixtures:      '🛋️',
  final:         '📝',
  signatures:    '✍️',
}

// ── Help Tooltip Component ────────────────────────────────────────────────────
function HelpTooltip({
  fieldLabel,
  sectionTitle,
  language,
  t,
}: {
  fieldLabel: string
  sectionTitle: string
  language: Language
  t: typeof UI['en']
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [error, setError] = useState(false)
  const cache = useRef<Record<string, string>>({})

  const toggle = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    const cacheKey = `${language}:${fieldLabel}`
    if (cache.current[cacheKey]) {
      setExplanation(cache.current[cacheKey])
      return
    }
    setLoading(true)
    setError(false)
    setExplanation('')
    try {
      const res = await fetch('/api/ai/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldLabel, sectionTitle, language }),
      })
      const data = await res.json()
      if (!res.ok || !data.explanation) throw new Error()
      cache.current[cacheKey] = data.explanation
      setExplanation(data.explanation)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        className="ml-1.5 text-indigo-400 hover:text-indigo-600 transition-colors align-middle"
        aria-label={t.helpButtonLabel}
        title={t.helpButtonLabel}
      >
        <HelpCircle className="w-3.5 h-3.5 inline" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-6 w-64 sm:w-72 bg-white border border-indigo-100 rounded-2xl shadow-xl p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
              {t.helpButtonLabel}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
              {t.helpLoading}
            </div>
          )}
          {error && !loading && (
            <p className="text-xs text-red-500">{t.helpError}</p>
          )}
          {explanation && !loading && (
            <p className="text-xs text-gray-700 leading-relaxed">{explanation}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Language Toggle ───────────────────────────────────────────────────────────
function LanguageToggle({
  language,
  onChange,
}: {
  language: Language
  onChange: (lang: Language) => void
}) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
      <button
        type="button"
        onClick={() => onChange('en')}
        className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
          language === 'en'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange('es')}
        className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
          language === 'es'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        ES
      </button>
    </div>
  )
}

// ── Checkmark SVG (matches PDF baked output) ──────────────────────────────────
function Checkmark() {
  return (
    <svg viewBox="0 0 10 10" className="absolute inset-0 w-full h-full" style={{ padding: '1px' }}>
      <polyline
        points="1.5,5.5 4,8 8.5,2"
        stroke="#111"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FormWizard({ sections, token, initialData, invitation, isDemo, initialLanguage, onLanguageChange }: FormWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pdfUrl, setPdfUrl] = useState('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const [language, setLanguageState] = useState<Language>(initialLanguage ?? 'en')
  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    onLanguageChange?.(lang)
  }

  const t = UI[language]

  const totalSteps = sections.length + 1
  const isReviewStep = currentStep === sections.length
  const currentSection = !isReviewStep ? sections[currentStep] : null
  const progress = Math.round((currentStep / totalSteps) * 100)

  const getSectionTitle = (id: string, fallback: string) => {
    const entry = SECTION_TITLES[id]
    if (!entry) return fallback
    return language === 'es' ? entry.es : entry.en
  }

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
    if (isDemo) { setSubmitted(true); return }
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

  // ── Field Label with help button ──────────────────────────────────────────
  const FieldLabel = ({ field }: { field: PdfField }) => {
    const sectionTitle = currentSection
      ? getSectionTitle(currentSection.id, currentSection.title)
      : ''
    const showHelp = !['checkbox', 'signature', 'fixture_status'].includes(field.type)
    return (
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {field.label}
        {showHelp && (
          <HelpTooltip
            fieldLabel={field.label}
            sectionTitle={sectionTitle}
            language={language}
            t={t}
          />
        )}
      </label>
    )
  }

  const renderField = (field: PdfField) => {
    const value = (formData[field.key] as string) ?? ''

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
        <div key={field.key} className="mb-4">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="block text-sm font-semibold text-gray-700">{field.label}</span>
            <HelpTooltip
              fieldLabel={field.label}
              sectionTitle={currentSection ? getSectionTitle(currentSection.id, currentSection.title) : ''}
              language={language}
              t={t}
            />
          </div>
          <ChoiceField
            label=""
            value={value}
            onChange={v => setFieldValue(field.key, v)}
            choices={field.choices || []}
          />
        </div>
      )
    }

    if (field.type === 'checkbox') {
      const checked = formData[field.key] === true || formData[field.key] === 'true'
      return (
        <div key={field.key} className="flex items-center gap-3 py-2">
          <button
            type="button"
            onClick={() => setFieldValue(field.key, !checked)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all relative ${
              checked
                ? 'bg-white border-gray-500'
                : 'bg-white border-gray-300 hover:border-gray-500'
            }`}
          >
            {checked && <Checkmark />}
          </button>
          <label
            onClick={() => setFieldValue(field.key, !checked)}
            className="text-sm text-gray-700 cursor-pointer select-none"
          >
            {field.label}
          </label>
        </div>
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
          <FieldLabel field={field} />
          <textarea
            value={value}
            onChange={e => setFieldValue(field.key, e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-gray-50 placeholder-gray-400 transition"
            placeholder={t.enterDetails}
          />
        </div>
      )
    }

    return (
      <div key={field.key} className="mb-5">
        <FieldLabel field={field} />
        <input
          type={field.type === 'date' ? 'date' : 'text'}
          value={value}
          onChange={e => setFieldValue(field.key, e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 placeholder-gray-400 transition"
          placeholder={field.type !== 'date' ? t.enter(field.label) : undefined}
        />
      </div>
    )
  }

  // ── Submitted Screen ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center border border-gray-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">
            {isDemo ? t.demoCompleteTitle : t.submittedTitle}
          </h1>
          <p className="text-gray-500 mb-6 leading-relaxed text-sm">
            {isDemo ? t.demoCompleteBody : t.submittedBody}
          </p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-md shadow-indigo-200"
            >
              {t.downloadPdf}
            </a>
          )}
          {isDemo && (
            <a href="/admin" className="block mt-4 text-indigo-600 hover:text-indigo-700 font-medium text-sm">
              {t.backToDashboard}
            </a>
          )}
        </div>
      </div>
    )
  }

  // ── Main Form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'max(80px, calc(80px + env(safe-area-inset-bottom)))' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                <Home className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-gray-900 text-xs leading-tight truncate">{t.formTitle}</h1>
                <p className="text-xs text-gray-400 truncate max-w-[140px] sm:max-w-[220px]">
                  {invitation.property_address || invitation.seller_name || t.propertyForm}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <LanguageToggle language={language} onChange={setLanguage} />
              <div className="text-right hidden sm:block">
                <div className="flex items-center gap-1 justify-end text-xs text-gray-400 mb-0.5">
                  {saving ? (
                    <>
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                      {t.saving}
                    </>
                  ) : lastSaved ? (
                    <>
                      <Clock className="w-3 h-3" />
                      {t.savedAt(lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
                    </>
                  ) : null}
                </div>
                <p className="text-xs font-semibold text-gray-600">
                  {t.stepOf(currentStep + 1, totalSteps)}
                </p>
              </div>
              <p className="text-xs font-semibold text-gray-600 sm:hidden">
                {currentStep + 1}/{totalSteps}
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
          <div className="flex gap-1 mt-2 justify-center overflow-x-auto py-0.5" style={{ scrollbarWidth: 'none' }}>
            {sections.map((s, i) => (
              <button
                key={s.id}
                onClick={() => i <= currentStep && setCurrentStep(i)}
                className={`h-1.5 rounded-full transition-all shrink-0 ${
                  i < currentStep
                    ? 'bg-indigo-400 w-3 cursor-pointer'
                    : i === currentStep
                    ? 'bg-indigo-600 w-5'
                    : 'bg-gray-200 w-1.5 cursor-default'
                }`}
                title={getSectionTitle(s.id, s.title)}
              />
            ))}
            <div
              className={`h-1.5 rounded-full transition-all shrink-0 ${
                isReviewStep ? 'bg-indigo-600 w-5' : 'bg-gray-200 w-1.5'
              }`}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-5">
        {!isReviewStep && currentSection && (
          <div>
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{SECTION_ICONS[currentSection.id] || '📄'}</span>
                <h2 className="text-lg font-bold text-gray-900">
                  {getSectionTitle(currentSection.id, currentSection.title)}
                </h2>
              </div>
              {currentSection.description && (
                <p className="text-sm text-gray-500 ml-8">{currentSection.description}</p>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              {currentSection.fields.map(field => renderField(field))}
            </div>
          </div>
        )}

        {isReviewStep && (
          <div>
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">✅</span>
                <h2 className="text-lg font-bold text-gray-900">{t.reviewTitle}</h2>
              </div>
              <p className="text-sm text-gray-500 ml-8">{t.reviewSubtitle}</p>
            </div>

            <div className="space-y-3">
              {sections.map(section => {
                const filledFields = section.fields.filter(f => formData[f.key] && formData[f.key] !== false)
                if (filledFields.length === 0) return null
                return (
                  <div key={section.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                      <span className="text-base">{SECTION_ICONS[section.id] || '📄'}</span>
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {getSectionTitle(section.id, section.title)}
                      </h3>
                      <span className="ml-auto text-xs text-gray-400">
                        {t.fields(filledFields.length)}
                      </span>
                    </div>
                    <div className="p-4 space-y-2">
                      {filledFields.filter(f => f.type !== 'signature').map(field => (
                        <div key={field.key} className="flex text-sm gap-2">
                          <span className="text-gray-400 w-28 sm:w-40 shrink-0 text-xs pt-0.5 leading-tight">{field.label}</span>
                          <span className="text-gray-900 font-medium text-xs flex-1 min-w-0 break-words">
                            {field.type === 'checkbox'
                              ? (formData[field.key] ? '✓ Yes' : '—')
                              : String(formData[field.key] || '').slice(0, 80)}
                          </span>
                        </div>
                      ))}
                      {filledFields.filter(f => f.type === 'signature').map(field => (
                        <div key={field.key} className="flex text-sm gap-2 items-center">
                          <span className="text-gray-400 w-28 sm:w-40 shrink-0 text-xs">{field.label}</span>
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
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 flex justify-between items-center">
          <button
            onClick={goBack}
            disabled={currentStep === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> {t.back}
          </button>

          {!isReviewStep && (
            <span className="text-xs text-gray-400 truncate max-w-[100px] sm:max-w-[160px] text-center">
              {currentSection ? getSectionTitle(currentSection.id, currentSection.title) : ''}
            </span>
          )}

          {isReviewStep ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t.submitting}</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> {isDemo ? t.finishPreview : t.submitForm}</>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-200 disabled:opacity-60 transition-all"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>{t.next} <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
