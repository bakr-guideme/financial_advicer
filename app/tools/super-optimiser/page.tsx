/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'

// ══ 2024-25 SUPER CONTRIBUTION CAPS & THRESHOLDS ══════════════════════════════
const CC_CAP = 30000            // Concessional contributions cap
const NCC_CAP = 120000          // Non-concessional contributions cap
const NCC_BRING_3YR = 360000    // 3-year bring-forward
const NCC_BRING_2YR = 240000    // 2-year bring-forward
const NCC_TSB_3YR = 1680000     // TSB < this → 3-year bring-forward
const NCC_TSB_2YR = 1790000     // TSB < this → 2-year bring-forward
const NCC_TSB_NIL = 1900000     // TSB ≥ this → nil NCC
const TRANSFER_BALANCE_CAP = 1900000
const DIV293_THRESHOLD = 250000
const SG_RATE = 0.115           // 11.5% for 2024-25
const CC_TAX_RATE = 0.15        // Contributions tax on CC
const CARRY_FWD_TSB_LIMIT = 500000   // TSB < $500k for carry-forward
const CO_CONTRIB_LOWER = 43445  // Co-contribution lower income threshold
const CO_CONTRIB_UPPER = 58445  // Co-contribution upper income threshold
const CO_CONTRIB_MAX = 500      // Maximum co-contribution
const SPOUSE_FULL_THRESHOLD = 37000  // Spouse offset: full if below
const SPOUSE_NIL_THRESHOLD = 40000   // Spouse offset: nil if above
const SPOUSE_OFFSET_RATE = 0.18
const SPOUSE_MAX_CONTRIBUTION = 3000 // For full offset
const DOWNSIZER_MIN_AGE = 55    // Age 55+ from 1 Jan 2023
const DOWNSIZER_MAX = 300000    // Per person
const CGT_CAP_AMOUNT = 1705000  // 2024-25 CGT cap amount (lifetime)
const RETIREMENT_EXEMPTION_CAP = 500000 // Lifetime cap
const FHSS_MAX_ANNUAL = 15000   // Max $15,000/yr from CC/NCC
const FHSS_MAX_TOTAL = 50000    // Max $50,000 total withdrawal

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface SuperInputs {
  // Personal details
  name: string; age: number; dob: string
  salary: number; taxableIncome: number
  employerSGC: number; salSacrifice: number
  totalSuperBalance: number; personalTBC: number
  // Prior year carry-forward CC (enter unused caps years 1-5)
  cfYear1: number; cfYear2: number; cfYear3: number; cfYear4: number; cfYear5: number
  // Current year contributions
  personalCC: number     // Personal deductible (s290-170 notice to be given)
  voluntaryNCC: number   // Non-concessional voluntary
  bringForwardTriggered: boolean; bringForwardYear: number  // 1=1st yr, 2=2nd, 3=3rd
  // Spouse
  hasSpouse: boolean; spouseName: string; spouseAge: number
  spouseIncome: number; spouseTSB: number; spouseTBC: number
  spouseContribution: number  // NCC to spouse fund
  // Downsizer
  downsizer: number; downsizerhomeYears: number
  // CGT small business contributions
  cgtCap15yr: number          // 15-year exemption proceeds → CGT cap
  cgtCapRetirement: number    // Retirement exemption → CGT cap
  cgtCapUsedLifetime: number  // CGT cap amount already used this lifetime
  retirementExemptionUsed: number  // Retirement exemption used to date
  // Co-contribution NCC (low income)
  coContribNCC: number
  // FHSS
  fhssCC: number; fhssNCC: number; fhssAccumulated: number
  // Investment return assumption
  investReturn: number
}

const DEF: SuperInputs = {
  name:'John Smith', age:52, dob:'1972-07-15',
  salary:120000, taxableIncome:120000,
  employerSGC:0, salSacrifice:0,
  totalSuperBalance:650000, personalTBC:1900000,
  cfYear1:5000, cfYear2:8000, cfYear3:12000, cfYear4:0, cfYear5:0,
  personalCC:0, voluntaryNCC:0,
  bringForwardTriggered:false, bringForwardYear:1,
  hasSpouse:true, spouseName:'Mary Smith', spouseAge:49,
  spouseIncome:32000, spouseTSB:280000, spouseTBC:1900000,
  spouseContribution:3000,
  downsizer:0, downsizerhomeYears:0,
  cgtCap15yr:0, cgtCapRetirement:0, cgtCapUsedLifetime:0,
  retirementExemptionUsed:0,
  coContribNCC:0,
  fhssCC:0, fhssNCC:0, fhssAccumulated:0,
  investReturn:0.07,
}

// ── PERSONAL TAX ──────────────────────────────────────────────────────────────
function grossTax(inc:number):number {
  if(inc<=18200)return 0
  if(inc<=45000)return(inc-18200)*0.19
  if(inc<=120000)return 5092+(inc-45000)*0.325
  if(inc<=180000)return 29467+(inc-120000)*0.37
  return 51667+(inc-180000)*0.45
}
function lito(inc:number):number {
  if(inc<=37500)return 700
  if(inc<=45000)return Math.max(0,700-(inc-37500)*0.015)
  if(inc<=66667)return Math.max(0,325-(inc-45000)*0.015)
  return 0
}
function mc(inc:number):number { return inc<=26000?0:inc<=32500?(inc-26000)*0.10:inc*0.02 }
function netTax(inc:number):number { return Math.max(0,grossTax(inc)-lito(inc))+mc(inc) }
function margRate(inc:number):number {
  if(inc<=18200)return 0; if(inc<=45000)return 0.19
  if(inc<=120000)return 0.325; if(inc<=180000)return 0.37
  return 0.45
}

