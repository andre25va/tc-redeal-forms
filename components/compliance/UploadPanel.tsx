'use client';
import React, { useState, useRef } from 'react';
import { MLS_LIBRARY } from '@/lib/compliance/mlsLibrary';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DotloopHash {
  signer: string;
  hash: string;
  timestamp: string;
}

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
  summary: {
    totalPages: number;
    pagesWithBothInitials: number;
    signaturesComplete: string;
    checkboxesFilled: string;
    fieldsFilled: string;
    criticalErrors: number;
    warnings: number;
    dotloopHashes: DotloopHash[];
  };
  initialsGrid: InitialsGridRow[];
  violations: VisionViolation[];
  pages: any[];
  formSlug: string;
  isDotloop: boolean;
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
  page_count: number;
  detected_fields: number;
  // one of these is populated depending on which path ran
  check?: AcroCheckResult;
  vision?: VisionCheckResult;
}

interface Props {
  onAnalyze: (mlsId: string, file: File, result: CheckResultPayload) => void;
}

type Step = 'form' | 'fingerprinting' | 'checking' | 'picking';

interface FingerprintMatch {
  form_slug: string;
  name: string;
  confidence: number;
  page_count: number;
}

function boardStates(board: { state: string }): string[] {
  return board.state.split('/');
}

