/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

// ── 2024-25 CONSTANTS ─────────────────────────────────────────────────────────
const MINOR_NIL = 416
const MINOR_UPPER = 1307
const TOP_RATE = 0.47

// ── TYPES ─────────────────────────────────────────────────────────────────────
type BenefType = 'adult_individual'|'minor'|'company'|'smsf'|'trust_entity'|'non_resident'
interface Beneficiary {
  id:string; name:string; type:BenefType; age:number
  otherIncome:number; companyTaxRate:number; manualAllocation:number
}
interface TrustInputs {
  trustName:string; trusteeNames:string; financialYear:string
  abn:string; tfn:string; trustDeedDate:string; trusteeResolutionDate:string
  hasFte:boolean; fteSurname:string
  businessIncome:number; rentalIncome:number; interestIncome:number
  otherIncome:number; frankingDividends:number; frankingCredits:number
  deductions:number; discountableCG:number; nonDiscountableCG:number
  priorCapLosses:number; currentCapLosses:number; priorTrustLosses:number
}

const DEF_TRUST: TrustInputs = {
  trustName:'Smith Family Trust', trusteeNames:'Smith Holdings Pty Ltd ATF Smith Family Trust',
  financialYear:'2025', abn:'', tfn:'', trustDeedDate:'2005-07-01',
  trusteeResolutionDate:'2025-06-27', hasFte:false, fteSurname:'Smith',
  businessIncome:200000, rentalIncome:30000, interestIncome:5000,
  otherIncome:0, frankingDividends:20000, frankingCredits:8571,
  deductions:30000, discountableCG:100000, nonDiscountableCG:0,
  priorCapLosses:0, currentCapLosses:10000, priorTrustLosses:0,
}
const DEF_BENEFS: Beneficiary[] = [
  {id:'1',name:'John Smith',type:'adult_individual',age:55,otherIncome:80000,companyTaxRate:0.25,manualAllocation:0},
  {id:'2',name:'Mary Smith',type:'adult_individual',age:52,otherIncome:15000,companyTaxRate:0.25,manualAllocation:0},
  {id:'3',name:'Smith Co Pty Ltd',type:'company',age:0,otherIncome:0,companyTaxRate:0.25,manualAllocation:0},
  {id:'4',name:'Smith Super Fund',type:'smsf',age:0,otherIncome:0,companyTaxRate:0.25,manualAllocation:0},
  {id:'5',name:'Jake Smith (minor)',type:'minor',age:15,otherIncome:0,companyTaxRate:0.25,manualAllocation:0},
]

// ── TAX FUNCTIONS ─────────────────────────────────────────────────────────────
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
function div6aa(inc:number):number {
  if(inc<=MINOR_NIL)return 0
  if(inc<=MINOR_UPPER)return(inc-MINOR_NIL)*0.66
  return inc*0.45
}
function taxOnDist(b:Beneficiary,d:number):number {
  if(d<=0)return 0
  if(b.type==='company')return d*b.companyTaxRate
  if(b.type==='smsf')return d*0.15
  if(b.type==='trust_entity')return d*TOP_RATE
  if(b.type==='non_resident')return d*TOP_RATE
  if(b.type==='minor')return div6aa(b.otherIncome+d)-div6aa(b.otherIncome)
  return netTax(b.otherIncome+d)-netTax(b.otherIncome)
}
function emr(b:Beneficiary,addl=0):number {
  const inc=b.otherIncome+addl
  if(b.type==='company')return b.companyTaxRate
  if(b.type==='smsf')return 0.15
  if(b.type==='trust_entity'||b.type==='non_resident')return TOP_RATE
  if(b.type==='minor')return inc<=MINOR_NIL?0:inc<=MINOR_UPPER?0.66:0.45
  if(inc<=18200)return 0; if(inc<=45000)return 0.19
  if(inc<=120000)return 0.345; if(inc<=180000)return 0.39
  return TOP_RATE
}

