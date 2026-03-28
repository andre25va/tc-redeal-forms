'use client';
import React, { useRef, useEffect } from 'react';
import { MissingField } from '@/lib/compliance/types';

interface Props {
  currentPage: number;
  totalPages: number;
  missingFields: MissingField[];
  onPageChange: (page: number) => void;
}

function drawMockPDFPage(canvas: HTMLCanvasElement, page: number, missingFields: MissingField[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, W, H);
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, W, 60);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 60);
  ctx.lineTo(W, 60);
  ctx.stroke();
  ctx.fillStyle = '#111827';
  ctx.font = `bold ${W * 0.035}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText("SELLER'S DISCLOSURE ADDENDUM", W / 2, 30);
  ctx.font = `${W * 0.025}px sans-serif`;
  ctx.fillStyle = '#6b7280';
  ctx.fillText(`Page ${page} of 8`, W / 2, 48);
  ctx.textAlign = 'left';
  const lineColor = '#e5e7eb';
  const labelColor = '#9ca3af';
  const lineHeight = (H - 80) / 18;
  const sections: Record<number, string[]> = {
    1: ['A. PROPERTY INFORMATION', 'B. OCCUPANCY', 'C. STRUCTURAL'],
    2: ['D. ROOF', 'E. PLUMBING', 'F. ELECTRICAL'],
    3: ['G. HVAC', 'H. HAZARDOUS', 'I. ENVIRONMENTAL'],
  };
  const labels = ['Property Address:', 'Year Built:', 'Seller Name:', 'Listing Price:', 'Occupancy Status:', 'Water Source:', 'Roof Type:', 'HVAC Age:', 'Known Defects:', 'HOA:', 'Monthly Dues:', 'Last Inspection:'];
  const vals = ['7923 Mansfield Ave, Burbank CA 91505', '1978', 'John & Mary Smith', '$850,000', 'Owner Occupied', 'Public', 'Shingle', '8 years', 'None Known', 'Yes', '$240/mo', '2023'];
  for (let i = 0; i < 16; i++) {
    const y = 80 + i * lineHeight;
    const isSection = i % 5 === 0;
    if (isSection) {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(20, y - 2, W - 40, lineHeight - 4);
      ctx.fillStyle = '#374151';
      ctx.font = `bold ${W * 0.022}px sans-serif`;
      const sectionList = sections[Math.min(page, 3)] || ['SECTION'];
      ctx.fillText(sectionList[Math.floor(i / 5)] || 'SECTION', 28, y + lineHeight * 0.6);
    } else {
      ctx.fillStyle = labelColor;
      ctx.font = `${W * 0.02}px sans-serif`;
      ctx.fillText(labels[(page * 3 + i) % labels.length], 28, y + lineHeight * 0.55);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W * 0.4, y + lineHeight * 0.75);
      ctx.lineTo(W - 20, y + lineHeight * 0.75);
      ctx.stroke();
      if (i % 3 !== 1) {
        ctx.fillStyle = '#374151';
        ctx.font = `${W * 0.02}px sans-serif`;
        ctx.fillText(vals[(page * 2 + i) % vals.length], W * 0.42, y + lineHeight * 0.65);
      }
    }
  }
  const sigY = H - 80;
  ctx.strokeStyle = '#d1d5db';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(20, sigY);
  ctx.lineTo(W / 2 - 10, sigY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2 + 10, sigY);
  ctx.lineTo(W - 20, sigY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#9ca3af';
  ctx.font = `${W * 0.018}px sans-serif`;
  ctx.fillText('Seller 1 Signature', 20, sigY + 16);
  ctx.fillText('Seller 2 Signature', W / 2 + 10, sigY + 16);
  ctx.fillStyle = '#9ca3af';
  ctx.font = `${W * 0.016}px sans-serif`;
  ctx.fillText('Initials ______', 20, H - 20);
  ctx.fillText('Initials ______', W / 2 + 10, H - 20);
  missingFields.forEach(field => {
    const x = (field.x / 100) * W;
    const y = (field.y / 100) * H;
    const w = (field.w / 100) * W;
    const h = (field.h / 100) * H;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    const typeLabel = field.type === 'initial' ? 'INI' : 'SIG';
    const tagText = `${typeLabel}: ${field.fieldId}`;
    const fontSize = Math.max(9, W * 0.016);
    ctx.font = `bold ${fontSize}px monospace`;
    const tagW = Math.min(ctx.measureText(tagText).width + 8, w + 40);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x, y - 18, tagW, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tagText, x + 4, y - 5);
  });
}

const PDFViewer: React.FC<Props> = ({ currentPage, totalPages, missingFields, onPageChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageMissing = missingFields.filter(f => f.page === currentPage);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawMockPDFPage(canvas, currentPage, pageMissing);
  }, [currentPage, missingFields]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#f3f4f6', borderBottom: '1px solid #d1d5db' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg style={{ width: 16, height: 16, opacity: 0.4 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>sellers-disclosure-signed.pdf</span>
        </div>
        {pageMissing.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#dc2626' }}>
            {pageMissing.length} issue{pageMissing.length !== 1 ? 's' : ''} on this page
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
        <div style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.15)', borderRadius: 2, overflow: 'hidden', width: '100%', maxWidth: 520 }}>
          <canvas
            ref={canvasRef}
            width={520}
            height={674}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: '#f3f4f6', borderTop: '1px solid #d1d5db' }}>
        <button
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: currentPage <= 1 ? '#f9fafb' : '#fff', color: currentPage <= 1 ? '#d1d5db' : '#374151', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >←</button>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
            const hasMissing = missingFields.some(f => f.page === p);
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                style={{
                  width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: p === currentPage ? '#3b82f6' : hasMissing ? '#fee2e2' : '#e5e7eb',
                  color: p === currentPage ? '#fff' : hasMissing ? '#dc2626' : '#6b7280',
                }}
              >{p}</button>
            );
          })}
        </div>
        <button
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: currentPage >= totalPages ? '#f9fafb' : '#fff', color: currentPage >= totalPages ? '#d1d5db' : '#374151', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', fontSize: 13 }}
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >→</button>
      </div>
    </div>
  );
};

export default PDFViewer;
