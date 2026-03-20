/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useCallback, useMemo, Fragment } from 'react'

// ═══════════════════════════════════════════════════════════════════════════════
// BAKR BUSINESS VALUATION TOOL — Complete (Steps 1-9)
// bakr.com.au/tools/business-valuation
// ═══════════════════════════════════════════════════════════════════════════════

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface Engagement {
  businessName: string; abn: string; entityType: string; valuationDate: string
  purpose: string; industrySector: string; industrySubSector: string
  yearsTrading: number; employees: number; locations: number
  sharesOnIssue: number; shareholderDetails: string; businessDescription: string
  keyPersonnel: string; valuationMethod: 'EBITDA' | 'SDE'
  valuationScope: 'enterprise' | 'equity'; ownerMarketSalary: number
}

interface PLLineItem {
  id: string; name: string
  category: 'revenue' | 'cos' | 'other_income' | 'opex' | 'depreciation' | 'amortisation' | 'interest' | 'tax'
  amounts: Record<string, number>
}

interface BSLineItem {
  id: string; name: string
  section: 'current_asset' | 'fixed_asset' | 'non_current_asset' | 'current_liability' | 'non_current_liability' | 'equity'
  amounts: Record<string, number>
  adjustedValue: number
  classification: 'operating' | 'surplus' | 'debt' | 'equity_item'
  userNotes: string
}

interface NormalisationItem {
  id: string; lineItemName: string
  category: 'owner_comp' | 'related_party' | 'personal_discretionary' | 'non_recurring' | 'non_operating'
  amounts: Record<string, number>
  recommendedTreatment: 'add_back' | 'deduct' | 'adjust_to_market' | 'leave'
  aiReasoning: string; userDecision: 'accept' | 'reject' | 'modify'
  userAmount: Record<string, number>; userReasoning: string
}

interface FinancialYearConfig {
  year: string; label: string; isPartYear: boolean; months: number
}

interface WeightingConfig {
  year: string; weight: number
}

interface RiskFactor {
  id: string; name: string; description: string; guidance: string
  weight: number; scoreLow: number; scoreHigh: number; aiReasoning: string
}

