'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Download, BookOpen, CheckSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';

import UploadPanel, { CheckResultPayload } from '@/components/compliance/UploadPanel';
import PartyCard from '@/components/compliance/PartyCard';
import ContractTabs from '@/components/compliance/ContractTabs';
import LibraryView from '@/components/compliance/LibraryView';
import {
  TransactionPackage, Contract, Party, PartyField, MissingField,
  ViewPage, FiredTrigger, PartyRole, FieldType,
} from '@/lib/compliance/types';
import { MLS_LIBRARY } from '@/lib/compliance/mlsLibrary';

const PDFViewer = dynamic(() => import('@/components/compliance/PDFViewer'), { ssr: false });

function guessPartyLabel(fieldKey: string): string {
  const k = fieldKey.toLowerCase();
  if (k.includes('buyer_2') || k.includes('buyer2') || k.includes('purchaser_2')) return 'Buyer 2';
  if (k.includes('buyer') || k.includes('purchaser')) return 'Buyer 1';
  if (k.includes('seller_2') || k.includes('seller2') || k.includes('vendor_2')) return 'Seller 2';
  if (k.includes('seller') || k.includes('vendor')) return 'Seller 1';
  if (k.includes('broker')) return 'Broker';
  if (k.includes('agent') || k.includes('licensee') || k.includes('realtor')) return 'Agent';
  return 'Party';
}

function guessRole(label: string): PartyRole {
  const l = label.toLowerCase();
  if (l.includes('buyer') || l.includes('purchaser')) return 'buyer';
  if (l.includes('seller') || l.includes('vendor')) return 'seller';
  if (l.includes('broker')) return 'broker';
  return 'agent';
}

function violationToFieldType(vType: string): FieldType {
  if (vType === 'missing_signature') return 'signature';
  if (vType === 'missing_initial') return 'initial';
  return 'required';
}

function buildPackageFromResult(
  file: File,
  mlsId: string,
  payload: CheckResultPayload,
): TransactionPackage {
  const violations: any[] = payload.check.violations ?? [];

  const missingFields: MissingField[] = violations
    .filter((v: any) => v.page_num > 0 && v.x !== undefined)
    .map((v: any) => ({
      fieldId: v.field_key,
      label: v.type === 'missing_signature' ? 'Signature'
        : v.type === 'missing_initial' ? 'Initials' : 'Required',
      partyLabel: guessPartyLabel(v.field_key),
      party: guessPartyLabel(v.field_key),
      page: v.page_num,
      type: violationToFieldType(v.type),
      x: v.x ?? 0,
      y: v.y ?? 0,
      w: Math.max(v.w ?? 0, 5),
      h: Math.max(v.h ?? 0, 2),
    }));

  const partyMap = new Map<string, { id: string; role: PartyRole; label: string; name: string; fields: PartyField[] }>();
  for (const v of violations) {
    const label = guessPartyLabel(v.field_key);
    if (!partyMap.has(label)) {
      partyMap.set(label, {
        id: `p_${label.replace(/\s+/g, '_').toLowerCase()}`,
        role: guessRole(label),
        label,
        name: label,
        fields: [],
      });
    }
    const party = partyMap.get(label)!;
    party.fields.push({
      fieldId: v.field_key,
      label: `${v.type === 'missing_signature' ? 'Signature' : v.type === 'missing_initial' ? 'Initials' : 'Required'} — Page ${v.page_num}`,
      page: v.page_num,
      type: violationToFieldType(v.type),
      status: 'missing',
      x: v.x ?? 0,
      y: v.y ?? 0,
      w: Math.max(v.w ?? 0, 5),
      h: Math.max(v.h ?? 0, 2),
    });
  }
  const parties: Party[] = Array.from(partyMap.values());

  const contract: Contract = {
    id: payload.form_slug,
    formName: payload.form_name,
    shortName: payload.form_name.split(' ').slice(0, 3).join(' '),
    mlsId,
    templateId: payload.form_slug,
    passed: payload.check.passed,
    totalPages: payload.page_count,
    parties,
    missingFields,
    firedTriggers: [],
  };

  return {
    fileName: file.name,
    uploadedAt: new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }),
    mlsId,
    contracts: [contract],
  };
}

