'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Download, BookOpen, CheckSquare, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

import UploadPanel, {
  CheckResultPayload, VisionCheckResult, VisionViolation, InitialsGridRow, DotloopHash,
} from '@/components/compliance/UploadPanel';
import LibraryView from '@/components/compliance/LibraryView';
import { ViewPage } from '@/lib/compliance/types';
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

// ─── DotloopHashesPanel ───────────────────────────────────────────────────────

function DotloopHashesPanel({ hashes }: { hashes: DotloopHash[] }) {
  const [expanded, setExpanded] = useState(true);
  if (hashes.length === 0) return (
    <div style={{ borderRadius: 10, border: '1px solid #fde68a', background: '#fffbeb', padding: '10px 12px' }}>
      <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>⚠ No Dotloop verification hashes found — manual signature review required</p>
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
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Dotloop Verification</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: 10 }}>{hashes.length} verified</span>
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

function ViolationsPanel({ violations, currentPage, onPageClick }: {
  violations: VisionViolation[];
  currentPage: number;
  onPageClick: (page: number) => void;
}) {
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  if (violations.length === 0) return (
    <div style={{ borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', padding: '10px 12px' }}>
      <p style={{ fontSize: 12, color: '#16a34a', margin: 0, fontWeight: 600 }}>✓ No violations found</p>
    </div>
  );

  const renderGroup = (items: VisionViolation[], color: string, bg: string, border: string, icon: React.ReactNode) => (
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
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 11, color, display: 'block' }}>{v.message}</span>
        </div>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>p.{v.page}</span>
      </button>
    ))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
    </div>
  );
}

// ─── VisionSummaryBanner ──────────────────────────────────────────────────────

function VisionSummaryBanner({ vision, formName, onReset }: {
  vision: VisionCheckResult;
  formName: string;
  onReset: () => void;
}) {
  const { summary } = vision;
  const isCompliant = vision.status === 'COMPLIANT';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', flexWrap: 'wrap',
      background: isCompliant ? '#f0fdf4' : '#fef2f2',
      borderBottom: `1px solid ${isCompliant ? '#bbf7d0' : '#fecaca'}`,
      fontSize: 12,
    }}>
      <span style={{ fontWeight: 700, color: isCompliant ? '#15803d' : '#dc2626' }}>
        {isCompliant ? '✓ COMPLIANT' : `✗ NON-COMPLIANT — ${summary.criticalErrors} error${summary.criticalErrors !== 1 ? 's' : ''}`}
      </span>
      <span style={{ color: '#d1d5db' }}>·</span>
      <span style={{ color: '#6b7280' }}>Form: <strong>{formName}</strong></span>
      <span style={{ color: '#d1d5db' }}>·</span>
      <span style={{ color: '#6b7280' }}>{summary.pagesWithBothInitials}/{summary.totalPages} pages initialed</span>
      <span style={{ color: '#d1d5db' }}>·</span>
      <span style={{ color: '#6b7280' }}>Sigs: {summary.signaturesComplete}</span>
      {vision.isDotloop && (
        <>
          <span style={{ color: '#d1d5db' }}>·</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '1px 6px', borderRadius: 4 }}>Dotloop</span>
        </>
      )}
      <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>AI vision · gpt-4o</span>
      <button onClick={onReset} style={{ marginLeft: 'auto', fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
        ← New check
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [view, setView] = useState<ViewPage>('upload');
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<CheckResultPayload | null>(null);
  const [mlsId, setMlsId] = useState('');

  const NavBar = ({ active }: { active: ViewPage }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {(['upload', 'library'] as ViewPage[]).map(v => (
          <button key={v} onClick={() => setView(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: active === v ? '#eff6ff' : 'transparent', color: active === v ? '#1d4ed8' : '#6b7280' }}>
            {v === 'upload' ? <><CheckSquare size={14} /> Check</> : <><BookOpen size={14} /> Library</>}
          </button>
        ))}
      </div>
      <span style={{ fontSize: 11, color: '#d1d5db', fontFamily: 'monospace' }}>myredeal compliance</span>
    </div>
  );

  if (view === 'upload') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <NavBar active="upload" />
      <UploadPanel onAnalyze={(mls, file, result) => {
        setPdfFile(file);
        setPayload(result);
        setMlsId(mls);
        setCurrentPage(1);
        setView('report' as ViewPage);
      }} />
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

  // Vision report (Dotloop/flattened PDFs)
  if (vision) {
    const { summary, initialsGrid, violations } = vision;
    const isCompliant = vision.status === 'COMPLIANT';

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb', fontFamily: 'sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setView('upload')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'transparent', color: '#6b7280' }}><CheckSquare size={14} /> Check</button>
              <button onClick={() => setView('library')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'transparent', color: '#6b7280' }}><BookOpen size={14} /> Library</button>
            </div>
            {mlsBoard && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>{mlsBoard.name} <span style={{ fontWeight: 400, color: '#93c5fd' }}>{mlsBoard.state}</span></span>}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{payload.form_name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isCompliant
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 700 }}><CheckCircle2 size={12} /> COMPLIANT</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700 }}><XCircle size={12} /> NON-COMPLIANT</span>
            }
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#ffffff', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#6b7280' }}><Download size={12} /> Export</button>
          </div>
        </div>

        <VisionSummaryBanner vision={vision} formName={payload.form_name} onReset={reset} />

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left panel — report */}
          <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #e5e7eb', overflowY: 'auto', padding: 12, background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Pages initialed', value: `${summary.pagesWithBothInitials}/${summary.totalPages}`, ok: summary.pagesWithBothInitials === summary.totalPages },
                { label: 'Signatures', value: summary.signaturesComplete, ok: summary.signaturesComplete.split('/')[0] === summary.signaturesComplete.split('/')[1] },
                { label: 'Fields filled', value: summary.fieldsFilled, ok: summary.criticalErrors === 0 },
                { label: 'Dotloop hashes', value: String(summary.dotloopHashes.length), ok: summary.dotloopHashes.length > 0 },
              ].map(s => (
                <div key={s.label} style={{ borderRadius: 8, padding: '8px 10px', background: '#fff', border: `1px solid ${s.ok ? '#d1fae5' : '#fee2e2'}` }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: s.ok ? '#16a34a' : '#dc2626', margin: 0 }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Initials grid */}
            {initialsGrid.length > 0 && <InitialsGrid grid={initialsGrid} />}

            {/* Dotloop hashes */}
            <DotloopHashesPanel hashes={summary.dotloopHashes} />

            {/* Violations */}
            {violations.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', marginBottom: 6 }}>Issues</p>
                <ViolationsPanel violations={violations} currentPage={currentPage} onPageClick={setCurrentPage} />
              </div>
            )}

            {violations.length === 0 && (
              <div style={{ borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', padding: '12px', textAlign: 'center' }}>
                <CheckCircle2 size={20} color="#16a34a" style={{ margin: '0 auto 4px' }} />
                <p style={{ fontSize: 12, color: '#16a34a', margin: 0, fontWeight: 600 }}>All checks passed</p>
                <p style={{ fontSize: 11, color: '#86efac', margin: 0 }}>No issues found in this document</p>
              </div>
            )}
          </div>

          {/* Right panel — PDF viewer */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <PDFViewer
              pdfFile={pdfFile}
              currentPage={currentPage}
              totalPages={vision.numPages}
              missingFields={[]}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── Legacy AcroForm report (unchanged) ────────────────────────────────────
  // (kept for portal submissions that use AcroForm path)
  // Redirect to upload if no data
  reset();
  return null;
}
