/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'

// ─── TAX HELPERS (2024-25) ───────────────────────────────────────────────────
function incomeTax(inc: number): number {
  if (inc <= 18200) return 0
  if (inc <= 45000) return (inc - 18200) * 0.19
  if (inc <= 120000) return 5092 + (inc - 45000) * 0.325
  if (inc <= 180000) return 29467 + (inc - 120000) * 0.37
  return 51667 + (inc - 180000) * 0.45
}
function litoAmt(inc: number): number {
  if (inc <= 37500) return 700
  if (inc <= 45000) return Math.max(0, 700 - (inc - 37500) * 0.015)
  if (inc <= 66667) return Math.max(0, 325 - (inc - 45000) * 0.015)
  return 0
}
function medicare(inc: number): number { return inc <= 26000 ? 0 : inc * 0.02 }
function netTax(inc: number): number { return Math.max(0, incomeTax(inc) - litoAmt(inc)) + medicare(inc) }

// ─── FORMATTING ──────────────────────────────────────────────────────────────
const $f = (n: number) => n == null ? '-' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)
const pf = (n: number) => (n * 100).toFixed(2) + '%'
const nf = (n: number) => n.toFixed(4)

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface Inputs {
  currentAge: number; retirementAge: number; currentWage: number; reducedWage: number
  companyProfit: number; companyTaxRate: number; profitGrowth: number
  div7aRate: number; div7aTerm: number
  bankRate: number; bankDeductible: number; marginalRate: number
  superBalance: number; superPension: number
  relationshipStatus: number; homeowner: number
  superInAssetsTest: number; otherAssets: number; companyNAV: number
  bankLoanBalance: number; bankLoanAssessable: number
  fullPensionSingle: number; fullPensionCouple: number
  assetsLowerSingle: number; assetsUpperSingle: number
  assetsLowerCouple: number; assetsUpperCouple: number
  assetsReductionRate: number
  incomeFreeAreaSingle: number; incomeFreeAreaCouple: number; incomeReductionRate: number
  scenario1Div: number; scenario2Div: number; scenario3Div: number
}

const DEFAULTS: Inputs = {
  currentAge: 50, retirementAge: 65, currentWage: 100000, reducedWage: 45000,
  companyProfit: 200000, companyTaxRate: 0.25, profitGrowth: 0.02,
  div7aRate: 0.0827, div7aTerm: 7,
  bankRate: 0.065, bankDeductible: 1, marginalRate: 0.325,
  superBalance: 600000, superPension: 40000,
  relationshipStatus: 1, homeowner: 1,
  superInAssetsTest: 0, otherAssets: 100000, companyNAV: 500000,
  bankLoanBalance: 200000, bankLoanAssessable: 0,
  fullPensionSingle: 29754, fullPensionCouple: 44886,
  assetsLowerSingle: 301750, assetsUpperSingle: 656500,
  assetsLowerCouple: 451500, assetsUpperCouple: 986500,
  assetsReductionRate: 78,
  incomeFreeAreaSingle: 5512, incomeFreeAreaCouple: 9672, incomeReductionRate: 0.50,
  scenario1Div: 20000, scenario2Div: 45000, scenario3Div: 100000,
}

