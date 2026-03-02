'use client';

import { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TBRow {
  type: 'account' | 'total' | 'header';
  code: string | null;
  name: string;
  actual: number | null;
  side: string;
  atype?: string;
  path?: string[];
}

interface GLTransaction {
  date: string;
  ref: string;
  type: string;
  desc: string;
  debit: number | null;
  credit: number | null;
  net: number | null;
}

interface GLAccount {
  code: string;
  name: string;
  openingBalance: number | null;
  transactions: GLTransaction[];
  stats: { count: number; total: number; mean: number; sd: number } | null;
  monthly: Record<string, number>;
  outliers: GLTransaction[];
}

interface Assumption {
  method: 'pct' | 'manual';
  pct: number;
  manual: number | null;
  locked: boolean;
  aiReason?: string;
}

interface Anomaly extends GLTransaction {
  accountCode: string;
  accountName: string;
  aiExplanation?: { issue: string; action: string; severity: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCurrency = (n: number | null | undefined, compact = false): string => {
  if (n === null || n === undefined) return '—';
  const neg = n < 0;
  const abs = Math.abs(n);
  let s: string;
  if (compact && abs >= 1_000_000) s = `$${(abs / 1_000_000).toFixed(2)}M`;
  else if (compact && abs >= 1_000) s = `$${(abs / 1_000).toFixed(0)}K`;
  else s = `$${abs.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return neg ? `(${s})` : s;
};

const accountType = (code: string): string => {
  if (!code) return 'unknown';
  return ({ '1': 'asset', '2': 'liability', '3': 'equity', '4': 'income', '5': 'cogs', '6': 'expense', '8': 'other_income', '9': 'other_expense' } as Record<string, string>)[code[0]] || 'unknown';
};

// ─── Parsers ──────────────────────────────────────────────────────────────────
function parseTB(sheetData: (string | number | null)[][]): { bsRows: TBRow[]; plRows: TBRow[]; accountMap: Record<string, TBRow> } {
  const bsRows: TBRow[] = [], plRows: TBRow[] = [];
  const accountMap: Record<string, TBRow> = {};
  const SUMMARY = ['Gross Profit', 'Operating Profit', 'Net Profit', 'Net Assets'];

  const extractHalf = (row: (string | number | null)[], ci: number, ai: number, ni: number, ti: number, side: string): TBRow | null => {
    const checkCode = row[ci];
    const code = row[ai] != null ? String(row[ai]).trim() : null;
    const name = row[ni] != null ? String(row[ni]).trim() : null;
    const total = row[ti];
    if (!name) return null;
    const isTotal = name.startsWith('Total') || SUMMARY.includes(name);
    const isAccount = typeof checkCode === 'number' && code && !isTotal;
    if (!isAccount && !isTotal && !code) return null;
    const entry: TBRow = { type: isAccount ? 'account' : isTotal ? 'total' : 'header', code: code || null, name, actual: typeof total === 'number' ? total : null, side };
    if (isAccount && code) { entry.atype = accountType(code); accountMap[code] = entry; }
    return entry;
  };

  for (const row of sheetData) {
    if (!row) continue;
    const left = extractHalf(row, 0, 1, 2, 3, 'bs');
    if (left) bsRows.push(left);
    const right = extractHalf(row, 5, 6, 7, 8, 'pl');
    if (right) plRows.push(right);
  }
  return { bsRows, plRows, accountMap };
}

function parseGL(sheetData: (string | number | null)[][]): Record<string, GLAccount> {
  const accounts: Record<string, GLAccount> = {};
  let cur: string | null = null, inTxns = false;
  const pat = /^\d-\d{4}$/;

  for (const row of sheetData) {
    if (!row) continue;
    const c0 = row[0] != null ? String(row[0]).trim() : '';
    const c1 = row[1] != null ? String(row[1]).trim() : '';
    if (pat.test(c0)) {
      cur = c0; inTxns = false;
      if (!accounts[cur]) accounts[cur] = { code: cur, name: c1, openingBalance: typeof row[2] === 'number' ? row[2] : null, transactions: [], stats: null, monthly: {}, outliers: [] };
      continue;
    }
    if (c0 === 'Date' && cur) { inTxns = true; continue; }
    if (c0 === 'Total') { inTxns = false; continue; }
    if (inTxns && cur && c0) {
      let dateStr = c0;
      if (typeof row[0] === 'number') {
        const d = new Date(Math.round((row[0] - 25569) * 86400 * 1000));
        dateStr = d.toLocaleDateString('en-AU');
      }
      const net = typeof row[8] === 'number' ? row[8] : null;
      const debit = typeof row[6] === 'number' ? row[6] : null;
      const credit = typeof row[7] === 'number' ? row[7] : null;
      if (net !== null || debit !== null || credit !== null) {
        accounts[cur].transactions.push({ date: dateStr, ref: c1, type: row[2] != null ? String(row[2]).trim() : '', desc: row[3] != null ? String(row[3]).trim() : '', debit, credit, net });
      }
    }
  }

  for (const code in accounts) {
    const acct = accounts[code];
    const nets = acct.transactions.map(t => t.net).filter((v): v is number => v !== null);
    if (nets.length > 0) {
      const mean = nets.reduce((s, v) => s + v, 0) / nets.length;
      const sd = Math.sqrt(nets.reduce((s, v) => s + (v - mean) ** 2, 0) / nets.length);
      acct.stats = { count: nets.length, total: nets.reduce((s, v) => s + v, 0), mean, sd };
      const monthly: Record<string, number> = {};
      for (const t of acct.transactions) {
        if (!t.date || !t.net) continue;
        const parts = t.date.split('/');
        const key = parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, '0')}` : 'unknown';
        monthly[key] = (monthly[key] || 0) + t.net;
      }
      acct.monthly = monthly;
      acct.outliers = sd > 0 ? acct.transactions.filter(t => t.net !== null && Math.abs(t.net! - mean) > 2.5 * sd && Math.abs(t.net!) > 1000) : [];
    }
  }
  return accounts;
}

