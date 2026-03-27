'use client'
import { useState } from 'react'
import { FormSection } from '@/types'
import { Language } from '@/lib/i18n/translations'
import FormWizard from '@/components/FormWizard'
import ChatWizard from '@/components/ChatWizard'
import { Bot, ClipboardList, Globe } from 'lucide-react'

interface FormModeSelectorProps {
  sections: FormSection[]
  token: string
  initialData?: Record<string, unknown>
  invitation: {
    seller_name?: string
    property_address?: string
    seller_email: string
  }
  isDemo?: boolean
}

type Mode = 'chat' | 'manual' | null

export default function FormModeSelector({
  sections,
  token,
  initialData = {},
  invitation,
  isDemo,
}: FormModeSelectorProps) {
  const [mode, setMode] = useState<Mode>(null)
  const [language, setLanguage] = useState<Language>('en')
  const [formValues, setFormValues] = useState<Record<string, unknown>>(initialData)

  const updateField = (key: string, value: unknown) => {
    setFormValues(prev => ({ ...prev, [key]: value }))
  }

  const handleChatComplete = () => setMode('manual')

  if (!mode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Language toggle */}
          <div className="flex justify-end mb-5">
            <button
              onClick={() => setLanguage(l => l === 'en' ? 'es' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-white border border-gray-200 bg-white/70 transition-colors shadow-sm"
            >
              <Globe className="w-3.5 h-3.5" />
              {language === 'en' ? 'Español' : 'English'}
            </button>
          </div>

          {/* Header */}
          <div className="text-center mb-7">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
              <ClipboardList className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2 leading-snug">
              {language === 'en' ? 'Seller Disclosure Addendum' : 'Declaración del Vendedor'}
            </h1>
            {invitation.property_address && (
              <p className="text-sm text-gray-500 px-2">{invitation.property_address}</p>
            )}
            {invitation.seller_name && (
              <p className="text-sm font-medium text-gray-700 mt-1">{invitation.seller_name}</p>
            )}
          </div>

          <p className="text-center text-sm text-gray-500 mb-4 font-medium">
            {language === 'en' ? 'How would you like to fill out this form?' : '¿Cómo desea completar este formulario?'}
          </p>

          <div className="grid gap-3">
            {/* AI Chat mode */}
            <button
              onClick={() => setMode('chat')}
              className="group text-left bg-white rounded-2xl border-2 border-indigo-100 hover:border-indigo-400 p-4 transition-all shadow-sm hover:shadow-md hover:shadow-indigo-100 active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="font-bold text-gray-900 text-sm">
                      {language === 'en' ? 'AI Assistant' : 'Asistente con IA'}
                    </h2>
                    <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                      {language === 'en' ? 'Recommended' : 'Recomendado'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {language === 'en'
                      ? 'Answer questions in a simple conversation. The AI guides you and fills the form for you.'
                      : 'Responde preguntas en una conversación. La IA te guía y completa el formulario por ti.'}
                  </p>
                  <div className="mt-2 flex gap-1.5 flex-wrap">
                    {(language === 'en'
                      ? ['✅ Easiest', '🌐 EN & ES', '⚡ Fast']
                      : ['✅ Más fácil', '🌐 EN & ES', '⚡ Rápido']
                    ).map(tag => (
                      <span key={tag} className="text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5 border border-gray-100">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>

            {/* Manual mode */}
            <button
              onClick={() => setMode('manual')}
              className="group text-left bg-white rounded-2xl border-2 border-gray-100 hover:border-gray-300 p-4 transition-all shadow-sm hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition-colors">
                  <ClipboardList className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-gray-900 mb-1 text-sm">
                    {language === 'en' ? 'Fill Out Manually' : 'Llenar Manualmente'}
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {language === 'en'
                      ? 'Go through each section yourself at your own pace.'
                      : 'Completa cada sección tú mismo a tu propio ritmo.'}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'chat') {
    return (
      <ChatWizard
        sections={sections}
        token={token}
        formValues={formValues}
        onUpdate={updateField}
        onComplete={handleChatComplete}
        invitation={invitation}
        language={language}
        onLanguageChange={setLanguage}
      />
    )
  }

  return (
    <FormWizard
      sections={sections}
      token={token}
      initialData={formValues}
      invitation={invitation}
      isDemo={isDemo}
      initialLanguage={language}
      onLanguageChange={setLanguage}
    />
  )
}
