/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const MONTHS = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun']
const METHOD_PCT     = '% Change'
const METHOD_ANNUAL  = 'Annual $'
const METHOD_MONTHLY = 'Monthly $'
const METHODS = [METHOD_PCT, METHOD_ANNUAL, METHOD_MONTHLY]
const TOLERANCE = 2.0

// Method display → Excel short code
const METHOD_CODE: Record<string, string> = {
  [METHOD_PCT]:     'percentage',
  [METHOD_ANNUAL]:  'fixed',
  [METHOD_MONTHLY]: 'manual',
}

// ─── COLOURS ─────────────────────────────────────────────────────────────────
const C = {
  navy:       'FF1F3864',
  blue:       'FF2E75B6',
  lightBlue:  'FFD6DCE4',
  paleBlue:   'FFD9E1F2',
  gray:       'FFF2F2F2',
  yellow:     'FFFFFBCC',
  brightYellow:'FFFFFF00',
  green:      'FFE2EFDA',
  greenPass:  'FFC6EFCE',
  redFail:    'FFFFC7CE',
  warnYellow: 'FFFFEB9C',
  white:      'FFFFFFFF',
  black:      'FF000000',
}

// ─── ACCOUNT UTILITIES ───────────────────────────────────────────────────────
function accountType(code: string) {
  const p = code?.charAt(0) || ''
  if (p === '1') return 'asset'
  if (p === '2') return 'liability'
  if (p === '3') return 'equity'
  if (p === '4') return 'income'
  if (p === '5') return 'cogs'
  if (p === '6' || p === '7') return 'expense'
  if (p === '8') return 'other_income'
  if (p === '9') return 'other_expense'
  return 'unknown'
}
const isPL     = (code: string) => ['4','5','6','7','8','9'].includes(code?.charAt(0))
const isBank   = (code: string, name: string) => code?.startsWith('1-0') && /cash|account|nab|cba|westpac|wbc|anz|bank/i.test(name||'')
const isLoanLiab = (code: string) => code?.startsWith('2-5')
const isIntercoLoan = (code: string, name: string) => code?.startsWith('1-02') || (code?.startsWith('1-0') && /^loan\s*-/i.test(name||''))
const isNonCash = (code: string, name: string) =>
  /depreciation|amortisation|borrowing\s*cost|accrual|leave/i.test(name||'') ||
  code?.startsWith('9-0')

const toDisplay = (net: number, atype: string) =>
  (atype === 'income' || atype === 'other_income') ? -(net||0) : (net||0)

const fmtComma = (n: number) => n == null ? '' : n.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2})
const fmt$ = (n: number) => n == null ? '' : n.toFixed(2)

// ─── EXCEL COLUMN UTILITIES ───────────────────────────────────────────────────
function CL(n: number): string {
  let s = ''
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) }
  return s
}
// P&L column layout (1-based):
//   A(1)=Code, B(2)=Account
//   actual month i: CL(3+2i), budget month i: CL(4+2i)
//   AA(27)=FY actual, AB(28)=FY budget, AC(29)=Var$, AD(30)=Var%
const AC  = (i: number) => CL(3 + i*2)
const BC  = (i: number) => CL(4 + i*2)
const AAC = CL(27)
const ABC = CL(28)
const ACC = CL(29)
const ADC = CL(30)
const GC  = (i: number) => CL(4 + i)  // GL Data sheet month col: D=Jul..O=Jun

// ─── TB PARSER ────────────────────────────────────────────────────────────────
interface TBAccount { code: string; name: string; balance: number; atype: string }
interface PLRow { type: 'leaf'|'header'|'subtotal'|'ignored'; code?: string; name: string; atype?: string; balance?: number; tbValue?: number }
interface TBParsed {
  entityName: string; tbPeriod: string; fyYear: number|null; budgetYear: number|null
  tbAccounts: Record<string, TBAccount>; plRows: PLRow[]
}

function parseTB(wb: XLSX.WorkBook): TBParsed {
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header:1, defval:null })

  let entityName = '', tbPeriod = '', fyYear: number|null = null

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i]
    if (i === 1) entityName = String(r[1] || r[6] || '').trim()
    if (i === 5) {
      tbPeriod = String(r[1] || r[6] || '').trim()
      const m = tbPeriod.match(/\b(\d{4})\b$/)
      if (m) fyYear = parseInt(m[1])
    }
  }

  const tbAccounts: Record<string, TBAccount> = {}
  for (const [codeCol, nameCol, balCol] of [[1,2,3],[6,7,8]]) {
    for (const r of rows) {
      const code = r[codeCol]
      if (!code || typeof code !== 'string' || !/^\d+-\d+/.test(code)) continue
      const bal = r[balCol]
      if (typeof bal !== 'number') continue
      const name = String(r[nameCol] || '').trim()
      tbAccounts[code] = { code, name, balance: bal, atype: accountType(code) }
    }
  }

  const plRows: PLRow[] = []
  let headerRows = 0
  for (const r of rows) {
    const code = r[6], name = r[7], bal = r[8]
    if (code == null && name == null) continue
    const codeStr = code ? String(code).trim() : ''
    const nameStr = name ? String(name).trim() : ''
    if (!codeStr && !nameStr) continue
    if (/Trail Balance|Accrual mode|Generated|Profit|Loss/.test(codeStr) && headerRows < 10) {
      headerRows++; continue
    }
    if (codeStr === 'Total' || nameStr === 'Total') continue

    const isLeafCode = /^\d+-\d+/.test(codeStr)
    const numericBal = typeof bal === 'number'

    if (isLeafCode && numericBal) {
      plRows.push({ type:'leaf', code:codeStr, name:String(r[7]||'').trim(), atype:accountType(codeStr), balance:bal })
    } else if (isLeafCode && !numericBal) {
      plRows.push({ type:'header', code:codeStr, name:nameStr })
    } else if (!isLeafCode && nameStr && numericBal) {
      const isSum = nameStr.startsWith('Total') || ['Gross Profit','Operating Profit','Net Profit'].includes(nameStr)
      plRows.push({ type: isSum ? 'subtotal' : 'ignored', name:nameStr, tbValue:bal })
    }
  }

  return { entityName, tbPeriod, fyYear, budgetYear: fyYear ? fyYear+1 : null, tbAccounts, plRows }
}

// ─── GL PARSER ────────────────────────────────────────────────────────────────
interface GLAccount {
  code: string; name: string; opening: number
  monthly_net: Record<string, number>; monthly_closing: Record<string, number>; annual_net: number
}
interface GLParsed { entityName: string; glPeriod: string; glAccounts: Record<string, GLAccount> }

function parseGL(wb: XLSX.WorkBook): GLParsed {
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header:1, defval:null })

  let entityName = '', glPeriod = ''
  const glAccounts: Record<string, GLAccount> = {}
  let cur: GLAccount|null = null

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const c0 = r[0]
    if (i === 1) entityName = String(c0||'').trim()
    if (i === 5) glPeriod = String(c0||'').trim()
    if (!c0) continue
    const s0 = String(c0)

    if (/^\d+-\d+/.test(s0) && !s0.includes('/')) {
      cur = {
        code: s0.trim(), name: String(r[1]||'').trim(),
        opening: typeof r[5]==='number' ? r[5] : 0,
        monthly_net: {}, monthly_closing: {}, annual_net: 0
      }
      glAccounts[cur.code] = cur
      continue
    }
    if (s0 === 'Date') continue
    if (s0 === 'Total' && cur) {
      if (typeof r[8]==='number') cur.annual_net = r[8]
      continue
    }
    if (cur && /^\d{2}\/\d{2}\/\d{4}/.test(s0)) {
      const calMonth = parseInt(s0.split('/')[1])
      const mKey = MONTHS[(calMonth - 7 + 12) % 12]
      if (typeof r[8]==='number') cur.monthly_net[mKey] = (cur.monthly_net[mKey]||0) + r[8]
      if (typeof r[9]==='number') cur.monthly_closing[mKey] = r[9]
    }
  }
  return { entityName, glPeriod, glAccounts }
}

// ─── RECONCILIATION ───────────────────────────────────────────────────────────
interface ReconRow { code: string; name: string; tb: number; gl: number; diff: number; status: 'PASS'|'FAIL'|'INFO' }
interface Recon { failures: ReconRow[]; info: ReconRow[]; passed: boolean }

function reconcile(tbParsed: TBParsed, glParsed: GLParsed): Recon {
  const failures: ReconRow[] = [], info: ReconRow[] = []
  for (const [code, tb] of Object.entries(tbParsed.tbAccounts)) {
    const gl = glParsed.glAccounts[code]
    if (!gl) continue
    const tbAbs = Math.abs(tb.balance)
    const glAbs = Math.abs(gl.annual_net)
    const diff = Math.abs(tbAbs - glAbs)
    if (isPL(code)) {
      if (diff > TOLERANCE) failures.push({ code, name:tb.name, tb:tbAbs, gl:glAbs, diff, status:'FAIL' })
      else info.push({ code, name:tb.name, tb:tbAbs, gl:glAbs, diff, status:'PASS' })
    } else {
      info.push({ code, name:tb.name, tb:tbAbs, gl:glAbs, diff, status:'INFO' })
    }
  }
  return { failures, info, passed: failures.length === 0 }
}

// ─── ASSUMPTIONS BUILDER ─────────────────────────────────────────────────────
interface Assumption {
  code: string; name: string; atype: string; method: string; value: number
  nonCash: boolean; notes: string; prior_monthly: Record<string,number>; prior_annual: number
}

