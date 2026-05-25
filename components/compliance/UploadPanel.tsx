'use client';
import React, { useState, useRef, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EsigPlatform = 'dotloop' | 'docusign' | 'hellosign' | 'adobe-sign' | 'unknown';

export interface EsigHash {
  signer: string;
  hash: string;
  timestamp: string;
}

/** @deprecated Use EsigHash */
export type DotloopHash = EsigHash;

export interface InitialsGridRow {
  page: number;
  seller: string | null;
  buyer: string | null;
  sellerOk: boolean;
  buyerOk: boolean;
}

export interface VisionViolation {
  page: number;
  message: string;
  severity: 'error' | 'warning' | 'review' | 'info';
}

export interface VisionCheckResult {
  status: 'COMPLIANT' | 'NON-COMPLIANT' | 'NEEDS-REVIEW';
  method: 'vision-per-page-gpt4o';
  platform: EsigPlatform;
  platformLabel: string;
  summary: {
    totalPages: number;
    pagesWithBothInitials: number;
    signaturesComplete: string;
    checkboxesFilled: string;
    fieldsFilled: string;
    criticalErrors: number;
    warnings: number;
    esigHashes: EsigHash[];
    dotloopHashes?: EsigHash[];
  };
  initialsGrid: InitialsGridRow[];
  violations: VisionViolation[];
  pages: any[];
  formSlug: string;
  isDotloop: boolean;
  numPages: number;
  usedPageImages?: boolean;
}

export interface AcroCheckResult {
  passed: boolean;
  is_flattened: boolean;
  violations: any[];
  errors: number;
  warnings: number;
  fields_extracted: number;
  fields_checked: number;
}

export interface CheckResultPayload {
  form_slug: string;
  form_name: string;
  vision?: VisionCheckResult;
  acro?: AcroCheckResult;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<EsigPlatform, { bg: string; text: string; border: string }> = {
  dotloop:      { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  docusign:     { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe' },
  hellosign:    { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'adobe-sign': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  unknown:      { bg: '#f9fafb', text: '#374151', border: '#e5e7eb' },
};

export function platformBadge(platform: EsigPlatform, label: string) {
  const c = PLATFORM_COLORS[platform];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {label}
    </span>
  );
}

// ─── Render PDF pages to JPEG images using pdf.js (browser) ──────────────────

async function renderPagesToJpeg(
  file: File,
  onProgress: (page: number, total: number) => void
): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const total = pdf.numPages;
  const images: string[] = [];

  for (let pageNum = 1; pageNum <= total; pageNum++) {
    onProgress(pageNum, total);
    const page = await pdf.getPage(pageNum);

    const viewport = page.getViewport({ scale: 150 / 72 });

    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx as any, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    images.push(dataUrl.split(',')[1]);

    canvas.remove();
  }

  return images;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, label, sub }: { pct: number; label: string; sub?: string }) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        width: '100%', height: 6, borderRadius: 999,
        background: '#e5e7eb', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 999,
          background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
          width: `${Math.min(100, Math.max(2, pct))}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{Math.round(pct)}%</span>
      </div>
      {sub && <span style={{ fontSize: 11, color: '#9ca3af' }}>{sub}</span>}
    </div>
  );
}

// ─── Batched compliance check ─────────────────────────────────────────────────

const BATCH_SIZE = 4;

interface BatchContext {
  formSlug: string;
  platform: EsigPlatform;
  formProfile: { seller_count: number; buyer_count: number; initials_pages: number[] } | null;
  totalPages: number;
}

async function sendBatch(
  file: File | null,
  pageImages: string[],
  batchStart: number,
  ctx: BatchContext,
): Promise<{ pageResults: any[]; ctx: BatchContext }> {
  const fd = new FormData();

  if (file) fd.append('pdf', file);
  fd.append('batchMode', 'true');
  fd.append('batchStart', String(batchStart));
  fd.append('totalPages', String(ctx.totalPages));
  if (ctx.formSlug)    fd.append('formSlug',    ctx.formSlug);
  if (ctx.platform)    fd.append('platform',    ctx.platform);
  if (ctx.formProfile) fd.append('formProfile', JSON.stringify(ctx.formProfile));

  pageImages.forEach((img, i) => fd.append(`pageImage_${batchStart + i}`, img));

  const res = await fetch('/api/compliance/check', { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Batch check failed');
  }

  const data = await res.json();
  return {
    pageResults: data.pageResults ?? [],
    ctx: {
      formSlug:    data.formSlug    ?? ctx.formSlug,
      platform:    data.platform    ?? ctx.platform,
      formProfile: data.formProfile ?? ctx.formProfile,
      totalPages:  ctx.totalPages,
    },
  };
}

async function aggregateResults(
  pageResults: any[],
  ctx: BatchContext,
): Promise<VisionCheckResult> {
  const res = await fetch('/api/compliance/aggregate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pageResults,
      formSlug:    ctx.formSlug,
      platform:    ctx.platform,
      formProfile: ctx.formProfile,
      totalPages:  ctx.totalPages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Aggregation failed');
  }
  return res.json();
}

// ─── Board entry used for the dropdown ────────────────────────────────────────

interface BoardEntry {
  id: string;
  name: string;
  state: string;
}

// ─── UploadPanel ───────────────────────────────────────────────────────────────

interface UploadPanelProps {
  onAnalyze: (mlsId: string, file: File, result: CheckResultPayload) => void;
  initialMlsId?: string;
  initialPdfUrl?: string;
}

type UploadState = 'idle' | 'rendering' | 'analyzing' | 'aggregating' | 'error';

export default function UploadPanel({ onAnalyze, initialMlsId, initialPdfUrl }: UploadPanelProps) {
  const [state, setState]             = useState<UploadState>('idle');
  const [mlsId, setMlsId]             = useState(initialMlsId ?? '');
  const [dragOver, setDragOver]       = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [progressSub, setProgressSub]     = useState('');
  const [errorMsg, setErrorMsg]       = useState('');
  const [boardList, setBoardList]     = useState<BoardEntry[]>([]);
  const fileRef = useRef<File | null>(null);

  const [remotePdfReady, setRemotePdfReady] = useState(false);
  const remotePdfFileRef = useRef<File | null>(null);

  // Load board list from Supabase via /api/compliance/library
  useEffect(() => {
    fetch('/api/compliance/library')
      .then(r => r.ok ? r.json() : [])
      .then((boards: any[]) => {
        const entries: BoardEntry[] = boards.map(b => ({
          id:    b.id    ?? b.mls_board ?? '',
          name:  b.name  ?? b.fullName  ?? b.mls_board ?? '',
          state: b.state ?? '',
        }));
        setBoardList(entries);
      })
      .catch(() => {/* silently ignore */});
  }, []);

  useEffect(() => {
    if (!initialMlsId) return;
    setMlsId(initialMlsId);
  }, [initialMlsId]);

  useEffect(() => {
    if (!initialPdfUrl) return;
    let cancelled = false;
    async function loadRemotePdf() {
      try {
        const res = await fetch(initialPdfUrl!);
        if (!res.ok) throw new Error('Failed to fetch PDF');
        const blob = await res.blob();
        const raw = initialPdfUrl!.split('/').pop() ?? 'document.pdf';
        const filename = raw.split('?')[0] || 'document.pdf';
        const file = new File([blob], filename, { type: 'application/pdf' });
        if (!cancelled) {
          remotePdfFileRef.current = file;
          setRemotePdfReady(true);
        }
      } catch (e) {
        console.error('[UploadPanel] failed to load remote PDF:', e);
      }
    }
    loadRemotePdf();
    return () => { cancelled = true; };
  }, [initialPdfUrl]);

  async function analyze(file: File) {
    fileRef.current = file;
    setErrorMsg('');
    setProgressPct(0);

    try {
      setState('rendering');
      setProgressLabel('Rendering pages for AI vision…');
      setProgressSub('');

      const pageImages = await renderPagesToJpeg(file, (page, total) => {
        setProgressPct((page / total) * 40);
        setProgressSub(`Page ${page} of ${total}`);
      });

      const totalPages = pageImages.length;

      setState('analyzing');

      const batches: string[][] = [];
      for (let i = 0; i < totalPages; i += BATCH_SIZE) {
        batches.push(pageImages.slice(i, i + BATCH_SIZE));
      }

      let allPageResults: any[] = [];
      let batchCtx: BatchContext = {
        formSlug:    '',
        platform:    'unknown',
        formProfile: null,
        totalPages,
      };

      for (let bi = 0; bi < batches.length; bi++) {
        const batchStart = bi * BATCH_SIZE + 1;
        const batchEnd   = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
        const isFirst    = bi === 0;

        setProgressLabel(`Analyzing pages ${batchStart}–${batchEnd} of ${totalPages}…`);
        setProgressSub(`Batch ${bi + 1} of ${batches.length} · AI vision`);
        setProgressPct(40 + (bi / batches.length) * 50);

        const { pageResults, ctx } = await sendBatch(
          isFirst ? file : null,
          batches[bi],
          batchStart,
          batchCtx,
        );

        allPageResults = allPageResults.concat(pageResults);
        batchCtx = ctx;
      }

      setState('aggregating');
      setProgressLabel('Building compliance report…');
      setProgressSub('');
      setProgressPct(92);

      const data = await aggregateResults(allPageResults, batchCtx);
      setProgressPct(100);

      if (data.summary && !data.summary.esigHashes) {
        data.summary.esigHashes = (data.summary as any).dotloopHashes ?? [];
      }
      if (!data.platformLabel) {
        const labels: Record<string, string> = {
          dotloop: 'Dotloop', docusign: 'DocuSign',
          hellosign: 'HelloSign / Dropbox Sign', 'adobe-sign': 'Adobe Sign',
        };
        data.platformLabel = labels[data.platform ?? ''] ?? 'E-Signature';
      }

      const formName = (data.formSlug ?? '')
        .split('-')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') || 'Uploaded Contract';

      onAnalyze(mlsId, file, {
        form_slug: data.formSlug ?? '',
        form_name: formName,
        vision: data,
      });

    } catch (err: any) {
      setErrorMsg(err.message ?? 'Something went wrong');
      setState('error');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') analyze(f);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) analyze(f);
  }

  const isLoading = state === 'rendering' || state === 'analyzing' || state === 'aggregating';

  const phaseLabel: Record<UploadState, string> = {
    idle:        '',
    rendering:   'Preparing pages…',
    analyzing:   'Running AI analysis…',
    aggregating: 'Finalizing report…',
    error:       '',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* MLS selector */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            MLS Board <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
          </label>
          <select
            value={mlsId}
            onChange={e => setMlsId(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, color: '#374151', background: '#fff' }}
          >
            <option value="">— Select MLS board —</option>
            {boardList.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.state})</option>
            ))}
          </select>
        </div>

        {/* Drop zone */}
        <label
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '32px 24px', borderRadius: 12, cursor: isLoading ? 'default' : 'pointer',
            border: `2px dashed ${dragOver ? '#3b82f6' : '#d1d5db'}`,
            background: dragOver ? '#eff6ff' : '#f9fafb',
            transition: 'all 0.15s',
          }}
        >
          <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFileInput} disabled={isLoading} />

          {remotePdfReady && !isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
              <div style={{ padding: '10px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', width: '100%', textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#15803d', margin: 0 }}>✓ PDF loaded from myredeal</p>
                <p style={{ fontSize: 11, color: '#4ade80', margin: '2px 0 0' }}>{remotePdfFileRef.current?.name}</p>
              </div>
              <button
                onClick={() => remotePdfFileRef.current && analyze(remotePdfFileRef.current)}
                style={{ padding: '10px 24px', borderRadius: 8, background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Run Vision Compliance Check
              </button>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>or drop / upload a different PDF below</p>
            </div>
          )}

          {isLoading ? (
            <>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                color: '#6366f1', textTransform: 'uppercase',
              }}>
                {phaseLabel[state]}
              </div>
              <div style={{ width: '100%' }}>
                <ProgressBar pct={progressPct} label={progressLabel} sub={progressSub} />
              </div>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, textAlign: 'center' }}>
                {state === 'analyzing'
                  ? 'GPT-4o reads each page — may take 30–90s for long documents'
                  : state === 'aggregating'
                  ? 'Almost there…'
                  : ''}
              </p>
            </>
          ) : (
            <>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: 0 }}>Drop a PDF to check compliance</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
                  Works with Dotloop, DocuSign, Adobe Sign, HelloSign, or any PDF
                </p>
              </div>
              {state === 'error' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', width: '100%' }}>
                  <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>⚠ {errorMsg}</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>Click or drop another file to retry</p>
                </div>
              )}
            </>
          )}
        </label>

        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', margin: 0 }}>
          AI reads each page with GPT-4o — initials, signatures, fields, checkboxes
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
