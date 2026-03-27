'use client'
import { cn } from '@/lib/utils'

interface ChoiceFieldProps {
  label: string
  value: string
  onChange: (val: string) => void
  choices: string[]
  required?: boolean
}

const choiceLabels: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  na: 'N/A',
  OS: 'OS - Owned by Seller',
  EX: 'EX - Excluded',
  NA: 'NA - Not Applicable',
  NS: 'NS - Not Sure',
}

export default function ChoiceField({ label, value, onChange, choices, required }: ChoiceFieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {choices.map(choice => (
          <button
            key={choice}
            type="button"
            onClick={() => onChange(choice)}
            className={cn(
              'px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all',
              value === choice
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
            )}
          >
            {choiceLabels[choice] || choice}
          </button>
        ))}
      </div>
    </div>
  )
}