function buildAssumptions(tbParsed: TBParsed, glParsed: GLParsed): Record<string, Assumption> {
  const assum: Record<string, Assumption> = {}
  for (const [code, tb] of Object.entries(tbParsed.tbAccounts)) {
    if (!isPL(code)) continue
    const gl = glParsed.glAccounts[code]
    const prior_monthly: Record<string,number> = {}
    if (gl) {
      for (const m of MONTHS) prior_monthly[m] = toDisplay(gl.monthly_net[m]||0, tb.atype)
    } else {
      for (const m of MONTHS) prior_monthly[m] = 0
    }
    const prior_annual = MONTHS.reduce((s,m) => s + (prior_monthly[m]||0), 0)
    const journalOnly = gl && Object.values(gl.monthly_net).every(v => v===0) && gl.annual_net !== 0
    const nonCashFlag = isNonCash(code, tb.name) || journalOnly

    let notes = ''
    if (nonCashFlag) {
      if (/depreciation/i.test(tb.name)) notes = "Account name contains 'depreciation'"
      else if (/amortis/i.test(tb.name)) notes = "Account name contains 'amortisation'"
      else if (/borrowing/i.test(tb.name)) notes = "Account name contains 'borrowing cost'"
      else if (/accrual/i.test(tb.name)) notes = "Account name contains 'accrual'"
      else if (/leave/i.test(tb.name)) notes = `Account name contains 'leave'`
      else if (journalOnly) notes = "Journal-only transactions with 'accrual' in descriptions"
      else notes = 'Flagged non-cash'
    }

    // Default growth rates by account type
    let defaultValue = 0
    if (!nonCashFlag) {
      const atype = accountType(code)
      if (atype === 'income' || atype === 'other_income') defaultValue = 5
      else if (atype === 'cogs' || atype === 'expense') defaultValue = 4
      // interest/depreciation/other non-cash remain 0 (already flagged as nonCash above)
    }

    assum[code] = {
      code, name: tb.name, atype: tb.atype,
      method: METHOD_PCT, value: defaultValue,
      nonCash: nonCashFlag, notes,
      prior_monthly, prior_annual
    }
  }
  return assum
}

// ─── BUDGET ENGINE ────────────────────────────────────────────────────────────
function computeBudget(assumptions: Record<string, Assumption>) {
  const budget: Record<string, { monthly: Record<string,number>; annual: number }> = {}
  for (const [code, a] of Object.entries(assumptions)) {
    const monthly: Record<string,number> = {}
    if (a.method === METHOD_PCT) {
      const f = 1 + (a.value||0) / 100
      for (const m of MONTHS) monthly[m] = (a.prior_monthly[m]||0) * f
    } else if (a.method === METHOD_ANNUAL) {
      const total = a.value||0
      const priorTotal = a.prior_annual||0
      for (const m of MONTHS)
        monthly[m] = priorTotal === 0 ? total/12 : ((a.prior_monthly[m]||0)/priorTotal)*total
    } else {
      for (const m of MONTHS) monthly[m] = a.value||0
    }
    budget[code] = { monthly, annual: MONTHS.reduce((s,m)=>s+(monthly[m]||0),0) }
  }
  return budget
}

// ─── EXCEL STYLE HELPERS ──────────────────────────────────────────────────────
type ExcelJSWorksheet = any
type ExcelJSCell = any

function solidFill(argb: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } }
}
function fontSpec(bold: boolean, size: number, argb = C.black, name = 'Calibri') {
  return { bold, size, color: { argb }, name }
}
function alignSpec(h: "left"|"center"|"right"|"fill"|"justify"|"centerContinuous"|"distributed" = "left", v: "top"|"middle"|"bottom"|"distributed"|"justify" = "middle") {
  return { horizontal: h, vertical: v }
}

function styleCell(cell: ExcelJSCell, opts: {
  bold?: boolean; size?: number; fontColor?: string
  fill?: string; align?: "left"|"center"|"right"|"fill"|"justify"|"centerContinuous"|"distributed"; numFmt?: string; name?: string
}) {
  if (opts.fill) cell.fill = solidFill(opts.fill)
  cell.font = fontSpec(opts.bold ?? false, opts.size ?? 10, opts.fontColor ?? C.black, opts.name ?? 'Calibri')
  if (opts.align) cell.alignment = alignSpec(opts.align)
  if (opts.numFmt) cell.numFmt = opts.numFmt
}

// Style entire row (cols 1..maxCol)
function styleRow(ws: ExcelJSWorksheet, rowNum: number, maxCol: number, opts: {
  bold?: boolean; size?: number; fontColor?: string; fill?: string; numFmt?: string
}) {
  for (let c = 1; c <= maxCol; c++) {
    const cell = ws.getCell(rowNum, c)
    if (opts.fill) cell.fill = solidFill(opts.fill)
    cell.font = fontSpec(opts.bold ?? false, opts.size ?? 10, opts.fontColor ?? C.black)
    if (opts.numFmt) cell.numFmt = opts.numFmt
  }
}

