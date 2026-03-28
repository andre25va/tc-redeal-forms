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

// Load pdfjs from CDN at runtime — completely bypasses webpack/canvas issues
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

const PDFViewer: React.FC<Props> = ({ pdfFile, pdfUrl, currentPage, totalPages, missingFields, onPageChange, onTotalPagesLoaded }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [docLabel, setDocLabel] = useState<string>('');

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
      drawMockPDFPage(canvas, currentPage);
      return;
    }
    try {
      setRendering(true);
      const page = await pdfDoc.getPage(currentPage);
      const containerWidth = containerRef.current?.clientWidth ?? 520;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min((containerWidth - 32) / baseViewport.width, 2.0);
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
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

  const pageMissing = missingFields.filter(f => f.page === currentPage);
  const effectiveTotalPages = pdfDoc ? pdfDoc.numPages : totalPages;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#e5e7eb' }}>
      {/* Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pageMissing.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#dc2626' }}>
              {pageMissing.length} issue{pageMissing.length !== 1 ? 's' : ''} on this page
            </span>
          )}
          {pdfUrl && (
            <a href={pdfUrl} download target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none', padding: '2px 8px', border: '1px solid #bfdbfe', borderRadius: 6, background: '#eff6ff' }}
            >⬇ Download</a>
          )}
        </div>
      </div>

      {/* Error */}
      {renderError && (
        <div style={{ padding: '8px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', fontSize: 13, color: '#dc2626' }}>
          ⚠ {renderError}
        </div>
      )}

      {/* Canvas + overlay */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
        <div style={{ position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', borderRadius: 2, overflow: 'visible', display: 'inline-block' }}>
          <canvas ref={canvasRef} width={520} height={674} style={{ display: 'block', width: '100%', maxWidth: 580 }} />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {pageMissing.map(field => {
              const label = field.type === 'initial' ? 'INI' : 'SIG';
              return (
                <div key={field.fieldId} style={{
                  position: 'absolute',
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  width: `${field.w}%`,
                  height: `${field.h}%`,
                  border: '2px solid #ef4444',
                  background: 'rgba(239,68,68,0.13)',
                  boxSizing: 'border-box',
                }}>
                  <span style={{
                    position: 'absolute', top: -18, left: 0,
                    fontSize: 9, fontWeight: 700, fontFamily: 'monospace',
                    background: '#ef4444', color: '#fff',
                    padding: '1px 4px', borderRadius: '2px 2px 0 0',
                    whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {label}: {field.fieldId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Page nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: '#f3f4f6', borderTop: '1px solid #d1d5db', flexShrink: 0 }}>
        <button
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: currentPage <= 1 ? '#f9fafb' : '#fff', color: currentPage <= 1 ? '#d1d5db' : '#374151', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}
          disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}
        >←</button>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 400 }}>
          {Array.from({ length: effectiveTotalPages }, (_, i) => i + 1).map(p => {
            const hasMissing = missingFields.some(f => f.page === p);
            return (
              <button key={p} onClick={() => onPageChange(p)} style={{
                width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: p === currentPage ? '#3b82f6' : hasMissing ? '#fee2e2' : '#e5e7eb',
                color: p === currentPage ? '#fff' : hasMissing ? '#dc2626' : '#6b7280',
              }}>{p}</button>
            );
          })}
        </div>
        <button
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: currentPage >= effectiveTotalPages ? '#f9fafb' : '#fff', color: currentPage >= effectiveTotalPages ? '#d1d5db' : '#374151', cursor: currentPage >= effectiveTotalPages ? 'not-allowed' : 'pointer', fontSize: 13 }}
          disabled={currentPage >= effectiveTotalPages} onClick={() => onPageChange(currentPage + 1)}
        >→</button>
      </div>
    </div>
  );
};

export default PDFViewer;
