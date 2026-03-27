'use client'
import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { FormSection } from '@/types'
import { Language, UI } from '@/lib/i18n/translations'
import { MessageSquare, ClipboardList, Globe, Bot, FileText } from 'lucide-react'

const FormWizard = dynamic(() => import('@/components/FormWizard'), { ssr: false })
const ChatWizard = dynamic(() => import('@/components/ChatWizard'), { ssr: false })

interface FormClientProps {
  sections: FormSection[]
  token: string
  initialData: Record<string, unknown>
  invitation: { seller_name?: string; property_address?: string; seller_email: string }
  isDemo?: boolean
}

type Mode = 'select' | 'chat' | 'form'

export default function FormClient({
  sections,
  token,
  initialData,
  invitation,
  isDemo,
}: FormClientProps) {
  const [mode, setMode] = useState<Mode>('select')
  const [language, setLanguage] = useState<Language>('en')
  // Shared form values — chat fills these, then form wizard starts with them
  const [chatValues, setChatValues] = useState<Record<string, unknown>>(initialData || {})

  const handleChatUpdate = useCallback((key: string, value: unknown) => {
    setChatValues(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleChatComplete = useCallback(() => {
    // Switch to form review with chat-filled values pre-populated
    setMode('form')
  }, [])

  // ── Mode selection screen ───────────────────────────────────────────────
  if (mode === 'select') {
    const t = UI[language]
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">

          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white rounded-2xl px-4 py-2 shadow-sm border border-gray-100 mb-6">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-700">MyRedeal TC Forms</span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {language === 'es' ? 'Declaración del Vendedor' : "Seller's Disclosure Form"}
            </h1>
            {invitation.property_address && (
              <p className="text-gray-500 text-sm">
                {invitation.property_address}
              </p>
            )}
            {invitation.seller_name && (
              <p className="text-gray-400 text-sm mt-0.5">
                {language === 'es' ? 'Para' : 'For'} {invitation.seller_name}
              </p>
            )}
          </div>

          {/* Mode cards */}
          <p className="text-center text-sm font-medium text-gray-500 mb-4">
            {language === 'es' ? '¿Cómo prefiere completar este formulario?' : 'How would you like to fill out this form?'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

            {/* Chat Mode */}
            <button
              onClick={() => setMode('chat')}
              className="group bg-white rounded-2xl border-2 border-indigo-200 hover:border-indigo-500 p-6 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1.5">
                {language === 'es' ? '💬 Asistente AI' : '💬 AI Assistant'}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {language === 'es'
                  ? 'Responda preguntas en conversación natural. El asistente llena el formulario por usted.'
                  : 'Answer questions in a natural conversation. The assistant fills the form for you.'}
              </p>
              <div className="mt-4 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-medium px-2.5 py-1 rounded-full">
                  <MessageSquare className="w-3 h-3" />
                  {language === 'es' ? 'Recomendado' : 'Recommended'}
                </span>
              </div>
            </button>

            {/* Standard Form */}
            <button
              onClick={() => setMode('form')}
              className="group bg-white rounded-2xl border-2 border-gray-200 hover:border-gray-400 p-6 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1.5">
                {language === 'es' ? '📝 Llenar yo mismo' : '📝 Fill it myself'}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {language === 'es'
                  ? 'Use el formulario estándar paso a paso con todas las secciones.'
                  : 'Use the standard step-by-step form with all sections.'}
              </p>
              <div className="mt-4 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-medium px-2.5 py-1 rounded-full">
                  {language === 'es' ? '~370 campos' : '~370 fields'}
                </span>
              </div>
            </button>
          </div>

          {/* Language toggle */}
          <div className="flex items-center justify-center gap-3">
            <Globe className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">{t.languageLabel}:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => setLanguage('en')}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  language === 'en'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  language === 'es'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                Español
              </button>
            </div>
          </div>

        </div>
      </div>
    )
  }

  // ── Chat mode ────────────────────────────────────────────────────────────
  if (mode === 'chat') {
    return (
      <ChatWizard
        sections={sections}
        token={token}
        formValues={chatValues}
        onUpdate={handleChatUpdate}
        onComplete={handleChatComplete}
        invitation={invitation}
        language={language}
        onLanguageChange={setLanguage}
      />
    )
  }

  // ── Standard form (or post-chat review) ─────────────────────────────────
  return (
    <FormWizard
      sections={sections}
      token={token}
      initialData={chatValues}
      invitation={invitation}
      isDemo={isDemo}
      initialLanguage={language}
      onLanguageChange={setLanguage}
    />
  )
}