function RequiredAddendaPanel({ contract }: { contract: Contract }) {
  const triggers = contract.firedTriggers ?? [];
  if (triggers.length === 0) return null;
  const missing = triggers.filter(t => !t.presentInPackage);
  const present = triggers.filter(t => t.presentInPackage);
  return (
    <div style={{ marginTop: 4 }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', padding: '0 4px', marginBottom: 6 }}>Required Addenda</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {missing.map(t => (
          <div key={t.triggerId} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', borderRadius: 8, background: '#fff5f5', border: '1px solid #fecaca' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={12} color="#ef4444" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', flex: 1 }}>{t.requiresFormName}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', background: '#fee2e2', padding: '1px 5px', borderRadius: 4 }}>MISSING</span>
            </div>
            <span style={{ fontSize: 10, color: '#f87171', paddingLeft: 18 }}>Triggered by: {t.fieldLabel}</span>
          </div>
        ))}
        {present.map(t => (
          <div key={t.triggerId} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={12} color="#22c55e" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#15803d', flex: 1 }}>{t.requiresFormName}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', background: '#dcfce7', padding: '1px 5px', borderRadius: 4 }}>✓ IN PKG</span>
            </div>
            <span style={{ fontSize: 10, color: '#86efac', paddingLeft: 18 }}>Triggered by: {t.fieldLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fieldTypeBadge(type: FieldType) {
  if (type === 'signature') return { label: 'SIG', bg: '#fee2e2', color: '#dc2626' };
  if (type === 'initial')   return { label: 'INI', bg: '#fef3c7', color: '#d97706' };
  return                           { label: 'REQ', bg: '#eff6ff', color: '#2563eb' };
}

function RealCheckBanner({ payload, onReset }: { payload: CheckResultPayload; onReset: () => void }) {
  const { check } = payload;
  const isFlattened = check.is_flattened;
  const rawCount = (check as any).raw_pdf_fields ?? 0;
  const extracted = check.fields_extracted ?? 0;
  const matchNote = rawCount > 0 && extracted < rawCount
    ? ` · ${extracted}/${rawCount} field names matched`
    : '';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px',
      background: isFlattened ? '#fffbeb' : check.passed ? '#f0fdf4' : '#fef2f2',
      borderBottom: `1px solid ${isFlattened ? '#fde68a' : check.passed ? '#bbf7d0' : '#fecaca'}`,
      fontSize: 12, flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: 700, color: isFlattened ? '#92400e' : check.passed ? '#15803d' : '#dc2626' }}>
        {isFlattened ? '⚠ Flattened PDF — manual review required'
          : check.passed ? '✓ All checks passed'
          : `✗ ${check.errors} error${check.errors !== 1 ? 's' : ''}${check.warnings > 0 ? `, ${check.warnings} warning${check.warnings !== 1 ? 's' : ''}` : ''}`}
      </span>
      <span style={{ color: '#9ca3af' }}>·</span>
      <span style={{ color: '#6b7280' }}>Form: <strong>{payload.form_name}</strong></span>
      <span style={{ color: '#9ca3af' }}>·</span>
      <span style={{ color: '#6b7280' }}>{extracted} fields extracted{matchNote} · {check.fields_checked} rules checked</span>
      <button onClick={onReset} style={{ marginLeft: 'auto', fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
        ← New check
      </button>
    </div>
  );
}

const ROLE_GROUPS: { role: PartyRole; label: string; color: string }[] = [
  { role: 'buyer', label: 'Buyers', color: 'text-blue-600' },
  { role: 'seller', label: 'Sellers', color: 'text-purple-600' },
  { role: 'agent', label: 'Agents', color: 'text-teal-600' },
  { role: 'broker', label: 'Broker', color: 'text-amber-600' },
];

export default function CompliancePage() {
  const [view, setView] = useState<ViewPage>('upload');
  const [pkg, setPkg] = useState<TransactionPackage | null>(null);
  const [activeContractId, setActiveContractId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [checkPayload, setCheckPayload] = useState<CheckResultPayload | null>(null);

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

  // Upload view — scrollable, grows with content
  if (view === 'upload') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <NavBar active="upload" />
      <UploadPanel onAnalyze={(mlsId, file, result) => {
        setPdfFile(file);
        setCheckPayload(result);
        const built = buildPackageFromResult(file, mlsId, result);
        setPkg(built);
        setActiveContractId(built.contracts[0].id);
        setCurrentPage(1);
        setView('report');
      }} />
    </div>
  );

  // Library view — scrollable
  if (view === 'library') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <NavBar active="library" />
      <LibraryView />
    </div>
  );

  if (!pkg) { setView('upload'); return null; }

  const mlsBoard = MLS_LIBRARY.find(b => b.id === pkg.mlsId);
  const contract: Contract = pkg.contracts.find(c => c.id === activeContractId) ?? pkg.contracts[0];
  const totalMissing = contract.missingFields.length;
  const missingAddenda = (contract.firedTriggers ?? []).filter(t => !t.presentInPackage).length;
  const totalIssues = totalMissing + missingAddenda;
  const totalPackageIssues = pkg.contracts.reduce((s, c) => s + c.missingFields.length + ((c.firedTriggers ?? []).filter(t => !t.presentInPackage).length), 0);

  // Breakdown by type
  const sigCount = contract.missingFields.filter(f => f.type === 'signature').length;
  const iniCount = contract.missingFields.filter(f => f.type === 'initial').length;
  const reqCount = contract.missingFields.filter(f => f.type === 'required').length;

  // Report view — fixed split-panel layout (intentional overflow:hidden)
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setView('upload')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'transparent', color: '#6b7280' }}><CheckSquare size={14} /> Check</button>
            <button onClick={() => setView('library')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'transparent', color: '#6b7280' }}><BookOpen size={14} /> Library</button>
          </div>
          <div style={{ width: 1, height: 16, background: '#e5e7eb' }} />
          {mlsBoard && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>{mlsBoard.name} <span style={{ fontWeight: 400, color: '#93c5fd' }}>{mlsBoard.state}</span></span>}
          <div><span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{pkg.fileName}</span><span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>{pkg.uploadedAt}</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {totalPackageIssues > 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>{totalPackageIssues} issue{totalPackageIssues !== 1 ? 's' : ''} across package</span>}
          {contract.passed && totalIssues === 0
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 700 }}>✓ Passed</span>
            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700 }}>✗ {totalIssues} issue{totalIssues !== 1 ? 's' : ''}</span>
          }
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#ffffff', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#6b7280' }}><Download size={12} /> Export</button>
        </div>
      </div>

      {checkPayload && <RealCheckBanner payload={checkPayload} onReset={() => { setView('upload'); setCheckPayload(null); setPkg(null); }} />}

      <ContractTabs contracts={pkg.contracts} activeId={activeContractId} onSelect={(id) => { setActiveContractId(id); setCurrentPage(1); }} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid #e5e7eb', overflowY: 'auto', padding: 12, background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ borderRadius: 10, padding: 12, background: totalIssues === 0 ? '#f0fdf4' : '#fff5f5', border: `1px solid ${totalIssues === 0 ? '#bbf7d0' : '#fecaca'}` }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: totalIssues === 0 ? '#16a34a' : '#dc2626', margin: 0 }}>
              {totalIssues === 0 ? '✓ All complete' : `⚠ ${totalIssues} item${totalIssues !== 1 ? 's' : ''} need attention`}
            </p>
            {totalIssues > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {sigCount > 0 && <span style={{ fontSize: 11, color: '#dc2626' }}>{sigCount} sig</span>}
                {iniCount > 0 && <span style={{ fontSize: 11, color: '#d97706' }}>{iniCount} initial</span>}
                {reqCount > 0 && <span style={{ fontSize: 11, color: '#2563eb' }}>{reqCount} required</span>}
                {missingAddenda > 0 && <span style={{ fontSize: 11, color: '#f97316' }}>{missingAddenda} addenda needed</span>}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{contract.parties.length} parties · {contract.totalPages} pages</p>
              {mlsBoard && contract.templateId && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#93c5fd' }}>{contract.templateId}</span>}
            </div>
          </div>

          {ROLE_GROUPS.map(group => {
            const groupParties = contract.parties.filter(p => p.role === group.role);
            if (groupParties.length === 0) return null;
            return (
              <div key={group.role}>
                <p className={`text-xs font-bold uppercase tracking-widest px-1 mb-2 ${group.color}`}>{group.label}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groupParties.map(p => <PartyCard key={p.id} party={p} onFieldClick={setCurrentPage} />)}
                </div>
              </div>
            );
          })}

          <RequiredAddendaPanel contract={contract} />

          {totalMissing > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', padding: '0 4px', marginBottom: 6 }}>Jump to issue</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {contract.missingFields.map(f => {
                  const badge = fieldTypeBadge(f.type);
                  return (
                    <button key={f.fieldId + f.page} onClick={() => setCurrentPage(f.page)} style={{ display: 'flex', flexDirection: 'column', padding: '8px 12px', borderRadius: 8, textAlign: 'left', cursor: 'pointer', background: currentPage === f.page ? '#fff5f5' : '#ffffff', border: currentPage === f.page ? '1px solid #fecaca' : '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: badge.bg, color: badge.color }}>{badge.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>{f.partyLabel}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.party}</span>
                        <span style={{ fontSize: 11, color: '#d1d5db', flexShrink: 0 }}>p.{f.page}</span>
                      </div>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#d1d5db', marginTop: 2, paddingLeft: 2 }}>{f.fieldId}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PDFViewer
            pdfFile={pdfFile}
            currentPage={currentPage}
            totalPages={contract.totalPages}
            missingFields={contract.missingFields}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </div>
  );
}
