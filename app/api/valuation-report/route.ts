/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageBreak, LevelFormat, Footer, PageNumber
} from 'docx'

const NAVY = '1F4E79'
const BLUE = '2E75B6'
const LIGHT = 'F0F4F8'
const GREEN_BG = 'E8F5E9'
const RED_BG = 'FFEBEE'

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const borders = { top: border, bottom: border, left: border, right: border }
const cellPad = { top: 60, bottom: 60, left: 100, right: 100 }
const TW = 9360 // Table width for A4 with 1" margins

function fmt(n: number): string {
  if (n === 0) return '-'
  const abs = Math.abs(n)
  const s = abs >= 1000 ? '$' + abs.toLocaleString('en-AU', { maximumFractionDigits: 0 }) : '$' + abs.toFixed(0)
  return n < 0 ? `(${s})` : s
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%'
}

function headerRow(cells: string[], widths: number[]): TableRow {
  return new TableRow({
    children: cells.map((text, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      borders,
      margins: cellPad,
      shading: { fill: NAVY, type: ShadingType.CLEAR },
      children: [new Paragraph({ alignment: i > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text, bold: true, color: 'FFFFFF', font: 'Arial', size: 18 })] })]
    }))
  })
}

function dataRow(cells: { text: string; bold?: boolean; color?: string; bg?: string }[], widths: number[]): TableRow {
  return new TableRow({
    children: cells.map((cell, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      borders,
      margins: cellPad,
      shading: cell.bg ? { fill: cell.bg, type: ShadingType.CLEAR } : undefined,
      children: [new Paragraph({ alignment: i > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: cell.text, bold: cell.bold, color: cell.color || '333333', font: 'Arial', size: 18 })] })]
    }))
  })
}

function heading(text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2): Paragraph {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, font: 'Arial' })] })
}

function para(text: string, opts?: { bold?: boolean; size?: number; color?: string; spacing?: number }): Paragraph {
  return new Paragraph({ spacing: { after: opts?.spacing ?? 120 }, children: [new TextRun({ text, font: 'Arial', size: opts?.size ?? 20, bold: opts?.bold, color: opts?.color })] })
}

