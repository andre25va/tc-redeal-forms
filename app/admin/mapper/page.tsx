'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { SELLER_DISCLOSURE_FIELDS, SECTION_META } from '@/lib/forms/seller-disclosure/fields'
import { createClient } from '@supabase/supabase-js'
import {
  ChevronLeft, ChevronRight, Check, X, ZoomIn, ZoomOut, RotateCcw,
  Cpu, Upload, Trash2, Info, FileText, Plus, AlertCircle
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── pdf.js CDN loader ──────────────────────────────────────────────────────
const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'
const PDF_WORKER_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPdfJs(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any
  if (win.pdfjsLib) return win.pdfjsLib
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = PDFJS_CDN
    script.onload = () => {
      win.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_CDN
      resolve(win.pdfjsLib)
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// ─── Form Registry ──────────────────────────────────────────────────────────
const FORMS = {
  'seller-disclosure': {
    label: 'Seller Disclosure Addendum',
    shortLabel: 'Seller Disclosure',
    totalPages: 8,
    pdfPath: '/library/seller-disclosure-blank.pdf',
    predefinedFields: true,
  },
  'residential-sale-contract': {
    label: 'Residential Sale Contract',
    shortLabel: 'Sale Contract',
    totalPages: 16,
    pdfPath: '/library/residential-sale-contract-blank.pdf',
    predefinedFields: false,
  },
}

type FormSlug = keyof typeof FORMS

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
  initials:       '#f97316',
}

const FIELD_TYPES = ['text', 'textarea', 'choice', 'checkbox', 'date', 'signature', 'initials', 'fixture_status']

interface FieldRect {
  x: number
  y: number
  width: number
  height: number
  page_num: number
  field_type?: string
  is_signature?: boolean
  is_initial?: boolean
  required?: boolean
}

interface FreeformField {
  field_key: string
  label: string
  type: string
  page: number
  is_signature: boolean
  is_initial: boolean
  required: boolean
}

interface DrawModalProps {
  onSave: (name: string, type: string, isSignature: boolean, isInitial: boolean, required: boolean) => void
  onCancel: () => void
  pageNum: number
}

function DrawModal({ onSave, onCancel, pageNum }: DrawModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState('text')
  const [isSig, setIsSig] = useState(false)
  const [isInit, setIsInit] = useState(false)
  const [req, setReq] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (type === 'signature') { setIsSig(true); setIsInit(false) }
    else if (type === 'initials') { setIsInit(true); setIsSig(false) }
    else { setIsSig(false); setIsInit(false) }
  }, [type])

  function handleSave() {
    const key = name.trim().replace(/\s+/g, '_').toLowerCase()
    if (!key) return
    onSave(key, type, isSig, isInit, req)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-96 shadow-2xl">
        <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-400" />
          Name this field <span className="text-xs text-gray-500 font-normal ml-1">(Page {pageNum})</span>
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Field Key (snake_case)</label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. buyer_signature_1"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Field Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              {FIELD_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" checked={isSig} onChange={e => setIsSig(e.target.checked)} className="rounded" />
              Is Signature
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" checked={isInit} onChange={e => setIsInit(e.target.checked)} className="rounded" />
              Is Initials
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" checked={req} onChange={e => setReq(e.target.checked)} className="rounded" />
              Required
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-sm font-semibold text-white transition-all"
          >
            Save Field
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MapperPage() {
  const [formSlug, setFormSlug] = useState<FormSlug>('seller-disclosure')
  const formConfig = FORMS[formSlug]

  const [currentPage, setCurrentPage] = useState(1)
  const [coordinates, setCoordinates] = useState<Record<string, FieldRect>>({})
  const [freeformFields, setFreeformFields] = useState<FreeformField[]>([])
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [sectionFilter, setSectionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'mapped' | 'unmapped'>('all')
  const [zoom, setZoom] = useState(1)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err' | 'info'>('ok')
  const [baking, setBaking] = useState(false)
  const [originalUploaded, setOriginalUploaded] = useState(false)
  const [pageReady, setPageReady] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFieldIds, setShowFieldIds] = useState(true)

  // pdf.js state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null)

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)
  const [pendingRect, setPendingRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [showDrawModal, setShowDrawModal] = useState(false)

  const isDrawingRef = useRef(false)
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const selectedFieldRef = useRef<string | null>(null)
  const formConfigRef = useRef(formConfig)
  const currentPageRef = useRef(currentPage)

  useEffect(() => { selectedFieldRef.current = selectedField }, [selectedField])
  useEffect(() => { formConfigRef.current = formConfig }, [formConfig])
  useEffect(() => { currentPageRef.current = currentPage }, [currentPage])

  const sellerFields = SELLER_DISCLOSURE_FIELDS
  const pageSellerFields = sellerFields.filter(f => f.page === currentPage)
  const allSections = Array.from(new Set(sellerFields.map(f => f.section)))

  const effectiveFreeformFields: FreeformField[] = freeformFields.length > 0
    ? freeformFields
    : Object.entries(coordinates).map(([key, coord]) => ({
        field_key: key,
        label: key.replace(/_/g, ' '),
        type: coord.field_type || 'text',
        page: coord.page_num,
        is_signature: !!coord.is_signature,
        is_initial: !!coord.is_initial,
        required: !!coord.required,
      }))

  const pageFreeformFields = effectiveFreeformFields.filter(f => f.page === currentPage)
  const currentPageFields = formConfig.predefinedFields ? pageSellerFields : pageFreeformFields

  // ─── Load PDF ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setPdfDoc(null)
    setPageReady(false)

    ;(async () => {
      try {
        const pdfjsLib = await loadPdfJs()
        const res = await fetch(formConfig.pdfPath)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const arrayBuffer = await res.arrayBuffer()
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        if (!cancelled) setPdfDoc(doc)
      } catch (err) {
        console.error('PDF load error', err)
      }
    })()

    return () => { cancelled = true }
  }, [formConfig.pdfPath])

  // ─── Render page onto canvas ─────────────────────────────────────────────
  const renderPage = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !pdfDoc) return
    try {
      setRendering(true)
      setPageReady(false)
      const page = await pdfDoc.getPage(currentPage)
      const containerWidth = canvasContainerRef.current?.clientWidth ?? 700
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = Math.min((containerWidth - 64) / baseViewport.width, 2.0)
      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: scale * dpr })
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width / dpr}px`
      canvas.style.height = `${viewport.height / dpr}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      setPageReady(true)
    } catch (err) {
      console.error('Page render error', err)
    } finally {
      setRendering(false)
    }
  }, [pdfDoc, currentPage])

  useEffect(() => { renderPage() }, [renderPage])

  // ─── Load saved data ─────────────────────────────────────────────────────
  const loadCoords = useCallback(async () => {
    setLoading(true)
    setDbError(null)

    const { data, error } = await supabase
      .from('field_coordinates')
      .select('*')
      .eq('form_slug', formSlug)

    setLoading(false)

    if (error) {
      setDbError(`DB error: ${error.message}`)
      return
    }

    if (!data || data.length === 0) {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setDbError('NEXT_PUBLIC_SUPABASE_URL is not set — add it in Vercel env vars')
      } else if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setDbError('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set — add it in Vercel env vars')
      }
      return
    }

    const map: Record<string, FieldRect> = {}
    data.forEach((row: { field_key: string; x: number; y: number; width: number; height: number; page_num: number; field_type?: string; is_signature?: boolean; is_initial?: boolean; required?: boolean }) => {
      map[row.field_key] = {
        x: row.x, y: row.y,
        width: row.width || 100,
        height: row.height || 16,
        page_num: row.page_num || 1,
        field_type: row.field_type,
        is_signature: row.is_signature,
        is_initial: row.is_initial,
        required: row.required,
      }
    })
    setCoordinates(map)

    if (!formConfig.predefinedFields) {
      const ff: FreeformField[] = data.map((row: { field_key: string; field_type?: string; page_num: number; is_signature?: boolean; is_initial?: boolean; required?: boolean }) => ({
        field_key: row.field_key,
        label: row.field_key.replace(/_/g, ' '),
        type: row.field_type || 'text',
        page: row.page_num,
        is_signature: !!row.is_signature,
        is_initial: !!row.is_initial,
        required: !!row.required,
      }))
      setFreeformFields(ff)
    }
  }, [formSlug, formConfig.predefinedFields])

  useEffect(() => {
    setCurrentPage(1)
    setSelectedField(null)
    setCoordinates({})
    setFreeformFields([])
    setDbError(null)
    loadCoords()
    checkOriginalPdf()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formSlug])

  async function checkOriginalPdf() {
    const res = await fetch(`/api/forms/${formSlug}/upload-original`, { method: 'HEAD' }).catch(() => null)
    setOriginalUploaded(res?.ok === true)
  }

  useEffect(() => {
    setPageReady(false)
    if (formConfig.predefinedFields) {
      const firstUnmapped = pageSellerFields.find(f => !coordinates[f.key])
      if (firstUnmapped) setSelectedField(firstUnmapped.key)
      else if (pageSellerFields.length > 0) setSelectedField(pageSellerFields[0].key)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, formSlug])

  // ─── Coordinate helpers ──────────────────────────────────────────────────
  function getCanvasBounds() {
    return canvasRef.current?.getBoundingClientRect() ?? null
  }

  function pdfToScreenRect(pdfX: number, pdfY: number, pdfWidth: number, pdfHeight: number) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const bounds = canvas.getBoundingClientRect()
    const scaleX = bounds.width / PDF_W
    const scaleY = bounds.height / PDF_H
    return {
      left: pdfX * scaleX,
      top: (PDF_H - pdfY - pdfHeight) * scaleY,
      width: pdfWidth * scaleX,
      height: pdfHeight * scaleY,
    }
  }

  function getPosRelativeToCanvas(clientX: number, clientY: number): { x: number; y: number } | null {
    const bounds = getCanvasBounds()
    if (!bounds) return null
    return {
      x: Math.max(0, Math.min(clientX - bounds.left, bounds.width)),
      y: Math.max(0, Math.min(clientY - bounds.top, bounds.height)),
    }
  }

  async function saveFieldRect(
    key: string,
    x: number, y: number, width: number, height: number,
    opts?: { type?: string; isSignature?: boolean; isInitial?: boolean; required?: boolean }
  ) {
    const pg = currentPageRef.current
    const slug = formConfigRef.current === FORMS['seller-disclosure'] ? 'seller-disclosure' : 'residential-sale-contract'
    const { error } = await supabase.from('field_coordinates').upsert(
      {
        field_key: key,
        form_slug: slug,
        page_num: pg,
        x, y, width, height,
        field_type: opts?.type,
        is_signature: opts?.isSignature ?? false,
        is_initial: opts?.isInitial ?? false,
        required: opts?.required ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'form_slug,field_key' }
    )

    if (!error) {
      setCoordinates(prev => ({ ...prev, [key]: { x, y, width, height, page_num: pg, field_type: opts?.type, is_signature: opts?.isSignature, is_initial: opts?.isInitial, required: opts?.required } }))
      showMsg(`✓ Saved ${key}`, 'ok')

      if (formConfigRef.current.predefinedFields) {
        const pFields = SELLER_DISCLOSURE_FIELDS.filter(f => f.page === pg)
        const idx = pFields.findIndex(f => f.key === key)
        const nextField = pFields[idx + 1]
        if (nextField) setSelectedField(nextField.key)
      }
    } else {
      showMsg(`✗ ${error.message}`, 'err')
    }
  }

  async function resetField(key: string) {
    await supabase
      .from('field_coordinates')
      .delete()
      .eq('field_key', key)
      .eq('form_slug', formSlug)
    setCoordinates(prev => { const n = { ...prev }; delete n[key]; return n })
    setFreeformFields(prev => prev.filter(f => f.field_key !== key))
    if (selectedField === key) setSelectedField(null)
  }

  function showMsg(text: string, type: 'ok' | 'err' | 'info' = 'ok') {
    setMessage(text)
    setMessageType(type)
    if (type !== 'info') setTimeout(() => setMessage(''), 3000)
  }

  // ─── Drawing — document-level events ────────────────────────────────────
  function onOverlayMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!pageReady) return
    if (formConfig.predefinedFields && !selectedField) return
    e.preventDefault()

    const pos = getPosRelativeToCanvas(e.clientX, e.clientY)
    if (!pos) return

    isDrawingRef.current = true
    drawStartRef.current = pos
    setIsDrawing(true)
    setDrawStart(pos)
    setDrawCurrent(pos)
  }

  useEffect(() => {
    function onDocMouseMove(e: MouseEvent) {
      if (!isDrawingRef.current) return
      const pos = getPosRelativeToCanvas(e.clientX, e.clientY)
      if (pos) setDrawCurrent(pos)
    }

    async function onDocMouseUp(e: MouseEvent) {
      if (!isDrawingRef.current) return
      isDrawingRef.current = false

      const start = drawStartRef.current
      const pos = getPosRelativeToCanvas(e.clientX, e.clientY)

      setIsDrawing(false)
      setDrawStart(null)
      setDrawCurrent(null)
      drawStartRef.current = null

      if (!start || !pos) return

      const left   = Math.min(start.x, pos.x)
      const top    = Math.min(start.y, pos.y)
      const right  = Math.max(start.x, pos.x)
      const bottom = Math.max(start.y, pos.y)

      if (right - left < 4 || bottom - top < 4) return

      const bounds = getCanvasBounds()
      if (!bounds) return

      const pdfRect = {
        x: left * (PDF_W / bounds.width),
        y: PDF_H - bottom * (PDF_H / bounds.height),
        width:  (right - left)  * (PDF_W / bounds.width),
        height: (bottom - top)  * (PDF_H / bounds.height),
      }

      const cfg = formConfigRef.current
      const selField = selectedFieldRef.current

      if (cfg.predefinedFields && selField) {
        await saveFieldRect(selField, pdfRect.x, pdfRect.y, pdfRect.width, pdfRect.height)
      } else if (!cfg.predefinedFields) {
        pendingRectRef.current = pdfRect
        setPendingRect(pdfRect)
        setShowDrawModal(true)
      }
    }

    document.addEventListener('mousemove', onDocMouseMove)
    document.addEventListener('mouseup', onDocMouseUp)
    return () => {
      document.removeEventListener('mousemove', onDocMouseMove)
      document.removeEventListener('mouseup', onDocMouseUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageReady])

  async function handleModalSave(name: string, type: string, isSignature: boolean, isInitial: boolean, required: boolean) {
    const rect = pendingRectRef.current || pendingRect
    if (!rect) return
    setShowDrawModal(false)
    const newField: FreeformField = {
      field_key: name,
      label: name.replace(/_/g, ' '),
      type,
      page: currentPageRef.current,
      is_signature: isSignature,
      is_initial: isInitial,
      required,
    }
    setFreeformFields(prev => [...prev.filter(f => f.field_key !== name), newField])
    await saveFieldRect(name, rect.x, rect.y, rect.width, rect.height, { type, isSignature, isInitial, required })
    setPendingRect(null)
    pendingRectRef.current = null
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    showMsg('Uploading original PDF...', 'info')
    const formData = new FormData()
    formData.append('pdf', file)
    const res = await fetch(`/api/forms/${formSlug}/upload-original`, { method: 'POST', body: formData })
    const data = await res.json()
    if (data.success) { setOriginalUploaded(true); showMsg('✓ Original PDF uploaded', 'ok') }
    else showMsg(`✗ ${data.error}`, 'err')
    e.target.value = ''
  }

  async function handleBake() {
    setBaking(true)
    showMsg('Baking AcroForm fields into PDF...', 'info')
    try {
      const res = await fetch(`/api/forms/${formSlug}/bake`, { method: 'POST' })
      const data = await res.json()
      if (data.success) showMsg(`✓ ${data.message}`, 'ok')
      else showMsg(`✗ ${data.error}`, 'err')
    } catch { showMsg('✗ Bake failed – check console', 'err') }
    setBaking(false)
  }

  const totalFieldsSeller = sellerFields.length
  const mappedCount = Object.keys(coordinates).length
  const totalForProgress = formConfig.predefinedFields ? totalFieldsSeller : Math.max(mappedCount, 1)

  const filteredFields = formConfig.predefinedFields
    ? pageSellerFields.filter(f => {
        const matchSection = sectionFilter === 'all' || f.section === sectionFilter
        const matchStatus =
          statusFilter === 'all' ||
          (statusFilter === 'mapped' && coordinates[f.key]) ||
          (statusFilter === 'unmapped' && !coordinates[f.key])
        return matchSection && matchStatus
      })
    : pageFreeformFields

  const drawPreview = isDrawing && drawStart && drawCurrent
    ? {
        left: Math.min(drawStart.x, drawCurrent.x),
        top: Math.min(drawStart.y, drawCurrent.y),
        width: Math.abs(drawCurrent.x - drawStart.x),
        height: Math.abs(drawCurrent.y - drawStart.y),
      }
    : null

  const selectedFieldDef = formConfig.predefinedFields
    ? sellerFields.find(f => f.key === selectedField)
    : effectiveFreeformFields.find(f => f.field_key === selectedField)

  const overlayFields: { key: string; type: string }[] = formConfig.predefinedFields
    ? pageSellerFields.filter(f => coordinates[f.key]).map(f => ({ key: f.key, type: f.type }))
    : Object.entries(coordinates)
        .filter(([, coord]) => coord.page_num === currentPage)
        .map(([key, coord]) => ({ key, type: coord.field_type || 'text' }))

  const canDraw = pageReady && (!formConfig.predefinedFields || !!selectedField)

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {showDrawModal && (
        <DrawModal
          pageNum={currentPage}
          onSave={handleModalSave}
          onCancel={() => { setShowDrawModal(false); setPendingRect(null); pendingRectRef.current = null }}
        />
      )}

      {/* ── Sidebar ── */}
      <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">

        {/* Form Selector */}
        <div className="p-4 border-b border-gray-800">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5 block">Form</label>
          <div className="flex flex-col gap-1.5">
            {(Object.entries(FORMS) as [FormSlug, typeof FORMS[FormSlug]][]).map(([slug, cfg]) => (
              <button
                key={slug}
                onClick={() => setFormSlug(slug)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-medium border transition-all ${
                  formSlug === slug
                    ? 'bg-indigo-900 border-indigo-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750 hover:text-gray-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{cfg.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Header / Stats */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-base font-bold text-white">PDF Field Mapper</h1>
            <span className="text-xs text-gray-400 font-mono">
              {loading ? '…' : mappedCount}{formConfig.predefinedFields ? `/${totalFieldsSeller}` : ' fields'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {formConfig.predefinedFields
              ? selectedField
                ? '👆 Click a field below, then drag on the PDF'
                : '← Select a field from the list, then drag'
              : '✏️ Drag anywhere on the PDF to draw a field'}
          </p>

          {dbError && (
            <div className="flex items-start gap-2 bg-red-950 border border-red-800 rounded-xl p-2.5 mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300 leading-snug">{dbError}</p>
            </div>
          )}

          {formConfig.predefinedFields && (
            <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(mappedCount / totalForProgress) * 100}%` }}
              />
            </div>
          )}

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
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />

            <button
              onClick={handleBake}
              disabled={baking || !originalUploaded || mappedCount === 0}
              className="w-full py-1.5 px-3 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Cpu className="w-3.5 h-3.5" />
              {baking ? 'Baking…' : `Bake PDF (${mappedCount} fields)`}
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
            {Array.from({ length: formConfig.totalPages }, (_, i) => i + 1).map(p => {
              const pFields = formConfig.predefinedFields
                ? sellerFields.filter(f => f.page === p)
                : effectiveFreeformFields.filter(f => f.page === p)
              const pMapped = formConfig.predefinedFields
                ? pFields.filter(f => coordinates[(f as typeof sellerFields[0]).key]).length
                : pFields.filter(f => coordinates[(f as FreeformField).field_key]).length
              const done = formConfig.predefinedFields && pMapped === pFields.length && pFields.length > 0
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`relative py-1.5 rounded-lg text-xs font-bold transition-all ${
                    p === currentPage
                      ? 'bg-indigo-600 text-white'
                      : done
                      ? 'bg-emerald-900 text-emerald-300 border border-emerald-700'
                      : pMapped > 0
                      ? 'bg-gray-700 text-gray-200'
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
            Page {currentPage}: {currentPageFields.filter(f => coordinates[formConfig.predefinedFields ? (f as typeof sellerFields[0]).key : (f as FreeformField).field_key]).length}/{currentPageFields.length} mapped
          </p>
        </div>

        {/* Filters (predefined only) */}
        {formConfig.predefinedFields && (
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
                    statusFilter === f ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Field List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading && (
            <div className="text-center text-gray-500 text-xs py-6">Loading fields…</div>
          )}
          {!loading && filteredFields.length === 0 && !dbError && (
            <div className="text-center text-gray-600 text-xs py-8 whitespace-pre-line">
              {formConfig.predefinedFields
                ? 'No fields match filters'
                : 'No fields mapped on this page yet.\nDrag on the PDF to draw a field.'}
            </div>
          )}
          {filteredFields.map(field => {
            const key = formConfig.predefinedFields ? (field as typeof sellerFields[0]).key : (field as FreeformField).field_key
            const label = formConfig.predefinedFields ? (field as typeof sellerFields[0]).label : (field as FreeformField).label
            const type = formConfig.predefinedFields ? (field as typeof sellerFields[0]).type : (field as FreeformField).type
            const mapped = !!coordinates[key]
            const isSelected = selectedField === key
            const color = FIELD_TYPE_COLORS[type] || '#6b7280'
            return (
              <button
                key={key}
                onClick={() => setSelectedField(key)}
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
                    {type === 'fixture_status' ? 'FIX' : type === 'initials' ? 'INI' : type.slice(0, 3).toUpperCase()}
                  </span>
                  <span className={`text-xs flex-1 truncate ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                    {label}
                  </span>
                  {mapped ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <button
                        onClick={e => { e.stopPropagation(); resetField(key) }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />
                  )}
                </div>
                {/* Field key shown below label for easy reference */}
                <p className="text-[9px] text-gray-600 font-mono mt-0.5 truncate pl-8">{key}</p>
              </button>
            )
          })}
        </div>

        {selectedFieldDef && (
          <div className="p-3 border-t border-gray-800">
            <div className="bg-indigo-950 border border-indigo-800 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="w-3 h-3 text-indigo-400" />
                <p className="text-xs font-bold text-indigo-300">
                  {formConfig.predefinedFields ? 'Drag on PDF to place' : 'Drag on PDF to add fields'}
                </p>
              </div>
              <p className="text-xs text-white font-medium truncate">
                {'label' in selectedFieldDef ? selectedFieldDef.label : (selectedFieldDef as FreeformField).label}
              </p>
              <p className="text-[10px] text-indigo-400 font-mono mt-0.5">
                {'key' in selectedFieldDef ? selectedFieldDef.key : (selectedFieldDef as FreeformField).field_key}
              </p>
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

      {/* ── PDF Canvas Viewer ── */}
      <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold">Page {currentPage} / {formConfig.totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(formConfig.totalPages, p + 1))}
              disabled={currentPage === formConfig.totalPages}
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {rendering && <span className="text-xs text-blue-400 ml-2">Rendering…</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFieldIds(v => !v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                showFieldIds
                  ? 'bg-indigo-900 border-indigo-600 text-indigo-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {showFieldIds ? 'IDs On' : 'IDs Off'}
            </button>
            <div className="w-px h-5 bg-gray-700 mx-1" />
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

          <div className="flex items-center gap-3 text-xs">
            {Object.entries(FIELD_TYPE_COLORS).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1 text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm border" style={{ backgroundColor: color + '44', borderColor: color }} />
                {type === 'fixture_status' ? 'fixture' : type}
              </span>
            ))}
          </div>
        </div>

        {/* Scrollable canvas area */}
        <div ref={canvasContainerRef} className="flex-1 overflow-auto flex items-start justify-center p-6">
          <div
            className="relative inline-block"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          >
            {/* Real PDF rendered onto canvas */}
            <canvas
              ref={canvasRef}
              className="block shadow-2xl select-none bg-white"
              style={{ maxWidth: '700px' }}
            />

            {/* ── PAGE ID BADGE — always visible for reference ── */}
            {pageReady && (
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 pointer-events-none z-30">
                <span className="bg-black/80 text-white text-xs font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/10 shadow-lg">
                  Page {currentPage} / {formConfig.totalPages}
                </span>
                <span className="bg-indigo-900/90 text-indigo-200 text-[10px] font-semibold px-2 py-1 rounded-lg backdrop-blur-sm border border-indigo-700/50 shadow-lg truncate max-w-[180px]">
                  {formConfig.shortLabel}
                </span>
              </div>
            )}

            {/* Loading overlay while page renders */}
            {!pageReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800/70 rounded">
                <span className="text-sm text-gray-300">{pdfDoc ? 'Rendering page…' : 'Loading PDF…'}</span>
              </div>
            )}

            {/* Drawing + field overlay */}
            {pageReady && (
              <div
                ref={overlayRef}
                className={`absolute inset-0 ${canDraw ? 'cursor-crosshair' : 'cursor-default'}`}
                onMouseDown={onOverlayMouseDown}
              >
                {/* Live draw preview */}
                {drawPreview && (
                  <div
                    className="absolute border-2 border-dashed border-white bg-white/10 pointer-events-none"
                    style={{
                      left: drawPreview.left, top: drawPreview.top,
                      width: drawPreview.width, height: drawPreview.height,
                    }}
                  />
                )}

                {/* Saved field overlays */}
                {overlayFields.map(({ key, type }) => {
                  const coord = coordinates[key]
                  if (!coord) return null
                  const screen = pdfToScreenRect(coord.x, coord.y, coord.width, coord.height)
                  if (!screen) return null
                  const color = FIELD_TYPE_COLORS[type] || FIELD_TYPE_COLORS[coord.field_type || ''] || '#6b7280'
                  const isSelected = key === selectedField
                  return (
                    <div
                      key={key}
                      onClick={e => { e.stopPropagation(); setSelectedField(key) }}
                      className={`absolute border-2 cursor-pointer transition-all group ${isSelected ? 'z-20' : 'z-10'}`}
                      style={{
                        left: screen.left, top: screen.top,
                        width: Math.max(screen.width, 4),
                        height: Math.max(screen.height, 4),
                        borderColor: isSelected ? '#fff' : color,
                        backgroundColor: color + (isSelected ? '40' : '1a'),
                      }}
                      title={`${key}\nx:${Math.round(coord.x)} y:${Math.round(coord.y)} w:${Math.round(coord.width)} h:${Math.round(coord.height)}`}
                    >
                      {/* Field ID label — full key, toggleable */}
                      {showFieldIds && (
                        <span
                          className="absolute top-0 left-0 text-[8px] font-bold px-1 py-px leading-tight pointer-events-none whitespace-nowrap overflow-hidden"
                          style={{
                            color: isSelected ? '#fff' : color,
                            backgroundColor: 'rgba(0,0,0,0.75)',
                            maxWidth: '100%',
                          }}
                        >
                          {key}
                        </span>
                      )}
                      <button
                        className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30"
                        onClick={e => { e.stopPropagation(); resetField(key) }}
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