// ── MAIN CALCULATION ──────────────────────────────────────────────────────────
function compute(inp:TrustInputs,benefs:Beneficiary[]) {
  const warnings:Array<{level:'critical'|'high'|'medium'|'info';text:string}>=[]
  const totalCG=inp.discountableCG+inp.nonDiscountableCG
  const totalLosses=inp.priorCapLosses+inp.currentCapLosses
  const netCG=Math.max(0,totalCG-totalLosses)
  const discountPortion=totalCG>0?netCG*(inp.discountableCG/totalCG):0
  const ordinary=inp.businessIncome+inp.rentalIncome+inp.interestIncome+inp.otherIncome+inp.frankingDividends+inp.frankingCredits-inp.deductions
  const tni=Math.max(0,ordinary+netCG-inp.priorTrustLosses)

  // Resolution timing check
  if(inp.trusteeResolutionDate&&new Date(inp.trusteeResolutionDate)>new Date(`${inp.financialYear}-06-30`))
    warnings.push({level:'critical',text:`CRITICAL: Resolution date ${inp.trusteeResolutionDate} is after 30 June ${inp.financialYear}. This resolution is INVALID — trustee will be assessed at 47% on full trust net income of ${$f(tni)}.`})

  if(tni<=0)return{tni:0,ordinary,netCG,discountPortion,dists:{},cgStream:{},fkStream:{},taxBy:{},totalTax:0,topTax:0,saving:0,warnings,errors:['Trust net income is nil or negative.']}

  // Optimal distribution
  const dists:Record<string,number>={}
  benefs.forEach(b=>{dists[b.id]=0})
  let rem=tni

  // Manual first
  benefs.filter(b=>b.manualAllocation>0).forEach(b=>{
    const a=Math.min(b.manualAllocation,rem); dists[b.id]=a; rem-=a
  })

  // Auto: sorted by EMR ascending, fill brackets
  const auto=[...benefs].filter(b=>b.manualAllocation===0).map(b=>({...b,_emr:emr(b)})).sort((a,b)=>a._emr-b._emr)
  for(const b of auto){
    if(rem<=0)break
    if(b.type==='minor'){
      const cap=Math.max(0,MINOR_NIL-b.otherIncome)
      const a=Math.min(cap,rem); dists[b.id]=a; rem-=a
    } else if(b.type==='adult_individual'){
      const top=b.otherIncome<=0?18200:b.otherIncome<=18200?18200:b.otherIncome<=45000?45000:b.otherIncome<=120000?120000:b.otherIncome<=180000?180000:Infinity
      const cap=top===Infinity?rem:Math.max(0,top-b.otherIncome)
      const a=Math.min(cap,rem); dists[b.id]=a; rem-=a
    } else {
      dists[b.id]=rem; rem=0
    }
  }
  if(rem>0&&auto.length>0){dists[auto[0].id]+=rem;rem=0}

  // CGT streaming: lowest-income individuals/SMSFs get discountable CG
  const cgStream:Record<string,number>={}
  benefs.forEach(b=>{cgStream[b.id]=0})
  let cgR=discountPortion
  const cgEl=benefs.filter(b=>(b.type==='adult_individual'||b.type==='smsf')&&(dists[b.id]||0)>0).sort((a,b)=>a.otherIncome-b.otherIncome)
  for(const b of cgEl){if(cgR<=0)break;const s=Math.min(dists[b.id],cgR);cgStream[b.id]=s;cgR-=s}

  // Franking streaming: highest-rate benefs first
  const fkStream:Record<string,number>={}
  benefs.forEach(b=>{fkStream[b.id]=0})
  if(inp.frankingCredits>0){
    const fkEl=benefs.filter(b=>b.type!=='non_resident'&&(dists[b.id]||0)>0).sort((a,b)=>emr(b)-emr(a))
    let fR=inp.frankingCredits
    for(const b of fkEl){if(fR<=0)break;const s=Math.min((dists[b.id]/tni)*inp.frankingCredits,fR);fkStream[b.id]=s;fR-=s}
    if(fR>0)fkEl.forEach(b=>{fkStream[b.id]+=(dists[b.id]/tni)*fR})
  }

  // Tax
  const taxBy:Record<string,number>={}
  let totalTax=0
  benefs.forEach(b=>{const t=taxOnDist(b,dists[b.id]||0);taxBy[b.id]=t;totalTax+=t})
  const topTax=tni*TOP_RATE
  const saving=topTax-totalTax

  // Warnings
  benefs.forEach(b=>{
    const d=dists[b.id]||0; if(d<=0)return
    if(b.type==='minor'&&(b.otherIncome+d)>MINOR_NIL)
      warnings.push({level:'high',text:`${b.name}: Distribution ${$f(d)} pushes income to ${$f(b.otherIncome+d)}, above $416. Division 6AA ${(b.otherIncome+d)>MINOR_UPPER?'45% on entire amount':'66% on excess'} applies.`})
    if(b.type==='company')
      warnings.push({level:'medium',text:`${b.name}: UPE ${$f(d)} — ensure compliant sub-trust or repayment under PCG 2017/13 to avoid Division 7A deemed dividend.`})
    if(b.type==='adult_individual'&&b.otherIncome===0&&!inp.hasFte)
      warnings.push({level:'medium',text:`s100A risk: ${b.name} has no other income. Document genuine economic engagement per TR 2022/4 / PCG 2022/2.`})
  })
  if(discountPortion>0)warnings.push({level:'info',text:`CGT streaming available: ${$f(discountPortion)} discountable gain. Stream to individuals/SMSF for 50%/33% discount. Must be in resolution before 30 June.`})
  if(inp.frankingCredits>0)warnings.push({level:'info',text:`Franking credits ${$f(inp.frankingCredits)} included in trust net income under s97(1A). Stream to highest-rate beneficiaries who can best use the offset.`})

  return{tni,ordinary,netCG,discountPortion,dists,cgStream,fkStream,taxBy,totalTax,topTax,saving,warnings,errors:[]}
}

