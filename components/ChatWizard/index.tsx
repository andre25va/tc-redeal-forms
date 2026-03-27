'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { FormSection } from '@/types'
import { Language, UI, SECTION_TITLES } from '@/lib/i18n/translations'
import { Send, Bot, User, CheckCircle, Globe, ChevronRight } from 'lucide-react'
import {
  SCRIPTED_SECTIONS,
  findNextStep,
  buildScriptCtx,
  type ScriptStep,
} from '@/lib/forms/seller-disclosure/chat-script'

interface ChatMessage {
  role: 'assistant' | 'user'
  content: string
  options?: string[]
  isPropertyCard?: boolean
}

interface PropertyData {
  yearBuilt: number | null
  propertyType: string | null
  hoa: 'yes' | 'no' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
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
  const [scriptStepIndex, setScriptStepIndex] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initializedRef = useRef(false)
  const propertyLookupDoneRef = useRef(false)
  const pendingPropertyDataRef = useRef<PropertyData | null>(null)
  const scriptTempValsRef = useRef<Record<string, unknown>>({})
  const formValuesRef = useRef(formValues)
  const awaitingAddressPickRef = useRef(false)
  // Track current section index in a ref so callbacks always see latest value
  const sectionIndexRef = useRef(0)
  const scriptStepIndexRef = useRef(0)

  useEffect(() => { formValuesRef.current = formValues }, [formValues])
  useEffect(() => { sectionIndexRef.current = sectionIndex }, [sectionIndex])
  useEffect(() => { scriptStepIndexRef.current = scriptStepIndex }, [scriptStepIndex])

  const t = UI[language]
  void t

  const currentSection = chatSections[sectionIndex]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const resolvedAddress = useCallback(() => {
    return (
      (formValues?.property_address as string) ||
      invitation.property_address ||
      'the property'
    )
  }, [formValues, invitation.property_address])

  const getCtx = useCallback(() => {
    return buildScriptCtx(
      { ...formValuesRef.current, ...scriptTempValsRef.current },
      invitation.property_address,
    )
  }, [invitation.property_address])

  const getAllVals = useCallback(() => ({
    ...formValuesRef.current,
    ...scriptTempValsRef.current,
  }), [])

  const initScriptedSection = useCallback((
    script: ScriptStep[],
    append: boolean,
  ) => {
    const allVals = getAllVals()
    const firstIdx = findNextStep(script, -1, allVals)
    if (firstIdx >= script.length) return false
    const step = script[firstIdx]
    const ctx = getCtx()
    const q = language === 'es' ? step.questionEs(ctx) : step.question(ctx)
    const opts = language === 'es' ? (step.optionsEs ?? step.options) : step.options
    const msg: ChatMessage = { role: 'assistant', content: q, options: opts }
    if (append) {
      setMessages(prev => [...prev, msg])
    } else {
      setMessages([msg])
    }
    setScriptStepIndex(firstIdx)
    return true
  }, [getAllVals, getCtx, language])

