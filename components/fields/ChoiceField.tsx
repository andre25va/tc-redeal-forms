'use client'

interface ChoiceFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  choices: string[]
}

const CHOICE_CONFIG: Record<string, { label: string; activeClass: string; emoji: string }> = {
  yes: { label: 'Yes', activeClass: 'bg-green-500 text-white border-green-500 shadow-md shadow-green-100', emoji: '✓' },
  no: { label: 'No', activeClass: 'bg-red-400 text-white border-red-400 shadow-md shadow-red-100', emoji: '✗' },
  na: { label: 'N/A', activeClass: 'bg-gray-400 text-white border-gray-400 shadow-sm', emoji: '' },
}

export default function ChoiceField({ label, value, onChange, choices }: ChoiceFieldProps) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {choices.map(choice => {
          const config = CHOICE_CONFIG[choice.toLowerCase()] || {
            label: choice.toUpperCase(),
            activeClass: 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100',
            emoji: '',
          }
          const isActive = value === choice
          return (
            <button
              key={choice}
              type="button"
              onClick={() => onChange(isActive ? '' : choice)}
              className={`
                flex items-center gap-1.5 px-5 py-2 rounded-xl border-2 text-sm font-semibold transition-all
                ${isActive
                  ? config.activeClass
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              {config.emoji && <span className="text-base leading-none">{config.emoji}</span>}
              {config.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