// ── MAIN CALCULATION ──────────────────────────────────────────────────────────
function compute(inp:SuperInputs) {
  const alerts:Array<{level:'error'|'warning'|'info'|'success';text:string}>=[]

  // 1. EMPLOYER SGC (auto-calculate if 0)
  const sgc = inp.employerSGC>0 ? inp.employerSGC : inp.salary * SG_RATE
  const salSac = inp.salSacrifice

  // 2. CONCESSIONAL CONTRIBUTIONS
  const totalCC = sgc + salSac + inp.personalCC
  // Carry-forward available (TSB < $500k, 5-year rolling unused caps from FY2020)
  const cfAvailable = inp.totalSuperBalance < CARRY_FWD_TSB_LIMIT
    ? inp.cfYear1 + inp.cfYear2 + inp.cfYear3 + inp.cfYear4 + inp.cfYear5
    : 0
  const effectiveCCCap = CC_CAP + (inp.totalSuperBalance < CARRY_FWD_TSB_LIMIT ? cfAvailable : 0)
  const excessCC = Math.max(0, totalCC - effectiveCCCap)
  const usedCF = Math.max(0, totalCC - CC_CAP)
  const unusedCC = Math.max(0, effectiveCCCap - totalCC)

  // Tax on CC
  const ccTax = Math.min(totalCC, effectiveCCCap) * CC_TAX_RATE
  // Division 293 — additional 15% tax where income + CC > $250,000
  const incomeForDiv293 = inp.taxableIncome + Math.min(totalCC, effectiveCCCap)
  const div293Base = Math.max(0, incomeForDiv293 - DIV293_THRESHOLD)
  const div293Tax = Math.min(div293Base, Math.min(totalCC, effectiveCCCap)) * 0.15

  // Tax saving from salary sacrifice (vs taking as salary)
  const mrSalary = margRate(inp.taxableIncome)
  const salSacTaxSaving = salSac * (mrSalary - CC_TAX_RATE - (incomeForDiv293 > DIV293_THRESHOLD ? 0.15 : 0))

  // Personal CC deduction saving (s290-170 notice)
  const mrBeforeCC = margRate(inp.taxableIncome)
  const personalCCDeductionSaving = inp.personalCC * (mrBeforeCC - CC_TAX_RATE)

  // 3. NON-CONCESSIONAL CONTRIBUTIONS
  // Determine NCC cap based on TSB
  let nccCapApplicable = NCC_CAP
  let bringForwardMax = NCC_CAP
  let bringForwardYearsAvail = 1
  if(inp.totalSuperBalance >= NCC_TSB_NIL) {
    nccCapApplicable = 0; bringForwardMax = 0; bringForwardYearsAvail = 0
    alerts.push({level:'error',text:`TSB ${$f(inp.totalSuperBalance)} ≥ ${$f(NCC_TSB_NIL)} general TBC — NIL non-concessional contributions allowed for this year.`})
  } else if(inp.totalSuperBalance >= NCC_TSB_2YR) {
    nccCapApplicable = NCC_CAP; bringForwardMax = NCC_CAP; bringForwardYearsAvail = 1
  } else if(inp.totalSuperBalance >= NCC_TSB_3YR) {
    nccCapApplicable = NCC_BRING_2YR; bringForwardMax = NCC_BRING_2YR; bringForwardYearsAvail = 2
    if(!inp.bringForwardTriggered) alerts.push({level:'info',text:`TSB qualifies for 2-year bring-forward only (${$f(NCC_BRING_2YR)} over 2 years) as TSB is $${(inp.totalSuperBalance/1e6).toFixed(2)}M.`})
  } else {
    nccCapApplicable = NCC_BRING_3YR; bringForwardMax = NCC_BRING_3YR; bringForwardYearsAvail = 3
  }

  const totalNCC = inp.voluntaryNCC + inp.coContribNCC + inp.spouseContribution
  // For age 75+: only compulsory contributions allowed
  if(inp.age >= 75) { nccCapApplicable = 0; alerts.push({level:'error',text:'Age 75+: Non-concessional contributions are not permitted (except downsizer contributions).'}) }
  // Age 67-74: work test applies to voluntary contributions (from 1 July 2022 applies to CC too)
  if(inp.age >= 67 && inp.age < 75) alerts.push({level:'warning',text:'Age 67–74: Work test applies — must have been gainfully employed for at least 40 hours in a consecutive 30-day period during the financial year before making personal contributions (CC and NCC). Consider work test exemption if TSB < $300,000 and met work test in prior year.'})

  const excessNCC = Math.max(0, totalNCC - nccCapApplicable)
  const unusedNCC = Math.max(0, nccCapApplicable - totalNCC)

  // 4. SPOUSE CONTRIBUTION TAX OFFSET
  let spouseOffset = 0
  const spouseContrib = inp.hasSpouse ? inp.spouseContribution : 0
  if(inp.hasSpouse && spouseContrib > 0) {
    if(inp.spouseIncome < SPOUSE_FULL_THRESHOLD) {
      spouseOffset = Math.min(spouseContrib, SPOUSE_MAX_CONTRIBUTION) * SPOUSE_OFFSET_RATE
    } else if(inp.spouseIncome < SPOUSE_NIL_THRESHOLD) {
      const reducedContrib = SPOUSE_MAX_CONTRIBUTION * (1 - (inp.spouseIncome - SPOUSE_FULL_THRESHOLD) / (SPOUSE_NIL_THRESHOLD - SPOUSE_FULL_THRESHOLD))
      spouseOffset = Math.min(spouseContrib, reducedContrib) * SPOUSE_OFFSET_RATE
    }
    if(inp.spouseAge >= 75) alerts.push({level:'error',text:`Spouse ${inp.spouseName} is age ${inp.spouseAge} (≥ 75) — spouse contributions not permitted.`})
    if(inp.spouseTSB >= NCC_TSB_NIL) alerts.push({level:'error',text:`Spouse TSB ${$f(inp.spouseTSB)} ≥ ${$f(NCC_TSB_NIL)} — spouse NCC contribution not permitted.`})
    if(inp.spouseIncome >= SPOUSE_NIL_THRESHOLD) alerts.push({level:'warning',text:`Spouse income ${$f(inp.spouseIncome)} ≥ ${$f(SPOUSE_NIL_THRESHOLD)} — no spouse contribution tax offset available (offset phases out $${SPOUSE_FULL_THRESHOLD/1000}k–$${SPOUSE_NIL_THRESHOLD/1000}k).`})
  }
  const maxSpouseOffset = 540 // 18% × $3,000

  // 5. GOVERNMENT CO-CONTRIBUTION
  let coContrib = 0
  if(inp.totalSuperBalance < NCC_TSB_NIL && inp.taxableIncome < CO_CONTRIB_UPPER && inp.age < 71) {
    if(inp.taxableIncome <= CO_CONTRIB_LOWER) {
      coContrib = Math.min(CO_CONTRIB_MAX, inp.coContribNCC * 0.5)
    } else {
      const reduction = (inp.taxableIncome - CO_CONTRIB_LOWER) / (CO_CONTRIB_UPPER - CO_CONTRIB_LOWER)
      coContrib = Math.max(0, Math.min(CO_CONTRIB_MAX, inp.coContribNCC * 0.5) * (1 - reduction))
    }
    if(inp.coContribNCC > 0 && inp.taxableIncome < CO_CONTRIB_UPPER)
      alerts.push({level:'success',text:`Government co-contribution: Contribute ${$f(inp.coContribNCC)} NCC → government will contribute ${$f(Math.round(coContrib))} (income ${$f(inp.taxableIncome)} qualifies).`})
  }

  // 6. DOWNSIZER CONTRIBUTIONS
  const downsizer = inp.downsizer
  let downsizeEligible = true
  if(inp.age < DOWNSIZER_MIN_AGE) { downsizeEligible=false; if(downsizer>0) alerts.push({level:'error',text:`Downsizer: Must be age ${DOWNSIZER_MIN_AGE}+ (you are ${inp.age}).`}) }
  if(inp.downsizerhomeYears < 10 && downsizer>0) alerts.push({level:'error',text:`Downsizer: Must have owned the home for at least 10 years (${inp.downsizerhomeYears} years entered).`})
  if(downsizer > DOWNSIZER_MAX) alerts.push({level:'error',text:`Downsizer capped at ${$f(DOWNSIZER_MAX)} per person (${$f(DOWNSIZER_MAX*2)} per couple).`})
  const eligibleDownsizer = downsizeEligible ? Math.min(downsizer, DOWNSIZER_MAX) : 0
  if(eligibleDownsizer > 0) alerts.push({level:'info',text:`Downsizer: ${$f(eligibleDownsizer)} does NOT count against NCC cap. Does count towards your transfer balance cap on commencing a pension. Must be made within 90 days of settlement.`})

  // 7. CGT SMALL BUSINESS CONTRIBUTIONS
  const cgtCapRemaining = Math.max(0, CGT_CAP_AMOUNT - inp.cgtCapUsedLifetime)
  const retirExemptRemaining = Math.max(0, RETIREMENT_EXEMPTION_CAP - inp.retirementExemptionUsed)
  const totalCGTCap = Math.min(inp.cgtCap15yr + inp.cgtCapRetirement, cgtCapRemaining)
  if(inp.cgtCap15yr > 0 || inp.cgtCapRetirement > 0) {
    if(inp.age < 55 && inp.cgtCapRetirement > 0)
      alerts.push({level:'warning',text:'CGT retirement exemption: Under age 55, the exempt amount MUST be contributed to a complying super fund (within 30 days of choosing the exemption or settlement). No choice — contribution is compulsory.'})
    if(inp.cgtCap15yr > 0)
      alerts.push({level:'info',text:`CGT 15-year exemption: ${$f(inp.cgtCap15yr)} can be contributed to super under the CGT cap (${$f(cgtCapRemaining)} remaining). This is in addition to NCC — does not count against NCC cap.`})
    if(inp.cgtCapRetirement > 0)
      alerts.push({level:'info',text:`CGT retirement exemption: ${$f(inp.cgtCapRetirement)} (${$f(retirExemptRemaining)} lifetime cap remaining). Under 55: must contribute to super. 55+: optional.`})
  }

  // 8. TRANSFER BALANCE CAP
  const remainingTBC = Math.max(0, inp.personalTBC - inp.totalSuperBalance)
  if(inp.totalSuperBalance >= inp.personalTBC * 0.9)
    alerts.push({level:'warning',text:`Transfer balance: Super balance ${$f(inp.totalSuperBalance)} is approaching your personal TBC of ${$f(inp.personalTBC)}. New NCC or earnings could limit future pension commencement.`})

  // 9. FHSS
  const fhssEligibleCC = Math.min(inp.fhssCC, FHSS_MAX_ANNUAL)
  const fhssTotal = Math.min(inp.fhssAccumulated + fhssEligibleCC, FHSS_MAX_TOTAL)
  if(inp.fhssCC > 0 || inp.fhssNCC > 0)
    alerts.push({level:'info',text:`FHSS: Eligible CC contributions ${$f(fhssEligibleCC)} (max $${FHSS_MAX_ANNUAL/1000}k/yr, $${FHSS_MAX_TOTAL/1000}k total). When withdrawn, taxed at marginal rate less 30% tax offset. Keep records of all FHSS-designated contributions.`})

  // 10. EXCESS CONTRIBUTIONS TAX
  if(excessCC > 0) alerts.push({level:'error',text:`EXCESS CC: ${$f(excessCC)} above cap. Included in your assessable income at marginal rate with 15% offset for contributions tax already paid. Plus excess CC interest charge. Consider releasing excess (election within 60 days of ATO assessment).`})
  if(excessNCC > 0) alerts.push({level:'error',text:`EXCESS NCC: ${$f(excessNCC)} above cap. Taxed at 47% on excess. You may elect to withdraw the excess (plus 85% of associated earnings) from super within 60 days of ATO assessment to reduce penalty. Associated earnings are included in assessable income.`})

  // 11. TOTAL ANNUAL SUPER INFLOWS
  const totalAnnualContribs = totalCC + totalNCC + eligibleDownsizer + totalCGTCap

  // 12. PROJECTION (simple compound)
  const r = inp.investReturn
  const yrs = Math.max(0, 65 - inp.age)
  const projectedBalance = (inp.totalSuperBalance + totalAnnualContribs) * Math.pow(1+r, yrs)
    + totalAnnualContribs * ((Math.pow(1+r,yrs)-1)/r) * (yrs>0?1:0)

  return {
    sgc, salSac, totalCC, effectiveCCCap, cfAvailable, excessCC, unusedCC,
    ccTax, div293Tax, salSacTaxSaving, personalCCDeductionSaving,
    nccCapApplicable, bringForwardMax, bringForwardYearsAvail,
    totalNCC, excessNCC, unusedNCC,
    spouseOffset, maxSpouseOffset, eligibleDownsizer, downsizeEligible,
    coContrib, totalCGTCap, cgtCapRemaining, retirExemptRemaining,
    remainingTBC, fhssTotal, totalAnnualContribs, projectedBalance, yrs, alerts,
  }
}