  const callChat = useCallback(async (
    history: ChatMessage[],
    section: FormSection,
  ) => {
    const apiHistory = history.map(({ role, content }) => ({ role, content }))
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiHistory,
        sectionKey: section.id,
        sectionTitle: SECTION_TITLES[section.id]?.[language] ?? section.title,
        fields: section.fields,
        formValues: formValuesRef.current,
        language,
        sellerName: invitation.seller_name,
        propertyAddress: resolvedAddress(),
      }),
    })
    if (!res.ok) throw new Error('API error')
    return res.json() as Promise<{
      message: string
      fieldUpdates: Record<string, unknown>
      sectionComplete: boolean
      options: string[]
    }>
  }, [language, invitation, resolvedAddress])

  // ── Property data lookup (fires once after address is committed to form) ─────
  useEffect(() => {
    const address = formValues?.property_address as string
    if (!address || propertyLookupDoneRef.current) return
    propertyLookupDoneRef.current = true

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai/property', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        })
        const data: PropertyData = await res.json()
        if (!res.ok || (data as { error?: string }).error) return

        const items: string[] = []
        if (data.yearBuilt) {
          const age = new Date().getFullYear() - data.yearBuilt
          items.push(`🏗️ Built: **${data.yearBuilt}** (~${age} yrs old)`)
        }
        if (data.propertyType) items.push(`🏠 Type: **${data.propertyType}**`)
        if (data.hoa !== 'unknown') items.push(`🏘️ HOA: **${data.hoa === 'yes' ? 'Yes' : 'No'}**`)
        if (items.length === 0) return

        const confidenceNote = data.confidence === 'low'
          ? (language === 'es' ? '\n\n_Esto es una estimación — confirme por favor._' : '\n\n_This is an estimate — please confirm._')
          : ''

        const msg = language === 'es'
          ? `Encontré información sobre esta propiedad:\n\n${items.join('\n')}${confidenceNote}\n\n¿Esto se ve correcto?`
          : `I found some info about this property:\n\n${items.join('\n')}${confidenceNote}\n\nDoes this look right?`

        pendingPropertyDataRef.current = data
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: msg,
          options: language === 'es'
            ? ['Sí, correcto ✓', 'Algo está mal']
            : ["Yes, that's right ✓", "Something's off"],
          isPropertyCard: true,
        }])
      } catch { /* silent */ }
    }, 1200)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues?.property_address])

  // ── Initialize first section on mount ────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current || !currentSection) return
    initializedRef.current = true

    const script = SCRIPTED_SECTIONS[currentSection.id]
    if (script) {
      initScriptedSection(script, false)
    } else {
      setLoading(true)
      callChat([], currentSection)
        .then(data => {
          setMessages([{
            role: 'assistant',
            content: data.message,
            options: data.options?.length ? data.options : undefined,
          }])
          if (data.fieldUpdates) {
            Object.entries(data.fieldUpdates).forEach(([k, v]) => onUpdate(k, v))
          }
        })
        .catch(() => {
          setMessages([{ role: 'assistant', content: language === 'es' ? 'Empecemos.' : "Let's get started." }])
        })
        .finally(() => setLoading(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Advance to next section ──────────────────────────────────────────────────
  const advanceToSection = useCallback(async (nextIdx: number) => {
    if (nextIdx >= chatSections.length) {
      onComplete()
      return
    }
    const nextSection = chatSections[nextIdx]
    const transitionMsg: ChatMessage = {
      role: 'assistant',
      content: language === 'es'
        ? `✅ Pasemos a: **${SECTION_TITLES[nextSection.id]?.es ?? nextSection.title}**`
        : `✅ Moving on to: **${SECTION_TITLES[nextSection.id]?.en ?? nextSection.title}**`,
    }
    setMessages(prev => [...prev, transitionMsg])
    setSectionIndex(nextIdx)
    setScriptStepIndex(0)

    const script = SCRIPTED_SECTIONS[nextSection.id]
    if (script) {
      setTimeout(() => initScriptedSection(script, true), 300)
    } else {
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
          advanceToSection(nextIdx + 1)
        }
      } catch {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: language === 'es'
            ? 'Tuve un problema. Por favor intenta de nuevo.'
            : 'I had a connection issue. Please try again.',
        }])
      } finally {
        setLoading(false)
      }
    }
  }, [chatSections, language, callChat, onUpdate, onComplete, initScriptedSection])

  // ── Re-prompt the current scripted step (used after property card interlude) ──
  const resumeCurrentScript = useCallback(() => {
    const secIdx = sectionIndexRef.current
    const section = chatSections[secIdx]
    if (!section) return
    const script = SCRIPTED_SECTIONS[section.id]
    if (!script) return

    // Merge formValuesRef + scriptTempValsRef for skipIf checks
    const allVals = { ...formValuesRef.current, ...scriptTempValsRef.current }
    let stepIdx = scriptStepIndexRef.current
    // Skip any steps whose skipIf condition is now met
    while (stepIdx < script.length && script[stepIdx].skipIf?.(allVals)) {
      stepIdx++
    }
    if (stepIdx >= script.length) {
      setCompletedSections(prev => new Set([...prev, secIdx]))
      advanceToSection(secIdx + 1)
      return
    }
    const step = script[stepIdx]
    const ctx = buildScriptCtx(allVals, invitation.property_address)
    const q = language === 'es' ? step.questionEs(ctx) : step.question(ctx)
    const opts = language === 'es' ? (step.optionsEs ?? step.options) : step.options
    setMessages(prev => [...prev, { role: 'assistant', content: q, options: opts }])
    setScriptStepIndex(stepIdx)
  }, [chatSections, advanceToSection, language, invitation.property_address])

  // ── Send a message (script mode or AI mode) ──────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text ?? input).trim()
    if (!msgText || loading || !currentSection) return

    // ── Handle property card confirmation ────────────────────────────────────
    const propertyData = pendingPropertyDataRef.current
    if (propertyData) {
      pendingPropertyDataRef.current = null
      const isConfirm = /right|correct|yes|sí|si|correcto/i.test(msgText) || msgText.includes('✓')
      setMessages(prev => prev.map(m => ({ ...m, options: undefined })))
      setMessages(prev => [...prev, { role: 'user', content: msgText }])
      setInput('')
      if (isConfirm) {
        if (propertyData.yearBuilt) {
          const age = new Date().getFullYear() - propertyData.yearBuilt
          const ageStr = String(age)
          // Write to BOTH onUpdate (form state) AND scriptTempValsRef so
          // resumeCurrentScript can see it immediately without waiting for
          // React to re-render and sync formValuesRef
          onUpdate('occ_property_age', ageStr)
          scriptTempValsRef.current = { ...scriptTempValsRef.current, occ_property_age: ageStr }
        }
        if (propertyData.hoa === 'yes') {
          onUpdate('tax_j', 'yes')
          onUpdate('tax_m', 'yes')
        } else if (propertyData.hoa === 'no') {
          onUpdate('tax_j', 'no')
          onUpdate('tax_m', 'no')
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: language === 'es' ? 'Guardado. Continuemos.' : 'Saved. Moving on.',
        }])
        // Resume the current scripted section after short delay
        setTimeout(() => resumeCurrentScript(), 600)
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: language === 'es' ? '¿Qué necesita corregir?' : 'What needs to be corrected?',
        }])
      }
      return
    }

    // ── Scripted section mode ────────────────────────────────────────────────
    const script = SCRIPTED_SECTIONS[currentSection.id]
    if (script) {
      setMessages(prev => prev.map(m => ({ ...m, options: undefined })))
      setMessages(prev => [...prev, { role: 'user', content: msgText }])
      setInput('')
      inputRef.current?.focus()

      // ── Address candidate pick ────────────────────────────────────────────
      if (awaitingAddressPickRef.current) {
        awaitingAddressPickRef.current = false
        const retypeOpts = ['None of these — let me retype', 'Ninguna — quiero escribirla']
        const isRetype = retypeOpts.some(r => msgText.toLowerCase().includes(r.toLowerCase().slice(0, 12)))
        if (isRetype) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: language === 'es'
              ? 'Escribe la dirección completa:'
              : 'Type the full address:',
          }])
          return
        }
        // User picked a candidate — store and advance to confirm step
        scriptTempValsRef.current = { ...scriptTempValsRef.current, _pending_address: msgText }
        const allVals = { ...formValuesRef.current, ...scriptTempValsRef.current }
        const nextIdx = findNextStep(script, scriptStepIndex, allVals)
        if (nextIdx >= script.length) {
          setCompletedSections(prev => new Set([...prev, sectionIndex]))
          setTimeout(() => advanceToSection(sectionIndex + 1), 600)
        } else {
          const nextStep = script[nextIdx]
          const ctx = buildScriptCtx(allVals, invitation.property_address)
          const q = language === 'es' ? nextStep.questionEs(ctx) : nextStep.question(ctx)
          const opts = language === 'es' ? (nextStep.optionsEs ?? nextStep.options) : nextStep.options
          setMessages(prev => [...prev, { role: 'assistant', content: q, options: opts }])
          setScriptStepIndex(nextIdx)
        }
        return
      }

      const allVals = getAllVals()

      let stepIdx = scriptStepIndex
      while (stepIdx < script.length && script[stepIdx].skipIf?.(allVals)) {
        stepIdx++
      }
      if (stepIdx >= script.length) {
        setCompletedSections(prev => new Set([...prev, sectionIndex]))
        advanceToSection(sectionIndex + 1)
        return
      }

      const step = script[stepIdx]

      // Store the raw answer in temp key first
      if (step.tempKey) {
        scriptTempValsRef.current = { ...scriptTempValsRef.current, [step.tempKey]: msgText }
      }

      // ── Normalize address via GPT before showing confirmation ─────────────
      if (step.id === 'property_address') {
        setLoading(true)
        try {
          const res = await fetch('/api/ai/normalize-address', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: msgText }),
          })
          const data = await res.json()
          const candidates: string[] = Array.isArray(data.candidates) ? data.candidates : []

          if (candidates.length > 1) {
            setLoading(false)
            awaitingAddressPickRef.current = true
            const retypeLabel = language === 'es'
              ? 'Ninguna — quiero escribirla'
              : 'None of these — let me retype'
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: language === 'es'
                ? 'Encontré varias coincidencias. ¿Cuál es la dirección correcta?'
                : 'I found a few possible matches — which is correct?',
              options: [...candidates, retypeLabel],
            }])
            return
          }

          // Single candidate — normalize and continue
          const normalized = candidates[0]?.trim() || msgText
          scriptTempValsRef.current = { ...scriptTempValsRef.current, _pending_address: normalized }
        } catch {
          scriptTempValsRef.current = { ...scriptTempValsRef.current, _pending_address: msgText }
        }
        setLoading(false)
      }

      // Collect field updates
      const combinedVals = { ...formValuesRef.current, ...scriptTempValsRef.current }
      const updates: Record<string, unknown> = {}
      if (step.fieldKey) {
        updates[step.fieldKey] = msgText
      }
      if (step.onAnswer) {
        const extra = step.onAnswer(msgText, combinedVals)
        Object.assign(updates, extra)
      }

      // Apply updates
      Object.entries(updates).forEach(([k, v]) => {
        if (k.startsWith('_')) {
          scriptTempValsRef.current = { ...scriptTempValsRef.current, [k]: v }
        } else {
          onUpdate(k, v)
        }
      })

      // Find next non-skipped step
      const updatedAllVals = { ...combinedVals, ...updates }
      const nextIdx = findNextStep(script, stepIdx, updatedAllVals)

      if (nextIdx >= script.length) {
        setCompletedSections(prev => new Set([...prev, sectionIndex]))
        setTimeout(() => advanceToSection(sectionIndex + 1), 600)
      } else {
        const nextStep = script[nextIdx]
        const latestVals = { ...formValuesRef.current, ...scriptTempValsRef.current, ...updates }
        const ctx = buildScriptCtx(latestVals, invitation.property_address)
        const q = language === 'es' ? nextStep.questionEs(ctx) : nextStep.question(ctx)
        const opts = language === 'es' ? (nextStep.optionsEs ?? nextStep.options) : nextStep.options
        setMessages(prev => [...prev, { role: 'assistant', content: q, options: opts }])
        setScriptStepIndex(nextIdx)
      }
      return
    }

    // ── AI mode ───────────────────────────────────────────────────────────────
    setMessages(prev => prev.map(m => ({ ...m, options: undefined })))
    const userMsg: ChatMessage = { role: 'user', content: msgText }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    inputRef.current?.focus()

    try {
      const newHistory = await new Promise<ChatMessage[]>(resolve => {
        setMessages(prev => { resolve(prev); return prev })
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
        setTimeout(() => advanceToSection(sectionIndex + 1), 800)
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
  }, [input, loading, currentSection, scriptStepIndex, sectionIndex, advanceToSection, onUpdate, language, callChat, getAllVals, invitation.property_address, resumeCurrentScript])

  const skipSection = () => {
    setCompletedSections(prev => new Set([...prev, sectionIndex]))
    advanceToSection(sectionIndex + 1)
  }

  const progress = chatSections.length > 0
    ? Math.round((completedSections.size / chatSections.length) * 100)
    : 0

  const sectionTitle = currentSection
    ? (SECTION_TITLES[currentSection.id]?.[language] ?? currentSection.title)
    : ''

  const lastAssistantIdx = messages.reduce(
    (last, msg, i) => (msg.role === 'assistant' ? i : last),
    -1,
  )

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
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

      {/* ── Progress bar ─────────────────────────────────────────────────────── */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Section pills ────────────────────────────────────────────────────── */}
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

      {/* ── Messages ─────────────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto py-5"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div className="max-w-2xl mx-auto px-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex items-end gap-2.5 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : msg.isPropertyCard
                        ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 text-gray-800 rounded-bl-sm'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/_(.*?)_/g, '<em>$1</em>')
                      .replace(/\n/g, '<br />'),
                  }}
                />
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                )}
              </div>

              {/* Quick-reply chips — only on the last assistant message */}
              {msg.role === 'assistant' &&
                i === lastAssistantIdx &&
                !loading &&
                msg.options &&
                msg.options.length > 0 && (
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

      {/* ── Input area ───────────────────────────────────────────────────────── */}
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
              placeholder={
                language === 'es' ? 'Escriba su respuesta...' : 'Type your answer...'
              }
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
