'use client';
import React, { useState, useRef } from 'react';
import { MLS_LIBRARY } from '@/lib/compliance/mlsLibrary';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EsigPlatform = 'dotloop' | 'docusign' | 'hellosign' | 'adobe-sign' | 'unknown';

/** A single verified e-signature hash (platform-agnostic) */
export interface EsigHash {
  signer: string;
  hash: string;
  timestamp: string;
}

/** @deprecated Use EsigHash — kept for legacy callers */
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
  severity: 'error' | 'warning' | 'info';
}

export interface VisionCheckResult {
  status: 'COMPLIANT' | 'NON-COMPLIANT';
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
    /** @deprecated use esigHashes */
    dotloopHashes?: EsigHash[];
  };
  initialsGrid: InitialsGridRow[];
  violations: VisionViolation[];
  pages: any[];
  formSlug: string;
  isDotloop: boolean;   // legacy compat alias
  numPages: number;
}

// Legacy AcroForm check result (portal submissions)
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

// ─── UploadPanel ───────────────────────────────────────────────────────────────

interface UploadPanelProps {
  onAnalyze: (mlsId: string, file: File, result: CheckResultPayload) => void;
}

type UploadState = 'idle' | 'analyzing' | 'error';

export default function UploadPanel({ onAnalyze }: UploadPanelProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [mlsId, setMlsId] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<File | null>(null);

  async function analyze(file: File) {
    fileRef.current = file;
    setState('analyzing');
    setErrorMsg('');

    // Simulate page progress messages (real progress comes from server)
    let pageCounter = 0;
    const progressInterval = setInterval(() => {
      pageCounter++;
      setProgress(`Analyzing page ${pageCounter} with AI vision…`);
    }, 4500);

    try {
      const fd = new FormData();
      fd.append('pdf', file);
      if (mlsId) fd.append('mlsId', mlsId);

      const res = await fetch('/api/compliance/check', { method: 'POST', body: fd });
      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Check failed');
      }

      const data: VisionCheckResult = await res.json();

      // Normalize: handle both esigHashes (new) and dotloopHashes (legacy)
      if (data.summary && !data.summary.esigHashes) {
        data.summary.esigHashes = (data.summary as any).dotloopHashes ?? [];
      }

      // Derive platform label if missing (old route compat)
      if (!data.platformLabel) {
        const labels: Record<string, string> = {
          dotloop: 'Dotloop', docusign: 'DocuSign',
          hellosign: 'HelloSign / Dropbox Sign', 'adobe-sign': 'Adobe Sign',
        };
        data.platformLabel = labels[data.platform ?? ''] ?? 'E-Signature';
      }

      // Derive form name from slug
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
      clearInterval(progressInterval);
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
            {MLS_LIBRARY.map(b => (
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
            gap: 10, padding: '40px 24px', borderRadius: 12, cursor: 'pointer',
            border: `2px dashed ${dragOver ? '#3b82f6' : '#d1d5db'}`,
            background: dragOver ? '#eff6ff' : '#f9fafb',
            transition: 'all 0.15s',
          }}
        >
          <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFileInput} />
          {state === 'analyzing' ? (
            <>
              <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13, color: '#374151', margin: 0, fontWeight: 500 }}>Running compliance check…</p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{progress || 'Uploading and fingerprinting…'}</p>
              <p style={{ fontSize: 10, color: '#d1d5db', margin: 0 }}>This may take 1–2 minutes for multi-page documents</p>
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
