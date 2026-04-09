'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Columns } from 'lucide-react'
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

const TYPE_COLORS: Record<string, string> = {
  checkbox: '#22c55e', text: '#3b82f6', signature: '#8b5cf6', initial: '#f59e0b',
}

export default function ComparePage() {
  const params = useParams()
  const slug = params.slug as string

  const [pdfReady, setPdfReady] = useState(false)
  const [pdf, setPdf] = useState<any>(null)
  const [formInfo, setFormInfo] = useState<FormInfo | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [vpW, setVpW] = useState(612)
  const [vpH, setVpH] = useState(792)

  const [allFields, setAllFields] = useState<Field[]>([])
  const [testData, setTestData] = useState<Record<string, string>>({})

  const canvasLeftRef = useRef<HTMLCanvasElement>(null)
  const canvasRightRef = useRef<HTMLCanvasElement>(null)
  const renderLeftRef = useRef<any>(null)
  const renderRightRef = useRef<any>(null)

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

  useEffect(() => {
    if (!pdfReady || !formInfo?.pdf_template_path) return
    const { data } = supabase.storage.from('form-templates').getPublicUrl(formInfo.pdf_template_path)
    if (data?.publicUrl) window.pdfjsLib.getDocument(data.publicUrl).promise.then((doc: any) => setPdf(doc))
  }, [pdfReady, formInfo])

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    ;(async () => {
      const page = await pdf.getPage(pageNum)
      if (cancelled) return
      const vp1 = page.getViewport({ scale: 1 })
      setVpW(vp1.width); setVpH(vp1.height)
      const vp = page.getViewport({ scale })

      if (canvasLeftRef.current) {
        const canvas = canvasLeftRef.current
        canvas.width = vp.width; canvas.height = vp.height
        if (renderLeftRef.current) { try { renderLeftRef.current.cancel() } catch {} }
        renderLeftRef.current = page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp })
        try { await renderLeftRef.current.promise } catch (e) { console.error('[Compare] left render error:', e) }
      }

      if (canvasRightRef.current) {
        const canvas = canvasRightRef.current
        canvas.width = vp.width; canvas.height = vp.height
        if (renderRightRef.current) { try { renderRightRef.current.cancel() } catch {} }
        const page2 = await pdf.getPage(pageNum)
        renderRightRef.current = page2.render({ canvasContext: canvas.getContext('2d')!, viewport: vp })
        try { await renderRightRef.current.promise } catch (e) { console.error('[Compare] right render error:', e) }
      }
    })()
    return () => { cancelled = true }
  }, [pdf, pageNum, scale])

  const pageFields = allFields.filter(f => f.page_num === pageNum)
  const filledCount = pageFields.filter(f => testData[f.field_key]).length

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
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 shadow-sm z-10 flex-shrink-0">
          <Link
            href={`/admin/forms/${slug}/mapper`}
            className="p-1.5 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 text-sm text-gray-600"
          >
            <ArrowLeft className="w-4 h-4" />
            Mapper
          </Link>

          <div className="flex items-center gap-2">
            <Columns className="w-4 h-4 text-indigo-600" />
            <h1 className="font-bold text-gray-900 text-sm truncate">{formInfo.name}</h1>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Compare</span>
          </div>

          <span className="text-xs text-gray-400">
            Page {pageNum}: {pageFields.length} fields · {filledCount} filled
          </span>

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
        </header>

        {/* Side-by-side panels */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: Mapper view */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-300">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-1.5 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">📐 Mapper — Field Coordinates</span>
              <div className="flex-1" />
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <span key={type} className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: color, opacity: 0.5 }} />
                  {type}
                </span>
              ))}
            </div>
            {/* overflow-auto + min-w-max wrapper = full horizontal scroll when zoomed */}
            <div className="flex-1 overflow-auto bg-gray-200 p-4">
              <div className="min-w-max flex justify-center">
                {!pdf ? (
                  <div className="flex items-center justify-center" style={{ width: 300, height: 400 }}>
                    <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="relative inline-block shadow-lg bg-white">
                    <canvas ref={canvasLeftRef} className="block" />
                    <svg
                      className="absolute top-0 left-0 pointer-events-none"
                      width={vpW * scale} height={vpH * scale}
                    >
                      {pageFields.map(f => {
                        const color = TYPE_COLORS[f.field_type || 'text'] || '#3b82f6'
                        const sx = f.x * scale, sy = f.y * scale
                        const sw = f.width * scale, sh = f.height * scale
                        return (
                          <g key={f.field_key}>
                            <rect
                              x={sx} y={sy} width={Math.max(1, sw)} height={Math.max(1, sh)}
                              fill={`${color}20`}
                              stroke={color}
                              strokeWidth={1.5}
                              rx={1}
                            />
                            {scale >= 0.8 && (
                              <text x={sx + 2} y={sy - 2} fill={color}
                                fontSize={Math.max(7, 9 * scale)} fontFamily="monospace"
                                style={{ userSelect: 'none' }}>
                                {f.field_key.length > 24 ? f.field_key.slice(0, 24) + '\u2026' : f.field_key}
                              </text>
                            )}
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Preview with test data */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-1.5 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">👁 Preview — Filled Values</span>
              <div className="flex-1" />
              <span className="text-[10px] text-gray-400">{filledCount} of {pageFields.length} filled on this page</span>
            </div>
            {/* overflow-auto + min-w-max wrapper = full horizontal scroll when zoomed */}
            <div className="flex-1 overflow-auto bg-gray-200 p-4">
              <div className="min-w-max flex justify-center">
                {!pdf ? (
                  <div className="flex items-center justify-center" style={{ width: 300, height: 400 }}>
                    <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="relative inline-block shadow-lg bg-white">
                    <canvas ref={canvasRightRef} className="block" />
                    <div
                      className="absolute top-0 left-0 pointer-events-none"
                      style={{ width: vpW * scale, height: vpH * scale }}
                    >
                      {pageFields.map(f => {
                        const isCheckbox = f.field_type === 'checkbox' || (f.field_type === 'text' && f.width < 16)
                        const color = TYPE_COLORS[f.field_type || 'text'] || '#3b82f6'
                        const value = testData[f.field_key] || ''

                        const left = f.x * scale
                        const top = f.y * scale
                        const width = f.width * scale
                        const height = f.height * scale

                        if (isCheckbox) {
                          const checked = value === 'true'
                          const boxSize = Math.min(width * 0.85, height * 0.85, 12)
                          return (
                            <div
                              key={f.field_key}
                              className="absolute flex items-center justify-center"
                              style={{ left, top, width, height }}
                              title={f.field_key}
                            >
                              <div style={{
                                width: boxSize, height: boxSize,
                                border: `1px solid ${color}40`,
                                borderRadius: 1,
                                position: 'relative',
                                backgroundColor: checked ? '#f0fdf4' : 'transparent',
                              }}>
                                {checked && (
                                  <svg viewBox="0 0 10 10" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                                    <polyline points="2,5.5 4.2,7.8 8,2.5" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          )
                        }

                        const isSig = f.is_signature || f.field_type === 'signature'
                        const isInit = f.is_initial || f.field_type === 'initial'
                        const fontSize = Math.max(7, Math.min(10, 9 * scale))

                        if (!value) {
                          return (
                            <div
                              key={f.field_key}
                              className="absolute"
                              style={{
                                left, top, width, height,
                                borderBottom: `1px dashed ${color}25`,
                              }}
                              title={f.field_key}
                            />
                          )
                        }

                        return (
                          <div
                            key={f.field_key}
                            className="absolute"
                            style={{
                              left, top, width, height,
                              overflow: 'visible',
                              paddingLeft: 2,
                              paddingRight: 2,
                              backgroundColor: 'white',
                              borderBottom: `1px solid ${color}35`,
                              zIndex: 1,
                            }}
                            title={`${f.field_key}: ${value}`}
                          >
                            <span style={{
                              fontSize,
                              fontFamily: isSig || isInit ? 'cursive, Georgia, serif' : 'Arial, sans-serif',
                              fontStyle: isSig || isInit ? 'italic' : 'normal',
                              color: isSig || isInit ? '#1e40af' : '#111827',
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              display: 'block',
                              marginTop: Math.max(0, (height - fontSize) / 2),
                            }}>
                              {value}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-100 px-4 py-1.5 flex items-center gap-4 text-xs text-gray-400">
          <span>Left: coordinate boxes from mapper</span>
          <span>·</span>
          <span>Right: test data values at those coordinates</span>
          <span className="ml-auto">Scroll both panels independently · Zoom and page sync</span>
        </div>
      </div>
    </>
  )
}
