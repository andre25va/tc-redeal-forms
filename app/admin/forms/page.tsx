'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Upload, FileText, MapPin, Trash2, ArrowLeft, Plus, ExternalLink, Loader2 } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

declare global {
  interface Window { pdfjsLib: any }
}

interface FormTemplate {
  id: string
  slug: string
  name: string
  page_count: number | null
  pdf_template_path: string | null
  is_active: boolean
  created_at: string
  field_count?: number
}

function nameToSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function loadPdfJs(): Promise<any> {
  if (window.pdfjsLib) return window.pdfjsLib
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    document.head.appendChild(script)
  })
}

export default function AdminFormsPage() {
  const [forms, setForms] = useState<FormTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [fillingSlug, setFillingSlug] = useState<string | null>(null)

  useEffect(() => { loadForms() }, [])

  const loadForms = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('form_templates')
      .select('*')
      .order('created_at', { ascending: false })

    const formsWithCounts = await Promise.all(
      (data || []).map(async (form: any) => {
        const { count } = await supabase
          .from('field_coordinates')
          .select('*', { count: 'exact', head: true })
          .eq('form_slug', form.slug)
        return { ...form, field_count: count || 0 }
      })
    )
    setForms(formsWithCounts)
    setLoading(false)
  }

  const handleFile = async (file: File) => {
    if (!file.type.includes('pdf')) { alert('Please upload a PDF file'); return }
    setUploadFile(file)
    setShowUpload(true)
    const pdfjsLib = await loadPdfJs()
    const buf = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
    setPageCount(pdf.numPages)
    const name = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ')
    setFormName(name)
    setFormSlug(nameToSlug(name))
  }

  const handleUpload = async () => {
    if (!uploadFile || !formSlug || !formName) return
    setUploading(true)
    try {
      const path = `${formSlug}/${formSlug}.pdf`
      const { error: storeErr } = await supabase.storage
        .from('form-templates')
        .upload(path, uploadFile, { upsert: true })
      if (storeErr) throw storeErr

      const { error: dbErr } = await supabase
        .from('form_templates')
        .upsert({ slug: formSlug, name: formName, pdf_template_path: path, page_count: pageCount, is_active: true },
          { onConflict: 'slug' })
      if (dbErr) throw dbErr

      setShowUpload(false)
      setUploadFile(null); setFormName(''); setFormSlug(''); setPageCount(0)
      await loadForms()
    } catch (err) {
      alert('Upload failed: ' + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const deleteForm = async (slug: string) => {
    if (!confirm(`Delete "${slug}" and all its field data?`)) return
    await supabase.from('field_coordinates').delete().eq('form_slug', slug)
    await supabase.from('pdf_ocr_lines').delete().eq('form_slug', slug)
    await supabase.storage.from('form-templates').remove([`${slug}/${slug}.pdf`])
    await supabase.from('form_templates').delete().eq('slug', slug)
    await loadForms()
  }

  const fillForm = async (slug: string) => {
    setFillingSlug(slug)
    try {
      const res = await fetch(`/api/invitations?form_slug=${slug}`, { method: 'POST' })
      const data = await res.json()
      if (!data.token) throw new Error(data.error || 'No token returned')
      window.open(`/forms/${data.token}`, '_blank')
    } catch (err) {
      alert('Could not open form: ' + (err as Error).message)
    } finally {
      setFillingSlug(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Form Templates</h1>
              <p className="text-xs text-gray-400">Upload PDFs, map fields, build forms</p>
            </div>
          </div>
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md cursor-pointer transition-all">
            <Plus className="w-4 h-4" /> Upload PDF
            <input type="file" accept=".pdf" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div
          className={`border-2 border-dashed rounded-2xl p-8 mb-6 text-center transition-all
            ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); e.dataTransfer.files?.[0] && handleFile(e.dataTransfer.files[0]) }}
        >
          <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Drag &amp; drop a PDF here, or click Upload above</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : forms.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No forms yet. Upload a PDF to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {forms.map(form => (
              <div key={form.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm">{form.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {form.slug} · {form.page_count || '?'} pages · {form.field_count || 0} fields
                  </p>
                </div>
                <button
                  onClick={() => fillForm(form.slug)}
                  disabled={fillingSlug === form.slug}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-60"
                >
                  {fillingSlug === form.slug
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ExternalLink className="w-4 h-4" />}
                  Fill Form
                </button>
                <Link
                  href={`/admin/forms/${form.slug}/mapper`}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-indigo-500" /> Map Fields
                </Link>
                <button
                  onClick={() => deleteForm(form.slug)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {showUpload && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="font-bold text-gray-900 text-lg mb-4">New Form Template</h2>
            <div className="bg-indigo-50 rounded-xl p-3 mb-4 flex items-center gap-3">
              <FileText className="w-8 h-8 text-indigo-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">{uploadFile?.name}</p>
                <p className="text-xs text-gray-500">{pageCount} pages</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Form Name</label>
                <input type="text" value={formName}
                  onChange={e => { setFormName(e.target.value); setFormSlug(nameToSlug(e.target.value)) }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Slug (URL-safe)</label>
                <input type="text" value={formSlug}
                  onChange={e => setFormSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowUpload(false); setUploadFile(null); setFormName(''); setFormSlug(''); setPageCount(0) }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleUpload} disabled={uploading || !formSlug || !formName}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Create Form'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
