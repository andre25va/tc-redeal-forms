'use client'
import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Send, ArrowLeft, MapPin, Eye, EyeOff, X, ChevronUp, ChevronDown } from 'lucide-react'
import { FORM_SECTIONS, groupFieldsForSection } from '@/lib/formSections'

interface FieldCoordLite {
  field_key: string
  field_type: string
  page_num: number
}

interface FullField {
  field_key: string
  field_type: string
  page_num: number
  x: number
  y: number
  width: number
  height: number
}

interface ChatField {
  key: string
  type: string
  label: string
  choices?: string[]
}

interface SimpleFillPageProps {
  formName: string
  formSlug: string
  fields: FieldCoordLite[]
  formData: Record<string, string>
  onChange: (key: string, value: string) => void
  onBatchUpdate: (updates: Record<string, string>) => void
  onSubmit: () => void
  onSwitchMode: () => void
  invitation: { seller_name?: string; property_address?: string; seller_email: string }
  language: 'en' | 'es'
  onLanguageChange: (lang: 'en' | 'es') => void
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  submitting: boolean
}

const CHOICE_LABELS: Record<string, Record<string, string>> = {
  en: { yes: 'Yes', no: 'No', na: 'N/A', stays: 'Stays', removable: 'Removable', partial: 'Partial', complete: 'Complete', owned: 'Owned', leased: 'Leased' },
  es: { yes: 'Sí', no: 'No', na: 'N/A', stays: 'Se queda', removable: 'Se lleva', partial: 'Parcial', complete: 'Completo', owned: 'Propio', leased: 'Arrendado' },
}

// PDF page is standard letter: 612 x 792 points
const PDF_W = 612
const PDF_H = 792

const SLUG_PREFIX: Record<string, string> = {
  'seller-disclosure': 'sd',
  'residential-sale-contract': 'pc',
  'exclusive-right-to-sell': 'erts',
}