interface DiscountConfig {
  minorityDiscount: number; marketabilityDiscount: number
  applyMinority: boolean; applyMarketability: boolean
  minorityReasoning: string; marketabilityReasoning: string
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const ENTITY_TYPES = ['Pty Ltd', 'Partnership', 'Sole Trader', 'Trust', 'Other']
const PURPOSES = ['Sale of business', 'Purchase of business', 'Succession planning', 'Family law', 'Insurance', 'Strategic planning', 'Tax (CGT event)', 'Shareholder dispute', 'Other']
const INDUSTRY_SECTORS = [
  'Agriculture & Farming', 'Automotive', 'Building & Construction', 'Childcare & Education',
  'Cleaning Services', 'E-commerce & Online Retail', 'Engineering', 'Financial Services',
  'Food & Beverage', 'Franchises', 'Health & Medical', 'Hospitality & Tourism',
  'Import / Export', 'Information Technology', 'Internet & Telecommunications',
  'Legal Services', 'Logistics & Transport', 'Manufacturing', 'Media & Entertainment',
  'Mining & Resources', 'Pharmacy', 'Professional Services', 'Property & Real Estate',
  'Retail', 'Sports & Recreation', 'Trades & Services', 'Veterinary', 'Wholesale', 'Other'
]

const NORM_CATEGORIES: Record<string, string> = {
  owner_comp: 'Owner Compensation', related_party: 'Related Party Transactions',
  personal_discretionary: 'Personal / Discretionary', non_recurring: 'Non-Recurring Items',
  non_operating: 'Non-Operating Items'
}

const NORM_TREATMENTS: Record<string, string> = {
  add_back: 'Add back to EBITDA', deduct: 'Deduct from EBITDA',
  adjust_to_market: 'Adjust to market rate', leave: 'Leave as-is'
}

const DEFAULT_RISK_FACTORS: RiskFactor[] = [
  { id: 'revenue', name: 'Revenue Growth & Maintainability', description: 'Consistency and trajectory of revenue; likelihood of continuation', guidance: '0 = strong consistent growth; 5 = stable/flat; 10 = declining revenue', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
  { id: 'financial', name: 'Financial Risk', description: 'Debt levels, liquidity, working capital adequacy', guidance: '0 = no debt, strong liquidity; 5 = moderate debt; 10 = highly leveraged', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
  { id: 'keyman', name: 'Key Person Risk', description: 'Dependence on owner or small number of key people', guidance: '0 = no individual reliance; 5 = moderate dependence; 10 = business fails without owner', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
  { id: 'customer', name: 'Customer Concentration Risk', description: 'Revenue spread across customer base', guidance: '0 = highly diversified; 5 = moderate concentration; 10 = one customer >50% of revenue', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
  { id: 'profitability', name: 'Profitability Risk', description: 'EBITDA margin level and consistency', guidance: '0 = 20%+ consistent margin; 5 = 10% margin; 10 = loss-making or volatile', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
  { id: 'competitive', name: 'Competitive / Industry Risk', description: 'Market position, barriers to entry, regulatory environment', guidance: '0 = monopoly/dominant; 5 = moderate competition; 10 = extremely competitive, low barriers', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
]

// ─── INITIAL STATE ──────────────────────────────────────────────────────────

const defaultEngagement: Engagement = {
  businessName: '', abn: '', entityType: 'Pty Ltd', valuationDate: '',
  purpose: 'Sale of business', industrySector: '', industrySubSector: '',
  yearsTrading: 0, employees: 0, locations: 1, sharesOnIssue: 1,
  shareholderDetails: '', businessDescription: '', keyPersonnel: '',
  valuationMethod: 'EBITDA', valuationScope: 'equity', ownerMarketSalary: 0
}

const defaultDiscount: DiscountConfig = {
  minorityDiscount: 0, marketabilityDiscount: 15,
  applyMinority: false, applyMarketability: false,
  minorityReasoning: '', marketabilityReasoning: ''
}

// ─── FORMATTING ─────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return '-'
  const abs = Math.abs(n)
  const s = abs >= 1000 ? abs.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : abs.toFixed(0)
  return n < 0 ? `($${s})` : `$${s}`
}

function fmtK(n: number): string {
  if (n === 0) return '-'
  const k = n / 1000
  const abs = Math.abs(k)
  const s = abs.toFixed(0)
  return k < 0 ? `($${s}k)` : `$${s}k`
}

function fmtPct(n: number): string { return (n * 100).toFixed(1) + '%' }
function genId(): string { return Math.random().toString(36).substring(2, 10) }

// ─── OPUS ───────────────────────────────────────────────────────────────────

const PROXY = '/api/anthropic'

// ─── PDF TEXT EXTRACTION ────────────────────────────────────────────────────

async function extractPdfText(dataUrl: string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  
  const base64 = dataUrl.split(',')[1]
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    const text = tc.items.map((item: any) => ('str' in item ? item.str : '')).join(' ')
    if (text.trim()) pages.push(`--- Page ${i} ---\n${text}`)
  }
  return pages.join('\n\n')
}

async function callOpus(system: string, user: string): Promise<string> {
  try {
    const res = await fetch(PROXY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 8000, system, messages: [{ role: 'user', content: user }] })
    })
    const data = await res.json()
    return data.content?.[0]?.text || JSON.stringify(data)
  } catch (err: any) { console.error('Opus:', err); return JSON.stringify({ error: err.message }) }
}

// ─── MULTIPLE DERIVATION ────────────────────────────────────────────────────

function riskScoreToMultiple(score: number): number {
  // Linear interpolation: score 2 -> 5x, score 5 -> 3x, score 9 -> 1x
  if (score <= 2) return 5.0
  if (score <= 5) return 5.0 - ((score - 2) / 3) * 2.0  // 5 -> 3
  if (score <= 9) return 3.0 - ((score - 5) / 4) * 2.0  // 3 -> 1
  return 1.0
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function BusinessValuationTool() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1)
  const [engagement, setEngagement] = useState<Engagement>(defaultEngagement)
  const [fyConfigs, setFyConfigs] = useState<FinancialYearConfig[]>([])
  const [plItems, setPlItems] = useState<PLLineItem[]>([])
  const [bsItems, setBsItems] = useState<BSLineItem[]>([])
  const [normItems, setNormItems] = useState<NormalisationItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMsg, setProcessingMsg] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, type: string, fy: string, data: string}[]>([])
  const [stepComplete, setStepComplete] = useState<Record<number, boolean>>({})

  // Step 6 state
  const [weights, setWeights] = useState<WeightingConfig[]>([])
  const [weightContext, setWeightContext] = useState('')
  const [aiWeightReasoning, setAiWeightReasoning] = useState('')

  // Step 7 state
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>(DEFAULT_RISK_FACTORS)
  const [industryAnalysis, setIndustryAnalysis] = useState('')
  // comparables state reserved for Phase 3

  // Step 8 state
  const [discounts, setDiscounts] = useState<DiscountConfig>(defaultDiscount)
  const [workingCapitalAdj, setWorkingCapitalAdj] = useState(0)

  // ── Derived ───────────────────────────────────────────────────────────────
  const years = useMemo(() => fyConfigs.map(f => f.year), [fyConfigs])

  const ebitdaByYear = useMemo(() => {
    const r: Record<string, any> = {}
    for (const yr of years) {
      let revenue = 0, cos = 0, otherIncome = 0, opex = 0, dep = 0, amort = 0, interest = 0, tax = 0
      for (const item of plItems) {
        const a = item.amounts[yr] || 0
        if (item.category === 'revenue') revenue += a
        else if (item.category === 'cos') cos += a
        else if (item.category === 'other_income') otherIncome += a
        else if (item.category === 'opex') opex += a
        else if (item.category === 'depreciation') dep += a
        else if (item.category === 'amortisation') amort += a
        else if (item.category === 'interest') interest += a
        else if (item.category === 'tax') tax += a
      }
      const gp = revenue - cos
      const np = gp + otherIncome - opex - dep - amort - interest - tax
      r[yr] = { revenue, cos, grossProfit: gp, otherIncome, opex, netProfit: np, depreciation: dep, amortisation: amort, interest, tax, ebitda: np + dep + amort + interest + tax }
    }
    return r
  }, [plItems, years])

  const normalisedEbitdaByYear = useMemo(() => {
    const r: Record<string, number> = {}
    for (const yr of years) {
      let e = ebitdaByYear[yr]?.ebitda || 0
      for (const item of normItems) {
        if (item.userDecision === 'reject') continue
        const amt = item.userDecision === 'modify' ? (item.userAmount[yr] || 0) : (item.amounts[yr] || 0)
        if (item.recommendedTreatment === 'add_back') e += amt
        else if (item.recommendedTreatment === 'deduct') e -= amt
        else if (item.recommendedTreatment === 'adjust_to_market') e += amt
      }
      r[yr] = e
    }
    return r
  }, [ebitdaByYear, normItems, years])

  // FME calculation
  const fme = useMemo(() => {
    if (weights.length === 0) return 0
    let total = 0
    for (const w of weights) {
      total += (normalisedEbitdaByYear[w.year] || 0) * (w.weight / 100)
    }
    return total
  }, [weights, normalisedEbitdaByYear])

  // Risk score & multiple
  const { compositeScoreLow, compositeScoreHigh, multipleLow, multipleHigh } = useMemo(() => {
    let wl = 0, wh = 0, tw = 0
    for (const f of riskFactors) {
      wl += f.scoreLow * f.weight; wh += f.scoreHigh * f.weight; tw += f.weight
    }
    const sl = tw > 0 ? wl / tw : 5
    const sh = tw > 0 ? wh / tw : 5
    return { compositeScoreLow: sl, compositeScoreHigh: sh, multipleLow: riskScoreToMultiple(sh), multipleHigh: riskScoreToMultiple(sl) }
  }, [riskFactors])

  // Valuation
  const valuation = useMemo(() => {
    const evLow = fme * multipleLow
    const evHigh = fme * multipleHigh

    // Balance sheet analysis
    let surplusAssets = 0, netDebt = 0, totalTangibleAssets = 0
    const latestYr = years[0] || ''
    for (const item of bsItems) {
      const val = item.adjustedValue || (item.amounts[latestYr] || 0)
      if (item.classification === 'surplus') surplusAssets += val
      else if (item.classification === 'debt') netDebt += Math.abs(val)
      else if (item.classification === 'operating') {
        if (item.section === 'fixed_asset' || item.section === 'current_asset') totalTangibleAssets += val
      }
    }

    const adjEvLow = evLow - workingCapitalAdj
    const adjEvHigh = evHigh - workingCapitalAdj

    const eqLow = adjEvLow + surplusAssets - netDebt
    const eqHigh = adjEvHigh + surplusAssets - netDebt
    const eqMid = (eqLow + eqHigh) / 2

    // Apply discounts
    let discFactor = 1
    if (discounts.applyMinority) discFactor *= (1 - discounts.minorityDiscount / 100)
    if (discounts.applyMarketability) discFactor *= (1 - discounts.marketabilityDiscount / 100)

    const finalLow = eqLow * discFactor
    const finalHigh = eqHigh * discFactor
    const finalMid = (finalLow + finalHigh) / 2

    // Equipment floor check
    const equipmentFloor = totalTangibleAssets
    const floorExceeded = equipmentFloor > evHigh && equipmentFloor > 0

    // Implied revenue multiple
    const latestRevenue = ebitdaByYear[latestYr]?.revenue || 0
    const impliedRevMultLow = latestRevenue > 0 ? evLow / latestRevenue : 0
    const impliedRevMultHigh = latestRevenue > 0 ? evHigh / latestRevenue : 0

    return {
      evLow, evHigh, adjEvLow, adjEvHigh, surplusAssets, netDebt, workingCapitalAdj,
      eqLow, eqHigh, eqMid, finalLow, finalHigh, finalMid,
      equipmentFloor, floorExceeded, impliedRevMultLow, impliedRevMultHigh, discFactor
    }
  }, [fme, multipleLow, multipleHigh, bsItems, years, ebitdaByYear, workingCapitalAdj, discounts])

  // Sensitivity matrix
  const sensitivity = useMemo(() => {
    const fmeVariants = [fme * 0.85, fme, fme * 1.15]
    const multVariants = [multipleLow, (multipleLow + multipleHigh) / 2, multipleHigh]
    return fmeVariants.map(f => multVariants.map(m => f * m))
  }, [fme, multipleLow, multipleHigh])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, fileType: string) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setUploadedFiles(prev => [...prev, { name: file.name, type: fileType, fy: 'auto', data: ev.target?.result as string }])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const parseFinancials = useCallback(async () => {
    if (uploadedFiles.length === 0) return
    setIsProcessing(true)
    setProcessingMsg('Extracting text from documents...')

    // Extract text from all uploaded PDFs client-side
    let allText = ''
    for (const file of uploadedFiles) {
      if (file.data.startsWith('data:')) {
        const mimeMatch = file.data.match(/data:([^;]+);/)
        const mediaType = mimeMatch ? mimeMatch[1] : ''
        if (mediaType === 'application/pdf') {
          try {
            const pdfText = await extractPdfText(file.data)
            allText += `\n\n=== FILE: ${file.name} ===\n${pdfText}`
          } catch (e: any) {
            console.error('PDF extraction error:', e)
            allText += `\n\n=== FILE: ${file.name} (could not extract text) ===`
          }
        } else {
          allText += `\n\n=== FILE: ${file.name} (non-PDF, please enter data manually) ===`
        }
      }
    }

    if (!allText.trim()) {
      setProcessingMsg('Could not extract text from the uploaded files. Please enter data manually.')
      setIsProcessing(false)
      return
    }

    setProcessingMsg('Text extracted. Sending to AI for analysis — this may take 30-60 seconds...')
    console.log('Extracted text length:', allText.length)
    console.log('First 1000 chars:', allText.substring(0, 1000))

    const prompt = `Here are the financial statements extracted from PDF:

${allText}

Parse ALL financial data into structured JSON. The document may be a combined financial report containing P&L, Balance Sheet, Notes, and Depreciation Schedules — extract everything relevant.

Return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{
  "plItems": [
    {"name": "Line item name", "category": "revenue|cos|other_income|opex|depreciation|amortisation|interest|tax", "amounts": {"2024": 1000, "2023": 2000}}
  ],
  "bsItems": [
    {"name": "Line item name", "section": "current_asset|fixed_asset|non_current_asset|current_liability|non_current_liability|equity", "amounts": {"2024": 1000, "2023": 2000}}
  ],
  "years": ["2024", "2023"]
}

CRITICAL RULES:
- Extract EVERY line item from the P&L — do not summarise or skip items
- Categorise: revenue, cos (cost of sales/direct expenses), other_income, opex (operating expenses), depreciation, amortisation, interest, tax
- Depreciation MUST be category "depreciation", NOT opex
- Interest income = other_income, Interest expense = interest
- Income tax = tax
- All expense amounts should be POSITIVE numbers (they represent costs incurred)
- Items shown in brackets () in the source are negative — make them negative in the JSON
- For the balance sheet: current_asset, fixed_asset, non_current_asset, current_liability, non_current_liability, equity
- Liability amounts should be POSITIVE (they will be treated as liabilities by the system)
- Include ALL years shown in the financial statements
- Years should be ordered most recent first in the years array`

    try {
      const res = await fetch(PROXY, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          system: 'You are an expert Australian Chartered Accountant parsing financial statements into structured JSON. Return ONLY valid JSON, no markdown fences, no explanation text.',
          messages: [{ role: 'user', content: prompt }]
        })
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error('API fetch error:', res.status, errText)
        setProcessingMsg(`API error (${res.status}): ${errText.substring(0, 300)}`)
        setIsProcessing(false)
        return
      }
      const data = await res.json()
      console.log('API response:', JSON.stringify(data).substring(0, 500))
      
      if (data.error) {
        setProcessingMsg(`API error: ${data.error}${data.details ? ' — ' + data.details.substring(0, 200) : ''}`)
        setIsProcessing(false)
        return
      }

      const text = data.content?.[0]?.text || ''
      if (!text) {
        setProcessingMsg('API returned empty response. Try again or enter data manually.')
        setIsProcessing(false)
        return
      }
      console.log('Raw text (first 500):', text.substring(0, 500))
      // Strip markdown fences if present
      const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const p = JSON.parse(clean)
      if (p.plItems) setPlItems(p.plItems.map((i: any) => ({ ...i, id: genId() })))
      if (p.bsItems) setBsItems(p.bsItems.map((i: any) => ({ ...i, id: genId(), adjustedValue: 0, classification: i.section?.includes('liability') ? (i.name?.toLowerCase().includes('borrow') || i.name?.toLowerCase().includes('loan') || i.name?.toLowerCase().includes('finance') ? 'debt' : 'operating') : 'operating', userNotes: '' })))
      if (p.years) {
        setFyConfigs(p.years.map((yr: string) => ({ year: yr, label: `FY${yr}`, isPartYear: false, months: 12 })))
      }
      setProcessingMsg(`Parsed successfully: ${p.plItems?.length || 0} P&L items, ${p.bsItems?.length || 0} balance sheet items across ${p.years?.length || 0} years. Review below.`)
    } catch (err: any) {
      console.error('Parse error:', err)
      setProcessingMsg(`Error parsing: ${err.message}. Check browser console for details. You can enter data manually below.`)
    }
    setIsProcessing(false)
  }, [uploadedFiles])

  const analyseNormalisation = useCallback(async () => {
    setIsProcessing(true)
    setProcessingMsg('Analysing expenses for normalisation...')
    const plSummary = plItems.filter(i => ['opex', 'other_income'].includes(i.category)).map(i => `${i.name}: ${years.map(yr => `FY${yr}=${i.amounts[yr] || 0}`).join(', ')}`).join('\n')
    const sys = `You are an Australian CA doing business valuation normalisation analysis. Flag discretionary, non-recurring, personal, owner compensation and non-operating items. Be thorough but conservative. Return ONLY a JSON array: [{"lineItemName":"...","category":"owner_comp|related_party|personal_discretionary|non_recurring|non_operating","amounts":{"2024":0},"recommendedTreatment":"add_back|deduct|adjust_to_market|leave","aiReasoning":"..."}]`
    const usr = `Business: ${engagement.businessName}, Industry: ${engagement.industrySector}, Employees: ${engagement.employees}, Method: ${engagement.valuationMethod}\n\nP&L items:\n${plSummary}\n\nDescription: ${engagement.businessDescription}`
    try {
      const r = await callOpus(sys, usr)
      const p = JSON.parse(r)
      setNormItems(p.map((i: any) => ({ ...i, id: genId(), userDecision: i.recommendedTreatment === 'leave' ? 'reject' : 'accept', userAmount: i.amounts, userReasoning: '' })))
      setProcessingMsg('Analysis complete.')
    } catch { setProcessingMsg('Error. Add items manually.') }
    setIsProcessing(false)
  }, [plItems, years, engagement])

  const analyseWeighting = useCallback(async () => {
    setIsProcessing(true)
    setProcessingMsg('Analysing EBITDA pattern for optimal weighting...')
    const ebitdaSeries = years.map(yr => `FY${yr}: ${fmt(normalisedEbitdaByYear[yr] || 0)}`).join(', ')
    const sys = `You are an Australian CA determining EBITDA weightings for a business valuation. Consider: trends, anomalies, user context. Return ONLY JSON: {"weights":[{"year":"2024","weight":40},...],"reasoning":"..."}`
    const usr = `Normalised EBITDA: ${ebitdaSeries}\nUser context: ${weightContext || 'No additional context provided'}\nBusiness: ${engagement.businessName}, Industry: ${engagement.industrySector}`
    try {
      const r = await callOpus(sys, usr)
      const p = JSON.parse(r)
      if (p.weights) setWeights(p.weights)
      if (p.reasoning) setAiWeightReasoning(p.reasoning)
      setProcessingMsg('Weighting analysis complete.')
    } catch { setProcessingMsg('Error. Set weights manually.') }
    setIsProcessing(false)
  }, [years, normalisedEbitdaByYear, weightContext, engagement])

  const analyseRisk = useCallback(async () => {
    setIsProcessing(true)
    setProcessingMsg('Analysing business risk factors...')
    const latestYr = years[0] || ''
    const d = ebitdaByYear[latestYr]
    const financialSummary = `Revenue: ${fmt(d?.revenue || 0)}, EBITDA: ${fmt(normalisedEbitdaByYear[latestYr] || 0)}, Margin: ${d?.revenue ? fmtPct((normalisedEbitdaByYear[latestYr] || 0) / d.revenue) : 'N/A'}`
    const sys = `You are an Australian CA scoring risk factors for business valuation (APES 225 aligned). Score each factor 0-10 (low=less risk, high=more risk) with both conservative (high) and optimistic (low) scores. Return ONLY JSON: {"factors":[{"id":"revenue","scoreLow":3,"scoreHigh":5,"reasoning":"..."},...], "industryAnalysis":"2-3 paragraph industry overview"}`
    const usr = `Business: ${engagement.businessName}\nIndustry: ${engagement.industrySector}\nDescription: ${engagement.businessDescription}\nFinancials: ${financialSummary}\nEmployees: ${engagement.employees}, Years trading: ${engagement.yearsTrading}\nFME: ${fmt(fme)}`
    try {
      const r = await callOpus(sys, usr)
      const p = JSON.parse(r)
      if (p.factors) {
        setRiskFactors(prev => prev.map(f => {
          const match = p.factors.find((pf: any) => pf.id === f.id)
          return match ? { ...f, scoreLow: match.scoreLow, scoreHigh: match.scoreHigh, aiReasoning: match.reasoning } : f
        }))
      }
      if (p.industryAnalysis) setIndustryAnalysis(p.industryAnalysis)
      setProcessingMsg('Risk analysis complete.')
    } catch { setProcessingMsg('Error. Score factors manually.') }
    setIsProcessing(false)
  }, [years, ebitdaByYear, normalisedEbitdaByYear, engagement, fme])

  // ── Manual entry helpers ──────────────────────────────────────────────────
  const addFY = useCallback(() => {
    const next = fyConfigs.length > 0 ? String(Math.max(...fyConfigs.map(f => parseInt(f.year))) + 1) : String(new Date().getFullYear())
    setFyConfigs(prev => [...prev, { year: next, label: `FY${next}`, isPartYear: false, months: 12 }])
  }, [fyConfigs])

  const removeFY = useCallback((yr: string) => {
    setFyConfigs(prev => prev.filter(f => f.year !== yr))
    setPlItems(prev => prev.map(item => { const a = { ...item.amounts }; delete a[yr]; return { ...item, amounts: a } }))
  }, [])

  const addPLItem = useCallback((cat: PLLineItem['category']) => {
    setPlItems(prev => [...prev, { id: genId(), name: '', category: cat, amounts: {} }])
  }, [])

  const updatePLItem = useCallback((id: string, field: string, value: any) => {
    setPlItems(prev => prev.map(item => {
      if (item.id !== id) return item
      if (field === 'name' || field === 'category') return { ...item, [field]: value }
      return { ...item, amounts: { ...item.amounts, [field]: parseFloat(value) || 0 } }
    }))
  }, [])

  const removePLItem = useCallback((id: string) => { setPlItems(prev => prev.filter(i => i.id !== id)) }, [])

  const initWeights = useCallback(() => {
    if (weights.length === 0 && years.length > 0) {
      const n = years.length
      const w = years.map((yr, i) => ({ year: yr, weight: Math.round(((n - i) / ((n * (n + 1)) / 2)) * 100) }))
      // Adjust to sum to 100
      const sum = w.reduce((s, x) => s + x.weight, 0)
      if (sum !== 100 && w.length > 0) w[0].weight += (100 - sum)
      setWeights(w)
    }
  }, [years, weights.length])

  // ── Validation ────────────────────────────────────────────────────────────
  const step1Valid = engagement.businessName.trim() !== '' && engagement.industrySector !== '' && engagement.valuationDate !== '' && engagement.businessDescription.trim().length > 20
  const step2Valid = fyConfigs.length >= 2 && plItems.length >= 5

  // ── Navigation ────────────────────────────────────────────────────────────
  const markComplete = useCallback((s: number) => setStepComplete(prev => ({ ...prev, [s]: true })), [])
  const canGoTo = useCallback((s: Step) => {
    if (s === 1) return true
    return stepComplete[s - 1] === true
  }, [stepComplete])

  const goTo = useCallback((s: Step) => { if (canGoTo(s)) setStep(s) }, [canGoTo])

  // ── Styles ────────────────────────────────────────────────────────────────
  const sc = "rounded-2xl bg-white border border-gray-200 shadow-sm p-6 mb-6"
  const lbl = "block text-sm font-semibold text-gray-700 mb-1"
  const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#2E75B6] focus:ring-1 focus:ring-[#2E75B6] outline-none transition"
  const ta = inp + " resize-y"
  const bp = "rounded-lg bg-[#1F4E79] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2E75B6] transition disabled:opacity-40 disabled:cursor-not-allowed"
  const bs = "rounded-lg border border-[#1F4E79] px-5 py-2.5 text-sm font-semibold text-[#1F4E79] hover:bg-[#F0F4F8] transition"

  const STEP_LABELS: [Step, string][] = [[1,'Setup'],[2,'Data'],[3,'EBITDA'],[4,'Normalise'],[5,'Balance Sheet'],[6,'Weighting'],[7,'Risk & Multiple'],[8,'Valuation'],[9,'Report']]

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#F8F6EC]">
      {/* Header */}
      <div className="bg-[#1F4E79] text-white">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Business Valuation Tool</h1>
              <p className="text-sm text-blue-200 mt-0.5">Capitalisation of Future Maintainable Earnings</p>
            </div>
            <div className="text-right text-xs text-blue-200">
              <div>BAKR by CforA</div>
              <span className="mt-1 px-2 py-0.5 bg-amber-500/20 text-amber-200 rounded text-[10px] font-medium">BETA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step Nav */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 flex">
          {STEP_LABELS.map(([s, label]) => (
            <button key={s} onClick={() => goTo(s)}
              className={`shrink-0 py-3 px-3 text-[11px] font-medium border-b-2 transition ${
                step === s ? 'border-[#1F4E79] text-[#1F4E79]' :
                stepComplete[s] ? 'border-emerald-500 text-emerald-600 cursor-pointer' :
                canGoTo(s) ? 'border-transparent text-gray-500 cursor-pointer hover:text-gray-700' :
                'border-transparent text-gray-300 cursor-not-allowed'
              }`}>
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mr-1 ${
                step === s ? 'bg-[#1F4E79] text-white' : stepComplete[s] ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}>{stepComplete[s] && step !== s ? '✓' : s}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ═══ STEP 1 — SETUP ═══════════════════════════════════════════ */}
        {step === 1 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-4">Business Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={lbl}>Business Name *</label><input className={inp} value={engagement.businessName} onChange={e => setEngagement(p => ({...p, businessName: e.target.value}))} placeholder="e.g. Smith & Co Pty Ltd" /></div>
              <div><label className={lbl}>ABN</label><input className={inp} value={engagement.abn} onChange={e => setEngagement(p => ({...p, abn: e.target.value}))} /></div>
              <div><label className={lbl}>Entity Type</label><select className={inp} value={engagement.entityType} onChange={e => setEngagement(p => ({...p, entityType: e.target.value}))}>{ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className={lbl}>Valuation Date *</label><input type="text" className={inp} value={engagement.valuationDate} onChange={e => setEngagement(p => ({...p, valuationDate: e.target.value}))} placeholder="e.g. 30/06/2024" /></div>
              <div><label className={lbl}>Purpose</label><select className={inp} value={engagement.purpose} onChange={e => setEngagement(p => ({...p, purpose: e.target.value}))}>{PURPOSES.map(p => <option key={p}>{p}</option>)}</select></div>
              <div><label className={lbl}>Industry Sector *</label><select className={inp} value={engagement.industrySector} onChange={e => setEngagement(p => ({...p, industrySector: e.target.value}))}><option value="">Select...</option>{INDUSTRY_SECTORS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label className={lbl}>Years Trading</label><input type="number" className={inp} value={engagement.yearsTrading||''} onChange={e => setEngagement(p => ({...p, yearsTrading: parseInt(e.target.value)||0}))} /></div>
              <div><label className={lbl}>Employees (FTE)</label><input type="number" className={inp} value={engagement.employees||''} onChange={e => setEngagement(p => ({...p, employees: parseInt(e.target.value)||0}))} /></div>
              <div><label className={lbl}>Shares on Issue</label><input type="number" className={inp} value={engagement.sharesOnIssue||''} onChange={e => setEngagement(p => ({...p, sharesOnIssue: parseInt(e.target.value)||0}))} /></div>
              <div><label className={lbl}>Locations</label><input type="number" className={inp} value={engagement.locations||''} onChange={e => setEngagement(p => ({...p, locations: parseInt(e.target.value)||0}))} /></div>
            </div>
            <div className="mt-4"><label className={lbl}>Shareholder Details</label><textarea className={ta} rows={2} value={engagement.shareholderDetails} onChange={e => setEngagement(p => ({...p, shareholderDetails: e.target.value}))} placeholder="Names, shareholdings, roles" /></div>
            <div className="mt-3"><label className={lbl}>Key Personnel</label><textarea className={ta} rows={2} value={engagement.keyPersonnel} onChange={e => setEngagement(p => ({...p, keyPersonnel: e.target.value}))} placeholder="Directors, key employees" /></div>
          </div>
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Business Description *</h2>
            <p className="text-xs text-gray-500 mb-2">Describe what the business does. This feeds the AI industry analysis. More detail = better output.</p>
            <textarea className={ta} rows={5} value={engagement.businessDescription} onChange={e => setEngagement(p => ({...p, businessDescription: e.target.value}))} placeholder="Products/services, competitive position, key markets..." />
          </div>
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-4">Valuation Method</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {(['EBITDA','SDE'] as const).map(m => (
                <div key={m} className={`p-4 rounded-xl border-2 cursor-pointer transition ${engagement.valuationMethod === m ? 'border-[#1F4E79] bg-[#F0F4F8]' : 'border-gray-200 hover:border-[#2E75B6]'}`}
                  onClick={() => setEngagement(p => ({...p, valuationMethod: m}))}>
                  <span className="font-bold text-sm text-[#1F4E79]">{m === 'EBITDA' ? 'EBITDA Method' : "SDE Method (Seller's Discretionary Earnings)"}</span>
                  <p className="text-xs text-gray-600 mt-1">{m === 'EBITDA' ? 'For buyers installing own management (competitors, corporates)' : 'For owner-operators replacing the current owner (small businesses)'}</p>
                </div>
              ))}
            </div>
            {engagement.valuationMethod === 'SDE' && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 mb-4">
                <label className={lbl}>Market Salary for Owner&apos;s Role ($)</label>
                <input type="number" className={inp+" max-w-xs"} value={engagement.ownerMarketSalary||''} onChange={e => setEngagement(p => ({...p, ownerMarketSalary: parseFloat(e.target.value)||0}))} placeholder="e.g. 150000" />
              </div>
            )}
            <h2 className="text-lg font-bold text-[#1F4E79] mb-4">Valuation Scope</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['enterprise','equity'] as const).map(s => (
                <div key={s} className={`p-4 rounded-xl border-2 cursor-pointer transition ${engagement.valuationScope === s ? 'border-[#1F4E79] bg-[#F0F4F8]' : 'border-gray-200 hover:border-[#2E75B6]'}`}
                  onClick={() => setEngagement(p => ({...p, valuationScope: s}))}>
                  <span className="font-bold text-sm text-[#1F4E79]">{s === 'enterprise' ? 'Enterprise Value Only' : 'Full Entity (Equity) Value'}</span>
                  <p className="text-xs text-gray-600 mt-1">{s === 'enterprise' ? 'Operating value only (asset sales)' : 'Adjusted for surplus assets & debt (share sales)'}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button className={bp} disabled={!step1Valid} onClick={() => { markComplete(1); setStep(2) }}>Continue →</button>
          </div>
        </div>)}

        {/* ═══ STEP 2 — DATA ═════════════════════════════════════════════ */}
        {step === 2 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-2">Upload Financial Statements</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="border-2 border-dashed border-[#2E75B6] rounded-xl p-4 bg-blue-50/30">
                <p className="text-sm font-semibold text-[#1F4E79] mb-1">📄 Financial Statements</p>
                <p className="text-[10px] text-gray-500 mb-2">Upload the accountant&apos;s report (P&amp;L, Balance Sheet, Notes — can be one combined PDF or separate files)</p>
                <input type="file" accept=".pdf,.xlsx,.xls,.csv" multiple onChange={e => handleFileUpload(e, 'financial')} className="text-xs" />
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-[#2E75B6]">
                <p className="text-sm font-semibold text-[#1F4E79] mb-1">📒 General Ledger (Optional)</p>
                <p className="text-[10px] text-gray-500 mb-2">GL exports improve normalisation analysis. Excel/CSV format.</p>
                <input type="file" accept=".xlsx,.xls,.csv" multiple onChange={e => handleFileUpload(e, 'gl')} className="text-xs" />
              </div>
            </div>
            {uploadedFiles.length > 0 && (
              <div className="mb-3">
                {uploadedFiles.map((f,i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-3 py-1 mb-1">
                    <span className="font-medium">{f.name}</span><span className="text-gray-400">({f.type === 'financial' ? 'Financial Statements' : 'General Ledger'})</span>
                    <button onClick={() => setUploadedFiles(p => p.filter((_,j) => j!==i))} className="ml-auto text-red-400">✕</button>
                  </div>
                ))}
                <button className={bp+" mt-2"} onClick={parseFinancials} disabled={isProcessing}>{isProcessing ? '⏳ Parsing...' : '🤖 Parse with AI'}</button>
              </div>
            )}
            {processingMsg && step === 2 && <p className="text-sm text-[#2E75B6] font-medium">{processingMsg}</p>}
          </div>

          <div className={sc}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#1F4E79]">Financial Years</h2>
              <button className={bs} onClick={addFY}>+ Add Year</button>
            </div>
            {fyConfigs.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {fyConfigs.map(fy => (
                  <div key={fy.year} className="flex items-center gap-2 bg-[#F0F4F8] rounded-lg px-3 py-2 border border-gray-200">
                    <span className="font-bold text-sm text-[#1F4E79]">FY{fy.year}</span>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={fy.isPartYear} onChange={e => setFyConfigs(p => p.map(f => f.year===fy.year?{...f,isPartYear:e.target.checked}:f))} /> Part year</label>
                    {fy.isPartYear && <input type="number" className="w-12 text-xs border rounded px-1 py-0.5" value={fy.months} min={1} max={11} onChange={e => setFyConfigs(p => p.map(f => f.year===fy.year?{...f,months:parseInt(e.target.value)||1}:f))} />}
                    <button onClick={() => removeFY(fy.year)} className="text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {fyConfigs.length > 0 && (
            <div className={sc}>
              <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Profit & Loss Data</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#1F4E79] text-white">
                    <th className="text-left px-3 py-2 min-w-[200px]">Line Item</th>
                    <th className="text-left px-2 py-2 min-w-[100px]">Category</th>
                    {years.map(yr => <th key={yr} className="text-right px-3 py-2 min-w-[90px]">FY{yr}</th>)}
                    <th className="w-6"></th>
                  </tr></thead>
                  <tbody>
                    {(['revenue','cos','other_income','opex','depreciation','amortisation','interest','tax'] as const).map(cat => {
                      const items = plItems.filter(i => i.category===cat)
                      const labels: Record<string,string> = { revenue:'Revenue', cos:'Cost of Sales', other_income:'Other Income', opex:'Operating Expenses', depreciation:'Depreciation', amortisation:'Amortisation', interest:'Interest', tax:'Tax' }
                      return (<Fragment key={cat}>
                        <tr className="bg-gray-100 border-t"><td colSpan={years.length+3} className="px-3 py-1.5 font-bold text-[#1F4E79] text-xs">{labels[cat]} <button onClick={() => addPLItem(cat)} className="text-[10px] text-[#2E75B6] hover:underline ml-2">+ add</button></td></tr>
                        {items.map(item => (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-1"><input className="w-full border-0 bg-transparent text-xs focus:ring-1 focus:ring-[#2E75B6] rounded px-1" value={item.name} onChange={e => updatePLItem(item.id,'name',e.target.value)} placeholder="Line item" /></td>
                            <td className="px-2 py-1"><select className="text-[10px] border rounded px-1 py-0.5 bg-white" value={item.category} onChange={e => updatePLItem(item.id,'category',e.target.value)}>
                              {Object.entries(labels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                            </select></td>
                            {years.map(yr => <td key={yr} className="px-3 py-1 text-right"><input type="number" className="w-full text-right border-0 bg-transparent text-xs focus:ring-1 focus:ring-[#2E75B6] rounded px-1" value={item.amounts[yr]||''} onChange={e => updatePLItem(item.id,yr,e.target.value)} /></td>)}
                            <td><button onClick={() => removePLItem(item.id)} className="text-red-300 hover:text-red-500 text-xs">✕</button></td>
                          </tr>
                        ))}
                        <tr className="border-b border-gray-200"><td className="px-3 py-1 font-semibold text-gray-600 text-xs">Total</td><td></td>
                          {years.map(yr => <td key={yr} className="px-3 py-1 text-right font-semibold text-gray-600 text-xs">{fmt(items.reduce((s,i) => s+(i.amounts[yr]||0),0))}</td>)}<td></td>
                        </tr>
                      </Fragment>)
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="flex justify-between">
            <button className={bs} onClick={() => setStep(1)}>← Back</button>
            <button className={bp} disabled={!step2Valid} onClick={() => { markComplete(2); setStep(3) }}>Continue →</button>
          </div>
        </div>)}

        {/* ═══ STEP 3 — EBITDA ═══════════════════════════════════════════ */}
        {step === 3 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">EBITDA Calculation</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#1F4E79] text-white"><th className="text-left px-4 py-2">Item</th>{years.map(yr => <th key={yr} className="text-right px-4 py-2">FY{yr}</th>)}</tr></thead>
                <tbody>
                  {[{l:'Revenue',k:'revenue',b:false},{l:'Less: Cost of Sales',k:'cos',b:false},{l:'Gross Profit',k:'grossProfit',b:true},{l:'Other Income',k:'otherIncome',b:false},{l:'Less: Operating Expenses',k:'opex',b:false},{l:'Less: Depreciation',k:'depreciation',b:false},{l:'Less: Amortisation',k:'amortisation',b:false},{l:'Less: Interest',k:'interest',b:false},{l:'Less: Tax',k:'tax',b:false},{l:'Net Profit',k:'netProfit',b:true}].map(r => (
                    <tr key={r.k} className={`border-b border-gray-100 ${r.b?'bg-gray-50':''}`}>
                      <td className={`px-4 py-2 ${r.b?'font-bold text-[#1F4E79]':'text-gray-700'}`}>{r.l}</td>
                      {years.map(yr => <td key={yr} className={`text-right px-4 py-2 ${r.b?'font-bold text-[#1F4E79]':'text-gray-700'}`}>{fmt(ebitdaByYear[yr]?.[r.k]||0)}</td>)}
                    </tr>
                  ))}
                  <tr className="bg-[#F0F4F8] border-t-2 border-[#1F4E79]"><td className="px-4 py-2 font-bold text-[#1F4E79]">Net Profit</td>{years.map(yr => <td key={yr} className="text-right px-4 py-2 font-bold">{fmt(ebitdaByYear[yr]?.netProfit||0)}</td>)}</tr>
                  {['depreciation','amortisation','interest','tax'].map(k => (
                    <tr key={k} className="bg-[#F0F4F8]"><td className="px-4 py-2 text-gray-600 pl-8">Add: {k.charAt(0).toUpperCase()+k.slice(1)}</td>
                      {years.map(yr => <td key={yr} className="text-right px-4 py-2 text-emerald-600">{fmt(ebitdaByYear[yr]?.[k]||0)}</td>)}</tr>
                  ))}
                  <tr className="bg-[#1F4E79] text-white"><td className="px-4 py-3 font-bold">EBITDA</td>{years.map(yr => <td key={yr} className="text-right px-4 py-3 font-bold">{fmt(ebitdaByYear[yr]?.ebitda||0)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between">
            <button className={bs} onClick={() => setStep(2)}>← Back</button>
            <button className={bp} onClick={() => { markComplete(3); setStep(4) }}>Confirm & Continue →</button>
          </div>
        </div>)}

        {/* ═══ STEP 4 — NORMALISATION ════════════════════════════════════ */}
        {step === 4 && (<div className="space-y-6">
          <div className={sc}>
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-lg font-bold text-[#1F4E79]">Normalisation Adjustments</h2><p className="text-xs text-gray-500">Adjust for discretionary, non-recurring and personal expenses</p></div>
              <button className={bp} onClick={analyseNormalisation} disabled={isProcessing}>{isProcessing ? '⏳...' : '🤖 AI Analysis'}</button>
            </div>
            {processingMsg && step===4 && <p className="text-sm text-[#2E75B6] mb-3">{processingMsg}</p>}
            <div className="mb-3 p-3 bg-gray-50 rounded-lg border flex gap-2 flex-wrap">
              {Object.entries(NORM_CATEGORIES).map(([k,v]) => (
                <button key={k} className="text-[10px] px-2 py-1 rounded border border-gray-300 hover:bg-[#F0F4F8]"
                  onClick={() => setNormItems(p => [...p, { id: genId(), lineItemName: '', category: k as any, amounts: Object.fromEntries(years.map(yr=>[yr,0])), recommendedTreatment: 'add_back', aiReasoning: '', userDecision: 'accept', userAmount: Object.fromEntries(years.map(yr=>[yr,0])), userReasoning: '' }])}>+ {v}</button>
              ))}
            </div>
            {normItems.map(item => (
              <div key={item.id} className={`rounded-xl border-2 p-4 mb-3 ${item.userDecision==='accept'?'border-emerald-200 bg-emerald-50/50':item.userDecision==='reject'?'border-gray-200 bg-gray-50 opacity-60':'border-amber-200 bg-amber-50/50'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1F4E79] text-white">{NORM_CATEGORIES[item.category]}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{NORM_TREATMENTS[item.recommendedTreatment]}</span>
                    </div>
                    <input className="text-sm font-semibold text-gray-800 border-0 bg-transparent w-full focus:ring-1 focus:ring-[#2E75B6] rounded px-1" value={item.lineItemName} onChange={e => setNormItems(p => p.map(n => n.id===item.id?{...n,lineItemName:e.target.value}:n))} placeholder="Item name" />
                    {item.aiReasoning && <p className="text-xs text-gray-600 mt-1 italic">{item.aiReasoning}</p>}
                    <div className="flex gap-3 mt-2">{years.map(yr => (
                      <div key={yr}><label className="text-[10px] text-gray-400">FY{yr}</label>
                        <input type="number" className="block w-20 text-xs text-right border rounded px-2 py-1 bg-white" value={item.userDecision==='modify'?(item.userAmount[yr]||''):(item.amounts[yr]||'')}
                          onChange={e => setNormItems(p => p.map(n => n.id===item.id?{...n,userDecision:'modify',userAmount:{...n.userAmount,[yr]:parseFloat(e.target.value)||0}}:n))} />
                      </div>
                    ))}</div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {(['accept','reject','modify'] as const).map(d => (
                      <button key={d} className={`text-[10px] px-3 py-1 rounded-lg font-semibold ${item.userDecision===d?(d==='accept'?'bg-emerald-600 text-white':d==='reject'?'bg-gray-600 text-white':'bg-amber-500 text-white'):'bg-gray-200 text-gray-500'}`}
                        onClick={() => setNormItems(p => p.map(n => n.id===item.id?{...n,userDecision:d,...(d==='modify'?{userAmount:{...n.amounts}}:{})}:n))}>{d.charAt(0).toUpperCase()+d.slice(1)}</button>
                    ))}
                    <button className="text-[10px] px-3 py-1 text-red-400 hover:text-red-600" onClick={() => setNormItems(p => p.filter(n => n.id!==item.id))}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {normItems.length > 0 && (
            <div className={sc}>
              <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Normalised EBITDA</h2>
              <table className="w-full text-sm"><thead><tr className="bg-[#1F4E79] text-white"><th className="text-left px-4 py-2">Item</th>{years.map(yr => <th key={yr} className="text-right px-4 py-2">FY{yr}</th>)}</tr></thead>
                <tbody>
                  <tr className="bg-gray-50"><td className="px-4 py-2 font-semibold">Reported EBITDA</td>{years.map(yr => <td key={yr} className="text-right px-4 py-2 font-semibold">{fmt(ebitdaByYear[yr]?.ebitda||0)}</td>)}</tr>
                  {normItems.filter(n => n.userDecision!=='reject').map(item => (
                    <tr key={item.id} className="border-b border-gray-100"><td className="px-4 py-1.5 text-gray-600 pl-8">{item.recommendedTreatment==='add_back'?'+':'-'} {item.lineItemName}</td>
                      {years.map(yr => { const a = item.userDecision==='modify'?(item.userAmount[yr]||0):(item.amounts[yr]||0); return <td key={yr} className={`text-right px-4 py-1.5 ${item.recommendedTreatment==='add_back'?'text-emerald-600':'text-red-600'}`}>{fmt(a)}</td> })}</tr>
                  ))}
                  <tr className="bg-[#1F4E79] text-white"><td className="px-4 py-3 font-bold">Normalised EBITDA</td>{years.map(yr => <td key={yr} className="text-right px-4 py-3 font-bold">{fmt(normalisedEbitdaByYear[yr]||0)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-between">
            <button className={bs} onClick={() => setStep(3)}>← Back</button>
            <button className={bp} onClick={() => { markComplete(4); if (engagement.valuationScope==='equity') setStep(5); else { markComplete(5); initWeights(); setStep(6) } }}>
              {engagement.valuationScope==='equity' ? 'Continue to Balance Sheet →' : 'Skip to Weighting →'}
            </button>
          </div>
        </div>)}

        {/* ═══ STEP 5 — BALANCE SHEET ════════════════════════════════════ */}
        {step === 5 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-2">Balance Sheet Review & Classification</h2>
            <p className="text-xs text-gray-500 mb-1">Classify each item as <strong>Operating</strong> (needed to earn EBITDA), <strong>Surplus</strong> (added to enterprise value), or <strong>Debt</strong> (deducted). Adjust book values to estimated market values where appropriate.</p>
            <p className="text-xs text-amber-600 mb-4">⚠️ Operating assets are already valued within the enterprise value (the multiple prices them in). Only surplus assets are added separately.</p>
            
            {bsItems.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p>No balance sheet data loaded. Go back to Step 2 to upload or enter balance sheet data.</p>
                <button className={bs+" mt-3"} onClick={() => {
                  // Add manual BS entry
                  const defaults = ['Cash & Bank','Trade Debtors','Stock','Plant & Equipment','Trade Creditors','Finance Loans','Employee Provisions']
                  const sections: BSLineItem['section'][] = ['current_asset','current_asset','current_asset','fixed_asset','current_liability','current_liability','current_liability']
                  setBsItems(defaults.map((name, i) => ({ id: genId(), name, section: sections[i], amounts: {}, adjustedValue: 0, classification: sections[i].includes('liability') ? (name.includes('Finance') ? 'debt' : 'operating') : 'operating', userNotes: '' })))
                }}>+ Add Default Balance Sheet Items</button>
              </div>
            )}

            {bsItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#1F4E79] text-white">
                    <th className="text-left px-3 py-2 min-w-[180px]">Item</th>
                    <th className="text-left px-2 py-2">Section</th>
                    <th className="text-right px-3 py-2">Book Value</th>
                    <th className="text-right px-3 py-2">Adjusted Value</th>
                    <th className="text-left px-2 py-2">Classification</th>
                    <th className="text-left px-2 py-2 min-w-[120px]">Notes</th>
                  </tr></thead>
                  <tbody>
                    {bsItems.map(item => {
                      const latestYr = years[0] || ''
                      const bookVal = item.amounts[latestYr] || 0
                      return (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-1.5 font-medium text-gray-800">{item.name}</td>
                          <td className="px-2 py-1.5 text-gray-500 text-[10px]">{item.section.replace(/_/g,' ')}</td>
                          <td className="px-3 py-1.5 text-right text-gray-600">{fmt(bookVal)}</td>
                          <td className="px-3 py-1.5 text-right">
                            <input type="number" className="w-24 text-right text-xs border rounded px-2 py-1 bg-white" value={item.adjustedValue || bookVal || ''} onChange={e => setBsItems(p => p.map(b => b.id===item.id?{...b,adjustedValue:parseFloat(e.target.value)||0}:b))} />
                          </td>
                          <td className="px-2 py-1.5">
                            <select className="text-[10px] border rounded px-1 py-0.5 bg-white" value={item.classification} onChange={e => setBsItems(p => p.map(b => b.id===item.id?{...b,classification:e.target.value as any}:b))}>
                              <option value="operating">Operating</option>
                              <option value="surplus">Surplus</option>
                              <option value="debt">Debt</option>
                            </select>
                          </td>
                          <td className="px-2 py-1.5"><input className="w-full text-[10px] border rounded px-1 py-0.5 bg-white" value={item.userNotes} onChange={e => setBsItems(p => p.map(b => b.id===item.id?{...b,userNotes:e.target.value}:b))} placeholder="Notes..." /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {bsItems.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                  <p className="text-[10px] text-blue-600 font-medium">Surplus Assets</p>
                  <p className="text-lg font-bold text-blue-800">{fmt(bsItems.filter(b => b.classification==='surplus').reduce((s,b) => s+(b.adjustedValue||(b.amounts[years[0]]||0)),0))}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                  <p className="text-[10px] text-red-600 font-medium">Net Debt</p>
                  <p className="text-lg font-bold text-red-800">{fmt(bsItems.filter(b => b.classification==='debt').reduce((s,b) => s+Math.abs(b.adjustedValue||(b.amounts[years[0]]||0)),0))}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-center">
                  <p className="text-[10px] text-gray-600 font-medium">Working Capital Adj</p>
                  <input type="number" className="w-28 text-center text-sm border rounded px-2 py-1 bg-white mx-auto block mt-1" value={workingCapitalAdj||''} onChange={e => setWorkingCapitalAdj(parseFloat(e.target.value)||0)} placeholder="0" />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <button className={bs} onClick={() => setStep(4)}>← Back</button>
            <button className={bp} onClick={() => { markComplete(5); initWeights(); setStep(6) }}>Continue to Weighting →</button>
          </div>
        </div>)}

        {/* ═══ STEP 6 — WEIGHTING ════════════════════════════════════════ */}
        {step === 6 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Future Maintainable Earnings (FME)</h2>
            <p className="text-xs text-gray-500 mb-4">Weight each year&apos;s normalised EBITDA to derive the FME. More recent years typically receive higher weight unless there&apos;s a reason to adjust.</p>
            
            {/* EBITDA bar visual */}
            <div className="flex items-end gap-4 mb-6 h-32">
              {years.map(yr => {
                const val = normalisedEbitdaByYear[yr] || 0
                const maxVal = Math.max(...years.map(y => Math.abs(normalisedEbitdaByYear[y]||0)), 1)
                const h = Math.max(Math.abs(val) / maxVal * 100, 4)
                return (
                  <div key={yr} className="flex-1 flex flex-col items-center">
                    <span className={`text-xs font-bold mb-1 ${val < 0 ? 'text-red-600' : 'text-[#1F4E79]'}`}>{fmtK(val)}</span>
                    <div className={`w-full rounded-t-lg ${val < 0 ? 'bg-red-400' : 'bg-[#2E75B6]'}`} style={{height: `${h}%`}} />
                    <span className="text-[10px] text-gray-500 mt-1">FY{yr}</span>
                  </div>
                )
              })}
            </div>

            {/* Context input */}
            <div className="mb-4">
              <label className={lbl}>Context for any unusual years</label>
              <textarea className={ta} rows={3} value={weightContext} onChange={e => setWeightContext(e.target.value)} placeholder="e.g. FY2023 EBITDA was lower because we lost a major customer who has since been replaced..." />
              <button className={bp+" mt-2"} onClick={analyseWeighting} disabled={isProcessing}>{isProcessing ? '⏳...' : '🤖 AI Weighting Analysis'}</button>
            </div>

            {aiWeightReasoning && <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4"><p className="text-xs text-blue-800 font-medium mb-1">AI Recommendation:</p><p className="text-xs text-blue-700">{aiWeightReasoning}</p></div>}

            {/* Weight sliders */}
            <div className="space-y-3">
              {weights.map(w => (
                <div key={w.year} className="flex items-center gap-4">
                  <span className="w-16 text-sm font-bold text-[#1F4E79]">FY{w.year}</span>
                  <span className="w-24 text-xs text-gray-600 text-right">{fmt(normalisedEbitdaByYear[w.year]||0)}</span>
                  <input type="range" className="flex-1" min={0} max={100} value={w.weight} onChange={e => {
                    const newW = parseInt(e.target.value)
                    setWeights(prev => prev.map(pw => pw.year===w.year?{...pw,weight:newW}:pw))
                  }} />
                  <input type="number" className="w-16 text-xs text-center border rounded px-1 py-0.5" value={w.weight} onChange={e => setWeights(prev => prev.map(pw => pw.year===w.year?{...pw,weight:parseInt(e.target.value)||0}:pw))} />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              ))}
              <div className="flex items-center gap-4 pt-2 border-t">
                <span className="w-16 text-sm font-bold">Total</span>
                <span className="w-24"></span>
                <div className="flex-1"></div>
                <span className={`text-sm font-bold ${weights.reduce((s,w) => s+w.weight,0) === 100 ? 'text-emerald-600' : 'text-red-600'}`}>{weights.reduce((s,w) => s+w.weight,0)}%</span>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-[#1F4E79] text-white text-center">
              <p className="text-sm">Future Maintainable Earnings (FME)</p>
              <p className="text-3xl font-bold mt-1">{fmt(fme)}</p>
            </div>
          </div>
          <div className="flex justify-between">
            <button className={bs} onClick={() => setStep(engagement.valuationScope==='equity'?5:4)}>← Back</button>
            <button className={bp} disabled={weights.reduce((s,w) => s+w.weight,0)!==100} onClick={() => { markComplete(6); setStep(7) }}>Continue to Risk Analysis →</button>
          </div>
        </div>)}

        {/* ═══ STEP 7 — RISK & MULTIPLE ══════════════════════════════════ */}
        {step === 7 && (<div className="space-y-6">
          <div className={sc}>
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-lg font-bold text-[#1F4E79]">Risk Analysis & EBITDA Multiple</h2><p className="text-xs text-gray-500">Score each factor 0 (lowest risk) to 10 (highest risk)</p></div>
              <button className={bp} onClick={analyseRisk} disabled={isProcessing}>{isProcessing ? '⏳...' : '🤖 AI Risk Scoring'}</button>
            </div>
            
            <div className="space-y-4">
              {riskFactors.map(f => (
                <div key={f.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div><p className="font-bold text-sm text-[#1F4E79]">{f.name}</p><p className="text-[10px] text-gray-500">{f.description}</p><p className="text-[10px] text-gray-400 italic">{f.guidance}</p></div>
                  </div>
                  {f.aiReasoning && <p className="text-xs text-blue-700 bg-blue-50 rounded p-2 mb-2">{f.aiReasoning}</p>}
                  <div className="flex gap-6">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500">Low (optimistic)</label>
                      <div className="flex items-center gap-2">
                        <input type="range" className="flex-1" min={0} max={10} step={0.5} value={f.scoreLow} onChange={e => setRiskFactors(p => p.map(rf => rf.id===f.id?{...rf,scoreLow:parseFloat(e.target.value)}:rf))} />
                        <span className="text-sm font-bold w-8 text-center">{f.scoreLow}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500">High (conservative)</label>
                      <div className="flex items-center gap-2">
                        <input type="range" className="flex-1" min={0} max={10} step={0.5} value={f.scoreHigh} onChange={e => setRiskFactors(p => p.map(rf => rf.id===f.id?{...rf,scoreHigh:parseFloat(e.target.value)}:rf))} />
                        <span className="text-sm font-bold w-8 text-center">{f.scoreHigh}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-gray-100 text-center">
                <p className="text-[10px] text-gray-500">Composite Risk Score</p>
                <p className="text-xl font-bold text-[#1F4E79]">{compositeScoreLow.toFixed(1)} – {compositeScoreHigh.toFixed(1)}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#F0F4F8] text-center border border-[#2E75B6]">
                <p className="text-[10px] text-[#2E75B6]">EBITDA Multiple Range</p>
                <p className="text-xl font-bold text-[#1F4E79]">{multipleLow.toFixed(1)}x – {multipleHigh.toFixed(1)}x</p>
              </div>
              <div className="p-4 rounded-xl bg-[#1F4E79] text-center text-white">
                <p className="text-[10px] text-blue-200">Enterprise Value Range</p>
                <p className="text-xl font-bold">{fmtK(fme * multipleLow)} – {fmtK(fme * multipleHigh)}</p>
              </div>
            </div>
          </div>

          {industryAnalysis && (
            <div className={sc}>
              <h2 className="text-lg font-bold text-[#1F4E79] mb-2">Industry Analysis (AI Generated)</h2>
              <p className="text-xs text-gray-600 whitespace-pre-line">{industryAnalysis}</p>
            </div>
          )}

          <div className="flex justify-between">
            <button className={bs} onClick={() => setStep(6)}>← Back</button>
            <button className={bp} onClick={() => { markComplete(7); setStep(8) }}>Continue to Valuation →</button>
          </div>
        </div>)}

        {/* ═══ STEP 8 — VALUATION ════════════════════════════════════════ */}
        {step === 8 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-4">Valuation Summary</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b"><td className="py-2 text-gray-600">Future Maintainable Earnings (FME)</td><td className="text-right py-2 font-bold">{fmt(fme)}</td></tr>
                <tr className="border-b"><td className="py-2 text-gray-600">EBITDA Multiple Range</td><td className="text-right py-2 font-bold">{multipleLow.toFixed(1)}x – {multipleHigh.toFixed(1)}x</td></tr>
                <tr className="border-b bg-blue-50"><td className="py-2 font-semibold text-[#1F4E79] px-2">Enterprise Value</td><td className="text-right py-2 font-bold text-[#1F4E79] px-2">{fmt(valuation.evLow)} – {fmt(valuation.evHigh)}</td></tr>
                {engagement.valuationScope === 'equity' && (<>
                  {workingCapitalAdj !== 0 && <tr className="border-b"><td className="py-2 text-gray-600 pl-6">Less: Working Capital Adjustment</td><td className="text-right py-2 text-red-600">({fmt(workingCapitalAdj)})</td></tr>}
                  <tr className="border-b"><td className="py-2 text-gray-600 pl-6">Plus: Surplus Assets</td><td className="text-right py-2 text-emerald-600">{fmt(valuation.surplusAssets)}</td></tr>
                  <tr className="border-b"><td className="py-2 text-gray-600 pl-6">Less: Net Debt</td><td className="text-right py-2 text-red-600">({fmt(valuation.netDebt)})</td></tr>
                  <tr className="bg-[#1F4E79] text-white"><td className="py-3 font-bold px-2">Equity Value</td><td className="text-right py-3 font-bold px-2">{fmt(valuation.eqLow)} – {fmt(valuation.eqHigh)}</td></tr>
                  <tr className="bg-[#2E75B6] text-white"><td className="py-3 font-bold px-2">Midpoint (Most Likely Value)</td><td className="text-right py-3 font-bold text-xl px-2">{fmt(valuation.eqMid)}</td></tr>
                </>)}
                {engagement.valuationScope === 'enterprise' && (
                  <tr className="bg-[#2E75B6] text-white"><td className="py-3 font-bold px-2">Midpoint Enterprise Value</td><td className="text-right py-3 font-bold text-xl px-2">{fmt((valuation.evLow+valuation.evHigh)/2)}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cross-checks */}
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Cross-Checks</h2>
            {valuation.floorExceeded && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-lg mb-3">
                <p className="text-sm font-bold text-red-700">⚠️ Equipment Floor Value Warning</p>
                <p className="text-xs text-red-600">Realisable tangible assets ({fmt(valuation.equipmentFloor)}) exceed the enterprise value ({fmt(valuation.evHigh)}). Consider whether a going concern basis is appropriate.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-500">Implied Revenue Multiple</p>
                <p className="text-sm font-bold">{valuation.impliedRevMultLow.toFixed(2)}x – {valuation.impliedRevMultHigh.toFixed(2)}x</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-500">Equipment Floor Value</p>
                <p className="text-sm font-bold">{fmt(valuation.equipmentFloor)}</p>
              </div>
            </div>
          </div>

          {/* Sensitivity */}
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Sensitivity Matrix</h2>
            <table className="w-full text-xs">
              <thead><tr className="bg-[#1F4E79] text-white">
                <th className="px-3 py-2">FME ↓ / Multiple →</th>
                <th className="text-right px-3 py-2">{multipleLow.toFixed(1)}x (Low)</th>
                <th className="text-right px-3 py-2">{((multipleLow+multipleHigh)/2).toFixed(1)}x (Mid)</th>
                <th className="text-right px-3 py-2">{multipleHigh.toFixed(1)}x (High)</th>
              </tr></thead>
              <tbody>
                {['Conservative','Base','Optimistic'].map((label, i) => (
                  <tr key={label} className={`border-b ${i===1?'bg-[#F0F4F8] font-bold':''}`}>
                    <td className="px-3 py-2">{label} ({fmt(fme*(i===0?0.85:i===1?1:1.15))})</td>
                    {sensitivity[i].map((v,j) => <td key={j} className={`text-right px-3 py-2 ${i===1&&j===1?'text-[#1F4E79] font-bold':''}`}>{fmt(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Discounts */}
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Discount Considerations</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg">
                <label className="flex items-center gap-2 mb-2"><input type="checkbox" checked={discounts.applyMinority} onChange={e => setDiscounts(p => ({...p,applyMinority:e.target.checked}))} /><span className="text-sm font-semibold text-gray-700">Minority Discount</span></label>
                {discounts.applyMinority && <div><input type="number" className="w-20 text-xs border rounded px-2 py-1" value={discounts.minorityDiscount} onChange={e => setDiscounts(p => ({...p,minorityDiscount:parseFloat(e.target.value)||0}))} /> %
                  <input className="w-full text-xs border rounded px-2 py-1 mt-1" value={discounts.minorityReasoning} onChange={e => setDiscounts(p => ({...p,minorityReasoning:e.target.value}))} placeholder="Reasoning..." /></div>}
              </div>
              <div className="p-3 border rounded-lg">
                <label className="flex items-center gap-2 mb-2"><input type="checkbox" checked={discounts.applyMarketability} onChange={e => setDiscounts(p => ({...p,applyMarketability:e.target.checked}))} /><span className="text-sm font-semibold text-gray-700">Marketability Discount</span></label>
                {discounts.applyMarketability && <div><input type="number" className="w-20 text-xs border rounded px-2 py-1" value={discounts.marketabilityDiscount} onChange={e => setDiscounts(p => ({...p,marketabilityDiscount:parseFloat(e.target.value)||0}))} /> %
                  <input className="w-full text-xs border rounded px-2 py-1 mt-1" value={discounts.marketabilityReasoning} onChange={e => setDiscounts(p => ({...p,marketabilityReasoning:e.target.value}))} placeholder="Reasoning..." /></div>}
              </div>
            </div>
            {(discounts.applyMinority || discounts.applyMarketability) && (
              <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                <p className="text-sm font-semibold text-amber-800">Adjusted Value After Discounts: {fmt(valuation.finalLow)} – {fmt(valuation.finalHigh)}</p>
                <p className="text-xs text-amber-600">Midpoint: {fmt(valuation.finalMid)}</p>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button className={bs} onClick={() => setStep(7)}>← Back</button>
            <button className={bp} onClick={() => { markComplete(8); setStep(9) }}>Continue to Report Generation →</button>
          </div>
        </div>)}

        {/* ═══ STEP 9 — REPORT ═══════════════════════════════════════════ */}
        {step === 9 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Report Generation</h2>
            <p className="text-xs text-gray-500 mb-4">Generate a comprehensive DOCX valuation report based on all inputs and calculations from the preceding steps.</p>

            <div className="p-6 rounded-xl bg-[#F0F4F8] border border-[#2E75B6] text-center">
              <p className="text-xl font-bold text-[#1F4E79] mb-2">Valuation Opinion</p>
              <p className="text-sm text-gray-600 mb-4">
                Based on the capitalisation of future maintainable earnings method, we estimate the fair market value of {engagement.businessName} as at {engagement.valuationDate} to be in the range of:
              </p>
              <p className="text-3xl font-bold text-[#1F4E79]">
                {engagement.valuationScope === 'equity' ? `${fmt(valuation.finalLow)} – ${fmt(valuation.finalHigh)}` : `${fmt(valuation.evLow)} – ${fmt(valuation.evHigh)}`}
              </p>
              <p className="text-lg font-semibold text-[#2E75B6] mt-2">
                Most likely value: {engagement.valuationScope === 'equity' ? fmt(valuation.finalMid) : fmt((valuation.evLow+valuation.evHigh)/2)}
              </p>
            </div>

            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-semibold text-amber-800 mb-2">📄 Report Generation (Phase 3)</p>
              <p className="text-xs text-amber-700">DOCX report generation will be added in the next build phase. The report will include: executive summary, industry analysis, financial performance tables, normalisation schedule, risk analysis matrix, valuation workings, cross-checks, sensitivity analysis, disclaimers, and appendices.</p>
              <p className="text-xs text-amber-600 mt-2">For now, you can use the data from all steps above to prepare your report manually or take screenshots of each step.</p>
            </div>
          </div>
          <div className="flex justify-start">
            <button className={bs} onClick={() => setStep(8)}>← Back to Valuation</button>
          </div>
        </div>)}
      </div>

      {/* Footer */}
      <div className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-gray-400">BAKR Business Valuation Tool — Consultants for Accountants Pty Ltd</p>
          <p className="text-[10px] text-gray-300 mt-1">This tool provides an estimate only and does not constitute formal valuation advice.</p>
        </div>
      </div>
    </div>
  )
}