// ─── EXCEL GENERATOR ─────────────────────────────────────────────────────────
async function generateExcel(
  tbParsed: TBParsed,
  glParsed: GLParsed,
  assumptions: Record<string, Assumption>,
  budget: Record<string, { monthly: Record<string,number>; annual: number }>
): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'BAKR Budget Builder'
  wb.created = new Date()

  const { entityName, fyYear, budgetYear, tbAccounts, plRows } = tbParsed
  const { glAccounts } = glParsed
  const recon = reconcile(tbParsed, glParsed)
  const fy = `FY${fyYear}`, bfy = `FY${budgetYear}`
  const today = new Date().toLocaleDateString('en-AU', {day:'numeric',month:'long',year:'numeric'})
  const dateStamp = new Date().toISOString().slice(0,10).replace(/-/g,'')

  const numFmt  = '#,##0;(#,##0);"-"'
  const numFmt2 = '#,##0.00;(#,##0.00);"-"'
  const pctFmt  = '0.0%;(0.0%);"-"'

  // ─── HELPER: build row formulas ─────────────────────────────────────────
  const sumF = (col: string, rows: number[]) =>
    rows.length === 0 ? 0 : { formula: rows.map(r => `${col}${r}`).join('+') }

  const diffF = (col: string, pos: number[], neg: number[]) => {
    if (pos.length === 0 && neg.length === 0) return 0
    const ps = pos.length ? pos.map(r=>`${col}${r}`).join('+') : '0'
    if (neg.length === 0) return { formula: ps }
    if (pos.length === 0) return { formula: `-(${neg.map(r=>`${col}${r}`).join('+')})` }
    return { formula: `(${ps})-(${neg.map(r=>`${col}${r}`).join('+')})` }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GL DATA SHEET
  // ─────────────────────────────────────────────────────────────────────────
  const wsGL = wb.addWorksheet('GL Data')
  wsGL.columns = [
    { width: 10 }, { width: 40 }, { width: 12 },
    ...MONTHS.map(() => ({ width: 12 })),
    { width: 14 }
  ]

  const glHeaderRow = wsGL.addRow(['Code','Name','Type',...MONTHS,'Annual Total'])
  glHeaderRow.font = fontSpec(true, 11)

  const glRowNum: Record<string, number> = {}
  for (const a of Object.values(assumptions)) {
    const row = wsGL.addRow([a.code, a.name, a.atype, ...MONTHS.map(m => a.prior_monthly[m]||0), a.prior_annual])
    glRowNum[a.code] = row.number
    for (let c = 4; c <= 16; c++) row.getCell(c).numFmt = numFmt
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ASSUMPTIONS SHEET
  // ─────────────────────────────────────────────────────────────────────────
  const wsA = wb.addWorksheet('Assumptions')
  wsA.columns = [
    { width: 9 }, { width: 40 }, { width: 16 }, { width: 11 },
    { width: 12 }, { width: 16 }, { width: 16 }, { width: 45 }
  ]

  // Row 1 — title
  const aRow1 = wsA.addRow([`${entityName} — Budget Assumptions ${bfy}`])
  wsA.mergeCells(`A${aRow1.number}:H${aRow1.number}`)
  styleCell(wsA.getCell(`A${aRow1.number}`), { bold:true, size:13, fontColor:C.white, fill:C.navy })

  // Row 2 — instruction
  const aRow2 = wsA.addRow(['✏  EDITABLE CELLS ARE HIGHLIGHTED IN YELLOW.  % Change = adjust prior year by percentage  |  Annual $ = enter year total  |  Monthly $ = same amount each month'])
  wsA.mergeCells(`A${aRow2.number}:H${aRow2.number}`)
  styleCell(wsA.getCell(`A${aRow2.number}`), { size:9, fill:C.lightBlue })

  // Row 3 — headers
  const aHdrRow = wsA.addRow(['Code','Account Name','Type','Non-Cash?','Method','Value',`${fy} Actual`,'Notes'])
  aHdrRow.eachCell(cell => { cell.fill = solidFill(C.blue); cell.font = fontSpec(true, 10, C.white) })

  // Data rows
  for (const a of Object.values(assumptions)) {
    const r = wsA.addRow([
      a.code, a.name, a.atype,
      a.nonCash ? 'Yes' : 'No',
      METHOD_CODE[a.method] || 'percentage',
      a.value,
      a.prior_annual,
      a.notes || ''
    ])
    // Code
    r.getCell(1).font = fontSpec(false, 9)
    // Account name
    r.getCell(2).font = fontSpec(false, 10)
    // Type
    r.getCell(3).font = fontSpec(false, 9)
    // Non-cash
    r.getCell(4).font = fontSpec(false, 10)
    r.getCell(4).alignment = alignSpec('center')
    if (a.nonCash) r.getCell(4).fill = solidFill(C.green)
    // Method
    r.getCell(5).font = fontSpec(false, 10)
    r.getCell(5).fill = solidFill(C.yellow)
    r.getCell(5).alignment = alignSpec('center')
    r.getCell(5).protection = { locked: false }
    // Value
    r.getCell(6).font = fontSpec(false, 10)
    r.getCell(6).fill = solidFill(C.yellow)
    r.getCell(6).numFmt = numFmt2
    r.getCell(6).protection = { locked: false }
    // FY Actual
    r.getCell(7).font = fontSpec(false, 10)
    r.getCell(7).fill = solidFill(C.gray)
    r.getCell(7).numFmt = numFmt
    // Notes
    r.getCell(8).font = fontSpec(false, 9)
    r.getCell(8).protection = { locked: false }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // P&L AND CASH FLOW SHEET
  // ─────────────────────────────────────────────────────────────────────────
  const wsPL = wb.addWorksheet('P&L and Cash Flow')
  wsPL.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }]
  wsPL.columns = [
    { width: 9 }, { width: 38 },
    ...Array(24).fill(null).map(() => ({ width: 13 })),
    { width: 14 }, { width: 14 }, { width: 13 }, { width: 10 }
  ]

  // Helper: get col index (1-based) from letter
  const colIdx = (letter: string) => {
    let n = 0
    for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n
  }

  // Add a P&L row and return its ExcelJS row number
  // pnlData is the array of values/formulas for cols A..AD
  const addPLRow = (data: any[]): number => {
    const row = wsPL.addRow(data)
    return row.number
  }

  // Section leaf row accumulators
  const incLeaves: number[]   = []
  const cogsLeaves: number[]  = []
  const expLeaves: number[]   = []
  const oIncLeaves: number[]  = []
  const oExpLeaves: number[]  = []
  const leafRowNum: Record<string, number> = {}
  const nonCashRowNums: number[] = []

  const scopeStack: { leaves: number[] }[] = [{ leaves: [] }]

  let netProfitRow: number|null = null
  const cfRows: number[] = []
  const finRows: number[] = []
  let taxRow: number|null = null
  let openBankRow: number|null = null
  let netCashRow: number|null = null
  let closeBankRow: number|null = null
  let netOpCFRow: number|null = null
  let netFinCFRow: number|null = null

  // ── Style helpers for P&L rows ──────────────────────────────────────────
  const TOTAL_COLS = 30  // A..AD

  const stylePLRow_Header1 = (rowNum: number) => {
    // Full-width navy section header (Income, Expenses etc)
    wsPL.mergeCells(`A${rowNum}:AD${rowNum}`)
    wsPL.getRow(rowNum).height = 18
    const cell = wsPL.getCell(`A${rowNum}`)
    cell.fill = solidFill(C.blue)
    cell.font = fontSpec(true, 11, C.white)
    cell.alignment = alignSpec('left', 'middle')
  }

  const stylePLRow_Header2 = (rowNum: number) => {
    // Subsection header (B merged B:AD)
    wsPL.mergeCells(`B${rowNum}:AD${rowNum}`)
    const cell = wsPL.getCell(`B${rowNum}`)
    cell.fill = solidFill(C.lightBlue)
    cell.font = fontSpec(true, 10, C.black)
    wsPL.getCell(`A${rowNum}`).font = fontSpec(false, 9)
  }

  const stylePLRow_Leaf = (rowNum: number, nonCash = false) => {
    const row = wsPL.getRow(rowNum)
    for (let c = 1; c <= TOTAL_COLS; c++) {
      const cell = row.getCell(c)
      if (c === 1) {
        cell.font = fontSpec(false, 9)
      } else if (c === 2) {
        cell.font = fontSpec(false, 10)
      } else {
        const colLetter = CL(c)
        const isActualMonth = c >= 3 && c <= 26 && (c % 2 === 1) // odd cols C,E,G... = actuals
        const isBudgetMonth = c >= 3 && c <= 26 && (c % 2 === 0) // even cols D,F,H... = budget
        const isTotalCol = c >= 27 && c <= 29
        const isVarPct = c === 30

        if (nonCash) {
          cell.fill = solidFill(C.green)
        } else if (isActualMonth) {
          cell.fill = solidFill(C.gray)
        } else if (isBudgetMonth) {
          cell.fill = solidFill(C.yellow)
          cell.protection = { locked: false }
        } else if (isTotalCol || isVarPct) {
          cell.fill = solidFill(C.paleBlue)
        }

        cell.font = fontSpec(false, 10)
        if (c !== 30) cell.numFmt = numFmt
        else cell.numFmt = pctFmt
      }
    }
  }

  const stylePLRow_Subtotal = (rowNum: number) => {
    for (let c = 1; c <= TOTAL_COLS; c++) {
      const cell = wsPL.getCell(rowNum, c)
      cell.fill = solidFill(C.paleBlue)
      cell.font = fontSpec(c === 1 ? false : true, 10)
      if (c >= 3 && c <= 29) cell.numFmt = numFmt
      else if (c === 30) cell.numFmt = pctFmt
    }
    wsPL.getCell(rowNum, 1).font = fontSpec(false, 9) // code col: no bold
  }

  // ── Header rows 1–3 ──────────────────────────────────────────────────────
  // Row 1: title
  const r1 = addPLRow([entityName])
  wsPL.mergeCells(`A${r1}:AD${r1}`)
  styleCell(wsPL.getCell(`A${r1}`), { bold:true, size:14, fontColor:C.white, fill:C.navy, align:'center' })

  // Row 2: subtitle
  const r2 = addPLRow([`P&L Budget — ${bfy}  |  Actuals ${fy}  |  GST assumed on monthly BAS and excluded from this model`])
  wsPL.mergeCells(`A${r2}:AD${r2}`)
  styleCell(wsPL.getCell(`A${r2}`), { size:10, fontColor:C.white, fill:C.blue, align:'center' })

  // Row 3: column headers
  const hdrData: string[] = ['Code','Account']
  for (let i = 0; i < 12; i++) {
    hdrData.push(`${MONTHS[i]} ${fyYear! - 1}`)
    hdrData.push(`${MONTHS[i]} ${budgetYear!}`)
  }
  hdrData.push(`${fy} Total`, `${bfy} Budget`, 'Variance $', 'Var %')
  const r3 = addPLRow(hdrData)
  wsPL.getRow(r3).height = 30
  for (let c = 1; c <= TOTAL_COLS; c++) {
    const cell = wsPL.getCell(r3, c)
    if (c <= 2) {
      cell.fill = solidFill(C.navy)
      cell.font = fontSpec(true, 10, C.white)
    } else if (c >= 3 && c <= 26) {
      const isActual = (c % 2 === 1) // odd = actual (C=3,E=5...)
      cell.fill = solidFill(isActual ? C.gray : C.yellow)
      cell.font = fontSpec(true, 9, C.black)
    } else {
      cell.fill = solidFill(C.paleBlue)
      cell.font = fontSpec(true, 9, C.black)
    }
    cell.alignment = alignSpec('center', 'middle')
  }

  // ── makeLeaf: build 30-element array for a leaf account ─────────────────
  const makeLeaf = (code: string, name: string): any[] => {
    const gr = glRowNum[code]
    const bgt = budget[code]
    const a = assumptions[code]
    const rowData: any[] = [code, name]
    for (let i = 0; i < 12; i++) {
      rowData.push(gr ? { formula: `'GL Data'!${GC(i)}${gr}` } : 0)
      rowData.push(bgt ? (bgt.monthly[MONTHS[i]]||0) : 0)
    }
    const pa = a?.prior_annual || 0
    const ba = bgt?.annual || 0
    rowData.push(pa)
    rowData.push(ba)
    rowData.push(ba - pa)
    rowData.push(pa !== 0 ? { formula: `IF(${AAC}{R}<>0,(${ABC}{R}-${AAC}{R})/ABS(${AAC}{R}),"")` } : '')
    return rowData
  }

  // ── pushSubtotal: add subtotal row, return row num ───────────────────────
  const pushSubtotal = (name: string, pos: number[], neg: number[] = []): number => {
    const data: any[] = [null, name]
    for (let i = 0; i < 12; i++) {
      data.push(diffF(AC(i), pos, neg))
      data.push(diffF(BC(i), pos, neg))
    }
    data.push(diffF(AAC, pos, neg))
    data.push(diffF(ABC, pos, neg))
    const rn = addPLRow(data)
    // Fix placeholder formulas that included {R}
    // Variance $ and % use the row's own AA/AB
    const row = wsPL.getRow(rn)
    row.getCell(colIdx(ACC)).value = { formula: `${ABC}${rn}-${AAC}${rn}` }
    row.getCell(colIdx(ADC)).value = { formula: `IF(${AAC}${rn}<>0,(${ABC}${rn}-${AAC}${rn})/ABS(${AAC}${rn}),"")` }
    stylePLRow_Subtotal(rn)
    return rn
  }

  // ── Process TB plRows ────────────────────────────────────────────────────
  let grossProfitDone = false, operatingProfitDone = false

  for (const tbRow of plRows) {
    if (tbRow.type === 'ignored') continue

    if (tbRow.type === 'header') {
      // Determine level: if it appears to be a major section, use Header1 style
      const isMajor = /^(Income|Expenses|Cost of|Other Income|Other Expense|Revenue)/i.test(tbRow.name)
      const rn = addPLRow(isMajor ? [tbRow.name] : [null, tbRow.name])
      if (isMajor) {
        stylePLRow_Header1(rn)
      } else {
        stylePLRow_Header2(rn)
      }
      scopeStack.push({ leaves: [] })

    } else if (tbRow.type === 'leaf') {
      if (!assumptions[tbRow.code!]) continue
      const a = assumptions[tbRow.code!]
      const leafData = makeLeaf(tbRow.code!, tbRow.name)
      // Fix the variance % formula placeholders
      const rn = addPLRow(leafData)
      wsPL.getRow(rn).getCell(colIdx(ADC)).value =
        a.prior_annual !== 0
          ? { formula: `IF(${AAC}${rn}<>0,(${ABC}${rn}-${AAC}${rn})/ABS(${AAC}${rn}),"")` }
          : ''
      leafRowNum[tbRow.code!] = rn
      for (const s of scopeStack) s.leaves.push(rn)
      const at = a.atype
      if (at === 'income')            incLeaves.push(rn)
      else if (at === 'cogs')         cogsLeaves.push(rn)
      else if (at === 'expense')      expLeaves.push(rn)
      else if (at === 'other_income') oIncLeaves.push(rn)
      else if (at === 'other_expense') oExpLeaves.push(rn)
      if (a.nonCash) nonCashRowNums.push(rn)
      stylePLRow_Leaf(rn, a.nonCash)

    } else if (tbRow.type === 'subtotal') {
      const name = tbRow.name
      if (name === 'Net Profit') {
        netProfitRow = pushSubtotal('Net Profit', [...incLeaves,...oIncLeaves], [...cogsLeaves,...expLeaves,...oExpLeaves])
      } else if (name === 'Operating Profit' && !operatingProfitDone) {
        operatingProfitDone = true
        pushSubtotal('Operating Profit', incLeaves, [...cogsLeaves,...expLeaves])
      } else if (name === 'Gross Profit' && !grossProfitDone) {
        grossProfitDone = true
        pushSubtotal('Gross Profit', incLeaves, cogsLeaves.length > 0 ? cogsLeaves : [])
      } else {
        const scope = scopeStack.length > 1 ? scopeStack.pop()! : { leaves: scopeStack[0].leaves.slice() }
        if (scope.leaves.length > 0) pushSubtotal(name, scope.leaves)
      }
    }
  }

  if (!netProfitRow) {
    netProfitRow = pushSubtotal('Net Profit', [...incLeaves,...oIncLeaves], [...cogsLeaves,...expLeaves,...oExpLeaves])
  }

  // ── INDIRECT CASH FLOW ────────────────────────────────────────────────────
  const addBlank = () => wsPL.addRow([]).number

  addBlank()
  addBlank()

  // Cash flow header
  const cfHdrRn = wsPL.addRow([`INDIRECT CASH FLOW — ${bfy} Budget`]).number
  wsPL.mergeCells(`A${cfHdrRn}:AD${cfHdrRn}`)
  styleCell(wsPL.getCell(`A${cfHdrRn}`), { bold:true, size:12, fontColor:C.white, fill:C.navy })

  // CF note
  const cfNoteRn = wsPL.addRow(['Note: GST assumed on monthly BAS — treated as neutral. Debtors and creditors assumed unchanged.']).number
  wsPL.mergeCells(`A${cfNoteRn}:AD${cfNoteRn}`)
  styleCell(wsPL.getCell(`A${cfNoteRn}`), { size:9, fill:C.lightBlue })

  // Net Profit reference row
  const npData: any[] = [null, 'Net Profit / (Loss)']
  for (let i = 0; i < 12; i++) {
    npData.push({ formula: `${AC(i)}${netProfitRow}` })
    npData.push({ formula: `${BC(i)}${netProfitRow}` })
  }
  npData.push({ formula: `${AAC}${netProfitRow}` }, { formula: `${ABC}${netProfitRow}` }, null, null)
  const npRn = addPLRow(npData)
  cfRows.push(npRn)
  stylePLRow_Subtotal(npRn)

  // Non-cash add-backs
  const nonCashAccounts = Object.values(assumptions).filter(a => a.nonCash && leafRowNum[a.code])
  for (const a of nonCashAccounts) {
    const src = leafRowNum[a.code]
    const row: any[] = [null, `Add back: ${a.name}`]
    for (let i = 0; i < 12; i++) {
      row.push({ formula: `${AC(i)}${src}` })
      row.push({ formula: `${BC(i)}${src}` })
    }
    row.push({ formula: `${AAC}${src}` }, { formula: `${ABC}${src}` }, null, null)
    const rn = addPLRow(row)
    cfRows.push(rn)
    stylePLRow_Leaf(rn, true)
  }

  const zeros28 = () => Array(28).fill(0)
  cfRows.push(addPLRow([null, 'Debtors movement (assumed nil)', ...zeros28()]))
  cfRows.push(addPLRow([null, 'Creditors movement (assumed nil)', ...zeros28()]))

  // Net Operating CF
  const netOpData: any[] = [null, 'NET OPERATING CASH FLOW']
  for (let i = 0; i < 12; i++) {
    netOpData.push(sumF(AC(i), cfRows))
    netOpData.push(sumF(BC(i), cfRows))
  }
  netOpData.push(sumF(AAC, cfRows), sumF(ABC, cfRows), null, null)
  netOpCFRow = addPLRow(netOpData)
  stylePLRow_Subtotal(netOpCFRow)

  // ── FINANCING ─────────────────────────────────────────────────────────────
  addBlank()
  const finHdrRn = wsPL.addRow(['FINANCING & INVESTING']).number
  wsPL.mergeCells(`A${finHdrRn}:AD${finHdrRn}`)
  styleCell(wsPL.getCell(`A${finHdrRn}`), { bold:true, size:11, fontColor:C.white, fill:C.navy })

  const loanCodes = [
    ...Object.keys(glAccounts).filter(c => isLoanLiab(c)),
    ...Object.keys(glAccounts).filter(c => isIntercoLoan(c, glAccounts[c]?.name || ''))
  ]
  const seenLoan = new Set<string>()
  for (const code of loanCodes) {
    if (seenLoan.has(code)) continue
    seenLoan.add(code)
    const gl = glAccounts[code]
    if (!gl) continue
    const row: any[] = [null, `${gl.name} — repayments/drawdowns`]
    for (let i = 0; i < 12; i++) {
      row.push(gl.monthly_net[MONTHS[i]]||0, 0)
    }
    row.push(gl.annual_net, 0, null, null)
    const rn = addPLRow(row)
    finRows.push(rn)
    stylePLRow_Leaf(rn)
  }
  for (let j = 1; j <= 3; j++) {
    const ocRn = addPLRow([null, `Other cash item ${j} ( - for cash out)`, ...zeros28()])
    finRows.push(ocRn)
    // Style: actuals gray (read-only), budget yellow (editable), totals paleBlue
    const ocRow = wsPL.getRow(ocRn)
    for (let c = 1; c <= TOTAL_COLS; c++) {
      const cell = ocRow.getCell(c)
      if (c === 1) { cell.font = fontSpec(false, 9) }
      else if (c === 2) { cell.font = fontSpec(false, 10) }
      else {
        const isActualMonth = c >= 3 && c <= 26 && (c % 2 === 1)
        const isBudgetMonth = c >= 3 && c <= 26 && (c % 2 === 0)
        const isTotalCol = c >= 27 && c <= 29
        const isVarPct = c === 30

        if (isActualMonth) cell.fill = solidFill(C.gray)
        else if (isBudgetMonth) { cell.fill = solidFill(C.yellow); cell.protection = { locked: false } }
        else if (isTotalCol || isVarPct) cell.fill = solidFill(C.paleBlue)

        cell.font = fontSpec(false, 10)
        if (c !== 30) cell.numFmt = numFmt
        else cell.numFmt = pctFmt
      }
    }
  }

  // Tax row (editable budget columns)
  const taxRowData = [null, 'Income tax paid — Budget (enter quarterly PAYG)', ...zeros28()]
  taxRow = addPLRow(taxRowData)
  wsPL.getCell(taxRow, 2).fill = solidFill(C.brightYellow)
  wsPL.getCell(taxRow, 2).font = fontSpec(false, 10)
  // Style data cells: gray actuals, yellow budget (unlocked), paleBlue totals
  for (let c = 3; c <= TOTAL_COLS; c++) {
    const cell = wsPL.getCell(taxRow, c)
    const isActualMonth = c >= 3 && c <= 26 && (c % 2 === 1)
    const isBudgetMonth = c >= 3 && c <= 26 && (c % 2 === 0)
    const isTotalCol = c >= 27 && c <= 29
    const isVarPct = c === 30
    if (isActualMonth) cell.fill = solidFill(C.gray)
    else if (isBudgetMonth) { cell.fill = solidFill(C.yellow); cell.protection = { locked: false } }
    else if (isTotalCol || isVarPct) cell.fill = solidFill(C.paleBlue)
    cell.font = fontSpec(false, 10)
    if (c !== 30) cell.numFmt = numFmt
    else cell.numFmt = pctFmt
  }

  // Net Financing CF
  const netFinData: any[] = [null, 'NET FINANCING / INVESTING CASH FLOW']
  for (let i = 0; i < 12; i++) {
    netFinData.push(sumF(AC(i), finRows))
    netFinData.push(sumF(BC(i), finRows))
  }
  netFinData.push(sumF(AAC, finRows), sumF(ABC, finRows), null, null)
  netFinCFRow = addPLRow(netFinData)
  stylePLRow_Subtotal(netFinCFRow)

  // ── BANK POSITION ─────────────────────────────────────────────────────────
  addBlank()
  const bankHdrRn = wsPL.addRow(['BANK POSITION']).number
  wsPL.mergeCells(`A${bankHdrRn}:AD${bankHdrRn}`)
  styleCell(wsPL.getCell(`A${bankHdrRn}`), { bold:true, size:10, fill:C.lightBlue })

  const bankCodes = Object.keys(glAccounts).filter(c => isBank(c, glAccounts[c]?.name || tbAccounts[c]?.name || ''))
  const bankMonthlyClose: Record<string, number> = {}
  for (const m of MONTHS)
    bankMonthlyClose[m] = bankCodes.reduce((s,c) => s + (glAccounts[c]?.monthly_closing[m]||0), 0)
  const bankOpeningTotal = bankCodes.reduce((s,c) => s + (tbAccounts[c]?.balance||0), 0)

  // Opening bank row — Jul budget will be filled in after Cover is built
  const openData: any[] = [null, 'Opening Bank Balance', null, '__COVER_REF__']
  for (let i = 1; i < 12; i++) openData.push(null, null)
  openData.push(null, null, null, null)
  openBankRow = addPLRow(openData)
  stylePLRow_Leaf(openBankRow)
  wsPL.getCell(openBankRow, 2).font = fontSpec(false, 10)
  wsPL.getCell(openBankRow, 2).fill = solidFill(C.lightBlue)

  // Net cash row
  const ncData: any[] = [null, 'Net Cash Movement for Month', null, null]
  for (let i = 1; i < 12; i++) ncData.push(null, null)
  ncData.push(null, null, null, null)
  netCashRow = addPLRow(ncData)
  stylePLRow_Leaf(netCashRow)

  // Closing bank row
  const clData: any[] = [null, 'Closing Bank Balance']
  for (let i = 0; i < 12; i++) {
    clData.push(bankMonthlyClose[MONTHS[i]]||0)
    clData.push(null) // budget formula filled below
  }
  clData.push(null, null, null, null)
  closeBankRow = addPLRow(clData)
  stylePLRow_Subtotal(closeBankRow)

  // Now fill in opening/netcash/closing formulas
  for (let i = 0; i < 12; i++) {
    const aC = AC(i), bC = BC(i)
    if (i === 0) {
      // Jul actual opening: null (no prior)
      wsPL.getCell(openBankRow, colIdx(aC)).value = null
      // Jul actual net cash: closing - opening (but opening null, so 0)
      wsPL.getCell(netCashRow, colIdx(aC)).value = 0
    } else {
      const prevbC = BC(i-1), prevaC = AC(i-1)
      // Opening actual = prior closing actual
      wsPL.getCell(openBankRow, colIdx(aC)).value = { formula: `${prevaC}${closeBankRow}` }
      // Opening budget = prior closing budget
      wsPL.getCell(openBankRow, colIdx(bC)).value = { formula: `${prevbC}${closeBankRow}` }
      // Net cash actual
      wsPL.getCell(netCashRow, colIdx(aC)).value = { formula: `${aC}${closeBankRow}-${aC}${openBankRow}` }
    }
    // Net cash budget
    wsPL.getCell(netCashRow, colIdx(bC)).value = { formula: `${bC}${netOpCFRow}+${bC}${netFinCFRow}+${bC}${taxRow}` }
    // Closing budget
    wsPL.getCell(closeBankRow, colIdx(bC)).value = { formula: `${bC}${openBankRow}+${bC}${netCashRow}` }
  }

  addBlank()
  const itHdrRn = wsPL.addRow([`ESTIMATED INCOME TAX — Approximate Only (not included in cash flow above)`]).number
  wsPL.mergeCells(`A${itHdrRn}:AD${itHdrRn}`)
  styleCell(wsPL.getCell(`A${itHdrRn}`), { bold:true, size:10, fontColor:C.white, fill:C.navy })

  const itNoteRn = wsPL.addRow([`Based on 25% company tax rate applied to Budget Net Profit. This is a guide only — actual tax payable depends on taxable income, timing differences, prior year losses, franking offsets and ATO assessment. Consult your tax advisor.`]).number
  wsPL.mergeCells(`A${itNoteRn}:AD${itNoteRn}`)
  styleCell(wsPL.getCell(`A${itNoteRn}`), { size:8, fill:C.lightBlue })

  // Net Profit reference for tax calc
  const taxRefData: any[] = [null, 'Budget Net Profit / (Loss)']
  for (let i = 0; i < 12; i++) {
    taxRefData.push(null) // no actuals
    taxRefData.push({ formula: `${BC(i)}${netProfitRow}` })
  }
  taxRefData.push(null, { formula: `${ABC}${netProfitRow}` }, null, null)
  const taxRefRow = addPLRow(taxRefData)
  stylePLRow_Leaf(taxRefRow)

  // Tax rate row (editable yellow)
  const taxRateData: any[] = [null, 'Tax Rate (editable)']
  for (let i = 0; i < 12; i++) {
    taxRateData.push(null, null)
  }
  taxRateData.push(null, 0.25, null, null)
  const taxRateRow = addPLRow(taxRateData)
  const trRow = wsPL.getRow(taxRateRow)
  for (let c = 1; c <= TOTAL_COLS; c++) {
    const cell = trRow.getCell(c)
    if (c === 1) cell.font = fontSpec(false, 9)
    else if (c === 2) cell.font = fontSpec(false, 10)
    else cell.font = fontSpec(false, 10)
  }
  // AB column (FY Budget Total) = editable tax rate
  wsPL.getCell(taxRateRow, 28).fill = solidFill(C.yellow)
  wsPL.getCell(taxRateRow, 28).numFmt = '0.0%'
  wsPL.getCell(taxRateRow, 28).font = fontSpec(true, 10)
  wsPL.getCell(taxRateRow, 28).protection = { locked: false }

  // Estimated annual tax row
  const estTaxData: any[] = [null, 'Estimated Annual Tax Payable']
  for (let i = 0; i < 12; i++) {
    estTaxData.push(null, null)
  }
  // FY Budget Total = net profit × tax rate (only if profit > 0)
  estTaxData.push(null, { formula: `IF(${ABC}${taxRefRow}>0,${ABC}${taxRefRow}*${ABC}${taxRateRow},0)` }, null, null)
  const estTaxRow = addPLRow(estTaxData)
  stylePLRow_Subtotal(estTaxRow)

  // Quarterly estimate row
  const qtrData: any[] = [null, 'Approximate Quarterly PAYG Instalment']
  for (let i = 0; i < 12; i++) {
    qtrData.push(null, null)
  }
  qtrData.push(null, { formula: `${ABC}${estTaxRow}/4` }, null, null)
  const qtrRow = addPLRow(qtrData)
  stylePLRow_Leaf(qtrRow)

  // ─────────────────────────────────────────────────────────────────────────
  // COVER SHEET
  // ─────────────────────────────────────────────────────────────────────────
  const wsCov = wb.addWorksheet('Cover')
  wsCov.columns = [{ width: 5 }, { width: 40 }, { width: 25 }, { width: 20 }]

  const addCov = (data: any[]): number => wsCov.addRow(data).number

  const c1 = addCov([entityName])
  wsCov.mergeCells(`A${c1}:D${c1}`)
  styleCell(wsCov.getCell(`A${c1}`), { bold:true, size:16, fontColor:C.white, fill:C.navy, align:'center' })

  const c2 = addCov([`Budget ${bfy}  |  Actuals ${fy}  |  Generated ${today}`])
  wsCov.mergeCells(`A${c2}:D${c2}`)
  styleCell(wsCov.getCell(`A${c2}`), { size:11, fontColor:C.white, fill:C.blue, align:'center' })

  addCov([])

  const cHowTo = addCov(['HOW TO USE THIS WORKBOOK'])
  wsCov.mergeCells(`A${cHowTo}:D${cHowTo}`)
  styleCell(wsCov.getCell(`A${cHowTo}`), { bold:true, size:10, fontColor:C.white, fill:C.navy })

  const howToSteps = [
    ['Confirm opening bank balance', 'Scroll down to the OPENING BANK BALANCE section on this Cover sheet. Verify the pre-filled total is correct. Edit D{n} if needed.'],
    ['Review the Assumptions sheet', 'Go to the Assumptions sheet. Every P&L account has a method (percentage/fixed/manual) and value. Adjust as needed.'],
    ['Understand the Methods', '"percentage" — enter a percentage to increase or decrease prior year  |  "fixed" — enter a total for the year  |  "manual" — same amount each month'],
    ['Enter financing cash flows', 'Go to the P&L and Cash Flow sheet and scroll down to FINANCING & INVESTING. Enter loan repayments, drawdowns, capex and tax payments.'],
    ['Review the cash flow', 'The closing bank balance for each month is calculated automatically. Check the BANK POSITION section.'],
    ['Save scenarios', 'Use File → Save As to create copies for different scenarios. Do not overwrite this base file.'],
    ['Colour guide', 'YELLOW cells = editable inputs  |  GRAY cells = actuals from GL  |  GREEN rows = non-cash items'],
    ['Reconciliation', 'The Reconciliation sheet compares GL annual totals to TB balances. All accounts should show PASS.'],
  ]
  for (const [title, text] of howToSteps) {
    const rt = addCov([null, title])
    wsCov.mergeCells(`B${rt}:D${rt}`)
    wsCov.getCell(`B${rt}`).font = fontSpec(true, 10)

    const rp = addCov([null, text])
    wsCov.mergeCells(`B${rp}:D${rp}`)
    wsCov.getCell(`B${rp}`).font = fontSpec(false, 9)
  }

  // Reconciliation status
  addCov([])
  const reconColor = recon.passed ? C.greenPass : C.redFail
  const reconText = recon.passed
    ? `✓ RECONCILIATION PASSED — ${recon.info.filter(r=>r.status==='PASS').length} accounts verified`
    : `✗ RECONCILIATION FAILED — ${recon.failures.length} account(s) failed. See Reconciliation sheet.`
  const cRecon = addCov([reconText])
  wsCov.mergeCells(`A${cRecon}:D${cRecon}`)
  styleCell(wsCov.getCell(`A${cRecon}`), { bold:true, size:10, fill:reconColor })

  // Non-cash section
  if (nonCashAccounts.length > 0) {
    addCov([])
    const cNcHdr = addCov([`NON-CASH ITEMS DETECTED — These are added back in the cash flow`])
    wsCov.mergeCells(`A${cNcHdr}:D${cNcHdr}`)
    styleCell(wsCov.getCell(`A${cNcHdr}`), { bold:true, size:10, fill:C.green })
    for (const a of nonCashAccounts) {
      const rn = addCov([null, `  ${a.code}  ${a.name}`, a.notes || 'Flagged non-cash', a.prior_annual])
      wsCov.getCell(rn, 2).font = fontSpec(false, 9)
      wsCov.getCell(rn, 3).font = fontSpec(false, 9)
      wsCov.getCell(rn, 4).font = fontSpec(false, 10)
      wsCov.getCell(rn, 4).fill = solidFill(C.gray)
      wsCov.getCell(rn, 4).numFmt = numFmt
    }
  }

  // Unclassified accounts (journal-only, not clearly non-cash)
  const unclassified = Object.values(assumptions).filter(a => {
    const gl = glAccounts[a.code]
    return gl && Object.values(gl.monthly_net).every(v => v===0) && gl.annual_net !== 0 && !a.nonCash
  })
  if (unclassified.length > 0) {
    addCov([])
    const cUcHdr = addCov([`⚠  UNCLASSIFIED ACCOUNTS — These journal-only accounts may need Non-Cash? flag review`])
    wsCov.mergeCells(`A${cUcHdr}:D${cUcHdr}`)
    styleCell(wsCov.getCell(`A${cUcHdr}`), { bold:true, size:10, fill:C.warnYellow })
    for (const a of unclassified) {
      const rn = addCov([null, `  ${a.code}  ${a.name}`, 'Check Non-Cash? column in Assumptions', a.prior_annual])
      wsCov.getCell(rn, 2).font = fontSpec(false, 9)
      wsCov.getCell(rn, 3).font = fontSpec(false, 9)
      wsCov.getCell(rn, 4).font = fontSpec(false, 10)
      wsCov.getCell(rn, 4).numFmt = numFmt
    }
  }

  // Opening bank balance section
  addCov([])
  const cBankHdr = addCov(['OPENING BANK BALANCE — 1 JULY CONFIRMATION'])
  wsCov.mergeCells(`A${cBankHdr}:D${cBankHdr}`)
  styleCell(wsCov.getCell(`A${cBankHdr}`), { bold:true, size:10, fontColor:C.white, fill:C.navy })

  const cBankNote = addCov(['The bank account balances below are taken from the Trial Balance. Verify and confirm the total. This flows to the Cash Flow sheet.'])
  wsCov.mergeCells(`A${cBankNote}:D${cBankNote}`)
  styleCell(wsCov.getCell(`A${cBankNote}`), { size:9, fill:C.lightBlue })

  for (const code of bankCodes) {
    const name = glAccounts[code]?.name || tbAccounts[code]?.name || code
    const rn = addCov([null, `  ${code}  ${name}`, 'From TB', tbAccounts[code]?.balance||0])
    wsCov.getCell(rn, 2).font = fontSpec(false, 9)
    wsCov.getCell(rn, 3).font = fontSpec(false, 9)
    wsCov.getCell(rn, 4).font = fontSpec(false, 10)
    wsCov.getCell(rn, 4).fill = solidFill(C.gray)
    wsCov.getCell(rn, 4).numFmt = numFmt
  }

  // Confirmed opening bank — THIS is the row P&L references
  const openingBalanceCoverRow = wsCov.rowCount + 1
  const cConfirm = addCov([null, 'CONFIRMED OPENING BANK BALANCE:', '← Edit this cell if incorrect', bankOpeningTotal])
  wsCov.getCell(cConfirm, 2).font = fontSpec(true, 10)
  wsCov.getCell(cConfirm, 3).font = fontSpec(false, 9)
  wsCov.getCell(cConfirm, 4).font = fontSpec(true, 11)
  wsCov.getCell(cConfirm, 4).fill = solidFill(C.brightYellow)
  wsCov.getCell(cConfirm, 4).numFmt = numFmt
  wsCov.getCell(cConfirm, 4).protection = { locked: false }

  // Password note
  addCov([])
  const cPwNote = addCov(['🔒  This Cover sheet may be password protected. To unprotect: Review → Unprotect Sheet (no password required).'])
  wsCov.mergeCells(`A${cPwNote}:D${cPwNote}`)
  styleCell(wsCov.getCell(`A${cPwNote}`), { size:9, fill:C.lightBlue })

  // Generation log
  addCov([])
  const cLogHdr = addCov(['GENERATION LOG'])
  wsCov.mergeCells(`A${cLogHdr}:D${cLogHdr}`)
  styleCell(wsCov.getCell(`A${cLogHdr}`), { bold:true, size:10, fill:C.lightBlue })

  const logRows: [string, string][] = [
    ['Generated:', today],
    ['Entity:', entityName],
    ['Actuals year:', `${fy}  (${glParsed.glPeriod})`],
    ['Budget year:', bfy],
    ['TB file period:', tbParsed.tbPeriod],
    ['Reconciliation:', recon.passed ? 'PASSED' : `FAILED — ${recon.failures.length} failures`],
    ['Accounts in TB:', String(Object.keys(tbAccounts).length)],
    ['Accounts in GL:', String(Object.keys(glAccounts).length)],
    ['Non-cash P&L accounts:', String(nonCashAccounts.length)],
    ['Unclassified accounts:', String(unclassified.length)],
    ['Opening bank (TB-derived):', `$${fmtComma(bankOpeningTotal)}`],
    ['Sign convention:', 'MYOB — income credit (negative GL), flipped for display'],
    ['GST treatment:', 'Assumed on monthly BAS — excluded from model'],
    ['Debtors/Creditors:', 'Assumed unchanged — movements set to zero'],
  ]
  for (const [label, value] of logRows) {
    const rn = addCov([null, label, value])
    wsCov.getCell(rn, 2).font = fontSpec(true, 9)
    wsCov.getCell(rn, 3).font = fontSpec(false, 9)
  }

  // Now fix P&L Opening Bank Jul budget reference to Cover
  wsPL.getCell(openBankRow!, colIdx(BC(0))).value = { formula: `Cover!D${openingBalanceCoverRow}` }

  // ─────────────────────────────────────────────────────────────────────────
  // RECONCILIATION SHEET
  // ─────────────────────────────────────────────────────────────────────────
  const wsR = wb.addWorksheet('Reconciliation')
  wsR.columns = [{ width:9 },{ width:40 },{ width:16 },{ width:16 },{ width:14 },{ width:10 }]

  const r1r = wsR.addRow([`Reconciliation — ${entityName}`]).number
  wsR.mergeCells(`A${r1r}:F${r1r}`)
  styleCell(wsR.getCell(`A${r1r}`), { bold:true, size:13, fontColor:C.white, fill:C.navy })

  const statusLine = `GL Period: ${glParsed.glPeriod}  |  TB Period: ${tbParsed.tbPeriod}  |  Tolerance: $${TOLERANCE.toFixed(2)}  |  Status: ${recon.passed ? '✓ PASSED' : '✗ FAILED'}`
  const r2r = wsR.addRow([statusLine]).number
  wsR.mergeCells(`A${r2r}:F${r2r}`)
  styleCell(wsR.getCell(`A${r2r}`), { bold:true, size:10, fill: recon.passed ? C.greenPass : C.redFail })

  if (!recon.passed) {
    for (const f of recon.failures) {
      const rn = wsR.addRow([`FAIL: ${f.code} (${f.name}) — TB $${fmt$(f.tb)}, GL $${fmt$(f.gl)}, Diff $${fmt$(f.diff)}`]).number
      wsR.mergeCells(`A${rn}:F${rn}`)
      styleCell(wsR.getCell(`A${rn}`), { bold:true, size:10, fill:C.redFail })
    }
  }

  // Header row
  const rHdr = wsR.addRow(['Code','Account Name','TB Balance','GL Annual Total','Difference','Status']).number
  for (let c = 1; c <= 6; c++) {
    wsR.getCell(rHdr, c).fill = solidFill(C.blue)
    wsR.getCell(rHdr, c).font = fontSpec(true, 10, C.white)
  }

  // Data rows
  for (const row of [...recon.failures, ...recon.info]) {
    const rn = wsR.addRow([row.code, row.name, row.tb, row.gl, row.diff, row.status]).number
    const isPass = row.status === 'PASS'
    const isFail = row.status === 'FAIL'
    const rowFill = isPass ? C.greenPass : isFail ? C.redFail : null

    for (let c = 1; c <= 6; c++) {
      const cell = wsR.getCell(rn, c)
      if (rowFill) cell.fill = solidFill(rowFill)
      if (c === 1) { cell.font = fontSpec(false, 9) }
      else if (c === 2) { cell.font = fontSpec(false, 10) }
      else if (c <= 4) { cell.font = fontSpec(false, 10); cell.numFmt = numFmt }
      else if (c === 5) { cell.font = fontSpec(false, 10); cell.numFmt = numFmt2 }
      else {
        cell.font = fontSpec(isPass || isFail, 10)
        cell.alignment = alignSpec('center')
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REORDER SHEETS
  // ─────────────────────────────────────────────────────────────────────────
  // Desired: Cover, Assumptions, P&L and Cash Flow, Reconciliation, GL Data
  const desiredOrder = ['Cover', 'Assumptions', 'P&L and Cash Flow', 'Reconciliation', 'GL Data']
  // ExcelJS maintains order of addWorksheet calls. We created:
  // GL Data, Assumptions, P&L, Cover, Reconciliation
  // Need to reorder. ExcelJS worksheet orderNo can be set via _worksheets array
  const ws_map: Record<string, any> = {
    'GL Data': wsGL,
    'Assumptions': wsA,
    'P&L and Cash Flow': wsPL,
    'Cover': wsCov,
    'Reconciliation': wsR,
  }
  // Remove and re-add in desired order
  ;(wb as any)._worksheets = [undefined] // reset (index 0 unused)
  for (const name of desiredOrder) {
    const ws = ws_map[name]
    ws.orderNo = (wb as any)._worksheets.length
    ;(wb as any)._worksheets.push(ws)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHEET PROTECTION — only yellow (unlocked) cells are editable
  // ─────────────────────────────────────────────────────────────────────────
  // No password so users can unprotect via Review → Unprotect Sheet if needed
  const protectOpts = { selectLockedCells: true, selectUnlockedCells: true }
  await wsCov.protect('', protectOpts)
  await wsA.protect('', protectOpts)
  await wsPL.protect('', protectOpts)
  await wsR.protect('', protectOpts)
  await wsGL.protect('', protectOpts)

  // ─────────────────────────────────────────────────────────────────────────
  // WRITE BUFFER
  // ─────────────────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

// ─── REACT UI ─────────────────────────────────────────────────────────────────
export default function BudgetBuilder() {
  const [stage, setStage] = useState<'upload'|'review'|'assumptions'|'done'>('upload')
  const [tbFile, setTbFile] = useState<File|null>(null)
  const [glFile, setGlFile] = useState<File|null>(null)
  const [tbName, setTbName] = useState('')
  const [glName, setGlName] = useState('')
  const [parsed, setParsed] = useState<{ tb: TBParsed; gl: GLParsed; recon: Recon }|null>(null)
  const [assumptions, setAssumptions] = useState<Record<string, Assumption>|null>(null)
  const [budget, setBudget] = useState<Record<string, { monthly: Record<string,number>; annual: number }>|null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const tbRef = useRef<HTMLInputElement>(null)
  const glRef = useRef<HTMLInputElement>(null)

  const readWB = (file: File): Promise<XLSX.WorkBook> => new Promise((res,rej) => {
    const r = new FileReader()
    r.onload = e => { try { res(XLSX.read(e.target!.result as ArrayBuffer, {type:'array'})) } catch(err){rej(err)} }
    r.onerror = () => rej(new Error('Read failed'))
    r.readAsArrayBuffer(file)
  })

  const processFiles = useCallback(async (tf: File, gf: File) => {
    if (!tf || !gf) return
    setLoading(true); setError('')
    try {
      const [tbWB, glWB] = await Promise.all([readWB(tf), readWB(gf)])
      const tbParsed = parseTB(tbWB)
      const glParsed = parseGL(glWB)
      const recon = reconcile(tbParsed, glParsed)
      const assum = buildAssumptions(tbParsed, glParsed)
      const bgt = computeBudget(assum)
      setParsed({ tb: tbParsed, gl: glParsed, recon })
      setAssumptions(assum)
      setBudget(bgt)
      setStage('review')
    } catch(e: any) {
      setError(`Parse error: ${e.message}`)
    } finally { setLoading(false) }
  }, [])

  const onTbChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setTbFile(f); setTbName(f.name)
    if (glFile) processFiles(f, glFile)
  }, [glFile, processFiles])

  const onGlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setGlFile(f); setGlName(f.name)
    if (tbFile) processFiles(tbFile, f)
  }, [tbFile, processFiles])

  const handleDrop = (
    setFn: (f: File) => void,
    setName: (n: string) => void,
    otherFile: File|null,
    isTb: boolean
  ) => (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    setFn(f); setName(f.name)
    if (isTb && glFile) processFiles(f, glFile)
    else if (!isTb && tbFile) processFiles(tbFile, f)
  }

  const updateAssumption = (code: string, field: keyof Assumption, val: any) => {
    setAssumptions(prev => {
      if (!prev) return prev
      const next = { ...prev, [code]: { ...prev[code], [field]: val } }
      setBudget(computeBudget(next))
      return next
    })
  }

  const downloadExcel = async () => {
    if (!parsed || !assumptions || !budget) return
    setLoading(true)
    try {
      const buffer = await generateExcel(parsed.tb, parsed.gl, assumptions, budget)
      const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStamp = new Date().toISOString().slice(0,10).replace(/-/g,'')
      a.download = `${(parsed.tb.entityName||'Budget').replace(/\s+/g,'_')}_Budget_${parsed.tb.budgetYear}_${dateStamp}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setStage('done')
    } catch(e: any) {
      setError(`Export error: ${e.message}`)
    } finally { setLoading(false) }
  }

  const filteredAssumptions = assumptions ? Object.values(assumptions).filter(a => {
    if (filter === 'income' && !['income','other_income'].includes(a.atype)) return false
    if (filter === 'expense' && !['cogs','expense','other_expense'].includes(a.atype)) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.code.includes(search)) return false
    return true
  }) : []

  // ── Styles ──────────────────────────────────────────────────────────────
  const dark = '#0f1117', border = '1px solid #1e2535'
  const s: Record<string, any> = {
    app:    { minHeight:'100vh', background:dark, color:'#e2e8f0', fontFamily:'"IBM Plex Sans",system-ui,sans-serif', fontSize:14 },
    header: { borderBottom:border, padding:'16px 24px', display:'flex', alignItems:'center', gap:12 },
    logo:   { width:32, height:32, background:'linear-gradient(135deg,#3b82f6,#06b6d4)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#fff', fontSize:13 },
    main:   { maxWidth:1160, margin:'0 auto', padding:24 },
    card:   { background:'#141923', border, borderRadius:12, padding:24, marginBottom:16 },
    steps:  { display:'flex', gap:8, marginBottom:28 },
    step:   (a: boolean, d: boolean) => ({ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, fontSize:12, fontWeight:500, background:a?'#1e3a5f':d?'#0f2a1e':'#1a1f2e', color:a?'#60a5fa':d?'#34d399':'#475569', border:`1px solid ${a?'#3b82f6':d?'#10b981':'#1e2535'}` }),
    dz:     (ok: boolean) => ({ border:`2px dashed ${ok?'#3b82f6':'#1e3a5f'}`, borderRadius:10, padding:32, textAlign:'center' as const, cursor:'pointer', background:ok?'#0d1f3c':dark }),
    btn:    (v: string) => ({ padding:'8px 20px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit', background:v==='primary'?'#2563eb':v==='success'?'#059669':'#1e2535', color:v==='ghost'?'#94a3b8':'#fff' }),
    lbl:    { fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:6, display:'block' },
    inp:    { background:dark, border, borderRadius:6, color:'#e2e8f0', padding:'4px 8px', fontFamily:'"IBM Plex Mono",monospace', fontSize:13, width:'100%', outline:'none' },
    sel:    { background:dark, border, borderRadius:6, color:'#e2e8f0', padding:'4px 8px', fontSize:13, fontFamily:'inherit', outline:'none' },
    th:     { padding:'8px 10px', borderBottom:border, textAlign:'left' as const, color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase' as const, letterSpacing:'0.05em' },
    td:     { padding:'7px 10px', borderBottom:'1px solid #111827', verticalAlign:'middle' as const },
    mono:   { fontFamily:'"IBM Plex Mono",monospace' },
    tag:    (t: string) => ({ fontSize:11, padding:'2px 7px', borderRadius:10, fontWeight:600, background:['income','other_income'].includes(t)?'#0c2a1a':['cogs','expense','other_expense'].includes(t)?'#2a150c':'#1a1a2e', color:['income','other_income'].includes(t)?'#6ee7b7':['cogs','expense','other_expense'].includes(t)?'#fca5a5':'#a5b4fc' }),
    err:    { background:'#2a0f1e', border:'1px solid #ef4444', borderRadius:8, padding:'10px 14px', color:'#fca5a5', fontSize:13, marginBottom:12 },
    sbox:   { background:dark, border, borderRadius:10, padding:16 },
    snum:   { fontSize:26, fontWeight:700, letterSpacing:'-1px', fontFamily:'"IBM Plex Mono",monospace' },
    grid2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 },
    grid4:  { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 },
  }

  const stages = ['upload','review','assumptions','done'] as const
  const StepBar = () => {
    const cur = stages.indexOf(stage)
    return (
      <div style={s.steps}>
        {([['upload','1','Upload'],['review','2','Review'],['assumptions','3','Assumptions'],['done','4','Download']] as [typeof stage, string, string][]).map(([id,n,label]) => {
          const me = stages.indexOf(id)
          return <div key={id} style={s.step(stage===id, cur>me)}>
            <span style={{width:18,height:18,borderRadius:'50%',background:stage===id?'#3b82f6':cur>me?'#10b981':'#334155',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>{cur>me?'✓':n}</span>
            {label}
          </div>
        })}
      </div>
    )
  }

  // ── UPLOAD ──────────────────────────────────────────────────────────────
  if (stage === 'upload') return (
    <div style={s.app}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={s.header}>
        <div style={s.logo}>BB</div>
        <div><div style={{fontWeight:600,fontSize:16}}>MYOB Budget Builder</div><div style={{color:'#64748b',fontSize:12}}>Browser-based · No server required · MYOB AccountRight exports</div></div>
      </div>
      <div style={s.main}>
        <StepBar />
        {error && <div style={s.err}>⚠ {error}</div>}
        <div style={s.card}>
          <h2 style={{margin:'0 0 4px',fontSize:18}}>Upload MYOB Exports</h2>
          <p style={{margin:'0 0 20px',color:'#64748b',fontSize:13}}>Export the Trial Balance and Transaction Dump from MYOB AccountRight, then drop them below.</p>
          <div style={s.grid2}>
            {([
              {label:'Trial Balance (TB)', name:tbName, ref:tbRef, onChange:onTbChange, isTb:true, hint:'Reports → Balance Sheet → Detail → Export to Excel'},
              {label:'Transaction Dump / GL', name:glName, ref:glRef, onChange:onGlChange, isTb:false, hint:'Reports → Transaction Journals → All Journals → Export to Excel'}
            ] as any[]).map(({label,name,ref,onChange,isTb,hint}) => (
              <div key={label}>
                <span style={s.lbl}>{label}</span>
                <div style={s.dz(!!name)}
                  onDragOver={(e:any)=>e.preventDefault()}
                  onDrop={handleDrop(isTb?setTbFile:setGlFile, isTb?setTbName:setGlName, isTb?glFile:tbFile, isTb)}
                  onClick={()=>ref.current?.click()}>
                  <input ref={ref} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={onChange}/>
                  {name
                    ? <><div style={{fontSize:28,marginBottom:8}}>📊</div><div style={{fontWeight:600}}>{name}</div><div style={{color:'#64748b',fontSize:12,marginTop:4}}>Click to replace</div></>
                    : <><div style={{fontSize:36,marginBottom:8}}>📥</div><div style={{fontWeight:500}}>Drop file here</div><div style={{color:'#64748b',fontSize:12,marginTop:4}}>or click to browse · .xlsx</div></>
                  }
                </div>
                <div style={{marginTop:8,fontSize:12,color:'#64748b'}}>{hint}</div>
              </div>
            ))}
          </div>
          {tbName && glName && (
            <div style={{marginTop:20,textAlign:'center'}}>
              <button style={s.btn('primary')} onClick={()=>processFiles(tbFile!,glFile!)} disabled={loading}>
                {loading ? 'Processing…' : '→ Parse & Continue'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── REVIEW ──────────────────────────────────────────────────────────────
  if (stage === 'review' && parsed) {
    const { tb, gl, recon } = parsed
    const incTotal = Object.values(assumptions!).filter(a=>['income','other_income'].includes(a.atype)).reduce((s,a)=>s+a.prior_annual,0)
    const expTotal = Object.values(assumptions!).filter(a=>['cogs','expense','other_expense'].includes(a.atype)).reduce((s,a)=>s+a.prior_annual,0)
    return (
      <div style={s.app}>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <div style={s.header}>
          <div style={s.logo}>BB</div>
          <div style={{flex:1}}><div style={{fontWeight:600,fontSize:16}}>MYOB Budget Builder</div><div style={{color:'#64748b',fontSize:12}}>{tb.entityName}</div></div>
        </div>
        <div style={s.main}>
          <StepBar />
          {error && <div style={s.err}>⚠ {error}</div>}
          <div style={s.card}>
            <h2 style={{margin:'0 0 16px',fontSize:18}}>Parse Results</h2>
            <div style={{...s.grid4, marginBottom:20}}>
              <div style={s.sbox}><div style={{...s.snum,color:'#60a5fa',fontSize:18}}>{tb.entityName}</div><div style={{fontSize:11,color:'#64748b',marginTop:2}}>Entity</div></div>
              <div style={s.sbox}><div style={{...s.snum,color:'#a78bfa'}}>FY{tb.fyYear}</div><div style={{fontSize:11,color:'#64748b',marginTop:2}}>Actuals Year</div></div>
              <div style={s.sbox}><div style={{...s.snum,color:'#34d399'}}>{Object.keys(assumptions!).length}</div><div style={{fontSize:11,color:'#64748b',marginTop:2}}>P&L Accounts</div></div>
              <div style={s.sbox}><div style={{...s.snum,color:recon.passed?'#34d399':'#f87171'}}>{recon.passed?'PASS':'FAIL'}</div><div style={{fontSize:11,color:'#64748b',marginTop:2}}>Reconciliation</div></div>
            </div>
            <div style={{...s.grid2, marginBottom:16}}>
              <div><span style={s.lbl}>FY{tb.fyYear} Income</span><div style={{...s.mono,color:'#34d399',fontSize:18,fontWeight:700}}>${fmtComma(incTotal)}</div></div>
              <div><span style={s.lbl}>FY{tb.fyYear} Expenses</span><div style={{...s.mono,color:'#fca5a5',fontSize:18,fontWeight:700}}>${fmtComma(expTotal)}</div></div>
              <div><span style={s.lbl}>TB Period</span><div style={{...s.mono,color:'#a5b4fc'}}>{tb.tbPeriod}</div></div>
              <div><span style={s.lbl}>GL Period</span><div style={{...s.mono,color:'#a5b4fc'}}>{gl.glPeriod}</div></div>
            </div>
            {!recon.passed && (
              <div style={{marginTop:16}}>
                <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:12,fontSize:12,fontWeight:600,background:'#2a0f1e',color:'#f87171',border:'1px solid #ef4444',marginBottom:12}}>
                  ✗ {recon.failures.length} reconciliation failure{recon.failures.length>1?'s':''}
                </div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead><tr>
                    <th style={s.th}>Code</th><th style={s.th}>Account</th>
                    <th style={{...s.th,textAlign:'right'}}>TB</th>
                    <th style={{...s.th,textAlign:'right'}}>GL</th>
                    <th style={{...s.th,textAlign:'right'}}>Difference</th>
                  </tr></thead>
                  <tbody>{recon.failures.map(f => (
                    <tr key={f.code}>
                      <td style={{...s.td,...s.mono}}>{f.code}</td>
                      <td style={s.td}>{f.name}</td>
                      <td style={{...s.td,...s.mono,textAlign:'right'}}>${fmtComma(f.tb)}</td>
                      <td style={{...s.td,...s.mono,textAlign:'right'}}>${fmtComma(f.gl)}</td>
                      <td style={{...s.td,...s.mono,textAlign:'right',color:'#f87171'}}>${fmtComma(f.diff)}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <p style={{color:'#94a3b8',fontSize:12,marginTop:8}}>You can still continue — budget figures will use GL data. Review the Reconciliation sheet for details.</p>
              </div>
            )}
            {recon.passed && <div style={{fontSize:13,color:'#34d399'}}>✓ All P&L accounts reconcile within ${TOLERANCE}</div>}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button style={s.btn('ghost')} onClick={()=>setStage('upload')}>← Back</button>
            <button style={s.btn('primary')} onClick={()=>setStage('assumptions')}>Edit Assumptions →</button>
            <button style={{...s.btn('success'),marginLeft:'auto'}} onClick={downloadExcel} disabled={loading}>{loading?'Generating…':'↓ Skip to Download'}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── ASSUMPTIONS ─────────────────────────────────────────────────────────
  if (stage === 'assumptions' && assumptions && parsed) {
    const { tb } = parsed
    const totalBudgetInc = Object.values(assumptions).filter(a=>['income','other_income'].includes(a.atype)).reduce((s,a)=>s+(budget![a.code]?.annual||0),0)
    const totalBudgetExp = Object.values(assumptions).filter(a=>['cogs','expense','other_expense'].includes(a.atype)).reduce((s,a)=>s+(budget![a.code]?.annual||0),0)

    return (
      <div style={s.app}>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <div style={s.header}>
          <div style={s.logo}>BB</div>
          <div style={{flex:1}}><div style={{fontWeight:600,fontSize:16}}>MYOB Budget Builder</div><div style={{color:'#64748b',fontSize:12}}>{tb.entityName} · FY{tb.budgetYear} Assumptions</div></div>
          <div style={{textAlign:'right'}}>
            <div style={{color:'#34d399',...s.mono,fontWeight:700}}>Income: ${fmtComma(totalBudgetInc)}</div>
            <div style={{color:'#fca5a5',...s.mono,fontWeight:700}}>Expenses: ${fmtComma(totalBudgetExp)}</div>
          </div>
        </div>
        <div style={{...s.main,maxWidth:1280}}>
          <StepBar />
          {error && <div style={s.err}>⚠ {error}</div>}
          <div style={s.card}>
            <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
              <h2 style={{margin:0,fontSize:16,flex:1}}>Budget Assumptions — FY{tb.budgetYear}</h2>
              <input style={{...s.inp,width:200}} placeholder="Search accounts…" value={search} onChange={e=>setSearch(e.target.value)}/>
              <select style={s.sel} value={filter} onChange={e=>setFilter(e.target.value)}>
                <option value="all">All accounts</option>
                <option value="income">Income only</option>
                <option value="expense">Expense / COGS only</option>
              </select>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr>
                  <th style={s.th}>Code</th>
                  <th style={s.th}>Account</th>
                  <th style={s.th}>Type</th>
                  <th style={s.th}>Non-Cash</th>
                  <th style={s.th}>Method</th>
                  <th style={s.th}>Value</th>
                  <th style={{...s.th,textAlign:'right'}}>FY{tb.fyYear} Actual</th>
                  <th style={{...s.th,textAlign:'right'}}>FY{tb.budgetYear} Budget</th>
                  <th style={{...s.th,textAlign:'right'}}>Var %</th>
                  <th style={s.th}>Notes</th>
                </tr></thead>
                <tbody>
                  {filteredAssumptions.map(a => {
                    const bgt = budget![a.code]
                    const ba = bgt?.annual||0
                    const vp = a.prior_annual !== 0 ? ((ba-a.prior_annual)/Math.abs(a.prior_annual))*100 : null
                    return (
                      <tr key={a.code} style={{background:a.nonCash?'#0f1a2e':'transparent'}}>
                        <td style={{...s.td,...s.mono,color:'#a5b4fc',fontSize:12}}>{a.code}</td>
                        <td style={{...s.td,maxWidth:220}}>{a.name}</td>
                        <td style={s.td}><span style={s.tag(a.atype)}>{a.atype}</span></td>
                        <td style={s.td}>
                          <select style={s.sel} value={a.nonCash?'Yes':'No'} onChange={e=>updateAssumption(a.code,'nonCash',e.target.value==='Yes')}>
                            <option>Yes</option><option>No</option>
                          </select>
                        </td>
                        <td style={s.td}>
                          <select style={s.sel} value={a.method} onChange={e=>updateAssumption(a.code,'method',e.target.value)}>
                            {METHODS.map(m=><option key={m}>{m}</option>)}
                          </select>
                        </td>
                        <td style={{...s.td,width:90}}>
                          <input style={s.inp} type="number" step="any" value={a.value}
                            onChange={e=>updateAssumption(a.code,'value',parseFloat(e.target.value)||0)}/>
                        </td>
                        <td style={{...s.td,...s.mono,textAlign:'right',color:'#94a3b8'}}>{a.prior_annual?`$${fmtComma(a.prior_annual)}`:'—'}</td>
                        <td style={{...s.td,...s.mono,textAlign:'right',color:ba>=a.prior_annual?'#34d399':'#fca5a5'}}>{ba?`$${fmtComma(ba)}`:'—'}</td>
                        <td style={{...s.td,...s.mono,textAlign:'right',fontSize:12,color:vp==null?'#475569':vp>=0?'#34d399':'#fca5a5'}}>{vp!=null?`${vp>=0?'+':''}${vp.toFixed(1)}%`:'—'}</td>
                        <td style={{...s.td,minWidth:160}}>
                          <input style={s.inp} placeholder="Optional…" value={a.notes||''}
                            onChange={e=>updateAssumption(a.code,'notes',e.target.value)}/>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filteredAssumptions.length===0 && <div style={{textAlign:'center',padding:32,color:'#475569'}}>No accounts match filter</div>}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button style={s.btn('ghost')} onClick={()=>setStage('review')}>← Back</button>
            <button style={{...s.btn('success'),marginLeft:'auto'}} onClick={downloadExcel} disabled={loading}>
              {loading ? 'Generating…' : '↓ Generate & Download Excel'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── DONE ────────────────────────────────────────────────────────────────
  if (stage === 'done' && parsed) {
    const { tb } = parsed
    return (
      <div style={s.app}>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <div style={s.header}>
          <div style={s.logo}>BB</div>
          <div><div style={{fontWeight:600,fontSize:16}}>MYOB Budget Builder</div><div style={{color:'#64748b',fontSize:12}}>{tb.entityName}</div></div>
        </div>
        <div style={s.main}>
          <StepBar />
          <div style={{...s.card,textAlign:'center',padding:48}}>
            <div style={{fontSize:64,marginBottom:16}}>✅</div>
            <h2 style={{fontSize:22,margin:'0 0 8px'}}>Budget Generated</h2>
            <p style={{color:'#64748b',margin:'0 0 24px'}}>{tb.entityName} · FY{tb.budgetYear} · {Object.keys(assumptions!).length} accounts</p>
            <p style={{color:'#94a3b8',fontSize:13,marginBottom:24}}>
              Your download should have started. The workbook contains 5 sheets:<br/>
              <strong style={{color:'#e2e8f0'}}>Cover · P&L and Cash Flow · Assumptions · Reconciliation · GL Data</strong>
            </p>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              <button style={s.btn('success')} onClick={downloadExcel} disabled={loading}>{loading?'Generating…':'↓ Download Again'}</button>
              <button style={s.btn('primary')} onClick={()=>setStage('assumptions')}>← Edit Assumptions</button>
              <button style={s.btn('ghost')} onClick={()=>{setStage('upload');setTbFile(null);setGlFile(null);setTbName('');setGlName('');setParsed(null);setAssumptions(null);setBudget(null)}}>
                Start New
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <div style={s.app}><div style={{padding:40,textAlign:'center',color:'#64748b'}}>Loading…</div></div>
}
