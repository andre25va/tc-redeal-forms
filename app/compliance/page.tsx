'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Download, BookOpen, CheckSquare, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, ShieldCheck, Clock } from 'lucide-react';

import UploadPanel, {
  CheckResultPayload, VisionCheckResult, VisionViolation, InitialsGridRow, EsigHash, EsigPlatform, platformBadge,
} from '@/components/compliance/UploadPanel';
import LibraryView from '@/components/compliance/LibraryView';
import { ViewPage, MissingField } from '@/lib/compliance/types';
import CheckHistoryView from '@/components/compliance/CheckHistoryView';
import { MLS_LIBRARY } from '@/lib/compliance/mlsLibrary';

const PDFViewer = dynamic(() => import('@/components/compliance/PDFViewer'), { ssr: false });

// ─── InitialsGrid ─────────────────────────────────────────────────────────────

function InitialsGrid({ grid }: { grid: InitialsGridRow[] }) {
  const [expanded, setExpanded] = useState(true);
  const failCount = grid.filter(r => !r.sellerOk || !r.buyerOk).length;

  return (
    <div style={{ borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {expanded ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Page Initials</span>
          {failCount > 0
            ? <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: 10 }}>{failCount} missing</span>
            : <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: 10 }}>All present</span>
          }
        </div>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{grid.length} pages</span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', maxHeight: 260, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '4px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Page</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Seller</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Buyer</th>
              </tr>
            </thead>
            <tbody>
              {grid.map(row => (
                <tr key={row.page} style={{ borderTop: '1px solid #f3f4f6', background: (!row.sellerOk || !row.buyerOk) ? '#fff5f5' : 'transparent' }}>
                  <td style={{ padding: '4px 10px', color: '#374151', fontWeight: 500 }}>{row.page}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    {row.sellerOk
                      ? <span style={{ color: '#16a34a' }}>{row.seller ?? '✓'}</span>
                      : <span style={{ color: '#dc2626', fontWeight: 700 }}>✗</span>
                    }
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    {row.buyerOk
                      ? <span style={{ color: '#16a34a' }}>{row.buyer ?? '✓'}</span>
                      : <span style={{ color: '#dc2626', fontWeight: 700 }}>✗</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── EsigHashesPanel ─────────────────────────────────────────────────────────

function EsigHashesPanel({ hashes, platformLabel }: { hashes: EsigHash[]; platformLabel: string }) {
  const [expanded, setExpanded] = useState(true);

  if (hashes.length === 0) return (
    <div style={{ borderRadius: 10, border: '1px solid #fde68a', background: '#fffbeb', padding: '10px 12px' }}>
      <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>
        ⚠ No {platformLabel} verification hashes found — manual signature review required
      </p>
    </div>
  );

  return (
    <div style={{ borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {expanded ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{platformLabel} Verification</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: 10 }}>
            {hashes.length} verified
          </span>
        </div>
      </button>
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6' }}>
          {hashes.map((h, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={12} color="#16a34a" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', flex: 1 }}>{h.signer}</span>
                {h.timestamp && <span style={{ fontSize: 10, color: '#9ca3af' }}>{h.timestamp}</span>}
              </div>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', paddingLeft: 18 }}>{h.hash}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ViolationsPanel ──────────────────────────────────────────────────────────

function ViolationsPanel({ violations, currentPage, onPageClick, hasCoordinates }: {
  violations: VisionViolation[];
  currentPage: number;
  onPageClick: (page: number) => void;
  hasCoordinates: boolean;
}) {
  const errors   = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');
  const reviews  = violations.filter(v => v.severity === 'review' || v.severity === 'info');

  if (violations.length === 0) return (
    <div style={{ borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', padding: '10px 12px' }}>
      <p style={{ fontSize: 12, color: '#16a34a', margin: 0, fontWeight: 600 }}>✓ No violations found</p>
    </div>
  );

  const renderGroup = (items: VisionViolation[], color: string, bg: string, border: string, icon: React.ReactNode) =>
    items.map((v, i) => (
      <button
        key={i}
        onClick={() => onPageClick(v.page)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px',
          borderRadius: 8, textAlign: 'left', cursor: 'pointer', width: '100%',
          background: currentPage === v.page ? bg : '#fff',
          border: `1px solid ${currentPage === v.page ? border : '#f3f4f6'}`,
          marginBottom: 3,
        }}
      >
        <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <span style={{ fontSize: 11, color, flex: 1 }}>{v.message}</span>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>p.{v.page}</span>
      </button>
    ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {hasCoordinates && (
        <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 1, border: '2px solid #ef4444', display: 'inline-block' }} /> Error
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 1, border: '2px solid #f59e0b', display: 'inline-block' }} /> Warning
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 1, border: '2px solid #3b82f6', display: 'inline-block' }} /> Review
          </span>
        </p>
      )}
      {errors.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#dc2626', marginBottom: 4 }}>
            {errors.length} Error{errors.length !== 1 ? 's' : ''}
          </p>
          {renderGroup(errors, '#dc2626', '#fff5f5', '#fecaca', <XCircle size={12} color="#dc2626" />)}
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#d97706', marginBottom: 4 }}>
            {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
          </p>
          {renderGroup(warnings, '#92400e', '#fffbeb', '#fde68a', <AlertTriangle size={12} color="#d97706" />)}
        </div>
      )}
      {reviews.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2563eb', marginBottom: 4 }}>
            {reviews.length} Need{reviews.length !== 1 ? '' : 's'} Review
          </p>
          {renderGroup(reviews, '#1d4ed8', '#eff6ff', '#bfdbfe', <AlertTriangle size={12} color="#3b82f6" />)}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function CompliancePageInner() {
  const [view, setView]             = useState<ViewPage>('upload');
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfFile, setPdfFile]       = useState<File | null>(null);
  const [payload, setPayload]       = useState<CheckResultPayload | null>(null);
  const [mlsId, setMlsId]           = useState('');
  const [exporting, setExporting]   = useState(false);
  const [writingBack, setWritingBack] = useState(false);

  // ── URL params (passed from myredeal TC app via signed URL handoff) ────────
  const searchParams    = useSearchParams();
  const pdfUrlParam     = searchParams.get('pdfUrl');
  const dealIdParam     = searchParams.get('dealId');
  const documentIdParam = searchParams.get('documentId');
  const boardParam      = searchParams.get('board');
  const isLinkedMode    = !!dealIdParam;

  async function handleExport() {
    if (!pdfFile || !payload) return;
    const vision = payload.vision as VisionCheckResult | undefined;
    if (!vision) return;
    setExporting(true);
    try {
      const reader = new FileReader();
      const pdfBase64: string = await new Promise((res, rej) => {
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(pdfFile);
      });
      const { summary, initialsGrid, violations } = vision;
      const platform      = (vision.platform ?? 'unknown') as EsigPlatform;
      const platformLabel = vision.platformLabel ?? 'E-Signature';
      const esigHashes: EsigHash[] = summary.esigHashes ?? (summary as any).dotloopHashes ?? [];
      const rawBoxes: any[] = (vision as any).violationBoxes ?? [];

      const res = await fetch('/api/compliance/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          formName: payload.form_name,
          status: vision.status,
          platformLabel,
          summary,
          violations,
          violationBoxes: rawBoxes,
          initialsGrid,
          esigHashes,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[export]', e);
      alert('Export failed — see console for details.');
    } finally {
      setExporting(false);
    }
  }

  const NavBar = ({ active }: { active: ViewPage }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {(['upload', 'history', 'library'] as ViewPage[]).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: active === v ? '#eff6ff' : 'transparent',
            color: active === v ? '#1d4ed8' : '#6b7280',
          }}>
            {v === 'upload' ? <><CheckSquare size={14} /> Check</> : v === 'history' ? <><Clock size={14} /> History</> : <><BookOpen size={14} /> Library</>}
          </button>
        ))}
      </div>
      <span style={{ fontSize: 11, color: '#d1d5db', fontFamily: 'monospace' }}>myredeal compliance</span>
    </div>
  );

  if (view === 'upload') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <NavBar active="upload" />
      {/* Linked-mode banner — shown when opened from myredeal TC app */}
      {isLinkedMode && (
        <div style={{
          background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
          padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: '#1d4ed8', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700 }}>🔗 Linked to myredeal</span>
          <span style={{ color: '#60a5fa' }}>—</span>
          <span>Results will be saved to this deal automatically after the check completes</span>
          {writingBack && <span style={{ marginLeft: 8, color: '#3b82f6' }}>Saving…</span>}
        </div>
      )}

      <UploadPanel
        initialMlsId={boardParam ?? undefined}
        initialPdfUrl={pdfUrlParam ?? undefined}
        onAnalyze={async (mls, file, result) => {
          setPdfFile(file);
          setPayload(result);
          setMlsId(mls);
          setCurrentPage(1);
          setView('report' as ViewPage);

          // ── Write-back to Supabase if opened from myredeal TC app ──────────
          if (dealIdParam) {
            setWritingBack(true);
            try {
              const vision = result.vision;
              const saveRes = await fetch('/api/compliance/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  dealId:         dealIdParam,
                  documentId:     documentIdParam || null,
                  passedCount:    vision?.summary?.pagesWithBothInitials ?? 0,
                  violationCount: vision?.summary?.criticalErrors         ?? 0,
                  warningCount:   vision?.summary?.warnings               ?? 0,
                  results:        result,
                }),
              });
              if (!saveRes.ok) {
                const errText = await saveRes.text();
                console.error('[compliance] write-back failed:', errText);
              }
            } catch (err) {
              console.error('[compliance] write-back failed:', err);
            } finally {
              setWritingBack(false);
            }
          }
        }}
      />
    </div>
  );

  if (view === 'history') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <NavBar active="history" />
      <CheckHistoryView />
    </div>
  );

  if (view === 'library') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <NavBar active="library" />
      <LibraryView />
    </div>
  );

  // ─── Report view ───────────────────────────────────────────────────────────

  if (!payload) { setView('upload'); return null; }

  const vision = payload.vision as VisionCheckResult | undefined;
  const mlsBoard = MLS_LIBRARY.find(b => b.id === mlsId);

  const reset = () => { setView('upload'); setPayload(null); setPdfFile(null); };

  if (vision) {
    const { summary, initialsGrid, violations } = vision;
    const isCompliant    = vision.status === 'COMPLIANT';
    const needsReview    = vision.status === 'NEEDS-REVIEW';
    const reviewCount    = (summary as any).reviewItems ?? violations.filter((v: VisionViolation) => v.severity === 'review').length;
    const platform      = (vision.platform ?? 'unknown') as EsigPlatform;
    const platformLabel = vision.platformLabel ?? 'E-Signature';
    const hasCoordinates = (vision as any).hasCoordinates ?? false;

    // Build MissingField[] from violationBoxes (returned by check route)
    const rawBoxes: any[] = (vision as any).violationBoxes ?? [];
    const missingFields: MissingField[] = rawBoxes.map((b: any) => ({
      fieldId:  b.fieldId,
      page:     b.page,
      x:        b.x,
      y:        b.y,
      w:        b.w,
      h:        b.h,
      type:     b.type ?? 'required',
      severity: b.severity ?? 'error',
      label:    b.label,
    }));

    // Normalize esigHashes (handle both old dotloopHashes and new esigHashes)
    const esigHashes: EsigHash[] = summary.esigHashes ?? (summary as any).dotloopHashes ?? [];

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb', fontFamily: 'sans-serif' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setView('upload')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'transparent', color: '#6b7280' }}><CheckSquare size={14} /> Check</button>
              <button onClick={() => setView('library')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'transparent', color: '#6b7280' }}><BookOpen size={14} /> Library</button>
            </div>
            {mlsBoard && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>
                {mlsBoard.name} <span style={{ fontWeight: 400, color: '#93c5fd' }}>{mlsBoard.state}</span>
              </span>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{payload.form_name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {platformBadge(platform, platformLabel)}
            {isCompliant
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 700 }}><CheckCircle2 size={12} /> COMPLIANT</span>
              : needsReview
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 700 }}><AlertTriangle size={12} /> NEEDS REVIEW</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700 }}><XCircle size={12} /> NON-COMPLIANT</span>
            }
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: exporting ? '#f3f4f6' : '#ffffff', cursor: exporting ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, color: exporting ? '#9ca3af' : '#6b7280' }}
            >
              <Download size={12} /> {exporting ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* ── Sub-banner ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', flexWrap: 'wrap',
          background: isCompliant ? '#f0fdf4' : needsReview ? '#eff6ff' : '#fef2f2',
          borderBottom: `1px solid ${isCompliant ? '#bbf7d0' : needsReview ? '#bfdbfe' : '#fecaca'}`,
          fontSize: 12,
        }}>
          <span style={{ fontWeight: 700, color: isCompliant ? '#15803d' : needsReview ? '#1d4ed8' : '#dc2626' }}>
            {isCompliant
              ? '✓ COMPLIANT'
              : needsReview
              ? `◎ NEEDS REVIEW — ${reviewCount} item${reviewCount !== 1 ? 's' : ''} flagged for human review`
              : `✗ NON-COMPLIANT — ${summary.criticalErrors} error${summary.criticalErrors !== 1 ? 's' : ''}`
            }
          </span>
          <span style={{ color: '#d1d5db' }}>·</span>
          <span style={{ color: '#6b7280' }}>{summary.pagesWithBothInitials}/{summary.totalPages} pages initialed</span>
          <span style={{ color: '#d1d5db' }}>·</span>
          <span style={{ color: '#6b7280' }}>Sigs: {summary.signaturesComplete}</span>
          <span style={{ color: '#d1d5db' }}>·</span>
          <span style={{ color: '#6b7280' }}>Verified: {esigHashes.length}</span>
          {hasCoordinates && (
            <>
              <span style={{ color: '#d1d5db' }}>·</span>
              <span style={{ color: '#6b7280' }}>{missingFields.length} field{missingFields.length !== 1 ? 's' : ''} highlighted on PDF</span>
            </>
          )}
          <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>AI vision · gpt-4o</span>
          <button onClick={reset} style={{ marginLeft: 'auto', fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            ← New check
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left panel — report */}
          <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #e5e7eb', overflowY: 'auto', padding: 12, background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Summary stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                {
                  label: 'Pages initialed',
                  value: `${summary.pagesWithBothInitials}/${summary.totalPages}`,
                  status: summary.pagesWithBothInitials === summary.totalPages ? 'ok' : 'error',
                },
                {
                  label: 'Signatures',
                  value: summary.signaturesComplete,
                  status: summary.signaturesComplete.split('/')[0] === summary.signaturesComplete.split('/')[1] ? 'ok' : 'error',
                },
                {
                  label: 'Fields filled',
                  value: summary.fieldsFilled,
                  status: summary.criticalErrors === 0 ? 'ok' : 'error',
                },
                {
                  label: `${platformLabel} hashes`,
                  value: String(esigHashes.length),
                  status: esigHashes.length > 0 ? 'ok' : 'warning',
                },
                {
                  label: 'Needs review',
                  value: String(reviewCount),
                  status: reviewCount === 0 ? 'ok' : 'review',
                },
                {
                  label: 'Warnings',
                  value: String(summary.warnings ?? 0),
                  status: (summary.warnings ?? 0) === 0 ? 'ok' : 'warning',
                },
              ].map(s => {
                const borderColor = s.status === 'ok' ? '#d1fae5' : s.status === 'review' ? '#bfdbfe' : s.status === 'warning' ? '#fde68a' : '#fee2e2';
                const textColor   = s.status === 'ok' ? '#16a34a' : s.status === 'review' ? '#2563eb' : s.status === 'warning' ? '#d97706' : '#dc2626';
                return (
                  <div key={s.label} style={{ borderRadius: 8, padding: '8px 10px', background: '#fff', border: `1px solid ${borderColor}` }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: textColor, margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Initials grid */}
            {initialsGrid.length > 0 && <InitialsGrid grid={initialsGrid} />}

            {/* E-sig hashes */}
            <EsigHashesPanel hashes={esigHashes} platformLabel={platformLabel} />

            {/* Violations */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', marginBottom: 6 }}>Issues</p>
              {violations.length > 0 ? (
                <ViolationsPanel
                  violations={violations}
                  currentPage={currentPage}
                  onPageClick={setCurrentPage}
                  hasCoordinates={hasCoordinates}
                />
              ) : (
                <div style={{ borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', padding: '12px', textAlign: 'center' }}>
                  <ShieldCheck size={20} color="#16a34a" style={{ margin: '0 auto 4px' }} />
                  <p style={{ fontSize: 12, color: '#16a34a', margin: 0, fontWeight: 600 }}>All checks passed</p>
                  <p style={{ fontSize: 11, color: '#86efac', margin: 0 }}>No issues found in this document</p>
                </div>
              )}
            </div>
          </div>

          {/* Right panel — PDF viewer with overlay boxes */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <PDFViewer
              pdfFile={pdfFile}
              currentPage={currentPage}
              totalPages={vision.numPages}
              missingFields={missingFields}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>
    );
  }

  // Legacy AcroForm path — redirect
  reset();
  return null;
}

// ─── Default export: wraps inner component in Suspense ───────────────────────
// Required because useSearchParams() needs a Suspense boundary in Next.js 13+

function CompliancePageFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Loading compliance checker…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function CompliancePage() {
  return (
    <Suspense fallback={<CompliancePageFallback />}>
      <CompliancePageInner />
    </Suspense>
  );
}
