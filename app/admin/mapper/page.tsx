'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { SELLER_DISCLOSURE_FIELDS } from '@/lib/forms/seller-disclosure/fields'
import { ArrowLeft, CheckCircle, MapPin, Save, RotateCcw } from 'lucide-react'
import Link from 'next/link'

// PDF dimensions in points (1 page, letter size)
const PDF_WIDTH = 612
const PDF_HEIGHT = 792

// Image dimensions at 150 DPI
const IMG_WIDTH = 1275
const IMG_HEIGHT = 1650

interface SavedCoord {
  field_key: string
  x: number
  y: number
  page_num: number
  width?: number
  height?: number
  font_size?: number
}

const SECTION_COLORS: Record<string, string> = {
  seller_property: '#6366f1',
  occupancy: '#8b5cf6',
  construction: '#ec4899',
  land: '#f59e0b',
  roof: '#ef4444',
  plumbing: '#3b82f6',
  hvac: '#14b8a6',
  electrical: '#f97316',
  tax_hoa: '#84cc16',
  utilities: '#06b6d4',
  electronics: '#a855f7',
  fixtures: '#10b981',
  final: '#6b7280',
  signatures: '#1d4ed8',
}

export default function MapperPage() {
  const [activeField, setActiveField] = useState<string | null>(null)
  const [coordinates, setCoordinates] = useState<Record<string, SavedCoord>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const imgRef = useRef<HTMLImageElement>(null)

  // Load existing coordinates
  useEffect(() => {
    fetch('/api/mapper/coordinates?form_slug=seller-disclosure')
      .then(r => r.json())
      .then(data => {
        const map: Record<string, SavedCoord> = {}
        for (const c of data.coordinates || []) map[c.field_key] = c
        setCoordinates(map)
      })
  }, [])

  const handleImageClick = useCallback(async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!activeField || !imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    // Convert display coords → PDF point coords
    const xPdf = clickX * (PDF_WIDTH / rect.width)
    const yPdf = (rect.height - clickY) * (PDF_HEIGHT / rect.height)

    setSaving(activeField)
    try {
      const field = SELLER_DISCLOSURE_FIELDS.find(f => f.key === activeField)
      const res = await fetch('/api/mapper/coordinates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_slug: 'seller-disclosure',
          field_key: activeField,
          page_num: 1,
          x: Math.round(xPdf * 10) / 10,
          y: Math.round(yPdf * 10) / 10,
          width: field?.width,
          height: field?.height,
          font_size: field?.fontSize,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setCoordinates(prev => ({ ...prev, [activeField]: data.coordinate }))
        setSavedMsg(true)
        setTimeout(() => setSavedMsg(false), 1500)
        // Auto-advance to next unmapped field
        const fields = SELLER_DISCLOSURE_FIELDS
        const idx = fields.findIndex(f => f.key === activeField)
        const next = fields.slice(idx + 1).find(f => !coordinates[f.key])
        if (next) setActiveField(next.key)
      }
    } finally {
      setSaving(null)
    }
  }, [activeField, coordinates])

  const resetField = async (fieldKey: string) => {
    await fetch('/api/mapper/coordinates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_slug: 'seller-disclosure',
        field_key: fieldKey,
        page_num: 1,
        x: 0, y: 0,
      }),
    })
    setCoordinates(prev => {
      const next = { ...prev }
      delete next[fieldKey]
      return next
    })
  }

  const sections = [...new Set(SELLER_DISCLOSURE_FIELDS.map(f => f.section || 'other'))]
  const filteredFields = filter === 'all'
    ? SELLER_DISCLOSURE_FIELDS
    : filter === 'unmapped'
    ? SELLER_DISCLOSURE_FIELDS.filter(f => !coordinates[f.key] || (coordinates[f.key].x === 0 && coordinates[f.key].y === 0))
    : SELLER_DISCLOSURE_FIELDS.filter(f => f.section === filter)

  const mapped = SELLER_DISCLOSURE_FIELDS.filter(f => coordinates[f.key] && (coordinates[f.key].x !== 0 || coordinates[f.key].y !== 0))
  const total = SELLER_DISCLOSURE_FIELDS.length
  const progress = Math.round((mapped.length / total) * 100)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
          <div className="w-px h-5 bg-gray-700" />
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-sm">PDF Field Mapper</span>
            <span className="text-gray-500 text-xs">— Seller Disclosure Addendum</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {savedMsg && (
            <span className="text-green-400 text-sm flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <div className="text-sm text-gray-400">
            <span className="text-white font-bold">{mapped.length}</span>/{total} fields mapped
          </div>
          <div className="w-32 bg-gray-800 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-indigo-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{progress}%</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — field list */}
        <aside className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">
          {/* Filter tabs */}
          <div className="px-3 pt-3 pb-2 space-y-2 border-b border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium px-1">Fields</p>
            <div className="flex gap-1 flex-wrap">
              {['all', 'unmapped'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                    filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {f === 'all' ? `All (${total})` : `Unmapped (${total - mapped.length})`}
                </button>
              ))}
              {sections.map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                    filter === s ? 'text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                  style={filter === s ? { backgroundColor: SECTION_COLORS[s] || '#6366f1' } : {}}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Field list */}
          <div className="flex-1 overflow-y-auto py-2">
            {filteredFields.map(field => {
              const coord = coordinates[field.key]
              const isMapped = coord && (coord.x !== 0 || coord.y !== 0)
              const isActive = activeField === field.key
              const color = SECTION_COLORS[field.section || 'other'] || '#6366f1'

              return (
                <div
                  key={field.key}
                  onClick={() => setActiveField(isActive ? null : field.key)}
                  className={`mx-2 mb-1 rounded-lg px-3 py-2 cursor-pointer transition-all ${
                    isActive
                      ? 'ring-2 ring-indigo-500 bg-indigo-950'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className="mt-0.5 w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: isMapped ? color : '#374151' }}
                      />
                      <div className="min-w-0">
                        <p className={`text-xs font-medium leading-tight ${isActive ? 'text-white' : 'text-gray-300'}`}>
                          {field.label}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">{field.type}</p>
                        {isMapped && (
                          <p className="text-xs text-gray-500 mt-0.5 font-mono">
                            ({coord.x.toFixed(0)}, {coord.y.toFixed(0)})
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isMapped && (
                        <button
                          onClick={(e) => { e.stopPropagation(); resetField(field.key) }}
                          title="Reset position"
                          className="text-gray-600 hover:text-red-400 p-0.5"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                      {saving === field.key && (
                        <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      )}
                      {isMapped && saving !== field.key && (
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* Main — PDF canvas */}
        <main className="flex-1 overflow-auto bg-gray-950 flex flex-col items-center py-8 px-6">
          {activeField ? (
            <div className="mb-4 bg-indigo-900/50 border border-indigo-700 rounded-xl px-5 py-3 flex items-center gap-3 max-w-2xl w-full">
              <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-indigo-200">
                  Click on the PDF to place: <span className="text-white">{SELLER_DISCLOSURE_FIELDS.find(f => f.key === activeField)?.label}</span>
                </p>
                <p className="text-xs text-indigo-400 mt-0.5">Type: {SELLER_DISCLOSURE_FIELDS.find(f => f.key === activeField)?.type}</p>
              </div>
              <button onClick={() => setActiveField(null)} className="ml-auto text-indigo-400 hover:text-white text-xs">Cancel</button>
            </div>
          ) : (
            <div className="mb-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 flex items-center gap-3 max-w-2xl w-full">
              <Save className="w-4 h-4 text-gray-500 shrink-0" />
              <p className="text-sm text-gray-400">
                Select a field from the sidebar, then click its position on the PDF below.
              </p>
            </div>
          )}

          {/* PDF Image with dots */}
          <div className="relative inline-block shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src="/templates/seller-disclosure/page-1.png"
              alt="Seller Disclosure PDF"
              className={`max-w-2xl w-full block ${activeField ? 'cursor-crosshair' : 'cursor-default'}`}
              onClick={handleImageClick}
              style={{ maxWidth: '800px' }}
            />

            {/* Overlaid dots for placed fields */}
            {SELLER_DISCLOSURE_FIELDS.map(field => {
              const coord = coordinates[field.key]
              if (!coord || (coord.x === 0 && coord.y === 0)) return null
              const color = SECTION_COLORS[field.section || 'other'] || '#6366f1'
              const isActive = activeField === field.key

              return (
                <FieldDot
                  key={field.key}
                  field={field}
                  coord={coord}
                  color={color}
                  isActive={isActive}
                  imgRef={imgRef}
                />
              )
            })}
          </div>

          <p className="text-xs text-gray-600 mt-4">
            PDF dimensions: {PDF_WIDTH} × {PDF_HEIGHT} pts · Image: {IMG_WIDTH} × {IMG_HEIGHT} px · 150 DPI
          </p>
        </main>
      </div>
    </div>
  )
}

function FieldDot({ field, coord, color, isActive, imgRef }: {
  field: { key: string; label: string }
  coord: SavedCoord
  color: string
  isActive: boolean
  imgRef: React.RefObject<HTMLImageElement>
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    const update = () => {
      if (!imgRef.current) return
      const rect = imgRef.current.getBoundingClientRect()
      const containerRect = imgRef.current.parentElement?.getBoundingClientRect()
      if (!containerRect) return
      const left = coord.x * (rect.width / PDF_WIDTH) + (rect.left - containerRect.left)
      const top = (PDF_HEIGHT - coord.y) * (rect.height / PDF_HEIGHT) + (rect.top - containerRect.top)
      setPos({ left, top })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [coord, imgRef])

  if (!pos) return null

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
    >
      <div
        title={field.label}
        className={`rounded-full flex items-center justify-center text-white font-bold transition-all ${isActive ? 'w-5 h-5 ring-2 ring-white' : 'w-3 h-3'}`}
        style={{ backgroundColor: color }}
      />
    </div>
  )
}
