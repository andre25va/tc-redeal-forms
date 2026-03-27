'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { SELLER_DISCLOSURE_FIELDS, SECTION_META } from '@/lib/forms/seller-disclosure/fields'
import { PdfField } from '@/types'
import { createClient } from '@supabase/supabase-js'
import { ChevronLeft, ChevronRight, Check, X, Target, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TOTAL_PAGES = 8
// PDF dimensions in points
const PDF_W = 612
const PDF_H = 792

const FIELD_TYPE_COLORS: Record<string, string> = {
  text:           '#3b82f6',
  textarea:       '#8b5cf6',
  choice:         '#10b981',
  checkbox:       '#f59e0b',
  fixture_status: '#ef4444',
  date:           '#06b6d4',
  signature:      '#ec4899',
}

export default function MapperPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [coordinates, setCoordinates] = useState<Record<string, { x: number; y: number }>>({})
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'mapped' | 'unmapped'>('all')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [zoom, setZoom] = useState(1)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const pageFields = SELLER_DISCLOSURE_FIELDS.filter(f => f.page === currentPage)
  const allSections = Array.from(new Set(SELLER_DISCLOSURE_FIELDS.map(f => f.section)))

  // Load saved coordinates from Supabase
  useEffect(() => {
    async function loadCoords() {
      const { data } = await supabase
        .from('field_coordinates')
        .select('field_key, x, y')
      if (data) {
        const map: Record<string, { x: number; y: number }> = {}
        data.forEach((row: { field_key: string; x: number; y: number }) => {
          map[row.field_key] = { x: row.x, y: row.y }
        })
        setCoordinates(map)
      }
    }
    loadCoords()
  }, [])

  // Auto-select first unmapped field on page when switching pages
  useEffect(() => {
    const firstUnmapped = pageFields.find(f => !coordinates[f.key])
    if (firstUnmapped) setSelectedField(firstUnmapped.key)
    else if (pageFields.length > 0) setSelectedField(pageFields[0].key)
  }, [currentPage]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveCoordinate = useCallback(async (key: string, x: number, y: number) => {
    setSaving(true)
    const { error } = await supabase
      .from('field_coordinates')
      .upsert({ field_key: key, x, y, form_slug: 'seller-disclosure' }, { onConflict: 'field_key' })

    if (!error) {
      setCoordinates(prev => ({ ...prev, [key]: { x, y } }))
      setMessage(`✓ Saved ${key}`)
      setTimeout(() => setMessage(''), 2000)
    } else {
      setMessage(`✗ Error: ${error.message}`)
    }
    setSaving(false)
  }, [])

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!selectedField || !imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    const scaleX = PDF_W / rect.width
    const scaleY = PDF_H / rect.height
    const x = Math.round((e.clientX - rect.left) * scaleX)
    const y = Math.round((e.clientY - rect.top) * scaleY)
    saveCoordinate(selectedField, x, y)

    // Auto-advance to next unmapped field on same page
    const currentIndex = pageFields.findIndex(f => f.key === selectedField)
    const nextField = pageFields.slice(currentIndex + 1).find(f => !coordinates[f.key])
    if (nextField) setSelectedField(nextField.key)
  }, [selectedField, pageFields, coordinates, saveCoordinate])

  const resetField = async (key: string) => {
    await supabase.from('field_coordinates').delete().eq('field_key', key)
    setCoordinates(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setSelectedField(key)
  }

  // Stats
  const totalFields = SELLER_DISCLOSURE_FIELDS.length
  const mappedFields = Object.keys(coordinates).length
  const pageFieldCount = pageFields.length
  const pageMappedCount = pageFields.filter(f => coordinates[f.key]).length

  // Filtered fields for sidebar
  const filteredFields = pageFields.filter(f => {
    const matchSection = sectionFilter === 'all' || f.section === sectionFilter
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'mapped' && coordinates[f.key]) ||
      (statusFilter === 'unmapped' && !coordinates[f.key])
    return matchSection && matchStatus
  })

  // Overlay dots: only show current page's mapped fields
  const overlayDots = pageFields.filter(f => coordinates[f.key])

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-base font-bold text-white mb-1">PDF Field Mapper</h1>
          <p className="text-xs text-gray-400">Seller Disclosure Addendum</p>
          <div className="mt-3 bg-gray-800 rounded-lg p-2.5">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Overall Progress</span>
              <span className="font-mono">{mappedFields}/{totalFields}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(mappedFields / totalFields) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Page Navigation */}
        <div className="p-3 border-b border-gray-800">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Page</p>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).map(p => {
              const pFields = SELLER_DISCLOSURE_FIELDS.filter(f => f.page === p)
              const pMapped = pFields.filter(f => coordinates[f.key]).length
              const done = pMapped === pFields.length && pFields.length > 0
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`relative py-1.5 rounded-lg text-xs font-bold transition-all ${
                    p === currentPage
                      ? 'bg-indigo-600 text-white'
                      : done
                      ? 'bg-emerald-900 text-emerald-300 border border-emerald-700'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  P{p}
                  {pMapped > 0 && !done && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full text-[8px] flex items-center justify-center font-bold">
                      {pMapped}
                    </span>
                  )}
                  {done && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Check className="w-2 h-2 text-white" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Page {currentPage}: {pageMappedCount}/{pageFieldCount} mapped
          </p>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-gray-800 space-y-2">
          <select
            value={sectionFilter}
            onChange={e => setSectionFilter(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 px-2 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Sections</option>
            {allSections.map(s => (
              <option key={s} value={s}>
                {SECTION_META[s]?.title || s}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {(['all', 'unmapped', 'mapped'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`flex-1 py-1 rounded-lg text-xs font-medium transition-all capitalize ${
                  statusFilter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Field List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredFields.map(field => {
            const mapped = !!coordinates[field.key]
            const isSelected = selectedField === field.key
            const color = FIELD_TYPE_COLORS[field.type] || '#6b7280'
            return (
              <button
                key={field.key}
                onClick={() => setSelectedField(field.key)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all group ${
                  isSelected
                    ? 'bg-indigo-900 border-indigo-500 shadow-lg shadow-indigo-900/50'
                    : mapped
                    ? 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'
                    : 'bg-gray-800/30 border-transparent hover:bg-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: color + '33', color }}>
                    {field.type === 'fixture_status' ? 'FIX' : field.type.slice(0, 3).toUpperCase()}
                  </span>
                  <span className={`text-xs flex-1 truncate font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    {field.label}
                  </span>
                  {mapped ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-mono text-emerald-400">
                        {coordinates[field.key].x},{coordinates[field.key].y}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); resetField(field.key) }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />
                  )}
                </div>
              </button>
            )
          })}
          {filteredFields.length === 0 && (
            <div className="text-center text-gray-500 text-xs py-8">No fields match filters</div>
          )}
        </div>

        {/* Selected Field Info */}
        {selectedField && (
          <div className="p-3 border-t border-gray-800 bg-gray-900">
            <div className="bg-indigo-950 rounded-xl p-3 border border-indigo-800">
              <p className="text-xs font-bold text-indigo-300 mb-0.5 flex items-center gap-1">
                <Target className="w-3 h-3" /> Click PDF to place
              </p>
              <p className="text-xs text-white font-medium truncate">
                {SELLER_DISCLOSURE_FIELDS.find(f => f.key === selectedField)?.label}
              </p>
              <p className="text-[10px] text-indigo-400 font-mono mt-0.5">{selectedField}</p>
              {coordinates[selectedField] && (
                <p className="text-[10px] text-emerald-400 mt-1">
                  ✓ Mapped at ({coordinates[selectedField].x}, {coordinates[selectedField].y})
                </p>
              )}
            </div>
            {saving && <p className="text-xs text-amber-400 text-center mt-2">Saving...</p>}
            {message && <p className="text-xs text-emerald-400 text-center mt-2">{message}</p>}
          </div>
        )}
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-white">Page {currentPage} / {TOTAL_PAGES}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(TOTAL_PAGES, p + 1))}
              disabled={currentPage === TOTAL_PAGES}
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-400 font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => setZoom(1)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 ml-1">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {Object.entries(FIELD_TYPE_COLORS).slice(0, 4).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1 text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {type === 'fixture_status' ? 'fixture' : type}
              </span>
            ))}
          </div>
        </div>

        {/* PDF Image + Overlay */}
        <div ref={containerRef} className="flex-1 overflow-auto flex items-start justify-center p-6">
          <div className="relative inline-block" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={`/pdf-pages/seller-disclosure/page-${currentPage}.png`}
              alt={`Page ${currentPage}`}
              onClick={handleImageClick}
              className="block shadow-2xl cursor-crosshair"
              style={{ maxWidth: '700px', width: '100%' }}
              draggable={false}
            />

            {/* Coordinate dots */}
            {overlayDots.map(field => {
              const coord = coordinates[field.key]
              if (!coord || !imgRef.current) return null
              const imgEl = imgRef.current
              const scaleX = imgEl.clientWidth / PDF_W
              const scaleY = imgEl.clientHeight / PDF_H
              const left = coord.x * scaleX
              const top = coord.y * scaleY
              const color = FIELD_TYPE_COLORS[field.type] || '#6b7280'
              const isSelected = field.key === selectedField
              return (
                <button
                  key={field.key}
                  onClick={e => { e.stopPropagation(); setSelectedField(field.key) }}
                  className="absolute group"
                  style={{ left: left - 6, top: top - 6, zIndex: isSelected ? 20 : 10 }}
                  title={field.label}
                >
                  <div
                    className={`w-3 h-3 rounded-full border-2 transition-all ${
                      isSelected ? 'scale-150 border-white shadow-lg' : 'border-white/60 hover:scale-125'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                  {isSelected && (
                    <div className="absolute left-5 top-0 bg-gray-900 text-white text-[10px] font-mono px-2 py-1 rounded-lg whitespace-nowrap shadow-xl border border-gray-700 z-30">
                      {field.key}<br />
                      <span className="text-emerald-400">{coord.x}, {coord.y}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
