'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { FormSection } from '@/types'
import { Language, UI, SECTION_TITLES } from '@/lib/i18n/translations'
import { Send, Bot, User, CheckCircle, Globe, ChevronRight } from 'lucide-react'

interface ChatMessage {
  role: 'assistant' | 'user'
  content: string
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
  const chatSections = sections.filter(s => !SKIP_SECTIONS.includes(s.key))
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
  ): Promise<{ message: string; fieldUpdates: Record<string, unknown>; sectionComplete: boolean }> => {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        sectionKey: section.key,
        sectionTitle: SECTION_TITLES[section.key]?.[language] ?? section.title,
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

  // Start first section on mount
  useEffect(() => {
    if (initializedRef.current || !currentSection) return
    initializedRef.current = true
    setLoading(true)
    callChat([], currentSection)
      .then(data => {
        setMessages([{ role: 'assistant', content: data.message }])
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
        ? `✅ ¡Perfecto! Pasemos a: **${SECTION_TITLES[nextSection.key]?.es ?? nextSection.title}**`
        : `✅ Great! Moving on to: **${SECTION_TITLES[nextSection.key]?.en ?? nextSection.title}**`,
    }
    setMessages(prev => [...prev, transitionMsg])
    setSectionIndex(nextIdx)
    setLoading(true)
    try {
      const data = await callChat([], nextSection)
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
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

  const sendMessage = async () => {
    if (!input.trim() || loading || !currentSection) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    setLoading(true)
    inputRef.current?.focus()

    try {
      const data = await callChat(newHistory, currentSection)
      const assistantMsg: ChatMessage = { role: 'assistant', content: data.message }
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
  }

  const skipSection = () => {
    setCompletedSections(prev => new Set([...prev, sectionIndex]))
    advanceToSection(sectionIndex + 1, messages)
  }

  const progress = chatSections.length > 0
    ? Math.round((completedSections.size / chatSections.length) * 100)
    : 0

  const sectionTitle = currentSection
    ? (SECTION_TITLES[currentSection.key]?.[language] ?? currentSection.title)
    : ''

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">
              {language === 'es' ? 'Asistente de Declaración' : 'Disclosure Assistant'}
            </p>
            <p className="text-xs text-gray-400">
              {sectionTitle} · {sectionIndex + 1}/{chatSections.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onLanguageChange(language === 'en' ? 'es' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {language === 'en' ? 'Español' : 'English'}
          </button>
          <button
            onClick={onComplete}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors"
          >
            {language === 'es' ? 'Revisar' : 'Review'}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
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
      <div className="flex gap-1.5 px-4 py-2 overflow-x-auto bg-white/60 border-b border-gray-100"
        style={{ scrollbarWidth: 'none' }}>
        {chatSections.map((s, i) => {
          const done = completedSections.has(i)
          const active = i === sectionIndex
          return (
            <span
              key={s.key}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                done    ? 'bg-emerald-100 text-emerald-700' :
                active  ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' :
                          'bg-gray-100 text-gray-400'
              }`}
            >
              {done && <CheckCircle className="w-3 h-3" />}
              {SECTION_TITLES[s.key]?.[language] ?? s.title}
            </span>
          )
        })}
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
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
              <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-gray-500" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-3.5 h-3.5 text-white" />
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

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur border-t border-gray-100 px-4 pt-3 pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex gap-2 items-end">
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
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all disabled:opacity-60"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-xs text-gray-400">
            {language === 'es' ? '↵ Enter para enviar · Shift+Enter para nueva línea' : '↵ Enter to send · Shift+Enter for new line'}
          </p>
          <button
            onClick={skipSection}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-indigo-500 transition-colors disabled:opacity-40"
          >
            {language === 'es' ? 'Saltar sección →' : 'Skip section →'}
          </button>
        </div>
      </div>
    </div>
  )
}
