'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MissingField } from '@/lib/compliance/types';

interface Props {
  pdfFile?: File | null;
  pdfUrl?: string | null;
  currentPage: number;
  totalPages: number;
  missingFields: MissingField[];
  onPageChange: (page: number) => void;
  onTotalPagesLoaded?: (n: number) => void;
}

const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDF_WORKER_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPdfJs(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  if (win.pdfjsLib) return win.pdfjsLib;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.onload = () => {
      win.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_CDN;
      resolve(win.pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function drawMockPDFPage(canvas: HTMLCanvasElement | null, page: number) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, W, 60);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(W, 60); ctx.stroke();
  ctx.fillStyle = '#111827';
  ctx.font = `bold ${W * 0.032}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText("SELLER'S DISCLOSURE ADDENDUM", W / 2, 32);
  ctx.font = `${W * 0.022}px sans-serif`;
  ctx.fillStyle = '#6b7280';
  ctx.fillText(`Page ${page} · Mock Preview`, W / 2, 50);
  ctx.textAlign = 'left';
  const labels = ['Property Address:', 'Year Built:', 'Seller Name:', 'HOA:', 'Roof Type:', 'HVAC Age:', 'Known Defects:', 'Water Source:'];
  const vals = ['7923 Mansfield Ave, Burbank CA', '1978', 'John & Mary Smith', 'Yes — $240/mo', 'Shingle', '8 years', 'None Known', 'Public'];
  const lineH = (H - 120) / 14;
  for (let i = 0; i < 13; i++) {
    const y = 80 + i * lineH;
    if (i % 4 === 0) {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(16, y, W - 32, lineH - 2);
      ctx.fillStyle = '#374151';
      ctx.font = `bold ${W * 0.02}px sans-serif`;
      ctx.fillText(`SECTION ${String.fromCharCode(65 + Math.floor(i / 4) + (page - 1) * 3)}`, 24, y + lineH * 0.65);
    } else {
      ctx.fillStyle = '#9ca3af';
      ctx.font = `${W * 0.019}px sans-serif`;
      ctx.fillText(labels[(page * 2 + i) % labels.length], 24, y + lineH * 0.65);
      ctx.fillStyle = '#374151';
      ctx.fillText(vals[(page * 3 + i) % vals.length], W * 0.42, y + lineH * 0.65);
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(24, y + lineH - 1); ctx.lineTo(W - 24, y + lineH - 1); ctx.stroke();
    }
  }
  const sigY = H - 70;
  ctx.strokeStyle = '#d1d5db'; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(16, sigY); ctx.lineTo(W / 2 - 8, sigY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2 + 8, sigY); ctx.lineTo(W - 16, sigY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#9ca3af'; ctx.font = `${W * 0.017}px sans-serif`;
  ctx.fillText('Seller 1 Signature', 16, sigY + 14);
  ctx.fillText('Seller 2 Signature', W / 2 + 8, sigY + 14);
  ctx.fillText('Initials _______', 16, H - 16);
  ctx.fillText('Initials _______', W / 2 + 8, H - 16);
}

// ─── Severity styles ──────────────────────────────────────────────────────────

function severityStyle(severity?: 'error' | 'warning' | 'info') {
  if (severity === 'warning') {
    return { border: '#f59e0b', bg: 'rgba(245,158,11,0.12)', badge: '#f59e0b', badgeText: '#fff' };
  }
  if (severity === 'info') {
    return { border: '#3b82f6', bg: 'rgba(59,130,246,0.10)', badge: '#3b82f6', badgeText: '#fff' };
  }
  // default = error
  return { border: '#ef4444', bg: 'rgba(239,68,68,0.13)', badge: '#ef4444', badgeText: '#fff' };
}

// Short human-readable badge from type/label
function badgeText(field: MissingField): string {
  if (field.label) return field.label.slice(0, 8);
  if (field.type === 'initial') return 'INIT';
  if (field.type === 'signature') return 'SIG';
  if (field.type === 'required') return 'REQ';
  if (field.type === 'blank') return 'BLANK';
  return 'WARN';
}

// ─── Component ────────────────────────────────────────────────────────────────

const PDFViewer: React.FC<Props> = ({ pdfFile, pdfUrl, currentPage, totalPages, missingFields, onPageChange, onTotalPagesLoaded }) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc]     = useState<any>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering]     = useState(false);
  const [docLabel, setDocLabel]       = useState<string>('');

  useEffect(() => {
    if (!pdfFile && !pdfUrl) {
      setPdfDoc(null);
      setDocLabel('');
      setRenderError(null);
      return;
    }
    let cancelled = false;
    setRenderError(null);
    setDocLabel(pdfFile ? pdfFile.name : (pdfUrl ?? ''));

    (async () => {
      try {
        const pdfjsLib = await loadPdfJs();
        let doc;
        if (pdfFile) {
          const arrayBuffer = await pdfFile.arrayBuffer();
          doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        } else if (pdfUrl) {
          const res = await fetch(pdfUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const arrayBuffer = await res.arrayBuffer();
          doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          if (!cancelled && onTotalPagesLoaded) onTotalPagesLoaded(doc.numPages);
        }
        if (!cancelled && doc) setPdfDoc(doc);
      } catch (err) {
        console.error('PDF load error', err);
        if (!cancelled) setRenderError('Could not load PDF. Please check the file and try again.');
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfFile, pdfUrl]);

  const renderPage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!pdfDoc) {
      canvas.width = 520;
      canvas.height = 674;
      canvas.style.width = '520px';
      canvas.style.height = '674px';
      drawMockPDFPage(canvas, currentPage);
      return;
    }
    try {
      setRendering(true);
      const page = await pdfDoc.getPage(currentPage);
      const containerWidth = containerRef.current?.clientWidth ?? 600;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min((containerWidth - 32) / baseViewport.width, 2.0);
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const viewport = page.getViewport({ scale: scale * dpr });

      // renderPage owns all canvas dimensions — no JSX width/height override
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width  = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
      console.error('Page render error', err);
    } finally {
      setRendering(false);
    }
  }, [pdfDoc, currentPage]);

  useEffect(() => { renderPage(); }, [renderPage]);

  const pageMissing       = missingFields.filter(f => f.page === currentPage);
  const pageErrors        = pageMissing.filter(f => !f.severity || f.severity === 'error');
  const pageWarnings      = pageMissing.filter(f => f.severity === 'warning');
  const effectiveTotalPages = pdfDoc ? pdfDoc.numPages : totalPages;

  // Per-page issue counts for nav dot colors
  const pageIssueMap: Record<number, 'error' | 'warning' | null> = {};
  for (const f of missingFields) {
    const existing = pageIssueMap[f.page];
    if (!existing) pageIssueMap[f.page] = f.severity === 'warning' ? 'warning' : 'error';
    else if (existing === 'warning' && f.severity !== 'warning') pageIssueMap[f.page] = 'error';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#e5e7eb' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#f3f4f6', borderBottom: '1px solid #d1d5db', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg style={{ width: 16, height: 16, color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>
            {docLabel || (pdfFile ? pdfFile.name : pdfUrl ? pdfUrl.split('/').pop() : 'No PDF · mock preview')}
          </span>
          {rendering && <span style={{ fontSize: 11, color: '#93c5fd' }}>Rendering…</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {pageErrors.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#dc2626' }}>
              {pageErrors.length} error{pageErrors.length !== 1 ? 's' : ''} on page
            </span>
          )}
          {pageWarnings.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fffbeb', color: '#d97706' }}>
              {pageWarnings.length} warning{pageWarnings.length !== 1 ? 's' : ''}
            </span>
          )}
          {pdfUrl && (
            <a href={pdfUrl} download target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none', padding: '2px 8px', border: '1px solid #bfdbfe', borderRadius: 6, background: '#eff6ff' }}
            >⬇ Download</a>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {renderError && (
        <div style={{ padding: '8px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', fontSize: 13, color: '#dc2626' }}>
          ⚠ {renderError}
        </div>
      )}

      {/* ── Legend ── */}
      {missingFields.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 16px', background: '#fff', borderBottom: '1px solid #f3f4f6', fontSize: 11, color: '#6b7280' }}>
          <span style={{ fontWeight: 600 }}>Overlay:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, border: '2px solid #ef4444', background: 'rgba(239,68,68,0.15)', display: 'inline-block' }} />
            Error
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, border: '2px solid #f59e0b', background: 'rgba(245,158,11,0.15)', display: 'inline-block' }} />
            Warning
          </span>
          {pageMissing.length === 0 && <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ No issues on this page</span>}
        </div>
      )}

      {/* ── Canvas + overlay ── */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
        <div style={{ position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', borderRadius: 2, display: 'inline-block' }}>
          {/* display: block prevents inline baseline gap; no width/height — owned by renderPage */}
          <canvas ref={canvasRef} style={{ display: 'block' }} />

          {/* Violation overlay boxes */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {pageMissing.map((field, idx) => {
              const style = severityStyle(field.severity);
              const badge = badgeText(field);
              return (
                <div
                  key={`${field.fieldId}-${idx}`}
                  style={{
                    position: 'absolute',
                    left:   `${field.x}%`,
                    top:    `${field.y}%`,
                    width:  `${field.w}%`,
                    height: `${field.h}%`,
                    border: `2px solid ${style.border}`,
                    background: style.bg,
                    boxSizing: 'border-box',
                    minHeight: 10,
                  }}
                  title={field.label ?? field.fieldId}
                >
                  <span style={{
                    position: 'absolute',
                    top: -17,
                    left: 0,
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    background: style.badge,
                    color: style.badgeText,
                    padding: '1px 4px',
                    borderRadius: '2px 2px 0 0',
                    whiteSpace: 'nowrap',
                    maxWidth: 100,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    pointerEvents: 'none',
                  }}>
                    {badge}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Page navigation ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: '#f3f4f6', borderTop: '1px solid #d1d5db', flexShrink: 0 }}>
        <button
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: currentPage <= 1 ? '#f9fafb' : '#fff', color: currentPage <= 1 ? '#d1d5db' : '#374151', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >←</button>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 400 }}>
          {Array.from({ length: effectiveTotalPages }, (_, i) => i + 1).map(p => {
            const issue = pageIssueMap[p];
            const isActive = p === currentPage;
            const bg = isActive ? '#3b82f6'
              : issue === 'error' ? '#fee2e2'
              : issue === 'warning' ? '#fffbeb'
              : '#e5e7eb';
            const color = isActive ? '#fff'
              : issue === 'error' ? '#dc2626'
              : issue === 'warning' ? '#d97706'
              : '#6b7280';
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                style={{
                  width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', border: 'none', background: bg, color,
                  position: 'relative',
                }}
                title={issue ? `Page ${p}: has ${issue}` : `Page ${p}`}
              >
                {p}
                {issue && !isActive && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 7, height: 7, borderRadius: '50%',
                    background: issue === 'error' ? '#dc2626' : '#f59e0b',
                    border: '1.5px solid #fff',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        <button
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: currentPage >= effectiveTotalPages ? '#f9fafb' : '#fff', color: currentPage >= effectiveTotalPages ? '#d1d5db' : '#374151', cursor: currentPage >= effectiveTotalPages ? 'not-allowed' : 'pointer', fontSize: 13 }}
          disabled={currentPage >= effectiveTotalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >→</button>
      </div>
    </div>
  );
};

export default PDFViewer;
