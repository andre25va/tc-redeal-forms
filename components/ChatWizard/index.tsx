'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { FormSection } from '@/types'
import { Language, UI, SECTION_TITLES } from '@/lib/i18n/translations'
import { Send, Bot, User, CheckCircle, Globe, ChevronRight } from 'lucide-react'

interface ChatMessage {
  role: 'assistant' | 'user'
  content: string
  options?: string[]
}

interface ChatWizardProps {
  sections: FormSection[]
  token: string
  formValues: Record<string, unknown>
  onUpdate: (key: string, value: unknown) => void
  onComplete: () => void
  invitation: { seller_name?: string; property_address?: string; seller_email: string }
  language: Language
  onLanguageChange: (lang: Language) => void
}

const SKIP_SECTIONS = ['signatures']

export default function ChatWizard({
  sections,
  token,
  formValues,
  onUpdate,
  onComplete,
  invitation,
  language,
  onLanguageChange,
}: ChatWizardProps) {
  const chatSections = sections.filter(s => !SKIP_SECTIONS.includes(s.id))
  const [sectionIndex, setSectionIndex] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initializedRef = useRef(false)
  const t = UI[language]

  const currentSection = chatSections[sectionIndex]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const callChat = useCallback(async (
    history: ChatMessage[],
    section: FormSection,
  ): Promise<{ message: string; fieldUpdates: Record<string, unknown>; sectionComplete: boolean; options: string[] }> => {
    const apiHistory = history.map(({ role, content }) => ({ role, content }))
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiHistory,
        sectionKey: section.id,
        sectionTitle: SECTION_TITLES[section.id]?.[language] ?? section.title,
        fields: section.fields,
        formValues,
        language,
        sellerName: invitation.seller_name,
        propertyAddress: invitation.property_address,
      }),
    })
    if (!res.ok) throw new Error('API error')
    return res.json()
  }, [formValues, language, invitation])

  useEffect(() => {
    if (initializedRef.current || !currentSection) return
    initializedRef.current = true
    setLoading(true)
    callChat([], currentSection)
      .then(data => {
        setMessages([{ role: 'assistant', content: data.message, options: data.options?.length ? data.options : undefined }])
        if (data.fieldUpdates) {
          Object.entries(data.fieldUpdates).forEach(([k, v]) => onUpdate(k, v))
        }
      })
      .catch(() => {
        setMessages([{
          role: 'assistant',
          content: language === 'es'
            ? 'Hola! Empecemos con el formulario. ¿Cuánto tiempo llevan en la propiedad?'
            : "Hi! Let's get started. How long have you owned the property?",
        }])
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const advanceToSection = useCallback(async (nextIdx: number, currentHistory: ChatMessage[]) => {
    if (nextIdx >= chatSections.length) {
      onComplete()
      return
    }
    const nextSection = chatSections[nextIdx]
    const transitionMsg: ChatMessage = {
      role: 'assistant',
      content: language === 'es'
        ? `✅ ¡Perfecto! Pasemos a: **${SECTION_TITLES[nextSection.id]?.es ?? nextSection.title}**`
        : `✅ Great! Moving on to: **${SECTION_TITLES[nextSection.id]?.en ?? nextSection.title}**`,
    }
    setMessages(prev => [...prev, transitionMsg])
    setSectionIndex(nextIdx)
    setLoading(true)
    try {
      const data = await callChat([], nextSection)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        options: data.options?.length ? data.options : undefined,
      }])
      if (data.fieldUpdates) {
        Object.entries(data.fieldUpdates).forEach(([k, v]) => onUpdate(k, v))
      }
      if (data.sectionComplete) {
        setCompletedSections(prev => new Set([...prev, nextIdx]))
        await advanceToSection(nextIdx + 1, [])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: language === 'es' ? 'Tuve un problema. Por favor intenta de nuevo.' : 'I had a connection issue. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }, [chatSections, language, callChat, onUpdate, onComplete])

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text ?? input).trim()
    if (!msgText || loading || !currentSection) return

    setMessages(prev => prev.map(m => ({ ...m, options: undefined })))

    const userMsg: ChatMessage = { role: 'user', content: msgText }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    inputRef.current?.focus()

    try {
      const newHistory = await new Promise<ChatMessage[]>(resolve => {
        setMessages(prev => {
          resolve(prev)
          return prev
        })
      })

      const data = await callChat(newHistory, currentSection)
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.message,
        options: data.options?.length ? data.options : undefined,
      }
      setMessages(prev => [...prev, assistantMsg])

      if (data.fieldUpdates) {
        Object.entries(data.fieldUpdates).forEach(([k, v]) => onUpdate(k, v))
      }

      if (data.sectionComplete) {
        setCompletedSections(prev => new Set([...prev, sectionIndex]))
        setTimeout(() => advanceToSection(sectionIndex + 1, [...newHistory, assistantMsg]), 800)
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: language === 'es'
          ? 'Tuve un problema de conexión. Por favor intenta de nuevo.'
          : 'I had a connection issue. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, currentSection, callChat, sectionIndex, advanceToSection, onUpdate, language])

  const skipSection = () => {
    setCompletedSections(prev => new Set([...prev, sectionIndex]))
    advanceToSection(sectionIndex + 1, messages)
  }

  const progress = chatSections.length > 0
    ? Math.round((completedSections.size / chatSections.length) * 100)
    : 0

  const sectionTitle = currentSection
    ? (SECTION_TITLES[currentSection.id]?.[language] ?? currentSection.title)
    : ''

  const lastAssistantIdx = messages.reduce((last, msg, i) => msg.role === 'assistant' ? i : last, -1)

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm leading-tight">
                {language === 'es' ? 'Asistente de Declaración' : 'Disclosure Assistant'}
              </p>
              <p className="text-xs text-gray-400 truncate max-w-[160px] sm:max-w-xs">
                {sectionTitle} · {sectionIndex + 1}/{chatSections.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onLanguageChange(language === 'en' ? 'es' : 'en')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'ES' : 'EN'}</span>
            </button>
            <button
              onClick={onComplete}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors"
            >
              <span>{language === 'es' ? 'Revisar' : 'Review'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Section pills ──────────────────────────────────────────────────── */}
      <div className="bg-white/60 border-b border-gray-100">
        <div
          className="max-w-2xl mx-auto flex gap-2 px-4 py-2.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {chatSections.map((s, i) => {
            const done = completedSections.has(i)
            const active = i === sectionIndex
            return (
              <span
                key={s.id}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  done    ? 'bg-emerald-100 text-emerald-700' :
                  active  ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' :
                            'bg-gray-100 text-gray-400'
                }`}
              >
                {done && <CheckCircle className="w-3 h-3" />}
                {SECTION_TITLES[s.id]?.[language] ?? s.title}
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto py-5"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div className="max-w-2xl mx-auto px-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br />'),
                  }}
                />
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                )}
              </div>

              {/* Quick-reply chips */}
              {msg.role === 'assistant' && i === lastAssistantIdx && !loading && msg.options && msg.options.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 ml-10">
                  {msg.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => sendMessage(opt)}
                      disabled={loading}
                      className="px-4 py-2 bg-white border-2 border-indigo-200 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-50 hover:border-indigo-400 active:scale-95 transition-all shadow-sm disabled:opacity-40"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-end gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm px-4 py-3.5 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1.5 items-center">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '160ms' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '320ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div
        className="bg-white/90 backdrop-blur border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="flex gap-2.5 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={language === 'es' ? 'Escriba su respuesta...' : 'Type your answer...'}
              rows={1}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all disabled:opacity-60"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 pb-2 px-0.5">
            <p className="text-xs text-gray-400 hidden sm:block">
              {language === 'es' ? '↵ Enter para enviar' : '↵ Enter to send'}
            </p>
            <button
              onClick={skipSection}
              disabled={loading}
              className="text-xs text-gray-400 hover:text-indigo-500 transition-colors disabled:opacity-40 ml-auto"
            >
              {language === 'es' ? 'Saltar esta sección →' : 'Skip section →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
