"use client";

import { useState, useMemo } from "react";

const NAVY = "#1F4E79";
const BLUE = "#2E75B6";
const BG = "#F8F6EC";
const GREEN = "#2D6A4F";
const AMBER = "#B45309";
const RED = "#9B2226";
const LIGHT_BLUE = "#D6E8F7";
const BORDER = "#D4C9A8";

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
};
const pct = (n) => (isNaN(n) ? "0.00%" : `${(n * 100).toFixed(2)}%`);

const Badge = ({ status, children }) => {
  const colors = {
    pass: { bg: "#D1FAE5", text: GREEN, border: "#6EE7B7" },
    fail: { bg: "#FEE2E2", text: RED, border: "#FCA5A5" },
    warn: { bg: "#FEF3C7", text: AMBER, border: "#FCD34D" },
    info: { bg: LIGHT_BLUE, text: NAVY, border: "#93C5FD" },
    neutral: { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" },
  };
  const c = colors[status] || colors.neutral;
  return <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>{children}</span>;
};

const CheckItem = ({ checked, onChange, children, sub, warn, legislativeRef, trap }) => (
  <div style={{ padding: "10px 0", borderBottom: `1px solid ${BORDER}33` }}>
    <label style={{ display: "flex", gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ marginTop: 3, accentColor: NAVY, width: 18, height: 18, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 14, color: "#1a1a1a", lineHeight: 1.5 }}>{children}</span>
        {legislativeRef && <span style={{ display: "inline-block", marginLeft: 8, fontSize: 11, color: BLUE, background: `${BLUE}11`, padding: "1px 6px", borderRadius: 3, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500 }}>{legislativeRef}</span>}
        {sub && <div style={{ fontSize: 12.5, color: "#666", marginTop: 4, lineHeight: 1.6 }}>{sub}</div>}
        {warn && <div style={{ fontSize: 12.5, color: AMBER, marginTop: 4, lineHeight: 1.5, fontWeight: 500 }}>⚠ {warn}</div>}
        {trap && <div style={{ fontSize: 12.5, color: RED, marginTop: 4, lineHeight: 1.5, fontWeight: 600 }}>🚫 TRAP: {trap}</div>}
      </div>
    </label>
  </div>
);

const InputRow = ({ label, value, onChange, prefix = "$", suffix, hint, type = "number" }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 4 }}>{label}</label>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {prefix && <span style={{ fontSize: 14, color: "#666", fontWeight: 500 }}>{prefix}</span>}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", background: "white", maxWidth: 200 }} />
      {suffix && <span style={{ fontSize: 13, color: "#666" }}>{suffix}</span>}
    </div>
    {hint && <div style={{ fontSize: 11.5, color: "#888", marginTop: 3 }}>{hint}</div>}
  </div>
);

