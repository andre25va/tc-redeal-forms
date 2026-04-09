'use client'
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Send, ArrowLeft, MapPin } from 'lucide-react'
import { FORM_SECTIONS, groupFieldsForSection } from '@/lib/formSections'

interface FieldCoordLite {
  field_key: string
  field_type: string
  page_num: number
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

export default function SimpleFillPage({
  formName, formSlug, fields, formData, onChange, onBatchUpdate,
  onSubmit, onSwitchMode, invitation, language, onLanguageChange, saveStatus, submitting,
}: SimpleFillPageProps) {
  const [state, setState] = useState<'MO' | 'KS' | null>(null)
  const [sectionIdx, setSectionIdx] = useState(0)

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
        }
      }).filter(s => s.chatFields.length > 0)
    }
    const pages = [...new Set(fields.map(f => f.page_num))].sort((a, b) => a - b)
    return pages.map(p => ({
      key: `page_${p}`,
      title: language === 'es' ? `Página ${p}` : `Page ${p}`,
      chatFields: groupFieldsForSection(fields.filter(f => f.page_num === p)),
    })).filter(s => s.chatFields.length > 0)
  }, [formSlug, fields, language])

  const current = sections[sectionIdx]
  const isFirst = sectionIdx === 0
  const isLast = sectionIdx === sections.length - 1

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
    stateStart: 'Comenzar',
  } : {
    back: 'Back', next: 'Next', submit: 'Submit Form',
    submitting: 'Submitting…', saving: 'Saving…', saved: '✓ Saved',
    saveError: 'Save error', section: 'Section', of: 'of',
    autoSaved: 'Your progress is automatically saved.',
    applies: 'Applies',
    stateTitle: 'Where is the property located?',
    stateSubtitle: 'Select the state to get started',
    stateStart: 'Get Started',
  }

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

  return (
    <div className="min-h-screen bg-gray-50" style={{ colorScheme: 'light' }}>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
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
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                <button onClick={() => onLanguageChange('en')} className={`px-2 py-1 font-medium transition-colors ${language === 'en' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>EN</button>
                <button onClick={() => onLanguageChange('es')} className={`px-2 py-1 font-medium transition-colors ${language === 'es' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>ES</button>
              </div>
            </div>
          </div>
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
      <div className="max-w-2xl mx-auto px-4 py-6">
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
  )
}
