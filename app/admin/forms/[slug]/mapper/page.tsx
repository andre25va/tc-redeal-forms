'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  CheckSquare, Type, PenTool, Hash, Edit3, Trash2, Search, Save } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

declare global { interface Window { pdfjsLib: any } }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Field {
  form_slug: string; field_key: string; page_num: number
  x: number; y: number; width: number; height: number
  field_type: string | null; is_signature: boolean; is_initial: boolean; required: boolean
}
interface TextItem { str: string; x: number; y: number; width: number; height: number }
interface FormInfo { slug: string; name: string; page_count: number; pdf_template_path: string }

const PRESETS: Record<string, { width: number; height: number }> = {
  checkbox: { width: 10, height: 10 }, text: { width: 96, height: 14 },
  signature: { width: 140, height: 28 }, initial: { width: 40, height: 22 },
}
const TYPE_COLORS: Record<string, string> = {
  checkbox: '#22c55e', text: '#3b82f6', signature: '#8b5cf6', initial: '#f59e0b',
}
const DRAW_TYPES = [
  { type: 'checkbox', icon: CheckSquare, label: 'Check' },
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'signature', icon: PenTool, label: 'Sig' },
  { type: 'initial', icon: Hash, label: 'Init' },
]

function toSnakeCase(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_').substring(0, 60)
}
function findNearestText(px: number, py: number, items: TextItem[]): TextItem | null {
  let best: TextItem | null = null; let bestDist = Infinity
  for (const it of items) {
    if (it.str.trim().length < 3) continue
    const cy = it.y + it.height / 2; const cx = it.x + it.width / 2
    let d = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2)
    if (cy > py) d *= 2.5
    if (d < bestDist) { bestDist = d; best = it }
  }
  return bestDist < 150 ? best : null
}

type InteractionMode = 'idle' | 'drawing' | 'dragging' | 'resizing'
interface Interaction {
  mode: InteractionMode; sx: number; sy: number; cx: number; cy: number; dragged: boolean
  fieldKey?: string; dragOx?: number; dragOy?: number
  resizeCorner?: string; resizeSnap?: { x: number; y: number; width: number; height: number }
}