function spacer(): Paragraph {
  return new Paragraph({ spacing: { after: 200 }, children: [] })
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const { engagement, years, ebitdaByYear, normItems, normalisedEbitdaByYear, weights, fme,
      riskFactors, compositeScoreLow, compositeScoreHigh, multipleLow, multipleHigh,
      valuation, bsItems, sensitivity, industryAnalysis, discounts, aiWeightReasoning } = data

    const children: any[] = []

    // ─── COVER PAGE ────────────────────────────────────────────────────────
    children.push(new Paragraph({ spacing: { before: 3000 }, children: [] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'BUSINESS VALUATION REPORT', font: 'Arial', size: 36, bold: true, color: NAVY })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Capitalisation of Future Maintainable Earnings', font: 'Arial', size: 24, color: BLUE })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE } }, children: [] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 100 }, children: [new TextRun({ text: engagement.businessName || 'Business Name', font: 'Arial', size: 32, bold: true, color: NAVY })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: `${engagement.entityType}${engagement.abn ? ' | ABN: ' + engagement.abn : ''}`, font: 'Arial', size: 20, color: '666666' })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800 }, children: [new TextRun({ text: `Effective Date: ${engagement.valuationDate || '—'}`, font: 'Arial', size: 20, color: '666666' })] }))

    const valueRange = engagement.valuationScope === 'equity'
      ? `${fmt(valuation.finalLow)} – ${fmt(valuation.finalHigh)}`
      : `${fmt(valuation.evLow)} – ${fmt(valuation.evHigh)}`
    const midpoint = engagement.valuationScope === 'equity' ? fmt(valuation.finalMid) : fmt((valuation.evLow + valuation.evHigh) / 2)

    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Assessed Value Range', font: 'Arial', size: 20, color: '999999' })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: valueRange, font: 'Arial', size: 40, bold: true, color: NAVY })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 2000 }, children: [new TextRun({ text: `Midpoint: ${midpoint}`, font: 'Arial', size: 28, color: BLUE })] }))

    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Purpose: ${engagement.purpose}`, font: 'Arial', size: 18, color: '999999' })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Method: ${engagement.valuationMethod} | Scope: ${engagement.valuationScope === 'equity' ? 'Full Entity (Equity)' : 'Enterprise Value'}`, font: 'Arial', size: 18, color: '999999' })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Prepared using BAKR Business Valuation Tool — Consultants for Accountants Pty Ltd', font: 'Arial', size: 16, color: 'AAAAAA' })] }))

    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ─── 1. ENGAGEMENT SUMMARY ─────────────────────────────────────────────
    children.push(heading('1. Engagement Summary', HeadingLevel.HEADING_1))
    const engFields = [
      ['Business Name', engagement.businessName], ['Entity Type', engagement.entityType],
      ['Industry', engagement.industrySector], ['ABN', engagement.abn || '—'],
      ['Employees', engagement.employees || '—'], ['Years Trading', engagement.yearsTrading || '—'],
      ['Purpose', engagement.purpose], ['Valuation Date', engagement.valuationDate],
    ]
    const engWidths = [3000, 6360]
    engFields.forEach(([label, value]) => {
      children.push(new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: engWidths, rows: [
        dataRow([{ text: label + ':', bold: true, color: '666666' }, { text: value || '—' }], engWidths)
      ] }))
    })
    if (engagement.businessDescription) {
      children.push(spacer())
      children.push(para('Business Description:', { bold: true, color: '666666' }))
      children.push(para(engagement.businessDescription))
    }
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ─── 2. FINANCIAL PERFORMANCE ──────────────────────────────────────────
    children.push(heading('2. Historical Financial Performance', HeadingLevel.HEADING_1))

    const yrCols = years.map(() => Math.floor(5360 / years.length))
    const perfWidths = [4000, ...yrCols]
    const perfHeaders = ['Item', ...years.map((yr: string) => `FY${yr}`)]

    const perfRows = [
      { l: 'Revenue', k: 'revenue', bold: false },
      { l: 'Less: Cost of Sales', k: 'cos', bold: false },
      { l: 'Gross Profit', k: 'grossProfit', bold: true, bg: GREEN_BG },
      { l: 'Other Income', k: 'otherIncome', bold: false },
      { l: 'Less: Operating Expenses', k: 'opex', bold: false },
      { l: 'Less: Depreciation', k: 'depreciation', bold: false },
      { l: 'Less: Amortisation', k: 'amortisation', bold: false },
      { l: 'Less: Interest', k: 'interest', bold: false },
      { l: 'Less: Tax', k: 'tax', bold: false },
      { l: 'Net Profit', k: 'netProfit', bold: true },
      { l: 'Add: Depreciation', k: 'depreciation', bold: false, color: BLUE },
      { l: 'Add: Amortisation', k: 'amortisation', bold: false, color: BLUE },
      { l: 'Add: Interest', k: 'interest', bold: false, color: BLUE },
      { l: 'Add: Tax', k: 'tax', bold: false, color: BLUE },
      { l: 'EBITDA', k: 'ebitda', bold: true, bg: NAVY, textColor: 'FFFFFF' },
    ]

    children.push(new Table({
      width: { size: TW, type: WidthType.DXA },
      columnWidths: perfWidths,
      rows: [
        headerRow(perfHeaders, perfWidths),
        ...perfRows.map(r => dataRow([
          { text: r.l, bold: r.bold, color: (r as any).textColor || (r as any).color || undefined, bg: (r as any).bg },
          ...years.map((yr: string) => ({
            text: fmt(ebitdaByYear[yr]?.[r.k] || 0),
            bold: r.bold,
            color: (r as any).textColor || undefined,
            bg: (r as any).bg
          }))
        ], perfWidths))
      ]
    }))

    // Margins
    children.push(spacer())
    children.push(para('Key Margins:', { bold: true }))
    years.forEach((yr: string) => {
      const d = ebitdaByYear[yr]
      if (d?.revenue) {
        children.push(para(`FY${yr}: Gross Margin ${fmtPct(d.grossProfit / d.revenue)} | EBITDA Margin ${fmtPct(d.ebitda / d.revenue)}`, { size: 18, color: '666666' }))
      }
    })
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ─── 3. NORMALISATION ──────────────────────────────────────────────────
    children.push(heading('3. Normalisation Adjustments', HeadingLevel.HEADING_1))
    children.push(para('The following adjustments were considered to convert the reported EBITDA to a normalised basis reflecting sustainable future earnings for a hypothetical purchaser.', { size: 18, color: '666666' }))

    if (normItems && normItems.length > 0) {
      const normWidths = [2800, 1400, ...yrCols, 1160]
      const normHeaders = ['Adjustment', 'Category', ...years.map((yr: string) => `FY${yr}`), 'Status']
      const activeNorms = normItems.filter((n: any) => n.userDecision !== 'reject')

      children.push(new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: normWidths,
        rows: [
          headerRow(normHeaders, normWidths),
          ...normItems.map((item: any) => {
            const rejected = item.userDecision === 'reject'
            return dataRow([
              { text: item.lineItemName, color: rejected ? 'AAAAAA' : undefined },
              { text: item.category?.replace(/_/g, ' ') || '', color: rejected ? 'AAAAAA' : undefined },
              ...years.map((yr: string) => {
                const a = item.userDecision === 'modify' ? (item.userAmount?.[yr] || 0) : (item.amounts?.[yr] || 0)
                return { text: a ? fmt(a) : '-', color: rejected ? 'AAAAAA' : (a > 0 ? '2E7D32' : a < 0 ? 'C62828' : undefined) }
              }),
              { text: item.userDecision === 'accept' ? 'Accepted' : item.userDecision === 'reject' ? 'Rejected' : 'Modified', color: rejected ? 'AAAAAA' : undefined }
            ], normWidths)
          })
        ]
      }))

      children.push(spacer())
      // Bridge table
      const bridgeWidths = [4000, ...yrCols]
      children.push(new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: bridgeWidths,
        rows: [
          dataRow([{ text: 'Reported EBITDA', bold: true }, ...years.map((yr: string) => ({ text: fmt(ebitdaByYear[yr]?.ebitda || 0) }))], bridgeWidths),
          dataRow([{ text: 'Net Adjustments (accepted)' }, ...years.map((yr: string) => {
            const adj = (normalisedEbitdaByYear[yr] || 0) - (ebitdaByYear[yr]?.ebitda || 0)
            return { text: fmt(adj), color: adj > 0 ? '2E7D32' : adj < 0 ? 'C62828' : undefined }
          })], bridgeWidths),
          dataRow([{ text: 'Normalised EBITDA', bold: true, bg: NAVY, color: 'FFFFFF' }, ...years.map((yr: string) => ({ text: fmt(normalisedEbitdaByYear[yr] || 0), bold: true, bg: NAVY, color: 'FFFFFF' }))], bridgeWidths),
        ]
      }))
    } else {
      children.push(para('No normalisation adjustments were made. The reported EBITDA has been adopted as the basis for valuation.', { size: 18, color: '666666' }))
    }

    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ─── 4. FME DERIVATION ─────────────────────────────────────────────────
    children.push(heading('4. Future Maintainable Earnings (FME)', HeadingLevel.HEADING_1))
    children.push(para('The normalised EBITDA for each year is weighted to derive a single earnings figure representing the sustainable future earning capacity of the business.', { size: 18, color: '666666' }))

    const fmeWidths = [2500, 2500, 1860, 2500]
    children.push(new Table({
      width: { size: TW, type: WidthType.DXA },
      columnWidths: fmeWidths,
      rows: [
        headerRow(['Year', 'Normalised EBITDA', 'Weight', 'Contribution'], fmeWidths),
        ...(weights || []).map((w: any) => dataRow([
          { text: `FY${w.year}` },
          { text: fmt(normalisedEbitdaByYear[w.year] || 0) },
          { text: `${w.weight}%` },
          { text: fmt((normalisedEbitdaByYear[w.year] || 0) * w.weight / 100), bold: true },
        ], fmeWidths)),
        dataRow([
          { text: 'Future Maintainable Earnings (FME)', bold: true, bg: NAVY, color: 'FFFFFF' },
          { text: '', bg: NAVY },
          { text: '100%', bold: true, bg: NAVY, color: 'FFFFFF' },
          { text: fmt(fme), bold: true, bg: NAVY, color: 'FFFFFF' },
        ], fmeWidths),
      ]
    }))

    if (aiWeightReasoning) {
      children.push(spacer())
      children.push(para('Weighting Rationale:', { bold: true }))
      children.push(para(aiWeightReasoning, { size: 18, color: '666666' }))
    }

    // ─── 5. RISK ASSESSMENT & MULTIPLE ─────────────────────────────────────
    children.push(heading('5. Risk Assessment & Multiple Derivation', HeadingLevel.HEADING_1))
    children.push(para('Six risk factors are assessed to derive an appropriate EBITDA capitalisation multiple. Each factor is scored from 0 (lowest risk) to 10 (highest risk), with optimistic and conservative estimates.', { size: 18, color: '666666' }))

    const riskWidths = [2400, 800, 800, 5360]
    children.push(new Table({
      width: { size: TW, type: WidthType.DXA },
      columnWidths: riskWidths,
      rows: [
        headerRow(['Risk Factor', 'Low', 'High', 'Assessment'], riskWidths),
        ...(riskFactors || []).map((f: any) => dataRow([
          { text: f.name, bold: true },
          { text: String(f.scoreLow) },
          { text: String(f.scoreHigh) },
          { text: f.aiReasoning || '—', color: '666666' },
        ], riskWidths)),
        dataRow([
          { text: 'Composite Score', bold: true, bg: LIGHT },
          { text: compositeScoreLow?.toFixed(1) || '-', bold: true, bg: LIGHT },
          { text: compositeScoreHigh?.toFixed(1) || '-', bold: true, bg: LIGHT },
          { text: '', bg: LIGHT },
        ], riskWidths),
      ]
    }))

    children.push(spacer())
    children.push(para(`Multiple derivation: risk score mapped via linear interpolation (Score 2 = 5.0x, Score 5 = 3.0x, Score 9 = 1.0x, capped 1.0x–6.0x).`, { size: 18, color: '666666' }))
    children.push(para(`EBITDA Multiple Range: ${multipleLow?.toFixed(2)}x – ${multipleHigh?.toFixed(2)}x`, { bold: true, size: 22 }))
    children.push(para(`FME: ${fmt(fme)}`, { bold: true, size: 22 }))
    children.push(para(`Enterprise Value: ${fmt(valuation.evLow)} – ${fmt(valuation.evHigh)}`, { bold: true, size: 24, color: NAVY }))

    if (industryAnalysis) {
      children.push(spacer())
      children.push(para('Industry Analysis:', { bold: true }))
      children.push(para(industryAnalysis, { size: 18, color: '666666' }))
    }

    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ─── 6. BALANCE SHEET & EQUITY VALUE ───────────────────────────────────
    if (engagement.valuationScope === 'equity' && bsItems) {
      children.push(heading('6. Balance Sheet Adjustments & Equity Value', HeadingLevel.HEADING_1))
      children.push(para('Each balance sheet item is classified to determine its treatment in the equity value calculation.', { size: 18, color: '666666' }))

      const bsWidths = [5500, 3860]

      const bsRows: TableRow[] = []
      bsRows.push(dataRow([{ text: 'Enterprise Value (Low / High)', bold: true, bg: LIGHT, color: NAVY }, { text: `${fmt(valuation.evLow)} / ${fmt(valuation.evHigh)}`, bold: true, bg: LIGHT, color: NAVY }], bsWidths))

      // Transferring Assets
      bsRows.push(dataRow([{ text: 'Assets Transferring to Buyer', bold: true, bg: GREEN_BG, color: '2E7D32' }, { text: '', bg: GREEN_BG }], bsWidths))
      bsItems.filter((b: any) => b.classification === 'transfer_asset').forEach((b: any) => {
        const v = b.adjustedValue || (b.amounts?.[years[0]] || 0)
        bsRows.push(dataRow([{ text: '    ' + b.name, color: '666666' }, { text: fmt(v), color: '2E7D32' }], bsWidths))
      })
      bsRows.push(dataRow([{ text: '    Subtotal', bold: true, color: '2E7D32' }, { text: fmt(valuation.transferAssets), bold: true, color: '2E7D32' }], bsWidths))

      // Transferring Liabilities
      bsRows.push(dataRow([{ text: 'Liabilities Transferring to Buyer', bold: true, bg: RED_BG, color: 'C62828' }, { text: '', bg: RED_BG }], bsWidths))
      bsItems.filter((b: any) => b.classification === 'transfer_liability').forEach((b: any) => {
        const v = Math.abs(b.adjustedValue || (b.amounts?.[years[0]] || 0))
        bsRows.push(dataRow([{ text: '    ' + b.name, color: '666666' }, { text: `(${fmt(v)})`, color: 'C62828' }], bsWidths))
      })
      bsRows.push(dataRow([{ text: '    Subtotal', bold: true, color: 'C62828' }, { text: `(${fmt(valuation.transferLiabilities)})`, bold: true, color: 'C62828' }], bsWidths))

      // Net transferring
      bsRows.push(dataRow([{ text: 'Net Transferring to Buyer', bold: true, bg: LIGHT }, { text: fmt(valuation.netTransferring), bold: true, bg: LIGHT }], bsWidths))

      // Surplus
      if (valuation.surplusAssets > 0) {
        bsRows.push(dataRow([{ text: 'Surplus Assets', bold: true, bg: 'E3F2FD', color: '1565C0' }, { text: '', bg: 'E3F2FD' }], bsWidths))
        bsItems.filter((b: any) => b.classification === 'surplus').forEach((b: any) => {
          const v = b.adjustedValue || (b.amounts?.[years[0]] || 0)
          bsRows.push(dataRow([{ text: '    ' + b.name, color: '666666' }, { text: fmt(v), color: '1565C0' }], bsWidths))
        })
        bsRows.push(dataRow([{ text: '    Subtotal', bold: true, color: '1565C0' }, { text: fmt(valuation.surplusAssets), bold: true, color: '1565C0' }], bsWidths))
      }

      // Debt
      if (valuation.netDebt > 0) {
        bsRows.push(dataRow([{ text: 'Interest-Bearing Debt', bold: true, bg: RED_BG, color: 'C62828' }, { text: '', bg: RED_BG }], bsWidths))
        bsItems.filter((b: any) => b.classification === 'debt').forEach((b: any) => {
          const v = Math.abs(b.adjustedValue || (b.amounts?.[years[0]] || 0))
          bsRows.push(dataRow([{ text: '    ' + b.name, color: '666666' }, { text: `(${fmt(v)})`, color: 'C62828' }], bsWidths))
        })
        bsRows.push(dataRow([{ text: '    Subtotal', bold: true, color: 'C62828' }, { text: `(${fmt(valuation.netDebt)})`, bold: true, color: 'C62828' }], bsWidths))
      }

      // Totals
      bsRows.push(dataRow([{ text: 'Total Balance Sheet Adjustment', bold: true, bg: 'E0E0E0' }, { text: fmt(valuation.netBsAdjustment), bold: true, bg: 'E0E0E0' }], bsWidths))
      bsRows.push(dataRow([{ text: 'Equity Value (Low / High)', bold: true, bg: NAVY, color: 'FFFFFF' }, { text: `${fmt(valuation.eqLow)} / ${fmt(valuation.eqHigh)}`, bold: true, bg: NAVY, color: 'FFFFFF' }], bsWidths))
      bsRows.push(dataRow([{ text: 'Midpoint Equity Value', bold: true, bg: BLUE, color: 'FFFFFF' }, { text: fmt(valuation.eqMid), bold: true, bg: BLUE, color: 'FFFFFF' }], bsWidths))

      children.push(new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: bsWidths, rows: bsRows }))

      if (discounts?.applyMinority || discounts?.applyMarketability) {
        children.push(spacer())
        children.push(para('Discounts Applied:', { bold: true }))
        if (discounts.applyMinority) children.push(para(`Minority discount: ${discounts.minorityDiscount}%${discounts.minorityReasoning ? ' — ' + discounts.minorityReasoning : ''}`, { size: 18 }))
        if (discounts.applyMarketability) children.push(para(`Marketability discount: ${discounts.marketabilityDiscount}%${discounts.marketabilityReasoning ? ' — ' + discounts.marketabilityReasoning : ''}`, { size: 18 }))
        children.push(para(`Post-discount value: ${fmt(valuation.finalLow)} – ${fmt(valuation.finalHigh)} (midpoint: ${fmt(valuation.finalMid)})`, { bold: true, size: 22, color: NAVY }))
      }

      // Implied goodwill
      children.push(spacer())
      const evMid = (valuation.evLow + valuation.evHigh) / 2
      children.push(para(`Implied Goodwill: Enterprise Value (mid) ${fmt(evMid)} less Operating Fixed Assets ${fmt(valuation.inEvAssets)} = ${fmt(evMid - valuation.inEvAssets)}`, { size: 18, color: '666666' }))

      children.push(new Paragraph({ children: [new PageBreak()] }))
    }

    // ─── CROSS-CHECKS ──────────────────────────────────────────────────────
    const crossNum = engagement.valuationScope === 'equity' ? '7' : '6'
    children.push(heading(`${crossNum}. Cross-Checks & Reasonableness`, HeadingLevel.HEADING_1))
    children.push(para(`Implied Revenue Multiple: ${valuation.impliedRevMultLow?.toFixed(2)}x – ${valuation.impliedRevMultHigh?.toFixed(2)}x (based on most recent year revenue)`, { size: 20 }))
    children.push(para(`Equipment Floor Value: ${fmt(valuation.equipmentFloor)} (realisable value of operating fixed assets)`, { size: 20 }))
    if (valuation.floorExceeded) {
      children.push(para(`WARNING: Equipment floor (${fmt(valuation.equipmentFloor)}) exceeds enterprise value (${fmt(valuation.evHigh)}). Consider whether a break-up/liquidation basis is more appropriate.`, { bold: true, color: 'C62828' }))
    }

    // ─── SENSITIVITY ───────────────────────────────────────────────────────
    const sensNum = engagement.valuationScope === 'equity' ? '8' : '7'
    children.push(heading(`${sensNum}. Sensitivity Analysis`, HeadingLevel.HEADING_1))
    children.push(para('The matrix shows enterprise value under different FME (±15%) and multiple assumptions.', { size: 18, color: '666666' }))

    if (sensitivity) {
      const midMult = ((multipleLow || 0) + (multipleHigh || 0)) / 2
      const sensWidths = [3000, 2120, 2120, 2120]
      const sensLabels = ['Conservative (85%)', 'Base (100%)', 'Optimistic (115%)']
      children.push(new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: sensWidths,
        rows: [
          headerRow(['FME Scenario', `${multipleLow?.toFixed(1)}x`, `${midMult.toFixed(1)}x`, `${multipleHigh?.toFixed(1)}x`], sensWidths),
          ...sensLabels.map((label, i) => dataRow([
            { text: `${label} (${fmt(fme * (i === 0 ? 0.85 : i === 1 ? 1 : 1.15))})`, bold: i === 1 },
            ...sensitivity[i].map((v: number, j: number) => ({ text: fmt(v), bold: i === 1 && j === 1, bg: i === 1 && j === 1 ? LIGHT : undefined }))
          ], sensWidths))
        ]
      }))
    }

    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ─── DISCLAIMERS ───────────────────────────────────────────────────────
    children.push(heading('Important Disclaimers & Limitations', HeadingLevel.HEADING_1))
    const disclaimers = [
      `Basis of valuation: This valuation has been prepared using the Capitalisation of Future Maintainable Earnings method. It represents an estimate of fair market value — the price negotiated in an open, unrestricted market between knowledgeable, willing but not anxious parties acting at arm's length.`,
      `Financial information: No audit or independent verification of the underlying financial information has been performed. The accuracy of this valuation depends on the completeness and accuracy of the information provided.`,
      `Economic conditions: This valuation is based on conditions prevailing at the valuation date of ${engagement.valuationDate}. Conditions can change significantly over short periods.`,
      `Professional standards: This output is aligned with APES 225 Valuation Services principles but constitutes a calculation engagement only. For a formal valuation engagement, the output should be independently reviewed by a qualified valuer.`,
      `Limitation of liability: This valuation is provided for the stated purpose only. Users should obtain independent professional advice before making decisions based on this output. Consultants for Accountants Pty Ltd accepts no liability for loss arising from use of this tool.`,
    ]
    disclaimers.forEach(d => children.push(para(d, { size: 18, color: '666666', spacing: 200 })))
    children.push(spacer())
    children.push(para('Prepared using BAKR Business Valuation Tool — Consultants for Accountants Pty Ltd | bakr.com.au', { size: 16, color: 'AAAAAA' }))

    // ─── BUILD DOCUMENT ────────────────────────────────────────────────────
    const doc = new Document({
      styles: {
        default: { document: { run: { font: 'Arial', size: 20 } } },
        paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: 'Arial', color: NAVY }, paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 0 } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: 'Arial', color: BLUE }, paragraph: { spacing: { before: 200, after: 150 }, outlineLevel: 1 } },
        ]
      },
      numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `${engagement.businessName} — Valuation Report — `, font: 'Arial', size: 14, color: 'AAAAAA' }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14, color: 'AAAAAA' }),
              ]
            })]
          })
        },
        children
      }]
    })

    const buffer = await Packer.toBuffer(doc)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${(engagement.businessName || 'Valuation').replace(/[^a-zA-Z0-9 ]/g, '')}_Valuation_Report.docx"`,
      }
    })
  } catch (err: any) {
    console.error('DOCX generation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
