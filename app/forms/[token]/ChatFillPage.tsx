'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, CheckCircle2, FileEdit } from 'lucide-react'
import {
  FORM_SECTIONS,
  groupFieldsForSection,
  expandChatUpdates,
  getFormValues,
  ChatField,
} from '@/lib/formSections'

interface FieldCoordLite {
  field_key: string
  field_type: string
}

interface Message {
  role: 'assistant' | 'user'
  content: string
  options?: string[]
  isMultiSelect?: boolean
}

interface ChatFillPageProps {
  token: string
  formName: string
  formSlug: string
  fields: FieldCoordLite[]
  formData: Record<string, string>
  onUpdate: (updates: Record<string, string>) => void
  onSubmit: () => void
  onSwitchMode: () => void
  invitation: { seller_name?: string; property_address?: string; seller_email: string }
  language: 'en' | 'es'
  onLanguageChange: (lang: 'en' | 'es') => void
}

const BATCH_SECTIONS = new Set([
  'land', 'infestation', 'structural', 'hazardous',
  'other_matters', 'taxes_hoa', 'inspections', 'additions',
])

export default function ChatFillPage({
  token, formName, formSlug, fields, formData, onUpdate, onSubmit, onSwitchMode,
  invitation, language, onLanguageChange,
}: ChatFillPageProps) {
  const sections = FORM_SECTIONS[formSlug] ?? []
  const [sectionIdx, setSectionIdx] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [allDone, setAllDone] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const startedRef = useRef(false)
  const formDataRef = useRef(formData)

  // Keep formDataRef in sync
  useEffect(() => { formDataRef.current = formData }, [formData])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const getSectionFields = useCallback((idx: number): FieldCoordLite[] => {
    const section = sections[idx]
    if (!section) return []
    return fields.filter(f => section.prefixes.some(p => f.field_key.startsWith(p)))
  }, [sections, fields])

  const startSection = useCallback(async (idx: number) => {
    const section = sections[idx]
    if (!section) { setAllDone(true); return }

    const sectionFields = getSectionFields(idx)
    const chatFields: ChatField[] = groupFieldsForSection(sectionFields)
    if (chatFields.length === 0) { startSection(idx + 1); return }

    setSectionIdx(idx)
    setMessages([])
    setSelectedChips([])
    setLoading(true)

    try {
      const currentFormValues = getFormValues(formDataRef.current, chatFields)
      const sectionTitle = language === 'es' ? (section.titleEs ?? section.title) : section.title

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          sectionKey: section.key,
          sectionTitle,
          fields: chatFields,
          formValues: currentFormValues,
          language,
          sellerName: invitation.seller_name,
          propertyAddress: invitation.property_address,
        }),
      })
      const data = await res.json()

      if (data.fieldUpdates && Object.keys(data.fieldUpdates).length > 0) {
        onUpdate(expandChatUpdates(data.fieldUpdates, fields))
      }

      if (data.sectionComplete) {
        startSection(idx + 1)
        return
      }

      const isBatch = BATCH_SECTIONS.has(section.key)
      setMessages([{
        role: 'assistant',
        content: data.message,
        options: data.options,
        isMultiSelect: isBatch && (data.options?.length ?? 0) > 2,
      }])
    } catch (e) {
      console.error('Chat start error:', e)
      setMessages([{ role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, fields, language, invitation, onUpdate, getSectionFields])

  // Start first section on mount
  useEffect(() => {
    if (!startedRef.current && sections.length > 0) {
      startedRef.current = true
      startSection(0)
    }
  }, [sections, startSection])

  const sendMessage = useCallback(async (userText: string) => {
    const currentSection = sections[sectionIdx]
    if (!currentSection || loading) return

    const userMsg: Message = { role: 'user', content: userText }
    const newMessages: Message[] = [...messages, userMsg]
    setMessages(newMessages)
    setInputValue('')
    setSelectedChips([])
    setLoading(true)

    const sectionFields = getSectionFields(sectionIdx)
    const chatFields: ChatField[] = groupFieldsForSection(sectionFields)
    const currentFormValues = getFormValues(formDataRef.current, chatFields)
    const sectionTitle = language === 'es' ? (currentSection.titleEs ?? currentSection.title) : currentSection.title

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          sectionKey: currentSection.key,
          sectionTitle,
          fields: chatFields,
          formValues: currentFormValues,
          language,
          sellerName: invitation.seller_name,
          propertyAddress: invitation.property_address,
        }),
      })
      const data = await res.json()

      if (data.fieldUpdates && Object.keys(data.fieldUpdates).length > 0) {
        onUpdate(expandChatUpdates(data.fieldUpdates, fields))
      }

      if (data.sectionComplete) {
        setMessages([...newMessages, { role: 'assistant', content: data.message }])
        setTimeout(() => startSection(sectionIdx + 1), 900)
      } else {
        const isBatch = BATCH_SECTIONS.has(currentSection.key)
        setMessages([...newMessages, {
          role: 'assistant',
          content: data.message,
          options: data.options,
          // only multi-select on the very first AI message of a batch section
          isMultiSelect: isBatch && messages.length === 0 && (data.options?.length ?? 0) > 2,
        }])
      }
    } catch (e) {
      console.error('Chat send error:', e)
      setMessages([...newMessages, { role: 'assistant', content: 'Error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }, [sections, sectionIdx, loading, messages, fields, language, invitation, onUpdate, getSectionFields, startSection])

  const handleChipTap = (option: string) => {
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.isMultiSelect) {
      setSelectedChips(prev =>
        prev.includes(option) ? prev.filter(c => c !== option) : [...prev, option]
      )
    } else {
      sendMessage(option)
    }
  }

  const handleMultiContinue = () => {
    if (selectedChips.length === 0) return
    sendMessage(selectedChips.join(', '))
  }

  const handleNone = () => {
    sendMessage(language === 'es' ? 'Ninguno de estos' : 'None of these')
  }

  const handleSend = () => {
    const text = inputValue.trim()
    if (text) sendMessage(text)
  }

  // ── All done ──────────────────────────────────────────────────────────────
  if (allDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col items-center justify-center p-4" style={{ colorScheme: 'light' }}>
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {language === 'es' ? '¡Todo listo!' : "All done!"}
          </h1>
          <p className="text-gray-500 mb-6">
            {language === 'es'
              ? 'Hemos recopilado toda la información. ¿Listo para enviar?'
              : "We've collected all the information. Ready to submit?"}
          </p>
          <div className="space-y-3">
            <button
              onClick={onSubmit}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl shadow transition"
            >
              {language === 'es' ? 'Enviar Formulario' : 'Submit Form'}
            </button>
            <button
              onClick={onSwitchMode}
              className="w-full bg-white hover:bg-gray-50 text-gray-600 font-medium py-3 px-6 rounded-xl border border-gray-200 shadow-sm transition text-sm"
            >
              {language === 'es' ? 'Revisar en PDF antes de enviar' : 'Review PDF before submitting'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main chat UI ──────────────────────────────────────────────────────────
  const currentSection = sections[sectionIdx]
  const progress = sections.length > 0 ? (sectionIdx / sections.length) * 100 : 0
  const lastMsg = messages[messages.length - 1]
  const showOptions = !loading && lastMsg?.role === 'assistant' && (lastMsg.options?.length ?? 0) > 0
  const isMultiSelectMode = showOptions && lastMsg?.isMultiSelect

  const sectionLabel = currentSection
    ? (language === 'es' ? (currentSection.titleEs ?? currentSection.title) : currentSection.title)
    : formName

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ colorScheme: 'light' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex-shrink-0">
                  {sectionIdx + 1}/{sections.length}
                </span>
                <h1 className="text-sm font-bold text-gray-900 truncate">{sectionLabel}</h1>
              </div>
              <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                <button
                  onClick={() => onLanguageChange('en')}
                  className={`px-2 py-1 font-medium transition-colors ${language === 'en' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}
                >EN</button>
                <button
                  onClick={() => onLanguageChange('es')}
                  className={`px-2 py-1 font-medium transition-colors ${language === 'es' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}
                >ES</button>
              </div>
              <button
                onClick={onSwitchMode}
                title={language === 'es' ? 'Cambiar a manual' : 'Switch to manual'}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1.5 rounded-lg transition"
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{language === 'es' ? 'Manual' : 'Manual'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <span className="text-indigo-600 text-xs font-bold">AI</span>
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mr-2">
                <span className="text-indigo-600 text-xs font-bold">AI</span>
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 sticky bottom-0">
        <div className="max-w-2xl mx-auto px-3 py-3">

          {/* Chips */}
          {showOptions && (
            <div className="mb-3">
              {isMultiSelectMode ? (
                <>
                  <p className="text-xs text-gray-400 mb-2">
                    {language === 'es' ? 'Toca todo lo que aplique:' : 'Tap all that apply:'}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(lastMsg.options ?? [])
                      .filter(o => o !== 'None of these' && o !== 'Ninguno de estos')
                      .map(option => (
                        <button
                          key={option}
                          onClick={() => handleChipTap(option)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                            selectedChips.includes(option)
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                          }`}
                        >
                          {selectedChips.includes(option) && <span className="mr-1 text-xs">✓</span>}
                          {option}
                        </button>
                      ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleNone}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                    >
                      {language === 'es' ? 'Ninguno' : 'None'}
                    </button>
                    {selectedChips.length > 0 && (
                      <button
                        onClick={handleMultiContinue}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition"
                      >
                        {language === 'es'
                          ? `Continuar (${selectedChips.length} seleccionado${selectedChips.length !== 1 ? 's' : ''})`
                          : `Continue (${selectedChips.length} selected)`}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(lastMsg.options ?? []).map(option => (
                    <button
                      key={option}
                      onClick={() => handleChipTap(option)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Text input */}
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={language === 'es' ? 'Escriba su respuesta…' : 'Type your answer…'}
              disabled={loading}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bg-gray-50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || loading}
              className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
