'use client'

interface FixtureStatusFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

const STATUS_CONFIG: Record<string, { label: string; description: string; activeClass: string }> = {
  OS: {
    label: 'OS',
    description: 'Owned by Seller',
    activeClass: 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-100',
  },
  EX: {
    label: 'EX',
    description: 'Excluded',
    activeClass: 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-100',
  },
  NA: {
    label: 'NA',
    description: 'Not Applicable',
    activeClass: 'bg-gray-400 text-white border-gray-400 shadow-sm',
  },
  NS: {
    label: 'NS',
    description: 'Not Sure',
    activeClass: 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-100',
  },
}

export default function FixtureStatusField({ label, value, onChange }: FixtureStatusFieldProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
      <label className="text-sm font-medium text-gray-700 flex-1">{label}</label>
      <div className="flex gap-1.5 shrink-0">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const isActive = value === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(isActive ? '' : key)}
              title={config.description}
              className={`
                w-10 h-9 rounded-lg border-2 text-xs font-bold transition-all
                ${isActive
                  ? config.activeClass
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              {config.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
