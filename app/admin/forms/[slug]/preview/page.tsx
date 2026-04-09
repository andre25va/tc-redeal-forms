'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Eye } from 'lucide-react'
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
interface FormInfo { slug: string; name: string; page_count: number; pdf_template_path: string }

const TYPE_BORDER: Record<string, string> = {
  checkbox: '#22c55e',
  text: '#3b82f6',
  signature: '#8b5cf6',
  initial: '#f59e0b',
}

export default function PreviewPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string

  const [pdfReady, setPdfReady] = useState(false)
  const [pdf, setPdf] = useState<any>(null)
  const [formInfo, setFormInfo] = useState<FormInfo | null>(null)
  const [pageNum, setPageNum] = useState(() => parseInt(searchParams.get('page') || '1'))
  const [scale, setScale] = useState(1.5)
  const [vpW, setVpW] = useState(612)
  const [vpH, setVpH] = useState(792)

  const [allFields, setAllFields] = useState<Field[]>([])
  const [testData, setTestData] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState('')
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderRef = useRef<any>(null)

  // Load form info + fields + test data
  useEffect(() => {
    if (!slug) return
    supabase.from('form_templates').select('slug,name,page_count,pdf_template_path')
      .eq('slug', slug).single().then(({ data }) => { if (data) setFormInfo(data as FormInfo) })
    supabase.from('field_coordinates').select('*').eq('form_slug', slug)
      .order('page_num').order('y')
      .then(({ data }) => { if (data) setAllFields(data as Field[]) })
    supabase.from('form_test_data').select('field_key,value').eq('form_slug', slug)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {}
          data.forEach(row => { map[row.field_key] = row.value })
          setTestData(map)
        }
      })
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
      const page = await pdf.getPage(pageNum)
      if (cancelled) return
      const vp1 = page.getViewport({ scale: 1 })
      setVpW(vp1.width); setVpH(vp1.height)
      const vp = page.getViewport({ scale })
      const canvas = canvasRef.current!
      canvas.width = vp.width; canvas.height = vp.height
      if (renderRef.current) { try { renderRef.current.cancel() } catch {} }
      renderRef.current = page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp })
      try { await renderRef.current.promise } catch {}
    })()
    return () => { cancelled = true }
  }, [pdf, pageNum, scale])

  // Debounced save
  const handleChange = useCallback((fieldKey: string, value: string) => {
    setTestData(prev => ({ ...prev, [fieldKey]: value }))
    if (saveTimers.current[fieldKey]) clearTimeout(saveTimers.current[fieldKey])
    saveTimers.current[fieldKey] = setTimeout(async () => {
      const { error } = await supabase.from('form_test_data').upsert(
        { form_slug: slug, field_key: fieldKey, value, updated_at: new Date().toISOString() },
        { onConflict: 'form_slug,field_key' }
      )
      if (!error) {
        setSaveStatus('Saved ✓')
        setTimeout(() => setSaveStatus(''), 2000)
      }
    }, 600)
  }, [slug])

  // Reset all test data
  const handleReset = async () => {
    if (!confirm('Clear all test data for this form?')) return
    await supabase.from('form_test_data').delete().eq('form_slug', slug)
    setTestData({})
    setSaveStatus('Cleared ✓')
    setTimeout(() => setSaveStatus(''), 2000)
  }

  const pageFields = allFields.filter(f => f.page_num === pageNum)

  if (!formInfo) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
          setPdfReady(true)
        }}
      />

      <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 shadow-sm z-10 flex-shrink-0">
          <Link
            href={`/admin/forms/${slug}/mapper`}
            className="p-1.5 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 text-sm text-gray-600"
          >
            <ArrowLeft className="w-4 h-4" />
            Mapper
          </Link>

          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600" />
            <h1 className="font-bold text-gray-900 text-sm truncate">{formInfo.name}</h1>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Preview</span>
          </div>

          <span className="text-xs text-gray-400">{allFields.length} fields · {Object.keys(testData).length} filled</span>

          <div className="flex-1" />

          {/* Page nav */}
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

          {/* Zoom */}
          <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            className="p-1.5 hover:bg-gray-100 rounded-lg"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs font-mono text-gray-500 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, +(s + 0.25).toFixed(2)))}
            className="p-1.5 hover:bg-gray-100 rounded-lg"><ZoomIn className="w-4 h-4" /></button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg font-medium border border-gray-200">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>

          {saveStatus && <span className="text-xs text-green-600 font-medium">{saveStatus}</span>}
        </header>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-gray-200 p-6 flex justify-center">
          {!pdf ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm">Loading PDF…</p>
              </div>
            </div>
          ) : (
            <div className="relative inline-block shadow-xl bg-white self-start">
              <canvas ref={canvasRef} className="block" />

              {/* Input overlay */}
              <div
                className="absolute top-0 left-0 pointer-events-none"
                style={{ width: vpW * scale, height: vpH * scale }}
              >
                {pageFields.map(f => {
                  const left = f.x * scale
                  const top = f.y * scale
                  const width = f.width * scale
                  const height = f.height * scale
                  const isCheckbox = f.field_type === 'text' && f.width < 16
                  const actualType = f.field_type === 'checkbox' || isCheckbox ? 'checkbox' : 'text'
                  const borderColor = TYPE_BORDER[f.field_type || 'text'] || '#3b82f6'
                  const value = testData[f.field_key] || ''

                  if (actualType === 'checkbox') {
                    return (
                      <div
                        key={f.field_key}
                        className="absolute flex items-center justify-center pointer-events-auto"
                        style={{ left, top, width, height }}
                      >
                        <input
                          type="checkbox"
                          checked={value === 'true'}
                          onChange={e => handleChange(f.field_key, e.target.checked ? 'true' : '')}
                          className="cursor-pointer"
                          style={{
                            width: Math.min(width * 0.85, height * 0.85),
                            height: Math.min(width * 0.85, height * 0.85),
                            accentColor: borderColor,
                          }}
                          title={f.field_key}
                        />
                      </div>
                    )
                  }

                  const isSig = f.is_signature || f.field_type === 'signature'
                  const isInit = f.is_initial || f.field_type === 'initial'
                  const fontSize = Math.max(7, Math.min(height * 0.7, 13))

                  return (
                    <input
                      key={f.field_key}
                      type="text"
                      value={value}
                      onChange={e => handleChange(f.field_key, e.target.value)}
                      placeholder={f.field_key.replace(/_/g, ' ')}
                      className="absolute pointer-events-auto bg-transparent focus:outline-none"
                      style={{
                        left,
                        top,
                        width,
                        height,
                        fontSize,
                        fontFamily: isSig || isInit ? 'cursive, Georgia, serif' : 'inherit',
                        fontStyle: isSig || isInit ? 'italic' : 'normal',
                        color: isSig || isInit ? '#1e40af' : '#111827',
                        borderBottom: `1.5px solid ${borderColor}`,
                        paddingLeft: 2,
                        paddingRight: 2,
                        boxSizing: 'border-box',
                        lineHeight: 1,
                      }}
                      title={f.field_key}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom legend */}
        <div className="bg-white border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-xs text-gray-400">
          {Object.entries(TYPE_BORDER).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: color }} />
              {type}
            </span>
          ))}
          <span className="ml-auto text-gray-300">Test data auto-saves as you type · Changes visible on next mapper load</span>
        </div>
      </div>
    </>
  )
}
