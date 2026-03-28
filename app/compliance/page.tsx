'use client';
import React, { useState } from 'react';
import { Download, BookOpen, CheckSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';

import UploadPanel from '@/components/compliance/UploadPanel';
import PartyCard from '@/components/compliance/PartyCard';
import PDFViewer from '@/components/compliance/PDFViewer';
import ContractTabs from '@/components/compliance/ContractTabs';
import LibraryView from '@/components/compliance/LibraryView';
import { TransactionPackage, Contract, Party, ViewPage, FiredTrigger } from '@/lib/compliance/types';
import { MLS_LIBRARY } from '@/lib/compliance/mlsLibrary';

const MOCK_PACKAGE: TransactionPackage = {
  fileName: 'Smith-Torres_Transaction_Package.pdf',
  uploadedAt: 'Mar 27, 2026 · 9:14 AM',
  mlsId: 'crmls',
  contracts: [
    {
      id: 'purchase-agreement',
      formName: 'Residential Purchase Agreement',
      shortName: 'Purchase Agreement',
      mlsId: 'crmls',
      templateId: 'crmls-rpa',
      passed: false,
      totalPages: 6,
      parties: [
        { id: 'pa_buyer1', role: 'buyer', label: 'Buyer 1', name: 'Michael Torres', fields: [
          { fieldId: 'pa_b1_init_p2', label: 'Initials — Page 2', page: 2, type: 'initial',   status: 'signed',  x: 5,  y: 88, w: 12, h: 4 },
          { fieldId: 'pa_b1_init_p4', label: 'Initials — Page 4', page: 4, type: 'initial',   status: 'missing', x: 5,  y: 88, w: 12, h: 4 },
          { fieldId: 'pa_b1_sig_p6',  label: 'Signature — Page 6', page: 6, type: 'signature', status: 'missing', x: 3,  y: 85, w: 44, h: 5 },
        ]},
        { id: 'pa_buyer2', role: 'buyer', label: 'Buyer 2', name: 'Jennifer Torres', fields: [
          { fieldId: 'pa_b2_init_p2', label: 'Initials — Page 2', page: 2, type: 'initial',   status: 'signed',  x: 20, y: 88, w: 12, h: 4 },
          { fieldId: 'pa_b2_init_p4', label: 'Initials — Page 4', page: 4, type: 'initial',   status: 'signed',  x: 20, y: 88, w: 12, h: 4 },
          { fieldId: 'pa_b2_sig_p6',  label: 'Signature — Page 6', page: 6, type: 'signature', status: 'signed',  x: 20, y: 85, w: 44, h: 5 },
        ]},
        { id: 'pa_seller1', role: 'seller', label: 'Seller 1', name: 'John Smith', fields: [
          { fieldId: 'pa_s1_init_p2', label: 'Initials — Page 2', page: 2, type: 'initial',   status: 'signed',  x: 5,  y: 93, w: 12, h: 4 },
          { fieldId: 'pa_s1_sig_p6',  label: 'Signature — Page 6', page: 6, type: 'signature', status: 'signed',  x: 3,  y: 92, w: 44, h: 5 },
        ]},
        { id: 'pa_seller2', role: 'seller', label: 'Seller 2', name: 'Mary Smith', fields: [
          { fieldId: 'pa_s2_init_p2', label: 'Initials — Page 2', page: 2, type: 'initial',   status: 'missing', x: 20, y: 93, w: 12, h: 4 },
          { fieldId: 'pa_s2_sig_p6',  label: 'Signature — Page 6', page: 6, type: 'signature', status: 'missing', x: 20, y: 92, w: 44, h: 5 },
        ]},
        { id: 'pa_agent1', role: 'agent', label: 'Agent 1', name: 'Rosa Martinez', fields: [
          { fieldId: 'pa_ag1_sig_p6', label: 'Agent Sig — Page 6', page: 6, type: 'signature', status: 'signed', x: 3, y: 78, w: 44, h: 5 },
        ]},
        { id: 'pa_agent2', role: 'agent', label: 'Agent 2', name: '(Not Assigned)', fields: [
          { fieldId: 'pa_ag2_sig_p6', label: 'Agent Sig — Page 6', page: 6, type: 'signature', status: 'missing', x: 52, y: 78, w: 44, h: 5 },
        ]},
        { id: 'pa_broker', role: 'broker', label: 'Broker', name: 'Premier Realty Group', fields: [
          { fieldId: 'pa_br_sig_p6', label: 'Broker Sig — Page 6', page: 6, type: 'signature', status: 'signed', x: 3, y: 94, w: 94, h: 5 },
        ]},
      ],
      missingFields: [
        { fieldId: 'pa_b1_init_p4', label: 'Initials',  partyLabel: 'Buyer 1',  party: 'Michael Torres',  page: 4, type: 'initial',   x: 5,  y: 88, w: 12, h: 4 },
        { fieldId: 'pa_b1_sig_p6',  label: 'Signature', partyLabel: 'Buyer 1',  party: 'Michael Torres',  page: 6, type: 'signature', x: 3,  y: 85, w: 44, h: 5 },
        { fieldId: 'pa_s2_init_p2', label: 'Initials',  partyLabel: 'Seller 2', party: 'Mary Smith',      page: 2, type: 'initial',   x: 20, y: 93, w: 12, h: 4 },
        { fieldId: 'pa_s2_sig_p6',  label: 'Signature', partyLabel: 'Seller 2', party: 'Mary Smith',      page: 6, type: 'signature', x: 20, y: 92, w: 44, h: 5 },
        { fieldId: 'pa_ag2_sig_p6', label: 'Signature', partyLabel: 'Agent 2',  party: '(Not Assigned)',  page: 6, type: 'signature', x: 52, y: 78, w: 44, h: 5 },
      ],
      firedTriggers: [
        { triggerId: 'rpa-hoa', fieldLabel: 'HOA / Common interest development', requiresFormId: 'crmls-hoa', requiresFormName: 'HOA Documents Addendum (HOAI)', presentInPackage: false },
        { triggerId: 'rpa-contingency', fieldLabel: 'Loan contingency active', requiresFormId: 'crmls-lcr', requiresFormName: 'Loan Contingency Removal (CR)', presentInPackage: false },
      ],
    },
    {
      id: 'sellers-disclosure',
      formName: "Seller's Disclosure Addendum",
      shortName: "Seller's Disc.",
      mlsId: 'crmls', templateId: 'crmls-sda', passed: false, totalPages: 8,
      parties: [
        { id: 'sd_seller1', role: 'seller', label: 'Seller 1', name: 'John Smith', fields: [
          { fieldId: 'sd_s1_init_p1', label: 'Initials — Page 1', page: 1, type: 'initial',   status: 'signed',  x: 5,  y: 88, w: 12, h: 4 },
          { fieldId: 'sd_s1_init_p2', label: 'Initials — Page 2', page: 2, type: 'initial',   status: 'signed',  x: 5,  y: 88, w: 12, h: 4 },
          { fieldId: 'sd_s1_init_p5', label: 'Initials — Page 5', page: 5, type: 'initial',   status: 'missing', x: 5,  y: 88, w: 12, h: 4 },
          { fieldId: 'sd_s1_sig_p8',  label: 'Signature — Page 8', page: 8, type: 'signature', status: 'signed',  x: 3,  y: 88, w: 44, h: 5 },
        ]},
        { id: 'sd_seller2', role: 'seller', label: 'Seller 2', name: 'Mary Smith', fields: [
          { fieldId: 'sd_s2_init_p2', label: 'Initials — Page 2', page: 2, type: 'initial',   status: 'missing', x: 20, y: 88, w: 12, h: 4 },
          { fieldId: 'sd_s2_init_p4', label: 'Initials — Page 4', page: 4, type: 'initial',   status: 'missing', x: 20, y: 88, w: 12, h: 4 },
          { fieldId: 'sd_s2_init_p7', label: 'Initials — Page 7', page: 7, type: 'initial',   status: 'missing', x: 20, y: 88, w: 12, h: 4 },
          { fieldId: 'sd_s2_sig_p8',  label: 'Signature — Page 8', page: 8, type: 'signature', status: 'missing', x: 20, y: 88, w: 44, h: 5 },
        ]},
        { id: 'sd_agent1', role: 'agent', label: 'Agent 1', name: 'Rosa Martinez', fields: [
          { fieldId: 'sd_ag1_sig_p8', label: 'Agent Sig — Page 8', page: 8, type: 'signature', status: 'signed', x: 3, y: 78, w: 44, h: 5 },
        ]},
      ],
      missingFields: [
        { fieldId: 'sd_s1_init_p5', label: 'Initials',  partyLabel: 'Seller 1', party: 'John Smith',  page: 5, type: 'initial',   x: 5,  y: 88, w: 12, h: 4 },
        { fieldId: 'sd_s2_init_p2', label: 'Initials',  partyLabel: 'Seller 2', party: 'Mary Smith',  page: 2, type: 'initial',   x: 20, y: 88, w: 12, h: 4 },
        { fieldId: 'sd_s2_init_p4', label: 'Initials',  partyLabel: 'Seller 2', party: 'Mary Smith',  page: 4, type: 'initial',   x: 20, y: 88, w: 12, h: 4 },
        { fieldId: 'sd_s2_init_p7', label: 'Initials',  partyLabel: 'Seller 2', party: 'Mary Smith',  page: 7, type: 'initial',   x: 20, y: 88, w: 12, h: 4 },
        { fieldId: 'sd_s2_sig_p8',  label: 'Signature', partyLabel: 'Seller 2', party: 'Mary Smith',  page: 8, type: 'signature', x: 20, y: 88, w: 44, h: 5 },
      ],
      firedTriggers: [
        { triggerId: 'sda-pool',    fieldLabel: 'Pool / Spa present',         requiresFormId: 'crmls-spq',   requiresFormName: 'Pool / Spa Disclosure (SPQ)',     presentInPackage: false },
        { triggerId: 'sda-pre1978', fieldLabel: 'Home built before 1978',      requiresFormId: 'crmls-lpd',   requiresFormName: 'Lead-Based Paint Disclosure',      presentInPackage: true  },
        { triggerId: 'sda-solar',   fieldLabel: 'Solar panels — leased or PPA', requiresFormId: 'crmls-solar', requiresFormName: 'Solar Lease / PPA Addendum (SLPA)', presentInPackage: false },
      ],
    },
    {
      id: 'lead-paint', formName: 'Lead-Based Paint Disclosure', shortName: 'Lead Paint',
      mlsId: 'crmls', templateId: 'crmls-lpd', passed: true, totalPages: 2,
      parties: [
        { id: 'lp_buyer1',  role: 'buyer',  label: 'Buyer 1',  name: 'Michael Torres',    fields: [{ fieldId: 'lp_b1_sig_p2',  label: 'Signature — Page 2', page: 2, type: 'signature', status: 'signed', x: 3,  y: 82, w: 44, h: 5 }] },
        { id: 'lp_buyer2',  role: 'buyer',  label: 'Buyer 2',  name: 'Jennifer Torres',   fields: [{ fieldId: 'lp_b2_sig_p2',  label: 'Signature — Page 2', page: 2, type: 'signature', status: 'signed', x: 52, y: 82, w: 44, h: 5 }] },
        { id: 'lp_seller1', role: 'seller', label: 'Seller 1', name: 'John Smith',        fields: [{ fieldId: 'lp_s1_sig_p2',  label: 'Signature — Page 2', page: 2, type: 'signature', status: 'signed', x: 3,  y: 90, w: 44, h: 5 }] },
        { id: 'lp_seller2', role: 'seller', label: 'Seller 2', name: 'Mary Smith',        fields: [{ fieldId: 'lp_s2_sig_p2',  label: 'Signature — Page 2', page: 2, type: 'signature', status: 'signed', x: 52, y: 90, w: 44, h: 5 }] },
        { id: 'lp_agent1',  role: 'agent',  label: 'Agent 1',  name: 'Rosa Martinez',     fields: [{ fieldId: 'lp_ag1_sig_p2', label: 'Agent Sig — Page 2',  page: 2, type: 'signature', status: 'signed', x: 3,  y: 96, w: 44, h: 5 }] },
      ],
      missingFields: [],
    },
    {
      id: 'counter-offer', formName: 'Counter Offer Addendum', shortName: 'Counter Offer',
      mlsId: 'crmls', templateId: 'crmls-coa', passed: false, totalPages: 1,
      parties: [
        { id: 'co_buyer1',  role: 'buyer',  label: 'Buyer 1',  name: 'Michael Torres', fields: [{ fieldId: 'co_b1_sig_p1', label: 'Signature — Page 1', page: 1, type: 'signature', status: 'missing', x: 3,  y: 85, w: 44, h: 5 }] },
        { id: 'co_seller1', role: 'seller', label: 'Seller 1', name: 'John Smith',     fields: [{ fieldId: 'co_s1_sig_p1', label: 'Signature — Page 1', page: 1, type: 'signature', status: 'signed',  x: 3,  y: 92, w: 44, h: 5 }] },
        { id: 'co_seller2', role: 'seller', label: 'Seller 2', name: 'Mary Smith',     fields: [{ fieldId: 'co_s2_sig_p1', label: 'Signature — Page 1', page: 1, type: 'signature', status: 'signed',  x: 52, y: 92, w: 44, h: 5 }] },
      ],
      missingFields: [
        { fieldId: 'co_b1_sig_p1', label: 'Signature', partyLabel: 'Buyer 1', party: 'Michael Torres', page: 1, type: 'signature', x: 3, y: 85, w: 44, h: 5 },
      ],
    },
  ],
};

const ROLE_GROUPS: { role: Party['role']; label: string; color: string }[] = [
  { role: 'buyer',  label: 'Buyers',  color: 'text-blue-600' },
  { role: 'seller', label: 'Sellers', color: 'text-purple-600' },
  { role: 'agent',  label: 'Agents',  color: 'text-teal-600' },
  { role: 'broker', label: 'Broker',  color: 'text-amber-600' },
];

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

export default function CompliancePage() {
  const [view, setView] = useState<ViewPage>('upload');
  const [pkg, setPkg] = useState<TransactionPackage>(MOCK_PACKAGE);
  const [activeContractId, setActiveContractId] = useState<string>(MOCK_PACKAGE.contracts[0].id);
  const [currentPage, setCurrentPage] = useState(1);

  const mlsBoard = MLS_LIBRARY.find(b => b.id === pkg.mlsId);
  const totalPackageIssues = pkg.contracts.reduce((sum, c) => {
    const missingAddenda = (c.firedTriggers ?? []).filter(t => !t.presentInPackage).length;
    return sum + c.missingFields.length + missingAddenda;
  }, 0);

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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <NavBar active="upload" />
      <UploadPanel onAnalyze={(mlsId) => { setPkg({ ...MOCK_PACKAGE, mlsId }); setActiveContractId(MOCK_PACKAGE.contracts[0].id); setCurrentPage(1); setView('report'); }} />
    </div>
  );

  if (view === 'library') return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <NavBar active="library" />
      <LibraryView />
    </div>
  );

  const contract: Contract = pkg.contracts.find(c => c.id === activeContractId) ?? pkg.contracts[0];
  const totalMissing = contract.missingFields.length;
  const missingAddenda = (contract.firedTriggers ?? []).filter(t => !t.presentInPackage).length;
  const totalIssues = totalMissing + missingAddenda;

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

      <ContractTabs contracts={pkg.contracts} activeId={activeContractId} onSelect={(id) => { setActiveContractId(id); setCurrentPage(1); }} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid #e5e7eb', overflowY: 'auto', padding: 12, background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ borderRadius: 10, padding: 12, background: totalIssues === 0 ? '#f0fdf4' : '#fff5f5', border: `1px solid ${totalIssues === 0 ? '#bbf7d0' : '#fecaca'}` }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: totalIssues === 0 ? '#16a34a' : '#dc2626', margin: 0 }}>
              {totalIssues === 0 ? '✓ All complete' : `⚠ ${totalIssues} item${totalIssues !== 1 ? 's' : ''} need attention`}
            </p>
            {totalIssues > 0 && (
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                {totalMissing > 0 && <span style={{ fontSize: 11, color: '#f87171' }}>{totalMissing} missing sig/initial</span>}
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
                {contract.missingFields.map(f => (
                  <button key={f.fieldId} onClick={() => setCurrentPage(f.page)} style={{ display: 'flex', flexDirection: 'column', padding: '8px 12px', borderRadius: 8, textAlign: 'left', cursor: 'pointer', background: currentPage === f.page ? '#fff5f5' : '#ffffff', border: currentPage === f.page ? '1px solid #fecaca' : '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: f.type === 'signature' ? '#fee2e2' : '#fef3c7', color: f.type === 'signature' ? '#dc2626' : '#d97706' }}>{f.type === 'signature' ? 'SIG' : 'INI'}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>{f.partyLabel}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.party}</span>
                      <span style={{ fontSize: 11, color: '#d1d5db', flexShrink: 0 }}>p.{f.page}</span>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#d1d5db', marginTop: 2, paddingLeft: 2 }}>{f.fieldId}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PDFViewer currentPage={currentPage} totalPages={contract.totalPages} missingFields={contract.missingFields} onPageChange={setCurrentPage} />
        </div>
      </div>
    </div>
  );
}
