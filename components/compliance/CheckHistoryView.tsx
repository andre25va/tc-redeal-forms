'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, Link2, RefreshCw, ShieldCheck, CheckSquare } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckRow {
  id: string;
  deal_id: string | null;
  document_id: string | null;
  check_type: 'field' | 'vision' | null;
  source: 'myredeal' | 'standalone' | null;
  form_type: string | null;
  filename: string | null;
  state: string | null;
  total_rules_checked: number;
  passed_count: number;
  warning_count: number;
  violation_count: number;
  results: any;
  run_at: string;
  property_address: string | null;
}

interface CheckHistoryViewProps {
  onNewCheck?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function sourceBadge(source: string | null) {
  if (source === 'myredeal')
    return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'1px 7px', borderRadius:10, background:'#eff6ff', color:'#1d4ed8', fontSize:10, fontWeight:700 }}><Link2 size={9} />Linked</span>;
  return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'1px 7px', borderRadius:10, background:'#f3f4f6', color:'#6b7280', fontSize:10, fontWeight:700 }}>Standalone</span>;
}

function typeBadge(type: string | null) {
  if (type === 'vision')
    return <span style={{ padding:'1px 7px', borderRadius:10, background:'#f0fdf4', color:'#16a34a', fontSize:10, fontWeight:700 }}>Vision</span>;
  if (type === 'field')
    return <span style={{ padding:'1px 7px', borderRadius:10, background:'#faf5ff', color:'#7c3aed', fontSize:10, fontWeight:700 }}>Field</span>;
  return <span style={{ padding:'1px 7px', borderRadius:10, background:'#f3f4f6', color:'#9ca3af', fontSize:10, fontWeight:600 }}>—</span>;
}

function statusIcon(row: CheckRow) {
  if (row.violation_count > 0)
    return <XCircle size={14} color="#dc2626" />;
  if (row.warning_count > 0)
    return <AlertTriangle size={14} color="#d97706" />;
  return <CheckCircle2 size={14} color="#16a34a" />;
}

function scoreBar(row: CheckRow) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      {row.violation_count > 0 && (
        <span style={{ fontSize:11, fontWeight:700, color:'#dc2626' }}>{row.violation_count} err</span>
      )}
      {row.warning_count > 0 && (
        <span style={{ fontSize:11, fontWeight:700, color:'#d97706' }}>{row.warning_count} warn</span>
      )}
      {row.violation_count === 0 && row.warning_count === 0 && (
        <span style={{ fontSize:11, fontWeight:700, color:'#16a34a' }}>✓ Passed</span>
      )}
    </div>
  );
}

function dealLabel(row: CheckRow): { text: string; dim: boolean } {
  if (row.property_address) return { text: row.property_address, dim: false };
  if (row.filename)         return { text: row.filename,         dim: false };
  return { text: 'Standalone check', dim: true };
}

// ─── Expanded Row Detail ──────────────────────────────────────────────────────