// ─── CALCULATIONS ─────────────────────────────────────────────────────────────
function computeAll(inp: Inputs) {
  const pmtFactor = inp.div7aRate * Math.pow(1 + inp.div7aRate, inp.div7aTerm) /
                    (Math.pow(1 + inp.div7aRate, inp.div7aTerm) - 1)

  // 20-year pre-retirement
  const years: any[] = []
  let d7aBalance = 0, bankBalance = 0, frankingCum = 0, compAssets = 0, cumBenefit = 0

  for (let i = 0; i < 20; i++) {
    const profit = inp.companyProfit * Math.pow(1 + inp.profitGrowth, i)
    const taxableIncome = profit - inp.reducedWage
    const compTax = taxableIncome * inp.companyTaxRate
    const netRetained = taxableIncome - compTax
    frankingCum += compTax
    compAssets += netRetained

    const taxFull = netTax(inp.currentWage)
    const taxRed = netTax(inp.reducedWage)
    const taxSaving = taxFull - taxRed
    const compSaving = (inp.currentWage - inp.reducedWage) * (inp.marginalRate - inp.companyTaxRate)

    const d7aOpen = d7aBalance
    const d7aDraw = netRetained
    const d7aInt = d7aOpen * inp.div7aRate
    const d7aRep = (d7aOpen + d7aInt) * pmtFactor
    const d7aClose = d7aOpen + d7aDraw + d7aInt - d7aRep
    d7aBalance = d7aClose

    const bkOpen = bankBalance
    const bkDraw = d7aRep
    const bkInt = (bkOpen + bkDraw) * inp.bankRate
    const bkIntNet = bkInt * (1 - inp.bankDeductible * inp.marginalRate)
    const bkClose = bkOpen + bkDraw + bkInt
    bankBalance = bkClose

    const netBenefit = taxSaving + compSaving - bkIntNet
    cumBenefit += netBenefit

    years.push({
      year: i + 1, age: inp.currentAge + i,
      profit, taxableIncome, compTax, netRetained,
      frankingYr: compTax, frankingCum, compAssets,
      taxFull, taxRed, taxSaving, compSaving,
      d7aOpen, d7aDraw, d7aInt, d7aRep, d7aClose,
      bkOpen, bkDraw, bkInt, bkIntNet, bkClose,
      netBenefit, cumBenefit,
    })
  }

  // Age pension – assets test
  const single = inp.relationshipStatus === 1
  const ho = inp.homeowner === 1
  const nhAdd = 52750
  const totalAssets = inp.superInAssetsTest + inp.companyNAV
                    - inp.bankLoanBalance * inp.bankLoanAssessable + inp.otherAssets
  const aLower = single ? (ho ? inp.assetsLowerSingle : inp.assetsLowerSingle + nhAdd)
                        : (ho ? inp.assetsLowerCouple : inp.assetsLowerCouple + nhAdd)
  const aUpper = single ? (ho ? inp.assetsUpperSingle : inp.assetsUpperSingle + nhAdd)
                        : (ho ? inp.assetsUpperCouple : inp.assetsUpperCouple + nhAdd)
  const fullPension = single ? inp.fullPensionSingle : inp.fullPensionCouple
  let atPension: number
  if (totalAssets <= aLower) atPension = fullPension
  else if (totalAssets >= aUpper) atPension = 0
  else atPension = Math.max(0, fullPension - ((totalAssets - aLower) / 1000) * inp.assetsReductionRate)

  const incomeFreeArea = single ? inp.incomeFreeAreaSingle : inp.incomeFreeAreaCouple

  // Retirement scenarios
  const scenarios = [inp.scenario1Div, inp.scenario2Div, inp.scenario3Div].map(div => {
    const frankingCredit = div * inp.companyTaxRate / (1 - inp.companyTaxRate)
    const grossedUpDiv = div + frankingCredit
    const itPension = Math.max(0, fullPension - Math.max(0, grossedUpDiv - incomeFreeArea) * inp.incomeReductionRate)
    const pension = Math.min(atPension, itPension)
    const assessableIncome = grossedUpDiv + pension
    const grossTaxAmt = incomeTax(assessableIncome)
    const litoOff = litoAmt(assessableIncome)
    const mcAmt = medicare(assessableIncome)
    const taxBeforeFranking = Math.max(0, grossTaxAmt - litoOff) + mcAmt
    const netTaxAmt = taxBeforeFranking - frankingCredit
    const netDiv = div - netTaxAmt
    return {
      div, frankingCredit, grossedUpDiv, pension, itPension,
      assessableIncome, grossTaxAmt, litoOff, mcAmt,
      taxBeforeFranking, netTaxAmt, netDiv,
      totalAfterTax: inp.superPension + netDiv + pension,
    }
  })

  return { years, pmtFactor, totalAssets, aLower, aUpper, fullPension, atPension, incomeFreeArea, scenarios, single }
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
function InputRow({ label, value, onChange, type = 'dollar', note }: {
  label: string; value: number; onChange: (v: number) => void
  type?: 'dollar' | 'percent' | 'integer'; note?: string
}) {
  const [raw, setRaw] = useState('')
  const [focused, setFocused] = useState(false)

  const displayVal = focused ? raw
    : type === 'dollar' ? $f(value)
    : type === 'percent' ? pf(value)
    : String(value)

  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        className="rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-right text-sm font-semibold text-blue-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        value={displayVal}
        onFocus={() => { setRaw(type === 'percent' ? (value * 100).toString() : value.toString()); setFocused(true) }}
        onBlur={(e) => {
          setFocused(false)
          const n = parseFloat(e.target.value.replace(/[^0-9.-]/g, ''))
          if (!isNaN(n)) onChange(type === 'percent' ? n / 100 : n)
        }}
        onChange={e => setRaw(e.target.value)}
      />
      {note && <span className="text-xs text-gray-400">{note}</span>}
    </div>
  )
}

function SectionCard({ title, children, color = 'blue' }: { title: string; children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-700', navy: 'bg-[#1F4E79]', green: 'bg-emerald-700', gray: 'bg-gray-600'
  }
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className={`${colors[color] || colors.blue} px-4 py-2.5`}>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="bg-white p-4">{children}</div>
    </div>
  )
}

