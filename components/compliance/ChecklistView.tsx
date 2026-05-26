'use client';

import React, { useEffect, useState } from 'react';

interface AddendaItem {
  raw_text: string;
  display_name: string;
  form_slug: string | null;
  mls_board: string | null;
}

interface ChecklistData {
  checkId: string;
  referenceId: string;
  board: string | null;
  filename: string | null;
  createdAt: string;
  checkedAddenda: AddendaItem[];
}

interface ChecklistViewProps {
  checkId?: string;
  referenceId?: string;
  /** If true, show in compact mode inside the compliance report view */
  compact?: boolean;
}

export default function ChecklistView({ checkId, referenceId, compact }: ChecklistViewProps) {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checkId && !referenceId) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (checkId) params.set('checkId', checkId);
    else if (referenceId) params.set('referenceId', referenceId);

    fetch(`/api/compliance/checklist?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [checkId, referenceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        Could not load checklist: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-sm">No checklist available.</p>
        <p className="text-xs mt-1 text-gray-400">Save the compliance check first to generate the companion documents checklist.</p>
      </div>
    );
  }

  const { checkedAddenda, board, filename, referenceId: refId } = data;

  if (checkedAddenda.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-3xl mb-3">📋</div>
        <p className="text-sm font-medium">No addenda detected</p>
        <p className="text-xs mt-1 text-gray-400">
          No companion documents were found in the ADDENDA section of this contract.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'max-w-2xl mx-auto px-4 py-6'}>
      {/* Header */}
      {!compact && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Companion Documents Checklist</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filename ? `From: ${filename}` : 'Standalone check'}{board ? ` · ${board}` : ''}
            {refId ? ` · ${refId}` : ''}
          </p>
        </div>
      )}

      {/* Summary strip */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <span className="text-amber-600 text-xl">⚠️</span>
        <div>
          <p className="text-sm font-medium text-amber-800">
            {checkedAddenda.length} companion document{checkedAddenda.length !== 1 ? 's' : ''} required
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            Verify each document is uploaded, signed, and complete.
          </p>
        </div>
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {checkedAddenda.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
          >
            {/* Checkbox icon — always "pending" (TC must verify manually) */}
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-5 h-5 rounded border-2 border-gray-300 bg-white flex items-center justify-center">
                <span className="text-gray-300 text-xs">○</span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{item.display_name}</p>
              {item.raw_text !== item.display_name && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  Contract text: &ldquo;{item.raw_text}&rdquo;
                </p>
              )}
              {item.form_slug && (
                <p className="text-xs text-blue-500 mt-0.5 font-mono">{item.form_slug}</p>
              )}
            </div>

            {/* Status badge */}
            <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
              Pending
            </span>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-400 mt-4 text-center">
        Upload each document to the deal to mark it as received. Run compliance on each addendum separately.
      </p>
    </div>
  );
}
