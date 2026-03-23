/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useCallback, useMemo, Fragment } from 'react'

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-bold text-[#1F4E79]">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4 text-sm text-gray-700 leading-relaxed space-y-3">{children}</div>
      </div>
    </div>
  )
}

// Blue pill for novice explanations — large and obvious
function HelpBtn({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs text-[#2E75B6] hover:bg-blue-100 hover:border-blue-300 font-medium transition shadow-sm" title={label || 'What is this?'}>
      <span className="text-sm">💡</span>
      <span>{label || 'Help'}</span>
    </button>
  )
}

// Green pill for accountant workings — large and obvious
function WorkingsBtn({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 font-medium transition shadow-sm" title={label || 'View workings'}>
      <span className="text-sm">🔢</span>
      <span>{label || 'Workings'}</span>
    </button>
  )
}


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
  classification: 'in_ev' | 'transfer_asset' | 'transfer_liability' | 'surplus' | 'debt' | 'goodwill'
  userNotes: string
  children?: { name: string; amount: number }[]
  expanded?: boolean
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
  { id: 'revenue', name: 'Revenue Growth & Maintainability', description: 'How consistent is the revenue, and is it likely to continue? A business with long-term contracts and recurring revenue scores low; one that relies on winning new work each month scores high.', guidance: '← Slide left for lower risk (strong growth, contracted revenue) — Slide right for higher risk (declining, volatile) →', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
  { id: 'financial', name: 'Financial Risk', description: 'How healthy is the balance sheet? Consider debt levels, cash reserves, and whether the business can comfortably meet its obligations. A debt-free business with cash reserves is very low risk.', guidance: '← Slide left for lower risk (no debt, strong cash) — Slide right for higher risk (heavily leveraged, tight cash) →', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
  { id: 'keyman', name: 'Key Person Risk', description: 'Would the business survive and maintain its revenue if the owner or key person left? Consider whether relationships, technical skills, or licences are held by one individual. Systems and documented processes reduce this risk.', guidance: '← Slide left for lower risk (strong team, systems in place) — Slide right for higher risk (owner IS the business) →', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
  { id: 'customer', name: 'Customer Concentration Risk', description: 'Is revenue spread across many customers, or does one or two customers dominate? Losing a customer that represents 30%+ of revenue could be catastrophic. A broad customer base with no single customer over 10% is low risk.', guidance: '← Slide left for lower risk (many customers, none dominant) — Slide right for higher risk (one customer >30%) →', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
  { id: 'profitability', name: 'Profitability Risk', description: 'Are margins consistent and healthy, or thin and volatile? A business with a stable 20%+ EBITDA margin year after year is predictable. One with margins that swing from 15% to 2% is risky even if the average is acceptable.', guidance: '← Slide left for lower risk (high, stable margins) — Slide right for higher risk (thin, volatile margins) →', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
  { id: 'competitive', name: 'Competitive / Industry Risk', description: 'How competitive is the market and how strong is the business\'s position in it? Consider barriers to entry, regulatory protection, brand strength, and whether the industry is growing or contracting. A niche market leader with barriers to entry scores low.', guidance: '← Slide left for lower risk (dominant, protected position) — Slide right for higher risk (crowded market, no moat) →', weight: 16.7, scoreLow: 5, scoreHigh: 5, aiReasoning: '' },
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
    if (!res.ok) {
      const errText = await res.text()
      console.error('callOpus error:', res.status, errText)
      return JSON.stringify({ error: `API error ${res.status}` })
    }
    const data = await res.json()
    if (data.error) {
      console.error('callOpus API error:', data.error, data.details)
      return JSON.stringify({ error: data.error })
    }
    const text = data.content?.[0]?.text || ''
    console.log('callOpus response (first 300):', text.substring(0, 300))
    return text
  } catch (err: any) { console.error('Opus:', err); return JSON.stringify({ error: err.message }) }
}

// Helper to clean and parse JSON from AI responses
function cleanJSON(text: string): any {
  // Strip markdown fences
  let clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  // If response starts with non-JSON text, try to find the JSON
  if (!clean.startsWith('{') && !clean.startsWith('[')) {
    const jsonStart = clean.search(/[\[{]/)
    if (jsonStart >= 0) clean = clean.substring(jsonStart)
  }
  // If it ends with non-JSON text, try to find the end
  const lastBrace = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'))
  if (lastBrace >= 0) clean = clean.substring(0, lastBrace + 1)
  return JSON.parse(clean)
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

  // Modal state
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const m = useCallback((id: string) => () => setActiveModal(id), [])
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
    const latestYr = years[0] || ''

    // Balance sheet analysis with new classification system
    let transferAssets = 0, transferLiabilities = 0, surplusAssets = 0, netDebt = 0, inEvAssets = 0

    for (const item of bsItems) {
      const val = item.adjustedValue || (item.amounts[latestYr] || 0)
      switch (item.classification) {
        case 'in_ev': inEvAssets += val; break
        case 'transfer_asset': transferAssets += val; break
        case 'transfer_liability': transferLiabilities += Math.abs(val); break
        case 'surplus': surplusAssets += val; break
        case 'debt': netDebt += Math.abs(val); break
        // 'goodwill' — excluded, replaced by derived goodwill
      }
    }

    const netTransferring = transferAssets - transferLiabilities
    const netBsAdjustment = netTransferring + surplusAssets - netDebt

    const eqLow = evLow + netBsAdjustment
    const eqHigh = evHigh + netBsAdjustment
    const eqMid = (eqLow + eqHigh) / 2

    // Apply discounts
    let discFactor = 1
    if (discounts.applyMinority) discFactor *= (1 - discounts.minorityDiscount / 100)
    if (discounts.applyMarketability) discFactor *= (1 - discounts.marketabilityDiscount / 100)

    const finalLow = eqLow * discFactor
    const finalHigh = eqHigh * discFactor
    const finalMid = (finalLow + finalHigh) / 2

    // Equipment floor check — total realisable value of all tangible assets
    const equipmentFloor = inEvAssets
    const floorExceeded = equipmentFloor > evHigh && equipmentFloor > 0

    // Implied revenue multiple
    const latestRevenue = ebitdaByYear[latestYr]?.revenue || 0
    const impliedRevMultLow = latestRevenue > 0 ? evLow / latestRevenue : 0
    const impliedRevMultHigh = latestRevenue > 0 ? evHigh / latestRevenue : 0

    return {
      evLow, evHigh, transferAssets, transferLiabilities, netTransferring,
      surplusAssets, netDebt, netBsAdjustment,
      eqLow, eqHigh, eqMid, finalLow, finalHigh, finalMid,
      equipmentFloor, floorExceeded, impliedRevMultLow, impliedRevMultHigh, discFactor, inEvAssets
    }
  }, [fme, multipleLow, multipleHigh, bsItems, years, ebitdaByYear, discounts])

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

  const handleDrop = useCallback((e: React.DragEvent, fileType: string) => {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setUploadedFiles(prev => [...prev, { name: file.name, type: fileType, fy: 'auto', data: ev.target?.result as string }])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const preventDefaults = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }, [])

  const parseFinancials = useCallback(async () => {
    if (uploadedFiles.length === 0) return
    setIsProcessing(true)
    setProcessingMsg('Extracting text from documents...')

    // Extract text from all uploaded PDFs client-side
    let allText = ''
    const failedFiles: string[] = []
    for (const file of uploadedFiles) {
      if (file.data.startsWith('data:')) {
        const mimeMatch = file.data.match(/data:([^;]+);/)
        const mediaType = mimeMatch ? mimeMatch[1] : ''
        if (mediaType === 'application/pdf') {
          try {
            const pdfText = await extractPdfText(file.data)
            // Check if extracted text is mostly garbled (encoded fonts)
            const readableChars = pdfText.replace(/[^a-zA-Z0-9\s.,;:$%()-]/g, '')
            if (readableChars.length < pdfText.length * 0.3) {
              failedFiles.push(file.name)
              allText += `\n\n=== FILE: ${file.name} (text unreadable — encoded fonts) ===`
            } else {
              allText += `\n\n=== FILE: ${file.name} ===\n${pdfText}`
            }
          } catch (e: any) {
            console.error('PDF extraction error:', e)
            failedFiles.push(file.name)
            allText += `\n\n=== FILE: ${file.name} (could not extract text) ===`
          }
        } else {
          allText += `\n\n=== FILE: ${file.name} (non-PDF, please enter data manually) ===`
        }
      }
    }

    if (failedFiles.length > 0) {
      setProcessingMsg(`⚠️ Could not read text from: ${failedFiles.join(', ')}. These files may use embedded fonts that cannot be extracted. Data from readable files will be parsed — you can add missing years manually afterwards.`)
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
    {"name": "Line item name", "section": "current_asset|fixed_asset|non_current_asset|current_liability|non_current_liability|equity", "amounts": {"2024": 1000, "2023": 2000}, "children": [{"name": "Sub-item from Notes", "amount": 500}]}
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
- IMPORTANT: For each balance sheet item, if the Notes to the Financial Statements provide a breakdown (e.g. Note 4 Cash shows individual bank accounts, Note 5 shows Stock and WIP, Note 6 shows PP&E categories, Note 9 shows provision types), include these as "children" array with name and most recent year amount. This lets the user see what is inside each line.
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
      const p = cleanJSON(text)
      if (p.plItems) setPlItems(p.plItems.map((i: any) => ({ ...i, id: genId() })))
      if (p.bsItems) setBsItems(p.bsItems.map((i: any) => {
            const nm = (i.name || '').toLowerCase()
            const sec = i.section || ''
            let cls: BSLineItem['classification'] = 'transfer_asset'
            // Interest-bearing debt
            if (nm.includes('borrow') || nm.includes('loan') || nm.includes('finance') || nm.includes('hire purchase') || nm.includes('lease liab')) cls = 'debt'
            // Goodwill / intangibles
            else if (nm.includes('goodwill') || nm.includes('intangible')) cls = 'goodwill'
            // Fixed assets used in operations → in enterprise value
            else if (sec === 'fixed_asset' || (nm.includes('plant') && nm.includes('equipment')) || nm.includes('motor vehicle') || nm.includes('leasehold')) cls = 'in_ev'
            // Equity items → exclude
            else if (sec === 'equity') cls = 'goodwill'
            // Liabilities (non-debt) → transfer
            else if (sec.includes('liability')) cls = 'transfer_liability'
            // Current assets → transfer to buyer
            else cls = 'transfer_asset'
            return { ...i, id: genId(), adjustedValue: 0, classification: cls, userNotes: '', children: i.children || [], expanded: false }
          }))
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
    const sys = `You are an Australian CA doing business valuation normalisation analysis. Flag discretionary, non-recurring, personal, owner compensation and non-operating items. Be thorough but conservative. Return ONLY a JSON array (no explanation, no markdown): [{"lineItemName":"...","category":"owner_comp|related_party|personal_discretionary|non_recurring|non_operating","amounts":{"2024":0},"recommendedTreatment":"add_back|deduct|adjust_to_market|leave","aiReasoning":"..."}]`
    const usr = `Business: ${engagement.businessName}, Industry: ${engagement.industrySector}, Employees: ${engagement.employees}, Method: ${engagement.valuationMethod}\n\nP&L items:\n${plSummary}\n\nDescription: ${engagement.businessDescription}`
    try {
      const r = await callOpus(sys, usr)
      const p = cleanJSON(r)
      const items = Array.isArray(p) ? p : (p.items || p.adjustments || [])
      setNormItems(items.map((i: any) => ({ ...i, id: genId(), userDecision: i.recommendedTreatment === 'leave' ? 'reject' : 'accept', userAmount: i.amounts || {}, userReasoning: '' })))
      setProcessingMsg(`Analysis complete: ${items.length} items flagged.`)
    } catch (err: any) {
      console.error('Normalisation parse error:', err)
      setProcessingMsg(`AI analysis returned non-standard format. Add items manually. (${err.message})`)
    }
    setIsProcessing(false)
  }, [plItems, years, engagement])

  const analyseWeighting = useCallback(async () => {
    setIsProcessing(true)
    setProcessingMsg('Analysing EBITDA pattern for optimal weighting...')
    const ebitdaSeries = years.map(yr => `FY${yr}: ${fmt(normalisedEbitdaByYear[yr] || 0)}`).join(', ')
    const sys = `You are an Australian CA determining EBITDA weightings for a business valuation. Consider: trends, anomalies, user context. Return ONLY JSON (no explanation, no markdown): {"weights":[{"year":"2024","weight":40},...],"reasoning":"..."}`
    const usr = `Normalised EBITDA: ${ebitdaSeries}\nUser context: ${weightContext || 'No additional context provided'}\nBusiness: ${engagement.businessName}, Industry: ${engagement.industrySector}`
    try {
      const r = await callOpus(sys, usr)
      const p = cleanJSON(r)
      if (p.weights) setWeights(p.weights)
      if (p.reasoning) setAiWeightReasoning(p.reasoning)
      setProcessingMsg('Weighting analysis complete.')
    } catch (err: any) {
      console.error('Weighting parse error:', err)
      setProcessingMsg(`Weighting analysis error. Adjust weights manually. (${err.message})`)
    }
    setIsProcessing(false)
  }, [years, normalisedEbitdaByYear, weightContext, engagement])

  const analyseRisk = useCallback(async () => {
    setIsProcessing(true)
    setProcessingMsg('Analysing business risk factors...')
    const latestYr = years[0] || ''
    const d = ebitdaByYear[latestYr]
    const ebitdaSeries = years.map(yr => `FY${yr}: Revenue ${fmt(ebitdaByYear[yr]?.revenue || 0)}, EBITDA ${fmt(normalisedEbitdaByYear[yr] || 0)}`).join('; ')
    const sys = `You are an Australian CA scoring risk factors for business valuation (APES 225 aligned). Score each factor 0-10 (low=less risk, high=more risk) with both conservative (high) and optimistic (low) scores. The low score should always be <= the high score. Return ONLY JSON (no explanation, no markdown): {"factors":[{"id":"revenue","scoreLow":3,"scoreHigh":5,"reasoning":"..."},{"id":"financial","scoreLow":2,"scoreHigh":4,"reasoning":"..."},{"id":"keyman","scoreLow":4,"scoreHigh":6,"reasoning":"..."},{"id":"customer","scoreLow":3,"scoreHigh":5,"reasoning":"..."},{"id":"profitability","scoreLow":4,"scoreHigh":6,"reasoning":"..."},{"id":"competitive","scoreLow":5,"scoreHigh":7,"reasoning":"..."}], "industryAnalysis":"2-3 paragraph industry overview for the report"}`
    const usr = `Business: ${engagement.businessName}\nIndustry: ${engagement.industrySector}\nDescription: ${engagement.businessDescription}\nFinancials: ${ebitdaSeries}\nEmployees: ${engagement.employees}, Years trading: ${engagement.yearsTrading}\nFME: ${fmt(fme)}\nGross margin: ${d?.revenue ? fmtPct(d.grossProfit / d.revenue) : 'N/A'}`
    try {
      const r = await callOpus(sys, usr)
      const p = cleanJSON(r)
      if (p.factors) {
        setRiskFactors(prev => prev.map(f => {
          const match = p.factors.find((pf: any) => pf.id === f.id)
          return match ? { ...f, scoreLow: match.scoreLow, scoreHigh: match.scoreHigh, aiReasoning: match.reasoning || '' } : f
        }))
      }
      if (p.industryAnalysis) setIndustryAnalysis(p.industryAnalysis)
      setProcessingMsg('Risk analysis complete.')
    } catch (err: any) {
      console.error('Risk parse error:', err)
      setProcessingMsg(`Risk analysis error. Score factors manually. (${err.message})`)
    }
    setIsProcessing(false)
  }, [years, ebitdaByYear, normalisedEbitdaByYear, engagement, fme])

  // ── Manual entry helpers ──────────────────────────────────────────────────
  const generateDocx = useCallback(async () => {
    setIsProcessing(true)
    setProcessingMsg('Generating DOCX report...')
    try {
      const payload = {
        engagement, years, ebitdaByYear, normItems, normalisedEbitdaByYear, weights, fme,
        riskFactors, compositeScoreLow, compositeScoreHigh, multipleLow, multipleHigh,
        valuation, bsItems: bsItems.map(b => ({ ...b })), sensitivity, industryAnalysis, discounts, aiWeightReasoning
      }
      const res = await fetch('/api/valuation-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) { const e = await res.text(); throw new Error(e) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(engagement.businessName || 'Valuation').replace(/[^a-zA-Z0-9 ]/g, '')}_Valuation_Report.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setProcessingMsg('Report downloaded successfully.')
    } catch (err: any) {
      console.error('DOCX error:', err)
      setProcessingMsg(`Error generating report: ${err.message}`)
    }
    setIsProcessing(false)
  }, [engagement, years, ebitdaByYear, normItems, normalisedEbitdaByYear, weights, fme, riskFactors, compositeScoreLow, compositeScoreHigh, multipleLow, multipleHigh, valuation, bsItems, sensitivity, industryAnalysis, discounts, aiWeightReasoning])

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

  const goTo = useCallback((s: Step) => { if (canGoTo(s)) { setStep(s); window.scrollTo(0, 0) } }, [canGoTo])

  // Scroll to top whenever step changes
  const setStepAndScroll = useCallback((s: Step) => { setStep(s); window.scrollTo(0, 0) }, [])

  // ── Styles ────────────────────────────────────────────────────────────────
  const sc = "rounded-2xl bg-white border border-gray-200 shadow-sm p-6 mb-6"
  const lbl = "block text-sm font-semibold text-gray-700 mb-1"
  const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#2E75B6] focus:ring-1 focus:ring-[#2E75B6] outline-none transition"
  const ta = inp + " resize-y"
  const bp = "rounded-lg bg-[#1F4E79] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2E75B6] transition disabled:opacity-40 disabled:cursor-not-allowed"
  const bs = "rounded-lg border border-[#1F4E79] px-5 py-2.5 text-sm font-semibold text-[#1F4E79] hover:bg-[#F0F4F8] transition"

  const STEP_LABELS: [Step, string][] = [[1,'Setup'],[2,'Data'],[3,'EBITDA'],[4,'Normalise'],[5,'Weighting'],[6,'Risk & Multiple'],[7,'Balance Sheet'],[8,'Valuation'],[9,'Report']]

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
            <div className="text-right text-xs text-blue-200 flex flex-col items-end gap-1">
              <div>BAKR by CforA</div>
              <div className="flex items-center gap-2">
                <a href="/guides/business-valuation-guide.html" target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-white/15 hover:bg-white/25 text-white rounded-full text-[11px] font-semibold transition flex items-center gap-1">📘 User Guide</a>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-200 rounded text-[10px] font-medium">BETA</span>
              </div>
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
            <h2 className="text-lg font-bold text-[#1F4E79] mb-4">Valuation Method <HelpBtn onClick={m('what-is-ebitda')} label="What is EBITDA?" /> <HelpBtn onClick={m('what-is-sde')} label="What is SDE?" /></h2>
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
            <h2 className="text-lg font-bold text-[#1F4E79] mb-4">Valuation Scope <HelpBtn onClick={m('enterprise-vs-equity')} label="Enterprise vs Equity?" /></h2>
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
            <button className={bp} disabled={!step1Valid} onClick={() => { markComplete(1); setStepAndScroll(2) }}>Continue →</button>
          </div>
        </div>)}

        {/* ═══ STEP 2 — DATA ═════════════════════════════════════════════ */}
        {step === 2 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-2">Upload Financial Statements <HelpBtn onClick={m('how-to-upload')} label="How to upload" /></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="border-2 border-dashed border-[#2E75B6] rounded-xl p-6 bg-blue-50/30 text-center hover:bg-blue-50/60 transition cursor-pointer"
                onDragOver={preventDefaults} onDragEnter={preventDefaults} onDrop={e => handleDrop(e, 'financial')}
                onClick={() => (document.getElementById('file-financial') as HTMLInputElement)?.click()}>
                <p className="text-2xl mb-2">📄</p>
                <p className="text-sm font-semibold text-[#1F4E79] mb-1">Financial Statements</p>
                <p className="text-[10px] text-gray-500 mb-2">Drag &amp; drop PDF files here, or click to browse</p>
                <p className="text-[10px] text-gray-400">P&amp;L, Balance Sheet, Notes — one combined PDF or separate files</p>
                <input id="file-financial" type="file" accept=".pdf,.xlsx,.xls,.csv" multiple onChange={e => handleFileUpload(e, 'financial')} className="hidden" />
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#2E75B6] hover:bg-blue-50/20 transition cursor-pointer"
                onDragOver={preventDefaults} onDragEnter={preventDefaults} onDrop={e => handleDrop(e, 'gl')}
                onClick={() => (document.getElementById('file-gl') as HTMLInputElement)?.click()}>
                <p className="text-2xl mb-2">📒</p>
                <p className="text-sm font-semibold text-[#1F4E79] mb-1">General Ledger (Optional)</p>
                <p className="text-[10px] text-gray-500 mb-2">Drag &amp; drop Excel/CSV here, or click to browse</p>
                <p className="text-[10px] text-gray-400">GL exports improve normalisation analysis</p>
                <input id="file-gl" type="file" accept=".xlsx,.xls,.csv" multiple onChange={e => handleFileUpload(e, 'gl')} className="hidden" />
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
                <button className={bp+" mt-2"} onClick={parseFinancials} disabled={isProcessing}>{isProcessing ? '⏳ Extracting...' : '📊 Extract the Data'}</button>
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
            <button className={bs} onClick={() => setStepAndScroll(1)}>← Back</button>
            <button className={bp} disabled={!step2Valid} onClick={() => { markComplete(2); setStepAndScroll(3) }}>Continue →</button>
          </div>
        </div>)}

        {/* ═══ STEP 3 — EBITDA ═══════════════════════════════════════════ */}
        {step === 3 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">EBITDA Calculation <HelpBtn onClick={m('what-is-ebitda')} label="What is EBITDA?" /> <WorkingsBtn onClick={m('ebitda-workings')} label="View workings" /></h2>
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
            <button className={bs} onClick={() => setStepAndScroll(2)}>← Back</button>
            <button className={bp} onClick={() => { markComplete(3); setStepAndScroll(4) }}>Confirm & Continue →</button>
          </div>
        </div>)}

        {/* ═══ STEP 4 — NORMALISATION ════════════════════════════════════ */}
        {step === 4 && (<div className="space-y-6">
          <div className={sc}>
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-lg font-bold text-[#1F4E79]">Normalisation Adjustments <HelpBtn onClick={m('what-is-normalisation')} label="What is this?" /> <HelpBtn onClick={m('norm-categories')} label="Categories explained" /></h2><p className="text-xs text-gray-500">Adjust for discretionary, non-recurring and personal expenses</p></div>
              <button className={bp} onClick={analyseNormalisation} disabled={isProcessing}>{isProcessing ? '⏳ Working...' : '🔍 Seek Items to Exclude'}</button>
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
              <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Normalised EBITDA <WorkingsBtn onClick={m('normalised-ebitda-workings')} label="View workings" /></h2>
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
            <button className={bs} onClick={() => setStepAndScroll(3)}>← Back</button>
            <button className={bp} onClick={() => { markComplete(4); initWeights(); setStepAndScroll(5) }}>
              Continue to Weighting →
            </button>
          </div>
        </div>)}

        {/* ═══ STEP 7 — BALANCE SHEET ════════════════════════════════════ */}
        {step === 7 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-2">Balance Sheet Review & Classification <HelpBtn onClick={m('balance-sheet-classification')} label="How to classify" /></h2>
            <p className="text-xs text-gray-500 mb-1">Classify each item to determine what transfers to the buyer and how it affects the equity value. Adjust book values to estimated market values where appropriate.</p>
            <p className="text-xs text-gray-600 mb-4 bg-[#F0F4F8] p-2 rounded-lg">🔑 <strong>Key principle:</strong> Only fixed assets needed to earn the EBITDA (plant, equipment, vehicles) are included in the enterprise value. All other assets (cash, debtors, stock) and liabilities (creditors, provisions, tax) transfer to the buyer and are added/deducted separately.</p>
            
            {bsItems.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p>No balance sheet data loaded. Go back to Step 2 to upload or enter balance sheet data.</p>
                <button className={bs+" mt-3"} onClick={() => {
                  const items: {name: string, section: BSLineItem['section'], cls: BSLineItem['classification']}[] = [
                    {name: 'Cash & Bank', section: 'current_asset', cls: 'transfer_asset'},
                    {name: 'Trade Debtors', section: 'current_asset', cls: 'transfer_asset'},
                    {name: 'Stock / Inventory', section: 'current_asset', cls: 'transfer_asset'},
                    {name: 'Tax Assets', section: 'current_asset', cls: 'transfer_asset'},
                    {name: 'Plant & Equipment', section: 'fixed_asset', cls: 'in_ev'},
                    {name: 'Motor Vehicles', section: 'fixed_asset', cls: 'in_ev'},
                    {name: 'Trade Creditors', section: 'current_liability', cls: 'transfer_liability'},
                    {name: 'Employee Provisions (AL, LSL)', section: 'current_liability', cls: 'transfer_liability'},
                    {name: 'Tax Liabilities', section: 'current_liability', cls: 'transfer_liability'},
                    {name: 'GST Payable', section: 'current_liability', cls: 'transfer_liability'},
                    {name: 'Finance Loans / HP', section: 'current_liability', cls: 'debt'},
                  ]
                  setBsItems(items.map(it => ({ id: genId(), name: it.name, section: it.section, amounts: {}, adjustedValue: 0, classification: it.cls, userNotes: '', children: [], expanded: false })))
                }}>+ Add Default Balance Sheet Items</button>
              </div>
            )}

            {bsItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#1F4E79] text-white">
                    <th className="text-left px-3 py-2 min-w-[220px]">Item</th>
                    <th className="text-left px-2 py-2">Section</th>
                    <th className="text-right px-3 py-2">Book Value</th>
                    <th className="text-right px-3 py-2">Adjusted Value</th>
                    <th className="text-left px-2 py-2">Classification <HelpBtn onClick={m('balance-sheet-classification')} /></th>
                    <th className="text-left px-2 py-2 min-w-[120px]">Notes</th>
                  </tr></thead>
                  <tbody>
                    {bsItems.map(item => {
                      const latestYr = years[0] || ''
                      const bookVal = item.amounts[latestYr] || 0
                      const hasChildren = item.children && item.children.length > 0
                      return (
                        <Fragment key={item.id}>
                          <tr className={`border-b border-gray-100 hover:bg-gray-50 ${item.classification === 'surplus' ? 'bg-blue-50/30' : item.classification === 'debt' ? 'bg-red-50/30' : item.classification === 'transfer_asset' ? 'bg-emerald-50/20' : item.classification === 'transfer_liability' ? 'bg-orange-50/20' : item.classification === 'goodwill' ? 'bg-amber-50/30' : ''}`}>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1">
                                {hasChildren && (
                                  <button onClick={() => setBsItems(p => p.map(b => b.id===item.id?{...b,expanded:!b.expanded}:b))} className="text-gray-400 hover:text-[#1F4E79] text-sm w-5 shrink-0">
                                    {item.expanded ? '▼' : '▶'}
                                  </button>
                                )}
                                {!hasChildren && <span className="w-5 shrink-0" />}
                                <span className="font-medium text-gray-800">{item.name}</span>
                                {hasChildren && <span className="text-[10px] text-gray-400 ml-1">({item.children?.length} items)</span>}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-gray-500 text-[10px]">{item.section.replace(/_/g,' ')}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{fmt(bookVal)}</td>
                            <td className="px-3 py-1.5 text-right">
                              <input type="number" className="w-24 text-right text-xs border rounded px-2 py-1 bg-white" value={item.adjustedValue || bookVal || ''} onChange={e => setBsItems(p => p.map(b => b.id===item.id?{...b,adjustedValue:parseFloat(e.target.value)||0}:b))} />
                            </td>
                            <td className="px-2 py-1.5">
                              <select className={`text-[10px] border rounded px-1 py-0.5 font-medium ${
                                item.classification === 'in_ev' ? 'bg-gray-100 border-gray-300 text-gray-700' :
                                item.classification === 'transfer_asset' ? 'bg-emerald-100 border-emerald-300 text-emerald-700' :
                                item.classification === 'transfer_liability' ? 'bg-orange-100 border-orange-300 text-orange-700' :
                                item.classification === 'surplus' ? 'bg-blue-100 border-blue-300 text-blue-700' :
                                item.classification === 'debt' ? 'bg-red-100 border-red-300 text-red-700' :
                                item.classification === 'goodwill' ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white'
                              }`} value={item.classification} onChange={e => setBsItems(p => p.map(b => b.id===item.id?{...b,classification:e.target.value as any}:b))}>
                                <option value="in_ev">🔧 In Enterprise Value</option>
                                <option value="transfer_asset">➕ Transfers (Asset)</option>
                                <option value="transfer_liability">➖ Transfers (Liability)</option>
                                <option value="surplus">⭐ Surplus Asset</option>
                                <option value="debt">🏦 Debt</option>
                                <option value="goodwill">📋 Goodwill (replaced)</option>
                              </select>
                            </td>
                            <td className="px-2 py-1.5"><input className="w-full text-[10px] border rounded px-1 py-0.5 bg-white" value={item.userNotes} onChange={e => setBsItems(p => p.map(b => b.id===item.id?{...b,userNotes:e.target.value}:b))} placeholder="Notes..." /></td>
                          </tr>
                          {/* Expandable children sub-items */}
                          {item.expanded && item.children && item.children.map((child, ci) => (
                            <tr key={`${item.id}-child-${ci}`} className="bg-gray-50/70 border-b border-gray-50">
                              <td className="px-3 py-1 pl-10 text-[10px] text-gray-500 italic">{child.name}</td>
                              <td></td>
                              <td className="px-3 py-1 text-right text-[10px] text-gray-400">{fmt(child.amount)}</td>
                              <td></td>
                              <td></td>
                              <td></td>
                            </tr>
                          ))}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {bsItems.length > 0 && (() => {
              const yr = years[0] || ''
              const getVal = (b: BSLineItem) => b.adjustedValue || (b.amounts[yr] || 0)
              const inEvItems = bsItems.filter(b => b.classification === 'in_ev')
              const transferAssetItems = bsItems.filter(b => b.classification === 'transfer_asset')
              const transferLiabItems = bsItems.filter(b => b.classification === 'transfer_liability')
              const surplusItems = bsItems.filter(b => b.classification === 'surplus')
              const debtItems = bsItems.filter(b => b.classification === 'debt')
              const goodwillItems = bsItems.filter(b => b.classification === 'goodwill')
              const totalInEv = inEvItems.reduce((s, b) => s + getVal(b), 0)
              const totalTransferA = transferAssetItems.reduce((s, b) => s + getVal(b), 0)
              const totalTransferL = transferLiabItems.reduce((s, b) => s + getVal(b), 0)
              const totalSurplus = surplusItems.reduce((s, b) => s + getVal(b), 0)
              const totalDebt = debtItems.reduce((s, b) => s + Math.abs(getVal(b)), 0)
              const netTransfer = totalTransferA - totalTransferL
              const netBsAdj = netTransfer + totalSurplus - totalDebt
              return (
                <div className="mt-6 space-y-4">
                  {/* IN ENTERPRISE VALUE */}
                  <div className="rounded-xl border-2 border-gray-200 overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 border-b">
                      <p className="text-sm font-bold text-gray-700">🔧 INCLUDED IN ENTERPRISE VALUE <span className="font-normal text-gray-500">(operating fixed assets — valued within the EBITDA multiple)</span></p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[10px] text-gray-500 mb-2">These fixed assets are needed to earn the EBITDA. The multiple already prices them in. They are NOT added separately.</p>
                      {inEvItems.length === 0 ? <p className="text-xs text-gray-400 italic">No items classified. Classify plant, equipment, and vehicles used in operations here.</p> : (
                        <table className="w-full text-xs"><tbody>
                          {inEvItems.map(b => (<tr key={b.id} className="border-b border-gray-100"><td className="py-1 text-gray-600">{b.name}</td><td className="py-1 text-right text-gray-700 font-medium">{fmt(getVal(b))}</td></tr>))}
                          <tr className="bg-gray-50"><td className="py-1.5 font-bold text-gray-700">Total (for reference only)</td><td className="py-1.5 text-right font-bold text-gray-800">{fmt(totalInEv)}</td></tr>
                        </tbody></table>
                      )}
                    </div>
                  </div>

                  {/* TRANSFERRING ASSETS */}
                  <div className="rounded-xl border-2 border-emerald-200 overflow-hidden">
                    <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-200">
                      <p className="text-sm font-bold text-emerald-800">➕ ASSETS TRANSFERRING TO BUYER <span className="font-normal text-emerald-600">(added to enterprise value)</span></p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[10px] text-gray-500 mb-2">These assets transfer to the buyer on settlement. Cash, debtors (at collectible value), stock (at NRV), prepayments, tax assets.</p>
                      {transferAssetItems.length === 0 ? <p className="text-xs text-gray-400 italic">No items. Classify cash, debtors, stock, prepayments, tax assets here.</p> : (
                        <table className="w-full text-xs"><tbody>
                          {transferAssetItems.map(b => (<tr key={b.id} className="border-b border-emerald-100"><td className="py-1 text-emerald-800">{b.name}</td><td className="py-1 text-right text-emerald-800 font-medium">{fmt(getVal(b))}</td></tr>))}
                          <tr className="bg-emerald-100"><td className="py-1.5 font-bold text-emerald-900">Total Transferring Assets</td><td className="py-1.5 text-right font-bold text-emerald-900">{fmt(totalTransferA)}</td></tr>
                        </tbody></table>
                      )}
                    </div>
                  </div>

                  {/* TRANSFERRING LIABILITIES */}
                  <div className="rounded-xl border-2 border-orange-200 overflow-hidden">
                    <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
                      <p className="text-sm font-bold text-orange-800">➖ LIABILITIES TRANSFERRING TO BUYER <span className="font-normal text-orange-600">(deducted from enterprise value)</span></p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[10px] text-gray-500 mb-2">These liabilities transfer to the buyer. Trade creditors, employee provisions (AL, LSL), tax liabilities, GST payable.</p>
                      {transferLiabItems.length === 0 ? <p className="text-xs text-gray-400 italic">No items. Classify trade creditors, provisions, and tax liabilities here.</p> : (
                        <table className="w-full text-xs"><tbody>
                          {transferLiabItems.map(b => (<tr key={b.id} className="border-b border-orange-100"><td className="py-1 text-orange-800">{b.name}</td><td className="py-1 text-right text-orange-800 font-medium">({fmt(Math.abs(getVal(b)))})</td></tr>))}
                          <tr className="bg-orange-100"><td className="py-1.5 font-bold text-orange-900">Total Transferring Liabilities</td><td className="py-1.5 text-right font-bold text-orange-900">({fmt(totalTransferL)})</td></tr>
                        </tbody></table>
                      )}
                    </div>
                  </div>

                  {/* NET TRANSFERRING */}
                  <div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-3">
                    <table className="w-full text-sm"><tbody>
                      <tr><td className="py-1 text-emerald-700">Transferring Assets</td><td className="py-1 text-right font-bold text-emerald-700">{fmt(totalTransferA)}</td></tr>
                      <tr className="border-b"><td className="py-1 text-orange-700">Less: Transferring Liabilities</td><td className="py-1 text-right font-bold text-orange-700">({fmt(totalTransferL)})</td></tr>
                      <tr><td className="py-2 font-bold text-[#1F4E79]">Net Transferring to Buyer</td><td className="py-2 text-right font-bold text-[#1F4E79] text-lg">{fmt(netTransfer)}</td></tr>
                    </tbody></table>
                  </div>

                  {/* SURPLUS ASSETS */}
                  <div className="rounded-xl border-2 border-blue-200 overflow-hidden">
                    <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                      <p className="text-sm font-bold text-blue-800">⭐ SURPLUS ASSETS <span className="font-normal text-blue-600">(non-operating — added to enterprise value)</span></p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[10px] text-gray-500 mb-2">Assets not needed for operations: excess cash, investments, director loans, non-operating property.</p>
                      {surplusItems.length === 0 ? <p className="text-xs text-gray-400 italic">No surplus assets identified.</p> : (
                        <table className="w-full text-xs"><tbody>
                          {surplusItems.map(b => (<tr key={b.id} className="border-b border-blue-100"><td className="py-1 text-blue-800">{b.name}</td><td className="py-1 text-right text-blue-800 font-medium">{fmt(getVal(b))}</td></tr>))}
                          <tr className="bg-blue-100"><td className="py-1.5 font-bold text-blue-900">Total Surplus Assets</td><td className="py-1.5 text-right font-bold text-blue-900">{fmt(totalSurplus)}</td></tr>
                        </tbody></table>
                      )}
                    </div>
                  </div>

                  {/* DEBT */}
                  <div className="rounded-xl border-2 border-red-200 overflow-hidden">
                    <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                      <p className="text-sm font-bold text-red-800">🏦 INTEREST-BEARING DEBT <span className="font-normal text-red-600">(deducted from enterprise value)</span></p>
                    </div>
                    <div className="px-4 py-3">
                      {debtItems.length === 0 ? <p className="text-xs text-gray-400 italic">No interest-bearing debt.</p> : (
                        <table className="w-full text-xs"><tbody>
                          {debtItems.map(b => (<tr key={b.id} className="border-b border-red-100"><td className="py-1 text-red-800">{b.name}</td><td className="py-1 text-right text-red-800 font-medium">({fmt(Math.abs(getVal(b)))})</td></tr>))}
                          <tr className="bg-red-100"><td className="py-1.5 font-bold text-red-900">Total Debt</td><td className="py-1.5 text-right font-bold text-red-900">({fmt(totalDebt)})</td></tr>
                        </tbody></table>
                      )}
                    </div>
                  </div>

                  {/* GOODWILL NOTE */}
                  {goodwillItems.length > 0 && (
                    <div className="rounded-xl border-2 border-amber-200 overflow-hidden">
                      <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
                        <p className="text-sm font-bold text-amber-800">📋 EXISTING GOODWILL / INTANGIBLES <span className="font-normal text-amber-600">(excluded — replaced by derived goodwill)</span></p>
                      </div>
                      <div className="px-4 py-3">
                        {goodwillItems.map(b => (<p key={b.id} className="text-xs text-amber-700">{b.name}: {fmt(getVal(b))} — replaced by the goodwill derived from this valuation.</p>))}
                      </div>
                    </div>
                  )}

                  {/* EQUITY VALUE BUILD-UP PREVIEW */}
                  <div className="rounded-xl border-2 border-[#1F4E79] overflow-hidden">
                    <div className="bg-[#1F4E79] px-4 py-2">
                      <p className="text-sm font-bold text-white">EQUITY VALUE BUILD-UP (preview — finalised in Step 8)</p>
                    </div>
                    <div className="px-4 py-3 bg-[#F0F4F8]">
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-gray-200"><td className="py-2 text-gray-600">Enterprise Value (FME × Multiple)</td><td className="py-2 text-right text-gray-500 italic">Calculated in Steps 6-7</td></tr>
                          <tr className="border-b border-gray-200"><td className="py-2 text-emerald-700">Plus: Transferring Assets</td><td className="py-2 text-right font-bold text-emerald-700">{fmt(totalTransferA)}</td></tr>
                          <tr className="border-b border-gray-200"><td className="py-2 text-orange-700">Less: Transferring Liabilities</td><td className="py-2 text-right font-bold text-orange-700">({fmt(totalTransferL)})</td></tr>
                          <tr className="border-b border-gray-200"><td className="py-2 text-blue-700">Plus: Surplus Assets</td><td className="py-2 text-right font-bold text-blue-700">{fmt(totalSurplus)}</td></tr>
                          <tr className="border-b border-gray-200"><td className="py-2 text-red-700">Less: Interest-Bearing Debt</td><td className="py-2 text-right font-bold text-red-700">({fmt(totalDebt)})</td></tr>
                          <tr className="bg-gray-200"><td className="py-2 px-2 font-semibold text-gray-700">Net Balance Sheet Adjustment</td><td className="py-2 px-2 text-right font-bold text-gray-800">{fmt(netBsAdj)}</td></tr>
                          <tr className="bg-[#1F4E79] text-white"><td className="py-2 px-2 font-bold">= Equity Value</td><td className="py-2 px-2 text-right font-bold">Enterprise Value + {fmt(netBsAdj)}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
          <div className="flex justify-between">
            <button className={bs} onClick={() => setStepAndScroll(6)}>← Back</button>
            <button className={bp} onClick={() => { markComplete(7); setStepAndScroll(8) }}>Continue to Valuation →</button>
          </div>
        </div>)}

        {/* ═══ STEP 5 — WEIGHTING ════════════════════════════════════════ */}
        {step === 5 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Future Maintainable Earnings (FME) <HelpBtn onClick={m('what-is-fme')} label="What is FME?" /> <WorkingsBtn onClick={m('fme-workings')} label="View workings" /></h2>
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
              <button className={bp+" mt-2"} onClick={analyseWeighting} disabled={isProcessing}>{isProcessing ? '⏳ Working...' : 'Weighting Analysis'}</button>
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
            <button className={bs} onClick={() => setStepAndScroll(4)}>← Back</button>
            <button className={bp} disabled={weights.reduce((s,w) => s+w.weight,0)!==100} onClick={() => { markComplete(5); setStepAndScroll(6) }}>Continue to Risk Analysis →</button>
          </div>
        </div>)}

        {/* ═══ STEP 6 — RISK & MULTIPLE ══════════════════════════════════ */}
        {step === 6 && (<div className="space-y-6">
          <div className={sc}>
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-lg font-bold text-[#1F4E79]">Risk Analysis & EBITDA Multiple <HelpBtn onClick={m('risk-scoring-explained')} label="How this works" /> <WorkingsBtn onClick={m('multiple-workings')} label="View workings" /></h2><p className="text-xs text-gray-500">Score each factor 0 (lowest risk) to 10 (highest risk)</p></div>
              <button className={bp} onClick={analyseRisk} disabled={isProcessing}>{isProcessing ? '⏳ Working...' : 'Risk Scoring'}</button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-[#F0F4F8] border border-[#2E75B6] mb-2">
                <p className="text-xs text-[#1F4E79] font-semibold">How to score each factor:</p>
                <p className="text-xs text-gray-600 mt-1">Drag the two thumbs on each slider to set a risk range. The <strong className="text-emerald-700">green thumb</strong> is your optimistic (best-case) score. The <strong className="text-orange-700">orange thumb</strong> is your conservative (cautious) score. The shaded area between them is the range of uncertainty.</p>
              </div>

              <style dangerouslySetInnerHTML={{ __html: `
                .range-track { position: relative; height: 36px; }
                .range-track input[type=range] { position: absolute; top: 8px; left: 0; width: 100%; height: 6px; -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none; z-index: 2; margin: 0; }
                .range-track input[type=range]::-webkit-slider-runnable-track { height: 6px; background: transparent; }
                .range-track input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; cursor: pointer; pointer-events: all; position: relative; z-index: 3; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
                .range-track .range-low::-webkit-slider-thumb { background: #059669; }
                .range-track .range-high::-webkit-slider-thumb { background: #ea580c; }
                .range-track input[type=range]::-moz-range-thumb { height: 18px; width: 18px; border-radius: 50%; cursor: pointer; pointer-events: all; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
                .range-track .range-low::-moz-range-thumb { background: #059669; }
                .range-track .range-high::-moz-range-thumb { background: #ea580c; }
                .range-track input[type=range]::-moz-range-track { height: 6px; background: transparent; }
                .range-fill { position: absolute; top: 11px; height: 6px; border-radius: 3px; z-index: 1; }
              ` }} />

              {riskFactors.map(f => {
                const pctLow = f.scoreLow / 10 * 100
                const pctHigh = f.scoreHigh / 10 * 100
                return (
                <div key={f.id} className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                  <p className="font-bold text-sm text-[#1F4E79] mb-1">{f.name}</p>
                  <p className="text-xs text-gray-600 mb-1">{f.description}</p>
                  {f.aiReasoning && <p className="text-xs text-blue-700 bg-blue-50 rounded p-2 mb-3 border border-blue-200">{f.aiReasoning}</p>}
                  
                  {/* Score display */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Optimistic: {f.scoreLow}</span>
                    <span className="text-xs text-gray-400">Drag thumbs to adjust range</span>
                    <span className="text-xs font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded">Conservative: {f.scoreHigh}</span>
                  </div>

                  {/* Dual-thumb slider */}
                  <div className="range-track">
                    {/* Track background */}
                    <div className="absolute top-[11px] left-0 right-0 h-1.5 rounded-full bg-gray-200" />
                    {/* Filled range between thumbs */}
                    <div className="range-fill bg-gradient-to-r from-emerald-400 to-orange-400 opacity-40" style={{ left: `${pctLow}%`, width: `${pctHigh - pctLow}%` }} />
                    {/* Low thumb (green) */}
                    <input type="range" className="range-low" min={0} max={10} step={0.5} value={f.scoreLow}
                      onChange={e => { const v = parseFloat(e.target.value); setRiskFactors(p => p.map(rf => rf.id===f.id ? {...rf, scoreLow: v, scoreHigh: Math.max(rf.scoreHigh, v)} : rf)) }} />
                    {/* High thumb (orange) */}
                    <input type="range" className="range-high" min={0} max={10} step={0.5} value={f.scoreHigh}
                      onChange={e => { const v = parseFloat(e.target.value); setRiskFactors(p => p.map(rf => rf.id===f.id ? {...rf, scoreHigh: v, scoreLow: Math.min(rf.scoreLow, v)} : rf)) }} />
                  </div>

                  {/* Scale labels */}
                  <div className="flex justify-between text-[9px] text-gray-400 mt-0.5 px-1">
                    <span>0 — Low risk</span><span>5 — Moderate</span><span>10 — High risk</span>
                  </div>
                </div>
              )})}
            </div>
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
            <button className={bs} onClick={() => setStepAndScroll(5)}>← Back</button>
            <button className={bp} onClick={() => { markComplete(6); if (engagement.valuationScope === 'equity') setStepAndScroll(7); else { markComplete(7); setStepAndScroll(8) } }}>
              {engagement.valuationScope === 'equity' ? 'Continue to Balance Sheet →' : 'Continue to Valuation →'}
            </button>
          </div>
        </div>)}

        {/* ═══ STEP 8 — VALUATION ════════════════════════════════════════ */}
        {step === 8 && (<div className="space-y-6">
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-4">Valuation Summary <WorkingsBtn onClick={m('valuation-workings')} label="Full workings" /> <WorkingsBtn onClick={m('bs-surplus-workings')} label="Balance sheet detail" /></h2>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b"><td className="py-2 text-gray-600">Future Maintainable Earnings (FME)</td><td className="text-right py-2 font-bold">{fmt(fme)}</td></tr>
                <tr className="border-b"><td className="py-2 text-gray-600">EBITDA Multiple Range</td><td className="text-right py-2 font-bold">{multipleLow.toFixed(1)}x – {multipleHigh.toFixed(1)}x</td></tr>
                <tr className="border-b bg-blue-50"><td className="py-2 font-semibold text-[#1F4E79] px-2">Enterprise Value</td><td className="text-right py-2 font-bold text-[#1F4E79] px-2">{fmt(valuation.evLow)} – {fmt(valuation.evHigh)}</td></tr>
                {engagement.valuationScope === 'equity' && (<>
                  <tr className="border-b"><td className="py-2 text-emerald-700 pl-6">Plus: Transferring Assets (cash, debtors, stock, etc.)</td><td className="text-right py-2 font-semibold text-emerald-700">{fmt(valuation.transferAssets)}</td></tr>
                  <tr className="border-b"><td className="py-2 text-orange-700 pl-6">Less: Transferring Liabilities (creditors, provisions, tax)</td><td className="text-right py-2 font-semibold text-orange-700">({fmt(valuation.transferLiabilities)})</td></tr>
                  <tr className="border-b bg-gray-50"><td className="py-2 text-gray-700 pl-6 font-semibold">Net Transferring to Buyer</td><td className="text-right py-2 font-bold text-gray-800">{fmt(valuation.netTransferring)}</td></tr>
                  {valuation.surplusAssets > 0 && <tr className="border-b"><td className="py-2 text-blue-700 pl-6">Plus: Surplus Assets</td><td className="text-right py-2 font-semibold text-blue-700">{fmt(valuation.surplusAssets)}</td></tr>}
                  {valuation.netDebt > 0 && <tr className="border-b"><td className="py-2 text-red-700 pl-6">Less: Interest-Bearing Debt</td><td className="text-right py-2 font-semibold text-red-700">({fmt(valuation.netDebt)})</td></tr>}
                  <tr className="border-b bg-gray-100"><td className="py-2 text-gray-700 pl-6 font-semibold">Total Balance Sheet Adjustment</td><td className="text-right py-2 font-bold text-gray-800">{fmt(valuation.netBsAdjustment)}</td></tr>
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
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Cross-Checks <HelpBtn onClick={m('equipment-floor')} label="Equipment floor explained" /></h2>
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
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Sensitivity Matrix <HelpBtn onClick={m('sensitivity-explained')} label="How to read this" /></h2>
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
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Discount Considerations <HelpBtn onClick={m('discounts-explained')} label="What are discounts?" /></h2>
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
            <button className={bs} onClick={() => setStepAndScroll(engagement.valuationScope === 'equity' ? 7 : 6)}>← Back</button>
            <button className={bp} onClick={() => { markComplete(8); setStepAndScroll(9) }}>Continue to Report Generation →</button>
          </div>
        </div>)}

        {/* ═══ STEP 9 — REPORT ═══════════════════════════════════════════ */}
        {step === 9 && (<div className="space-y-6">
          
          {/* Cover / Opinion */}
          <div className="rounded-2xl overflow-hidden border border-[#1F4E79]">
            <div className="bg-[#1F4E79] text-white p-8 text-center">
              <p className="text-xs text-blue-300 tracking-widest uppercase font-semibold mb-2">Business Valuation Report</p>
              <p className="text-2xl font-bold mb-1">{engagement.businessName || 'Business Name'}</p>
              <p className="text-sm text-blue-200">{engagement.entityType} | ABN: {engagement.abn || '—'}</p>
              <div className="w-16 h-0.5 bg-blue-300 mx-auto my-4" />
              <p className="text-sm text-blue-200">Effective Date: {engagement.valuationDate || '—'}</p>
              <p className="text-sm text-blue-200">Purpose: {engagement.purpose}</p>
              <p className="text-sm text-blue-200">Method: Capitalisation of Future Maintainable Earnings ({engagement.valuationMethod})</p>
              <p className="text-sm text-blue-200">Scope: {engagement.valuationScope === 'equity' ? 'Full Entity (Equity) Value' : 'Enterprise Value Only'}</p>
            </div>
            <div className="bg-[#F0F4F8] p-6 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Assessed Value Range</p>
              <p className="text-4xl font-bold text-[#1F4E79]">
                {engagement.valuationScope === 'equity' ? `${fmt(valuation.finalLow)} – ${fmt(valuation.finalHigh)}` : `${fmt(valuation.evLow)} – ${fmt(valuation.evHigh)}`}
              </p>
              <p className="text-lg font-semibold text-[#2E75B6] mt-1">
                Midpoint: {engagement.valuationScope === 'equity' ? fmt(valuation.finalMid) : fmt((valuation.evLow+valuation.evHigh)/2)}
              </p>
            </div>
          </div>

          {/* 1. Engagement Summary */}
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">1. Engagement Summary</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div><span className="text-gray-500">Business:</span> <strong>{engagement.businessName}</strong></div>
              <div><span className="text-gray-500">Entity Type:</span> <strong>{engagement.entityType}</strong></div>
              <div><span className="text-gray-500">Industry:</span> <strong>{engagement.industrySector}</strong></div>
              <div><span className="text-gray-500">ABN:</span> <strong>{engagement.abn || '—'}</strong></div>
              <div><span className="text-gray-500">Employees:</span> <strong>{engagement.employees || '—'}</strong></div>
              <div><span className="text-gray-500">Years Trading:</span> <strong>{engagement.yearsTrading || '—'}</strong></div>
              <div><span className="text-gray-500">Purpose:</span> <strong>{engagement.purpose}</strong></div>
              <div><span className="text-gray-500">Valuation Date:</span> <strong>{engagement.valuationDate}</strong></div>
            </div>
            {engagement.businessDescription && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-semibold text-gray-500 mb-1">Business Description</p>
                <p className="text-sm text-gray-700">{engagement.businessDescription}</p>
              </div>
            )}
          </div>

          {/* 2. Financial Performance */}
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">2. Historical Financial Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-[#1F4E79] text-white"><th className="text-left px-3 py-2">Item</th>{years.map(yr => <th key={yr} className="text-right px-3 py-2">FY{yr}</th>)}</tr></thead>
                <tbody>
                  <tr className="border-b"><td className="px-3 py-1.5 text-gray-700">Revenue</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5 font-medium">{fmt(ebitdaByYear[yr]?.revenue||0)}</td>)}</tr>
                  <tr className="border-b"><td className="px-3 py-1.5 text-gray-500 pl-6">Less: Cost of Sales</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5">({fmt(ebitdaByYear[yr]?.cos||0)})</td>)}</tr>
                  <tr className="border-b bg-emerald-50 font-semibold"><td className="px-3 py-1.5 text-emerald-800">Gross Profit</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5 text-emerald-800">{fmt(ebitdaByYear[yr]?.grossProfit||0)}</td>)}</tr>
                  <tr className="border-b"><td className="px-3 py-1.5 text-gray-500 pl-6">Other Income</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5">{fmt(ebitdaByYear[yr]?.otherIncome||0)}</td>)}</tr>
                  <tr className="border-b"><td className="px-3 py-1.5 text-gray-500 pl-6">Less: Operating Expenses</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5">({fmt(ebitdaByYear[yr]?.opex||0)})</td>)}</tr>
                  <tr className="border-b"><td className="px-3 py-1.5 text-gray-500 pl-6">Less: Depreciation</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5">({fmt(ebitdaByYear[yr]?.depreciation||0)})</td>)}</tr>
                  <tr className="border-b"><td className="px-3 py-1.5 text-gray-500 pl-6">Less: Interest</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5">({fmt(ebitdaByYear[yr]?.interest||0)})</td>)}</tr>
                  <tr className="border-b"><td className="px-3 py-1.5 text-gray-500 pl-6">Less: Tax</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5">({fmt(ebitdaByYear[yr]?.tax||0)})</td>)}</tr>
                  <tr className="border-b bg-gray-100 font-semibold"><td className="px-3 py-2 text-gray-800">Net Profit</td>{years.map(yr => <td key={yr} className="text-right px-3 py-2">{fmt(ebitdaByYear[yr]?.netProfit||0)}</td>)}</tr>
                  <tr className="border-b"><td className="px-3 py-1.5 text-[#2E75B6] pl-6">Add: Depreciation</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5 text-[#2E75B6]">{fmt(ebitdaByYear[yr]?.depreciation||0)}</td>)}</tr>
                  <tr className="border-b"><td className="px-3 py-1.5 text-[#2E75B6] pl-6">Add: Amortisation</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5 text-[#2E75B6]">{fmt(ebitdaByYear[yr]?.amortisation||0)}</td>)}</tr>
                  <tr className="border-b"><td className="px-3 py-1.5 text-[#2E75B6] pl-6">Add: Interest</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5 text-[#2E75B6]">{fmt(ebitdaByYear[yr]?.interest||0)}</td>)}</tr>
                  <tr className="border-b"><td className="px-3 py-1.5 text-[#2E75B6] pl-6">Add: Tax</td>{years.map(yr => <td key={yr} className="text-right px-3 py-1.5 text-[#2E75B6]">{fmt(ebitdaByYear[yr]?.tax||0)}</td>)}</tr>
                  <tr className="bg-[#1F4E79] text-white font-bold"><td className="px-3 py-2">EBITDA</td>{years.map(yr => <td key={yr} className="text-right px-3 py-2">{fmt(ebitdaByYear[yr]?.ebitda||0)}</td>)}</tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {years.map(yr => (
                <div key={yr} className="p-2 bg-gray-50 rounded-lg text-center">
                  <p className="text-[10px] text-gray-500">FY{yr}</p>
                  <p className="text-xs">GP: <strong>{ebitdaByYear[yr]?.revenue ? fmtPct(ebitdaByYear[yr].grossProfit/ebitdaByYear[yr].revenue) : '-'}</strong> | EBITDA: <strong>{ebitdaByYear[yr]?.revenue ? fmtPct(ebitdaByYear[yr].ebitda/ebitdaByYear[yr].revenue) : '-'}</strong></p>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Normalisation Schedule */}
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">3. Normalisation Adjustments</h2>
            {normItems.length === 0 ? <p className="text-sm text-gray-500 italic">No normalisation adjustments were made. The reported EBITDA has been adopted as the basis for valuation.</p> : (<>
              <p className="text-xs text-gray-500 mb-3">The following adjustments were considered to convert the reported EBITDA to a normalised basis reflecting sustainable future earnings for a hypothetical purchaser.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#1F4E79] text-white"><th className="text-left px-3 py-2">Adjustment</th><th className="text-left px-2 py-2">Category</th><th className="text-left px-2 py-2">Treatment</th>{years.map(yr => <th key={yr} className="text-right px-3 py-2">FY{yr}</th>)}<th className="text-center px-2 py-2">Status</th></tr></thead>
                  <tbody>
                    {normItems.map(item => (
                      <tr key={item.id} className={`border-b ${item.userDecision==='reject'?'bg-gray-50 opacity-60':''}`}>
                        <td className="px-3 py-1.5 font-medium">{item.lineItemName}</td>
                        <td className="px-2 py-1.5"><span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1F4E79] text-white font-medium">{NORM_CATEGORIES[item.category]||item.category}</span></td>
                        <td className="px-2 py-1.5 text-[10px]">{NORM_TREATMENTS[item.recommendedTreatment]}</td>
                        {years.map(yr => { const a = item.userDecision==='modify'?(item.userAmount[yr]||0):(item.amounts[yr]||0); return <td key={yr} className={`text-right px-3 py-1.5 ${a>0?'text-emerald-700':a<0?'text-red-600':''}`}>{a ? fmt(a) : '-'}</td> })}
                        <td className="text-center px-2 py-1.5"><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${item.userDecision==='accept'?'bg-emerald-100 text-emerald-800':item.userDecision==='reject'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-800'}`}>{item.userDecision==='accept'?'✓ Accepted':item.userDecision==='reject'?'✗ Rejected':'✎ Modified'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <table className="w-full text-sm mt-2">
                <tbody>
                  <tr className="border-b"><td className="py-1.5 text-gray-600">Reported EBITDA</td>{years.map(yr => <td key={yr} className="text-right py-1.5">{fmt(ebitdaByYear[yr]?.ebitda||0)}</td>)}</tr>
                  <tr className="border-b"><td className="py-1.5 text-gray-600">Net Adjustments (accepted)</td>{years.map(yr => { const adj = (normalisedEbitdaByYear[yr]||0)-(ebitdaByYear[yr]?.ebitda||0); return <td key={yr} className={`text-right py-1.5 ${adj>0?'text-emerald-700':adj<0?'text-red-600':''}`}>{fmt(adj)}</td> })}</tr>
                  <tr className="bg-[#1F4E79] text-white font-bold"><td className="py-2 px-2">Normalised EBITDA</td>{years.map(yr => <td key={yr} className="text-right py-2 px-2">{fmt(normalisedEbitdaByYear[yr]||0)}</td>)}</tr>
                </tbody>
              </table>
            </>)}
          </div>

          {/* 4. FME Derivation */}
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">4. Future Maintainable Earnings (FME)</h2>
            <p className="text-xs text-gray-500 mb-3">The normalised EBITDA for each year is weighted to derive a single earnings figure representing the sustainable future earning capacity of the business.</p>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-100"><th className="text-left px-3 py-2">Year</th><th className="text-right px-3 py-2">Normalised EBITDA</th><th className="text-right px-3 py-2">Weight</th><th className="text-right px-3 py-2">Contribution</th></tr></thead>
              <tbody>
                {weights.map(w => (
                  <tr key={w.year} className="border-b"><td className="px-3 py-2">FY{w.year}</td><td className="text-right px-3 py-2">{fmt(normalisedEbitdaByYear[w.year]||0)}</td><td className="text-right px-3 py-2">{w.weight}%</td><td className="text-right px-3 py-2 font-medium">{fmt((normalisedEbitdaByYear[w.year]||0)*w.weight/100)}</td></tr>
                ))}
                <tr className="bg-[#1F4E79] text-white font-bold"><td className="px-3 py-2" colSpan={2}>Future Maintainable Earnings (FME)</td><td className="text-right px-3 py-2">100%</td><td className="text-right px-3 py-2 text-lg">{fmt(fme)}</td></tr>
              </tbody>
            </table>
            {aiWeightReasoning && (<div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200"><p className="text-xs font-semibold text-blue-700 mb-1">Weighting Rationale</p><p className="text-xs text-blue-800">{aiWeightReasoning}</p></div>)}
          </div>

          {/* 5. Risk Analysis & Multiple Derivation */}
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">5. Risk Assessment & Multiple Derivation</h2>
            <p className="text-xs text-gray-500 mb-3">Six risk factors are assessed to derive an appropriate EBITDA capitalisation multiple. Each factor is scored 0 (lowest risk) to 10 (highest risk).</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-[#1F4E79] text-white"><th className="text-left px-3 py-2 w-[25%]">Risk Factor</th><th className="text-center px-2 py-2 w-[8%]">Low</th><th className="text-center px-2 py-2 w-[8%]">High</th><th className="text-left px-3 py-2">Assessment</th></tr></thead>
                <tbody>
                  {riskFactors.map(f => (
                    <tr key={f.id} className="border-b align-top"><td className="px-3 py-2 font-semibold text-[#1F4E79]">{f.name}</td><td className="text-center px-2 py-2"><span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">{f.scoreLow}</span></td><td className="text-center px-2 py-2"><span className="inline-block px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-bold">{f.scoreHigh}</span></td><td className="px-3 py-2 text-gray-600">{f.aiReasoning || '—'}</td></tr>
                  ))}
                  <tr className="bg-gray-100 font-bold"><td className="px-3 py-2">Composite Risk Score</td><td className="text-center px-2 py-2 text-emerald-800">{compositeScoreLow.toFixed(1)}</td><td className="text-center px-2 py-2 text-orange-800">{compositeScoreHigh.toFixed(1)}</td><td className="px-3 py-2 text-gray-500 font-normal text-[10px]">Weighted average (equal weighting)</td></tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-4 bg-[#F0F4F8] rounded-xl">
              <p className="text-xs text-gray-500 mb-3">Multiple derivation: risk score mapped to EBITDA multiple via linear interpolation (Score 2→5.0x, Score 5→3.0x, Score 9→1.0x, capped 1.0x–6.0x for Australian SMEs).</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-white rounded-lg shadow-sm"><p className="text-[10px] text-gray-500">EBITDA Multiple</p><p className="text-lg font-bold text-[#1F4E79]">{multipleLow.toFixed(2)}x – {multipleHigh.toFixed(2)}x</p></div>
                <div className="text-center p-3 bg-white rounded-lg shadow-sm"><p className="text-[10px] text-gray-500">FME</p><p className="text-lg font-bold text-[#1F4E79]">{fmt(fme)}</p></div>
                <div className="text-center p-3 bg-[#1F4E79] rounded-lg text-white"><p className="text-[10px] text-blue-200">Enterprise Value</p><p className="text-lg font-bold">{fmt(valuation.evLow)} – {fmt(valuation.evHigh)}</p></div>
              </div>
            </div>
            {industryAnalysis && (<div className="mt-4 p-4 bg-gray-50 rounded-lg border"><p className="text-xs font-semibold text-gray-700 mb-2">Industry Analysis</p><p className="text-xs text-gray-600 whitespace-pre-line">{industryAnalysis}</p></div>)}
          </div>

          {/* 6. Balance Sheet & Equity Build-up */}
          {engagement.valuationScope === 'equity' && (
            <div className={sc}>
              <h2 className="text-lg font-bold text-[#1F4E79] mb-3">6. Balance Sheet Adjustments & Equity Value</h2>
              <p className="text-xs text-gray-500 mb-3">Each balance sheet item is classified to determine its treatment. Operating fixed assets are within the enterprise value. All other items are separately added or deducted.</p>
              {bsItems.filter(b => b.classification === 'in_ev').length > 0 && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg border"><p className="text-xs font-semibold text-gray-600 mb-1">🔧 Operating Fixed Assets (within enterprise value — reference only)</p><div className="flex flex-wrap gap-3">{bsItems.filter(b => b.classification === 'in_ev').map(b => (<span key={b.id} className="text-xs text-gray-500">{b.name}: {fmt(b.adjustedValue || (b.amounts[years[0]]||0))}</span>))}</div></div>
              )}
              <table className="w-full text-sm">
                <tbody>
                  <tr className="bg-blue-50 border-b-2 border-[#1F4E79]"><td className="py-2.5 px-3 font-bold text-[#1F4E79]">Enterprise Value</td><td className="text-right py-2.5 px-3 font-bold text-[#1F4E79]">{fmt(valuation.evLow)}</td><td className="text-right py-2.5 px-3 font-bold text-[#1F4E79]">{fmt(valuation.evHigh)}</td></tr>
                  <tr className="bg-emerald-50/60"><td colSpan={3} className="py-1.5 px-3 font-semibold text-emerald-800 text-xs border-b">➕ Assets Transferring to Buyer</td></tr>
                  {bsItems.filter(b => b.classification === 'transfer_asset').map(b => { const v = b.adjustedValue || (b.amounts[years[0]]||0); return <tr key={b.id} className="border-b border-gray-100"><td className="py-1 px-3 pl-6 text-xs text-gray-600">{b.name}{b.userNotes ? <span className="text-gray-400 ml-1">— {b.userNotes}</span> : ''}</td><td className="text-right py-1 px-3 text-xs text-emerald-700" colSpan={2}>{fmt(v)}</td></tr> })}
                  <tr className="bg-emerald-50 border-b"><td className="py-1.5 px-3 font-semibold text-xs text-emerald-900">Subtotal</td><td className="text-right py-1.5 px-3 font-bold text-emerald-900" colSpan={2}>{fmt(valuation.transferAssets)}</td></tr>
                  <tr className="bg-orange-50/60"><td colSpan={3} className="py-1.5 px-3 font-semibold text-orange-800 text-xs border-b">➖ Liabilities Transferring to Buyer</td></tr>
                  {bsItems.filter(b => b.classification === 'transfer_liability').map(b => { const v = Math.abs(b.adjustedValue || (b.amounts[years[0]]||0)); return <tr key={b.id} className="border-b border-gray-100"><td className="py-1 px-3 pl-6 text-xs text-gray-600">{b.name}{b.userNotes ? <span className="text-gray-400 ml-1">— {b.userNotes}</span> : ''}</td><td className="text-right py-1 px-3 text-xs text-orange-700" colSpan={2}>({fmt(v)})</td></tr> })}
                  <tr className="bg-orange-50 border-b"><td className="py-1.5 px-3 font-semibold text-xs text-orange-900">Subtotal</td><td className="text-right py-1.5 px-3 font-bold text-orange-900" colSpan={2}>({fmt(valuation.transferLiabilities)})</td></tr>
                  <tr className="bg-gray-100 border-b"><td className="py-2 px-3 font-bold text-gray-800">Net Transferring to Buyer</td><td className="text-right py-2 px-3 font-bold text-gray-800" colSpan={2}>{fmt(valuation.netTransferring)}</td></tr>
                  {valuation.surplusAssets > 0 && (<><tr className="bg-blue-50/60"><td colSpan={3} className="py-1.5 px-3 font-semibold text-blue-800 text-xs border-b">⭐ Surplus Assets</td></tr>{bsItems.filter(b => b.classification === 'surplus').map(b => { const v = b.adjustedValue || (b.amounts[years[0]]||0); return <tr key={b.id} className="border-b border-gray-100"><td className="py-1 px-3 pl-6 text-xs text-gray-600">{b.name}</td><td className="text-right py-1 px-3 text-xs text-blue-700" colSpan={2}>{fmt(v)}</td></tr> })}<tr className="bg-blue-50 border-b"><td className="py-1.5 px-3 font-semibold text-xs text-blue-900">Subtotal</td><td className="text-right py-1.5 px-3 font-bold text-blue-900" colSpan={2}>{fmt(valuation.surplusAssets)}</td></tr></>)}
                  {valuation.netDebt > 0 && (<><tr className="bg-red-50/60"><td colSpan={3} className="py-1.5 px-3 font-semibold text-red-800 text-xs border-b">🏦 Interest-Bearing Debt</td></tr>{bsItems.filter(b => b.classification === 'debt').map(b => { const v = Math.abs(b.adjustedValue || (b.amounts[years[0]]||0)); return <tr key={b.id} className="border-b border-gray-100"><td className="py-1 px-3 pl-6 text-xs text-gray-600">{b.name}</td><td className="text-right py-1 px-3 text-xs text-red-700" colSpan={2}>({fmt(v)})</td></tr> })}<tr className="bg-red-50 border-b"><td className="py-1.5 px-3 font-semibold text-xs text-red-900">Subtotal</td><td className="text-right py-1.5 px-3 font-bold text-red-900" colSpan={2}>({fmt(valuation.netDebt)})</td></tr></>)}
                  <tr className="bg-gray-200 border-b"><td className="py-2 px-3 font-bold text-gray-800">Total Balance Sheet Adjustment</td><td className="text-right py-2 px-3 font-bold text-gray-900" colSpan={2}>{fmt(valuation.netBsAdjustment)}</td></tr>
                  <tr className="bg-[#1F4E79] text-white"><td className="py-3 px-3 font-bold">Equity Value</td><td className="text-right py-3 px-3 font-bold">{fmt(valuation.eqLow)}</td><td className="text-right py-3 px-3 font-bold">{fmt(valuation.eqHigh)}</td></tr>
                  <tr className="bg-[#2E75B6] text-white"><td className="py-3 px-3 font-bold text-lg" colSpan={2}>Midpoint Equity Value</td><td className="text-right py-3 px-3 font-bold text-2xl">{fmt(valuation.eqMid)}</td></tr>
                </tbody>
              </table>
              {(discounts.applyMinority || discounts.applyMarketability) && (
                <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm font-bold text-amber-900 mb-2">Discounts Applied</p>
                  {discounts.applyMinority && <p className="text-xs text-amber-700">Minority discount: {discounts.minorityDiscount}%{discounts.minorityReasoning ? ` — ${discounts.minorityReasoning}` : ''}</p>}
                  {discounts.applyMarketability && <p className="text-xs text-amber-700">Marketability discount: {discounts.marketabilityDiscount}%{discounts.marketabilityReasoning ? ` — ${discounts.marketabilityReasoning}` : ''}</p>}
                  <p className="text-lg font-bold text-amber-900 mt-2">Post-discount: {fmt(valuation.finalLow)} – {fmt(valuation.finalHigh)} (midpoint: {fmt(valuation.finalMid)})</p>
                </div>
              )}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                <p className="text-xs font-semibold text-gray-600 mb-1">Implied Goodwill</p>
                <p className="text-xs text-gray-500">Enterprise Value (mid): {fmt((valuation.evLow+valuation.evHigh)/2)} less Operating Fixed Assets: {fmt(valuation.inEvAssets)} = <strong>{fmt((valuation.evLow+valuation.evHigh)/2 - valuation.inEvAssets)}</strong></p>
              </div>
            </div>
          )}

          {/* 7. Cross-Checks */}
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">{engagement.valuationScope === 'equity' ? '7' : '6'}. Cross-Checks & Reasonableness</h2>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="p-4 bg-[#F0F4F8] rounded-xl border"><p className="text-[10px] text-gray-500 mb-1">Implied Revenue Multiple</p><p className="text-lg font-bold text-[#1F4E79]">{valuation.impliedRevMultLow.toFixed(2)}x – {valuation.impliedRevMultHigh.toFixed(2)}x</p><p className="text-xs text-gray-500 mt-1">Based on revenue of {fmt(ebitdaByYear[years[0]]?.revenue||0)}</p></div>
              <div className="p-4 bg-[#F0F4F8] rounded-xl border"><p className="text-[10px] text-gray-500 mb-1">Equipment Floor Value</p><p className="text-lg font-bold text-[#1F4E79]">{fmt(valuation.equipmentFloor)}</p><p className="text-xs text-gray-500 mt-1">Realisable value of operating fixed assets</p></div>
            </div>
            {valuation.floorExceeded && (<div className="p-3 bg-red-50 border border-red-300 rounded-lg"><p className="text-sm font-bold text-red-700">⚠️ Equipment Floor Exceeds Enterprise Value</p><p className="text-xs text-red-600 mt-1">Tangible assets ({fmt(valuation.equipmentFloor)}) exceed enterprise value ({fmt(valuation.evHigh)}). Consider break-up basis.</p></div>)}
          </div>

          {/* 8. Sensitivity Analysis */}
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">{engagement.valuationScope === 'equity' ? '8' : '7'}. Sensitivity Analysis</h2>
            <p className="text-xs text-gray-500 mb-3">Enterprise value under different FME (±15%) and multiple assumptions. Highlighted cell is the base case.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#1F4E79] text-white"><th className="px-4 py-2.5 text-left">FME Scenario</th><th className="text-right px-4 py-2.5">{multipleLow.toFixed(1)}x (Low)</th><th className="text-right px-4 py-2.5">{((multipleLow+multipleHigh)/2).toFixed(1)}x (Mid)</th><th className="text-right px-4 py-2.5">{multipleHigh.toFixed(1)}x (High)</th></tr></thead>
                <tbody>
                  {['Conservative (85%)','Base (100%)','Optimistic (115%)'].map((label, i) => (
                    <tr key={label} className={`border-b ${i===1?'bg-[#F0F4F8]':''}`}><td className={`px-4 py-2.5 ${i===1?'font-bold':''}`}>{label} <span className="text-gray-400">{fmt(fme*(i===0?0.85:i===1?1:1.15))}</span></td>{sensitivity[i].map((v,j) => <td key={j} className={`text-right px-4 py-2.5 ${i===1&&j===1?'font-bold text-[#1F4E79] bg-blue-100 rounded':''}`}>{fmt(v)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Disclaimers */}
          <div className={sc}>
            <h2 className="text-lg font-bold text-[#1F4E79] mb-3">Important Disclaimers & Limitations</h2>
            <div className="text-xs text-gray-600 space-y-3 leading-relaxed">
              <p><strong>Basis of valuation:</strong> This valuation has been prepared using the Capitalisation of Future Maintainable Earnings method. It represents an estimate of fair market value — the price negotiated in an open, unrestricted market between knowledgeable, willing but not anxious parties acting at arm&apos;s length.</p>
              <p><strong>Financial information:</strong> No audit or independent verification of the underlying financial information has been performed. The accuracy of this valuation depends on the completeness and accuracy of the information provided.</p>
              <p><strong>Economic conditions:</strong> This valuation is based on conditions prevailing at the valuation date of {engagement.valuationDate}. Conditions can change significantly over short periods.</p>
              <p><strong>Professional standards:</strong> This output is aligned with APES 225 Valuation Services principles but constitutes a <strong>calculation engagement</strong> only. For a formal valuation engagement, the output should be independently reviewed by a qualified valuer.</p>
              <p><strong>Limitation of liability:</strong> This valuation is provided for the stated purpose only. Users should obtain independent professional advice before making decisions based on this output. Consultants for Accountants Pty Ltd accepts no liability for loss arising from use of this tool.</p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-[10px] text-gray-400">Prepared using BAKR Business Valuation Tool — Consultants for Accountants Pty Ltd | bakr.com.au</p>
            </div>
          </div>

          {/* Phase 3 note */}
          <div className="p-6 bg-[#F0F4F8] border-2 border-[#2E75B6] rounded-2xl text-center">
            <p className="text-lg font-bold text-[#1F4E79] mb-2">📄 Download Valuation Report</p>
            <p className="text-xs text-gray-500 mb-4">Generate a professional Word document containing all calculations, tables, and disclaimers shown above.</p>
            <button className={bp + " text-base px-8 py-3"} onClick={generateDocx} disabled={isProcessing}>
              {isProcessing ? '⏳ Generating...' : '📥 Download DOCX Report'}
            </button>
            {processingMsg && step === 9 && <p className="text-sm text-[#2E75B6] mt-3">{processingMsg}</p>}
          </div>

          <div className="flex justify-start">
            <button className={bs} onClick={() => setStepAndScroll(8)}>← Back to Valuation</button>
          </div>
        </div>)}
      </div>

      {/* ═══ MODALS ════════════════════════════════════════════════════ */}
      <Modal open={activeModal==='what-is-ebitda'} onClose={() => setActiveModal(null)} title="What is EBITDA?">
        <p><strong>EBITDA</strong> stands for Earnings Before Interest, Tax, Depreciation and Amortisation. It measures a business&apos;s operating profitability before capital structure decisions (how you finance the business) and non-cash accounting charges.</p>
        <p><strong>Why use it for valuation?</strong> Because different buyers will finance the acquisition differently (some with debt, some with cash), and depreciation policies vary between businesses. EBITDA strips these out so you can compare the core earning power of different businesses on a level playing field.</p>
        <p><strong>How it&apos;s calculated:</strong> Net Profit + Depreciation + Amortisation + Interest + Tax = EBITDA</p>
      </Modal>

      <Modal open={activeModal==='what-is-sde'} onClose={() => setActiveModal(null)} title="What is SDE?">
        <p><strong>SDE</strong> (Seller&apos;s Discretionary Earnings) equals EBITDA plus the owner&apos;s total compensation (salary, superannuation, benefits, personal expenses run through the business).</p>
        <p><strong>When to use it:</strong> SDE is used when the buyer will be an owner-operator who replaces the current owner. The buyer &quot;pays themselves&quot; from the SDE — what remains after their salary services the purchase price.</p>
        <p><strong>When to use EBITDA instead:</strong> Use EBITDA when the buyer will install professional management (e.g., a corporate acquirer or competitor). They already have management so the owner&apos;s salary is a real cost they&apos;ll need to replace.</p>
      </Modal>

      <Modal open={activeModal==='enterprise-vs-equity'} onClose={() => setActiveModal(null)} title="Enterprise Value vs Equity Value">
        <p><strong>Enterprise Value</strong> is the value of the business operations — what the business earns multiplied by an appropriate multiple. Think of it as the value of the &quot;engine&quot; of the business.</p>
        <p><strong>Equity Value</strong> is what the shares are actually worth. It takes the enterprise value and adjusts for:</p>
        <p>• <strong>Plus</strong> surplus assets (things the business owns but doesn&apos;t need for operations, like excess cash, investments, or loans to directors)</p>
        <p>• <strong>Minus</strong> net debt (finance loans, HP agreements, credit cards)</p>
        <p>• <strong>Minus</strong> any working capital deficiency (if the business needs more working capital than it currently has)</p>
        <p><strong>For a share sale</strong>, you need equity value. For an asset sale (buying just the business operations), enterprise value is usually sufficient.</p>
      </Modal>

      <Modal open={activeModal==='what-is-normalisation'} onClose={() => setActiveModal(null)} title="What is Normalisation?">
        <p>Normalisation is the process of adjusting a business&apos;s historical profits to show what a <strong>new owner</strong> could expect to earn. We remove expenses that are personal to the current owner or won&apos;t continue after a sale.</p>
        <p><strong>Common adjustments include:</strong></p>
        <p>• <strong>Owner compensation:</strong> The owner may be paying themselves above or below market rate. We adjust to what it would cost to hire someone for their role.</p>
        <p>• <strong>Personal expenses:</strong> Travel, entertainment, motor vehicles, memberships that are really for the owner&apos;s personal benefit, not business necessity.</p>
        <p>• <strong>Related party transactions:</strong> Rent paid to the owner&apos;s property trust, management fees to the owner&apos;s other companies — these may be above or below market rate.</p>
        <p>• <strong>Non-recurring items:</strong> One-off legal fees, restructuring costs, insurance claims, government grants — things that won&apos;t happen again.</p>
        <p>• <strong>Non-operating items:</strong> Investment income, rental income from non-core property — these are valued separately as surplus assets.</p>
        <p>Each adjustment directly affects the valuation. At a 3x multiple, every $10,000 adjustment changes the business value by $30,000.</p>
      </Modal>

      <Modal open={activeModal==='norm-categories'} onClose={() => setActiveModal(null)} title="Normalisation Categories Explained">
        <p><strong>Owner Compensation:</strong> If the owner takes $250k but a replacement manager would cost $150k, we add back $100k. If the owner takes $80k but should take $150k, we deduct $70k. This works both ways.</p>
        <p><strong>Related Party:</strong> Rent paid to the owner&apos;s SMSF, management fees to associated entities, wages to family members not actively working. Adjusted to what arm&apos;s length transactions would cost.</p>
        <p><strong>Personal / Discretionary:</strong> Donations, sponsorships, owner&apos;s travel, club memberships, personal motor vehicle costs. These stop when the business sells.</p>
        <p><strong>Non-Recurring:</strong> Lawsuit settlements, COVID grants, one-off restructuring costs, major bad debt write-offs. By definition, these won&apos;t happen again.</p>
        <p><strong>Non-Operating:</strong> Interest income, dividend income, rental income from unrelated property. These relate to assets that are valued separately, not to the business operations.</p>
      </Modal>

      <Modal open={activeModal==='balance-sheet-classification'} onClose={() => setActiveModal(null)} title="Balance Sheet Classification Guide">
        <p><strong>Every balance sheet item falls into one of five categories:</strong></p>
        <div className="bg-gray-50 p-3 rounded-lg mb-2">
          <p className="font-bold text-gray-700">🔧 In Enterprise Value</p>
          <p>Operating fixed assets needed to earn the EBITDA: plant &amp; equipment, vehicles, leasehold improvements. The EBITDA multiple already prices these in — they are NOT added separately.</p>
        </div>
        <div className="bg-emerald-50 p-3 rounded-lg mb-2">
          <p className="font-bold text-emerald-800">➕ Transfers to Buyer (Asset)</p>
          <p>Current assets that transfer on settlement: cash, trade debtors, stock/inventory, prepayments, tax assets. These are ADDED to the enterprise value because the buyer receives them.</p>
        </div>
        <div className="bg-orange-50 p-3 rounded-lg mb-2">
          <p className="font-bold text-orange-800">➖ Transfers to Buyer (Liability)</p>
          <p>Current liabilities that transfer on settlement: trade creditors, employee provisions (annual leave, LSL), tax liabilities, GST payable. These are DEDUCTED because the buyer inherits the obligation to pay them.</p>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg mb-2">
          <p className="font-bold text-blue-800">⭐ Surplus Assets</p>
          <p>Non-operating assets: excess cash beyond working needs, investments, director loans, non-operating property. ADDED to enterprise value.</p>
        </div>
        <div className="bg-red-50 p-3 rounded-lg mb-2">
          <p className="font-bold text-red-800">🏦 Interest-Bearing Debt</p>
          <p>Bank loans, hire purchase, finance leases, equipment finance. NOT trade creditors. DEDUCTED — buyer expects seller to repay on settlement.</p>
        </div>
        <div className="bg-amber-50 p-3 rounded-lg mb-2">
          <p className="font-bold text-amber-800">📋 Goodwill (Replaced)</p>
          <p>Existing goodwill or intangibles on the balance sheet from a prior acquisition. EXCLUDED — replaced by the goodwill derived from this valuation. Also use for equity items (share capital, retained earnings).</p>
        </div>
      </Modal>

      <Modal open={activeModal==='working-capital-explained'} onClose={() => setActiveModal(null)} title="Working Capital Adjustment">
        <p><strong>Working capital</strong> = Current operating assets (debtors, stock) minus current operating liabilities (creditors, provisions). It&apos;s the day-to-day funding the business needs to operate.</p>
        <p><strong>When to adjust:</strong> If the business has significantly less working capital than it needs (e.g., a large creditor backlog), a buyer would need to inject cash to normalise it. This reduces the equity value.</p>
        <p><strong>When NOT to adjust:</strong> If working capital is adequate for the business&apos;s needs, no adjustment is needed. A modest surplus is normal and doesn&apos;t add to value.</p>
        <p><strong>How to calculate:</strong> Compare current operating assets to current operating liabilities. If there&apos;s a material deficiency compared to what the business needs, enter the shortfall as a negative adjustment.</p>
      </Modal>

      <Modal open={activeModal==='what-is-fme'} onClose={() => setActiveModal(null)} title="Future Maintainable Earnings (FME)">
        <p><strong>FME</strong> represents the level of earnings the business can reasonably be expected to generate going forward. It&apos;s the number we multiply by the EBITDA multiple to get the enterprise value.</p>
        <p><strong>How it&apos;s derived:</strong> We take the normalised EBITDA for each year and apply weights. More recent years typically get higher weight because they better reflect current performance.</p>
        <p><strong>Why not just use the latest year?</strong> Because one year might be unusually good or bad. Weighting across multiple years smooths out anomalies and gives a more reliable picture of sustainable earnings.</p>
        <p><strong>Adjusting weights:</strong> If a particular year was affected by unusual circumstances (COVID, one-off customer loss, restructuring), you can reduce its weight and explain why. Your explanation is included in the valuation report.</p>
      </Modal>

      <Modal open={activeModal==='risk-scoring-explained'} onClose={() => setActiveModal(null)} title="Risk Scoring & EBITDA Multiple">
        <p><strong>The EBITDA multiple</strong> reflects how risky the business is. A safer, more predictable business commands a higher multiple (meaning a higher price relative to earnings). A riskier business gets a lower multiple.</p>
        <p><strong>How we derive it:</strong> Six risk factors are scored from 0 (very low risk) to 10 (very high risk). Each has a low (optimistic) and high (conservative) score to create a range. The weighted average produces a composite risk score, which maps to a multiple:</p>
        <p>• Risk score 2–3 → Multiple of ~5x (safe, predictable business)</p>
        <p>• Risk score 5 → Multiple of ~3x (moderate risk)</p>
        <p>• Risk score 8–9 → Multiple of ~1x (very high risk)</p>
        <p><strong>For Australian SMEs</strong>, typical multiples range from 1x to 6x EBITDA. Larger businesses with more predictable earnings trade at higher multiples.</p>
      </Modal>

      <Modal open={activeModal==='equipment-floor'} onClose={() => setActiveModal(null)} title="Equipment Floor Value Check">
        <p>The <strong>equipment floor value</strong> is the total realisable value of all tangible business assets (plant, equipment, vehicles, stock). This serves as a &quot;sanity check&quot; on the enterprise value.</p>
        <p><strong>If tangible assets exceed the enterprise value</strong>, it means the business would be worth more if you sold all the equipment individually than if you sold it as a going concern. This suggests either:</p>
        <p>• The business isn&apos;t generating adequate returns on its asset base</p>
        <p>• The business may be worth more on a break-up/liquidation basis</p>
        <p>• The EBITDA multiple may need reconsideration</p>
        <p>This doesn&apos;t mean the equipment value gets added to the enterprise value — it&apos;s a warning flag for further investigation.</p>
      </Modal>

      <Modal open={activeModal==='discounts-explained'} onClose={() => setActiveModal(null)} title="Valuation Discounts">
        <p><strong>Minority Discount</strong> (typically 15–30%): Applied when valuing less than 100% of the shares. A minority shareholder has less control and therefore their shares are worth proportionally less than a controlling interest.</p>
        <p><strong>Marketability Discount</strong> (typically 10–25%): Private company shares can&apos;t be easily sold on a stock exchange. This lack of liquidity means they&apos;re worth less than equivalent listed shares. Common for private companies where there&apos;s no ready market for the shares.</p>
        <p><strong>When NOT to apply:</strong> If valuing 100% of the business for a full sale, no minority discount is needed. If the purpose is to set a price between willing buyer and seller, the marketability discount may not be appropriate.</p>
      </Modal>

      <Modal open={activeModal==='sensitivity-explained'} onClose={() => setActiveModal(null)} title="Understanding the Sensitivity Matrix">
        <p>The sensitivity matrix shows how the valuation changes under different assumptions. It tests three scenarios for FME (Conservative at 85%, Base at 100%, Optimistic at 115%) against three multiple scenarios (Low, Mid, High).</p>
        <p><strong>How to read it:</strong> The centre cell (Base FME × Mid Multiple) is the most likely value. The corners show the extreme range. If you believe the business is more likely to maintain its earnings, focus on the right column. If you&apos;re cautious, focus on the left.</p>
        <p><strong>Why it matters:</strong> Valuation is inherently uncertain. The matrix shows the range of reasonable outcomes and helps both buyer and seller understand where the true value likely falls.</p>
      </Modal>

      <Modal open={activeModal==='how-to-upload'} onClose={() => setActiveModal(null)} title="How to Upload Financial Statements">
        <p><strong>What to upload:</strong> The financial statements prepared by the business&apos;s accountant. This is usually a single PDF containing the Profit &amp; Loss, Balance Sheet, Notes, and sometimes a Depreciation Schedule.</p>
        <p><strong>Minimum requirement:</strong> P&amp;L and Balance Sheet for at least 2 financial years (3 is better).</p>
        <p><strong>Best results:</strong> Upload the full accountant&apos;s report including Notes and Fixed Asset Schedule. The AI extracts everything relevant.</p>
        <p><strong>Multiple years in separate files?</strong> That&apos;s fine — upload them all under &quot;Financial Statements&quot;. The AI will combine the data.</p>
        <p><strong>General Ledger (optional):</strong> If the bookkeeper can export the GL as Excel or CSV, upload it separately. This gives the AI transaction-level detail for better normalisation analysis.</p>
        <p><strong>After uploading:</strong> Click &quot;Parse with AI&quot; and wait 30-60 seconds. The AI will extract all line items and present them for your review. You can correct any errors before proceeding.</p>
      </Modal>

      <Modal open={activeModal==='ebitda-workings'} onClose={() => setActiveModal(null)} title="EBITDA Calculation Workings">
        <p><strong>The EBITDA build-up for each year:</strong></p>
        {years.map(yr => {
          const d = ebitdaByYear[yr]
          if (!d) return null
          return (
            <div key={yr} className="bg-gray-50 p-3 rounded-lg mb-2">
              <p className="font-bold text-[#1F4E79] mb-1">FY{yr}</p>
              <p>Revenue: {fmt(d.revenue)}</p>
              <p>Less Cost of Sales: ({fmt(d.cos)})</p>
              <p className="font-semibold">= Gross Profit: {fmt(d.grossProfit)}</p>
              <p>Plus Other Income: {fmt(d.otherIncome)}</p>
              <p>Less Operating Expenses: ({fmt(d.opex)})</p>
              <p>Less Depreciation: ({fmt(d.depreciation)})</p>
              <p>Less Amortisation: ({fmt(d.amortisation)})</p>
              <p>Less Interest: ({fmt(d.interest)})</p>
              <p>Less Tax: ({fmt(d.tax)})</p>
              <p className="font-semibold">= Net Profit: {fmt(d.netProfit)}</p>
              <p className="mt-2">Add back: Depreciation {fmt(d.depreciation)} + Amortisation {fmt(d.amortisation)} + Interest {fmt(d.interest)} + Tax {fmt(d.tax)}</p>
              <p className="font-bold text-[#1F4E79]">= EBITDA: {fmt(d.ebitda)}</p>
            </div>
          )
        })}
      </Modal>

      <Modal open={activeModal==='normalised-ebitda-workings'} onClose={() => setActiveModal(null)} title="Normalised EBITDA Workings">
        {years.map(yr => {
          const base = ebitdaByYear[yr]?.ebitda || 0
          const adjustments = normItems.filter(n => n.userDecision !== 'reject')
          return (
            <div key={yr} className="bg-gray-50 p-3 rounded-lg mb-2">
              <p className="font-bold text-[#1F4E79] mb-1">FY{yr}</p>
              <p>Reported EBITDA: {fmt(base)}</p>
              {adjustments.map(item => {
                const amt = item.userDecision === 'modify' ? (item.userAmount[yr] || 0) : (item.amounts[yr] || 0)
                if (amt === 0) return null
                return <p key={item.id}>{item.recommendedTreatment === 'add_back' ? '+' : '-'} {item.lineItemName}: {fmt(amt)}</p>
              })}
              <p className="font-bold text-[#1F4E79]">= Normalised EBITDA: {fmt(normalisedEbitdaByYear[yr] || 0)}</p>
            </div>
          )
        })}
      </Modal>

      <Modal open={activeModal==='fme-workings'} onClose={() => setActiveModal(null)} title="FME Calculation Workings">
        <p><strong>Weighted average of normalised EBITDA:</strong></p>
        <div className="bg-gray-50 p-3 rounded-lg">
          {weights.map(w => (
            <p key={w.year}>FY{w.year}: {fmt(normalisedEbitdaByYear[w.year] || 0)} × {w.weight}% = {fmt((normalisedEbitdaByYear[w.year] || 0) * w.weight / 100)}</p>
          ))}
          <p className="font-bold text-[#1F4E79] mt-2 border-t pt-2">FME = {fmt(fme)}</p>
        </div>
      </Modal>

      <Modal open={activeModal==='multiple-workings'} onClose={() => setActiveModal(null)} title="EBITDA Multiple Derivation Workings">
        <p><strong>Risk factor scores and weighted calculation:</strong></p>
        <div className="bg-gray-50 p-3 rounded-lg mb-2">
          {riskFactors.map(f => (
            <p key={f.id}>{f.name}: Low {f.scoreLow}/10, High {f.scoreHigh}/10 (weight: {f.weight.toFixed(1)}%)</p>
          ))}
          <p className="font-semibold mt-2 border-t pt-2">Composite Risk Score: {compositeScoreLow.toFixed(2)} (low) – {compositeScoreHigh.toFixed(2)} (high)</p>
        </div>
        <p><strong>Mapping risk score to multiple:</strong></p>
        <p>Score {compositeScoreLow.toFixed(2)} → Multiple {multipleHigh.toFixed(2)}x (optimistic)</p>
        <p>Score {compositeScoreHigh.toFixed(2)} → Multiple {multipleLow.toFixed(2)}x (conservative)</p>
        <p className="mt-2"><strong>Formula:</strong> Score ≤2 = 5.0x; Score 5 = 3.0x; Score ≥9 = 1.0x; linear interpolation between.</p>
      </Modal>

      <Modal open={activeModal==='valuation-workings'} onClose={() => setActiveModal(null)} title="Valuation Calculation Workings">
        <div className="bg-gray-50 p-3 rounded-lg space-y-1">
          <p>FME: {fmt(fme)}</p>
          <p>× Multiple (Low): {multipleLow.toFixed(2)}x → Enterprise Value: {fmt(valuation.evLow)}</p>
          <p>× Multiple (High): {multipleHigh.toFixed(2)}x → Enterprise Value: {fmt(valuation.evHigh)}</p>
          {engagement.valuationScope === 'equity' && (<>
            <p className="mt-2 border-t pt-2 font-semibold">Balance Sheet Adjustments:</p>
            <p className="text-emerald-700">Plus Transferring Assets: {fmt(valuation.transferAssets)}</p>
            <p className="text-orange-700">Less Transferring Liabilities: ({fmt(valuation.transferLiabilities)})</p>
            <p className="font-semibold">= Net Transferring: {fmt(valuation.netTransferring)}</p>
            {valuation.surplusAssets > 0 && <p className="text-blue-700">Plus Surplus Assets: {fmt(valuation.surplusAssets)}</p>}
            {valuation.netDebt > 0 && <p className="text-red-700">Less Debt: ({fmt(valuation.netDebt)})</p>}
            <p className="font-bold border-t pt-2">Total BS Adjustment: {fmt(valuation.netBsAdjustment)}</p>
            <p className="mt-2 border-t pt-2 font-semibold">Equity Value (Low):</p>
            <p>{fmt(valuation.evLow)} + {fmt(valuation.netBsAdjustment)} = {fmt(valuation.eqLow)}</p>
            <p className="font-semibold">Equity Value (High):</p>
            <p>{fmt(valuation.evHigh)} + {fmt(valuation.netBsAdjustment)} = {fmt(valuation.eqHigh)}</p>
            <p className="font-bold text-[#1F4E79] text-lg mt-2 border-t pt-2">Midpoint: {fmt(valuation.eqMid)}</p>
          </>)}
        </div>
      </Modal>

      <Modal open={activeModal==='bs-surplus-workings'} onClose={() => setActiveModal(null)} title="Balance Sheet Adjustment Breakdown">
        <p><strong>Transferring Assets</strong> (added):</p>
        <div className="bg-emerald-50 p-3 rounded-lg mb-2">
          {bsItems.filter(b => b.classification === 'transfer_asset').length === 0 ? <p className="text-gray-400">None</p> :
            bsItems.filter(b => b.classification === 'transfer_asset').map(b => (
              <p key={b.id}>{b.name}: {fmt(b.adjustedValue || (b.amounts[years[0]] || 0))}</p>
            ))
          }
          <p className="font-bold border-t mt-1 pt-1">Total: {fmt(valuation.transferAssets)}</p>
        </div>
        <p><strong>Transferring Liabilities</strong> (deducted):</p>
        <div className="bg-orange-50 p-3 rounded-lg mb-2">
          {bsItems.filter(b => b.classification === 'transfer_liability').length === 0 ? <p className="text-gray-400">None</p> :
            bsItems.filter(b => b.classification === 'transfer_liability').map(b => (
              <p key={b.id}>{b.name}: ({fmt(Math.abs(b.adjustedValue || (b.amounts[years[0]] || 0)))})</p>
            ))
          }
          <p className="font-bold border-t mt-1 pt-1">Total: ({fmt(valuation.transferLiabilities)})</p>
        </div>
        <p className="font-bold">Net Transferring: {fmt(valuation.netTransferring)}</p>
        {valuation.surplusAssets > 0 && (<>
          <p className="mt-2"><strong>Surplus Assets</strong> (added):</p>
          <div className="bg-blue-50 p-3 rounded-lg mb-2">
            {bsItems.filter(b => b.classification === 'surplus').map(b => (
              <p key={b.id}>{b.name}: {fmt(b.adjustedValue || (b.amounts[years[0]] || 0))}</p>
            ))}
            <p className="font-bold border-t mt-1 pt-1">Total: {fmt(valuation.surplusAssets)}</p>
          </div>
        </>)}
        {valuation.netDebt > 0 && (<>
          <p><strong>Interest-Bearing Debt</strong> (deducted):</p>
          <div className="bg-red-50 p-3 rounded-lg mb-2">
            {bsItems.filter(b => b.classification === 'debt').map(b => (
              <p key={b.id}>{b.name}: ({fmt(Math.abs(b.adjustedValue || (b.amounts[years[0]] || 0)))})</p>
            ))}
            <p className="font-bold border-t mt-1 pt-1">Total: ({fmt(valuation.netDebt)})</p>
          </div>
        </>)}
        <p className="font-bold text-[#1F4E79] text-lg mt-2 border-t pt-2">Total BS Adjustment: {fmt(valuation.netBsAdjustment)}</p>
      </Modal>

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
