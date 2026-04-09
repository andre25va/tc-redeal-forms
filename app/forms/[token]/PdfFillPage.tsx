'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Send, CheckCircle } from 'lucide-react'
import { FORM_SECTIONS } from '@/lib/formSections'
import ModeSelect from './ModeSelect'
import ChatFillPage from './ChatFillPage'
import SimpleFillPage from './SimpleFillPage'

interface FieldCoord {
  field_key: string
  page_num: number
  x: number
  y: number
  width: number
  height: number
  field_type: string
  is_signature: boolean
  is_initial: boolean
  required: boolean
}

interface PdfFillPageProps {
  token: string
  formSlug: string
  formName: string
  pdfUrl: string
  pageCount: number
  fields: FieldCoord[]
  savedData: Record<string, unknown>
  invitation: {
    seller_name?: string
    property_address?: string
    seller_email: string
  }
}

const PDF_PT_WIDTH = 612
const RENDER_SCALE = 1.5

export default function PdfFillPage({
  token, formSlug, formName, pdfUrl, pageCount, fields, savedData, invitation,
}: PdfFillPageProps) {
  const [mode, setMode] = useState<'chat' | 'simple' | 'manual' | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [formData, setFormData] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(savedData).map(([k, v]) => [k, String(v ?? '')]))
  )
  const [pdfPages, setPdfPages] = useState<string[]>([])
  const [pdfLoading, setPdfLoading] = useState(true)
  const [displayWidth, setDisplayWidth] = useState(612)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [language, setLanguage] = useState<'en' | 'es'>('en')
  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const libLoadedRef = useRef(false)
  const pdfLoadedRef = useRef(false)

  const chatAvailable = !!(FORM_SECTIONS[formSlug]?.length)

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setDisplayWidth(Math.min(containerRef.current.clientWidth - 8, 800))
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (mode !== 'manual') return
    let cancelled = false
    async function renderPdf() {
      if (pdfLoadedRef.current) return
      pdfLoadedRef.current = true
      const lib = (window as any).pdfjsLib
      if (!lib) return
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      try {
        const doc = await lib.getDocument({ url: pdfUrl, withCredentials: false }).promise
        const dataUrls: string[] = []
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return
          const page = await doc.getPage(i)
          const viewport = page.getViewport({ scale: RENDER_SCALE })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
          dataUrls.push(canvas.toDataURL('image/jpeg', 0.92))
        }
        if (!cancelled) { setPdfPages(dataUrls); setPdfLoading(false) }
      } catch (err) {
        console.error('[PdfFillPage] PDF load error:', err)
        if (!cancelled) setPdfLoading(false)
      }
    }
    function tryLoad() {
      if ((window as any).pdfjsLib) { if (!libLoadedRef.current) { libLoadedRef.current = true; renderPdf() } return }
      if (document.getElementById('pdfjs-script')) { setTimeout(tryLoad, 100); return }
      const script = document.createElement('script')
      script.id = 'pdfjs-script'
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      script.onload = () => renderPdf()
      document.head.appendChild(script)
    }
    tryLoad()
    return () => { cancelled = true }
  }, [pdfUrl, mode])

  const scheduleSave = useCallback((data: Record<string, string>) => {
    clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/forms/${token}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ form_data: data }) })
        if (!res.ok) throw new Error()
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch { setSaveStatus('error') }
    }, 800)
  }, [token])

  const handleChange = (key: string, value: string) => {
    const next = { ...formData, [key]: value }
    setFormData(next)
    scheduleSave(next)
  }

  const handleBatchUpdate = useCallback((updates: Record<string, string>) => {
    setFormData(prev => { const next = { ...prev, ...updates }; scheduleSave(next); return next })
  }, [scheduleSave])

  const handleChatUpdate = useCallback((updates: Record<string, string>) => {
    setFormData(prev => { const next = { ...prev, ...updates }; scheduleSave(next); return next })
  }, [scheduleSave])

  const handleSubmit = async () => {
    const msg = language === 'es' ? '¿Está seguro de que desea enviar el formulario? No podrá hacer cambios después.' : "Are you sure you want to submit? You won't be able to make changes after."
    if (!confirm(msg)) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/forms/${token}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ form_data: formData }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submit failed')
      setSubmitted(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Submit failed. Please try again.')
    } finally { setSubmitting(false) }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4" style={{ colorScheme: 'light' }}>
        <div className="text-center max-w-md bg-white rounded-2xl shadow-lg p-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{language === 'es' ? '¡Formulario Enviado!' : 'Form Submitted!'}</h1>
          <p className="text-gray-500 mb-1">{language === 'es' ? 'Su formulario ha sido enviado exitosamente.' : 'Your form has been submitted successfully.'}</p>
          {invitation.property_address && <p className="text-sm text-gray-400 mt-2">{invitation.property_address}</p>}
          <p className="text-sm text-gray-400 mt-3">{language === 'es' ? `Se enviará una copia completada a ${invitation.seller_email}.` : `A completed copy will be emailed to ${invitation.seller_email}.`}</p>
        </div>
      </div>
    )
  }

  if (mode === null) {
    return <ModeSelect formName={formName} sellerName={invitation.seller_name} propertyAddress={invitation.property_address} language={language} onLanguageChange={setLanguage} onSelect={setMode} chatAvailable={chatAvailable} />
  }

  if (mode === 'chat') {
    return <ChatFillPage token={token} formName={formName} formSlug={formSlug} fields={fields} formData={formData} onUpdate={handleChatUpdate} onSubmit={handleSubmit} onSwitchMode={() => setMode(null)} invitation={invitation} language={language} onLanguageChange={setLanguage} />
  }

  if (mode === 'simple') {
    return <SimpleFillPage formName={formName} formSlug={formSlug} fields={fields.map(f => ({ field_key: f.field_key, field_type: f.field_type, page_num: f.page_num }))} formData={formData} onChange={handleChange} onBatchUpdate={handleBatchUpdate} onSubmit={handleSubmit} onSwitchMode={() => setMode(null)} invitation={invitation} language={language} onLanguageChange={setLanguage} saveStatus={saveStatus} submitting={submitting} />
  }

  const scale = displayWidth / PDF_PT_WIDTH
  const PAGE_H_PT = 792
  const pageDisplayH = PAGE_H_PT * scale
  const pageDataUrl = pdfPages[currentPage - 1]
  const pageFields = fields.filter(f => f.page_num === currentPage)
  const filledCount = Object.values(formData).filter(v => v && v !== '').length

  return (
    <div className="min-h-screen bg-gray-100" style={{ colorScheme: 'light' }}>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-gray-900 text-sm leading-tight truncate">{formName}</h1>
              {invitation.property_address && <p className="text-xs text-gray-400 truncate">{invitation.property_address}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {saveStatus === 'saving' && <span className="text-xs text-gray-400">Saving…</span>}
              {saveStatus === 'saved' && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
              {saveStatus === 'error' && <span className="text-xs text-red-500">Save error</span>}
              <span className="text-xs text-gray-400 hidden sm:block">{filledCount} filled · pg {currentPage}/{pageCount}</span>
              <span className="text-xs text-gray-400 sm:hidden">{currentPage}/{pageCount}</span>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                <button onClick={() => setLanguage('en')} className={`px-2 py-1 font-medium transition-colors ${language === 'en' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>EN</button>
                <button onClick={() => setLanguage('es')} className={`px-2 py-1 font-medium transition-colors ${language === 'es' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>ES</button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4" ref={containerRef}>
        {pdfLoading ? (
          <div className="bg-white shadow-md rounded-sm flex items-center justify-center mx-auto" style={{ width: displayWidth, height: pageDisplayH }}>
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-400">{language === 'es' ? 'Cargando formulario…' : 'Loading form…'}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="relative bg-white shadow-md rounded-sm overflow-hidden mx-auto" style={{ width: displayWidth, height: pageDisplayH }}>
              {pageDataUrl ? (
                <img src={pageDataUrl} alt={`Page ${currentPage}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} draggable={false} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-300 text-sm">Page unavailable</div>
              )}
              {pageFields.map(f => {
                const left = f.x * scale
                const top = f.y * scale
                const w = Math.max(f.width * scale, 8)
                const h = Math.max(f.height * scale, 10)
                const val = formData[f.field_key] ?? ''
                const isCb = f.field_type === 'checkbox'
                const isSig = f.is_signature
                const isInit = f.is_initial
                if (isCb) return <input key={f.field_key} type="checkbox" checked={val === 'true' || val === '1'} onChange={e => handleChange(f.field_key, e.target.checked ? 'true' : '')} style={{ position: 'absolute', left, top, width: w, height: h, cursor: 'pointer', accentColor: '#4f46e5' }} />
                const borderColor = isSig ? '#7c3aed' : isInit ? '#d97706' : '#3b82f6'
                const fontFamily = isSig || isInit ? 'Georgia, serif' : 'inherit'
                const fontSize = Math.max(Math.min(h * 0.62, 13), 7)
                return <input key={f.field_key} type="text" value={val} onChange={e => handleChange(f.field_key, e.target.value)} style={{ position: 'absolute', left, top, width: w, height: h, background: val ? 'rgba(239,246,255,0.85)' : 'rgba(239,246,255,0.45)', border: 'none', borderBottom: `1.5px solid ${borderColor}`, padding: '1px 2px', fontSize, fontFamily, color: '#111827', outline: 'none', boxSizing: 'border-box' }} onFocus={e => { e.currentTarget.style.background = 'rgba(219,234,254,0.95)' }} onBlur={e => { e.currentTarget.style.background = val ? 'rgba(239,246,255,0.85)' : 'rgba(239,246,255,0.45)' }} />
              })}
            </div>
            <div className="flex items-center justify-between mt-4 px-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm">
                <ChevronLeft className="w-4 h-4" />{language === 'es' ? 'Anterior' : 'Previous'}
              </button>
              <span className="text-sm font-medium text-gray-500">{currentPage} / {pageCount}</span>
              {currentPage < pageCount ? (
                <button onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm">
                  {language === 'es' ? 'Siguiente' : 'Next'}<ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow transition disabled:opacity-60">
                  <Send className="w-4 h-4" />{submitting ? (language === 'es' ? 'Enviando…' : 'Submitting…') : (language === 'es' ? 'Enviar Formulario' : 'Submit Form')}
                </button>
              )}
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">{language === 'es' ? 'Su progreso se guarda automáticamente.' : 'Your progress is automatically saved.'}</p>
          </>
        )}
      </div>
    </div>
  )
}
