'use client'
import { useState, useEffect, useRef } from 'react'
import { SELLER_DISCLOSURE_FIELDS, SECTION_META } from '@/lib/forms/seller-disclosure/fields'
import { createClient } from '@supabase/supabase-js'
import {
  ChevronLeft, ChevronRight, Check, X, ZoomIn, ZoomOut, RotateCcw,
  Cpu, Upload, Trash2, Info
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TOTAL_PAGES = 8
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

interface FieldRect {
  x: number
  y: number
  width: number
  height: number
  page_num: number
}

export default function MapperPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [coordinates, setCoordinates] = useState<Record<string, FieldRect>>({})
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [sectionFilter, setSectionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'mapped' | 'unmapped'>('all')
  const [zoom, setZoom] = useState(1)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err' | 'info'>('ok')
  const [baking, setBaking] = useState(false)
  const [originalUploaded, setOriginalUploaded] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)

  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pageFields = SELLER_DISCLOSURE_FIELDS.filter(f => f.page === currentPage)
  const allSections = Array.from(new Set(SELLER_DISCLOSURE_FIELDS.map(f => f.section)))

  // ─── Load saved coordinates ───────────────────────────────────────────────
  useEffect(() => {
    loadCoords()
    checkOriginalPdf()
  }, [])

  async function loadCoords() {
    const { data } = await supabase.from('field_coordinates').select('*')
    if (data) {
      const map: Record<string, FieldRect> = {}
      data.forEach((row: { field_key: string; x: number; y: number; width: number; height: number; page_num: number }) => {
        map[row.field_key] = {
          x: row.x,
          y: row.y,
          width: row.width || 100,
          height: row.height || 16,
          page_num: row.page_num || 1,
        }
      })
      setCoordinates(map)
    }
  }

  async function checkOriginalPdf() {
    const res = await fetch('/api/forms/seller-disclosure/upload-original', { method: 'HEAD' }).catch(() => null)
    setOriginalUploaded(res?.ok === true)
  }

  // Auto-select first unmapped field when page changes
  useEffect(() => {
    setImgLoaded(false)
    const firstUnmapped = pageFields.find(f => !coordinates[f.key])
    if (firstUnmapped) setSelectedField(firstUnmapped.key)
    else if (pageFields.length > 0) setSelectedField(pageFields[0].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage])

  // ─── Coordinate math ──────────────────────────────────────────────────────
  function getImgBounds() {
    return imgRef.current?.getBoundingClientRect() ?? null
  }

  // pdf-lib uses bottom-left origin; screen images use top-left origin
  function screenToPdfRect(
    left: number, top: number, right: number, bottom: number,
    bounds: DOMRect
  ): { x: number; y: number; width: number; height: number } {
    const scaleX = PDF_W / bounds.width
    const scaleY = PDF_H / bounds.height
    return {
      x: left * scaleX,
      y: PDF_H - bottom * scaleY,   // bottom of drawn rect → pdf-lib y (bottom edge)
      width: (right - left) * scaleX,
      height: (bottom - top) * scaleY,
    }
  }

  function pdfToScreenRect(
    pdfX: number, pdfY: number, pdfWidth: number, pdfHeight: number
  ): { left: number; top: number; width: number; height: number } | null {
    if (!imgRef.current) return null
    const el = imgRef.current
    const scaleX = el.clientWidth / PDF_W
    const scaleY = el.clientHeight / PDF_H
    return {
      left: pdfX * scaleX,
      top: (PDF_H - pdfY - pdfHeight) * scaleY,
      width: pdfWidth * scaleX,
      height: pdfHeight * scaleY,
    }
  }

  // ─── Save field rectangle ─────────────────────────────────────────────────
  async function saveFieldRect(
    key: string,
    x: number, y: number,
    width: number, height: number
  ) {
    const { error } = await supabase.from('field_coordinates').upsert(
      {
        field_key: key,
        form_slug: 'seller-disclosure',
        page_num: currentPage,
        x, y, width, height,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'form_slug,field_key' }
    )

    if (!error) {
      setCoordinates(prev => ({ ...prev, [key]: { x, y, width, height, page_num: currentPage } }))
      showMsg(`✓ Saved ${key}`, 'ok')
      // Auto-advance to next unmapped field on this page
      const idx = pageFields.findIndex(f => f.key === key)
      const next = pageFields.slice(idx + 1).find(f => !coordinates[f.key])
      if (next) setSelectedField(next.key)
    } else {
      showMsg(`✗ ${error.message}`, 'err')
    }
  }

  async function resetField(key: string) {
    await supabase
      .from('field_coordinates')
      .delete()
      .eq('field_key', key)
      .eq('form_slug', 'seller-disclosure')
    setCoordinates(prev => { const n = { ...prev }; delete n[key]; return n })
    setSelectedField(key)
  }

  function showMsg(text: string, type: 'ok' | 'err' | 'info' = 'ok') {
    setMessage(text)
    setMessageType(type)
    if (type !== 'info') setTimeout(() => setMessage(''), 3000)
  }

  // ─── Mouse handlers for rectangle drawing ────────────────────────────────
  function getRelativePos(e: React.MouseEvent, bounds: DOMRect) {
    return {
      x: Math.max(0, Math.min(e.clientX - bounds.left, bounds.width)),
      y: Math.max(0, Math.min(e.clientY - bounds.top, bounds.height)),
    }
  }

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!selectedField || !imgLoaded) return
    const bounds = getImgBounds()
    if (!bounds) return
    e.preventDefault()
    const pos = getRelativePos(e, bounds)
    setIsDrawing(true)
    setDrawStart(pos)
    setDrawCurrent(pos)
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDrawing) return
    const bounds = getImgBounds()
    if (!bounds) return
    setDrawCurrent(getRelativePos(e, bounds))
  }

  async function onMouseUp() {
    if (!isDrawing || !drawStart || !drawCurrent || !selectedField) {
      setIsDrawing(false)
      return
    }
    const bounds = getImgBounds()
    if (!bounds) { setIsDrawing(false); return }

    const left = Math.min(drawStart.x, drawCurrent.x)
    const top = Math.min(drawStart.y, drawCurrent.y)
    const right = Math.max(drawStart.x, drawCurrent.x)
    const bottom = Math.max(drawStart.y, drawCurrent.y)

    if (right - left < 4 || bottom - top < 4) {
      setIsDrawing(false)
      setDrawStart(null)
      setDrawCurrent(null)
      return
    }

    const pdfRect = screenToPdfRect(left, top, right, bottom, bounds)
    await saveFieldRect(selectedField, pdfRect.x, pdfRect.y, pdfRect.width, pdfRect.height)

    setIsDrawing(false)
    setDrawStart(null)
    setDrawCurrent(null)
  }

  // ─── PDF upload ───────────────────────────────────────────────────────────
  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    showMsg('Uploading original PDF...', 'info')
    const formData = new FormData()
    formData.append('pdf', file)
    const res = await fetch('/api/forms/seller-disclosure/upload-original', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    if (data.success) {
      setOriginalUploaded(true)
      showMsg('✓ Original PDF uploaded', 'ok')
    } else {
      showMsg(`✗ ${data.error}`, 'err')
    }
    e.target.value = ''
  }

  // ─── Bake PDF ─────────────────────────────────────────────────────────────
  async function handleBake() {
    setBaking(true)
    showMsg('Baking AcroForm fields into PDF...', 'info')
    try {
      const res = await fetch('/api/forms/seller-disclosure/bake', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showMsg(`✓ ${data.message}`, 'ok')
      } else {
        showMsg(`✗ ${data.error}`, 'err')
      }
    } catch {
      showMsg('✗ Bake failed – check console', 'err')
    }
    setBaking(false)
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  const totalFields = SELLER_DISCLOSURE_FIELDS.length
  const mappedFields = Object.keys(coordinates).length
  const pageFieldCount = pageFields.length
  const pageMappedCount = pageFields.filter(f => coordinates[f.key]).length

  const filteredFields = pageFields.filter(f => {
    const matchSection = sectionFilter === 'all' || f.section === sectionFilter
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'mapped' && coordinates[f.key]) ||
      (statusFilter === 'unmapped' && !coordinates[f.key])
    return matchSection && matchStatus
  })

  // Live draw preview in screen space
  const drawPreview =
    isDrawing && drawStart && drawCurrent
      ? {
          left: Math.min(drawStart.x, drawCurrent.x),
          top: Math.min(drawStart.y, drawCurrent.y),
          width: Math.abs(drawCurrent.x - drawStart.x),
          height: Math.abs(drawCurrent.y - drawStart.y),
        }
      : null

  const selectedFieldDef = SELLER_DISCLOSURE_FIELDS.find(f => f.key === selectedField)

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* ── Sidebar ── */}
      <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">

        {/* Header / Stats */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-base font-bold text-white">PDF Field Mapper</h1>
            <span className="text-xs text-gray-400 font-mono">{mappedFields}/{totalFields}</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">Draw rectangles over each field on the PDF</p>

          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(mappedFields / totalFields) * 100}%` }}
            />
          </div>

          {/* Upload + Bake */}
          <div className="space-y-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all border ${
                originalUploaded
                  ? 'border-emerald-700 text-emerald-400 bg-emerald-950 hover:bg-emerald-900'
                  : 'border-amber-700 text-amber-300 bg-amber-950 hover:bg-amber-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              {originalUploaded ? '✓ Original PDF Uploaded' : 'Upload Original PDF'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />

            <button
              onClick={handleBake}
              disabled={baking || !originalUploaded || mappedFields === 0}
              className="w-full py-1.5 px-3 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Cpu className="w-3.5 h-3.5" />
              {baking ? 'Baking…' : `Bake PDF (${mappedFields} fields)`}
            </button>
          </div>

          {message && (
            <p className={`text-xs text-center mt-2 px-2 py-1 rounded-lg ${
              messageType === 'ok' ? 'text-emerald-300 bg-emerald-950' :
              messageType === 'err' ? 'text-red-300 bg-red-950' :
              'text-blue-300 bg-blue-950'
            }`}>
              {message}
            </p>
          )}
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
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full text-[8px] flex items-center justify-center font-bold">
                      {pMapped}
                    </span>
                  )}
                  {done && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center">
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
              <option key={s} value={s}>{SECTION_META[s]?.title || s}</option>
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
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredFields.map(field => {
            const mapped = !!coordinates[field.key]
            const isSelected = selectedField === field.key
            const color = FIELD_TYPE_COLORS[field.type] || '#6b7280'
            return (
              <button
                key={field.key}
                onClick={() => setSelectedField(field.key)}
                className={`w-full text-left px-3 py-2 rounded-xl border transition-all group ${
                  isSelected
                    ? 'bg-indigo-900 border-indigo-500 shadow-lg shadow-indigo-900/30'
                    : mapped
                    ? 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800'
                    : 'bg-gray-800/20 border-transparent hover:bg-gray-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: color + '33', color }}
                  >
                    {field.type === 'fixture_status' ? 'FIX' : field.type.slice(0, 3).toUpperCase()}
                  </span>
                  <span className={`text-xs flex-1 truncate ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                    {field.label}
                  </span>
                  {mapped ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <button
                        onClick={e => { e.stopPropagation(); resetField(field.key) }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
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
            <div className="text-center text-gray-600 text-xs py-8">No fields match filters</div>
          )}
        </div>

        {/* Selected Field Hint */}
        {selectedFieldDef && (
          <div className="p-3 border-t border-gray-800">
            <div className="bg-indigo-950 border border-indigo-800 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="w-3 h-3 text-indigo-400" />
                <p className="text-xs font-bold text-indigo-300">Click & drag to place</p>
              </div>
              <p className="text-xs text-white font-medium truncate">{selectedFieldDef.label}</p>
              <p className="text-[10px] text-indigo-400 font-mono mt-0.5">{selectedFieldDef.key}</p>
              {coordinates[selectedField!] && (
                <p className="text-[10px] text-emerald-400 mt-1">
                  ✓ x:{Math.round(coordinates[selectedField!].x)} y:{Math.round(coordinates[selectedField!].y)}{' '}
                  w:{Math.round(coordinates[selectedField!].width)} h:{Math.round(coordinates[selectedField!].height)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── PDF Viewer ── */}
      <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold">Page {currentPage} / {TOTAL_PAGES}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(TOTAL_PAGES, p + 1))}
              disabled={currentPage === TOTAL_PAGES}
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.15))} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2.5, z + 0.15))} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => setZoom(1)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 ml-1">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs">
            {Object.entries(FIELD_TYPE_COLORS).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1 text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm border" style={{ backgroundColor: color + '44', borderColor: color }} />
                {type === 'fixture_status' ? 'fixture' : type}
              </span>
            ))}
          </div>
        </div>

        {/* PDF + Overlay */}
        <div className="flex-1 overflow-auto flex items-start justify-center p-6">
          <div
            className="relative inline-block"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          >
            {/* PDF Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={`/pdf-pages/seller-disclosure/page-${currentPage}.png`}
              alt={`Page ${currentPage}`}
              onLoad={() => setImgLoaded(true)}
              className="block shadow-2xl select-none"
              style={{ maxWidth: '700px', width: '100%' }}
              draggable={false}
            />

            {/* Interactive overlay (captures mouse events) */}
            {imgLoaded && (
              <div
                className={`absolute inset-0 ${selectedField ? 'cursor-crosshair' : 'cursor-default'}`}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              >
                {/* Live draw preview */}
                {drawPreview && (
                  <div
                    className="absolute border-2 border-dashed border-white bg-white/10 pointer-events-none"
                    style={{
                      left: drawPreview.left,
                      top: drawPreview.top,
                      width: drawPreview.width,
                      height: drawPreview.height,
                    }}
                  />
                )}

                {/* Saved field rectangles for this page */}
                {pageFields
                  .filter(f => coordinates[f.key] && coordinates[f.key].page_num === currentPage)
                  .map(field => {
                    const coord = coordinates[field.key]
                    const screen = pdfToScreenRect(coord.x, coord.y, coord.width, coord.height)
                    if (!screen) return null
                    const color = FIELD_TYPE_COLORS[field.type] || '#6b7280'
                    const isSelected = field.key === selectedField
                    return (
                      <div
                        key={field.key}
                        onClick={e => { e.stopPropagation(); setSelectedField(field.key) }}
                        className={`absolute border-2 cursor-pointer transition-all group ${isSelected ? 'z-20' : 'z-10'}`}
                        style={{
                          left: screen.left,
                          top: screen.top,
                          width: Math.max(screen.width, 4),
                          height: Math.max(screen.height, 4),
                          borderColor: isSelected ? '#fff' : color,
                          backgroundColor: color + (isSelected ? '40' : '1a'),
                        }}
                        title={field.label}
                      >
                        {/* Field key label inside rect */}
                        <span
                          className="absolute top-0 left-0 text-[7px] font-bold px-0.5 leading-tight truncate max-w-full pointer-events-none"
                          style={{
                            color: isSelected ? '#fff' : color,
                            backgroundColor: 'rgba(0,0,0,0.65)',
                          }}
                        >
                          {field.key.split('_').slice(-2).join('_')}
                        </span>

                        {/* Delete button on hover */}
                        <button
                          className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30"
                          onClick={e => { e.stopPropagation(); resetField(field.key) }}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