function ExpandedDetail({ row }: { row: CheckRow }) {
  const violations: any[] = row.results?.vision?.violations ?? [];
  const fieldResults: any[] = Array.isArray(row.results?.violations) ? row.results.violations : [];
  const allViolations = row.check_type === 'vision' ? violations : fieldResults;

  if (allViolations.length === 0) return (
    <div style={{ padding:'10px 16px', background:'#f0fdf4', borderTop:'1px solid #bbf7d0', display:'flex', alignItems:'center', gap:8 }}>
      <ShieldCheck size={14} color="#16a34a" />
      <span style={{ fontSize:12, color:'#16a34a', fontWeight:600 }}>All checks passed — no violations found</span>
    </div>
  );

  return (
    <div style={{ padding:'10px 16px', background:'#fafafa', borderTop:'1px solid #e5e7eb' }}>
      <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9ca3af', margin:'0 0 8px' }}>
        {allViolations.length} Issue{allViolations.length !== 1 ? 's' : ''}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {allViolations.slice(0, 20).map((v: any, i: number) => {
          const sev = v.severity ?? 'error';
          const color = sev === 'error' ? '#dc2626' : sev === 'warning' ? '#d97706' : '#2563eb';
          const icon = sev === 'error' ? <XCircle size={11} color={color} /> : <AlertTriangle size={11} color={color} />;
          const msg = v.message ?? v.msg ?? v.description ?? JSON.stringify(v);
          const page = v.page ? ` · p.${v.page}` : '';
          return (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, padding:'4px 8px', borderRadius:6, background:'#fff', border:`1px solid ${sev === 'error' ? '#fecaca' : sev === 'warning' ? '#fde68a' : '#bfdbfe'}` }}>
              <span style={{ flexShrink:0, marginTop:1 }}>{icon}</span>
              <span style={{ fontSize:11, color:'#374151', flex:1 }}>{msg}</span>
              {page && <span style={{ fontSize:10, color:'#9ca3af', flexShrink:0 }}>{page}</span>}
            </div>
          );
        })}
        {allViolations.length > 20 && (
          <p style={{ fontSize:10, color:'#9ca3af', margin:'4px 0 0', textAlign:'center' }}>
            + {allViolations.length - 20} more issues
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface Filters {
  source: string;
  checkType: string;
  days: string;
  status: string;
}

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const btn = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        padding:'4px 10px', borderRadius:6, border:`1px solid ${active ? '#3b82f6' : '#e5e7eb'}`,
        background: active ? '#eff6ff' : '#fff', color: active ? '#1d4ed8' : '#6b7280',
        fontSize:11, fontWeight: active ? 700 : 400, cursor:'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:'10px 16px', borderBottom:'1px solid #e5e7eb', background:'#fff', alignItems:'center' }}>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <span style={{ fontSize:10, color:'#9ca3af', fontWeight:600, marginRight:2 }}>SOURCE</span>
        {btn('All',        filters.source === '',           () => onChange({ ...filters, source: '' }))}
        {btn('Linked',     filters.source === 'myredeal',   () => onChange({ ...filters, source: 'myredeal' }))}
        {btn('Standalone', filters.source === 'standalone', () => onChange({ ...filters, source: 'standalone' }))}
      </div>
      <div style={{ width:1, height:16, background:'#e5e7eb' }} />
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <span style={{ fontSize:10, color:'#9ca3af', fontWeight:600, marginRight:2 }}>TYPE</span>
        {btn('All',    filters.checkType === '',       () => onChange({ ...filters, checkType: '' }))}
        {btn('Vision', filters.checkType === 'vision', () => onChange({ ...filters, checkType: 'vision' }))}
        {btn('Field',  filters.checkType === 'field',  () => onChange({ ...filters, checkType: 'field' }))}
      </div>
      <div style={{ width:1, height:16, background:'#e5e7eb' }} />
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <span style={{ fontSize:10, color:'#9ca3af', fontWeight:600, marginRight:2 }}>PERIOD</span>
        {btn('7d',  filters.days === '7',  () => onChange({ ...filters, days: '7' }))}
        {btn('30d', filters.days === '30', () => onChange({ ...filters, days: '30' }))}
        {btn('90d', filters.days === '90', () => onChange({ ...filters, days: '90' }))}
        {btn('All', filters.days === '',   () => onChange({ ...filters, days: '' }))}
      </div>
      <div style={{ width:1, height:16, background:'#e5e7eb' }} />
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <span style={{ fontSize:10, color:'#9ca3af', fontWeight:600, marginRight:2 }}>STATUS</span>
        {btn('All',        filters.status === '',           () => onChange({ ...filters, status: '' }))}
        {btn('Passed',     filters.status === 'passed',     () => onChange({ ...filters, status: 'passed' }))}
        {btn('Violations', filters.status === 'violations', () => onChange({ ...filters, status: 'violations' }))}
        {btn('Warnings',   filters.status === 'warnings',   () => onChange({ ...filters, status: 'warnings' }))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CheckHistoryView({ onNewCheck }: CheckHistoryViewProps) {
  const [checks, setChecks]       = useState<CheckRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [filters, setFilters]     = useState<Filters>({ source: '', checkType: '', days: '30', status: '' });

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.source)    params.set('source',     filters.source);
      if (filters.checkType) params.set('check_type', filters.checkType);
      if (filters.days)      params.set('days',       filters.days);
      if (filters.status)    params.set('status',     filters.status);
      const res = await fetch(`/api/compliance/history?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setChecks(json.checks ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchChecks(); }, [fetchChecks]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const total      = checks.length;
  const passed     = checks.filter(c => c.violation_count === 0 && c.warning_count === 0).length;
  const violations = checks.filter(c => c.violation_count > 0).length;
  const linked     = checks.filter(c => c.source === 'myredeal').length;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#f9fafb' }}>

      <FilterBar filters={filters} onChange={setFilters} />

      {/* ── Summary strip ── */}
      {!loading && (
        <div style={{ display:'flex', gap:16, padding:'8px 16px', background:'#fff', borderBottom:'1px solid #e5e7eb', flexShrink:0, alignItems:'center' }}>
          {total > 0 && (
            <>
              {[
                { label:'Total checks', value: total,      color:'#374151' },
                { label:'Passed',       value: passed,     color:'#16a34a' },
                { label:'Violations',   value: violations, color:'#dc2626' },
                { label:'Linked',       value: linked,     color:'#1d4ed8' },
              ].map(s => (
                <div key={s.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:16, fontWeight:700, color:s.color }}>{s.value}</span>
                  <span style={{ fontSize:11, color:'#9ca3af' }}>{s.label}</span>
                </div>
              ))}
            </>
          )}
          <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
            {onNewCheck && (
              <button
                onClick={onNewCheck}
                style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:6, border:'1px solid #3b82f6', background:'#eff6ff', cursor:'pointer', fontSize:11, color:'#1d4ed8', fontWeight:600 }}
              >
                <CheckSquare size={11} /> New Check
              </button>
            )}
            <button
              onClick={fetchChecks}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:11, color:'#6b7280' }}
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ flex:1, overflowY:'auto' }}>

        {loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', border:'3px solid #e5e7eb', borderTopColor:'#3b82f6', animation:'spin 0.8s linear infinite' }} />
            <p style={{ fontSize:12, color:'#9ca3af', margin:0 }}>Loading compliance history…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{ margin:16, padding:'10px 14px', borderRadius:8, border:'1px solid #fecaca', background:'#fff5f5' }}>
            <p style={{ fontSize:12, color:'#dc2626', margin:0 }}>Error loading history: {error}</p>
          </div>
        )}

        {!loading && !error && checks.length === 0 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:300, gap:10 }}>
            <ShieldCheck size={32} color="#d1d5db" />
            <p style={{ fontSize:14, fontWeight:600, color:'#9ca3af', margin:0 }}>No compliance checks yet</p>
            <p style={{ fontSize:12, color:'#d1d5db', margin:0 }}>Run your first check using the Check tab above</p>
            {onNewCheck && (
              <button
                onClick={onNewCheck}
                style={{ marginTop:8, display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'1px solid #3b82f6', background:'#eff6ff', cursor:'pointer', fontSize:13, color:'#1d4ed8', fontWeight:600 }}
              >
                <CheckSquare size={14} /> Go to Check
              </button>
            )}
          </div>
        )}

        {!loading && !error && checks.length > 0 && (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                <th style={{ padding:'8px 16px', textAlign:'left', color:'#6b7280', fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', width:30 }}></th>
                <th style={{ padding:'8px 16px', textAlign:'left', color:'#6b7280', fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>Deal / Source</th>
                <th style={{ padding:'8px 16px', textAlign:'left', color:'#6b7280', fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>Board / Form</th>
                <th style={{ padding:'8px 16px', textAlign:'left', color:'#6b7280', fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>Type</th>
                <th style={{ padding:'8px 16px', textAlign:'left', color:'#6b7280', fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>Result</th>
                <th style={{ padding:'8px 16px', textAlign:'right', color:'#6b7280', fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>When</th>
              </tr>
            </thead>
            <tbody>
              {checks.map(row => {
                const isOpen = expanded.has(row.id);
                const hasDetail = row.violation_count > 0 || row.warning_count > 0;
                const label = dealLabel(row);
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() => toggleExpand(row.id)}
                      style={{
                        borderBottom:'1px solid #f3f4f6',
                        background: isOpen ? '#f8faff' : '#fff',
                        cursor: 'pointer',
                        transition:'background 0.1s',
                      }}
                    >
                      <td style={{ padding:'10px 8px 10px 16px', color:'#9ca3af' }}>
                        {isOpen
                          ? <ChevronDown size={13} />
                          : <ChevronRight size={13} color={hasDetail ? '#374151' : '#d1d5db'} />
                        }
                      </td>

                      {/* Deal / Source */}
                      <td style={{ padding:'10px 16px' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                          <span style={{
                            fontWeight: label.dim ? 400 : 600,
                            color: label.dim ? '#9ca3af' : '#1f2937',
                            fontStyle: label.dim ? 'italic' : 'normal',
                            fontSize:12,
                            maxWidth: 220,
                            overflow:'hidden',
                            textOverflow:'ellipsis',
                            whiteSpace:'nowrap',
                          }}>
                            {label.text}
                          </span>
                          {sourceBadge(row.source)}
                        </div>
                      </td>

                      {/* Board / Form */}
                      <td style={{ padding:'10px 16px' }}>
                        {row.form_type
                          ? <span style={{ color:'#374151', fontSize:11, fontWeight:500 }}>{row.form_type}</span>
                          : <span style={{ color:'#d1d5db', fontSize:11 }}>—</span>
                        }
                        {row.state && (
                          <span style={{ marginLeft:4, fontSize:10, color:'#9ca3af' }}>({row.state})</span>
                        )}
                      </td>

                      {/* Type */}
                      <td style={{ padding:'10px 16px' }}>
                        {typeBadge(row.check_type)}
                      </td>

                      {/* Result */}
                      <td style={{ padding:'10px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          {statusIcon(row)}
                          {scoreBar(row)}
                        </div>
                      </td>

                      {/* When */}
                      <td style={{ padding:'10px 16px', textAlign:'right', color:'#9ca3af', fontSize:11, whiteSpace:'nowrap' }}>
                        {relativeTime(row.run_at)}
                      </td>
                    </tr>

                    {isOpen && <tr><td colSpan={6} style={{ padding:0 }}><ExpandedDetail row={row} /></td></tr>}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