const UploadPanel: React.FC<Props> = ({ onAnalyze }) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState('');
  const [selectedMls, setSelectedMls] = useState('');
  const [matches, setMatches] = useState<FingerprintMatch[]>([]);
  const [detectedPages, setDetectedPages] = useState(0);
  const [pageProgress, setPageProgress] = useState<{ current: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const states = Array.from(
    new Set(MLS_LIBRARY.flatMap(b => boardStates(b)))
  ).sort();

  const boardsForState = selectedState
    ? MLS_LIBRARY.filter(b => boardStates(b).includes(selectedState))
    : [];

  const mls = MLS_LIBRARY.find(b => b.id === selectedMls) ?? null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') setFile(dropped);
  };

  const handleAnalyze = async () => {
    if (!file || !selectedMls) return;
    setError(null);
    setStep('fingerprinting');

    try {
      // Step 1: fingerprint the PDF
      const fpFd = new FormData();
      fpFd.append('pdf', file);
      const fpRes = await fetch('/api/compliance/fingerprint', { method: 'POST', body: fpFd });
      const fpData = await fpRes.json();
      if (fpData.error) throw new Error(fpData.error);

      setDetectedPages(fpData.detected_pages ?? 0);

      if (!fpData.matches?.length) {
        throw new Error('No matching form templates found. Make sure this PDF matches one of your form templates.');
      }

      if (fpData.matches[0].confidence >= 70) {
        await runCheck(fpData.matches[0], fpData.detected_fields ?? 0);
      } else {
        setMatches(fpData.matches);
        setStep('picking');
      }
    } catch (e: any) {
      setError(e.message);
      setStep('form');
    }
  };

  const runCheck = async (match: FingerprintMatch, detectedFieldsCount: number) => {
    setStep('checking');
    setPageProgress({ current: 0, total: match.page_count || detectedPages });

    try {
      const checkFd = new FormData();
      checkFd.append('pdf', file!);
      checkFd.append('form_slug', match.form_slug);

      // Simulate page progress while waiting (we don't have streaming)
      const total = match.page_count || detectedPages || 16;
      let fakeProgress = 0;
      const progressInterval = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + 1, total - 1);
        setPageProgress({ current: fakeProgress, total });
      }, 4000); // ~4s per page average

      const checkRes = await fetch('/api/compliance/check', { method: 'POST', body: checkFd });
      clearInterval(progressInterval);

      const checkData = await checkRes.json();
      if (checkData.error) throw new Error(checkData.error);

      setPageProgress(null);

      // Determine if this is a vision result or legacy AcroForm result
      const isVision = checkData.method === 'vision-per-page-gpt4o';

      onAnalyze(selectedMls, file!, {
        form_slug: match.form_slug,
        form_name: match.name,
        page_count: match.page_count ?? detectedPages,
        detected_fields: detectedFieldsCount,
        ...(isVision ? { vision: checkData as VisionCheckResult } : { check: checkData }),
      });
    } catch (e: any) {
      setPageProgress(null);
      setError(e.message);
      setStep('form');
    }
  };

  const isLoading = step === 'fingerprinting' || step === 'checking';

  const statusMessage = step === 'fingerprinting'
    ? 'Identifying form…'
    : step === 'checking' && pageProgress
    ? pageProgress.current === 0
      ? 'Starting AI vision analysis…'
      : `Analyzing page ${pageProgress.current} of ${pageProgress.total} with AI…`
    : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: '#f9fafb' }}>
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-gray-800">Compliance Check</span>
          </div>
          <p className="text-gray-400 text-sm">Upload a signed PDF to auto-identify the form and verify all signatures, initials, and required fields</p>
        </div>

        {/* State + MLS */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">State</label>
          <select
            value={selectedState}
            onChange={e => { setSelectedState(e.target.value); setSelectedMls(''); }}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          >
            <option value="">— Select a state —</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {selectedState && (
            <>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">MLS Board</label>
              <select
                value={selectedMls}
                onChange={e => setSelectedMls(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select MLS board —</option>
                {boardsForState.map(b => (
                  <option key={b.id} value={b.id}>{b.name} — {b.fullName}</option>
                ))}
              </select>
            </>
          )}
          {mls && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-white border border-gray-200 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-700">{mls.fullName}</p>
                <p className="text-[11px] text-gray-400">{mls.region} · {mls.state} · {mls.forms.length} form templates in library</p>
              </div>
            </div>
          )}
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            dragging ? 'border-blue-500 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/40'
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isLoading && inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(0)} KB · PDF</p>
              </div>
              {!isLoading && <p className="text-xs text-gray-300">Click to change file</p>}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Drop your PDF here</p>
                <p className="text-sm text-gray-400">or click to browse</p>
              </div>
              <p className="text-xs text-gray-300">Supports DocuSign · Dotloop · Adobe Sign</p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            ⚠ {error}
          </div>
        )}

        {/* Form picker */}
        {step === 'picking' && matches.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800 mb-3">
              Multiple possible matches for a {detectedPages}-page PDF. Select the correct form:
            </p>
            <div className="flex flex-col gap-2">
              {matches.map(m => (
                <button
                  key={m.form_slug}
                  onClick={() => runCheck(m, 0)}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-white border border-amber-200 hover:border-blue-400 hover:bg-blue-50 text-left transition-all"
                >
                  <span className="text-sm font-medium text-gray-800">{m.name}</span>
                  <span className="text-xs text-gray-400">{m.page_count}p · {m.confidence}% match</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Analyze button */}
        {step === 'form' && (
          <button
            className={`w-full mt-4 py-3 px-6 rounded-xl font-semibold text-sm transition-all ${
              !file || !selectedMls
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
            }`}
            onClick={handleAnalyze}
            disabled={!file || !selectedMls}
          >
            {!selectedMls ? 'Select a state and MLS board to continue' : `Run Compliance Check → ${mls?.name}`}
          </button>
        )}

        {/* Loading state with progress */}
        {statusMessage && (
          <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <svg className="animate-spin w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-medium text-blue-700">{statusMessage}</span>
            </div>
            {pageProgress && pageProgress.total > 0 && (
              <>
                <div className="w-full bg-blue-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.round((pageProgress.current / pageProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-blue-400 mt-1">
                  This takes about {Math.round(pageProgress.total * 4 / 60)} minute{pageProgress.total > 15 ? 's' : ''} for a {pageProgress.total}-page document
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPanel;