// ── FORMATTING ────────────────────────────────────────────────────────────────
function $f(n:number):string{return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(n||0)}
function pct(n:number):string{return(n*100).toFixed(1)+'%'}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function SCard({title,children,color='navy'}:{title:string;children:React.ReactNode;color?:string}){
  const h:Record<string,string>={navy:'bg-[#1F4E79]',blue:'bg-[#2E75B6]',green:'bg-emerald-700',gray:'bg-gray-600',amber:'bg-amber-700',red:'bg-red-700'}
  return(<div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm"><div className={`${h[color]||h.navy} px-4 py-2.5`}><h3 className="text-sm font-semibold text-white">{title}</h3></div><div className="bg-white p-4">{children}</div></div>)
}
function Fld({label,note,children}:{label:string;note?:string;children:React.ReactNode}){
  return(<div className="flex flex-col gap-0.5"><label className="text-xs font-medium text-gray-600">{label}</label>{children}{note&&<span className="text-xs text-gray-400">{note}</span>}</div>)
}
function NIn({value,onChange}:{value:number;onChange:(v:number)=>void}){
  return(<input type="number" value={value||''} onChange={e=>onChange(parseFloat(e.target.value)||0)} className="rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-right text-sm font-semibold text-blue-800 focus:border-blue-400 focus:outline-none w-full"/>)
}
function TIn({value,onChange}:{value:string;onChange:(v:string)=>void}){
  return(<input type="text" value={value} onChange={e=>onChange(e.target.value)} className="rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 focus:border-blue-400 focus:outline-none w-full"/>)
}
function DIn({value,onChange}:{value:string;onChange:(v:string)=>void}){
  return(<input type="date" value={value} onChange={e=>onChange(e.target.value)} className="rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 focus:border-blue-400 focus:outline-none w-full"/>)
}
function Stat({label,value,sub,color='gray'}:{label:string;value:string;sub?:string;color?:string}){
  const bg:Record<string,string>={gray:'bg-white border-gray-200',green:'bg-emerald-50 border-emerald-200',amber:'bg-amber-50 border-amber-200',red:'bg-red-50 border-red-200',blue:'bg-blue-50 border-blue-200'}
  const tx:Record<string,string>={gray:'text-gray-800',green:'text-emerald-700',amber:'text-amber-700',red:'text-red-700',blue:'text-blue-700'}
  return(<div className={`rounded-xl p-4 border ${bg[color]}`}><p className="text-xs text-gray-500 mb-1">{label}</p><p className={`text-xl font-bold ${tx[color]}`}>{value}</p>{sub&&<p className="text-xs text-gray-400 mt-0.5">{sub}</p>}</div>)
}

const BLAB:Record<BenefType,string>={adult_individual:'Adult Individual',minor:'Minor (< 18)',company:'Company',smsf:'SMSF',trust_entity:'Trust / Partnership',non_resident:'Non-Resident'}
const TABS=['Trust & Income','Beneficiaries','Optimal Distribution','Streaming','Risk Analysis','Trust Minutes']

// ── MINUTES GENERATOR ─────────────────────────────────────────────────────────
function genMinutes(inp:TrustInputs,benefs:Beneficiary[],calc:ReturnType<typeof compute>):string {
  const yr=inp.financialYear
  const dists=calc.dists||{}
  const hasCG=Object.values(calc.cgStream||{}).some(v=>v>0)
  const hasFk=inp.frankingCredits>0
  let n=1
  const distRows=benefs.filter(b=>(dists[b.id]||0)>0).map(b=>`    ${b.name.padEnd(35)} ${$f(dists[b.id])}`).join('\n')
  const cgRows=benefs.filter(b=>(calc.cgStream?.[b.id]||0)>0).map(b=>`    ${b.name.padEnd(35)} ${$f(calc.cgStream![b.id])}`).join('\n')
  const fkRows=benefs.filter(b=>(calc.fkStream?.[b.id]||0)>0).map(b=>`    ${b.name.padEnd(35)} ${$f(calc.fkStream![b.id])}`).join('\n')
  return `MINUTES OF A MEETING OF THE TRUSTEE
OF THE ${inp.trustName.toUpperCase()}
${inp.abn?'ABN: '+inp.abn:'ABN: [INSERT]'}

Date of resolution:       ${inp.trusteeResolutionDate||'[MUST BE BEFORE 30 JUNE '+yr+']'}
Trustee:                  ${inp.trusteeNames||'[TRUSTEE]'}
Trust established:        ${inp.trustDeedDate||'[DEED DATE]'}
Financial year ending:    30 June ${yr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BACKGROUND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. The trustee of the ${inp.trustName} ("the Trust") is required pursuant
   to the Trust deed and s97 ITAA 1997 to determine the present
   entitlement of beneficiaries to trust net income for the income
   year ended 30 June ${yr} before that date.

2. Estimated trust net income for 30 June ${yr}:

   Gross ordinary income                    ${$f(inp.businessIncome+inp.rentalIncome+inp.interestIncome+inp.otherIncome+inp.frankingDividends)}
   Franking credits included (s97(1A))      ${$f(inp.frankingCredits)}
   Less: deductions                         (${$f(inp.deductions)})
   Net capital gains (after losses)         ${$f(calc.netCG)}
   Prior year trust losses applied          (${$f(inp.priorTrustLosses)})
   ─────────────────────────────────────────────────
   ESTIMATED TRUST NET INCOME               ${$f(calc.tni)}

   Note: These figures are estimates only. Final amounts will be
   confirmed at preparation of the income tax return.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESOLUTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${hasCG?`RESOLUTION ${n++} — CAPITAL GAINS STREAMING (Subdiv 115-C ITAA 1997)

IT IS RESOLVED that pursuant to s115-228 ITAA 1997 the trustee
specifically assigns the following shares of the discountable
capital gain (${$f(calc.discountPortion)} — assets held > 12 months,
before 50% CGT discount) to the following beneficiaries:

${cgRows}

Each such beneficiary may apply the 50% CGT discount (or 1/3 for
SMSFs) to their allocated share. This resolution specifically
identifies each beneficiary and amount as required by s115-228(3).

`:''}${hasFk?`RESOLUTION ${n++} — FRANKING CREDIT STREAMING (Subdiv 207-B ITAA 1997)

IT IS RESOLVED that pursuant to s207-55 ITAA 1997 the trustee
specifically assigns the following shares of franking credits
(total: ${$f(inp.frankingCredits)}) to the following beneficiaries:

${fkRows}

The allocated franking credits do not exceed each beneficiary's
proportionate share of trust income. This streaming satisfies
the conditions of s207-55 and does not trigger s207-45 integrity.

`:''}RESOLUTION ${n++} — APPOINTMENT OF INCOME (PRESENT ENTITLEMENT)

IT IS RESOLVED that the trustee exercises its discretion under
the Trust deed to make the following beneficiaries presently
entitled to the net income of the Trust for 30 June ${yr}:

${distRows}
   ─────────────────────────────────────────────────
   TOTAL                                    ${$f(calc.tni)}

Present entitlement takes effect from the date of this resolution.
Where actual trust net income differs from estimates, each
beneficiary's entitlement is the same proportionate share of
actual trust net income (unless a fixed dollar amount is specified,
in which case the residual shall be appointed to [SPECIFY]).

RESOLUTION ${n++} — UNPAID PRESENT ENTITLEMENTS (UPEs)

IT IS RESOLVED that to the extent any entitlement above remains
unpaid as at 30 June ${yr}:

(a) The unpaid amount constitutes a UPE of the beneficiary;
(b) UPEs are repayable on demand subject to Trust liquidity;
(c) No interest accrues unless separately agreed in writing;
(d) Where the beneficiary is a private company, the trustee
    acknowledges PCG 2017/13 and TR 2010/3. The UPE will be
    placed on compliant sub-trust loan terms at the s109N
    benchmark rate (8.27% for 2024-25):
    — Unsecured: maximum 7-year term with annual minimum repayments
    — Secured by registered mortgage: maximum 25-year term
    Failure to comply = Division 7A deemed dividend.

RESOLUTION ${n++} — SECTION 100A ACKNOWLEDGMENT

IT IS RESOLVED and the trustee records that:

(a) Each distribution is made in the course of an "ordinary
    family or commercial dealing" under s100A(13) ITAA 1936;
(b) No agreement or arrangement exists under which any benefit
    flows to any person other than the named beneficiary in
    respect of their present entitlement;
(c) The trustee has considered TR 2022/4 and PCG 2022/2;
(d) These distributions reflect genuine exercise of trustee
    discretion in the interests of all beneficiaries.

    Documentary basis for each distribution:
    [INSERT — e.g., "Mary Smith: family living expenses,
    residing at [address], funds paid to her bank account"]

${inp.hasFte?`RESOLUTION ${n++} — FAMILY TRUST ELECTION

The trustee records that a valid FTE under s272-80 Sch 2F ITAA
1936 is in force, test individual: ${inp.fteSurname} family. All
distributions are to members of the defined family group.

`:''}RESOLUTION ${n++} — RECORD KEEPING

The trustee will: (a) retain these minutes; (b) disclose present
entitlements in the Trust tax return; (c) notify each beneficiary
of their entitlement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CERTIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These resolutions were passed before 30 June ${yr}. The Trust deed
authorises each resolution. A signed copy will be retained.


_________________________________
${inp.trusteeNames||'[TRUSTEE]'}
Trustee of the ${inp.trustName}

Date: ___________________________


_______________________________    _______________________________
Director / Authorised Signatory     Director / Secretary


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISCLAIMER: Computer-generated draft only. Must be reviewed by
a solicitor/registered tax agent. Execute BEFORE 30 June ${yr}.
Replace all estimated figures with actuals at year end.
Prepared: BAKR — Consultants for Accountants Pty Ltd
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function TrustDistribution(){
  const [tab,setTab]=useState(0)
  const [inp,setInp]=useState<TrustInputs>(DEF_TRUST)
  const [benefs,setBenefs]=useState<Beneficiary[]>(DEF_BENEFS)
  const calc=useMemo(()=>compute(inp,benefs),[inp,benefs])
  const setT=useCallback(<K extends keyof TrustInputs>(k:K,v:TrustInputs[K])=>setInp(p=>({...p,[k]:v})),[])
  const addB=()=>setBenefs(p=>[...p,{id:Date.now().toString(),name:'New Beneficiary',type:'adult_individual',age:30,otherIncome:0,companyTaxRate:0.25,manualAllocation:0}])
  const updB=<K extends keyof Beneficiary>(id:string,k:K,v:Beneficiary[K])=>setBenefs(p=>p.map(b=>b.id===id?{...b,[k]:v}:b))
  const delB=(id:string)=>setBenefs(p=>p.filter(b=>b.id!==id))
  const minutes=useMemo(()=>genMinutes(inp,benefs,calc),[inp,benefs,calc])

  return(
    <div className="min-h-screen bg-[#F8F6EC]">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm px-6 py-3 flex items-center gap-4">
        <Link href="/"><Image alt="BAKR" src="https://res.cloudinary.com/dmz8tsndt/image/upload/v1755063722/BAKR_New_Logo-01_fldmxk.svg" width={120} height={48} className="h-10 w-auto"/></Link>
        <div className="h-6 w-px bg-gray-200"/>
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Link href="/" className="hover:text-gray-600">Home</Link><span>/</span>
            <span className="text-blue-700 font-medium">Trust Distribution Analyser</span>
          </div>
          <h1 className="text-lg font-bold text-[#1F4E79]">Trust Distribution Analyser & Minutes Generator</h1>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/tools/super-optimiser" className="rounded-lg border border-[#1F4E79] px-3 py-1.5 text-xs font-semibold text-[#1F4E79] hover:bg-blue-50">→ Super Optimiser</Link>
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700">2024-25</span>
        </div>
      </div>
      <div className="bg-[#1F4E79] text-white px-6 py-3">
        <p className="text-sm max-w-5xl">Optimise distributions • CGT discount streaming (Subdiv 115-C) • Franking streaming (Subdiv 207-B) • Division 6AA minor penalty tax • s100A reimbursement agreement risk • Division 7A UPE analysis • Draft trustee resolution minutes</p>
        <p className="text-xs text-blue-200 mt-1">⚠ Planning only. Resolutions MUST be executed before 30 June. Finalise all figures with your registered tax agent.</p>
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

        {/* TAB 0 — TRUST & INCOME */}
        {tab===0&&(
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <SCard title="Trust Details" color="navy">
              <div className="space-y-3">
                <Fld label="Trust name"><TIn value={inp.trustName} onChange={v=>setT('trustName',v)}/></Fld>
                <Fld label="Trustee name(s)" note="Include 'ATF' — as per deed"><TIn value={inp.trusteeNames} onChange={v=>setT('trusteeNames',v)}/></Fld>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Financial year (30 June)"><TIn value={inp.financialYear} onChange={v=>setT('financialYear',v)}/></Fld>
                  <Fld label="ABN"><TIn value={inp.abn} onChange={v=>setT('abn',v)}/></Fld>
                  <Fld label="TFN"><TIn value={inp.tfn} onChange={v=>setT('tfn',v)}/></Fld>
                  <Fld label="Trust deed date"><DIn value={inp.trustDeedDate} onChange={v=>setT('trustDeedDate',v)}/></Fld>
                  <Fld label="Resolution date" note="Must be on or before 30 June"><DIn value={inp.trusteeResolutionDate} onChange={v=>setT('trusteeResolutionDate',v)}/></Fld>
                  <Fld label="Family Trust Election?">
                    <select value={inp.hasFte?'yes':'no'} onChange={e=>setT('hasFte',e.target.value==='yes')}
                      className="rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 w-full">
                      <option value="no">No FTE</option><option value="yes">Yes — FTE in force</option>
                    </select>
                  </Fld>
                  {inp.hasFte&&<Fld label="Family group surname"><TIn value={inp.fteSurname} onChange={v=>setT('fteSurname',v)}/></Fld>}
                </div>
              </div>
            </SCard>

            <SCard title="Ordinary Income & Deductions" color="blue">
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Business income ($)"><NIn value={inp.businessIncome} onChange={v=>setT('businessIncome',v)}/></Fld>
                <Fld label="Rental income ($)"><NIn value={inp.rentalIncome} onChange={v=>setT('rentalIncome',v)}/></Fld>
                <Fld label="Interest income ($)"><NIn value={inp.interestIncome} onChange={v=>setT('interestIncome',v)}/></Fld>
                <Fld label="Other ordinary income ($)"><NIn value={inp.otherIncome} onChange={v=>setT('otherIncome',v)}/></Fld>
                <Fld label="Franked dividends ($)"><NIn value={inp.frankingDividends} onChange={v=>setT('frankingDividends',v)}/></Fld>
                <Fld label="Franking credits ($)" note="= Div × 25/75 at 25% rate"><NIn value={inp.frankingCredits} onChange={v=>setT('frankingCredits',v)}/></Fld>
                <Fld label="Total deductions ($)" note="Including depreciation, interest"><NIn value={inp.deductions} onChange={v=>setT('deductions',v)}/></Fld>
              </div>
            </SCard>

            <SCard title="Capital Gains" color="blue">
              <div className="space-y-3">
                <Fld label="Discountable CG ($)" note="Assets held > 12 months — 50% discount if streamed to individuals"><NIn value={inp.discountableCG} onChange={v=>setT('discountableCG',v)}/></Fld>
                <Fld label="Non-discountable CG ($)" note="Assets held ≤ 12 months — no discount"><NIn value={inp.nonDiscountableCG} onChange={v=>setT('nonDiscountableCG',v)}/></Fld>
                <Fld label="Current year capital losses ($)"><NIn value={inp.currentCapLosses} onChange={v=>setT('currentCapLosses',v)}/></Fld>
                <Fld label="Prior year capital losses ($)"><NIn value={inp.priorCapLosses} onChange={v=>setT('priorCapLosses',v)}/></Fld>
                <Fld label="Prior year trust losses ($)" note="Confirm loss tests satisfied before applying"><NIn value={inp.priorTrustLosses} onChange={v=>setT('priorTrustLosses',v)}/></Fld>
              </div>
            </SCard>

            <SCard title="Estimated Trust Net Income (s97 ITAA 1997)" color="green">
              <div className="space-y-2 text-sm">
                {([['Business',inp.businessIncome],['Rental',inp.rentalIncome],['Interest',inp.interestIncome],['Other ordinary',inp.otherIncome],['Franked dividends',inp.frankingDividends],['Franking credits (s97(1A))',inp.frankingCredits],['Deductions',-(inp.deductions)],['Net capital gains',calc.netCG],['Prior trust losses',-(inp.priorTrustLosses)]] as [string,number][]).map(([l,v])=>(
                  <div key={l} className={`flex justify-between py-1.5 border-b border-gray-100 text-xs ${v<0?'text-red-600':''}`}>
                    <span className="text-gray-600">{l}</span><span className="font-medium">{v<0?`(${$f(-v)})`:$f(v)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 bg-emerald-50 rounded-lg px-3 mt-1 font-bold text-emerald-800">
                  <span>TRUST NET INCOME</span><span className="text-lg">{$f(calc.tni)}</span>
                </div>
              </div>
            </SCard>
          </div>
        )}

        {/* TAB 1 — BENEFICIARIES */}
        {tab===1&&(
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <p className="text-sm text-gray-600 max-w-2xl">Add all beneficiaries within the deed&apos;s discretionary class. The optimiser fills the lowest marginal rate first, filling each tax bracket before moving to the next. Set a manual allocation to override (use $1 minimum to name a beneficiary in streaming resolutions).</p>
              <button onClick={addB} className="ml-4 shrink-0 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E75B6]">+ Add Beneficiary</button>
            </div>
            {benefs.map(b=>(
              <SCard key={b.id} title={`${b.name} — ${BLAB[b.type]} | EMR: ${pct(emr(b))}`} color={b.type==='minor'?'amber':b.type==='company'?'gray':b.type==='smsf'?'green':b.type==='non_resident'?'red':'blue'}>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 items-end">
                  <Fld label="Name"><TIn value={b.name} onChange={v=>updB(b.id,'name',v)}/></Fld>
                  <Fld label="Type">
                    <select value={b.type} onChange={e=>updB(b.id,'type',e.target.value as BenefType)}
                      className="rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 w-full">
                      {Object.entries(BLAB).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                    </select>
                  </Fld>
                  {b.type==='minor'&&<Fld label="Age"><NIn value={b.age} onChange={v=>updB(b.id,'age',v)}/></Fld>}
                  {(b.type==='adult_individual'||b.type==='minor')&&<Fld label="Other income ($)" note="Salary + other distributions"><NIn value={b.otherIncome} onChange={v=>updB(b.id,'otherIncome',v)}/></Fld>}
                  {b.type==='company'&&<Fld label="Tax rate"><select value={b.companyTaxRate} onChange={e=>updB(b.id,'companyTaxRate',parseFloat(e.target.value))} className="rounded-lg border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 w-full"><option value={0.25}>25% — Base rate</option><option value={0.30}>30% — Standard</option></select></Fld>}
                  <Fld label="Manual allocation ($)" note="0 = auto"><NIn value={b.manualAllocation} onChange={v=>updB(b.id,'manualAllocation',v)}/></Fld>
                  <button onClick={()=>delB(b.id)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 hover:bg-red-100">Remove</button>
                </div>
                {b.type==='minor'&&<div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800"><strong>Div 6AA:</strong> Nil ≤ $416 | 66% on $417–$1,307 | 45% on entire amount if &gt; $1,307. Auto-capped at $416. Excepted income (employment, deceased estate) taxed at normal rates.</div>}
                {b.type==='company'&&<div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-2 text-xs text-gray-700"><strong>Div 7A UPE:</strong> Must be repaid or placed on compliant sub-trust (7yr unsecured / 25yr secured) at benchmark rate 8.27% under PCG 2017/13. Non-compliance = deemed dividend.</div>}
              </SCard>
            ))}
          </div>
        )}

        {/* TAB 2 — OPTIMAL DISTRIBUTION */}
        {tab===2&&(
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Trust net income" value={$f(calc.tni)}/>
              <Stat label="Optimised total tax" value={$f(calc.totalTax)} color="amber"/>
              <Stat label="Tax at top rate 47% (comparison)" value={$f(calc.topTax)} color="red"/>
              <Stat label="★ Annual tax saving" value={$f(calc.saving)} color="green" sub="vs all distributions at 47%"/>
            </div>

            {calc.warnings.filter(w=>w.level==='critical'||w.level==='high').map((w,i)=>(
              <div key={i} className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{w.text}</div>
            ))}

            <SCard title="Optimised Distribution Table" color="navy">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1F4E79] text-white">
                      {['Beneficiary','Type','Other Income','Distribution','% of TNI','Marg. Rate','Tax on Dist.','After-Tax','Eff. Rate'].map(h=>(
                        <th key={h} className="px-3 py-2 text-xs font-semibold whitespace-nowrap first:text-left text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {benefs.map((b,i)=>{
                      const d=calc.dists?.[b.id]||0
                      const tax=calc.taxBy?.[b.id]||0
                      return(
                        <tr key={b.id} className={i%2===0?'bg-white':'bg-gray-50'}>
                          <td className="px-3 py-2 font-medium">{b.name}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{BLAB[b.type]}</td>
                          <td className="px-3 py-2 text-right">{$f(b.otherIncome)}</td>
                          <td className="px-3 py-2 text-right font-bold text-[#1F4E79]">{$f(d)}</td>
                          <td className="px-3 py-2 text-right">{calc.tni>0?pct(d/calc.tni):'—'}</td>
                          <td className="px-3 py-2 text-right">{pct(emr(b,d/2))}</td>
                          <td className="px-3 py-2 text-right text-red-600">{$f(tax)}</td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{$f(d-tax)}</td>
                          <td className="px-3 py-2 text-right">{d>0?pct(tax/d):'—'}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-[#1F4E79] text-white font-bold">
                      <td className="px-3 py-2" colSpan={3}>TOTAL</td>
                      <td className="px-3 py-2 text-right">{$f(calc.tni)}</td>
                      <td className="px-3 py-2 text-right">100%</td>
                      <td className="px-3 py-2 text-right">{calc.tni>0?pct(calc.totalTax/calc.tni):'—'}</td>
                      <td className="px-3 py-2 text-right">{$f(calc.totalTax)}</td>
                      <td className="px-3 py-2 text-right">{$f(calc.tni-calc.totalTax)}</td>
                      <td className="px-3 py-2 text-right">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SCard>
          </div>
        )}

        {/* TAB 3 — STREAMING */}
        {tab===3&&(
          <div className="space-y-4 max-w-4xl">
            <SCard title="CGT Discount Streaming — Subdivision 115-C ITAA 1997" color="blue">
              <div className="space-y-3">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
                  <p><strong>Rule:</strong> Under s115-228, the trustee may specifically assign shares of a capital gain to individual beneficiaries who can then access the 50% CGT discount (1/3 for SMSFs). Companies and trust entities cannot access the discount.</p>
                  <p><strong>Timing:</strong> Must be resolved in writing before 30 June. A generic &apos;all income&apos; resolution does NOT achieve streaming.</p>
                  <p><strong>Limit:</strong> Cannot stream more CG to a beneficiary than their share of trust income permits.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-[#2E75B6] text-white">
                      {['Beneficiary','Distribution','CG Streamed','Discount?','CG After Discount','Tax on CG'].map(h=><th key={h} className="px-3 py-2 text-xs font-semibold first:text-left text-right">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {benefs.map((b,i)=>{
                        const d=calc.dists?.[b.id]||0
                        const cg=calc.cgStream?.[b.id]||0
                        const eligible=b.type==='adult_individual'||b.type==='smsf'
                        const disc=b.type==='smsf'?1/3:0.5
                        const cgAD=eligible?cg*(1-disc):cg
                        const cgTax=eligible?cgAD*emr(b,b.otherIncome+d/2):cg*emr(b)
                        return(<tr key={b.id} className={i%2===0?'bg-white':'bg-gray-50'}>
                          <td className="px-3 py-2 font-medium">{b.name}</td>
                          <td className="px-3 py-2 text-right">{$f(d)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{cg>0?$f(cg):'—'}</td>
                          <td className="px-3 py-2 text-right">{eligible?<span className="text-emerald-700 font-semibold">✓ {b.type==='smsf'?'33.3%':'50%'}</span>:<span className="text-red-500">✗ None</span>}</td>
                          <td className="px-3 py-2 text-right">{cg>0?$f(cgAD):'—'}</td>
                          <td className="px-3 py-2 text-right text-red-600">{cg>0?$f(cgTax):'—'}</td>
                        </tr>)
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </SCard>

            <SCard title="Franking Credit Streaming — Subdivision 207-B ITAA 1997" color="blue">
              <div className="space-y-3">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
                  <p><strong>Rule:</strong> Under s207-55, the trustee may allocate frankable distributions and their franking credits to specific beneficiaries. The allocated credits offset tax dollar-for-dollar. If credits exceed tax, the ATO refunds the excess.</p>
                  <p><strong>Anti-avoidance:</strong> Streaming must not trigger s207-45 (e.g., streaming only to entities that can obtain a refund while directing unfranked income to others to circumvent franking). Allocation should be proportionate.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-[#2E75B6] text-white">
                      {['Beneficiary','Distribution','Franking Credits','Grossed-Up','Tax (marginal)','Net Tax / (Refund)'].map(h=><th key={h} className="px-3 py-2 text-xs font-semibold first:text-left text-right">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {benefs.map((b,i)=>{
                        const d=calc.dists?.[b.id]||0
                        const fc=calc.fkStream?.[b.id]||0
                        const grossed=d+fc
                        const taxOnGrossed=b.type==='adult_individual'?(netTax(b.otherIncome+grossed)-netTax(b.otherIncome)):grossed*emr(b)
                        const netTaxFinal=taxOnGrossed-fc
                        return(<tr key={b.id} className={i%2===0?'bg-white':'bg-gray-50'}>
                          <td className="px-3 py-2 font-medium">{b.name}</td>
                          <td className="px-3 py-2 text-right">{$f(d)}</td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{fc>0?$f(fc):'—'}</td>
                          <td className="px-3 py-2 text-right">{fc>0?$f(grossed):'—'}</td>
                          <td className="px-3 py-2 text-right">{fc>0?$f(taxOnGrossed):'—'}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${fc>0&&netTaxFinal<0?'text-emerald-700':'text-red-600'}`}>{fc>0?(netTaxFinal<0?`(${$f(-netTaxFinal)}) REFUND`:$f(netTaxFinal)):'—'}</td>
                        </tr>)
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </SCard>
          </div>
        )}

        {/* TAB 4 — RISK ANALYSIS */}
        {tab===4&&(
          <div className="space-y-4 max-w-4xl">
            {calc.warnings.filter(w=>w.level==='critical').length>0&&(
              <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4 space-y-2">
                <p className="text-sm font-bold text-red-900">🚨 CRITICAL — Action required immediately:</p>
                {calc.warnings.filter(w=>w.level==='critical').map((w,i)=><p key={i} className="text-sm text-red-800">{w.text}</p>)}
              </div>
            )}
            {calc.warnings.filter(w=>w.level==='high').length>0&&(
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1">
                {calc.warnings.filter(w=>w.level==='high').map((w,i)=><p key={i} className="text-sm text-red-700">⚠ {w.text}</p>)}
              </div>
            )}
            {calc.warnings.filter(w=>w.level==='medium').length>0&&(
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-1">
                {calc.warnings.filter(w=>w.level==='medium').map((w,i)=><p key={i} className="text-sm text-amber-800">ℹ {w.text}</p>)}
              </div>
            )}
            {calc.warnings.filter(w=>w.level==='info').length>0&&(
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-1">
                {calc.warnings.filter(w=>w.level==='info').map((w,i)=><p key={i} className="text-sm text-blue-800">💡 {w.text}</p>)}
              </div>
            )}
            {calc.warnings.length===0&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">✅ No significant issues identified. Review compliance checklist below.</div>}

            {[
              {title:'Section 100A — Reimbursement Agreements (TR 2022/4 / PCG 2022/2)',color:'red' as const,items:[
                {r:'CRITICAL',issue:'Trustee resolution after 30 June',detail:'A trustee resolution MUST be made before midnight 30 June. A late, undated, or backdated resolution is wholly ineffective. The entire TNI is assessed to the trustee at 47%.'},
                {r:'HIGH',issue:'Low-income beneficiary whose entitlement benefits an associate',detail:'ATO PCG 2022/2 "high risk" zone: adult child receiving distribution where funds revert to parents; distribution to a spouse where the entitlement is used by the higher-income spouse. Document genuine economic benefit to the beneficiary.'},
                {r:'MEDIUM',issue:'Circular flows: trust → company → shareholder',detail:'Where funds flow back via a related entity to the economic benefit of a different person than the named beneficiary, s100A may apply. Ensure genuine commercial or family purpose.'},
                {r:'LOW',issue:'"Ordinary family dealing" safe harbour',detail:'Distributions to a spouse or adult child who genuinely uses the funds for living expenses, residing in Australia, with funds paid directly to their account = low risk per PCG 2022/2 "green zone".'},
              ]},
              {title:'Division 6AA — Minor Beneficiaries (s102AC ITAA 1936)',color:'amber' as const,items:[
                {r:'CRITICAL',issue:'Income > $1,307 → 45% on entire amount',detail:'If total unexcepted income exceeds $1,307, the ENTIRE amount is taxed at 45% (not just the excess). Not just a penalty on the excess — the whole amount is affected.'},
                {r:'HIGH',issue:'Income $417–$1,307 → 66% on excess',detail:'Each dollar over $416 is taxed at 66c. Very high effective rate. Consider restricting distribution to $416 maximum.'},
                {r:'SAFE',issue:'"Excepted income" taxed at normal rates',detail:'Employment income, deceased estate distributions (within 3 income years of death), certain disability trust income and compensation income are "excepted income" — taxed at normal resident rates.'},
                {r:'NOTE',issue:'Must be under 18 for the ENTIRE income year',detail:'A person who turns 18 during the year is treated as a minor for Division 6AA purposes for the whole year. They must have attained age 18 on or before 1 July to avoid penalty tax.'},
              ]},
              {title:'Division 7A — Corporate Beneficiary UPEs (PCG 2017/13 / TR 2010/3)',color:'gray' as const,items:[
                {r:'HIGH',issue:'Post-16 Dec 2009 UPE to related private company',detail:'Treated as a loan for Div 7A purposes unless the trustee places the UPE on compliant sub-trust terms. Non-compliance = unfranked deemed dividend to the shareholder of the company.'},
                {r:'MEDIUM',issue:'7-year sub-trust option (unsecured)',detail:'Benchmark rate 8.27% (2024-25), annual minimum repayments. Must have written loan agreement in place by lodgement date of Trust return or 31 May following year-end (whichever earlier).'},
                {r:'MEDIUM',issue:'25-year sub-trust option (secured)',detail:'Where secured by registered mortgage over real property. Same benchmark rate. Annual minimum repayments calculated on reducing balance.'},
                {r:'INFO',issue:'Draft Div 7A reform legislation pending',detail:'Treasury consultation on reforming Division 7A (announced 2022 Budget) is ongoing. Monitor for legislative changes that may affect sub-trust arrangements.'},
              ]},
              {title:'Trust Losses — Schedule 2F ITAA 1936',color:'gray' as const,items:[
                {r:'REVIEW',issue:'Prior year trust losses — loss tests required',detail:'Discretionary trusts must pass the "income injection test" AND "pattern of distributions test" (same persons in beneficial receipt for 2 prior years) or have a FTE in force to apply prior year losses.'},
                {r:'INFO',issue:'Current year losses cannot be distributed',detail:'A trust cannot create a present entitlement to a loss. Current year losses are quarantined in the trust and carried forward subject to loss tests.'},
              ]},
            ].map(section=>(
              <SCard key={section.title} title={section.title} color={section.color}>
                <div className="space-y-2">
                  {section.items.map((item,i)=>(
                    <div key={i} className="rounded-lg border border-gray-100 p-3">
                      <div className="flex items-start gap-2 mb-1">
                        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${['HIGH','CRITICAL'].includes(item.r)?'bg-red-100 text-red-700':['MEDIUM','REVIEW'].includes(item.r)?'bg-amber-100 text-amber-700':['SAFE','LOW'].includes(item.r)?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-600'}`}>{item.r}</span>
                        <p className="text-sm font-semibold text-gray-800">{item.issue}</p>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </SCard>
            ))}
          </div>
        )}

        {/* TAB 5 — TRUST MINUTES */}
        {tab===5&&(
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Draft trustee resolution minutes — review all figures, have executed by a solicitor or registered tax agent, and sign before 30 June {inp.financialYear}.</p>
                <p className="text-xs text-gray-500 mt-0.5">Replace all estimated figures with actuals before execution. Insert commercial basis for each distribution in the s100A section.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={()=>navigator.clipboard?.writeText(minutes)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">📋 Copy</button>
                <button onClick={()=>{const a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(minutes);a.download=`${inp.trustName.replace(/\s+/g,'-')}-Minutes-FY${inp.financialYear}.txt`;a.click()}}
                  className="rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E75B6]">↓ Download .txt</button>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <pre className="p-6 text-xs font-mono text-gray-800 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-[70vh] overflow-y-auto">{minutes}</pre>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
