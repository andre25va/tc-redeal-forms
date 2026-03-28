'use client';
import React, { useState, useRef } from 'react';
import { MLS_LIBRARY } from '@/lib/compliance/mlsLibrary';

interface Props {
  onAnalyze: (mlsId: string, file: File) => void;
}

const UploadPanel: React.FC<Props> = ({ onAnalyze }) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedMls, setSelectedMls] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const states = Array.from(new Set(MLS_LIBRARY.map(b => b.state))).sort();
  const boardsForState = selectedState ? MLS_LIBRARY.filter(b => b.state === selectedState) : [];
  const mls = MLS_LIBRARY.find(b => b.id === selectedMls) ?? null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') setFile(dropped);
  };

  const handleAnalyze = () => {
    if (!file || !selectedMls) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onAnalyze(selectedMls, file);
    }, 2200);
  };

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
          <p className="text-gray-400 text-sm">Upload a signed PDF package to verify all signatures and initials</p>
        </div>

        {/* State + MLS selectors */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">State</label>
          <select
            value={selectedState}
            onChange={e => { setSelectedState(e.target.value); setSelectedMls(''); }}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          >
            <option value="">— Select a state —</option>
            {states.map(s => (<option key={s} value={s}>{s}</option>))}
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
                {boardsForState.map(b => (<option key={b.id} value={b.id}>{b.name} — {b.fullName}</option>))}
              </select>
            </>
          )}

          {mls && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-white border border-gray-200 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-700">{mls.fullName}</p>
                <p className="text-[11px] text-gray-400">{mls.region} · {mls.forms.length} form templates in library</p>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">{mls.forms.length} forms</span>
            </div>
          )}
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            dragging ? 'border-blue-500 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/40'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
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
              <p className="text-xs text-gray-300">Click to change file</p>
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
              <p className="text-xs text-gray-300">Supports DocuSign · Dotloop · Adobe Sign · Full packages</p>
            </div>
          )}
        </div>

        <button
          className={`w-full mt-4 py-3 px-6 rounded-xl font-semibold text-sm transition-all ${
            !file || !selectedMls || loading
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
          }`}
          onClick={handleAnalyze}
          disabled={!file || !selectedMls || loading}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Analyzing {mls?.name} package…
            </span>
          ) : !selectedMls ? 'Select a state and MLS board to continue' : `Run Compliance Check → ${mls?.name}`}
        </button>
      </div>
    </div>
  );
};

export default UploadPanel;