// ── FORMATTING ────────────────────────────────────────────────────────────────
function $f(n:number):string{return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(n||0)}
function pct(n:number):string{return(n*100).toFixed(2)+'%'}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function SCard({title,children,color='navy'}:{title:string;children:React.ReactNode;color?:string}){
  const h:Record<string,string>={navy:'bg-[#1F4E79]',blue:'bg-[#2E75B6]',green:'bg-emerald-700',gray:'bg-gray-600',amber:'bg-amber-700',red:'bg-red-700',teal:'bg-teal-700',purple:'bg-purple-700'}
  return(<div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm"><div className={`${h[color]||h.navy} px-4 py-2.5`}><h3 className="text-sm font-semibold text-white">{title}</h3></div><div className="bg-white p-4">{children}</div></div>)
}
function Fld({label,note,children}:{label:string;note?:string;children:React.ReactNode}){
  return(<div className="flex flex-col gap-0.5"><label className="text-xs font-medium text-gray-600">{label}</label>{children}{note&&<span className="text-xs text-gray-400 leading-tight">{note}</span>}</div>)
}
function NIn({value,onChange,className=''}:{value:number;onChange:(v:number)=>void;className?:string}){
  return(<input type="number" value={value||''} onChange={e=>onChange(parseFloat(e.target.value)||0)} className={`rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-right text-sm font-semibold text-blue-800 focus:border-blue-400 focus:outline-none w-full ${className}`}/>)
}
function TIn({value,onChange}:{value:string;onChange:(v:string)=>void}){
  return(<input type="text" value={value} onChange={e=>onChange(e.target.value)} className="rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 focus:border-blue-400 focus:outline-none w-full"/>)
}
function Stat({label,value,sub,color='gray'}:{label:string;value:string;sub?:string;color?:string}){
  const bg:Record<string,string>={gray:'bg-white border-gray-200',green:'bg-emerald-50 border-emerald-200',amber:'bg-amber-50 border-amber-200',red:'bg-red-50 border-red-200',blue:'bg-blue-50 border-blue-200',teal:'bg-teal-50 border-teal-200'}
  const tx:Record<string,string>={gray:'text-gray-800',green:'text-emerald-700',amber:'text-amber-700',red:'text-red-700',blue:'text-blue-700',teal:'text-teal-700'}
  return(<div className={`rounded-xl p-4 border ${bg[color]}`}><p className="text-xs text-gray-500 mb-1">{label}</p><p className={`text-xl font-bold ${tx[color]}`}>{value}</p>{sub&&<p className="text-xs text-gray-400 mt-0.5">{sub}</p>}</div>)
}
function Row({label,value,highlight,sub,indent=false}:{label:string;value:string;highlight?:boolean;sub?:string;indent?:boolean}){
  return(<div className={`flex justify-between py-1.5 border-b border-gray-100 text-sm ${highlight?'bg-emerald-50 rounded px-1 font-bold':''} ${indent?'ml-4':''}`}><span className={`text-gray-700 ${indent?'text-xs':''}`}>{label}{sub&&<span className="block text-xs text-gray-400">{sub}</span>}</span><span className={`font-semibold ${highlight?'text-emerald-700':''}`}>{value}</span></div>)
}

const TABS=['Your Details','Concessional','Non-Concessional','Spouse & Co-Contribution','Downsizer & CGT Cap','FHSS','Summary & Opportunities']

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function SuperOptimiser(){
  const [tab,setTab]=useState(0)
  const [inp,setInp]=useState<SuperInputs>(DEF)
  const calc=useMemo(()=>compute(inp),[inp])
  const s=<K extends keyof SuperInputs>(k:K,v:SuperInputs[K])=>setInp(p=>({...p,[k]:v}))

  return(
    <div className="min-h-screen bg-[#F8F6EC]">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm px-6 py-3 flex items-center gap-4">
        <Link href="/"><Image alt="BAKR" src="https://res.cloudinary.com/dmz8tsndt/image/upload/v1755063722/BAKR_New_Logo-01_fldmxk.svg" width={120} height={48} className="h-10 w-auto"/></Link>
        <div className="h-6 w-px bg-gray-200"/>
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Link href="/" className="hover:text-gray-600">Home</Link><span>/</span>
            <span className="text-blue-700 font-medium">Super Contributions Optimiser</span>
          </div>
          <h1 className="text-lg font-bold text-[#1F4E79]">Super Contributions Optimiser</h1>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/tools/trust-distribution" className="rounded-lg border border-[#1F4E79] px-3 py-1.5 text-xs font-semibold text-[#1F4E79] hover:bg-blue-50">← Trust Tool</Link>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">2024-25</span>
        </div>
      </div>
      <div className="bg-[#1F4E79] text-white px-6 py-3">
        <p className="text-sm max-w-5xl">Concessional (CC) & carry-forward contributions • Non-concessional (NCC) & 3-year bring-forward • Spouse contributions & tax offset • Government co-contributions • Downsizer contributions • CGT small business concessions • FHSS • Division 293 tax • Excess contributions analysis</p>
        <p className="text-xs text-blue-200 mt-1">⚠ Planning tool only — not financial advice. Confirm eligibility with a licensed financial adviser or registered tax agent before contributing.</p>
      </div>
      <div className="bg-white border-b border-gray-200 px-6 overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map((t,i)=>(
            <button key={t} onClick={()=>setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${tab===i?'border-[#1F4E79] text-[#1F4E79]':'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6">

        {/* Alerts always visible at top */}
        {calc.alerts.filter(a=>a.level==='error').length>0&&(
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 space-y-1">
            <p className="text-sm font-bold text-red-900">❌ Errors — contribution limits exceeded:</p>
            {calc.alerts.filter(a=>a.level==='error').map((a,i)=><p key={i} className="text-xs text-red-800">{a.text}</p>)}
          </div>
        )}

        {/* TAB 0 — YOUR DETAILS */}
        {tab===0&&(
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <SCard title="Personal Details" color="navy">
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Full name"><TIn value={inp.name} onChange={v=>s('name',v)}/></Fld>
                <Fld label="Age"><NIn value={inp.age} onChange={v=>s('age',v)}/></Fld>
                <Fld label="Annual salary ($)" note="Pre-tax, before salary sacrifice"><NIn value={inp.salary} onChange={v=>s('salary',v)}/></Fld>
                <Fld label="Total taxable income ($)" note="Including all income sources"><NIn value={inp.taxableIncome} onChange={v=>s('taxableIncome',v)}/></Fld>
              </div>
            </SCard>

            <SCard title="Super Balance & Transfer Balance" color="navy">
              <div className="grid grid-cols-1 gap-3">
                <Fld label="Total super balance (TSB) at 30 June prior year ($)" note="Key threshold: affects NCC cap, carry-forward, spouse offset eligibility">
                  <NIn value={inp.totalSuperBalance} onChange={v=>s('totalSuperBalance',v)}/>
                </Fld>
                <Fld label="Personal transfer balance cap ($)" note="General TBC $1.9M for 2024-25. May be less if you started a pension between 2017-2021.">
                  <NIn value={inp.personalTBC} onChange={v=>s('personalTBC',v)}/>
                </Fld>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
                  <p><strong>TSB thresholds 2024-25:</strong></p>
                  <p>• &lt; $500k: eligible for carry-forward CC</p>
                  <p>• &lt; $1,680k: full 3-year NCC bring-forward ($360k)</p>
                  <p>• $1,680k–$1,790k: 2-year bring-forward ($240k)</p>
                  <p>• $1,790k–$1,900k: 1-year only ($120k)</p>
                  <p>• ≥ $1,900k: nil NCC permitted</p>
                </div>
                <div className={`rounded-lg p-3 text-xs font-semibold ${inp.totalSuperBalance>=NCC_TSB_NIL?'bg-red-50 text-red-700':inp.totalSuperBalance>=NCC_TSB_2YR?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700'}`}>
                  Your TSB: {$f(inp.totalSuperBalance)} → NCC cap: {$f(calc.nccCapApplicable)} ({calc.bringForwardYearsAvail===0?'NIL':calc.bringForwardYearsAvail===3?'3-year bring-forward available':calc.bringForwardYearsAvail===2?'2-year bring-forward available':'1-year only'})
                </div>
              </div>
            </SCard>

            <SCard title="Investment Return Assumption" color="gray">
              <Fld label="Assumed annual return (%)" note="Used for projection to age 65 only — not guaranteed">
                <NIn value={inp.investReturn*100} onChange={v=>s('investReturn',v/100)}/>
              </Fld>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Years to age 65" value={`${calc.yrs} yrs`}/>
                <Stat label="Projected balance at 65" value={$f(calc.projectedBalance)} color="blue" sub={`at ${pct(inp.investReturn)} p.a.`}/>
              </div>
            </SCard>
          </div>
        )}

        {/* TAB 1 — CONCESSIONAL */}
        {tab===1&&(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SCard title="Concessional Contributions 2024-25" color="navy">
              <div className="space-y-3">
                <Fld label="Employer SGC (auto-calculated if 0)" note={`11.5% SGA rate for 2024-25. Auto = ${$f(inp.salary*SG_RATE)}`}><NIn value={inp.employerSGC} onChange={v=>s('employerSGC',v)}/></Fld>
                <Fld label="Salary sacrifice ($)" note="Pre-tax agreement with employer — reduces assessable income"><NIn value={inp.salSacrifice} onChange={v=>s('salSacrifice',v)}/></Fld>
                <Fld label="Personal deductible CC ($)" note="s290-170 notice must be given to fund before lodging tax return. Taxed at 15% in fund, deductible to you."><NIn value={inp.personalCC} onChange={v=>s('personalCC',v)}/></Fld>
                <div className="rounded-lg bg-[#1F4E79] text-white p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span>Employer SGC</span><span>{$f(calc.sgc)}</span></div>
                  <div className="flex justify-between"><span>Salary sacrifice</span><span>{$f(calc.salSac)}</span></div>
                  <div className="flex justify-between"><span>Personal deductible CC</span><span>{$f(inp.personalCC)}</span></div>
                  <div className="flex justify-between font-bold border-t border-blue-400 pt-1 mt-1"><span>Total CC</span><span>{$f(calc.totalCC)}</span></div>
                  <div className="flex justify-between"><span>CC cap (incl. carry-forward)</span><span>{$f(calc.effectiveCCCap)}</span></div>
                  <div className={`flex justify-between font-bold ${calc.excessCC>0?'text-red-300':''}`}><span>{calc.excessCC>0?'EXCESS CC':'Unused CC cap'}</span><span>{calc.excessCC>0?$f(calc.excessCC):$f(calc.unusedCC)}</span></div>
                </div>
              </div>
            </SCard>

            <SCard title="Carry-Forward Concessional Contributions" color="blue">
              <div className="space-y-3">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
                  <p><strong>Eligibility:</strong> TSB at prior 30 June must be &lt; $500,000. Unused CC caps roll forward for up to 5 years (from FY2019-20). The oldest unused cap is used first.</p>
                  <p><strong>Current TSB:</strong> {$f(inp.totalSuperBalance)} → {inp.totalSuperBalance<CARRY_FWD_TSB_LIMIT?<span className="text-emerald-700 font-semibold">✓ ELIGIBLE for carry-forward</span>:'✗ NOT eligible (TSB ≥ $500k)'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Unused CC — FY2020 ($)"><NIn value={inp.cfYear1} onChange={v=>s('cfYear1',v)}/></Fld>
                  <Fld label="Unused CC — FY2021 ($)"><NIn value={inp.cfYear2} onChange={v=>s('cfYear2',v)}/></Fld>
                  <Fld label="Unused CC — FY2022 ($)"><NIn value={inp.cfYear3} onChange={v=>s('cfYear3',v)}/></Fld>
                  <Fld label="Unused CC — FY2023 ($)"><NIn value={inp.cfYear4} onChange={v=>s('cfYear4',v)}/></Fld>
                  <Fld label="Unused CC — FY2024 ($)"><NIn value={inp.cfYear5} onChange={v=>s('cfYear5',v)}/></Fld>
                </div>
                <Row label="Total carry-forward available" value={inp.totalSuperBalance<CARRY_FWD_TSB_LIMIT?$f(calc.cfAvailable):'N/A (TSB ≥ $500k)'} highlight={inp.totalSuperBalance<CARRY_FWD_TSB_LIMIT}/>
                <Row label="Effective CC cap this year" value={$f(calc.effectiveCCCap)} highlight/>
              </div>
            </SCard>

            <SCard title="Tax on Concessional Contributions" color="green">
              <div className="space-y-2">
                <Row label="CC taxed at 15% in fund" value={$f(calc.ccTax)}/>
                <Row label="Division 293 additional tax (15%)" value={$f(calc.div293Tax)} sub={`Income + CC = ${$f(inp.taxableIncome+Math.min(calc.totalCC,calc.effectiveCCCap))} vs $250k threshold`}/>
                <Row label="Salary sacrifice tax saving" value={$f(calc.salSacTaxSaving)} highlight sub={`Marginal rate ${pct(margRate(inp.taxableIncome))} → 15% CC tax${calc.div293Tax>0?' (Div 293 reduces saving)':''}`}/>
                <Row label="Personal CC deduction saving" value={$f(calc.personalCCDeductionSaving)} highlight/>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 mt-2 space-y-1">
                  <p><strong>Personal deductible CC process (s290-170):</strong></p>
                  <p>1. Make personal contribution to super fund</p>
                  <p>2. Lodge &apos;Notice of intent to claim deduction&apos; with fund</p>
                  <p>3. Fund must acknowledge the notice</p>
                  <p>4. Claim deduction in tax return</p>
                  <p>5. Notice must be lodged BEFORE lodging tax return or 30 June of the following year (whichever is earlier)</p>
                  <p>⚠ Cannot lodge notice if you have already lodged your tax return for the year the contribution was made, or if you have left the fund.</p>
                </div>
              </div>
            </SCard>

            <SCard title="Division 293 Tax" color="gray">
              <div className="space-y-2">
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 space-y-1">
                  <p><strong>Rule:</strong> If income + taxed concessional contributions &gt; $250,000, an additional 15% tax applies to the CC (or the excess over $250k, whichever is less).</p>
                  <p><strong>Payment:</strong> ATO issues a Division 293 tax assessment. Can be paid personally or from your super fund (election required).</p>
                  <p><strong>Note:</strong> Even with Div 293, salary sacrifice saves tax if your marginal rate is 37% or 45% (net saving = 37%–30% = 7%, or 45%–30% = 15%).</p>
                </div>
                <Row label="Your income (taxable)" value={$f(inp.taxableIncome)}/>
                <Row label="Taxed CC" value={$f(Math.min(calc.totalCC,calc.effectiveCCCap))}/>
                <Row label="Income + CC" value={$f(inp.taxableIncome+Math.min(calc.totalCC,calc.effectiveCCCap))}/>
                <Row label="Div 293 threshold" value={$f(DIV293_THRESHOLD)}/>
                <Row label="Div 293 taxable amount" value={$f(Math.min(Math.max(0,inp.taxableIncome+Math.min(calc.totalCC,calc.effectiveCCCap)-DIV293_THRESHOLD),Math.min(calc.totalCC,calc.effectiveCCCap)))}/>
                <Row label="Division 293 tax @ 15%" value={$f(calc.div293Tax)} highlight={calc.div293Tax>0}/>
              </div>
            </SCard>
          </div>
        )}

        {/* TAB 2 — NON-CONCESSIONAL */}
        {tab===2&&(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SCard title="Non-Concessional Contributions 2024-25" color="navy">
              <div className="space-y-3">
                <div className={`rounded-lg p-3 text-xs font-semibold ${calc.nccCapApplicable===0?'bg-red-50 text-red-700 border border-red-200':calc.bringForwardYearsAvail<3?'bg-amber-50 text-amber-700 border border-amber-200':'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  Your NCC cap for {inp.financialYear || '2025'}: <strong>{$f(calc.nccCapApplicable)}</strong> ({calc.bringForwardYearsAvail===0?'NIL — TSB too high':calc.bringForwardYearsAvail===1?'1 year only':calc.bringForwardYearsAvail===2?'2-year bring-forward':'3-year bring-forward'})
                </div>
                <Fld label="Voluntary NCC ($)" note="After-tax money — no tax deduction. Tax-free in retirement."><NIn value={inp.voluntaryNCC} onChange={v=>s('voluntaryNCC',v)}/></Fld>
                <Fld label="Bring-forward rule">
                  <div className="grid grid-cols-2 gap-2">
                    <select value={inp.bringForwardTriggered?'yes':'no'} onChange={e=>s('bringForwardTriggered',e.target.value==='yes')}
                      className="rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 w-full">
                      <option value="no">No bring-forward triggered</option>
                      <option value="yes">Bring-forward in progress</option>
                    </select>
                    {inp.bringForwardTriggered&&<select value={inp.bringForwardYear} onChange={e=>s('bringForwardYear',parseInt(e.target.value))}
                      className="rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 w-full">
                      <option value={1}>Year 1 of bring-forward</option>
                      <option value={2}>Year 2 of bring-forward</option>
                      <option value={3}>Year 3 of bring-forward</option>
                    </select>}
                  </div>
                </Fld>
                <div className="rounded-lg bg-[#1F4E79] text-white p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span>Voluntary NCC</span><span>{$f(inp.voluntaryNCC)}</span></div>
                  <div className="flex justify-between"><span>Co-contribution NCC (low income)</span><span>{$f(inp.coContribNCC)}</span></div>
                  <div className="flex justify-between"><span>Spouse NCC</span><span>{$f(inp.spouseContribution)}</span></div>
                  <div className="flex justify-between font-bold border-t border-blue-400 pt-1"><span>Total NCC</span><span>{$f(calc.totalNCC)}</span></div>
                  <div className="flex justify-between"><span>NCC cap applicable</span><span>{$f(calc.nccCapApplicable)}</span></div>
                  <div className={`flex justify-between font-bold ${calc.excessNCC>0?'text-red-300':''}`}><span>{calc.excessNCC>0?'EXCESS NCC':'Unused NCC cap'}</span><span>{calc.excessNCC>0?$f(calc.excessNCC):$f(calc.unusedNCC)}</span></div>
                </div>
              </div>
            </SCard>

            <SCard title="3-Year Bring-Forward Rule" color="blue">
              <div className="space-y-3">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
                  <p><strong>Bring-forward allows you to contribute up to 3 years&apos; NCC cap in one or two years:</strong></p>
                  <p>• Triggered when NCC &gt; $120,000 in a year</p>
                  <p>• Once triggered, cap for next 2 years is reduced (or nil if 3-year amount used in Year 1)</p>
                  <p>• TSB at prior 30 June must allow bring-forward (see thresholds)</p>
                  <p>• Must be under age 75 to trigger (but once triggered, can use in years 2-3 even if older)</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {([['3-year cap\n(TSB < $1.68M)',$f(NCC_BRING_3YR),'green'],['2-year cap\n($1.68M–$1.79M)',$f(NCC_BRING_2YR),'amber'],['1-year only\n($1.79M–$1.90M)',$f(NCC_CAP),'gray']] as [string,string,string][]).map(([l,v,c])=>(
                    <div key={l} className={`rounded-xl p-3 border ${c==='green'?'bg-emerald-50 border-emerald-200':c==='amber'?'bg-amber-50 border-amber-200':'bg-white border-gray-200'}`}>
                      <p className="text-xs text-gray-500 whitespace-pre-line text-center leading-tight mb-1">{l}</p>
                      <p className={`text-lg font-bold ${c==='green'?'text-emerald-700':c==='amber'?'text-amber-700':'text-gray-700'}`}>{v}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                  <p><strong>Bring-forward watch-out:</strong> If you contribute just $1 over $120k, the FULL bring-forward is triggered and counted. If TSB later increases above the threshold, the unused bring-forward amount is still available (not clawed back). But the bring-forward cap applicable is set at the time of triggering.</p>
                </div>
              </div>
            </SCard>

            <SCard title="NCC — Tax Advantages" color="green">
              <div className="space-y-2 text-sm">
                <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 space-y-1">
                  <p><strong>Why contribute NCC?</strong></p>
                  <p>• NCC goes in as after-tax money — no contributions tax (already taxed at your marginal rate)</p>
                  <p>• Earnings inside super taxed at 15% (accumulation) vs up to 47% outside</p>
                  <p>• In pension phase: earnings taxed at NIL%</p>
                  <p>• On death: tax-free component benefits tax-free to adult children (NCC forms tax-free component)</p>
                  <p>• Estate planning: build up tax-free super component by maximising NCC</p>
                </div>
                <Row label="Annual NCC cap (this year)" value={$f(calc.nccCapApplicable)} highlight/>
                <Row label="Unused NCC capacity" value={$f(calc.unusedNCC)}/>
                <Row label="Excess NCC (if any)" value={$f(calc.excessNCC)} highlight={calc.excessNCC>0}/>
              </div>
            </SCard>

            <SCard title="Excess NCC — Consequences" color="red">
              <div className="space-y-2 text-xs text-gray-700">
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1">
                  <p><strong>Excess NCC process:</strong></p>
                  <p>1. ATO issues excess NCC determination</p>
                  <p>2. You have 60 days to elect to withdraw excess + 85% of associated earnings</p>
                  <p>3. If withdrawn: associated earnings included in assessable income (15% tax offset) and taxed at marginal rate</p>
                  <p>4. If NOT withdrawn: excess taxed at 47% in fund as highest marginal rate tax</p>
                  <p className="text-red-700 font-semibold">Always elect to withdraw excess NCC — avoiding 47% tax in fund.</p>
                </div>
                {calc.excessNCC>0&&<div className="rounded-lg border border-red-300 bg-red-100 p-3"><p className="font-bold text-red-800">Current excess NCC: {$f(calc.excessNCC)}</p><p className="text-red-700">Elect to withdraw within 60 days of ATO determination.</p></div>}
              </div>
            </SCard>
          </div>
        )}

        {/* TAB 3 — SPOUSE & CO-CONTRIBUTION */}
        {tab===3&&(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SCard title="Spouse Contributions Tax Offset" color="teal">
              <div className="space-y-3">
                <div className="rounded-lg bg-teal-50 border border-teal-200 p-3 text-xs text-teal-800 space-y-1">
                  <p><strong>Rule:</strong> You contribute NCC to your spouse&apos;s super fund → you receive a tax offset of 18% of the contribution (max $540 on $3,000).</p>
                  <p><strong>Spouse income test:</strong> Full offset if spouse income &lt; $37,000. Phases out from $37,000 to $40,000. Nil if ≥ $40,000.</p>
                  <p><strong>Eligibility:</strong> Both under 75. Spouse TSB &lt; $1.9M. Spouse must pass work test if 67–74. This is a spouse contribution (NCC to spouse&apos;s fund), not a contribution to your own fund.</p>
                </div>
                <Fld label="Has spouse / de facto?">
                  <select value={inp.hasSpouse?'yes':'no'} onChange={e=>s('hasSpouse',e.target.value==='yes')}
                    className="rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 w-full">
                    <option value="no">No spouse</option><option value="yes">Yes — married / de facto</option>
                  </select>
                </Fld>
                {inp.hasSpouse&&(<>
                  <div className="grid grid-cols-2 gap-3">
                    <Fld label="Spouse name"><TIn value={inp.spouseName} onChange={v=>s('spouseName',v)}/></Fld>
                    <Fld label="Spouse age"><NIn value={inp.spouseAge} onChange={v=>s('spouseAge',v)}/></Fld>
                    <Fld label="Spouse income ($)" note="Assessable income + reportable fringe benefits + reportable employer super"><NIn value={inp.spouseIncome} onChange={v=>s('spouseIncome',v)}/></Fld>
                    <Fld label="Spouse TSB at prior 30 June ($)"><NIn value={inp.spouseTSB} onChange={v=>s('spouseTSB',v)}/></Fld>
                    <Fld label="Contribution to spouse fund ($)" note="Your NCC to spouse's super fund (max $3,000 for full offset)"><NIn value={inp.spouseContribution} onChange={v=>s('spouseContribution',v)}/></Fld>
                    <Fld label="Personal TBC — spouse ($)"><NIn value={inp.spouseTBC} onChange={v=>s('spouseTBC',v)}/></Fld>
                  </div>
                  <div className="rounded-lg bg-[#1F4E79] text-white p-3 space-y-1 text-xs">
                    <div className="flex justify-between"><span>Spouse income</span><span>{$f(inp.spouseIncome)}</span></div>
                    <div className="flex justify-between"><span>Contribution (your NCC)</span><span>{$f(inp.spouseContribution)}</span></div>
                    <div className="flex justify-between"><span>Eligible for full offset?</span><span>{inp.spouseIncome<SPOUSE_FULL_THRESHOLD?'Yes':'No (income too high)'}</span></div>
                    <div className="flex justify-between font-bold border-t border-blue-400 pt-1"><span>★ Spouse offset (18% × ${SPOUSE_MAX_CONTRIBUTION/1000}k)</span><span>{$f(calc.spouseOffset)}</span></div>
                    <div className="flex justify-between"><span>Maximum possible offset</span><span>{$f(calc.maxSpouseOffset)}</span></div>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
                    <strong>Splitting contribution to equalise balances:</strong> Consider spouse contributions to equalise super balances. This maximises both persons&apos; TBC on pension commencement — allowing a combined $3.8M ($1.9M × 2) into pension phase. Speak to a financial adviser about a formal contribution-splitting strategy.
                  </div>
                </>)}
              </div>
            </SCard>

            <SCard title="Government Co-Contribution" color="green">
              <div className="space-y-3">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 space-y-1">
                  <p><strong>Rule:</strong> If you make a personal NCC and have low/middle income, the government contributes $0.50 per $1 of your NCC, up to $500.</p>
                  <p><strong>Income test 2024-25:</strong></p>
                  <p>• ≤ $43,445: maximum $500 co-contribution</p>
                  <p>• $43,445–$58,445: co-contribution phases out proportionately</p>
                  <p>• ≥ $58,445: nil co-contribution</p>
                  <p><strong>Minimum NCC for max benefit:</strong> $1,000 (at income ≤ $43,445)</p>
                  <p><strong>Requirements:</strong> Under 71, TSB &lt; $1.9M, at least 10% of income from employment/business, have NOT claimed a CC deduction for the year&apos;s NCC.</p>
                </div>
                <Fld label="Personal NCC for co-contribution ($)" note="Must be after-tax — cannot have claimed a CC deduction for this contribution">
                  <NIn value={inp.coContribNCC} onChange={v=>s('coContribNCC',v)}/>
                </Fld>
                <div className="rounded-lg bg-[#1F4E79] text-white p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span>Your income</span><span>{$f(inp.taxableIncome)}</span></div>
                  <div className="flex justify-between"><span>Your NCC</span><span>{$f(inp.coContribNCC)}</span></div>
                  <div className="flex justify-between font-bold border-t border-blue-400 pt-1"><span>★ Government co-contribution</span><span>{$f(Math.round(calc.coContrib))}</span></div>
                  <div className="flex justify-between"><span>Total to super</span><span>{$f(inp.coContribNCC+Math.round(calc.coContrib))}</span></div>
                </div>
                {inp.taxableIncome>CO_CONTRIB_UPPER&&<div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">Income {$f(inp.taxableIncome)} exceeds upper threshold {$f(CO_CONTRIB_UPPER)} — no co-contribution available.</div>}
              </div>
            </SCard>
          </div>
        )}

        {/* TAB 4 — DOWNSIZER & CGT CAP */}
        {tab===4&&(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SCard title="Downsizer Contributions" color="purple">
              <div className="space-y-3">
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-xs text-purple-800 space-y-1">
                  <p><strong>Key rules:</strong></p>
                  <p>• Age 55+ at time of contribution (from 1 January 2023)</p>
                  <p>• Home must have been owned for ≥ 10 years</p>
                  <p>• Must be your main residence or used to pass the CGT main residence exemption</p>
                  <p>• Maximum $300,000 per person ($600,000 per couple — both can contribute from one sale)</p>
                  <p>• Must be made within 90 days of settlement</p>
                  <p>• Does NOT count against NCC cap</p>
                  <p>• DOES count against transfer balance cap when pension starts</p>
                  <p>• Can contribute even if TSB ≥ $1.9M</p>
                  <p>• Only ONE downsizer contribution in a lifetime (per property sale)</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Downsizer contribution ($)" note="Max $300,000 — from proceeds of eligible home sale"><NIn value={inp.downsizer} onChange={v=>s('downsizer',v)}/></Fld>
                  <Fld label="Years of home ownership"><NIn value={inp.downsizerhomeYears} onChange={v=>s('downsizerhomeYears',v)}/></Fld>
                </div>
                <div className="rounded-lg bg-[#1F4E79] text-white p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span>Age eligibility</span><span>{inp.age>=DOWNSIZER_MIN_AGE?'✓ Eligible (55+)':'✗ Not yet eligible'}</span></div>
                  <div className="flex justify-between"><span>Home ownership</span><span>{inp.downsizerhomeYears>=10?'✓ 10+ years':inp.downsizerhomeYears>0?`✗ ${inp.downsizerhomeYears} years (< 10 required)':'[enter years]'}</span></div>
                  <div className="flex justify-between font-bold border-t border-blue-400 pt-1"><span>Eligible downsizer amount</span><span>{$f(calc.eligibleDownsizer)}</span></div>
                </div>
              </div>
            </SCard>

            <SCard title="CGT Small Business Contributions (CGT Cap)" color="purple">
              <div className="space-y-3">
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-xs text-purple-800 space-y-1">
                  <p><strong>Two concessions allow super contributions OUTSIDE the NCC cap:</strong></p>
                  <p><strong>1. 15-year exemption (s152-B ITAA 1997):</strong></p>
                  <p>• Business asset held continuously ≥ 15 years</p>
                  <p>• You are age 55+ OR retiring</p>
                  <p>• CGT contribution up to CGT cap amount: {$f(CGT_CAP_AMOUNT)} (2024-25, indexed)</p>
                  <p>• Can contribute full sale proceeds (not just gain)</p>
                  <p><strong>2. Retirement exemption (s152-D ITAA 1997):</strong></p>
                  <p>• Lifetime limit: $500,000</p>
                  <p>• Under 55: MUST contribute exempt amount to super</p>
                  <p>• Age 55+: optional contribution to super</p>
                  <p>• Must be contributed within 30 days of choosing exemption</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="15-year exemption → CGT cap ($)" note="Proceed to contribute to super under s152-B"><NIn value={inp.cgtCap15yr} onChange={v=>s('cgtCap15yr',v)}/></Fld>
                  <Fld label="Retirement exemption → CGT cap ($)" note="s152-D exempt amount — under 55 must contribute"><NIn value={inp.cgtCapRetirement} onChange={v=>s('cgtCapRetirement',v)}/></Fld>
                  <Fld label="CGT cap used this lifetime ($)"><NIn value={inp.cgtCapUsedLifetime} onChange={v=>s('cgtCapUsedLifetime',v)}/></Fld>
                  <Fld label="Retirement exemption used ($)"><NIn value={inp.retirementExemptionUsed} onChange={v=>s('retirementExemptionUsed',v)}/></Fld>
                </div>
                <div className="rounded-lg bg-[#1F4E79] text-white p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span>CGT cap (2024-25)</span><span>{$f(CGT_CAP_AMOUNT)}</span></div>
                  <div className="flex justify-between"><span>Used to date (lifetime)</span><span>{$f(inp.cgtCapUsedLifetime)}</span></div>
                  <div className="flex justify-between"><span>CGT cap remaining</span><span>{$f(calc.cgtCapRemaining)}</span></div>
                  <div className="flex justify-between"><span>Retirement exemption remaining</span><span>{$f(calc.retirExemptRemaining)}</span></div>
                  <div className="flex justify-between font-bold border-t border-blue-400 pt-1"><span>★ Eligible CGT cap contributions</span><span>{$f(calc.totalCGTCap)}</span></div>
                </div>
                {inp.age<55&&(inp.cgtCapRetirement>0)&&<div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700"><strong>Age &lt; 55:</strong> Retirement exemption amount MUST be contributed to a complying super fund within 30 days of choosing the exemption or within 30 days of receiving the capital proceeds. This is compulsory — failure may invalidate the exemption.</div>}
              </div>
            </SCard>
          </div>
        )}

        {/* TAB 5 — FHSS */}
        {tab===5&&(
          <div className="max-w-3xl space-y-4">
            <SCard title="First Home Super Saver Scheme (FHSS)" color="teal">
              <div className="space-y-3">
                <div className="rounded-lg bg-teal-50 border border-teal-200 p-3 text-xs text-teal-800 space-y-1">
                  <p><strong>How FHSS works:</strong></p>
                  <p>• Contribute CC or NCC to your super fund with FHSS intention</p>
                  <p>• Maximum $15,000 per financial year (from 1 July 2022)</p>
                  <p>• Maximum $50,000 total withdrawal across all years</p>
                  <p>• When ready to buy: apply to ATO for release authority</p>
                  <p>• Withdrawn amount = contributions + deemed earnings (SIC rate, currently ~4.33% pa)</p>
                  <p>• Taxed on withdrawal at marginal rate less 30% tax offset</p>
                  <p><strong>Tax benefit:</strong> CC contributions benefit from lower 15% CC tax going in, then 30% offset coming out — effective saving vs keeping outside super.</p>
                  <p><strong>CC vs NCC for FHSS:</strong> CC contributions (deductible) are better — you get the full marginal rate deduction at contributions tax rate 15%, then only pay marginal rate less 30% on withdrawal.</p>
                  <p><strong>Important:</strong> You must not have previously owned property in Australia. You must live in the home for at least 6 months within the first 12 months after purchase.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="FHSS CC this year ($)" note="Counts toward CC cap — but separately tracked for FHSS"><NIn value={inp.fhssCC} onChange={v=>s('fhssCC',v)}/></Fld>
                  <Fld label="FHSS NCC this year ($)" note="Counts toward NCC cap — less tax-effective than CC for FHSS"><NIn value={inp.fhssNCC} onChange={v=>s('fhssNCC',v)}/></Fld>
                  <Fld label="FHSS contributions accumulated (prior years $)" note="Total eligible FHSS contributions made in prior years"><NIn value={inp.fhssAccumulated} onChange={v=>s('fhssAccumulated',v)}/></Fld>
                </div>
                <div className="rounded-lg bg-[#1F4E79] text-white p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span>FHSS CC this year (eligible)</span><span>{$f(Math.min(inp.fhssCC,FHSS_MAX_ANNUAL))}</span></div>
                  <div className="flex justify-between"><span>Accumulated from prior years</span><span>{$f(inp.fhssAccumulated)}</span></div>
                  <div className="flex justify-between font-bold border-t border-blue-400 pt-1"><span>Running total (max $50k)</span><span>{$f(calc.fhssTotal)}</span></div>
                  <div className="flex justify-between"><span>Remaining capacity</span><span>{$f(Math.max(0,FHSS_MAX_TOTAL-calc.fhssTotal))}</span></div>
                </div>
              </div>
            </SCard>

            <SCard title="FHSS Tax Benefit Calculation" color="green">
              <div className="space-y-2 text-sm">
                {[
                  ['CC contribution to FHSS',$f(Math.min(inp.fhssCC,FHSS_MAX_ANNUAL)),false],
                  ['Contributions tax @ 15%',$f(Math.min(inp.fhssCC,FHSS_MAX_ANNUAL)*0.15),false],
                  ['Marginal rate deduction benefit',$f(Math.min(inp.fhssCC,FHSS_MAX_ANNUAL)*margRate(inp.taxableIncome)),false],
                  ['Net CC deduction saving',$f(Math.min(inp.fhssCC,FHSS_MAX_ANNUAL)*(margRate(inp.taxableIncome)-0.15)),true],
                  ['Deemed earnings on accumulation',$f(calc.fhssTotal*0.0433),false],
                  ['Tax on withdrawal (marg. rate less 30%)',$f(calc.fhssTotal*(Math.max(0,margRate(inp.taxableIncome)-0.30))),false],
                ].map(([l,v,h])=><Row key={l as string} label={l as string} value={v as string} highlight={h as boolean}/>)}
              </div>
            </SCard>
          </div>
        )}

        {/* TAB 6 — SUMMARY */}
        {tab===6&&(
          <div className="space-y-4">
            {/* Alerts summary */}
            {calc.alerts.filter(a=>a.level==='warning'||a.level==='info'||a.level==='success').length>0&&(
              <div className="grid grid-cols-1 gap-2">
                {calc.alerts.filter(a=>a.level==='warning').map((a,i)=>(
                  <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">⚠ {a.text}</div>
                ))}
                {calc.alerts.filter(a=>a.level==='success'||a.level==='info').map((a,i)=>(
                  <div key={i} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">💡 {a.text}</div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Total concessional contributions" value={$f(calc.totalCC)} color={calc.excessCC>0?'red':'blue'}/>
              <Stat label="Effective CC cap (incl. carry-fwd)" value={$f(calc.effectiveCCCap)} color="blue"/>
              <Stat label="Total non-concessional contributions" value={$f(calc.totalNCC)} color={calc.excessNCC>0?'red':'teal'}/>
              <Stat label="NCC cap (TSB-adjusted)" value={$f(calc.nccCapApplicable)} color="teal"/>
              <Stat label="Salary sacrifice tax saving" value={$f(calc.salSacTaxSaving)} color="green" sub="vs taking as salary"/>
              <Stat label="Division 293 extra tax" value={$f(calc.div293Tax)} color={calc.div293Tax>0?'amber':'gray'}/>
              <Stat label="Spouse contribution offset" value={$f(calc.spouseOffset)} color="green" sub={`Max $${calc.maxSpouseOffset}`}/>
              <Stat label="Govt co-contribution" value={$f(Math.round(calc.coContrib))} color="green"/>
              <Stat label="Downsizer contribution" value={$f(calc.eligibleDownsizer)} color={calc.eligibleDownsizer>0?'green':'gray'}/>
              <Stat label="CGT cap contributions" value={$f(calc.totalCGTCap)} color={calc.totalCGTCap>0?'green':'gray'}/>
              <Stat label="Transfer balance remaining" value={$f(calc.remainingTBC)} color="blue"/>
              <Stat label="Projected balance at 65" value={$f(calc.projectedBalance)} color="green" sub={`${calc.yrs} yrs @ ${pct(inp.investReturn)} p.a.`}/>
            </div>

            <SCard title="Complete Contributions Summary 2024-25" color="navy">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Concessional Contributions</p>
                  <div className="space-y-1">
                    <Row label="Employer SGC" value={$f(calc.sgc)}/>
                    <Row label="Salary sacrifice" value={$f(calc.salSac)}/>
                    <Row label="Personal deductible CC (s290-170)" value={$f(inp.personalCC)}/>
                    <Row label="Total CC" value={$f(calc.totalCC)} highlight/>
                    <Row label="CC cap (base)" value={$f(CC_CAP)}/>
                    <Row label="Carry-forward available" value={$f(calc.cfAvailable)} sub={inp.totalSuperBalance<CARRY_FWD_TSB_LIMIT?'TSB < $500k — eligible':'TSB ≥ $500k — not eligible'}/>
                    <Row label="Effective CC cap" value={$f(calc.effectiveCCCap)} highlight/>
                    <Row label={calc.excessCC>0?'EXCESS CC':'Unused CC'} value={calc.excessCC>0?$f(calc.excessCC):$f(calc.unusedCC)} highlight={calc.excessCC>0}/>
                    <Row label="Contributions tax @ 15%" value={`(${$f(calc.ccTax)})`}/>
                    <Row label="Division 293 tax" value={`(${$f(calc.div293Tax)})`}/>
                    <Row label="Net salary sacrifice saving" value={$f(calc.salSacTaxSaving)} highlight/>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Non-Concessional & Other Contributions</p>
                  <div className="space-y-1">
                    <Row label="Voluntary NCC" value={$f(inp.voluntaryNCC)}/>
                    <Row label="Co-contribution NCC (low income)" value={$f(inp.coContribNCC)}/>
                    <Row label="Spouse NCC" value={$f(inp.spouseContribution)}/>
                    <Row label="Total NCC" value={$f(calc.totalNCC)} highlight/>
                    <Row label="NCC cap (TSB-adjusted)" value={$f(calc.nccCapApplicable)}/>
                    <Row label={calc.excessNCC>0?'EXCESS NCC':'Unused NCC'} value={calc.excessNCC>0?$f(calc.excessNCC):$f(calc.unusedNCC)} highlight={calc.excessNCC>0}/>
                    <Row label="Downsizer (outside NCC cap)" value={$f(calc.eligibleDownsizer)}/>
                    <Row label="CGT cap contributions" value={$f(calc.totalCGTCap)}/>
                    <Row label="Govt co-contribution" value={$f(Math.round(calc.coContrib))} highlight/>
                    <Row label="Spouse contribution tax offset" value={$f(calc.spouseOffset)} highlight/>
                    <Row label="Total inflows to super" value={$f(calc.totalAnnualContribs)} highlight/>
                  </div>
                </div>
              </div>
            </SCard>

            {/* Compliance checklist */}
            <SCard title="Annual Compliance Checklist" color="green">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  ['CC deduction notice (s290-170) lodged with fund before tax return', inp.personalCC>0],
                  ['Salary sacrifice agreement in place BEFORE income is earned (prospective only)', inp.salSacrifice>0],
                  ['Super fund TFN supplied — otherwise fund cannot accept voluntary contributions', true],
                  ['Carry-forward CC: TSB confirmed with fund at 30 June prior year', inp.totalSuperBalance<CARRY_FWD_TSB_LIMIT],
                  ['Work test met if age 67–74 before contributing', inp.age>=67&&inp.age<75],
                  ['Spouse contribution paid to complying super fund, not directly to spouse', inp.hasSpouse&&inp.spouseContribution>0],
                  ['Co-contribution NCC made by 30 June — no CC deduction claimed for same NCC', inp.coContribNCC>0],
                  ['Downsizer contribution made within 90 days of property settlement', inp.downsizer>0],
                  ['CGT cap notice lodged with fund for small business CGT contributions', inp.cgtCap15yr+inp.cgtCapRetirement>0],
                  ['FHSS contributions flagged to fund as FHSS — keep records', inp.fhssCC+inp.fhssNCC>0],
                  ['Excess CC/NCC election lodged within 60 days of ATO determination', calc.excessCC>0||calc.excessNCC>0],
                  ['Division 293 tax — elect personal payment or fund release', calc.div293Tax>0],
                ].filter(([,relevant])=>relevant).map(([item],i)=>(
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="text-emerald-500 font-bold shrink-0">☐</span>
                    <span>{item as string}</span>
                  </div>
                ))}
              </div>
            </SCard>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 text-center">
              Prepared by <strong>BAKR — Consultants for Accountants Pty Ltd</strong>, Launceston Tasmania &nbsp;|&nbsp; 2024-25 caps and thresholds &nbsp;|&nbsp; <strong>Disclaimer:</strong> For planning purposes only. Not financial, legal, or tax advice. Contribution caps, thresholds, and rules are subject to annual change — verify with ATO and your licensed adviser before contributing.
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
