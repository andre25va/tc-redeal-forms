'use client';
import React from 'react';
import { Contract } from '@/lib/compliance/types';
import { FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  contracts: Contract[];
  activeId: string;
  onSelect: (id: string) => void;
}

const ContractTabs: React.FC<Props> = ({ contracts, activeId, onSelect }) => {
  const totalIssues = contracts.reduce((sum, c) => sum + c.missingFields.length, 0);
  const allPassed = contracts.every(c => c.passed);

  return (
    <div style={{ flexShrink: 0, borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={13} style={{ opacity: 0.4 }} />
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
            {contracts.length} form{contracts.length !== 1 ? 's' : ''} in package
          </span>
        </div>
        {allPassed ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
            <CheckCircle size={12} /> Package complete
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#ef4444' }}>
            <AlertCircle size={12} /> {totalIssues} total issue{totalIssues !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', overflowX: 'auto', padding: '4px 8px 0', gap: 2 }}>
        {contracts.map(c => {
          const isActive = c.id === activeId;
          const missing = c.missingFields.length;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: `2px solid ${isActive ? '#3b82f6' : 'transparent'}`,
                color: isActive ? '#2563eb' : '#6b7280',
                background: isActive ? '#eff6ff' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {c.shortName}
              {c.passed ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: '#dcfce7', color: '#16a34a' }}>
                  <CheckCircle size={10} />
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 4px', borderRadius: 20, background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 700 }}>
                  {missing}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ContractTabs;
