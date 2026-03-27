'use client'
import { cn } from '@/lib/utils'

interface FixtureStatusFieldProps {
  label: string
  value: string
  onChange: (val: string) => void
}

const statuses = [
  { code: 'OS', label: 'OS', desc: 'Owned by Seller' },
  { code: 'EX', label: 'EX', desc: 'Excluded' },
  { code: 'NA', label: 'NA', desc: 'Not Applicable' },
  { code: 'NS', label: 'NS', desc: 'Not Sure' },
]

export default function FixtureStatusField({ label, value, onChange }: FixtureStatusFieldProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      <div className="flex gap-1.5 ml-4">
        {statuses.map(s => (
          <button
            key={s.code}
            type="button"
            title={s.desc}
            onClick={() => onChange(s.code)}
            className={cn(
              'w-10 h-8 rounded-md border-2 font-bold text-xs transition-all',
              value === s.code
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-brand-400'
            )}
          >
            {s.code}
          </button>
        ))}
      </div>
    </div>
  )
}
