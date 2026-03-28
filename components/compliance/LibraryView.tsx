'use client';
import React, { useState } from 'react';
import { MlsBoard, FormTemplate, PartyRole, FieldTrigger } from '@/lib/compliance/types';
import { MLS_LIBRARY } from '@/lib/compliance/mlsLibrary';
import { FileText, PenLine, Fingerprint, ChevronDown, ChevronRight, AlertTriangle, ArrowRight } from 'lucide-react';

const ROLE_COLORS: Record<PartyRole, string> = {
  buyer:  'bg-blue-100 text-blue-700',
  seller: 'bg-purple-100 text-purple-700',
  agent:  'bg-teal-100 text-teal-700',
  broker: 'bg-amber-100 text-amber-700',
};

const STATE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CA:  { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  TX:  { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  WA:  { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  IL:  { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
  KS:  { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  MO:  { bg: '#fdf4ff', text: '#9333ea', border: '#e9d5ff' },
};

const DEFAULT_STATE_COLOR = { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' };

const TriggerRow: React.FC<{ trigger: FieldTrigger; onToggle: () => void }> = ({ trigger, onToggle }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
    borderRadius: 8,
    background: trigger.enabled ? '#fffbeb' : '#f9fafb',
    border: trigger.enabled ? '1px solid #fde68a' : '1px solid #f3f4f6',
    transition: 'all 0.15s',
  }}>
    <button
      onClick={onToggle}
      style={{
        flexShrink: 0, marginTop: 2, width: 16, height: 16, borderRadius: 4, cursor: 'pointer',
        border: trigger.enabled ? '2px solid #f59e0b' : '2px solid #d1d5db',
        background: trigger.enabled ? '#f59e0b' : '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {trigger.enabled && (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: trigger.enabled ? '#92400e' : '#6b7280' }}>{trigger.fieldLabel}</span>
        <ArrowRight size={10} color={trigger.enabled ? '#f59e0b' : '#d1d5db'} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: trigger.enabled ? '#1d4ed8' : '#9ca3af', background: trigger.enabled ? '#dbeafe' : '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>
          {trigger.requiresFormName}
        </span>
      </div>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>{trigger.condition}</p>
      <p style={{ fontSize: 10, color: '#d1d5db', margin: 0, fontStyle: 'italic' }}>{trigger.note}</p>
    </div>
  </div>
);

const FormRow: React.FC<{ form: FormTemplate; isExpanded: boolean; onToggle: () => void; onTriggerToggle: (id: string) => void }> = ({ form, isExpanded, onToggle, onTriggerToggle }) => {
  const enabledCount = (form.conditionalTriggers ?? []).filter(t => t.enabled).length;
  const totalCount = (form.conditionalTriggers ?? []).length;
  return (
    <div style={{ borderTop: '1px solid #f3f4f6' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center', gap: 12, padding: '12px 16px', background: isExpanded ? '#f8faff' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#1f2937', margin: 0 }}>{form.formName}</p>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{form.version} · {form.pages}pp</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4b5563' }}><PenLine size={11} color="#f87171" />{form.requiredSignatures}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4b5563' }}><Fingerprint size={11} color="#fbbf24" />{form.requiredInitials}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {form.parties.map(role => (
            <span key={role} className={ROLE_COLORS[role]} style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{role}</span>
          ))}
        </div>
        {totalCount > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: enabledCount > 0 ? '#fef3c7' : '#f3f4f6', color: enabledCount > 0 ? '#92400e' : '#9ca3af', border: enabledCount > 0 ? '1px solid #fde68a' : '1px solid #e5e7eb' }}>
            <AlertTriangle size={10} />{enabledCount}/{totalCount} rules
          </span>
        ) : <span style={{ fontSize: 11, color: '#e5e7eb' }}>—</span>}
        {totalCount > 0 ? (isExpanded ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#d1d5db" />) : <span style={{ width: 14 }} />}
      </button>
      {isExpanded && totalCount > 0 && (
        <div style={{ padding: '0 16px 14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', margin: '0 0 6px' }}>Conditional Rules — when detected, these forms are also required</p>
          {(form.conditionalTriggers ?? []).map(trigger => (
            <TriggerRow key={trigger.id} trigger={trigger} onToggle={() => onTriggerToggle(trigger.id)} />
          ))}
        </div>
      )}
    </div>
  );
};

const MlsCard: React.FC<{ board: MlsBoard; isSelected: boolean; onClick: () => void }> = ({ board, isSelected, onClick }) => {
  const sc = STATE_COLORS[board.state] ?? DEFAULT_STATE_COLOR;
  const totalSigs = board.forms.reduce((s, f) => s + f.requiredSignatures, 0);
  const totalInits = board.forms.reduce((s, f) => s + f.requiredInitials, 0);
  const totalTriggers = board.forms.reduce((s, f) => s + (f.conditionalTriggers?.length ?? 0), 0);
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', borderRadius: 12, border: isSelected ? '2px solid #3b82f6' : '2px solid #e5e7eb', background: isSelected ? '#eff6ff' : '#ffffff', padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: isSelected ? '#1d4ed8' : '#1f2937' }}>{board.name}</span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, border: '1px solid', background: sc.bg, color: sc.text, borderColor: sc.border }}>{board.state}</span>
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{board.fullName}</p>
          <p style={{ fontSize: 10, color: '#d1d5db', margin: '2px 0 0' }}>{board.region}</p>
        </div>
        <ChevronRight size={14} color={isSelected ? '#3b82f6' : '#d1d5db'} style={{ marginTop: 4, flexShrink: 0 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}><FileText size={11} />{board.forms.length} forms</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}><PenLine size={11} color="#f87171" />{totalSigs}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}><Fingerprint size={11} color="#fbbf24" />{totalInits}</span>
        {totalTriggers > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#d97706' }}><AlertTriangle size={11} />{totalTriggers} rules</span>}
      </div>
    </button>
  );
};

export default function LibraryView() {
  const [library, setLibrary] = useState<MlsBoard[]>(MLS_LIBRARY);
  const [selectedId, setSelectedId] = useState<string>(MLS_LIBRARY[0].id);
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<string>('');

  const board = library.find(b => b.id === selectedId) ?? library[0];
  const sc = STATE_COLORS[board.state] ?? DEFAULT_STATE_COLOR;
  const allStates = Array.from(new Set(library.map(b => b.state))).sort();
  const filteredBoards = filterState ? library.filter(b => b.state === filterState) : library;
  const totalTriggers = board.forms.reduce((s, f) => s + (f.conditionalTriggers?.filter(t => t.enabled).length ?? 0), 0);

  function handleTriggerToggle(formId: string, triggerId: string) {
    setLibrary(prev => prev.map(b => {
      if (b.id !== selectedId) return b;
      return { ...b, forms: b.forms.map(f => {
        if (f.id !== formId) return f;
        return { ...f, conditionalTriggers: (f.conditionalTriggers ?? []).map(t => t.id === triggerId ? { ...t, enabled: !t.enabled } : t) };
      })};
    }));
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#f9fafb' }}>
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #e5e7eb', background: '#ffffff', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ marginBottom: 4 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', margin: 0 }}>MLS Boards</p>
          <p style={{ fontSize: 11, color: '#d1d5db', margin: '2px 0 8px' }}>{library.length} boards in library</p>
          <select value={filterState} onChange={e => setFilterState(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', background: '#f9fafb', outline: 'none', cursor: 'pointer' }}>
            <option value="">All states</option>
            {allStates.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {filteredBoards.map(b => (
          <MlsCard key={b.id} board={b} isSelected={b.id === selectedId} onClick={() => { setSelectedId(b.id); setExpandedFormId(null); }} />
        ))}
        {filteredBoards.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No boards for {filterState}</p>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>{board.name}</h2>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: '1px solid', background: sc.bg, color: sc.text, borderColor: sc.border }}>{board.state}</span>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{board.fullName} · {board.region}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {[{ label: 'Forms', value: board.forms.length, color: '#1f2937' }, { label: 'Total Sigs', value: board.forms.reduce((s, f) => s + f.requiredSignatures, 0), color: '#ef4444' }, { label: 'Total Initials', value: board.forms.reduce((s, f) => s + f.requiredInitials, 0), color: '#f59e0b' }, { label: 'Active Rules', value: totalTriggers, color: '#d97706' }].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: stat.color, margin: 0 }}>{stat.value}</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, padding: '8px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Conditional Rules:</span>
          <span style={{ fontSize: 11, color: '#92400e' }}>☑ Enabled — system will flag missing addenda when condition is detected</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>☐ Disabled — rule exists but won't trigger alerts</span>
        </div>
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center', padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', gap: 12 }}>
            {['Form', 'Sig / Init', 'Parties', 'Conditional Rules', ''].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {board.forms.map(form => (
            <FormRow key={form.id} form={form} isExpanded={expandedFormId === form.id} onToggle={() => setExpandedFormId(expandedFormId === form.id ? null : form.id)} onTriggerToggle={(triggerId) => handleTriggerToggle(form.id, triggerId)} />
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', marginTop: 16 }}>Field-level registry (coordinates, required flags, field IDs) stored in Supabase · field_coordinates table</p>
      </div>
    </div>
  );
}
