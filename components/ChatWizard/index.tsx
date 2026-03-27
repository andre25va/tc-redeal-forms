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
  multiSelect?: boolean
}

interface PropertyData {
  yearBuilt: number | null
  propertyType: string | null
  hoa: 'yes' | 'no' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
  estimated?: boolean
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
  const [multiSelectItems, setMultiSelectItems] = useState<Set<string>>(new Set())

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initializedRef = useRef(false)
  const pendingPropertyDataRef = useRef<PropertyData | null>(null)
  const afterPropertyCardRef = useRef<(() => void) | null>(null)
  const scriptTempValsRef = useRef<Record<string, unknown>>({})
  const formValuesRef = useRef(formValues)
  const awaitingAddressPickRef = useRef(false)
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
    valsSnapshot?: Record<string, unknown>,
  ) => {
    const allVals = valsSnapshot ?? getAllVals()
    const firstIdx = findNextStep(script, -1, allVals)
    if (firstIdx >= script.length) return false
    const step = script[firstIdx]
    const ctx = buildScriptCtx(allVals, invitation.property_address)
    const q = language === 'es' ? step.questionEs(ctx) : step.question(ctx)
    const opts = language === 'es' ? (step.optionsEs ?? step.options) : step.options
    const msg: ChatMessage = {
      role: 'assistant',
      content: q,
      options: opts,
      multiSelect: step.multiSelect,
    }
    if (append) {
      setMessages(prev => [...prev, msg])
    } else {
      setMessages([msg])
    }
    setScriptStepIndex(firstIdx)
    setMultiSelectItems(new Set())
    return true
  }, [getAllVals, getCtx, language, invitation.property_address])

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

  const triggerPropertyLookup = useCallback(async (
    address: string,
    onDone: () => void,
  ) => {
    afterPropertyCardRef.current = onDone
    try {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: language === 'es'
          ? '🔍 Buscando información de la propiedad...'
          : '🔍 Looking up property details...',
      }])
      const res = await fetch('/api/ai/property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const data: PropertyData = await res.json()
      if (!res.ok || (data as { error?: string }).error) {
        // Lookup failed — show friendly message then continue
        setMessages(prev => [
          ...prev.slice(0, -1),
          {
            role: 'assistant',
            content: language === 'es'
              ? "No pude encontrar datos automáticos para esta propiedad. Te haré algunas preguntas."
              : "I couldn't find property data automatically. I'll ask you a few questions instead.",
          },
        ])
        afterPropertyCardRef.current = null
        setTimeout(() => onDone(), 1200)
        return
      }

      const items: string[] = []
      if (data.yearBuilt) {
        const age = new Date().getFullYear() - data.yearBuilt
        const estimateNote = data.estimated ? ' (estimated)' : ''
        items.push(`🏗️ Built: **${data.yearBuilt}**${estimateNote} (~${age} yrs old)`)
      }
      if (data.propertyType) items.push(`🏠 Type: **${data.propertyType}**`)
      if (data.hoa !== 'unknown') items.push(`🏘️ HOA: **${data.hoa === 'yes' ? 'Yes' : 'No'}**`)

      if (items.length === 0) {
        // No useful data — show friendly message then continue
        setMessages(prev => [
          ...prev.slice(0, -1),
          {
            role: 'assistant',
            content: language === 'es'
              ? "No encontré datos específicos para esta dirección. Te preguntaré los detalles."
              : "I couldn't find specific data for this address. I'll ask you the details.",
          },
        ])
        afterPropertyCardRef.current = null
        setTimeout(() => onDone(), 1200)
        return
      }

      const confidenceNote = data.confidence === 'low' || data.estimated
        ? (language === 'es'
          ? '\n\n_Esta es una estimación — confirme o corrija por favor._'
          : '\n\n_This is an estimate — please confirm or correct._')
        : ''

      const msg = language === 'es'
        ? `Encontré información sobre esta propiedad:\n\n${items.join('\n')}${confidenceNote}\n\n¿Esto se ve correcto?`
        : `I found some info about this property:\n\n${items.join('\n')}${confidenceNote}\n\nDoes this look right?`

      pendingPropertyDataRef.current = data
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: msg,
          options: language === 'es'
            ? ['Sí, correcto ✓', 'Algo está mal']
            : ["Yes, that's right ✓", "Something's off"],
          isPropertyCard: true,
        },
      ])
    } catch {
      // Network error — show friendly message then continue
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: language === 'es'
            ? "No pude conectarme para buscar datos. Continuemos."
            : "Couldn't connect for property data. Let's continue.",
        },
      ])
      afterPropertyCardRef.current = null
      setTimeout(() => onDone(), 1200)
    }
  }, [language])

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
    setMultiSelectItems(new Set())

    const script = SCRIPTED_SECTIONS[nextSection.id]
    if (script) {
      const valsSnapshot = {
        ...formValuesRef.current,
        ...scriptTempValsRef.current,
      }
      setTimeout(() => initScriptedSection(script, true, valsSnapshot), 300)
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

  const resumeCurrentScript = useCallback(() => {
    const secIdx = sectionIndexRef.current
    const section = chatSections[secIdx]
    if (!section) return
    const script = SCRIPTED_SECTIONS[section.id]
    if (!script) return

    const allVals = { ...formValuesRef.current, ...scriptTempValsRef.current }
    let stepIdx = scriptStepIndexRef.current
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
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: q,
      options: opts,
      multiSelect: step.multiSelect,
    }])
    setScriptStepIndex(stepIdx)
    setMultiSelectItems(new Set())
  }, [chatSections, advanceToSection, language, invitation.property_address])

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
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: language === 'es' ? '¿Qué necesita corregir?' : 'What needs to be corrected?',
        }])
      }
      const callback = afterPropertyCardRef.current ?? resumeCurrentScript
      afterPropertyCardRef.current = null
      setTimeout(() => callback(), 600)
      return
    }

    // ── Scripted section mode ────────────────────────────────────────────────
    const script = SCRIPTED_SECTIONS[currentSection.id]
    if (script) {
      setMessages(prev => prev.map(m => ({ ...m, options: undefined })))
      setMessages(prev => [...prev, { role: 'user', content: msgText }])
      setInput('')
      setMultiSelectItems(new Set())
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
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: q,
            options: opts,
            multiSelect: nextStep.multiSelect,
          }])
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

          const normalized = candidates[0]?.trim() || msgText
          scriptTempValsRef.current = { ...scriptTempValsRef.current, _pending_address: normalized }
        } catch {
          scriptTempValsRef.current = { ...scriptTempValsRef.current, _pending_address: msgText }
        }
        setLoading(false)
      }

      const combinedVals = { ...formValuesRef.current, ...scriptTempValsRef.current }
      const updates: Record<string, unknown> = {}
      if (step.fieldKey) {
        updates[step.fieldKey] = msgText
      }
      if (step.onAnswer) {
        const extra = step.onAnswer(msgText, combinedVals)
        Object.assign(updates, extra)
      }

      Object.entries(updates).forEach(([k, v]) => {
        if (k.startsWith('_')) {
          scriptTempValsRef.current = { ...scriptTempValsRef.current, [k]: v }
        } else {
          onUpdate(k, v)
        }
      })

      const updatedAllVals = { ...combinedVals, ...updates }
      const nextIdx = findNextStep(script, stepIdx, updatedAllVals)

      if (nextIdx >= script.length) {
        setCompletedSections(prev => new Set([...prev, sectionIndex]))
        if (currentSection.id === 'header') {
          const address =
            (updates['property_address'] as string) ||
            (updatedAllVals['property_address'] as string) ||
            ''
          if (address) {
            triggerPropertyLookup(address, () => advanceToSection(sectionIndex + 1))
          } else {
            setTimeout(() => advanceToSection(sectionIndex + 1), 600)
          }
        } else {
          setTimeout(() => advanceToSection(sectionIndex + 1), 600)
        }
      } else {
        const nextStep = script[nextIdx]
        const latestVals = { ...formValuesRef.current, ...scriptTempValsRef.current, ...updates }
        const ctx = buildScriptCtx(latestVals, invitation.property_address)
        const q = language === 'es' ? nextStep.questionEs(ctx) : nextStep.question(ctx)
        const opts = language === 'es' ? (nextStep.optionsEs ?? nextStep.options) : nextStep.options
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: q,
          options: opts,
          multiSelect: nextStep.multiSelect,
        }])
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
  }, [input, loading, currentSection, scriptStepIndex, sectionIndex, advanceToSection, onUpdate, language, callChat, getAllVals, invitation.property_address, resumeCurrentScript, triggerPropertyLookup])

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

              {/* Quick-reply chips / multi-select — only on the last assistant message */}
              {msg.role === 'assistant' &&
                i === lastAssistantIdx &&
                !loading &&
                msg.options &&
                msg.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 ml-10">
                    {msg.options.map((opt, oi) => {
                      if (msg.multiSelect) {
                        const isSelected = multiSelectItems.has(opt)
                        return (
                          <button
                            key={oi}
                            onClick={() => setMultiSelectItems(prev => {
                              const next = new Set(prev)
                              if (next.has(opt)) next.delete(opt)
                              else next.add(opt)
                              return next
                            })}
                            className={`px-3 py-2 border-2 rounded-xl text-sm font-medium active:scale-95 transition-all shadow-sm ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400'
                            }`}
                          >
                            {isSelected ? '✓ ' : ''}{opt}
                          </button>
                        )
                      }
                      return (
                        <button
                          key={oi}
                          onClick={() => sendMessage(opt)}
                          disabled={loading}
                          className="px-4 py-2 bg-white border-2 border-indigo-200 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-50 hover:border-indigo-400 active:scale-95 transition-all shadow-sm disabled:opacity-40"
                        >
                          {opt}
                        </button>
                      )
                    })}

                    {msg.multiSelect && (
                      <div className="w-full flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            const selected = Array.from(multiSelectItems)
                            const text = selected.length > 0 ? selected.join(', ') : 'None of these'
                            sendMessage(text)
                          }}
                          disabled={loading}
                          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 shadow-sm"
                        >
                          {multiSelectItems.size > 0
                            ? `Continue (${multiSelectItems.size} selected) →`
                            : 'Continue →'}
                        </button>
                        <button
                          onClick={() => sendMessage('None of these')}
                          disabled={loading}
                          className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 active:scale-[0.98] transition-all disabled:opacity-40"
                        >
                          None
                        </button>
                      </div>
                    )}
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