// ─── Live Preview Panel ──────────────────────────────────────────────────────
function PreviewPanel({
  formSlug,
  formData,
  currentSectionPage,
  onClose,
  inline,
}: {
  formSlug: string
  formData: Record<string, string>
  currentSectionPage: number
  onClose: () => void
  inline: boolean
}) {
  const [fullCoords, setFullCoords] = useState<FullField[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(currentSectionPage)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(0)

  const prefix = SLUG_PREFIX[formSlug] ?? 'sd'

  // fetch full coords once
  useEffect(() => {
    fetch(`/api/fields?form_slug=${formSlug}`)
      .then(r => r.json())
      .then(d => { setFullCoords(d.fields ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [formSlug])

  // sync page when section changes
  useEffect(() => {
    setPage(currentSectionPage)
  }, [currentSectionPage])

  // measure container width for scaling — useLayoutEffect ensures we catch it synchronously
  useLayoutEffect(() => {
    if (containerRef.current) {
      const w = containerRef.current.offsetWidth
      if (w > 0) setContainerW(w)
    }
  }, [loading]) // re-measure after loading completes (element may resize)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      if (w > 0) setContainerW(w)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const pageCount = useMemo(() => {
    if (!fullCoords) return 1
    return Math.max(...fullCoords.map(f => f.page_num), 1)
  }, [fullCoords])

  const pageFields = useMemo(() => {
    if (!fullCoords) return []
    return fullCoords.filter(f => f.page_num === page)
  }, [fullCoords, page])

  const scale = containerW > 0 ? containerW / PDF_W : 1
  const imgH = PDF_H * scale

  const getDisplayValue = (f: FullField): string => {
    const v = formData[f.field_key] ?? ''
    if (f.field_type === 'checkbox') return (v !== null && v !== undefined && v.trim() !== '') ? '✓' : ''
    return v
  }

  const panelClass = inline
    ? 'flex flex-col h-full border-l border-gray-200 bg-white overflow-hidden'
    : 'fixed inset-0 z-50 flex flex-col bg-white overflow-hidden'

  return (
    <div className={panelClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 transition"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700">
            Page {page} / {pageCount}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 transition"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
          title="Close preview"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* PDF Canvas */}
      <div className="flex-1 overflow-auto bg-gray-100 p-2">
        <div
          ref={containerRef}
          className="relative mx-auto bg-white shadow-md"
          style={{ width: '100%', maxWidth: 700, height: imgH || 'auto' }}
        >
          {/* Page image */}
          <img
            src={`/mapper-pages/${prefix}-page-${page}.jpg`}
            alt={`Page ${page}`}
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
          />

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <div className="text-sm text-gray-400 animate-pulse">Loading fields…</div>
            </div>
          )}

          {/* Field value overlays */}
          {!loading && containerW > 0 && pageFields.map(f => {
            const val = getDisplayValue(f)
            if (!val) return null
            // PDF Y is from bottom; image Y is from top
            const left = f.x * scale
            const top = f.y * scale
            const width = f.width * scale
            const height = Math.max(f.height * scale, 12)

            return (
              <div
                key={f.field_key}
                className="absolute flex items-center overflow-hidden pointer-events-none"
                style={{
                  left,
                  top,
                  width,
                  height,
                  background: 'rgba(219,234,254,0.92)',
                  fontSize: 9,
                  lineHeight: 1,
                  paddingLeft: 2,
                  color: '#1e40af',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontWeight: 600,
                  zIndex: 10,
                }}
              >
                {val}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SimpleFillPage({
  formName, formSlug, fields, formData, onChange, onBatchUpdate,
  onSubmit, onSwitchMode, invitation, language, onLanguageChange, saveStatus, submitting,
}: SimpleFillPageProps) {
  const [state, setState] = useState<'MO' | 'KS' | null>(null)
  const [sectionIdx, setSectionIdx] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)

  const sections = useMemo(() => {
    const defined = FORM_SECTIONS[formSlug]
    if (defined?.length) {
      return defined.map(sec => {
        const secFields = fields.filter(f =>
          sec.prefixes.some(p => f.field_key.startsWith(p))
        )
        return {
          key: sec.key,
          title: language === 'es' && sec.titleEs ? sec.titleEs : sec.title,
          chatFields: groupFieldsForSection(secFields),
          firstPage: secFields.length ? Math.min(...secFields.map(f => f.page_num)) : 1,
        }
      }).filter(s => s.chatFields.length > 0)
    }
    const pages = [...new Set(fields.map(f => f.page_num))].sort((a, b) => a - b)
    return pages.map(p => ({
      key: `page_${p}`,
      title: language === 'es' ? `Página ${p}` : `Page ${p}`,
      chatFields: groupFieldsForSection(fields.filter(f => f.page_num === p)),
      firstPage: p,
    })).filter(s => s.chatFields.length > 0)
  }, [formSlug, fields, language])

  const current = sections[sectionIdx]
  const isFirst = sectionIdx === 0
  const isLast = sectionIdx === sections.length - 1

  const currentSectionPage = current?.firstPage ?? 1

  const getChoiceValue = (field: ChatField): string => {
    if (!field.choices) return ''
    for (const c of field.choices) {
      if (formData[`${field.key}_${c}`] === 'true') return c
    }
    return ''
  }

  const handleChoiceChange = (field: ChatField, choice: string) => {
    if (!field.choices) return
    const updates: Record<string, string> = {}
    for (const c of field.choices) {
      updates[`${field.key}_${c}`] = c === choice ? 'true' : ''
    }
    onBatchUpdate(updates)
  }

  const t = language === 'es' ? {
    back: 'Atrás', next: 'Siguiente', submit: 'Enviar Formulario',
    submitting: 'Enviando…', saving: 'Guardando…', saved: '✓ Guardado',
    saveError: 'Error al guardar', section: 'Sección', of: 'de',
    autoSaved: 'Su progreso se guarda automáticamente.',
    applies: 'Aplica',
    stateTitle: '¿Dónde está ubicada la propiedad?',
    stateSubtitle: 'Seleccione el estado para comenzar',
    previewPdf: 'Vista Previa PDF',
    hidePreview: 'Ocultar Vista',
  } : {
    back: 'Back', next: 'Next', submit: 'Submit Form',
    submitting: 'Submitting…', saving: 'Saving…', saved: '✓ Saved',
    saveError: 'Save error', section: 'Section', of: 'of',
    autoSaved: 'Your progress is automatically saved.',
    applies: 'Applies',
    stateTitle: 'Where is the property located?',
    stateSubtitle: 'Select the state to get started',
    previewPdf: 'Preview PDF',
    hidePreview: 'Hide Preview',
  }

  // ── State picker ──────────────────────────────────────────────────────────
  if (state === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex flex-col items-center justify-center p-4" style={{ colorScheme: 'light' }}>
        <div className="absolute top-4 right-4">
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs shadow-sm">
            <button onClick={() => onLanguageChange('en')} className={`px-3 py-1.5 font-medium transition-colors ${language === 'en' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>EN</button>
            <button onClick={() => onLanguageChange('es')} className={`px-3 py-1.5 font-medium transition-colors ${language === 'es' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>ES</button>
          </div>
        </div>
        <button onClick={onSwitchMode} className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition px-2 py-1 rounded-lg hover:bg-white">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-7 h-7 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{t.stateTitle}</h2>
          <p className="text-sm text-gray-500 mb-8">{t.stateSubtitle}</p>
          <div className="grid grid-cols-2 gap-4">
            {(['MO', 'KS'] as const).map(s => (
              <button key={s} onClick={() => setState(s)} className="bg-white border-2 border-gray-200 hover:border-indigo-400 hover:shadow-md rounded-2xl p-6 text-center transition-all group">
                <div className="text-3xl font-black text-gray-800 group-hover:text-indigo-600 transition-colors mb-1">{s}</div>
                <div className="text-xs text-gray-400 font-medium">{s === 'MO' ? 'Missouri' : 'Kansas'}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Form + optional preview ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ colorScheme: 'light' }}>

      {/* Sticky Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm flex-shrink-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={onSwitchMode} className="text-gray-400 hover:text-gray-600 transition flex-shrink-0 p-1 -ml-1 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="font-bold text-gray-900 text-sm truncate">{formName}</h1>
                <div className="flex items-center gap-1.5">
                  {invitation.property_address && (
                    <p className="text-xs text-gray-400 truncate">{invitation.property_address}</p>
                  )}
                  <span onClick={() => setState(null)} className="text-xs bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded cursor-pointer hover:bg-indigo-200 transition flex-shrink-0" title="Change state">{state}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {saveStatus === 'saving' && <span className="text-xs text-gray-400">{t.saving}</span>}
              {saveStatus === 'saved' && <span className="text-xs text-green-600 font-medium">{t.saved}</span>}
              {saveStatus === 'error' && <span className="text-xs text-red-500">{t.saveError}</span>}

              {/* Preview toggle button */}
              <button
                onClick={() => setPreviewOpen(o => !o)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  previewOpen
                    ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600'
                }`}
                title={previewOpen ? t.hidePreview : t.previewPdf}
              >
                {previewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{previewOpen ? t.hidePreview : t.previewPdf}</span>
              </button>

              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                <button onClick={() => onLanguageChange('en')} className={`px-2 py-1 font-medium transition-colors ${language === 'en' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>EN</button>
                <button onClick={() => onLanguageChange('es')} className={`px-2 py-1 font-medium transition-colors ${language === 'es' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>ES</button>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>{t.section} {sectionIdx + 1} {t.of} {sections.length}:&nbsp;<span className="font-semibold text-gray-600">{current?.title}</span></span>
              <span>{Math.round(((sectionIdx + 1) / sections.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${((sectionIdx + 1) / sections.length) * 100}%` }} />
            </div>
          </div>
        </div>
      </header>

      {/* Body: form + optional side-by-side preview */}
      <div className={`flex-1 flex overflow-hidden ${previewOpen ? 'lg:flex-row flex-col' : ''}`}>

        {/* Form column */}
        <div className={`overflow-y-auto ${previewOpen ? 'lg:w-1/2 lg:border-r lg:border-gray-200' : 'w-full'}`}>
          <div className={`mx-auto px-4 py-6 ${previewOpen ? 'max-w-xl' : 'max-w-2xl'}`}>
            {current && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100">
                  <h2 className="text-base font-bold text-indigo-900">{current.title}</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {current.chatFields.map(field => (
                    <div key={field.key} className="px-6 py-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2.5 leading-snug">{field.label}</label>
                      {field.type === 'choice' && field.choices ? (
                        <div className="flex flex-wrap gap-2">
                          {field.choices.map(c => {
                            const selected = getChoiceValue(field) === c
                            const chipLabel = CHOICE_LABELS[language]?.[c] ?? c.charAt(0).toUpperCase() + c.slice(1)
                            const selectedStyle = c === 'yes' ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : c === 'no' ? 'bg-rose-400 border-rose-400 text-white shadow-sm' : 'bg-indigo-500 border-indigo-500 text-white shadow-sm'
                            return (
                              <button key={c} onClick={() => handleChoiceChange(field, c)} className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${selected ? selectedStyle : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
                                {selected && '✓ '}{chipLabel}
                              </button>
                            )
                          })}
                        </div>
                      ) : field.type === 'checkbox' ? (
                        <button onClick={() => onChange(field.key, formData[field.key] === 'true' ? '' : 'true')} className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${formData[field.key] === 'true' ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
                          {formData[field.key] === 'true' ? '✓ ' : ''}{t.applies}
                        </button>
                      ) : (
                        <input type={field.type === 'number' ? 'number' : 'text'} value={formData[field.key] ?? ''} onChange={e => onChange(field.key, e.target.value)} placeholder={field.label} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-gray-900 bg-gray-50 focus:bg-white transition placeholder-gray-300" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex items-center justify-between mt-5">
              <button onClick={() => { if (isFirst) setState(null); else setSectionIdx(i => Math.max(0, i - 1)) }} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm">
                <ChevronLeft className="w-4 h-4" />{t.back}
              </button>
              <div className="flex gap-1.5 items-center">
                {sections.map((_, i) => (
                  <button key={i} onClick={() => setSectionIdx(i)} className={`rounded-full transition-all duration-300 ${i === sectionIdx ? 'w-4 h-2 bg-indigo-500' : i < sectionIdx ? 'w-2 h-2 bg-indigo-200' : 'w-2 h-2 bg-gray-200'}`} />
                ))}
              </div>
              {isLast ? (
                <button onClick={onSubmit} disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow transition disabled:opacity-60">
                  <Send className="w-4 h-4" />{submitting ? t.submitting : t.submit}
                </button>
              ) : (
                <button onClick={() => setSectionIdx(i => Math.min(sections.length - 1, i + 1))} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition shadow">
                  {t.next}<ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">{t.autoSaved}</p>
          </div>
        </div>

        {/* Preview panel — desktop: inline right column, mobile: fixed overlay */}
        {previewOpen && (
          <>
            {/* Desktop inline panel */}
            <div className="hidden lg:flex lg:w-1/2 flex-col overflow-hidden">
              <PreviewPanel
                formSlug={formSlug}
                formData={formData}
                currentSectionPage={currentSectionPage}
                onClose={() => setPreviewOpen(false)}
                inline={true}
              />
            </div>
            {/* Mobile overlay */}
            <div className="lg:hidden fixed inset-0 z-50">
              <PreviewPanel
                formSlug={formSlug}
                formData={formData}
                currentSectionPage={currentSectionPage}
                onClose={() => setPreviewOpen(false)}
                inline={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
