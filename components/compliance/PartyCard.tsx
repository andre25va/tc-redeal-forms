'use client';
import React, { useState } from 'react';
import { Party } from '@/lib/compliance/types';

interface Props {
  party: Party;
  onFieldClick: (page: number) => void;
}

const ROLE_STYLES: Record<string, { border: string; bg: string; dot: string; label: string }> = {
  buyer:  { border: '#bfdbfe', bg: '#eff6ff', dot: '#3b82f6', label: '#2563eb' },
  seller: { border: '#e9d5ff', bg: '#f5f3ff', dot: '#8b5cf6', label: '#7c3aed' },
  agent:  { border: '#99f6e4', bg: '#f0fdfa', dot: '#14b8a6', label: '#0d9488' },
  broker: { border: '#fde68a', bg: '#fffbeb', dot: '#f59e0b', label: '#d97706' },
};

const PartyCard: React.FC<Props> = ({ party, onFieldClick }) => {
  const [expanded, setExpanded] = useState(false);
  const st = ROLE_STYLES[party.role] ?? ROLE_STYLES.agent;

  const initials = party.fields.filter(f => f.type === 'initial');
  const signatures = party.fields.filter(f => f.type === 'signature');
  const missingInitials = initials.filter(f => f.status === 'missing');
  const missingSignatures = signatures.filter(f => f.status === 'missing');
  const totalMissing = missingInitials.length + missingSignatures.length;

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${st.border}`, background: st.bg, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, marginTop: 4, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: st.label, margin: 0 }}>{party.role}</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0, lineHeight: 1.2 }}>{party.name}</p>
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
            background: totalMissing > 0 ? '#fee2e2' : '#dcfce7',
            color: totalMissing > 0 ? '#dc2626' : '#16a34a',
          }}>
            {totalMissing > 0 ? `${totalMissing} missing` : '✓ Complete'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 12px' }}>
        {[{ label: 'INITIALS', items: initials, missing: missingInitials }, { label: 'SIGNATURES', items: signatures, missing: missingSignatures }].map(({ label, items, missing }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, margin: '0 0 4px' }}>{label}</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: missing.length > 0 ? '#dc2626' : '#16a34a' }}>
                {items.length - missing.length}
              </span>
              <span style={{ fontSize: 13, color: '#9ca3af', marginBottom: 2 }}>/ {items.length}</span>
            </div>
            {missing.length > 0 && <p style={{ fontSize: 10, color: '#dc2626', margin: '2px 0 0' }}>{missing.length} unsigned</p>}
          </div>
        ))}
      </div>

      {totalMissing > 0 && (
        <div style={{ padding: '0 16px 12px' }}>
          <button
            style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 6 }}
            onClick={() => setExpanded(!expanded)}
          >
            <svg style={{ width: 10, height: 10, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            {expanded ? 'Hide' : 'Show'} missing fields
          </button>
          {expanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...missingInitials, ...missingSignatures].map(f => (
                <button
                  key={f.fieldId}
                  onClick={() => onFieldClick(f.page)}
                  style={{
                    display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.8)',
                    borderRadius: 8, padding: '6px 10px', border: '1px solid #fecaca',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#4b5563' }}>{f.label}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>p.{f.page}</span>
                  </div>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#d1d5db', marginTop: 2, paddingLeft: 12 }}>{f.fieldId}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PartyCard;
