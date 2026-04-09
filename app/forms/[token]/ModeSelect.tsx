'use client'
import { MessageCircle, FileText } from 'lucide-react'

interface ModeSelectProps {
  formName: string
  sellerName?: string
  propertyAddress?: string
  language: 'en' | 'es'
  onLanguageChange: (lang: 'en' | 'es') => void
  onSelect: (mode: 'chat' | 'manual') => void
  chatAvailable: boolean
}

export default function ModeSelect({
  formName, sellerName, propertyAddress, language, onLanguageChange, onSelect, chatAvailable,
}: ModeSelectProps) {
  const firstName = sellerName ? sellerName.split(' ')[0] : ''
  const t = language === 'es'
    ? {
        greeting: firstName ? `Hola, ${firstName}!` : 'Bienvenido',
        subtitle: 'Elija cómo completar este formulario:',
        chatTitle: 'Asistente de IA',
        chatDesc: 'Responda preguntas conversacionales. El formulario se llena solo.',
        manualTitle: 'Llenado Manual',
        manualDesc: 'Complete el formulario usted mismo directamente en el PDF.',
        recommended: 'Recomendado',
        chatSoon: 'Próximamente',
      }
    : {
        greeting: firstName ? `Hi, ${firstName}!` : 'Welcome',
        subtitle: 'How would you like to fill out this form?',
        chatTitle: 'AI Assistant',
        chatDesc: 'Answer conversational questions. The form fills out automatically.',
        manualTitle: 'Fill it Myself',
        manualDesc: 'Fill out the form yourself directly on the PDF.',
        recommended: 'Recommended',
        chatSoon: 'Coming soon',
      }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex flex-col items-center justify-center p-4"
      style={{ colorScheme: 'light' }}
    >
      {/* Language toggle */}
      <div className="absolute top-4 right-4">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs shadow-sm">
          <button
            onClick={() => onLanguageChange('en')}
            className={`px-3 py-1.5 font-medium transition-colors ${language === 'en' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >EN</button>
          <button
            onClick={() => onLanguageChange('es')}
            className={`px-3 py-1.5 font-medium transition-colors ${language === 'es' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >ES</button>
        </div>
      </div>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{t.greeting}</h1>
          {propertyAddress && (
            <p className="text-sm text-gray-400 mb-2 truncate px-4">{propertyAddress}</p>
          )}
          <p className="text-sm font-medium text-gray-500">{formName}</p>
          <p className="text-gray-600 mt-3 text-sm">{t.subtitle}</p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {/* AI Chat */}
          <button
            onClick={() => chatAvailable && onSelect('chat')}
            disabled={!chatAvailable}
            className={`w-full bg-white rounded-2xl border-2 transition-all p-5 text-left group relative ${
              chatAvailable
                ? 'border-indigo-200 hover:border-indigo-400 hover:shadow-md cursor-pointer'
                : 'border-gray-100 opacity-60 cursor-not-allowed'
            }`}
          >
            <span className={`absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full ${
              chatAvailable ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {chatAvailable ? t.recommended : t.chatSoon}
            </span>
            <div className="flex items-start gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                chatAvailable ? 'bg-indigo-100 group-hover:bg-indigo-200' : 'bg-gray-100'
              }`}>
                <MessageCircle className={`w-6 h-6 ${chatAvailable ? 'text-indigo-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-base">{t.chatTitle}</p>
                <p className="text-sm text-gray-500 mt-1">{t.chatDesc}</p>
              </div>
            </div>
          </button>

          {/* Manual */}
          <button
            onClick={() => onSelect('manual')}
            className="w-full bg-white rounded-2xl border-2 border-gray-200 hover:border-gray-300 hover:shadow-md transition-all p-5 text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-gray-200 transition-colors">
                <FileText className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-base">{t.manualTitle}</p>
                <p className="text-sm text-gray-500 mt-1">{t.manualDesc}</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