export default function MapperPage() {
  const params = useParams()
  const slug = params.slug as string

  const [pdfReady, setPdfReady] = useState(false)
  const [pdf, setPdf] = useState<any>(null)
  const [formInfo, setFormInfo] = useState<FormInfo | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [scale, setScale] = useState(1.5)
  const [vpW, setVpW] = useState(612); const [vpH, setVpH] = useState(792)

  const [allFields, setAllFields] = useState<Field[]>([])
  const [textItems, setTextItems] = useState<TextItem[]>([])
  const [pendingChanges, setPendingChanges] = useState<Map<string, Field>>(new Map())

  const [drawType, setDrawType] = useState('text')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [editingField, setEditingField] = useState<Field | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate(n => n + 1)

  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderRef = useRef<any>(null)
  const allFieldsRef = useRef(allFields)
  const scaleRef = useRef(scale)
  const slugRef = useRef(slug)
  const drawTypeRef = useRef(drawType)
  const pageNumRef = useRef(pageNum)
  const textItemsRef = useRef(textItems)
  const ia = useRef<Interaction>({ mode: 'idle', sx: 0, sy: 0, cx: 0, cy: 0, dragged: false })

  useEffect(() => { allFieldsRef.current = allFields }, [allFields])
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { slugRef.current = slug }, [slug])
  useEffect(() => { drawTypeRef.current = drawType }, [drawType])
  useEffect(() => { pageNumRef.current = pageNum }, [pageNum])
  useEffect(() => { textItemsRef.current = textItems }, [textItems])

  // Load data
  useEffect(() => {
    if (!slug) return
    supabase.from('form_templates').select('slug,name,page_count,pdf_template_path')
      .eq('slug', slug).single().then(({ data }) => { if (data) setFormInfo(data as FormInfo) })
    supabase.from('field_coordinates').select('*').eq('form_slug', slug)
      .order('page_num').order('y')
      .then(({ data }) => { if (data) setAllFields(data as Field[]) })
  }, [slug])

  // Load PDF
  useEffect(() => {
    if (!pdfReady || !formInfo?.pdf_template_path) return
    const { data } = supabase.storage.from('form-templates').getPublicUrl(formInfo.pdf_template_path)
    if (data?.publicUrl) window.pdfjsLib.getDocument(data.publicUrl).promise.then((doc: any) => setPdf(doc))
  }, [pdfReady, formInfo])

  // Render page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let cancelled = false
    ;(async () => {
      const page = await pdf.getPage(pageNum); if (cancelled) return
      const vp1 = page.getViewport({ scale: 1 })
      setVpW(vp1.width); setVpH(vp1.height)
      const vp = page.getViewport({ scale })
      const canvas = canvasRef.current!
      canvas.width = vp.width; canvas.height = vp.height
      if (renderRef.current) { try { renderRef.current.cancel() } catch {} }
      renderRef.current = page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp })
      try { await renderRef.current.promise } catch {}
      if (cancelled) return
      const tc = await page.getTextContent()
      const items: TextItem[] = tc.items.filter((i: any) => i.str?.trim()).map((i: any) => {
        const fontSize = Math.abs(i.transform[3]) || Math.abs(i.transform[0]) || 12
        return { str: i.str, x: i.transform[4], y: vp1.height - i.transform[5] - fontSize, width: i.width || 50, height: fontSize }
      })
      setTextItems(items)
    })()
    return () => { cancelled = true }
  }, [pdf, pageNum, scale])

  // Keyboard: arrow nudge + delete
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!selectedKey) return
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (confirm('Delete field "' + selectedKey + '"?')) deleteField(selectedKey)
        return
      }
      const dirs: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
      }
      if (!dirs[e.key]) return
      e.preventDefault()
      const step = e.shiftKey ? 5 : 1
      const [dx, dy] = dirs[e.key].map(v => v * step)
      setAllFields(prev => prev.map(f => {
        if (f.field_key !== selectedKey || f.form_slug !== slugRef.current) return f
        const updated = { ...f, x: f.x + dx, y: f.y + dy }
        setPendingChanges(pm => new Map(pm).set(f.field_key, updated))
        return updated
      }))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [selectedKey])

  const getSvgXY = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const r = svgRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // SVG mouse down (background = start drawing)
  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    setSelectedKey(null)
    const { x, y } = getSvgXY(e)
    ia.current = { mode: 'drawing', sx: x, sy: y, cx: x, cy: y, dragged: false }
  }

  // Field rect mouse down (start dragging)
  const handleFieldMouseDown = (e: React.MouseEvent, f: Field) => {
    e.stopPropagation(); e.preventDefault()
    setSelectedKey(f.field_key)
    const { x, y } = getSvgXY(e)
    const s = scaleRef.current
    ia.current = {
      mode: 'dragging', sx: x, sy: y, cx: x, cy: y, dragged: false,
      fieldKey: f.field_key, dragOx: x - f.x * s, dragOy: y - f.y * s,
    }
  }

  // Resize handle mouse down
  const handleResizeMouseDown = (e: React.MouseEvent, f: Field, corner: string) => {
    e.stopPropagation(); e.preventDefault()
    const { x, y } = getSvgXY(e)
    ia.current = {
      mode: 'resizing', sx: x, sy: y, cx: x, cy: y, dragged: false,
      fieldKey: f.field_key, resizeCorner: corner,
      resizeSnap: { x: f.x, y: f.y, width: f.width, height: f.height },
    }
  }

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const cur = ia.current
    if (cur.mode === 'idle') return
    const { x, y } = getSvgXY(e)
    const s = scaleRef.current
    cur.cx = x; cur.cy = y
    cur.dragged = cur.dragged || Math.abs(x - cur.sx) > 5 || Math.abs(y - cur.sy) > 5

    if (cur.mode === 'drawing') {
      rerender()
    } else if (cur.mode === 'dragging' && cur.fieldKey) {
      const fx = (x - (cur.dragOx || 0)) / s
      const fy = (y - (cur.dragOy || 0)) / s
      setAllFields(prev => prev.map(f =>
        f.field_key === cur.fieldKey && f.form_slug === slugRef.current
          ? { ...f, x: Math.max(0, fx), y: Math.max(0, fy) }
          : f
      ))
    } else if (cur.mode === 'resizing' && cur.fieldKey && cur.resizeSnap) {
      const snap = cur.resizeSnap
      const dmx = (x - cur.sx) / s
      const dmy = (y - cur.sy) / s
      let nx = snap.x, ny = snap.y, nw = snap.width, nh = snap.height
      const corner = cur.resizeCorner
      if (corner === 'se') { nw = Math.max(5, nw + dmx); nh = Math.max(5, nh + dmy) }
      else if (corner === 'sw') { nx += dmx; nw = Math.max(5, nw - dmx); nh = Math.max(5, nh + dmy) }
      else if (corner === 'ne') { nw = Math.max(5, nw + dmx); ny += dmy; nh = Math.max(5, nh - dmy) }
      else if (corner === 'nw') { nx += dmx; nw = Math.max(5, nw - dmx); ny += dmy; nh = Math.max(5, nh - dmy) }
      setAllFields(prev => prev.map(f =>
        f.field_key === cur.fieldKey && f.form_slug === slugRef.current
          ? { ...f, x: nx, y: ny, width: nw, height: nh }
          : f
      ))
    }
  }

  const finalizeInteraction = () => {
    const cur = ia.current
    if (cur.mode === 'dragging' || cur.mode === 'resizing') {
      if (cur.fieldKey) {
        const f = allFieldsRef.current.find(f => f.field_key === cur.fieldKey && f.form_slug === slugRef.current)
        if (f) setPendingChanges(pm => new Map(pm).set(cur.fieldKey!, { ...f }))
      }
      ia.current = { mode: 'idle', sx: 0, sy: 0, cx: 0, cy: 0, dragged: false }
      return
    }

    if (cur.mode === 'drawing' && cur.dragged) {
      const s = scaleRef.current
      const fx = Math.min(cur.sx, cur.cx) / s
      const fy = Math.min(cur.sy, cur.cy) / s
      const fw = Math.abs(cur.cx - cur.sx) / s
      const fh = Math.abs(cur.cy - cur.sy) / s
      openNewFieldModal(fx, fy, fw, fh)
    } else if (cur.mode === 'drawing' && !cur.dragged) {
      const s = scaleRef.current
      const dt = drawTypeRef.current
      const preset = PRESETS[dt] || PRESETS.text
      const fx = cur.sx / s - preset.width / 2
      const fy = cur.sy / s - preset.height / 2
      openNewFieldModal(fx, fy, preset.width, preset.height)
    }
    ia.current = { mode: 'idle', sx: 0, sy: 0, cx: 0, cy: 0, dragged: false }
    rerender()
  }

  const handleSvgMouseLeave = () => {
    const cur = ia.current
    if (cur.mode === 'dragging' || cur.mode === 'resizing') {
      finalizeInteraction()
    } else {
      ia.current = { mode: 'idle', sx: 0, sy: 0, cx: 0, cy: 0, dragged: false }
      rerender()
    }
  }

  const openNewFieldModal = (fx: number, fy: number, fw: number, fh: number) => {
    const items = textItemsRef.current
    const nearest = findNearestText(fx + fw / 2, fy + fh / 2, items)
    let sugKey = nearest ? toSnakeCase(nearest.str) : `field_p${pageNumRef.current}_${Date.now().toString(36)}`
    const existing = new Set(allFieldsRef.current.map(f => f.field_key))
    if (existing.has(sugKey)) { let i = 2; while (existing.has(`${sugKey}_${i}`)) i++; sugKey = `${sugKey}_${i}` }
    const dt = drawTypeRef.current
    setEditingField({
      form_slug: slugRef.current, field_key: sugKey, page_num: pageNumRef.current,
      x: Math.round(fx * 100) / 100, y: Math.round(fy * 100) / 100,
      width: Math.round(fw * 100) / 100, height: Math.round(fh * 100) / 100,
      field_type: dt, is_signature: dt === 'signature', is_initial: dt === 'initial', required: false,
    })
    setShowModal(true)
  }

  const saveField = async (field: Field) => {
    setSaving(true)
    const { error } = await supabase.from('field_coordinates').upsert({
      form_slug: field.form_slug, field_key: field.field_key, page_num: field.page_num,
      x: field.x, y: field.y, width: field.width, height: field.height,
      field_type: field.field_type, is_signature: field.is_signature, is_initial: field.is_initial, required: field.required,
    }, { onConflict: 'form_slug,field_key,page_num' })
    if (error) { setSaveStatus('Error: ' + error.message) } else {
      setAllFields(prev => {
        const idx = prev.findIndex(f => f.field_key === field.field_key && f.form_slug === field.form_slug)
        if (idx >= 0) { const u = [...prev]; u[idx] = field; return u }
        return [...prev, field]
      })
      setPendingChanges(pm => { const n = new Map(pm); n.delete(field.field_key); return n })
      setSaveStatus('Saved ✓'); setTimeout(() => setSaveStatus(''), 2000)
    }
    setSaving(false); setShowModal(false); setEditingField(null)
  }

  const saveAllChanges = async () => {
    if (!pendingChanges.size) return
    setSaving(true)
    const upserts = Array.from(pendingChanges.values()).map(f => ({
      form_slug: f.form_slug, field_key: f.field_key, page_num: f.page_num,
      x: Math.round(f.x * 100) / 100, y: Math.round(f.y * 100) / 100,
      width: Math.round(f.width * 100) / 100, height: Math.round(f.height * 100) / 100,
      field_type: f.field_type, is_signature: f.is_signature, is_initial: f.is_initial, required: f.required,
    }))
    const { error } = await supabase.from('field_coordinates').upsert(upserts, { onConflict: 'form_slug,field_key,page_num' })
    if (error) { setSaveStatus('Error: ' + error.message) } else {
      setPendingChanges(new Map())
      setSaveStatus(`Saved ${upserts.length} fields ✓`); setTimeout(() => setSaveStatus(''), 3000)
    }
    setSaving(false)
  }

  const deleteField = async (key: string) => {
    await supabase.from('field_coordinates').delete().eq('form_slug', slug).eq('field_key', key)
    setAllFields(prev => prev.filter(f => !(f.field_key === key && f.form_slug === slug)))
    setPendingChanges(pm => { const n = new Map(pm); n.delete(key); return n })
    setSelectedKey(null)
  }

  // Derived
  const cur = ia.current
  const drawGhost = (cur.mode === 'drawing' && cur.dragged) ? {
    x: Math.min(cur.sx, cur.cx), y: Math.min(cur.sy, cur.cy),
    w: Math.abs(cur.cx - cur.sx), h: Math.abs(cur.cy - cur.sy),
  } : null
  const pageFields = allFields.filter(f => f.page_num === pageNum)
  const visibleFields = filterType ? pageFields.filter(f => f.field_type === filterType) : pageFields
  const sidebarFields = (filterType ? allFields.filter(f => f.field_type === filterType) : allFields)
    .filter(f => !searchQ || f.field_key.toLowerCase().includes(searchQ.toLowerCase()))
  const isDraggingOrResizing = cur.mode === 'dragging' || cur.mode === 'resizing'

  if (!formInfo) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
          setPdfReady(true)
        }}
      />

      <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 shadow-sm z-10 flex-shrink-0">
          <Link href="/admin/forms" className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-gray-900 text-sm truncate">{formInfo.name}</h1>
          <span className="text-xs text-gray-400 flex-shrink-0">{allFields.length} fields</span>
          <div className="flex-1" />

          <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1}
            className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-gray-600 min-w-[60px] text-center">
            {pageNum} / {formInfo.page_count || '?'}
          </span>
          <button onClick={() => setPageNum(p => Math.min(formInfo.page_count || 999, p + 1))}
            disabled={pageNum >= (formInfo.page_count || 999)}
            className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1" />
          <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            className="p-1.5 hover:bg-gray-100 rounded-lg"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs font-mono text-gray-500 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, +(s + 0.25).toFixed(2)))}
            className="p-1.5 hover:bg-gray-100 rounded-lg"><ZoomIn className="w-4 h-4" /></button>

          {pendingChanges.size > 0 && (
            <>
              <div className="w-px h-6 bg-gray-200 mx-1" />
              <button onClick={saveAllChanges} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                <Save className="w-3.5 h-3.5" />
                Save {pendingChanges.size} change{pendingChanges.size !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {saveStatus && <span className="text-xs text-green-600 font-medium ml-1">{saveStatus}</span>}
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Left toolbar: draw type buttons + layer filters */}
          <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-2 flex-shrink-0">
            {DRAW_TYPES.map(dt => {
              const Icon = dt.icon
              return (
                <button key={dt.type} onClick={() => setDrawType(dt.type)} title={`Draw ${dt.label}`}
                  className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium transition-all
                    ${drawType === dt.type ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                  <Icon className="w-5 h-5" />
                </button>
              )
            })}
            <div className="w-8 h-px bg-gray-200 my-1" />
            {Object.entries(TYPE_COLORS).map(([t, color]) => (
              <button key={t} onClick={() => setFilterType(f => f === t ? null : t)}
                className={`w-8 h-3 rounded-full transition-all ${!filterType || filterType === t ? 'opacity-100' : 'opacity-20'}`}
                style={{ backgroundColor: color }} title={`Filter ${t}`} />
            ))}
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-gray-200 p-4">
            {!pdf ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="text-sm">Loading PDF…</p>
                </div>
              </div>
            ) : (
              <div className="relative inline-block shadow-lg bg-white">
                <canvas ref={canvasRef} className="block" />
                <svg ref={svgRef} className="absolute top-0 left-0 select-none"
                  width={vpW * scale} height={vpH * scale}
                  style={{ cursor: isDraggingOrResizing ? 'grabbing' : 'crosshair' }}
                  onMouseDown={handleSvgMouseDown}
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={finalizeInteraction}
                  onMouseLeave={handleSvgMouseLeave}
                >
                  {visibleFields.map(f => {
                    const color = TYPE_COLORS[f.field_type || 'text'] || '#3b82f6'
                    const sel = f.field_key === selectedKey
                    const changed = pendingChanges.has(f.field_key)
                    const sx = f.x * scale, sy = f.y * scale
                    const sw = f.width * scale, sh = f.height * scale
                    return (
                      <g key={f.field_key}>
                        <rect
                          x={sx} y={sy} width={Math.max(1, sw)} height={Math.max(1, sh)}
                          fill={sel ? `${color}40` : `${color}20`}
                          stroke={changed ? '#f97316' : color}
                          strokeWidth={sel ? 2.5 : 1}
                          strokeDasharray={changed && !sel ? '4 2' : undefined}
                          rx={1}
                          style={{ cursor: 'grab' }}
                          onMouseDown={e => handleFieldMouseDown(e, f)}
                          onDoubleClick={e => { e.stopPropagation(); setEditingField({ ...f }); setShowModal(true) }}
                        />
                        {scale >= 1 && (
                          <text x={sx + 2} y={sy - 2} fill={changed ? '#f97316' : color}
                            fontSize={9} fontFamily="monospace"
                            style={{ pointerEvents: 'none', userSelect: 'none' }}>
                            {f.field_key.length > 28 ? f.field_key.slice(0, 28) + '…' : f.field_key}
                          </text>
                        )}
                        {/* Resize handles on selected field */}
                        {sel && [
                          { cx: sx, cy: sy, corner: 'nw', cursor: 'nwse-resize' },
                          { cx: sx + sw, cy: sy, corner: 'ne', cursor: 'nesw-resize' },
                          { cx: sx, cy: sy + sh, corner: 'sw', cursor: 'nesw-resize' },
                          { cx: sx + sw, cy: sy + sh, corner: 'se', cursor: 'nwse-resize' },
                        ].map(h => (
                          <circle key={h.corner} cx={h.cx} cy={h.cy} r={5}
                            fill="white" stroke={color} strokeWidth={1.5}
                            style={{ cursor: h.cursor }}
                            onMouseDown={e => handleResizeMouseDown(e, f, h.corner)} />
                        ))}
                      </g>
                    )
                  })}
                  {/* Drawing ghost */}
                  {drawGhost && (
                    <rect x={drawGhost.x} y={drawGhost.y} width={drawGhost.w} height={drawGhost.h}
                      fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2" rx={2} />
                  )}
                </svg>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search fields…"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {sidebarFields.length} fields{filterType ? ` (${filterType})` : ''}
                  {pendingChanges.size > 0 && (
                    <span className="ml-1 text-orange-500 font-medium">· {pendingChanges.size} unsaved</span>
                  )}
                </span>
                {filterType && (
                  <button onClick={() => setFilterType(null)} className="text-xs text-indigo-600 hover:underline">Show all</button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sidebarFields.map(f => (
                <div key={`${f.form_slug}-${f.field_key}-${f.page_num}`}
                  className={[
                    'px-3 py-2 border-b border-gray-50 cursor-pointer flex items-center gap-2 group transition-colors',
                    f.field_key === selectedKey ? 'bg-indigo-50' : 'hover:bg-gray-50',
                    pendingChanges.has(f.field_key) ? 'border-l-2 border-l-orange-400' : '',
                  ].join(' ')}
                  onClick={() => { setSelectedKey(f.field_key); if (f.page_num !== pageNum) setPageNum(f.page_num) }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: TYPE_COLORS[f.field_type || 'text'] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gray-700 truncate">{f.field_key}</p>
                    <p className="text-[10px] text-gray-400">p{f.page_num} · {f.field_type || 'text'}</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                    <button onClick={e => { e.stopPropagation(); setEditingField({ ...f }); setShowModal(true) }}
                      className="p-1 text-gray-400 hover:text-indigo-600 rounded">
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); if (confirm('Delete?')) deleteField(f.field_key) }}
                      className="p-1 text-gray-400 hover:text-red-600 rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showModal && editingField && (
        <FieldModal field={editingField} saving={saving}
          onSave={saveField}
          onCancel={() => { setShowModal(false); setEditingField(null) }}
          onDelete={() => { deleteField(editingField.field_key); setShowModal(false); setEditingField(null) }}
        />
      )}
    </>
  )
}

function FieldModal({ field, saving, onSave, onCancel, onDelete }: {
  field: Field; saving: boolean
  onSave: (f: Field) => void; onCancel: () => void; onDelete: () => void
}) {
  const [f, setF] = useState<Field>({ ...field })
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
        <h3 className="font-bold text-gray-900 mb-4">Field Settings</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Field Key</label>
            <input type="text" value={f.field_key} autoFocus
              onChange={e => setF(p => ({ ...p, field_key: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Type</label>
              <select value={f.field_type || 'text'}
                onChange={e => setF(p => ({ ...p, field_type: e.target.value, is_signature: e.target.value === 'signature', is_initial: e.target.value === 'initial' }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="checkbox">Checkbox</option>
                <option value="text">Text</option>
                <option value="signature">Signature</option>
                <option value="initial">Initial</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Page</label>
              <input type="number" value={f.page_num}
                onChange={e => setF(p => ({ ...p, page_num: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(['x', 'y', 'width', 'height'] as const).map(k => (
              <div key={k}>
                <label className="text-[10px] font-semibold text-gray-400 block mb-1 uppercase">{k}</label>
                <input type="number" step="0.1" value={Math.round(f[k] * 10) / 10}
                  onChange={e => setF(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.required}
              onChange={e => setF(p => ({ ...p, required: e.target.checked }))}
              className="rounded border-gray-300" />
            <span className="text-sm text-gray-600">Required</span>
          </label>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onDelete}
            className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium">Delete</button>
          <div className="flex-1" />
          <button onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg font-medium">Cancel</button>
          <button onClick={() => onSave(f)} disabled={saving || !f.field_key}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