function StatBox({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${positive === true ? 'bg-emerald-50 border-emerald-200' : positive === false ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${positive === true ? 'text-emerald-700' : positive === false ? 'text-orange-700' : 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const TABS = ['Assumptions', 'Pre-Retirement (20yr)', 'Age Pension', 'Retirement Income', 'Summary']

export default function Div7AAnalyser() {
  const [inp, setInp] = useState<Inputs>(DEFAULTS)
  const [tab, setTab] = useState(0)
  const calc = useMemo(() => computeAll(inp), [inp])

  const set = (key: keyof Inputs) => (v: number) => setInp(prev => ({ ...prev, [key]: v }))

  return (
    <div className="min-h-screen bg-[#F8F6EC]">
      {/* ── Header ── */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm px-6 py-4 flex items-center gap-4">
        <Link href="/">
          <Image alt="BAKR" src="https://res.cloudinary.com/dmz8tsndt/image/upload/v1755063722/BAKR_New_Logo-01_fldmxk.svg" width={120} height={48} className="h-10 w-auto" />
        </Link>
        <div className="h-6 w-px bg-gray-200" />
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Link href="/" className="hover:text-gray-600">Home</Link>
            <span>/</span>
            <span className="text-gray-600">Business Tools</span>
            <span>/</span>
            <span className="text-blue-700 font-medium">Division 7A Analyser</span>
          </div>
          <h1 className="text-lg font-bold text-[#1F4E79] leading-tight">Division 7A Loan Strategy Analyser</h1>
        </div>
        <div className="ml-auto hidden md:block">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">2024-25 Tax Rates</span>
        </div>
      </div>

      {/* ── Subtitle ── */}
      <div className="bg-[#1F4E79] text-white px-6 py-4">
        <p className="text-sm max-w-4xl">
          Model the tax benefit of reducing your wage, retaining profit in your company, and managing Division 7A loans via bank borrowing — including retirement income, franking credits, and age pension means testing.
        </p>
        <p className="text-xs text-blue-200 mt-1">⚠ This tool is for planning purposes only. Consult your Chartered Accountant before implementing any strategy.</p>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-gray-200 px-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === i ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6">

        {/* ══════════════════════════════════════════════
            TAB 0 – ASSUMPTIONS
        ══════════════════════════════════════════════ */}
        {tab === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <SectionCard title="1. Individual / Owner" color="navy">
              <div className="grid grid-cols-2 gap-3">
                <InputRow label="Current age" value={inp.currentAge} onChange={set('currentAge')} type="integer" />
                <InputRow label="Planned retirement age" value={inp.retirementAge} onChange={set('retirementAge')} type="integer" />
                <InputRow label="Current full wage ($)" value={inp.currentWage} onChange={set('currentWage')} />
                <InputRow label="Proposed reduced wage ($)" value={inp.reducedWage} onChange={set('reducedWage')} note="Stay in 19% bracket ($18,201–$45,000)" />
              </div>
              <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Years to retirement: <strong>{calc.years.length > 0 ? inp.retirementAge - inp.currentAge : 0}</strong>
              </div>
            </SectionCard>

            <SectionCard title="2. Company" color="navy">
              <div className="grid grid-cols-1 gap-3">
                <InputRow label="Gross profit before wages & tax ($)" value={inp.companyProfit} onChange={set('companyProfit')} />
                <InputRow label="Company tax rate" value={inp.companyTaxRate} onChange={set('companyTaxRate')} type="percent" note="Base rate entity < $50m turnover: 25%" />
                <InputRow label="Annual profit growth rate" value={inp.profitGrowth} onChange={set('profitGrowth')} type="percent" />
              </div>
            </SectionCard>

            <SectionCard title="3. Division 7A Loan" color="blue">
              <div className="grid grid-cols-2 gap-3">
                <InputRow label="Benchmark interest rate" value={inp.div7aRate} onChange={set('div7aRate')} type="percent" note="ATO 2024-25: 8.27%" />
                <InputRow label="Loan term (years)" value={inp.div7aTerm} onChange={set('div7aTerm')} type="integer" note="7yr unsecured / 25yr mortgage" />
              </div>
              <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                Annual repayment factor (PMT): <strong>{nf(calc.pmtFactor)}</strong>
                <span className="ml-2 text-gray-400">≈ {pf(calc.pmtFactor)} of outstanding balance per year</span>
              </div>
            </SectionCard>

            <SectionCard title="4. Bank Loan (Residential Security)" color="blue">
              <div className="grid grid-cols-1 gap-3">
                <InputRow label="Bank interest rate" value={inp.bankRate} onChange={set('bankRate')} type="percent" note="Secured against residential property" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Interest tax deductible?</label>
                    <select className="mt-1 w-full rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
                      value={inp.bankDeductible} onChange={e => set('bankDeductible')(parseInt(e.target.value))}>
                      <option value={1}>Yes</option>
                      <option value={0}>No</option>
                    </select>
                  </div>
                  <InputRow label="Marginal tax rate" value={inp.marginalRate} onChange={set('marginalRate')} type="percent" note="For interest deduction" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="5. Superannuation" color="green">
              <div className="grid grid-cols-2 gap-3">
                <InputRow label="Super balance at retirement ($)" value={inp.superBalance} onChange={set('superBalance')} />
                <InputRow label="Annual super pension ($)" value={inp.superPension} onChange={set('superPension')} note="Tax-free age 60+" />
              </div>
            </SectionCard>

            <SectionCard title="6. Age Pension Circumstances" color="green">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Relationship status</label>
                  <select className="mt-1 w-full rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
                    value={inp.relationshipStatus} onChange={e => set('relationshipStatus')(parseInt(e.target.value))}>
                    <option value={1}>Single</option>
                    <option value={2}>Couple</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Homeowner?</label>
                  <select className="mt-1 w-full rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
                    value={inp.homeowner} onChange={e => set('homeowner')(parseInt(e.target.value))}>
                    <option value={1}>Yes — home exempt</option>
                    <option value={0}>No</option>
                  </select>
                </div>
                <InputRow label="Super in assets test ($)" value={inp.superInAssetsTest} onChange={set('superInAssetsTest')} note="0 if in pension phase" />
                <InputRow label="Other assessable assets ($)" value={inp.otherAssets} onChange={set('otherAssets')} note="Excl. home, super, company" />
                <InputRow label="Company NAV at retirement ($)" value={inp.companyNAV} onChange={set('companyNAV')} />
                <InputRow label="Bank loan at retirement ($)" value={inp.bankLoanBalance} onChange={set('bankLoanBalance')} />
                <div>
                  <label className="text-xs font-medium text-gray-600">Bank loan offsets assessable asset?</label>
                  <select className="mt-1 w-full rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
                    value={inp.bankLoanAssessable} onChange={e => set('bankLoanAssessable')(parseInt(e.target.value))}>
                    <option value={0}>No (secured on home)</option>
                    <option value={1}>Yes (investment property)</option>
                  </select>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="7. Retirement Dividend Scenarios" color="gray">
              <div className="grid grid-cols-1 gap-3">
                <InputRow label="Scenario 1 — Minimal dividend ($)" value={inp.scenario1Div} onChange={set('scenario1Div')} note="May generate ATO franking credit refund" />
                <InputRow label="Scenario 2 — Moderate dividend ($)" value={inp.scenario2Div} onChange={set('scenario2Div')} note="Balance of income and pension" />
                <InputRow label="Scenario 3 — Maximum dividend ($)" value={inp.scenario3Div} onChange={set('scenario3Div')} note="Faster company drawdown" />
              </div>
            </SectionCard>

            <SectionCard title="8. Age Pension Reference Rates 2024-25" color="gray">
              <div className="grid grid-cols-2 gap-3">
                <InputRow label="Full pension — Single ($/yr)" value={inp.fullPensionSingle} onChange={set('fullPensionSingle')} />
                <InputRow label="Full pension — Couple combined ($/yr)" value={inp.fullPensionCouple} onChange={set('fullPensionCouple')} />
                <InputRow label="Assets lower — Single homeowner ($)" value={inp.assetsLowerSingle} onChange={set('assetsLowerSingle')} />
                <InputRow label="Assets upper — Single homeowner ($)" value={inp.assetsUpperSingle} onChange={set('assetsUpperSingle')} />
                <InputRow label="Assets lower — Couple homeowner ($)" value={inp.assetsLowerCouple} onChange={set('assetsLowerCouple')} />
                <InputRow label="Assets upper — Couple homeowner ($)" value={inp.assetsUpperCouple} onChange={set('assetsUpperCouple')} />
                <InputRow label="Assets reduction ($/yr per $1k excess)" value={inp.assetsReductionRate} onChange={set('assetsReductionRate')} type="integer" note="$3/fortnight × 26" />
                <InputRow label="Income reduction rate" value={inp.incomeReductionRate} onChange={set('incomeReductionRate')} type="percent" note="50c per $1 excess income" />
                <InputRow label="Income free area — Single ($/yr)" value={inp.incomeFreeAreaSingle} onChange={set('incomeFreeAreaSingle')} />
                <InputRow label="Income free area — Couple ($/yr)" value={inp.incomeFreeAreaCouple} onChange={set('incomeFreeAreaCouple')} />
              </div>
              <p className="mt-3 text-xs text-gray-400">Update these annually — rates change each March. Source: Services Australia.</p>
            </SectionCard>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB 1 – PRE-RETIREMENT
        ══════════════════════════════════════════════ */}
        {tab === 1 && (
          <div className="space-y-4">
            {/* Key stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Annual personal tax saving" value={$f(calc.years[0]?.taxSaving ?? 0)} positive={true} sub="vs full wage scenario" />
              <StatBox label="Company tax saving (retained profit)" value={$f(calc.years[0]?.compSaving ?? 0)} positive={true} sub="25% vs marginal rate on wages" />
              <StatBox label="Year 1 net annual benefit" value={$f(calc.years[0]?.netBenefit ?? 0)} positive={(calc.years[0]?.netBenefit ?? 0) > 0} />
              <StatBox label={`Cumulative benefit — Year ${inp.retirementAge - inp.currentAge}`}
                value={$f(calc.years[Math.min(inp.retirementAge - inp.currentAge - 1, 19)]?.cumBenefit ?? 0)}
                positive={true} sub="Tax savings minus bank interest" />
            </div>

            <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <strong>Model logic:</strong> Each year, net retained company profit is drawn as a new Div 7A loan. The minimum annual repayment (PMT at benchmark rate over {inp.div7aTerm} years) is funded by new bank borrowing. The bank loan grows; the Div 7A balance also grows from new draws. No deemed dividend arises provided repayments are made on time with a written loan agreement.
            </p>

            {/* Main table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#1F4E79] text-white">
                    <th className="sticky left-0 bg-[#1F4E79] px-3 py-2 text-left font-semibold w-48">Item</th>
                    {calc.years.map(y => (
                      <th key={y.year} className="px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[80px]">
                        Yr {y.year}<br /><span className="font-normal text-blue-200">Age {y.age}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'SECTION A — COMPANY', isHdr: true, color: '#1F4E79' },
                    { label: 'Gross profit ($)', key: 'profit' },
                    { label: 'Less: wages paid ($)', key: 'reducedWage', fixed: inp.reducedWage },
                    { label: 'Taxable income ($)', key: 'taxableIncome', alt: true },
                    { label: 'Less: company tax @ 25% ($)', key: 'compTax' },
                    { label: 'Net retained profit ($)', key: 'netRetained', bold: true, bg: '#E2EFDA' },
                    { label: 'Franking credits — year ($)', key: 'frankingYr', alt: true },
                    { label: 'Cumulative franking credits ($)', key: 'frankingCum', bold: true },
                    { label: 'Cumulative company assets ($)', key: 'compAssets', alt: true },
                    { label: 'SECTION B — PERSONAL TAX', isHdr: true, color: '#2E75B6' },
                    { label: 'Tax — full wage (no strategy) ($)', key: 'taxFull', alt: true },
                    { label: 'Tax — reduced wage (strategy) ($)', key: 'taxRed' },
                    { label: '★ Annual tax saving ($)', key: 'taxSaving', bold: true, bg: '#E2EFDA' },
                    { label: 'Company tax saving vs personal ($)', key: 'compSaving', alt: true },
                    { label: 'SECTION C — DIV 7A LOAN', isHdr: true, color: '#2E75B6' },
                    { label: 'Opening balance ($)', key: 'd7aOpen', alt: true },
                    { label: 'Add: new draw — retained profit ($)', key: 'd7aDraw' },
                    { label: 'Add: benchmark interest ($)', key: 'd7aInt', alt: true },
                    { label: 'Less: minimum repayment ($)', key: 'd7aRep' },
                    { label: '★ Closing Div 7A balance ($)', key: 'd7aClose', bold: true, bg: '#E2EFDA' },
                    { label: 'SECTION D — BANK LOAN', isHdr: true, color: '#2E75B6' },
                    { label: 'Opening bank balance ($)', key: 'bkOpen', alt: true },
                    { label: 'Add: drawdown (funds Div 7A repay) ($)', key: 'bkDraw' },
                    { label: 'Bank interest accrued ($)', key: 'bkInt', alt: true },
                    { label: 'Net interest cost (after tax) ($)', key: 'bkIntNet' },
                    { label: '★ Closing bank loan balance ($)', key: 'bkClose', bold: true, bg: '#FCE4D6' },
                    { label: 'SECTION E — NET BENEFIT', isHdr: true, color: '#1F4E79' },
                    { label: 'Annual personal tax saving ($)', key: 'taxSaving', alt: true },
                    { label: 'Add: company tax saving ($)', key: 'compSaving' },
                    { label: 'Less: net bank interest cost ($)', key: 'bkIntNet', alt: true },
                    { label: '★ Net annual benefit ($)', key: 'netBenefit', bold: true, bg: '#E2EFDA' },
                    { label: '★ Cumulative net benefit ($)', key: 'cumBenefit', bold: true, bg: '#E2EFDA' },
                  ].map((row: any, ri) => {
                    if (row.isHdr) return (
                      <tr key={ri}>
                        <td colSpan={21} className="px-3 py-1.5 text-xs font-bold text-white" style={{ background: row.color }}>{row.label}</td>
                      </tr>
                    )
                    return (
                      <tr key={ri} style={row.bg ? { background: row.bg } : row.alt ? { background: '#F9F9F9' } : {}}>
                        <td className="sticky left-0 px-3 py-1.5 font-medium text-gray-700 whitespace-nowrap border-r border-gray-100"
                          style={row.bg ? { background: row.bg } : row.alt ? { background: '#F9F9F9' } : { background: 'white' }}>
                          {row.bold ? <strong>{row.label}</strong> : row.label}
                        </td>
                        {calc.years.map(y => {
                          const val = row.fixed !== undefined ? row.fixed : y[row.key as keyof typeof y]
                          return (
                            <td key={y.year} className={`px-2 py-1.5 text-right ${row.bold ? 'font-bold' : ''}`}>
                              {$f(val as number)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB 2 – AGE PENSION
        ══════════════════════════════════════════════ */}
        {tab === 2 && (
          <div className="max-w-3xl space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatBox label="Total assessable assets" value={$f(calc.totalAssets)} />
              <StatBox label="Assets test lower threshold" value={$f(calc.aLower)} />
              <StatBox label="Assets test upper threshold" value={$f(calc.aUpper)} />
              <StatBox label="Full pension rate" value={$f(calc.fullPension)} sub={calc.single ? 'Single' : 'Couple combined'} />
              <StatBox label="Pension from assets test" value={$f(calc.atPension)}
                positive={calc.atPension > calc.fullPension * 0.5}
                sub={calc.atPension === 0 ? '⚠ Assets exceed upper threshold — no pension' : calc.atPension === calc.fullPension ? '✓ Full pension' : 'Partial pension'} />
            </div>

            <SectionCard title="Assets Test Calculation" color="navy">
              <div className="space-y-2 text-sm">
                {[
                  ['Super balance in assets test', $f(inp.superInAssetsTest), 'Enter 0 if super is in pension phase (generally excluded)'],
                  ['Company shares — net asset value', $f(inp.companyNAV), 'Assessed at NAV including Div 7A loan receivable'],
                  ['Less: bank loan offset', $f(inp.bankLoanBalance * inp.bankLoanAssessable), inp.bankLoanAssessable ? 'Secured on assessable asset — deductible' : 'Secured on home — NOT deductible'],
                  ['Other assessable assets', $f(inp.otherAssets), 'Cash, investment property, etc. Home is EXEMPT'],
                ].map(([label, val, note], i) => (
                  <div key={i} className={`flex items-start justify-between py-2 ${i < 3 ? 'border-b border-gray-100' : ''}`}>
                    <div>
                      <p className="font-medium text-gray-700">{label}</p>
                      <p className="text-xs text-gray-400">{note}</p>
                    </div>
                    <span className="font-semibold text-gray-800 ml-4 whitespace-nowrap">{val}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 bg-gray-50 rounded-lg px-3 mt-2">
                  <strong className="text-gray-800">Total assessable assets</strong>
                  <strong className="text-gray-800">{$f(calc.totalAssets)}</strong>
                </div>
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 space-y-1">
                  <p>Lower threshold ({inp.homeowner ? 'homeowner' : 'non-homeowner'}, {calc.single ? 'single' : 'couple'}): <strong>{$f(calc.aLower)}</strong></p>
                  <p>Upper threshold: <strong>{$f(calc.aUpper)}</strong></p>
                  <p>Reduction: <strong>$78/year per $1,000</strong> of assets above lower threshold</p>
                  <p className="pt-1 font-semibold">→ Pension from assets test: <strong>{$f(calc.atPension)}</strong></p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Income Test — Each Retirement Scenario" color="blue">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-700 text-white">
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Scenario 1<br /><span className="font-normal text-blue-200 text-xs">{$f(inp.scenario1Div)} div</span></th>
                      <th className="px-3 py-2 text-right">Scenario 2<br /><span className="font-normal text-blue-200 text-xs">{$f(inp.scenario2Div)} div</span></th>
                      <th className="px-3 py-2 text-right">Scenario 3<br /><span className="font-normal text-blue-200 text-xs">{$f(inp.scenario3Div)} div</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Grossed-up dividend (income test)', (s: any) => $f(s.grossedUpDiv)],
                      ['Income free area', () => $f(calc.incomeFreeArea)],
                      ['Income test pension', (s: any) => $f(s.itPension), true],
                      ['Assets test pension', () => $f(calc.atPension)],
                      ['★ Pension payable (lower of both)', (s: any) => $f(s.pension), true, '#E2EFDA'],
                      ['Fortnightly pension', (s: any) => $f(s.pension / 26)],
                    ].map(([label, fn, bold, bg]: any, ri) => (
                      <tr key={ri} style={bg ? { background: bg } : ri % 2 === 0 ? { background: '#F9F9F9' } : {}}>
                        <td className="px-4 py-2">{bold ? <strong>{label}</strong> : label}</td>
                        {calc.scenarios.map((s, si) => (
                          <td key={si} className={`px-3 py-2 text-right ${bold ? 'font-bold' : ''}`}>{fn(s)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-1.5">
              <p className="font-semibold text-sm">⚠ Key Age Pension Notes</p>
              <p>• <strong>Home:</strong> Principal residence is EXEMPT. Household contents ≤ $10,000 also excluded.</p>
              <p>• <strong>Company:</strong> Private company shares are assessed at NAV. The Div 7A loan receivable is part of NAV.</p>
              <p>• <strong>Bank loan on home:</strong> CANNOT offset home value (home is exempt). Secured on investment property = can offset.</p>
              <p>• <strong>Super in pension phase:</strong> Generally excluded from assets test at age pension age. Enter $0 for super above if confirmed.</p>
              <p>• <strong>Strategy:</strong> Drawing minimal dividends (Scenario 1) keeps assessable income low → higher pension. But company NAV still limits pension via assets test.</p>
              <p>• <strong>Rates change annually</strong> (March each year). Update pension rates in Assumptions tab.</p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB 3 – RETIREMENT INCOME
        ══════════════════════════════════════════════ */}
        {tab === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {calc.scenarios.map((s, i) => (
                <div key={i} className={`rounded-xl border p-4 ${s.netTaxAmt < 0 ? 'border-emerald-300 bg-emerald-50' : 'border-blue-200 bg-white'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-800">Scenario {i + 1}</h3>
                    <span className="text-xs font-medium text-gray-500">
                      {[inp.scenario1Div, inp.scenario2Div, inp.scenario3Div][i] === inp.scenario1Div ? 'Minimal' : i === 1 ? 'Moderate' : 'Maximum'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#1F4E79]">{$f(s.totalAfterTax)}</p>
                  <p className="text-xs text-gray-500 mb-3">total after-tax income</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Super pension (tax-free)</span><span className="font-medium">{$f(inp.superPension)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Dividend</span><span className="font-medium">{$f(s.div)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Franking credit</span><span className="font-medium text-emerald-700">+{$f(s.frankingCredit)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Grossed-up (assessable)</span><span className="font-medium">{$f(s.grossedUpDiv)}</span></div>
                    <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="text-gray-500">Income tax (gross)</span><span className="font-medium">{$f(s.grossTaxAmt)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Less LITO</span><span className="font-medium text-emerald-700">-{$f(s.litoOff)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Medicare levy</span><span className="font-medium">{$f(s.mcAmt)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Tax before franking offset</span><span className="font-medium">{$f(s.taxBeforeFranking)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Less franking offset</span><span className="font-medium text-emerald-700">-{$f(s.frankingCredit)}</span></div>
                    <div className={`flex justify-between border-t border-gray-200 pt-1 mt-1 font-bold ${s.netTaxAmt < 0 ? 'text-emerald-700' : 'text-gray-800'}`}>
                      <span>{s.netTaxAmt < 0 ? '★ ATO REFUND' : 'Net tax payable'}</span>
                      <span>{s.netTaxAmt < 0 ? $f(-s.netTaxAmt) + ' refund' : $f(s.netTaxAmt)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="text-gray-500">Age pension</span><span className="font-medium">{$f(s.pension)}</span></div>
                  </div>
                </div>
              ))}
            </div>

            <SectionCard title="Detailed Comparison Table" color="navy">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1F4E79] text-white">
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Scenario 1<br /><span className="text-blue-200 text-xs font-normal">Minimal {$f(inp.scenario1Div)}</span></th>
                      <th className="px-3 py-2 text-right">Scenario 2<br /><span className="text-blue-200 text-xs font-normal">Moderate {$f(inp.scenario2Div)}</span></th>
                      <th className="px-3 py-2 text-right">Scenario 3<br /><span className="text-blue-200 text-xs font-normal">Maximum {$f(inp.scenario3Div)}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ['INCOME SOURCES', null, true, '#2E75B6'],
                      ['Super pension (tax-free)', () => $f(inp.superPension), false, '#F9F9F9'],
                      ['Dividend from company', (s: any) => $f(s.div)],
                      ['Franking credit gross-up', (s: any) => $f(s.frankingCredit), false, '#F9F9F9'],
                      ['Grossed-up dividend (assessable)', (s: any) => $f(s.grossedUpDiv), true],
                      ['TAX CALCULATION', null, true, '#2E75B6'],
                      ['Total assessable income', (s: any) => $f(s.assessableIncome), false, '#F9F9F9'],
                      ['Gross income tax', (s: any) => $f(s.grossTaxAmt)],
                      ['Less: LITO offset', (s: any) => `(${$f(s.litoOff)})`, false, '#F9F9F9'],
                      ['Add: Medicare levy 2%', (s: any) => $f(s.mcAmt)],
                      ['Tax before franking offset', (s: any) => $f(s.taxBeforeFranking), false, '#F9F9F9'],
                      ['Less: franking credit offset', (s: any) => `(${$f(s.frankingCredit)})`],
                      ['★ Net tax / (REFUND)', (s: any) => s.netTaxAmt < 0 ? `(${$f(-s.netTaxAmt)}) REFUND` : $f(s.netTaxAmt), true, '#E2EFDA'],
                      ['AFTER-TAX SUMMARY', null, true, '#2E75B6'],
                      ['Super pension', () => $f(inp.superPension), false, '#F9F9F9'],
                      ['Net dividend ± tax/refund', (s: any) => $f(s.netDiv)],
                      ['Age pension (means-tested)', (s: any) => $f(s.pension), false, '#F9F9F9'],
                      ['★★ TOTAL AFTER-TAX INCOME', (s: any) => $f(s.totalAfterTax), true, '#E2EFDA'],
                    ] as any[]).map(([label, fn, bold, bg]: any, ri) => {
                      if (!fn) return (
                        <tr key={ri}><td colSpan={4} className="px-3 py-1.5 text-xs font-bold text-white" style={{ background: bg }}>{label}</td></tr>
                      )
                      return (
                        <tr key={ri} style={bg ? { background: bg } : {}}>
                          <td className="px-4 py-2">{bold ? <strong>{label}</strong> : label}</td>
                          {calc.scenarios.map((s, si) => (
                            <td key={si} className={`px-3 py-2 text-right ${bold ? 'font-bold' : ''}`}>{fn(s)}</td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 space-y-1.5">
              <p className="font-semibold text-sm">⭐ How Franking Credits Work in Retirement</p>
              <p>• At 25% company tax rate: each $1 dividend carries <strong>$0.3333</strong> in franking credits (div × 25/75)</p>
              <p>• The grossed-up amount (div + franking) is assessable income, but the credit offsets tax <strong>dollar-for-dollar</strong></p>
              <p>• If your tax payable (after LITO) is <strong>less</strong> than the franking credit, the ATO <strong>refunds the difference</strong></p>
              <p>• With a tax-free super pension and minimal dividends, your total income may be low enough to trigger a <strong>full refund</strong> of franking credits</p>
              <p>• The age pension also adds to assessable income — balance dividend drawdown to optimise both the pension and the refund</p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB 4 – SUMMARY
        ══════════════════════════════════════════════ */}
        {tab === 4 && (
          <div className="max-w-4xl space-y-4">
            <SectionCard title="How the Strategy Works — Step by Step" color="navy">
              <div className="space-y-3">
                {[
                  ['Step 1 — Reduce your wage', `Reduce your company wage from ${$f(inp.currentWage)} to ${$f(inp.reducedWage)}. This keeps you in the 19% tax bracket instead of 32.5%+.`],
                  ['Step 2 — Company retains the difference', `The company retains the extra ${$f(inp.currentWage - inp.reducedWage)} and pays ${pf(inp.companyTaxRate)} company tax (${$f((inp.currentWage - inp.reducedWage) * inp.companyTaxRate)} tax, ${$f((inp.currentWage - inp.reducedWage) * (1 - inp.companyTaxRate))} net retained).`],
                  ['Step 3 — Draw as Division 7A loan', 'Owner draws the net retained amount from the company as a Division 7A LOAN — not income. No personal tax payable on the draw.'],
                  ['Step 4 — Annual minimum repayment required', `The ATO requires an annual minimum repayment of ~${pf(calc.pmtFactor)} of the outstanding balance (principal + interest at benchmark rate ${pf(inp.div7aRate)} over ${inp.div7aTerm} years).`],
                  ['Step 5 — Fund repayment from bank', `Borrow the repayment amount from the bank at ${pf(inp.bankRate)} (residential security). Bank loan grows; Div 7A is repaid on time. No deemed dividend.`],
                  ['Step 6 — Cycle repeats annually', 'Each year the company re-lends the repaid amount. The Div 7A balance grows with new retained profits. The bank loan is deductible.'],
                  ['Step 7 — Retire with low income + franked dividends', `At retirement, draw franked dividends at a low rate. With super pension (${$f(inp.superPension)} tax-free) as base income, franking credits from company dividends may generate a NET REFUND from the ATO.`],
                  ['Step 8 — Optimise age pension', 'Company NAV is assessable under the assets test. Draw down dividends gradually to reduce company NAV over time, improving pension entitlement.'],
                ].map(([step, desc], i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-32 rounded-lg bg-[#1F4E79] px-2 py-1.5 text-xs font-semibold text-white text-center leading-tight">{step}</div>
                    <p className="text-sm text-gray-700 pt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatBox label="Annual tax saving (personal)" value={$f(calc.years[0]?.taxSaving ?? 0)} positive={true} />
              <StatBox label="Company tax saving vs wages" value={$f(calc.years[0]?.compSaving ?? 0)} positive={true} />
              <StatBox label="Net year 1 benefit" value={$f(calc.years[0]?.netBenefit ?? 0)} positive={(calc.years[0]?.netBenefit ?? 0) > 0} />
              <StatBox label="Div 7A balance — Year 10" value={$f(calc.years[9]?.d7aClose ?? 0)} />
              <StatBox label="Bank loan — Year 10" value={$f(calc.years[9]?.bkClose ?? 0)} />
              <StatBox label={`Cumulative benefit — Year ${Math.min(inp.retirementAge - inp.currentAge, 20)}`}
                value={$f(calc.years[Math.min(inp.retirementAge - inp.currentAge - 1, 19)]?.cumBenefit ?? 0)} positive={true} />
            </div>

            <SectionCard title="Retirement Income at a Glance" color="green">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-emerald-700 text-white">
                      <th className="px-4 py-2 text-left">Income source</th>
                      <th className="px-3 py-2 text-right">Scenario 1 (Minimal)</th>
                      <th className="px-3 py-2 text-right">Scenario 2 (Moderate)</th>
                      <th className="px-3 py-2 text-right">Scenario 3 (Maximum)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Super pension (tax-free)', () => $f(inp.superPension), false, '#F9F9F9'],
                      ['Dividend (gross)', (s: any) => $f(s.div)],
                      ['Net tax / (refund)', (s: any) => s.netTaxAmt < 0 ? `(${$f(-s.netTaxAmt)}) ★ REFUND` : $f(s.netTaxAmt), false, '#F9F9F9'],
                      ['Age pension', (s: any) => $f(s.pension)],
                      ['★★ Total after-tax income', (s: any) => $f(s.totalAfterTax), true, '#E2EFDA'],
                    ].map(([label, fn, bold, bg]: any, ri) => (
                      <tr key={ri}>
                        <td className="px-4 py-2">{bold ? <strong>{label}</strong> : label}</td>
                        {calc.scenarios.map((s, si) => (
                          <td key={si} className={`px-3 py-2 text-right ${bold ? 'font-bold' : ''}`}
                            style={{ background: typeof bg === 'function' ? bg(s) : bg || (ri % 2 ? '#F9F9F9' : 'white') }}>
                            {fn(s)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-emerald-700">✅ Benefits of the Strategy</h4>
                {[
                  'Owner stays in 19% personal tax bracket — saves tax on wages immediately',
                  'Company retains extra profit at 25% vs 32.5%+ personal marginal rate',
                  'Div 7A provides cash access WITHOUT personal tax — deferred to retirement',
                  'At retirement with low income, franking credits may generate an ATO refund',
                  'Bank interest is deductible and at a lower rate than the tax saving achieved',
                  'Gradual dividend drawdown at retirement allows franking credit recovery over time',
                ].map((t, i) => <p key={i} className="text-xs bg-emerald-50 border border-emerald-200 rounded px-3 py-1.5 text-emerald-800">{t}</p>)}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-orange-700">⚠ Risks & Considerations</h4>
                {[
                  'Bank loan grows each year — monitor debt serviceability against property value',
                  'High company NAV reduces age pension under the assets test',
                  'Div 7A written loan agreement required BEFORE end of income year',
                  'Minimum repayments MUST be made every year — missed repayment = deemed dividend',
                  'ATO benchmark interest rate changes annually — update in Assumptions each year',
                  'This is a planning model only — consult your Chartered Accountant before implementing',
                ].map((t, i) => <p key={i} className="text-xs bg-orange-50 border border-orange-200 rounded px-3 py-1.5 text-orange-800">{t}</p>)}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 text-center">
              Model prepared by <strong>Consultants for Accountants Pty Ltd</strong>, Launceston Tasmania &nbsp;|&nbsp;
              <strong>Disclaimer:</strong> For planning purposes only. Not tax, financial or legal advice. Always consult a qualified professional before implementing any strategy. Tax rates and pension thresholds are 2024-25 — update annually.
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