const ResultBox = ({ label, value, status }) => {
  const bgMap = { pass: "#D1FAE520", fail: "#FEE2E220", warn: "#FEF3C720", info: `${LIGHT_BLUE}40` };
  const borderMap = { pass: GREEN, fail: RED, warn: AMBER, info: BLUE };
  return (
    <div style={{ padding: "10px 14px", borderRadius: 6, background: bgMap[status] || "#f9f9f9", borderLeft: `3px solid ${borderMap[status] || BORDER}`, marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: borderMap[status] || NAVY, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{value}</div>
    </div>
  );
};

const Section = ({ title, number, children, progress, expanded, onToggle, badge }) => (
  <div style={{ marginBottom: 16, border: `1px solid ${BORDER}`, borderRadius: 8, background: "white", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
    <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: expanded ? `${NAVY}08` : "white", border: "none", cursor: "pointer", textAlign: "left" }}>
      <span style={{ background: NAVY, color: "white", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{number}</span>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: NAVY }}>{title}</span>
      {badge && <Badge status={badge.status}>{badge.label}</Badge>}
      {progress !== undefined && <div style={{ width: 60, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", background: progress === 100 ? GREEN : BLUE, borderRadius: 3, transition: "width 0.3s" }} /></div>}
      <span style={{ fontSize: 18, color: "#999", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
    </button>
    {expanded && <div style={{ padding: "4px 18px 18px" }}>{children}</div>}
  </div>
);

const Callout = ({ type, title, children }) => {
  const styles = { danger: { bg: "#FEF2F2", border: RED, icon: "🚫", tc: RED }, warning: { bg: "#FFFBEB", border: AMBER, icon: "⚠️", tc: AMBER }, info: { bg: "#EFF6FF", border: BLUE, icon: "ℹ️", tc: BLUE }, tip: { bg: "#F0FDF4", border: GREEN, icon: "✅", tc: GREEN }, law: { bg: "#F5F3FF", border: "#7C3AED", icon: "⚖️", tc: "#7C3AED" }, trap: { bg: "#FFF1F2", border: "#E11D48", icon: "💣", tc: "#E11D48" } };
  const s = styles[type] || styles.info;
  return <div style={{ background: s.bg, borderLeft: `3px solid ${s.border}`, borderRadius: 6, padding: "12px 14px", margin: "12px 0", fontSize: 13, lineHeight: 1.6 }}><div style={{ fontWeight: 700, color: s.tc, marginBottom: 4, fontSize: 13 }}>{s.icon} {title}</div><div style={{ color: "#374151" }}>{children}</div></div>;
};

const SubHead = ({ children }) => <h4 style={{ fontSize: 13, fontWeight: 700, color: NAVY, margin: "16px 0 10px", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${BORDER}44`, paddingBottom: 6 }}>{children}</h4>;

export default function DividendToolkit() {
  const [expanded, setExpanded] = useState({ 1: true });
  const toggle = (n) => setExpanded((p) => ({ ...p, [n]: !p[n] }));
  const expandAll = () => { const o = {}; for (let i = 1; i <= 14; i++) o[i] = true; setExpanded(o); };
  const collapseAll = () => setExpanded({});
  const [c, setC] = useState({});
  const chk = (id) => !!c[id];
  const tog = (id) => setC((p) => ({ ...p, [id]: !p[id] }));

  // Affordability
  const [aff, setAff] = useState({ totalAssets: "", totalLiabilities: "", retainedEarnings: "", proposedDiv: "", cashAtBank: "", debtorsCurrent: "", creditorsCurrent: "", basDue: "", superDue: "", loanRepay: "", otherCommitments: "" });
  const aN = (k) => parseFloat(aff[k]) || 0;
  const netAssets = aN("totalAssets") - aN("totalLiabilities");
  const profitsAvailable = aN("retainedEarnings");
  const profitsTestPass = profitsAvailable >= aN("proposedDiv") && aN("proposedDiv") > 0;
  const netAssetsTestPass = netAssets >= aN("proposedDiv") && aN("proposedDiv") > 0;
  const cashAfterDiv = aN("cashAtBank") + aN("debtorsCurrent") - aN("creditorsCurrent") - aN("basDue") - aN("superDue") - aN("loanRepay") - aN("otherCommitments") - aN("proposedDiv");
  const isCashSolvent = cashAfterDiv >= 0;

  // Franking
  const [frank, setFrank] = useState({ aggregatedTurnover: "", baseTurnoverCurrent: "", baseIncomePassive: "", frankingBalance: "", dividendAmount: "", taxRate: "", frankingChoice: "max", customCredit: "" });
  const fN = (k) => parseFloat(frank[k]) || 0;
  const isBaseRate = useMemo(() => { const to = fN("aggregatedTurnover"); const pr = fN("baseTurnoverCurrent") > 0 ? fN("baseIncomePassive") / fN("baseTurnoverCurrent") : 0; return to < 50000000 && pr <= 0.80; }, [frank]);
  const appRate = isBaseRate ? 0.25 : 0.30;
  const selRate = frank.taxRate ? parseFloat(frank.taxRate) / 100 : appRate;
  const maxFC = fN("dividendAmount") > 0 ? (fN("dividendAmount") * selRate) / (1 - selRate) : 0;
  const maxBal = fN("frankingBalance");
  const chosenFC = frank.frankingChoice === "nil" ? 0 : frank.frankingChoice === "custom" ? Math.min(parseFloat(frank.customCredit) || 0, maxFC, maxBal) : Math.min(maxFC, maxBal);
  const fPct = maxFC > 0 ? (chosenFC / maxFC) * 100 : 0;
  const grossedUp = fN("dividendAmount") + chosenFC;

  // Trust
  const [trustCalc, setTrustCalc] = useState({ divReceived: "", frankCredReceived: "", beneficiaries: "1" });
  const tN = (k) => parseFloat(trustCalc[k]) || 0;
  const trustGU = tN("divReceived") + tN("frankCredReceived");
  const benCt = Math.max(parseInt(trustCalc.beneficiaries) || 1, 1);

  // Timeline
  const [timeline, setTimeline] = useState({ fyEnd: "2026-06-30", declarationDate: "", recordDate: "", paymentDate: "" });

  // ── SECTION DATA ──
  const s1 = [
    { id: "s1_constitution", text: "Review company constitution for any restrictions on dividend payments", sub: "Check for: dividend caps, preferential dividend rights, classes of shares with different entitlements, director discretion clauses, any requirement for shareholder approval, and any prohibition on paying dividends while cumulative preference dividends remain unpaid.", ref: "s254T(2) Corps Act" },
    { id: "s1_sha", text: "Review any shareholder agreement for dividend-related provisions", sub: "Look for: minimum dividend policies, retained earnings thresholds, pre-emptive rights, veto provisions, and restrictions on dividends where related-party loans are outstanding." },
    { id: "s1_classes", text: "Identify all classes of shares on issue and their dividend entitlements", sub: "Document: ordinary, preference (cumulative/non-cumulative), redeemable preference, dividend access shares, alphabet shares. Each class may have a separate benchmark franking percentage under s203-20 ITAA97.", ref: "s254A, s254W Corps Act" },
    { id: "s1_profits", text: "Confirm the company satisfies the profits test — accounting profits are available", sub: "CRITICAL DISTINCTION: 'Profits' under s254T means accounting profits per Australian Accounting Standards (AASB), NOT taxable income. A company may have large taxable income but negative retained earnings (failing the test), or vice versa. The test examines the balance sheet retained earnings position. Unrealised gains recognised under AASB (e.g., fair value adjustments on investment property) may technically form part of accounting profit, but directors should exercise caution — the better and more conservative view is that profits relied upon should be realised and distributable.", ref: "s254T(1) Corps Act", warn: "Since 28 June 2010 (Corporations Amendment (Corporate Reporting Reform) Act 2010), dividends can only be paid from profits. The former ability to pay from share premium or capital profits was abolished." },
    { id: "s1_solvency", text: "Directors are satisfied the company will remain solvent after payment", sub: "The company must be able to pay its debts as and when they fall due. Prepare a forward cash flow projection covering at least 12 months. Consider: BAS/IAS obligations, PAYG withholding, super guarantee, loan repayments, lease commitments, seasonal variations, and contingent liabilities.", ref: "s588G, s95A Corps Act", trap: "Directors face personal liability under s588G if dividends are paid when insolvent or if the company becomes insolvent as a result. Defence available only if the director had reasonable grounds to expect solvency (s588H)." },
    { id: "s1_covenants", text: "Check loan/facility agreements for dividend restrictions or financial covenants", sub: "Bank facilities commonly include covenants restricting dividends (e.g., minimum interest cover, maximum gearing, minimum NTA, prior bank consent). Check all facilities: term loans, overdraft, equipment finance, property loans. Breach may trigger a default event." },
    { id: "s1_asic", text: "Confirm all ASIC annual reviews and lodgements are current", sub: "Ensure the company details on the ASIC register are accurate: registered office, principal place of business, directors, members, share structure." },
    { id: "s1_ato", text: "Confirm all ATO lodgements and payment obligations are current", sub: "Check: income tax returns, BAS/IAS, PAYG withholding, super guarantee charge, FBT returns. Outstanding ATO debts affect solvency and may trigger Director Penalty Notice (DPN) or lockdown DPN exposure.", ref: "Div 269 Sch 1 TAA", trap: "If PAYG withholding or super guarantee is overdue by more than 3 months, directors face lockdown DPN exposure — no ability to remit by placing the company into administration or liquidation." },
    { id: "s1_losses", text: "Consider the impact of prior year accumulated losses on retained earnings", sub: "Accumulated losses must be recovered before distributable profits exist. If retained earnings are negative, no dividend can be paid even if the current year is profitable — the current year profit must first offset accumulated losses." },
    { id: "s1_div7a_existing", text: "Review any existing Division 7A loans — consider set-off strategy", sub: "Before declaring, determine whether the dividend should be applied against existing Div 7A loan balances via set-off (see Section 8). Also confirm minimum yearly repayments (MYR) on all Div 7A loans are current.", ref: "Div 7A ITAA36" },
  ];

  const s3 = [
    { id: "s3_identify", text: "Identify all share classes and confirm dividend rights for each class", sub: "Under s254W, rights attached to shares in a class must be treated equally. A 'class' is defined by the rights attached to the shares, not the label given to them. Shares with identical rights are the same class regardless of naming convention.", ref: "s254W Corps Act" },
    { id: "s3_ato_view", text: "Understand the ATO's position on alphabet shares and dividend access share arrangements", sub: "The ATO closely scrutinises multiple share class structures (often called 'alphabet shares' or 'dividend access shares') used to stream dividends to specific family members or trusts. Taxpayer Alert TA 2014/1 targets arrangements where: (a) different classes are issued to different shareholders (often trusts); (b) directors exercise discretion to pay dividends on only one class; and (c) the purpose is to direct franking credits to a preferred recipient on a lower marginal rate. The ATO may apply Part IVA where the dominant purpose is to obtain a tax benefit.", ref: "TA 2014/1, Part IVA ITAA36", warn: "TA 2014/1 specifically states the ATO will examine whether share class structures have genuine commercial substance beyond directing dividends and franking credits to preferred recipients." },
    { id: "s3_equal", text: "Ensure all shareholders within the same class receive the same dividend per share", sub: "It is not lawful to declare a dividend on some shares in a class but not others, or at different rates within the same class. Differential treatment requires genuinely different share classes with different rights specified in the constitution.", ref: "s254W Corps Act" },
    { id: "s3_pref", text: "If preference shares exist — check priority and cumulative entitlements", sub: "Preference shares typically carry a right to a fixed dividend before ordinary dividends. If cumulative, any unpaid preference dividends from prior years must be paid first. Check: rate, cumulative vs non-cumulative, participating vs non-participating, and any conditions precedent." },
    { id: "s3_benchmark_class", text: "Each class of membership interest has its own benchmark franking percentage", sub: "Under s203-20, the benchmark is set separately for each class. This means dividends on Class A shares can be franked at 100% while Class B shares receive an unfranked dividend — provided the benchmark for each class is maintained consistently throughout the franking period. This is one of the few legitimate mechanisms for differential franking treatment.", ref: "s203-20 ITAA97" },
    { id: "s3_rationale", text: "Document the commercial rationale for any differential dividend treatment between classes", sub: "If paying different amounts or different franking rates across classes, ensure a documented commercial purpose beyond tax minimisation exists. Examples of genuine rationale: different capital contributions, different risk profiles, genuine preference arrangements, employee share schemes. Lack of commercial rationale significantly increases Part IVA risk." },
  ];

  const s5 = [
    { id: "s5_rec", text: "Prepare a franking account reconciliation from start of current franking period", sub: "Reconcile all credits (PAYG instalments paid, prior year tax assessed, franking credits on dividends received) and debits (dividends paid, refunds received, FDT assessments). The franking account is a memorandum (off-balance-sheet) account.", ref: "s205-10 ITAA97" },
    { id: "s5_benchmark", text: "Confirm benchmark rule compliance for each class", sub: "The first frankable distribution in the franking period sets the benchmark for that class. All subsequent distributions to the same class must match (±5% tolerance only for changes in shares on issue). If breached: the excess franking credit is denied to shareholders and over-franking tax may apply.", ref: "s203-25 ITAA97", warn: "Setting the benchmark with the first dividend is a critical strategic decision — it locks in the franking rate for the entire franking period for that class." },
    { id: "s5_deficit", text: "Confirm no franking deficit will arise after paying the proposed franking credit", sub: "A franking deficit at year end triggers franking deficit tax (FDT) equal to the deficit. FDT is not deductible. A 30% offset applies for late-balancing small companies where the deficit arises from current-year instalment timing.", ref: "s205-45 ITAA97" },
    { id: "s5_intercorp", text: "Record franking credits from dividends received from other companies", sub: "Franking credits on dividends received are credited to the company's franking account on the day the dividend is paid to the company (not when declared by the paying company).", ref: "s205-15 ITAA97" },
    { id: "s5_payg", text: "Record PAYG instalment credits to the franking account", sub: "PAYG instalments give rise to franking credits on the day the instalment is due (or actual payment date if paid late). Ensure all quarterly instalment credits are recorded.", ref: "s205-15(1)(b) ITAA97" },
    { id: "s5_refund", text: "Factor in any pending tax refund — it will debit the franking account", sub: "A tax refund debits the franking account when received or offset. If a refund is expected, factor this in before declaring to avoid inadvertently creating a deficit.", ref: "s205-30 ITAA97" },
  ];

  const s6 = [
    { id: "s6_method", text: "Determine: directors' meeting or circular resolution", sub: "Proprietary companies may pass resolutions without a meeting if all directors sign a document stating they are in favour (s248A). A meeting requires proper notice, quorum (usually 2 directors or as per constitution), and formal minutes.", ref: "s248A, s248C Corps Act" },
    { id: "s6_actually_held", text: "CRITICAL: The meeting or resolution process must ACTUALLY OCCUR on the stated date", sub: "The date of the resolution is the date it is actually passed — the meeting date, or for a circular resolution, the date the last director signs. The ATO and ASIC may investigate whether the meeting genuinely occurred. Documentary support (e.g., contemporaneous emails, calendar invites, attendance records) strengthens the position.", ref: "s251A Corps Act" },
    { id: "s6_circular_date", text: "Circular resolution: the effective date is when the LAST director signs", sub: "Under s248A, a circular resolution is effective when the last director entitled to vote signs. If Director A signs 15 June and Director B signs 20 June, the resolution date is 20 June — NOT 15 June. The resolution document should record the date each director signed. For a sole director, the date is when that director signs.", ref: "s248A Corps Act", trap: "Do NOT date the circular resolution as the date the first director signed. Pre-dating to a date before all directors have signed is a misstatement that could invalidate the resolution." },
    { id: "s6_minutes_month", text: "Record the minutes within one month of the meeting", sub: "Section 251A(1) requires minutes to be recorded within one month. Minutes signed by the chairperson are evidence of proceedings (s251A(6)). The minutes RECORD the meeting — they do not CREATE the resolution. The resolution was made at the meeting itself.", ref: "s251A(1), s251A(6) Corps Act" },
    { id: "s6_dating_vs_backdating", text: "Understand the critical distinction: dating a minute vs backdating (fabrication)", sub: "LEGITIMATE: A meeting is held on 15 June. Minutes are physically typed on 22 June and dated '15 June' (the meeting date). This is correct record-keeping — recording a genuine historical event. CRIMINAL: No meeting occurred on 15 June, but minutes are created on 22 June and falsely dated 15 June to create the appearance of a meeting. This is fabrication of a company record — an offence under s1307 Corps Act (falsification of books) and potentially state criminal law (forgery/fraud). If a meeting was genuinely missed, the correct approach is to hold the meeting now, date the minutes with today's date, and accept any consequences of the delay.", ref: "s1307 Corps Act", trap: "Creating minutes for a meeting that never occurred is a criminal offence (s1307 — penalty: imprisonment up to 1 year and/or fine). It can also render the dividend declaration void, expose directors to personal liability, and attract ASIC prosecution." },
    { id: "s6_ato_timing", text: "ATO timing: the declaration must be effective BEFORE the payment date", sub: "For franking purposes, the company must have resolved to pay the dividend before payment occurs. The ATO may challenge a franking credit if the resolution was not effective before payment. Key scenarios: (a) dividend declared and paid same day — resolution must be passed first; (b) circular resolution still being circulated when payment is made — resolution is NOT yet effective. Also, for trust streaming: the trustee must resolve before 30 June (s207-35(4)).", ref: "s202-40 ITAA97" },
    { id: "s6_sole_director", text: "Sole director company: record the sole director's written resolution", sub: "Under s248B, the sole director may pass a resolution by recording it and signing. This is not 'minutes' of a meeting but a written resolution. The effective date is the date the sole director signs.", ref: "s248B Corps Act" },
    { id: "s6_content", text: "Ensure the minutes/resolution contain all required elements", sub: "Must specify: (a) dividend per share for each class; (b) total dividend; (c) franking percentage and franking credit per share; (d) record date; (e) payment date; (f) that directors have considered the financial position and are satisfied the company satisfies s254T; (g) that directors are satisfied the company will remain solvent; (h) the financial statements relied upon (attach as appendix). If applying set-off against a shareholder loan, this should also be stated." },
    { id: "s6_solvency_dec", text: "Include a specific solvency declaration in the minutes", sub: "Best practice wording: 'The directors have reviewed the company's financial position including the balance sheet as at [date] and the forward cash flow projection, and are satisfied that the company meets the requirements of s254T Corporations Act 2001 and that the company will be able to pay its debts as and when they fall due for at least 12 months from the date of this resolution.' Attach the supporting financial statements to the minutes." },
  ];

  const s7 = [
    { id: "s7_div_stmt", text: "Prepare and issue a dividend statement to each shareholder", sub: "Must show: company name, ABN, shareholder name, number and class of shares, dividend per share, total dividend, franked and unfranked amounts, franking credit, franking percentage, record date, payment date, and any TFN withholding. Issue on or before the payment date.", ref: "s202-80 ITAA97" },
    { id: "s7_record_date", text: "Confirm the record date for determining shareholder entitlement", sub: "Only shareholders on the register at the record date are entitled. For proprietary companies, typically the declaration date. Ensure the share register is current and accurate.", ref: "s254H Corps Act" },
    { id: "s7_payment_date", text: "Set the payment date — the date the dividend is actually paid", sub: "The franking debit arises on the payment date (s205-30). Ensure funds are available. If using set-off, the set-off constitutes 'payment' on this date. The payment date must not precede the declaration date.", ref: "s205-30 ITAA97" },
    { id: "s7_journals", text: "Process accounting journal entries", sub: "On declaration: DR Retained Earnings / CR Dividend Payable. On payment: DR Dividend Payable / CR Cash at Bank (or CR Loan Receivable if set-off). Record the franking account movement in the off-balance-sheet memo account." },
    { id: "s7_tfn", text: "Apply TFN withholding if required", sub: "If a shareholder has not provided a TFN (or ABN where applicable), withhold at the top marginal rate + Medicare levy (currently 47%) from the unfranked portion. Remit to ATO and report on the PAYG withholding annual report (due 14 August). Fully franked dividends to residents are exempt from TFN withholding.", ref: "Div 12 Sch 1 TAA" },
    { id: "s7_far", text: "Determine if a franking account return is required", sub: "Required if: franking deficit at year end, venture capital sub-account allocation, life insurance company, or directed by ATO. Otherwise, franking info is reported in the company tax return.", ref: "s214-75 ITAA97" },
    { id: "s7_workpaper", text: "Assemble the work paper file", sub: "Include: (1) balance sheet/management accounts; (2) profits test calculation (accounting profit, not taxable income); (3) solvency assessment & forward cash flow; (4) franking account reconciliation; (5) signed minutes/resolution + appendices; (6) dividend statements issued; (7) payment evidence (bank statement or set-off documentation); (8) journal entries; (9) this completed checklist." },
  ];

  const s8 = [
    { id: "s8_setoff_right", text: "If applying dividend against a shareholder loan — confirm a legal right of set-off exists", sub: "A legal right of set-off can arise from: (a) an express contractual right in the loan agreement (BEST PRACTICE — include a set-off clause from inception of any shareholder or Div 7A loan); (b) equitable set-off (limited — requires amounts arising from the same or closely related transactions, which is difficult to establish between a dividend obligation and a loan); or (c) agreement by both parties documented at the time of the set-off. Without a valid right of set-off, the dividend is not legally 'paid' and the loan balance is not legally reduced.", warn: "The ATO requires evidence that the set-off was legally effective. If the loan agreement does not contain a set-off clause, consider having both parties execute a deed of set-off before the payment date." },
    { id: "s8_setoff_docs", text: "Document the set-off in the minutes and dividend statement", sub: "The directors' resolution should expressly state that the dividend will be applied in satisfaction of [amount] of the shareholder's loan account [identify the loan]. The dividend statement should note the set-off. Journal: DR Dividend Payable / CR Loan Receivable (not through the bank). Retain evidence of both parties' consent." },
    { id: "s8_setoff_partial", text: "If partial set-off — pay the cash balance and apply the remainder against the loan", sub: "A dividend can be part cash and part set-off. Document the split in the minutes and dividend statement. The franking debit arises on the payment date for the full dividend (cash + set-off portions)." },
    { id: "s8_div7a_myr", text: "Check: will the set-off amount satisfy the minimum yearly repayment (MYR)?", sub: "If applying the dividend against a Div 7A loan, determine whether the amount covers the MYR for the current year. The MYR is calculated per s109E based on loan term (7 or 25 years) and the ATO benchmark interest rate (published annually). If the dividend does not cover the full MYR, the shortfall must be paid in cash by the lodgement day of the private company's tax return.", ref: "s109E ITAA36", trap: "Failure to make the MYR by the company's lodgement day results in the shortfall being treated as a NEW deemed unfranked dividend under s109F — assessable to the borrower." },
    { id: "s8_borrow", text: "CAUTION: If borrowing funds to pay the dividend — interest is NOT deductible", sub: "Interest on borrowed funds used to pay a dividend is generally NOT deductible under s8-1 ITAA97. The deduction requires a nexus to producing assessable income or carrying on a business for that purpose. Paying a dividend is a distribution of profit — it does not produce assessable income for the company. The ATO has consistently maintained this position. Factor the non-deductible after-tax cost of interest into any cost-benefit analysis of the dividend payment.", ref: "s8-1 ITAA97", warn: "Do NOT assume interest on borrowings to fund dividends will be deductible. The nexus to income production fails. This can make the effective cost of the dividend significantly higher than anticipated." },
    { id: "s8_borrow_solv", text: "If borrowing to pay — reassess solvency including the new debt obligation", sub: "The solvency test must be applied AFTER the new borrowing is taken into account. The company must be able to service both the new loan and existing obligations. Consider: will operating cash flow cover the loan repayments? Is the loan term appropriate? Would a prudent director borrow to pay a dividend in these circumstances?" },
    { id: "s8_borrow_iva", text: "If borrowing to pay — consider Part IVA risk on the overall arrangement", sub: "Where a company borrows to pay a franked dividend, the ATO may examine whether the arrangement's dominant purpose was obtaining a tax benefit (e.g., shareholder receives franking credits while the company services the debt). Even where the interest is not deductible, the arrangement may attract scrutiny — particularly if the lender and shareholder are related parties or if the borrowing is secured by the shareholder's personal assets.", ref: "Part IVA ITAA36" },
    { id: "s8_deemed", text: "Check for existing deemed dividends under s109 that may complicate the position", sub: "Review whether any existing payments, loans or debt forgiveness may constitute deemed dividends under Div 7A (s109C–109T). Unpaid deemed dividends are unfranked and affect the shareholder's overall tax position. Ensure the company's Div 7A position is fully mapped before declaring a new dividend." },
  ];

  const s9 = [
    { id: "s9_deed", text: "Review the trust deed for the power to distribute AND to stream franked distributions", sub: "The deed must contain: (a) a general power to distribute income; AND (b) a specific power to stream different characters of income to different beneficiaries. A general 'income' distribution power may not support streaming of franking credits. Check for amendments and restrictions on distributions to corporate beneficiaries.", warn: "Without a streaming power, all beneficiaries receive a proportionate share of franking credits — they cannot be directed to a specific beneficiary." },
    { id: "s9_specific", text: "Ensure the beneficiary is made 'specifically entitled' to the franked distribution", sub: "Under s207-35, the beneficiary must: (1) be entitled to a share of trust income; (2) be made specifically entitled by trustee resolution; (3) receive the distribution with its character as a franked distribution maintained. The amount must be referable to the actual franked distribution received by the trust.", ref: "s207-35 ITAA97" },
    { id: "s9_timing", text: "CRITICAL: Trustee resolution must be made ON OR BEFORE 30 JUNE", sub: "The ATO strictly enforces s207-35(4)(a). No extensions, no concessions, no late elections. The resolution must be genuine and executed by 30 June — not a pro-forma document created after the fact. Evidence of the resolution's timing (email trails, witnessed signatures, dated document metadata) should be maintained.", ref: "s207-35(4) ITAA97", trap: "If the resolution is not executed by 30 June, franking credits cannot be streamed. They will be allocated proportionately to all income beneficiaries. This cannot be corrected retrospectively." },
    { id: "s9_content", text: "Resolution must identify the source, amount, and specific beneficiary", sub: "Best practice: reference the specific dividend (company name, dividend date, amount received by trust, franking credit attached, franking percentage) and allocate to the named beneficiary in dollar amounts, not just percentages. Include the beneficiary's share of both the cash dividend and the franking credit." },
    { id: "s9_new_co_trap", text: "ATO TRAP: Newly incorporated companies created to receive trust distributions", sub: "The ATO specifically targets arrangements where a new company is incorporated shortly before 30 June and made presently entitled to trust income. ATO concerns include: (a) s100A reimbursement agreements — if the company does not genuinely receive or control the distribution, and the economic benefit flows to another person (the trust controller or other family members), the arrangement may be a 'reimbursement agreement' and the trustee assessed at the top marginal rate; (b) Part IVA — if the dominant purpose of incorporating the company was to obtain a tax benefit (warehousing income at 25% instead of the individual's marginal rate); (c) the company has no genuine commercial substance — no business, no employees, no assets, no activity other than being a receptacle for trust distributions. The ATO's guidance in TR 2022/4 (s100A ruling) and PCG 2022/2 (practical compliance) makes clear these arrangements are high-risk.", ref: "s100A ITAA36, TR 2022/4, PCG 2022/2", trap: "A newly incorporated company with no commercial substance, incorporated near year-end solely to receive a trust distribution, is the paradigm case for s100A and Part IVA challenge. The ATO has publicly stated it will allocate compliance resources to these arrangements." },
    { id: "s9_s100a", text: "Assess s100A reimbursement agreement risk for ALL trust distributions", sub: "Section 100A applies where: (a) a beneficiary is presently entitled to trust income; (b) the entitlement arose out of a 'reimbursement agreement'; and (c) an 'eligible person' benefits under the agreement. If s100A applies, the trustee is assessed at the top marginal rate. The 'ordinary family or commercial dealing' exception is interpreted narrowly by the ATO (TR 2022/4). PCG 2022/2 provides a traffic-light risk assessment framework: green (low risk), amber (medium), red (high). Review your arrangement against these categories.", ref: "s100A ITAA36, TR 2022/4, PCG 2022/2" },
    { id: "s9_upe", text: "If corporate beneficiary — assess Division 7A implications for UPE", sub: "Where a trust makes a company presently entitled and the entitlement remains unpaid, the UPE may be treated as a loan under Div 7A. Per PS LA 2010/4 (updated by PCG 2022/1): the UPE must be actually paid, placed on a complying Div 7A loan, or treated as a deemed dividend by the company's lodgement day.", ref: "Div 7A, PCG 2022/1", trap: "A UPE to a corporate beneficiary not properly managed by the company's lodgement day results in a deemed unfranked dividend. This is one of the most commonly missed issues in Australian tax practice." },
    { id: "s9_anti_avoid", text: "Review Subdiv 207-F and Part IVA for trust distribution of franking credits", sub: "Subdiv 207-F denies franking credits in certain trust scenarios. Key risk areas: distributions to beneficiaries with offsetting losses (to 'absorb' credits), distributions to low-income beneficiaries, and distributions to entities that on-distribute or do not genuinely bear the economic risk.", ref: "Subdiv 207-F, Part IVA ITAA97" },
    { id: "s9_stmt", text: "Prepare the trust's annual tax distribution statement for each beneficiary", sub: "Show: trust name, TFN, beneficiary name, TFN, share of net income, share of franked distributions, share of franking credits, and other character amounts. Cross-check against company dividend statements received by the trust." },
  ];

  const s10 = [
    { id: "s10_45", text: "Confirm the shareholder satisfies the 45-day holding period rule (90 days for preference shares)", sub: "The shareholder must have held the shares 'at risk' for at least 45 continuous days (90 for preference shares) during the qualification period. The qualification period runs from the day after acquisition to the 45th day after the shares go ex-dividend. The day of acquisition and day of disposal are both excluded from the count.", ref: "Subdiv 207-E ITAA97" },
    { id: "s10_at_risk", text: "Confirm shares were held 'at risk' — economic exposure was not materially diminished", sub: "Shares are NOT 'at risk' on any day where the holder (or associate) has diminished more than 70% of the risks of loss or opportunities for gain. This includes: put options over the shares, short selling the same or substantially similar shares, futures contracts, swap arrangements, contracts for difference, securities lending arrangements, or any financial arrangement hedging economic exposure. Each day in the qualification period is tested independently.", ref: "s207-150 ITAA97", warn: "The 70% threshold is strict. If shares worth $100,000 are hedged with a put protecting $75,000 of downside, the shares are NOT at risk (75% > 70%). Even partial hedging can breach the threshold." },
    { id: "s10_delta", text: "Consider delta hedging and synthetic position risks", sub: "The 'at risk' test captures not just direct hedging but also synthetic positions that achieve the same economic effect. A combination of financial instruments that together reduce risk by more than 70% will fail the test, even if no single instrument individually reaches the threshold. The ATO applies a substance-over-form approach.", ref: "s207-150 ITAA97" },
    { id: "s10_small", text: "Small shareholder exemption: total franking credits ≤ $5,000 in the year", sub: "Individual shareholders whose total franking credits from ALL sources in the income year do not exceed $5,000 are exempt from the holding period rule. This exemption does NOT apply to: shares acquired under dividend stripping arrangements, or non-individual shareholders (companies, trusts, super funds).", ref: "s207-145(1)(b) ITAA97" },
    { id: "s10_related", text: "Confirm no 'related payment' exists that would negate the dividend benefit", sub: "If the shareholder must make a related payment in respect of the dividend (e.g., under a securities lending arrangement compensating the lender for dividends), the franking credit benefit is denied. A related payment is any payment passing on the economic benefit of the dividend to another party.", ref: "s207-145(1)(c) ITAA97" },
    { id: "s10_wash", text: "Check for 'wash sale' or 'cum/ex-dividend' trading arrangements", sub: "The ATO targets arrangements where shares are acquired shortly before ex-dividend date (to capture the franking credit) and sold shortly after. Even if the 45-day rule is technically satisfied, Part IVA may apply. Taxpayer Alert TA 2015/1 addresses 'dividend washing' — acquiring replacement shares to capture a second franking credit.", ref: "TA 2015/1, Part IVA" },
    { id: "s10_nonres", text: "If non-resident shareholder — apply correct withholding treatment", sub: "Unfranked dividends to non-residents: withholding at 30% (or reduced DTA rate, typically 15%). Franked dividends: exempt from withholding to the extent franked. Non-residents cannot claim refundable franking credit offsets — the credit only offsets tax on Australian-source income.", ref: "Div 11A ITAA36, s207-110 ITAA97" },
  ];

  const s11 = [
    { id: "s11_iva", text: "Consider Part IVA application to the overall dividend arrangement", sub: "Part IVA applies where: (a) a 'scheme' exists; (b) a 'tax benefit' is obtained; and (c) the dominant purpose test in s177D is met (considering all eight matters). A straightforward dividend from trading profits to long-standing shareholders is low risk. Risk increases with: share class manipulation, interposed entities, related-party transactions, artificial arrangements, or transactions lacking commercial substance.", ref: "Part IVA, s177D ITAA36" },
    { id: "s11_strip", text: "Assess dividend stripping risk", sub: "Dividend stripping involves extracting profits in a tax-advantaged way, often with a change of ownership or value shift. Also consider s45B (capital benefits) and s45C (income-to-capital conversion).", ref: "s177E, s45B, s45C ITAA36" },
    { id: "s11_207f", text: "Review Subdiv 207-F imputation integrity rules", sub: "Deny franking benefits where: distributions to entities who cannot effectively utilise them (tax-exempt bodies, non-residents above the cap), or arrangements manipulating the imputation system. Particular risk with discretionary trust distributions to beneficiaries with offsetting losses.", ref: "Subdiv 207-F ITAA97" },
    { id: "s11_excess", text: "Check for excess franking above the benchmark", sub: "Excess franking above the benchmark percentage for the class: the excess credit is denied to the shareholder, and the company may be liable to over-franking tax.", ref: "s203-50 ITAA97" },
    { id: "s11_circular", text: "Watch for circular flow arrangements", sub: "Company pays dividend → shareholder lends/returns funds to company → no cash actually leaves. While a genuine Div 7A loan set-off is legitimate (Section 8), circular arrangements designed to 'refresh' franking credits or create artificial tax benefits are high-risk for Part IVA. The ATO looks at the net economic position of all parties.", ref: "Part IVA ITAA36" },
  ];

  const s12 = [
    { id: "s12_interim", text: "Interim vs final dividend — know the implications", sub: "Interim: declared during the year before final accounts. Profits test must still be satisfied — requires current management accounts. Directors bear more risk as the year-end position is unknown. Final: declared after year-end accounts, providing greater certainty. Either type establishes a debt from the company to the shareholder once declared." },
    { id: "s12_inspecie", text: "In-specie (non-cash) dividend — market value and CGT consequences", sub: "In-specie dividend = market value of the asset. CGT event A1 occurs for the company. Consider: company-level CGT, stamp duty, GST (if taxable supply), and the shareholder's cost base (= market value at transfer date).", ref: "s104-5 ITAA97, s109C ITAA36" },
    { id: "s12_div7a_strategy", text: "Model: dividend set-off against Div 7A loan vs continuing MYR cash payments", sub: "Compare after-tax cost: (a) franked dividend applied via set-off (shareholder gets franking credit offset, Div 7A balance reduces); (b) cash MYR repayments (no tax benefit to shareholder, but company retains more cash). Key variables: shareholder's marginal rate, franking balance, Div 7A benchmark interest rate, loan term remaining." },
    { id: "s12_access", text: "Dividend access shares — review TA 2014/1 exposure", sub: "TA 2014/1 targets share class structures used to direct franking credits to low-rate recipients. Ensure genuine commercial rationale exists. Consider obtaining a private ruling if the arrangement is material.", ref: "TA 2014/1" },
    { id: "s12_demerger", text: "Demerger dividend — Div 125 special rules", sub: "Demerger dividends: no franking credit, shareholder may elect CGT rollover, dividend not assessable if the demerger qualifies. Specialist advice required.", ref: "Div 125 ITAA97" },
    { id: "s12_capital", text: "Distinguish dividend from return of capital", sub: "A return of capital is NOT a dividend, carries no franking credits, and reduces the shareholder's cost base (may trigger CGT if it exceeds cost base). Correct characterisation is essential — the company must have accounting profits (s254T) to pay a dividend.", ref: "s159GZZZP ITAA36" },
    { id: "s12_s47", text: "Winding up — s47 deemed dividend provisions", sub: "Distributions during winding up may be deemed dividends to the extent of accumulated profits (s47 ITAA36). The excess (capital) is not a dividend but may have CGT consequences. Apportionment required.", ref: "s47 ITAA36" },
    { id: "s12_div293", text: "Super fund shareholder — check Div 293 interaction", sub: "If the shareholder is a super fund, the franking credit forms part of fund income. For members with income above $250,000, Division 293 tax may apply. Consider the member's total super tax position.", ref: "Div 293 ITAA97" },
  ];

  const allIds = [...s1,...s3,...s5,...s6,...s7,...s8,...s9,...s10,...s11,...s12].map(i => i.id);
  const total = allIds.length;
  const done = allIds.filter(id => c[id]).length;
  const overall = Math.round((done / total) * 100);
  const sp = (items) => Math.round((items.filter(i => c[i.id]).length / items.length) * 100);

  const renderItems = (items) => items.map(item => <CheckItem key={item.id} checked={chk(item.id)} onChange={() => tog(item.id)} sub={item.sub} warn={item.warn} trap={item.trap} legislativeRef={item.ref}>{item.text}</CheckItem>);

  return (
    <div style={{ fontFamily: "'Source Sans 3', 'Source Sans Pro', -apple-system, sans-serif", background: BG, minHeight: "100vh", color: "#1a1a1a" }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`@media print { button, .no-print { display: none !important; } }`}</style>

      <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`, padding: "28px 24px 22px", color: "white" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.7 }}>BAKR Practice Tools</span>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0", letterSpacing: -0.3 }}>Dividend Declaration Compliance Toolkit</h1>
          <p style={{ fontSize: 14, opacity: 0.8, margin: "6px 0 0", lineHeight: 1.5, maxWidth: 680 }}>Comprehensive workflow for Australian company dividend declarations — Corporations Act 2001, ITAA 1936/1997, TAA 1953 & ATO compliance</p>
          <div style={{ display: "flex", gap: 16, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, maxWidth: 300, height: 8, background: "rgba(255,255,255,0.2)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${overall}%`, height: "100%", background: overall === 100 ? "#34D399" : "white", borderRadius: 4, transition: "width 0.4s" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{done}/{total} items ({overall}%)</span>
            <div className="no-print" style={{ display: "flex", gap: 8 }}>
              <button onClick={expandAll} style={{ padding: "4px 12px", fontSize: 12, background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 4, cursor: "pointer" }}>Expand All</button>
              <button onClick={collapseAll} style={{ padding: "4px 12px", fontSize: 12, background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 4, cursor: "pointer" }}>Collapse All</button>
              <button onClick={() => window.print()} style={{ padding: "4px 12px", fontSize: 12, background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 4, cursor: "pointer" }}>🖨 Print</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px 16px 60px" }}>
        <Callout type="law" title="Legislative Framework & Sources">
          Corporations Act 2001 (Cth) · ITAA 1936 · ITAA 1997 · TAA 1953. ATO guidance: TR 2022/4 (s100A), PCG 2022/1 (Div 7A UPEs), PCG 2022/2 (s100A compliance), PS LA 2010/4 (Div 7A UPEs). ATO Taxpayer Alerts: TA 2014/1 (dividend access shares), TA 2015/1 (dividend washing). This is a practice aid — it does not constitute legal, financial, or tax advice.
        </Callout>

        {/* S1 */}
        <Section number={1} title="Pre-Declaration Checks" expanded={expanded[1]} onToggle={() => toggle(1)} progress={sp(s1)}>
          <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: "0 0 12px" }}>Before declaring any dividend, directors must satisfy themselves the company can legally pay. These checks address Corporations Act requirements and practical commercial considerations.</p>
          {renderItems(s1)}
        </Section>

        {/* S2: Affordability */}
        <Section number={2} title="Profits Test & Affordability Calculator" expanded={expanded[2]} onToggle={() => toggle(2)}
          badge={aff.proposedDiv ? { status: profitsTestPass && netAssetsTestPass && isCashSolvent ? "pass" : "fail", label: profitsTestPass && netAssetsTestPass && isCashSolvent ? "PASS" : "REVIEW" } : undefined}>
          <Callout type="info" title="s254T Profits Test — Accounting Profits, NOT Taxable Income">
            'Profits' under s254T are determined per Australian Accounting Standards (AASB), not taxable income. A company may have taxable income but negative retained earnings (failing the test), or positive retained earnings but a tax loss. The test examines the balance sheet position. Additionally: assets must exceed liabilities by the dividend amount; the dividend must be fair and reasonable to all shareholders; and it must not materially prejudice creditors.
          </Callout>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
            <div>
              <SubHead>Balance Sheet / Profits Test</SubHead>
              <InputRow label="Total Assets (per accounts)" value={aff.totalAssets} onChange={(v) => setAff(p => ({ ...p, totalAssets: v }))} hint="Latest management accounts or audited balance sheet" />
              <InputRow label="Total Liabilities (per accounts)" value={aff.totalLiabilities} onChange={(v) => setAff(p => ({ ...p, totalLiabilities: v }))} />
              <InputRow label="Retained Earnings (per accounts)" value={aff.retainedEarnings} onChange={(v) => setAff(p => ({ ...p, retainedEarnings: v }))} hint="Accumulated accounting profits — the key profits test figure" />
              <InputRow label="Proposed Total Dividend" value={aff.proposedDiv} onChange={(v) => setAff(p => ({ ...p, proposedDiv: v }))} hint="Total across all classes and shareholders" />
            </div>
            <div>
              <SubHead>Solvency / Cash Flow Assessment</SubHead>
              <InputRow label="Cash at Bank" value={aff.cashAtBank} onChange={(v) => setAff(p => ({ ...p, cashAtBank: v }))} />
              <InputRow label="Trade Debtors (collectible 90 days)" value={aff.debtorsCurrent} onChange={(v) => setAff(p => ({ ...p, debtorsCurrent: v }))} />
              <InputRow label="Trade Creditors (due 90 days)" value={aff.creditorsCurrent} onChange={(v) => setAff(p => ({ ...p, creditorsCurrent: v }))} />
              <InputRow label="BAS/IAS Due (next 90 days)" value={aff.basDue} onChange={(v) => setAff(p => ({ ...p, basDue: v }))} />
              <InputRow label="Super Guarantee Due" value={aff.superDue} onChange={(v) => setAff(p => ({ ...p, superDue: v }))} />
              <InputRow label="Loan Repayments (next 90 days)" value={aff.loanRepay} onChange={(v) => setAff(p => ({ ...p, loanRepay: v }))} />
              <InputRow label="Other Committed Expenditure" value={aff.otherCommitments} onChange={(v) => setAff(p => ({ ...p, otherCommitments: v }))} hint="Rent, wages, insurance, capex" />
            </div>
          </div>
          {aff.proposedDiv && (<>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              <ResultBox label="Net Assets" value={fmt(netAssets)} status={netAssetsTestPass ? "pass" : "fail"} />
              <ResultBox label="Retained Earnings" value={fmt(profitsAvailable)} status={profitsTestPass ? "pass" : "fail"} />
              <ResultBox label="Net Assets After Div" value={fmt(netAssets - aN("proposedDiv"))} status={netAssetsTestPass ? "pass" : "fail"} />
              <ResultBox label="Cash After Div" value={fmt(cashAfterDiv)} status={isCashSolvent ? "pass" : cashAfterDiv > -5000 ? "warn" : "fail"} />
            </div>
            {!profitsTestPass && <Callout type="danger" title="Profits Test: FAILED">Proposed dividend ({fmt(aN("proposedDiv"))}) exceeds retained earnings ({fmt(profitsAvailable)}). Cannot legally pay. Maximum: {fmt(Math.max(0, profitsAvailable))}.</Callout>}
            {profitsTestPass && !netAssetsTestPass && <Callout type="danger" title="Net Assets Test: FAILED">Net assets ({fmt(netAssets)}) insufficient to cover the dividend.</Callout>}
            {profitsTestPass && netAssetsTestPass && !isCashSolvent && <Callout type="warning" title="Solvency Risk">Profits test satisfied but projected cash is negative ({fmt(cashAfterDiv)}). Defer payment date or reduce amount.</Callout>}
          </>)}
        </Section>

        {/* S3 */}
        <Section number={3} title="Share Classes, Entitlements & Dividend Access" expanded={expanded[3]} onToggle={() => toggle(3)} progress={sp(s3)}>
          <Callout type="warning" title="ATO Scrutiny — TA 2014/1">The ATO actively scrutinises multiple share class arrangements used to direct dividends and franking credits to preferred recipients. Ensure genuine commercial substance exists.</Callout>
          {renderItems(s3)}
        </Section>

        {/* S4: Franking Calc */}
        <Section number={4} title="Franking: Rate, Amount & Strategic Choices" expanded={expanded[4]} onToggle={() => toggle(4)}
          badge={frank.dividendAmount ? { status: "info", label: `${fPct.toFixed(0)}% FRANKED` } : undefined}>
          <Callout type="info" title="Choosing Franked, Unfranked, or Partially Franked">
            A company can frank at any rate from 0% to the maximum. However, the benchmark rule constrains choice: the first frankable distribution in the franking period sets the benchmark for that class. All subsequent distributions to the same class must match. Strategic implications: (a) a smaller fully franked dividend may be preferable to a larger partially franked one; (b) paying unfranked first sets the benchmark at 0% for the class — you cannot frank later; (c) different share classes have separate benchmarks, allowing flexibility.
          </Callout>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
            <div>
              <SubHead>Base Rate Entity Test</SubHead>
              <InputRow label="Aggregated Turnover" value={frank.aggregatedTurnover} onChange={(v) => setFrank(p => ({ ...p, aggregatedTurnover: v }))} hint="Company + connected/affiliated entities" />
              <InputRow label="Total Assessable Income" value={frank.baseTurnoverCurrent} onChange={(v) => setFrank(p => ({ ...p, baseTurnoverCurrent: v }))} />
              <InputRow label="Base Rate Entity Passive Income" value={frank.baseIncomePassive} onChange={(v) => setFrank(p => ({ ...p, baseIncomePassive: v }))} hint="Interest, dividends, rent, royalties, net CG, trust/partnership income" />
              {frank.aggregatedTurnover && <ResultBox label="Base Rate Entity" value={isBaseRate ? "YES — 25% rate" : "NO — 30% rate"} status={isBaseRate ? "info" : "warn"} />}
            </div>
            <div>
              <SubHead>Franking Calculation</SubHead>
              <InputRow label="Franking Account Balance" value={frank.frankingBalance} onChange={(v) => setFrank(p => ({ ...p, frankingBalance: v }))} hint="After all known credits/debits" />
              <InputRow label="Dividend Amount (cash)" value={frank.dividendAmount} onChange={(v) => setFrank(p => ({ ...p, dividendAmount: v }))} />
              <InputRow label="Override Tax Rate" value={frank.taxRate} onChange={(v) => setFrank(p => ({ ...p, taxRate: v }))} prefix="%" suffix="" hint={`Blank = auto ${isBaseRate ? "25" : "30"}%`} />
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Franking Strategy</label>
                {[{ v: "max", l: "Fully franked (to maximum)" }, { v: "nil", l: "Unfranked (0%)" }, { v: "custom", l: "Custom franking credit" }].map(o => (
                  <label key={o.v} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 13, cursor: "pointer" }}>
                    <input type="radio" name="fc" checked={frank.frankingChoice === o.v} onChange={() => setFrank(p => ({ ...p, frankingChoice: o.v }))} style={{ accentColor: NAVY }} />{o.l}
                  </label>
                ))}
                {frank.frankingChoice === "custom" && <InputRow label="Custom Franking Credit" value={frank.customCredit} onChange={(v) => setFrank(p => ({ ...p, customCredit: v }))} hint={`Max: ${fmt(Math.min(maxFC, maxBal))}`} />}
              </div>
            </div>
          </div>
          {frank.dividendAmount && (<>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              <ResultBox label="Tax Rate" value={pct(selRate)} status="info" />
              <ResultBox label="Max Franking Credit" value={fmt(maxFC)} status="info" />
              <ResultBox label="Chosen Franking Credit" value={fmt(chosenFC)} status={chosenFC >= maxFC ? "pass" : chosenFC > 0 ? "warn" : "neutral"} />
              <ResultBox label="Grossed-Up Dividend" value={fmt(grossedUp)} status="info" />
            </div>
            <Callout type="tip" title="Formula">Max FC = {fmt(fN("dividendAmount"))} × ({pct(selRate)} ÷ (1 − {pct(selRate)})) = {fmt(maxFC)}{frank.frankingChoice === "nil" ? ". Unfranked selected — benchmark set at 0% for this class." : chosenFC < maxFC && chosenFC > 0 ? `. Partially franked at ${fPct.toFixed(1)}% — this becomes the benchmark.` : ""}</Callout>
            {chosenFC > maxBal && maxBal >= 0 && <Callout type="danger" title="Insufficient Franking Balance">Chosen credit ({fmt(chosenFC)}) exceeds balance ({fmt(maxBal)}). Would create a franking deficit.</Callout>}
          </>)}
        </Section>

        {/* S5 */}
        <Section number={5} title="Franking Account Compliance" expanded={expanded[5]} onToggle={() => toggle(5)} progress={sp(s5)}>
          <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: "0 0 12px" }}>The franking account is a rolling memorandum balance tracking credits and debits. Accurate maintenance prevents FDT and ensures correct shareholder entitlements.</p>
          {renderItems(s5)}
        </Section>

        {/* S6 */}
        <Section number={6} title="Directors' Minutes, Resolutions & Dating Requirements" expanded={expanded[6]} onToggle={() => toggle(6)} progress={sp(s6)}>
          <Callout type="trap" title="Dating a Minute vs Fabricating a Minute">
            The resolution date is the date it is PASSED (meeting date, or last signature on a circular resolution) — not when the minute is typed. Recording a genuine meeting after it occurred is lawful record-keeping (s251A allows 1 month). Creating a minute for a meeting that never happened and dating it retrospectively is fabrication — a criminal offence under s1307 Corporations Act (imprisonment up to 1 year and/or fine). The test is simple: did the meeting or resolution process actually occur on the stated date?
          </Callout>
          {renderItems(s6)}
        </Section>

        {/* S7 */}
        <Section number={7} title="Dividend Statements, Reporting & Paperwork" expanded={expanded[7]} onToggle={() => toggle(7)} progress={sp(s7)}>
          {renderItems(s7)}
        </Section>

        {/* S8 */}
        <Section number={8} title="Dividend Payment, Set-Off Rights & Borrowing to Pay" expanded={expanded[8]} onToggle={() => toggle(8)} progress={sp(s8)}>
          <Callout type="trap" title="Two Critical Traps in This Section">
            <strong>1. Set-off without legal right:</strong> Applying a dividend against a loan without a valid right of set-off means the dividend is not legally 'paid' and the loan is not reduced. Always include a set-off clause in loan agreements from inception.<br /><br />
            <strong>2. Borrowing to pay:</strong> Interest on borrowed funds used to pay dividends is NOT deductible under s8-1 ITAA97. The nexus to income production fails — distributing profit is not producing income.
          </Callout>
          {renderItems(s8)}
        </Section>

        {/* S9 */}
        <Section number={9} title="Trust Distribution of Franked Dividends" expanded={expanded[9]} onToggle={() => toggle(9)} progress={sp(s9)}>
          <Callout type="danger" title="High-Risk Area — Multiple ATO Traps">
            Trust streaming of franked distributions is an ATO compliance priority. Key traps: (1) trustee resolution not executed by 30 June; (2) newly incorporated companies as beneficiaries (s100A / Part IVA); (3) UPEs to corporate beneficiaries not placed on Div 7A loan; (4) s100A reimbursement agreements where the economic benefit does not genuinely flow to the named beneficiary.
          </Callout>
          {renderItems(s9)}
          <div style={{ marginTop: 20, padding: 16, background: "#f8f9fa", borderRadius: 8, border: `1px solid ${BORDER}` }}>
            <SubHead>Trust Distribution Calculator</SubHead>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <InputRow label="Franked Dividend Received" value={trustCalc.divReceived} onChange={(v) => setTrustCalc(p => ({ ...p, divReceived: v }))} />
              <InputRow label="Franking Credits Attached" value={trustCalc.frankCredReceived} onChange={(v) => setTrustCalc(p => ({ ...p, frankCredReceived: v }))} />
              <InputRow label="Beneficiaries" value={trustCalc.beneficiaries} onChange={(v) => setTrustCalc(p => ({ ...p, beneficiaries: v }))} prefix="" hint="1 if streaming to single beneficiary" />
            </div>
            {trustCalc.divReceived && (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <ResultBox label="Grossed-Up Distribution" value={fmt(trustGU)} status="info" />
                <ResultBox label="Per Beneficiary (equal)" value={fmt(trustGU / benCt)} status="info" />
                <ResultBox label="FC per Beneficiary" value={fmt(tN("frankCredReceived") / benCt)} status="info" />
              </div>
            )}
          </div>
        </Section>

        {/* S10 */}
        <Section number={10} title="Holding Period Rule & Shares 'At Risk'" expanded={expanded[10]} onToggle={() => toggle(10)} progress={sp(s10)}>
          <Callout type="law" title="45-Day / 90-Day Rule (Subdiv 207-E)">
            To claim the franking credit offset, shares must be held 'at risk' for 45 continuous days (90 for preference shares) during the qualification period (day after acquisition to 45th day after ex-dividend). 'At risk' means the holder has not diminished more than 70% of risks/opportunities through hedging. Small shareholder exemption: total franking credits ≤$5,000 (individuals only).
          </Callout>
          {renderItems(s10)}
        </Section>

        {/* S11 */}
        <Section number={11} title="Anti-Avoidance & Integrity Rules" expanded={expanded[11]} onToggle={() => toggle(11)} progress={sp(s11)}>
          {renderItems(s11)}
        </Section>

        {/* S12 */}
        <Section number={12} title="Special Situations & Edge Cases" expanded={expanded[12]} onToggle={() => toggle(12)} progress={sp(s12)}>
          {renderItems(s12)}
        </Section>

        {/* S13: Timeline */}
        <Section number={13} title="Key Dates, Timeline & Document Sequence" expanded={expanded[13]} onToggle={() => toggle(13)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <SubHead>Date Entry</SubHead>
              <InputRow label="Financial Year End" value={timeline.fyEnd} onChange={(v) => setTimeline(p => ({ ...p, fyEnd: v }))} prefix="" type="date" />
              <InputRow label="Declaration / Resolution Date" value={timeline.declarationDate} onChange={(v) => setTimeline(p => ({ ...p, declarationDate: v }))} prefix="" type="date" hint="Date resolution is passed (meeting or last signature)" />
              <InputRow label="Record Date" value={timeline.recordDate} onChange={(v) => setTimeline(p => ({ ...p, recordDate: v }))} prefix="" type="date" hint="Date for shareholder entitlement" />
              <InputRow label="Payment Date" value={timeline.paymentDate} onChange={(v) => setTimeline(p => ({ ...p, paymentDate: v }))} prefix="" type="date" hint="Date paid — franking debit arises" />
              {timeline.declarationDate && timeline.paymentDate && new Date(timeline.paymentDate) < new Date(timeline.declarationDate) && <Callout type="danger" title="Date Error">Payment date cannot be before declaration date.</Callout>}
            </div>
            <div>
              <SubHead>Document Sequence</SubHead>
              <div style={{ fontSize: 13, lineHeight: 2, color: "#333" }}>
                {["Balance sheet / management accounts prepared","Forward cash flow projection prepared","Franking account reconciliation completed","Directors' meeting or circular resolution commenced","Profits test & solvency declaration signed","Resolution passed (= declaration date)","Minutes physically prepared (within 1 month — s251A)","Dividend statements issued to shareholders","Dividend paid — cash and/or set-off (= payment date)","Journal entries processed","Trustee streaming resolution (if applicable — BEFORE 30 June)","Work paper file assembled"].map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8 }}><span style={{ color: BLUE, fontWeight: 600, minWidth: 28, flexShrink: 0 }}>{i + 1}.</span>{s}</div>
                ))}
              </div>
              <Callout type="warning" title="Critical Deadlines">
                <strong>Trust streaming resolution:</strong> on or before 30 June — absolute<br />
                <strong>Minutes recorded:</strong> within 1 month of meeting (s251A)<br />
                <strong>Circular resolution effective:</strong> date of last director's signature<br />
                <strong>FAR (if required):</strong> company tax return due date<br />
                <strong>PAYG withholding report:</strong> 14 August<br />
                <strong>Div 7A MYR:</strong> company's lodgement day
              </Callout>
            </div>
          </div>
        </Section>

        {/* S14: Reference */}
        <Section number={14} title="Quick Reference — Rates, Formulas & Thresholds" expanded={expanded[14]} onToggle={() => toggle(14)}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: NAVY, color: "white" }}>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>Year</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Base Rate</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Full Rate</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Max FC/$ (Base)</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Max FC/$ (Full)</th>
              </tr></thead>
              <tbody>
                {[{ y: "2021–22 onward", b: "25.0%", f: "30.0%", cb: "$0.3333", cf: "$0.4286" },{ y: "2020–21", b: "26.0%", f: "30.0%", cb: "$0.3514", cf: "$0.4286" },{ y: "2018–20", b: "27.5%", f: "30.0%", cb: "$0.3793", cf: "$0.4286" }].map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f9f9f9", borderBottom: `1px solid ${BORDER}33` }}>
                    <td style={{ padding: "8px 12px", fontWeight: 500 }}>{r.y}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>{r.b}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>{r.f}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>{r.cb}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>{r.cf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SubHead>Key Formulas</SubHead>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, lineHeight: 2.2, background: "#f8f9fa", padding: 14, borderRadius: 6, border: `1px solid ${BORDER}` }}>
            <div>Max FC = Dividend × (Rate ÷ (1 − Rate))</div>
            <div>Grossed-Up = Cash Dividend + Franking Credit</div>
            <div>Franking % = (Actual FC ÷ Max FC) × 100</div>
            <div>Tax Offset = Franking Credit (refundable: individuals & complying super)</div>
            <div>Base Rate Entity = Agg T/O &lt; $50M AND ≤80% passive income</div>
            <div>Div 7A MYR = P × (r(1+r)^n) ÷ ((1+r)^n − 1)</div>
          </div>
          <SubHead>Key Thresholds</SubHead>
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            {[
              ["Small shareholder exemption:", "total FCs ≤ $5,000/year (individuals only)"],
              ["Base rate entity turnover:", "aggregated turnover < $50,000,000"],
              ["Base rate entity passive cap:", "≤ 80% of assessable income"],
              ["At risk threshold:", "> 70% diminishment = not at risk"],
              ["Benchmark tolerance:", "±5% (shares on issue changes only)"],
              ["Minutes deadline:", "within 1 month of meeting (s251A)"],
              ["Trust streaming resolution:", "on or before 30 June — no exceptions"],
              ["TFN withholding rate:", "top marginal + Medicare levy (47%)"],
              ["Non-resident WHT (unfranked):", "30% or DTA rate (typically 15%)"],
              ["s1307 penalty (false minutes):", "imprisonment up to 1 year and/or fine"],
            ].map(([k, v], i) => <div key={i}><strong>{k}</strong> {v}</div>)}
          </div>
        </Section>

        <div style={{ marginTop: 24, padding: "16px 0", borderTop: `1px solid ${BORDER}`, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#888", lineHeight: 1.7 }}>
            BAKR Dividend Declaration Compliance Toolkit — Practice Aid for Australian Chartered Accountants<br />
            Corporations Act 2001 · ITAA 1936 · ITAA 1997 · TAA 1953 · TR 2022/4 · PCG 2022/1 · PCG 2022/2 · PS LA 2010/4 · TA 2014/1 · TA 2015/1<br />
            This tool is a practice aid and does not constitute legal, financial or tax advice.
          </div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 8 }}>© {new Date().getFullYear()} Consultants for Accountants Pty Ltd · bakr.com.au</div>
        </div>
      </div>
    </div>
  );
}