function computeBudget(tbData: { bsRows: TBRow[]; plRows: TBRow[] }, assumptions: Record<string, Assumption>): Record<string, number> {
  const result: Record<string, number> = {};
  const allAccounts = [...tbData.bsRows, ...tbData.plRows].filter(r => r.type === 'account');
  for (const acct of allAccounts) {
    if (!acct.code) continue;
    const a = assumptions[acct.code];
    if (!a || !acct.actual) result[acct.code] = acct.actual ?? 0;
    else if (a.method === 'manual') result[acct.code] = a.manual ?? acct.actual ?? 0;
    else result[acct.code] = (acct.actual ?? 0) * (1 + (a.pct ?? 0) / 100);
  }
  return result;
}

function sectionTotal(rows: TBRow[], totalRow: TBRow, budget: Record<string, number>): number {
  const idx = rows.indexOf(totalRow);
  if (idx < 0) return totalRow.actual ?? 0;
  const sectionLabel = totalRow.name.replace(/^Total\s+/, '').trim();
  let start = -1;
  for (let i = idx - 1; i >= 0; i--) {
    if (rows[i].type === 'header' && rows[i].name === sectionLabel) { start = i; break; }
  }
  return rows.slice(start + 1, idx).filter(r => r.type === 'account').reduce((s, r) => s + (r.code ? (budget[r.code] ?? r.actual ?? 0) : 0), 0);
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const th = (align: string = 'left', width?: number): React.CSSProperties => ({
  padding: '10px 16px', textAlign: align as 'left' | 'right' | 'center', color: '#9CA3AF', fontSize: 11,
  fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, fontFamily: "'Georgia', serif",
  ...(width ? { width } : {}),
});

const numCell = (value: number | null, bold = false, isVariance = false): React.CSSProperties => ({
  padding: '5px 16px', textAlign: 'right', fontFamily: "'Courier New', monospace",
  color: isVariance ? (value && value > 0 ? '#10B981' : value && value < 0 ? '#EF4444' : '#4B5563') : '#C9B99A',
  fontSize: 12, fontWeight: bold ? 'bold' : 'normal',
});

const btnStyle = (variant: 'primary' | 'outline' | 'ghost' = 'primary'): React.CSSProperties => {
  const base: React.CSSProperties = { border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: "'Georgia', serif", fontWeight: 'bold', padding: '8px 16px', fontSize: 13, transition: 'all 0.2s', letterSpacing: 0.5 };
  if (variant === 'primary') return { ...base, backgroundColor: '#C9A227', color: '#080D1A' };
  if (variant === 'outline') return { ...base, backgroundColor: 'transparent', border: '1px solid #C9A227', color: '#C9A227' };
  return { ...base, backgroundColor: 'transparent', border: '1px solid #1E2D45', color: '#6B7280' };
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function BudgetBuilder() {
  const [step, setStep] = useState<'upload' | 'parsing' | 'ready'>('upload');
  const [parseProgress, setParseProgress] = useState('');
  const [tbData, setTbData] = useState<{ bsRows: TBRow[]; plRows: TBRow[]; accountMap: Record<string, TBRow> } | null>(null);
  const [glData, setGlData] = useState<Record<string, GLAccount> | null>(null);
  const [assumptions, setAssumptions] = useState<Record<string, Assumption>>({});
  const [activeTab, setActiveTab] = useState('pl');
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [aiError, setAiError] = useState('');
  const [tbFile, setTbFile] = useState<File | null>(null);
  const [glFile, setGlFile] = useState<File | null>(null);
  const [entityName, setEntityName] = useState('Your Business');
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear() + 1);
  const [selectedAnomaly, setSelectedAnomaly] = useState<number | null>(null);

  const budget = useMemo(() => {
    if (!tbData) return {};
    return computeBudget(tbData, assumptions);
  }, [tbData, assumptions]);

  const processFiles = useCallback(async () => {
    if (!tbFile && !glFile) return;
    setStep('parsing');
    try {
      if (tbFile) {
        setParseProgress('Reading Trial Balance…');
        const ab = await tbFile.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
        const sn = wb.SheetNames.find(n => n.toLowerCase().includes('trial') || n.toLowerCase().includes('balance')) || wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[sn], { header: 1, defval: null });
        const parsed = parseTB(data);
        const nameRow = data[1];
        if (nameRow && nameRow[1]) setEntityName(String(nameRow[1]).trim().slice(0, 40));
        setTbData(parsed);
        const init: Record<string, Assumption> = {};
        for (const code in parsed.accountMap) init[code] = { method: 'pct', pct: 0, manual: null, locked: false };
        setAssumptions(init);
      }
      if (glFile) {
        setParseProgress('Reading General Ledger…');
        await new Promise(r => setTimeout(r, 50));
        const ab = await glFile.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
        const sn = wb.SheetNames.find(n => n.toLowerCase().includes('gl') || n.toLowerCase().includes('general')) || wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[sn], { header: 1, defval: null });
        const parsed = parseGL(data);
        setGlData(parsed);
        const allOutliers: Anomaly[] = [];
        for (const code in parsed) {
          for (const o of parsed[code].outliers) allOutliers.push({ ...o, accountCode: code, accountName: parsed[code].name });
        }
        allOutliers.sort((a, b) => Math.abs(b.net ?? 0) - Math.abs(a.net ?? 0));
        setAnomalies(allOutliers.slice(0, 50));
      }
    } catch (err) {
      setAiError('Error parsing file: ' + (err as Error).message);
    }
    setParseProgress('');
    setStep('ready');
  }, [tbFile, glFile]);

  const suggestAssumptions = async () => {
    if (!tbData) return;
    setAiLoading(true); setAiError('');
    try {
      const accounts = Object.values(tbData.accountMap).filter(a => a.actual !== null).slice(0, 80)
        .map(a => `${a.code} | ${a.name} | ${a.atype} | ${fmtCurrency(a.actual)}`).join('\n');
      const prompt = `You are a financial analyst preparing a budget for ${entityName} for ${budgetYear}.\nPrior year actuals (AUD):\n${accounts}\n\nSuggest a growth % for each account. Respond ONLY with valid JSON array:\n[{"code":"X-XXXX","pct":5,"reason":"short reason"},...]`;
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const suggestions = JSON.parse(match[0]);
        setAssumptions(prev => {
          const next = { ...prev };
          for (const s of suggestions) if (next[s.code]) next[s.code] = { ...next[s.code], method: 'pct', pct: s.pct, aiReason: s.reason };
          return next;
        });
      }
    } catch { setAiError('AI suggestion failed. Edit assumptions manually.'); }
    setAiLoading(false);
  };

  const exportBudget = () => {
    if (!tbData) return;
    const rows = [['Account Code', 'Account Name', 'Type', `Actual ${budgetYear - 1}`, 'Assumption', `Budget ${budgetYear}`, 'AI Note']];
    for (const code in tbData.accountMap) {
      const a = tbData.accountMap[code];
      const ass = assumptions[code];
   rows.push([code, a.name, String(a.atype || ''), String(a.actual ?? 0), ass?.method === 'manual' ? 'Manual' : `${ass?.pct ?? 0}%`, String(budget[code] ?? 0), ass?.aiReason ?? '']);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Budget ${budgetYear}`);
    XLSX.writeFile(wb, `${entityName.replace(/\s+/g, '_')}_Budget_${budgetYear}.xlsx`);
  };

  // ─── Upload Screen ──────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#080D1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Georgia', serif" }}>
        <div style={{ width: '100%', maxWidth: 720, padding: 32 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h1 style={{ margin: 0, fontSize: 36, color: '#C9A227', letterSpacing: 3 }}>◆ BUDGET BUILDER</h1>
            <p style={{ color: '#6B7280', fontSize: 14, margin: '8px 0 0' }}>Generate a professional budget workbook from your MYOB data</p>
          </div>

          <div style={{ backgroundColor: '#0D1524', border: '1px solid #1E2D45', borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <p style={{ color: '#9CA3AF', fontSize: 13, margin: '0 0 16px', textAlign: 'center' }}>
              Export your <strong style={{ color: '#C9A227' }}>Trial Balance</strong> and <strong style={{ color: '#C9A227' }}>General Ledger</strong> from MYOB as Excel files, then upload below.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Trial Balance', file: tbFile, onFile: setTbFile, icon: '📊', note: 'MYOB → Reports → Trial Balance → Export' },
                { label: 'General Ledger', file: glFile, onFile: setGlFile, icon: '📋', note: 'MYOB → Reports → General Ledger → Export' },
              ].map(({ label, file, onFile, icon, note }) => {
                
                return (
                  <div key={label} onClick={() => (document.getElementById(`upload-${label}`) as HTMLInputElement)?.click()}
                    style={{ border: `2px dashed ${file ? '#C9A227' : '#1E2D45'}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', backgroundColor: file ? 'rgba(201,162,39,0.05)' : 'transparent', transition: 'all 0.2s' }}>
                    <input id={`upload-${label}`} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0] || null)} />
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
                    <p style={{ margin: '0 0 4px', fontSize: 15, color: '#E8DCC8', fontWeight: 'bold' }}>{label}</p>
                    <p style={{ margin: '0 0 12px', fontSize: 11, color: '#4B5563' }}>{note}</p>
                    {file
                      ? <span style={{ fontSize: 12, color: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid #10B98130' }}>✓ {file.name}</span>
                      : <span style={{ fontSize: 12, color: '#4B5563' }}>Click to select .xlsx file</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', justifyContent: 'center' }}>
            <label style={{ fontSize: 13, color: '#9CA3AF' }}>Budget Year:</label>
            <input type="number" value={budgetYear} onChange={e => setBudgetYear(parseInt(e.target.value))}
              style={{ width: 80, padding: '6px 12px', backgroundColor: '#0D1524', border: '1px solid #1E2D45', borderRadius: 6, color: '#E8DCC8', fontSize: 14, textAlign: 'center' }} />
          </div>

          <button onClick={processFiles} disabled={!tbFile && !glFile}
            style={{ ...btnStyle('primary'), width: '100%', padding: '14px 24px', fontSize: 16, letterSpacing: 1, opacity: (!tbFile && !glFile) ? 0.4 : 1 }}>
            {tbFile || glFile ? '→ Build Budget' : 'Upload files to continue'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: '#374151', marginTop: 16 }}>
            Files are processed locally in your browser. Your data is never uploaded to any server.
          </p>
        </div>
      </div>
    );
  }

  // ─── Parsing Screen ─────────────────────────────────────────────────────────
  if (step === 'parsing') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#080D1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Georgia', serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 24, animation: 'spin 2s linear infinite' }}>⟳</div>
          <h2 style={{ color: '#C9A227', margin: '0 0 8px' }}>Processing Files</h2>
          <p style={{ color: '#6B7280', fontSize: 14 }}>{parseProgress || 'Analysing data…'}</p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── Main App ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080D1A', fontFamily: "'Georgia', serif", color: '#E8DCC8' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0D1524', borderBottom: '1px solid #1E2D45', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 'bold', color: '#C9A227', letterSpacing: 1 }}>◆ BUDGET BUILDER</span>
          <span style={{ color: '#6B7280' }}>|</span>
          <span style={{ fontSize: 14, color: '#9CA3AF' }}>{entityName}</span>
          <span style={{ fontSize: 12, color: '#4B5563', backgroundColor: '#1A2335', padding: '2px 8px', borderRadius: 4 }}>FY{budgetYear}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportBudget} style={btnStyle('outline')}>↓ Export Excel</button>
          <button onClick={() => setStep('upload')} style={btnStyle('ghost')}>⟳ New File</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: '#0D1524', borderBottom: '1px solid #1E2D45', padding: '0 24px', display: 'flex', gap: 4 }}>
        {[
          { id: 'pl', label: 'P&L Budget' },
          { id: 'bs', label: 'Balance Sheet' },
          { id: 'assumptions', label: 'Assumptions' },
          { id: 'anomalies', label: `Anomalies${anomalies.length ? ` (${anomalies.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            color: activeTab === t.id ? '#C9A227' : '#6B7280',
            borderBottom: activeTab === t.id ? '2px solid #C9A227' : '2px solid transparent',
            fontSize: 13, fontFamily: "'Georgia', serif",
          }}>{t.label}</button>
        ))}
      </div>

      {aiError && <div style={{ margin: '12px 24px', padding: '8px 16px', backgroundColor: '#1A1010', border: '1px solid #7C2D12', borderRadius: 6, color: '#FCA5A5', fontSize: 13 }}>⚠ {aiError}</div>}

      <div style={{ padding: '24px' }}>
        {/* P&L Tab */}
        {activeTab === 'pl' && tbData && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 22, color: '#C9A227' }}>Profit & Loss Budget</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>{entityName} — FY{budgetYear - 1} Actuals vs FY{budgetYear} Budget</p>
            </div>
            <div style={{ backgroundColor: '#0D1524', border: '1px solid #1E2D45', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#0A1020', borderBottom: '2px solid #C9A227' }}>
                    <th style={th('left', 220)}>Account</th>
                    <th style={th('left')}>Name</th>
                    <th style={th('right', 160)}>FY{budgetYear - 1} Actual</th>
                    <th style={th('right', 160)}>FY{budgetYear} Budget</th>
                    <th style={th('right', 100)}>Variance</th>
                    <th style={th('right', 80)}>Chg %</th>
                  </tr>
                </thead>
                <tbody>
                  {tbData.plRows.filter(r => r.code ? ['4','5','6','8','9'].includes(r.code[0]) : true).map((row, i) => {
                    if (row.type === 'header') {
                      const isMain = row.code?.endsWith('000');
                      return <tr key={i} style={{ backgroundColor: isMain ? '#0A1020' : 'transparent' }}>
                        <td colSpan={6} style={{ padding: isMain ? '10px 16px 6px' : '14px 16px 4px', color: isMain ? '#C9A227' : '#9CA3AF', fontWeight: isMain ? 'bold' : 'normal', fontSize: isMain ? 14 : 12, textTransform: isMain ? 'uppercase' : 'none', borderTop: isMain ? '1px solid #1E2D45' : 'none' }}>
                          {isMain ? `◆ ${row.name}` : `  ${row.name}`}
                        </td>
                      </tr>;
                    }
                    if (row.type === 'total') {
                      const bv = sectionTotal(tbData.plRows, row, budget);
                      const av = row.actual;
                      const isCalc = ['Gross Profit', 'Operating Profit', 'Net Profit'].includes(row.name);
                      return <tr key={i} style={{ backgroundColor: isCalc ? '#0A1522' : '#111827', borderTop: '1px solid #1E2D45' }}>
                        <td colSpan={2} style={{ padding: '8px 16px', color: isCalc ? '#C9A227' : '#E8DCC8', fontStyle: isCalc ? 'italic' : 'normal', fontWeight: isCalc ? 'bold' : '600', fontSize: isCalc ? 14 : 13 }}>{row.name}</td>
                        <td style={numCell(av, true)}>{fmtCurrency(av)}</td>
                        <td style={numCell(bv, true)}>{fmtCurrency(bv)}</td>
                        <td style={numCell(bv - (av ?? 0), false, true)}>{fmtCurrency(bv - (av ?? 0))}</td>
                        <td style={{ ...numCell(null), color: '#6B7280', fontSize: 11 }}>{av && av !== 0 ? `${((bv / av - 1) * 100).toFixed(1)}%` : '—'}</td>
                      </tr>;
                    }
                    const bv = row.code ? (budget[row.code] ?? row.actual ?? 0) : 0;
                    const av = row.actual ?? 0;
                    const variance = bv - av;
                    const pct = av !== 0 ? ((bv / av - 1) * 100) : null;
                    return <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : '#0B1220', borderBottom: '1px solid #131D2E' }}>
                      <td style={{ padding: '5px 16px 5px 32px', color: '#4B5563', fontSize: 11, fontFamily: "'Courier New', monospace" }}>{row.code}</td>
                      <td style={{ padding: '5px 16px', color: '#C9B99A' }}>{row.name}</td>
                      <td style={numCell(av)}>{fmtCurrency(av)}</td>
                      <td style={numCell(bv)}>{fmtCurrency(bv)}</td>
                      <td style={numCell(variance, false, true)}>{fmtCurrency(variance)}</td>
                      <td style={{ ...numCell(null), color: pct !== null ? (pct > 0 ? '#10B981' : pct < 0 ? '#EF4444' : '#6B7280') : '#6B7280', fontSize: 11 }}>{pct !== null ? `${pct.toFixed(1)}%` : '—'}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Balance Sheet Tab */}
        {activeTab === 'bs' && tbData && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 22, color: '#C9A227' }}>Balance Sheet Budget</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>{entityName} — FY{budgetYear - 1} Actuals vs FY{budgetYear} Budget</p>
            </div>
            <div style={{ backgroundColor: '#0D1524', border: '1px solid #1E2D45', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#0A1020', borderBottom: '2px solid #C9A227' }}>
                    <th style={th('left', 220)}>Account</th><th style={th('left')}>Name</th>
                    <th style={th('right', 160)}>FY{budgetYear - 1} Actual</th>
                    <th style={th('right', 160)}>FY{budgetYear} Budget</th>
                    <th style={th('right', 100)}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {tbData.bsRows.map((row, i) => {
                    if (row.type === 'header') {
                      const isMain = row.code?.endsWith('000');
                      return <tr key={i}><td colSpan={5} style={{ padding: isMain ? '10px 16px 6px' : '12px 16px 4px', color: isMain ? '#C9A227' : '#9CA3AF', fontWeight: isMain ? 'bold' : 'normal', fontSize: isMain ? 14 : 12, textTransform: isMain ? 'uppercase' : 'none', borderTop: isMain ? '1px solid #1E2D45' : 'none' }}>{isMain ? `◆ ${row.name}` : `  ${row.name}`}</td></tr>;
                    }
                    if (row.type === 'total') {
                      const bv = sectionTotal(tbData.bsRows, row, budget);
                      const av = row.actual;
                      const isKey = ['Net Assets', 'Total Assets', 'Total Liabilities', 'Total Equity'].includes(row.name);
                      return <tr key={i} style={{ backgroundColor: isKey ? '#0A1522' : '#111827', borderTop: '1px solid #1E2D45' }}>
                        <td colSpan={2} style={{ padding: '8px 16px', color: isKey ? '#C9A227' : '#E8DCC8', fontWeight: isKey ? 'bold' : '600', fontSize: isKey ? 14 : 13 }}>{row.name}</td>
                        <td style={numCell(av, true)}>{fmtCurrency(av)}</td>
                        <td style={numCell(bv, true)}>{fmtCurrency(bv)}</td>
                        <td style={numCell(bv - (av ?? 0), false, true)}>{fmtCurrency(bv - (av ?? 0))}</td>
                      </tr>;
                    }
                    const bv = row.code ? (budget[row.code] ?? row.actual ?? 0) : 0;
                    const av = row.actual ?? 0;
                    return <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : '#0B1220', borderBottom: '1px solid #131D2E' }}>
                      <td style={{ padding: '5px 16px 5px 32px', color: '#4B5563', fontSize: 11, fontFamily: "'Courier New', monospace" }}>{row.code}</td>
                      <td style={{ padding: '5px 16px', color: '#C9B99A' }}>{row.name}</td>
                      <td style={numCell(av)}>{fmtCurrency(av)}</td>
                      <td style={numCell(bv)}>{fmtCurrency(bv)}</td>
                      <td style={numCell(bv - av, false, true)}>{fmtCurrency(bv - av)}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Assumptions Tab */}
        {activeTab === 'assumptions' && tbData && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, color: '#C9A227' }}>Budget Assumptions</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>Edit % change or enter a manual value for each account</p>
              </div>
              <button onClick={suggestAssumptions} disabled={aiLoading} style={btnStyle('primary')}>{aiLoading ? '⟳ Analysing…' : '✦ AI Suggest All'}</button>
            </div>
            <div style={{ backgroundColor: '#0D1524', border: '1px solid #1E2D45', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#0A1020', borderBottom: '2px solid #C9A227' }}>
                    <th style={th('left', 120)}>Code</th><th style={th('left')}>Account Name</th>
                    <th style={th('center', 100)}>Type</th><th style={th('right', 140)}>Actual</th>
                    <th style={th('center', 200)}>Assumption</th><th style={th('right', 140)}>Budget</th>
                    <th style={th('left')}>AI Note</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(tbData.accountMap).filter(a => a.actual !== null).map((acct, i) => {
                    const ass = assumptions[acct.code!] || { method: 'pct', pct: 0 };
                    const bv = acct.code ? (budget[acct.code] ?? 0) : 0;
                    const variance = bv - (acct.actual ?? 0);
                    const typeColors: Record<string, string> = { income: '#10B981', cogs: '#F59E0B', expense: '#EF4444', asset: '#3B82F6', liability: '#8B5CF6', equity: '#EC4899', other_income: '#14B8A6', other_expense: '#F97316' };
                    return (
                      <tr key={acct.code} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : '#0B1220', borderBottom: '1px solid #131D2E' }}>
                        <td style={{ padding: '6px 16px', color: '#4B5563', fontSize: 11, fontFamily: "'Courier New', monospace" }}>{acct.code}</td>
                        <td style={{ padding: '6px 8px', color: '#C9B99A' }}>{acct.name}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, color: typeColors[acct.atype || ''] || '#9CA3AF', border: `1px solid ${typeColors[acct.atype || ''] || '#374151'}` }}>{acct.atype?.replace('_', ' ')}</span>
                        </td>
                        <td style={{ ...numCell(acct.actual), padding: '6px 16px' }}>{fmtCurrency(acct.actual)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                            <select value={ass.method} onChange={e => setAssumptions(p => ({ ...p, [acct.code!]: { ...p[acct.code!], method: e.target.value as 'pct' | 'manual' } }))}
                              style={{ padding: '3px 6px', backgroundColor: '#0A1020', border: '1px solid #1E2D45', borderRadius: 4, color: '#9CA3AF', fontSize: 11 }}>
                              <option value="pct">%</option><option value="manual">Manual $</option>
                            </select>
                            {ass.method === 'pct'
                              ? <><input type="number" value={ass.pct ?? 0} step="0.5" onChange={e => setAssumptions(p => ({ ...p, [acct.code!]: { ...p[acct.code!], pct: parseFloat(e.target.value) || 0 } }))}
                                  style={{ width: 60, padding: '3px 6px', backgroundColor: '#0A1020', border: '1px solid #1E2D45', borderRadius: 4, color: (ass.pct || 0) > 0 ? '#10B981' : (ass.pct || 0) < 0 ? '#EF4444' : '#9CA3AF', fontSize: 12, textAlign: 'right', fontFamily: "'Courier New', monospace" }} />
                                <span style={{ color: '#4B5563', fontSize: 11 }}>%</span></>
                              : <input type="number" value={ass.manual ?? (acct.actual ?? 0)} step="100" onChange={e => setAssumptions(p => ({ ...p, [acct.code!]: { ...p[acct.code!], manual: parseFloat(e.target.value) || 0 } }))}
                                  style={{ width: 100, padding: '3px 6px', backgroundColor: '#0A1020', border: '1px solid #C9A22740', borderRadius: 4, color: '#C9A227', fontSize: 12, textAlign: 'right', fontFamily: "'Courier New', monospace" }} />}
                          </div>
                        </td>
                        <td style={{ padding: '6px 16px', textAlign: 'right', fontFamily: "'Courier New', monospace", color: '#E8DCC8', fontSize: 12 }}>
                          {fmtCurrency(bv)}
                          <span style={{ display: 'block', fontSize: 10, color: variance > 0 ? '#10B981' : variance < 0 ? '#EF4444' : '#4B5563' }}>{variance !== 0 ? `${variance > 0 ? '+' : ''}${fmtCurrency(variance)}` : ''}</span>
                        </td>
                        <td style={{ padding: '6px 8px', color: '#6B7280', fontSize: 11, maxWidth: 200, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{ass.aiReason || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Anomalies Tab */}
        {activeTab === 'anomalies' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, color: '#C9A227' }}>Transaction Anomalies</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>Transactions flagged as statistical outliers (&gt;2.5σ from account mean)</p>
              </div>
            </div>
            {!anomalies.length && (
              <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>{glData ? 'No statistical outliers detected. GL appears clean.' : 'Upload a General Ledger file to detect anomalies.'}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {anomalies.map((a, i) => (
                <div key={i} onClick={() => setSelectedAnomaly(selectedAnomaly === i ? null : i)}
                  style={{ backgroundColor: selectedAnomaly === i ? '#0F1E35' : '#0D1524', border: `1px solid ${selectedAnomaly === i ? '#C9A22760' : '#1E2D45'}`, borderRadius: 6, cursor: 'pointer', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
                    <span style={{ color: '#4B5563', fontSize: 11, fontFamily: "'Courier New', monospace", width: 80 }}>{a.accountCode}</span>
                    <span style={{ color: '#9CA3AF', fontSize: 12, width: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.accountName}</span>
                    <span style={{ color: '#6B7280', fontSize: 12, width: 90 }}>{a.date}</span>
                    <span style={{ color: '#9CA3AF', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.desc}</span>
                    <span style={{ color: Math.abs(a.net ?? 0) > 10000 ? '#F59E0B' : '#E8DCC8', fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: 'bold', width: 120, textAlign: 'right' }}>{fmtCurrency(a.net)}</span>
                    <span style={{ color: '#4B5563' }}>{selectedAnomaly === i ? '▲' : '▼'}</span>
                  </div>
                  {selectedAnomaly === i && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #1E2D45', backgroundColor: '#0A1020' }}>
                      <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>
                        <span style={{ color: '#4B5563' }}>Type:</span> {a.type} &nbsp;|&nbsp;
                        <span style={{ color: '#4B5563' }}>Ref:</span> {a.ref} &nbsp;|&nbsp;
                        <span style={{ color: '#4B5563' }}>Amount:</span> <span style={{ color: '#C9A227', fontFamily: "'Courier New', monospace" }}>{fmtCurrency(a.net)}</span>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
