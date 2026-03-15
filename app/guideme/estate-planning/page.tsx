/* eslint-disable */
"use client";
// @ts-nocheck
import { useState, useMemo, useCallback, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// BAKR Estate Planning Quiz — Complete Page
// Deploy: app/guideme/estate-planning/page.tsx
// URL: bakr.com.au/guideme/estate-planning
// ═══════════════════════════════════════════════════════════════

const SCORING_URL = "https://us-central1-document-generator-system.cloudfunctions.net/scoreQuizResults";

// ─── PHASES ─────────────────────────────────────────────────
const PHASES = [
  { id: "about_you", name: "About You", icon: "👤", order: 1 },
  { id: "what_you_have", name: "What You Have", icon: "🏗️", order: 2 },
  { id: "your_situation", name: "Your Situation", icon: "📋", order: 3 },
  { id: "your_concerns", name: "What Matters Most", icon: "🎯", order: 4 },
  { id: "specific_areas", name: "Specific Areas", icon: "🔍", order: 5 },
];

// ─── QUESTIONS ──────────────────────────────────────────────
const QS = [
  {id:"Q01",v:"age",ph:"about_you",t:"s",si:null,q:"What is your age range?",h:"This helps us match advice to your life stage.",o:[
    {v:"under35",l:"Under 35",f:[]},{v:"35-49",l:"35 to 49",f:["is_working_age_professional"]},
    {v:"50-59",l:"50 to 59",f:["approaching_retirement_age","is_aged_over_50"]},
    {v:"60-69",l:"60 to 69",f:["approaching_retirement_age","aged_60_or_over","is_aged_60_or_over","has_met_condition_of_release","member_aged_over_60"]},
    {v:"70plus",l:"70 or over",f:["aged_60_or_over","is_aged_60_or_over","aged_67_to_74","has_met_condition_of_release","member_aged_over_60","aged_60_or_over_and_retired"]}
  ]},
  {id:"Q02",v:"state",ph:"about_you",t:"s",si:null,q:"Which state or territory do you live in?",h:"Estate planning laws vary by state.",o:[
    {v:"NSW",l:"New South Wales",f:["estate_assets_located_in_nsw"]},{v:"VIC",l:"Victoria",f:[]},{v:"QLD",l:"Queensland",f:[]},
    {v:"SA",l:"South Australia",f:[]},{v:"WA",l:"Western Australia",f:[]},{v:"TAS",l:"Tasmania",f:[]},
    {v:"NT",l:"Northern Territory",f:[]},{v:"ACT",l:"Australian Capital Territory",f:[]}
  ]},
  {id:"Q03",v:"relationshipStatus",ph:"about_you",t:"s",si:null,q:"What is your current relationship status?",h:null,o:[
    {v:"married",l:"Married",f:["has_spouse_or_partner","is_married_or_in_de_facto_relationship"]},
    {v:"defacto",l:"In a de facto relationship",f:["has_spouse_or_partner","in_de_facto_relationship","is_married_or_in_de_facto_relationship"]},
    {v:"separated",l:"Separated or going through divorce",f:["recently_divorced_or_separated","currently_going_through_or_anticipating_divorce_proceedings"]},
    {v:"divorced",l:"Divorced",f:["recently_divorced_or_separated"]},
    {v:"widowed",l:"Widowed",f:["is_beneficiary_of_deceased_estate","recently_inherited_assets_through_deceased_estate"]},
    {v:"single",l:"Single (never married)",f:[]}
  ]},
  {id:"Q04",v:"children",ph:"about_you",t:"s",si:null,q:"Do you have children or grandchildren?",h:null,o:[
    {v:"none",l:"No children or grandchildren",f:[]},
    {v:"adult_only",l:"Adult children only (all 18+)",f:["has_adult_children","has_adult_children_as_beneficiaries","has_adult_children_as_intended_beneficiaries","has_adult_children_who_are_financially_independent"]},
    {v:"minor_only",l:"Minor children only (some or all under 18)",f:["has_minor_children_or_grandchildren","has_minor_children_as_beneficiaries","has_minor_beneficiaries","has_minor_beneficiaries_under_18"]},
    {v:"both",l:"Both adult and minor children",f:["has_adult_children","has_adult_children_as_beneficiaries","has_minor_children_or_grandchildren","has_minor_children_as_beneficiaries","has_minor_beneficiaries"]},
    {v:"grandchildren",l:"No children, but have grandchildren or other dependants",f:["has_minor_children_or_grandchildren","has_grandchildren_to_provide_for"]}
  ]},
  {id:"Q05",v:"familyComplexity",ph:"about_you",t:"s",si:"children != 'none'",q:"How would you describe your family structure?",h:"This significantly affects how estate plans should be designed.",o:[
    {v:"simple",l:"All children from current relationship",f:[]},
    {v:"blended",l:"Blended family — children from different relationships",f:["has_blended_family_structure","has_blended_family","has_blended_family_situation","has_blended_family_or_children_from_multiple_relationships","has_children_from_prior_relationship","is_in_blended_family_or_second_marriage"]},
    {v:"special_needs",l:"A child or dependant has a disability or special needs",f:["has_beneficiary_with_disability","childrenVulnerable_yes"]},
    {v:"vulnerable",l:"A child has addiction, debt, or financial management concerns",f:["childrenVulnerable_yes","beneficiary_has_existing_debt_problems","one_or_more_beneficiaries_have_creditor_or_bankruptcy_exposure"]},
    {v:"estranged",l:"There are estranged family members or potential disputes",f:["concerned_about_family_provision_claims","is_concerned_about_family_provision_claim_risk_if_shares_are_unequal"]}
  ]},
  {id:"Q06",v:"estateValue",ph:"about_you",t:"s",si:null,q:"What is the approximate total value of all your assets?",h:"Include home, super, investments, business — everything across all structures. A rough estimate is fine.",o:[
    {v:"under500k",l:"Under $500,000",f:[]},
    {v:"500k_1m",l:"$500,000 to $1 million",f:["estate_value_exceeds_500000","has_substantial_estate_assets"]},
    {v:"1m_2m",l:"$1 million to $2 million",f:["estate_value_exceeds_500000","has_substantial_estate_assets","has_substantial_accumulated_wealth"]},
    {v:"2m_5m",l:"$2 million to $5 million",f:["estate_value_exceeds_2_million","estate_value_exceeds_500000","has_substantial_estate_assets","has_substantial_accumulated_wealth"]},
    {v:"5m_10m",l:"$5 million to $10 million",f:["estate_value_exceeds_2_million","estate_value_exceeds_500000","has_substantial_estate_assets","has_substantial_accumulated_wealth","planning_intergenerational_wealth_transfer"]},
    {v:"over10m",l:"Over $10 million",f:["estate_value_exceeds_2_million","estate_value_exceeds_500000","has_substantial_estate_assets","has_substantial_accumulated_wealth","planning_intergenerational_wealth_transfer"]}
  ]},
  {id:"Q07",v:"homeOwnership",ph:"what_you_have",t:"s",si:null,q:"Do you own your home?",h:null,o:[
    {v:"own_outright",l:"Yes — own outright (no mortgage)",f:["owns_principal_residence","owns_real_property"]},
    {v:"own_mortgage",l:"Yes — with a mortgage",f:["owns_principal_residence","owns_real_property","has_mortgage_on_principal_residence"]},
    {v:"no",l:"No — renting or living with family",f:["does_not_currently_own_other_property"]},
    {v:"jointly",l:"Yes — jointly owned with someone other than spouse",f:["owns_principal_residence","owns_real_property","jointly_owned_property"]}
  ]},
  {id:"Q08",v:"investmentProperty",ph:"what_you_have",t:"s",si:null,q:"Do you own any investment properties?",h:"Include properties held in your name, through a trust, company, or SMSF.",o:[
    {v:"none",l:"No investment properties",f:[]},
    {v:"personal",l:"Yes — held in my personal name",f:["owns_investment_properties","holds_investment_properties","has_investment_properties_in_personal_name","estate_includes_income_producing_assets"]},
    {v:"trust",l:"Yes — held in a trust or company",f:["owns_investment_properties","holds_investment_properties","estate_includes_income_producing_assets"]},
    {v:"smsf",l:"Yes — held in my SMSF",f:["owns_investment_properties","estate_includes_income_producing_assets"]},
    {v:"multiple",l:"Yes — across multiple structures",f:["owns_investment_properties","holds_investment_properties","has_investment_properties_in_personal_name","estate_includes_income_producing_assets","has_assets_in_multiple_structures"]},
    {v:"inherited",l:"I recently inherited a property and haven't decided what to do",f:["has_inherited_residential_property","inherited_property_from_deceased_estate","recently_inherited_assets_through_deceased_estate","needs_valuation_at_date_of_death","considering_selling_inherited_property"]}
  ]},
  {id:"Q09",v:"superType",ph:"what_you_have",t:"s",si:null,q:"What type of superannuation fund do you have?",h:null,o:[
    {v:"industry",l:"Industry or retail fund (e.g., AustralianSuper, REST, MLC)",f:["has_superannuation_balance"]},
    {v:"smsf",l:"Self-managed super fund (SMSF)",f:["has_smsf","has_superannuation_balance","is_smsf_trustee_or_member","has_self_managed_superannuation_fund"]},
    {v:"multiple",l:"Multiple funds (haven't consolidated)",f:["has_superannuation_balance"]},
    {v:"none",l:"No superannuation",f:[]},
    {v:"unsure",l:"Not sure",f:["has_superannuation_balance"]}
  ]},
  {id:"Q10",v:"superBalance",ph:"what_you_have",t:"s",si:"superType != 'none'",q:"What is your approximate superannuation balance?",h:"Include all funds if you have multiple.",o:[
    {v:"under200k",l:"Under $200,000",f:[]},{v:"200k_500k",l:"$200,000 to $500,000",f:[]},
    {v:"500k_1m",l:"$500,000 to $1 million",f:["has_significant_superannuation_balance"]},
    {v:"1m_1.9m",l:"$1 million to $1.9 million",f:["has_significant_superannuation_balance","estate_includes_superannuation_death_benefits"]},
    {v:"over1.9m",l:"Over $1.9 million (above transfer balance cap)",f:["has_significant_superannuation_balance","estate_includes_superannuation_death_benefits","approaching_or_exceeds_transfer_balance_cap"]},
    {v:"unsure",l:"Not sure of the amount",f:[]}
  ]},
  {id:"Q11",v:"bdbn",ph:"what_you_have",t:"s",si:"superType != 'none'",q:"Do you have a binding death benefit nomination for your super?",h:"A BDBN tells your super fund exactly who receives your super when you die. Without one, the trustee decides.",o:[
    {v:"yes_current",l:"Yes — current and up to date",f:["has_binding_death_benefit_nomination"]},
    {v:"lapsed",l:"I had one but it may have lapsed",f:["has_binding_death_benefit_nomination"]},
    {v:"no",l:"No binding nomination in place",f:["no_current_death_benefit_nomination"]},
    {v:"nonbinding",l:"I have a non-binding (preferred) nomination only",f:[]},
    {v:"unsure",l:"I don't know what this is",f:[]}
  ]},
  {id:"Q12",v:"smsfDetails",ph:"what_you_have",t:"m",si:"superType == 'smsf'",q:"Which of the following apply to your SMSF?",h:"Select all that apply.",o:[
    {v:"sole_member",l:"I am the sole member",f:["is_sole_member_of_smsf"]},
    {v:"corporate_trustee",l:"Has a corporate trustee",f:["smsf_has_corporate_trustee"]},
    {v:"individual_trustees",l:"Has individual trustees (not a company)",f:["smsf_has_individual_trustees"]},
    {v:"pension_phase",l:"I am receiving a pension from the SMSF",f:["has_superannuation_in_pension_phase","is_in_pension_phase"]},
    {v:"property_held",l:"The SMSF holds real property",f:["smsf_holds_real_property"]},
    {v:"lrba",l:"The SMSF has a limited recourse borrowing arrangement",f:["smsf_has_limited_recourse_borrowing_arrangement"]}
  ]},
  {id:"Q13",v:"familyTrust",ph:"what_you_have",t:"s",si:"estateValue != 'under500k'",q:"Do you have a family or discretionary trust?",h:null,o:[
    {v:"none",l:"No trust",f:[]},
    {v:"appointor",l:"Yes — I am the appointor",f:["has_existing_discretionary_family_trust","is_appointor_of_discretionary_trust","is_trustee_or_appointor_of_discretionary_family_trust","holds_appointor_role_in_family_trust"]},
    {v:"trustee",l:"Yes — I am a trustee but not appointor",f:["has_existing_discretionary_family_trust"]},
    {v:"beneficiary_only",l:"Yes — I am a beneficiary only",f:["has_existing_discretionary_family_trust"]},
    {v:"multiple",l:"Yes — multiple trusts",f:["has_existing_discretionary_family_trust","is_appointor_of_discretionary_trust","has_assets_in_multiple_structures"]},
    {v:"unsure",l:"Not sure",f:[]}
  ]},
  {id:"Q14",v:"trustSuccession",ph:"what_you_have",t:"s",si:"familyTrust != 'none' && familyTrust != 'unsure'",q:"Has the succession of the trust appointor role been formally planned?",h:"The appointor controls the trust. If they die without a succession plan, control of the trust can be lost.",o:[
    {v:"planned",l:"Yes — appointor succession is documented",f:[]},
    {v:"not_planned",l:"No — nothing is documented",f:["trust_deed_lacks_appointor_succession_provisions","no_formal_succession_plan_in_place"]},
    {v:"unsure",l:"I'm not sure what this means",f:["trust_deed_lacks_appointor_succession_provisions"]},
    {v:"deed_old",l:"The trust deed is very old and may not cover this",f:["trust_deed_lacks_appointor_succession_provisions"]}
  ]},
  {id:"Q15",v:"privateCompany",ph:"what_you_have",t:"s",si:"estateValue != 'under500k'",q:"Are you a director or shareholder of a private company?",h:"Include any Pty Ltd company you own, including corporate trustees.",o:[
    {v:"none",l:"No",f:[]},
    {v:"sole",l:"Yes — I am the sole director and shareholder",f:["is_sole_director_of_proprietary_company","is_sole_shareholder_of_proprietary_company","is_director_or_shareholder_of_private_company","is_company_director"]},
    {v:"multiple_directors",l:"Yes — with other directors or shareholders",f:["is_director_or_shareholder_of_private_company","is_company_director"]},
    {v:"trustee_company",l:"Yes — it's the trustee of my family trust or SMSF",f:["is_director_or_shareholder_of_private_company","smsf_has_corporate_trustee"]}
  ]},
  {id:"Q16",v:"companyLoans",ph:"what_you_have",t:"s",si:"privateCompany != 'none'",q:"Does the company have any loans to or from directors or shareholders?",h:"Division 7A loans from your company create significant estate planning complications.",o:[
    {v:"yes",l:"Yes — there are outstanding loans",f:["has_related_party_loans_through_private_company","holds_unpaid_present_entitlements_or_division_7a_loan_accounts","has_existing_division_7a_loan"]},
    {v:"no",l:"No loans",f:[]},{v:"unsure",l:"Not sure",f:[]}
  ]},
  {id:"Q17",v:"sharePortfolio",ph:"what_you_have",t:"s",si:"estateValue != 'under500k'",q:"Do you hold a share or investment portfolio outside of super?",h:null,o:[
    {v:"none",l:"No",f:[]},
    {v:"yes",l:"Yes — listed shares or managed funds",f:["owns_share_portfolio","has_share_portfolio","estate_includes_shares_or_listed_investments"]},
    {v:"unlisted",l:"Yes — including unlisted or private company shares",f:["owns_share_portfolio","has_share_portfolio","estate_includes_shares_or_listed_investments","has_shares_with_undocumented_cost_base"]}
  ]},
  {id:"Q18",v:"business",ph:"what_you_have",t:"s",si:null,q:"Do you own or operate a business?",h:"Include any business you're actively involved in, regardless of structure.",o:[
    {v:"no",l:"No",f:[]},
    {v:"sole_trader",l:"Yes — as a sole trader",f:["owns_business_requiring_succession_planning","is_sole_trader_or_owner_operator","business_continuity_dependent_on_single_individual"]},
    {v:"company",l:"Yes — through a company",f:["owns_business_requiring_succession_planning","operates_business_through_company_structure"]},
    {v:"trust",l:"Yes — through a trust",f:["owns_business_requiring_succession_planning","operates_business_through_discretionary_trust"]},
    {v:"partnership",l:"Yes — in a partnership",f:["owns_business_requiring_succession_planning"]},
    {v:"spouse",l:"No — but my spouse or partner does",f:[]}
  ]},
  {id:"Q19",v:"businessSuccession",ph:"what_you_have",t:"s",si:"business != 'no' && business != 'spouse'",q:"Do you have a business succession plan?",h:"A plan for what happens to the business if you die, become incapacitated, or want to retire.",o:[
    {v:"documented",l:"Yes — formally documented",f:["has_buy_sell_agreement_or_business_succession_arrangement"]},
    {v:"informal",l:"Informal understanding only — nothing in writing",f:["has_no_formal_succession_plan","no_formal_succession_plan_in_place"]},
    {v:"none",l:"No plan at all",f:["has_no_formal_succession_plan","has_no_business_continuity_or_succession_plan","no_formal_succession_plan_in_place"]},
    {v:"planning",l:"Currently working on one",f:["business_owner_planning_exit_or_succession"]}
  ]},
  {id:"Q20",v:"businessPartners",ph:"what_you_have",t:"s",si:"business != 'no' && business != 'spouse' && business != 'sole_trader'",q:"Do you have business partners or co-shareholders?",h:null,o:[
    {v:"yes_buysell",l:"Yes — with a buy-sell agreement",f:["has_buy_sell_agreement_or_business_succession_arrangement"]},
    {v:"yes_no_agreement",l:"Yes — but no buy-sell agreement",f:["has_no_shareholders_agreement_or_agreement_lacks_succession_provisions"]},
    {v:"family",l:"Yes — family members",f:["concerned_about_succession_to_next_generation"]},
    {v:"no",l:"No — sole owner",f:["business_continuity_dependent_on_single_individual"]}
  ]},
  {id:"Q21",v:"willStatus",ph:"your_situation",t:"s",si:null,q:"Do you have a valid will?",h:null,o:[
    {v:"current",l:"Yes — updated within the last 3 years",f:[]},
    {v:"outdated",l:"Yes — but it's more than 3 years old",f:[]},
    {v:"very_old",l:"Yes — but it was written before a major life change",f:[]},
    {v:"no",l:"No — I don't have a will",f:["estate_distribution_under_intestacy_differs_from_deceased_stated_intentions"]},
    {v:"started",l:"Started but not completed or signed",f:[]}
  ]},
  {id:"Q22",v:"testamentaryTrust",ph:"your_situation",t:"s",si:"willStatus != 'no' && willStatus != 'started' && estateValue != 'under500k'",q:"Does your will include a testamentary trust?",h:"A testamentary trust is created by your will to hold assets for your beneficiaries after you die. It provides asset protection and tax benefits.",o:[
    {v:"yes",l:"Yes",f:["has_testamentary_trust_in_will","is_trustee_of_testamentary_trust"]},
    {v:"no",l:"No",f:[]},{v:"unsure",l:"I'm not sure",f:[]},
    {v:"considering",l:"No — but I'm interested in learning about this",f:[]}
  ]},
  {id:"Q23",v:"epoa",ph:"your_situation",t:"s",si:null,q:"Do you have an enduring power of attorney?",h:"An enduring power of attorney lets someone you trust make financial or personal decisions for you if you lose capacity.",o:[
    {v:"yes",l:"Yes — enduring power of attorney in place",f:["has_enduring_power_of_attorney"]},
    {v:"general_only",l:"I have a general power of attorney (not enduring)",f:["existing_poa_document_is_general_not_enduring"]},
    {v:"no",l:"No",f:["has_no_enduring_power_of_attorney_in_place"]},
    {v:"unsure",l:"I don't know the difference",f:["has_no_enduring_power_of_attorney_in_place"]}
  ]},
  {id:"Q24",v:"lifeInsurance",ph:"your_situation",t:"s",si:"children != 'none' || business != 'no'",q:"Do you have life insurance?",h:null,o:[
    {v:"super_only",l:"Yes — inside my super fund only",f:["holds_life_insurance_policy","life_insurance_held_inside_superannuation"]},
    {v:"personal_only",l:"Yes — personal policy outside super",f:["holds_life_insurance_policy","has_life_insurance_outside_superannuation"]},
    {v:"both",l:"Yes — both inside and outside super",f:["holds_life_insurance_policy","life_insurance_held_inside_superannuation","has_life_insurance_outside_superannuation"]},
    {v:"none",l:"No life insurance",f:[]},{v:"unsure",l:"Not sure",f:[]}
  ]},
  {id:"Q25",v:"executor",ph:"your_situation",t:"s",si:"willStatus != 'no' && willStatus != 'started'",q:"Who have you appointed as executor of your will?",h:null,o:[
    {v:"professional",l:"A professional executor (solicitor, trustee company)",f:["is_executor_of_deceased_estate"]},
    {v:"family",l:"A family member",f:["is_executor_of_deceased_estate"]},
    {v:"family_unsuitable",l:"A family member — but they may not be suitable",f:["is_executor_of_deceased_estate","concerned_about_executor_personal_liability"]},
    {v:"none",l:"No executor named",f:[]}
  ]},
  {id:"Q26",v:"recentDeath",ph:"your_situation",t:"s",si:"age != 'under35'",q:"Are you currently dealing with or expecting to deal with a deceased estate?",h:null,o:[
    {v:"current",l:"Yes — currently administering a deceased estate",f:["is_beneficiary_of_deceased_estate","person_has_recently_died_leaving_an_estate","administering_deceased_estate","person_has_recently_died"]},
    {v:"recent",l:"Yes — a family member passed away in the last 2 years",f:["is_beneficiary_of_deceased_estate","recently_inherited_assets_through_deceased_estate","within_two_years_of_deceased_death"]},
    {v:"expecting",l:"Expecting to — an elderly parent has health concerns",f:["test_individual_deceased_or_elderly"]},
    {v:"no",l:"No",f:[]}
  ]},
  {id:"Q27",v:"inheritedProperty",ph:"your_situation",t:"s",si:"recentDeath == 'current' || recentDeath == 'recent' || investmentProperty == 'inherited'",q:"Have you inherited or are you about to inherit property?",h:null,o:[
    {v:"main_res",l:"Yes — it was the deceased's main home",f:["has_inherited_residential_property","inherited_property_from_deceased_estate","inherited_property_was_deceased_main_residence","inherited_asset_was_main_residence_of_deceased","disposal_of_estate_asset_within_two_years_of_death"]},
    {v:"investment",l:"Yes — it was an investment or rental property",f:["has_inherited_residential_property","inherited_property_from_deceased_estate","inherited_property_was_not_deceased_main_residence","inherited_property_was_investment_property"]},
    {v:"holiday",l:"Yes — it was a holiday home",f:["has_inherited_residential_property","inherited_property_from_deceased_estate","inherited_property_was_not_deceased_main_residence","inherited_property_was_holiday_home"]},
    {v:"joint",l:"Yes — jointly with siblings",f:["has_inherited_residential_property","inherited_property_from_deceased_estate","has_jointly_inherited_property_with_sibling","considering_buying_out_co_beneficiary_share"]},
    {v:"no",l:"No inherited property",f:[]}
  ]},
  {id:"Q28",v:"healthConcerns",ph:"your_situation",t:"m",si:null,q:"Are there any health or capacity concerns in your family?",h:"Select all that apply, or skip if none.",o:[
    {v:"own_serious",l:"I have a serious or terminal illness",f:["has_received_serious_illness_or_terminal_diagnosis","has_declined_health_or_terminal_illness"]},
    {v:"capacity",l:"I or a family member has cognitive decline or dementia",f:["has_diagnosed_cognitive_or_capacity_impairing_condition","concerned_about_future_mental_incapacity","concerned_about_incapacity_planning"]},
    {v:"disability",l:"A beneficiary has a disability",f:["has_beneficiary_with_disability","has_beneficiary_receiving_centrelink_or_ndis_payments"]},
    {v:"aged_care",l:"Considering or in aged care",f:["is_entering_or_considering_residential_aged_care","relies_on_government_aged_care_funding_or_my_aged_care_services"]},
    {v:"none",l:"No health or capacity concerns",f:[]}
  ]},
  {id:"Q29",v:"separationDivorce",ph:"your_situation",t:"s",si:"relationshipStatus == 'separated' || relationshipStatus == 'divorced' || children == 'adult_only' || children == 'both'",q:"Is separation or divorce affecting your estate planning?",h:null,o:[
    {v:"own_current",l:"Yes — I am going through or have recently completed separation",f:["currently_going_through_or_anticipating_divorce_proceedings","no_binding_financial_agreement_currently_in_place","contemplating_separation_or_divorce"]},
    {v:"child",l:"Yes — one of my children is going through separation",f:["concerned_about_beneficiary_divorce_risk","beneficiary_going_through_divorce","concerned_about_childs_marriage_breakdown_affecting_inherited_assets"]},
    {v:"concern",l:"Not currently — but I'm concerned about protecting assets from future family law claims",f:["concerned_about_family_law_claims","concerned_about_family_law_property_claims","concerned_about_asset_protection_in_divorce"]},
    {v:"no",l:"No",f:[]}
  ]},
  {id:"Q30",v:"primaryConcerns",ph:"your_concerns",t:"m",si:null,q:"What are your biggest estate planning concerns?",h:"Choose the issues that matter most to you right now. Select up to 3.",mx:3,o:[
    {v:"family_provided",l:"Making sure my family is financially provided for",f:["planning_intergenerational_wealth_transfer","wants_intergenerational_wealth_transfer"]},
    {v:"asset_protection",l:"Protecting assets from creditors or lawsuits",f:["concerned_about_asset_protection_from_creditors","concerned_about_beneficiary_asset_protection","concerned_about_asset_protection_for_beneficiaries","concerned_about_asset_protection"]},
    {v:"tax_minimise",l:"Minimising tax on my estate",f:["concerned_about_cgt_on_estate_assets","has_capital_gains_tax_liability_to_manage","concerned_about_death_benefit_tax_for_beneficiaries"]},
    {v:"business_continuity",l:"Ensuring my business continues or is properly wound up",f:["concerned_about_business_succession","concerned_about_business_continuity_if_health_crisis_occurs"]},
    {v:"vulnerable_beneficiary",l:"Providing for a vulnerable beneficiary",f:["has_beneficiary_with_disability","childrenVulnerable_yes","concerned_about_beneficiary_financial_mismanagement"]},
    {v:"equal_fair",l:"Treating children fairly (especially in blended family)",f:["concerned_about_family_provision_claims","concerned_about_beneficiary_relationship_breakdown","concerned_about_fair_inheritance_distribution","concerned_about_sibling_conflict_over_inheritance"]},
    {v:"family_law",l:"Protecting inheritance from family law claims on my children",f:["concerned_about_family_law_claims","concerned_about_beneficiary_family_law_claims","concerned_about_family_law_claims_on_inheritance"]},
    {v:"control",l:"Maintaining control of family structures (trusts, companies)",f:["concerned_about_trust_resettlement_risk_from_deed_amendment"]},
    {v:"simplify",l:"Simplifying my affairs for those who come after me",f:[]},
    {v:"incapacity",l:"Planning for my own incapacity",f:["concerned_about_incapacity_planning","concerned_about_future_mental_incapacity"]},
    {v:"charitable",l:"Leaving a charitable legacy",f:["wants_to_establish_charitable_legacy","wants_ongoing_philanthropic_vehicle_beyond_lifetime"]}
  ]},
  {id:"Q31",v:"planningHorizon",ph:"your_concerns",t:"s",si:null,q:"How urgent is your estate planning?",h:null,o:[
    {v:"crisis",l:"Urgent — health event, death, or imminent need",f:["has_received_serious_illness_or_terminal_diagnosis"]},
    {v:"immediate",l:"I need to act within the next few months",f:[]},
    {v:"short_term",l:"Within the next 12 months",f:[]},
    {v:"long_term",l:"Setting things up for the future — no rush",f:["planning_intergenerational_wealth_transfer"]},
    {v:"review",l:"I have a plan but it needs reviewing",f:[]}
  ]},
  {id:"Q32",v:"adviceStatus",ph:"your_concerns",t:"s",si:null,q:"What professional advice do you currently have?",h:null,o:[
    {v:"full_team",l:"Accountant, financial planner, and estate planning lawyer",f:[]},
    {v:"accountant_only",l:"Accountant only — no estate planning lawyer",f:[]},
    {v:"lawyer_only",l:"Estate planning lawyer only",f:[]},
    {v:"none",l:"No professional advisor",f:[]},
    {v:"seeking",l:"Looking for the right advisor",f:[]}
  ]},
  {id:"Q33",v:"international",ph:"specific_areas",t:"s",si:"estateValue == '2m_5m' || estateValue == '5m_10m' || estateValue == 'over10m'",q:"Do you have international connections that affect your estate?",h:null,o:[
    {v:"overseas_assets",l:"I own assets overseas",f:["has_international_asset_connections","has_assets_or_property_in_foreign_jurisdictions","estate_assets_located_in_multiple_australian_states_or_overseas"]},
    {v:"foreign_beneficiary",l:"One or more beneficiaries live overseas",f:["beneficiary_is_foreign_resident","beneficiaries_include_non_residents","estate_has_foreign_resident_beneficiary"]},
    {v:"both",l:"Both — overseas assets and foreign beneficiaries",f:["has_international_asset_connections","beneficiary_is_foreign_resident","beneficiaries_include_non_residents","estate_assets_located_in_multiple_australian_states_or_overseas"]},
    {v:"no",l:"No international connections",f:[]}
  ]},
  {id:"Q34",v:"philanthropy",ph:"specific_areas",t:"s",si:"estateValue == '2m_5m' || estateValue == '5m_10m' || estateValue == 'over10m' || primaryConcerns.includes('charitable')",q:"Are you interested in structured charitable giving?",h:null,o:[
    {v:"paf",l:"Yes — interested in establishing a private ancillary fund (PAF)",f:["considering_private_ancillary_fund_establishment","wants_to_establish_charitable_legacy","wants_ongoing_philanthropic_vehicle_beyond_lifetime"]},
    {v:"bequest",l:"Yes — I want to include a charity in my will",f:["wants_to_establish_charitable_legacy","concerned_about_charitable_bequest_being_challenged"]},
    {v:"giving",l:"Yes — interested in structured giving during my lifetime",f:["wants_structured_giving_program","owns_appreciated_assets_suitable_for_charitable_contribution"]},
    {v:"no",l:"Not a priority",f:[]}
  ]}
];

// ─── BRANCHING ENGINE ───────────────────────────────────────
function evalSI(expr: string | null, a: Record<string, any>) {
  if (!expr) return true;
  return expr.split("||").map(s=>s.trim()).some(group =>
    group.split("&&").map(s=>s.trim()).every(cond => {
      let m;
      if ((m = cond.match(/^(\w+)\.includes\('([^']+)'\)$/))) {
        const val = a[m[1]]; return Array.isArray(val) ? val.includes(m[2]) : val === m[2];
      }
      if ((m = cond.match(/^(\w+)\s*==\s*'([^']+)'$/))) return a[m[1]] === m[2];
      if ((m = cond.match(/^(\w+)\s*!=\s*'([^']+)'$/))) return a[m[1]] !== undefined && a[m[1]] !== m[2];
      return false;
    })
  );
}
function getVis(a: Record<string, any>) { return QS.filter(q => evalSI(q.si, a)); }
function getTF(a: Record<string, any>) {
  const s = new Set<string>();
  QS.forEach(q => {
    const ans = a[q.v]; if (ans === undefined) return;
    if (Array.isArray(ans)) ans.forEach((v: string) => { const o = q.o.find(x=>x.v===v); if (o) o.f.forEach(f=>s.add(f)); });
    else { const o = q.o.find(x=>x.v===ans); if (o) o.f.forEach(f=>s.add(f)); }
  });
  return [...s];
}

// ─── TIER CONFIG ────────────────────────────────────────────
const TC = {
  critical: { label:"Critical for Your Situation", desc:"These topics directly affect you and may have time-sensitive implications.", color:"#DC2626", bg:"#FEF2F2", border:"#FECACA", icon:"🔴" },
  important: { label:"Important to Understand", desc:"These topics are relevant to your circumstances and worth reading carefully.", color:"#D97706", bg:"#FFFBEB", border:"#FDE68A", icon:"🟡" },
  worth_exploring: { label:"Worth Exploring", desc:"These may be relevant depending on how your situation develops.", color:"#2563EB", bg:"#EFF6FF", border:"#BFDBFE", icon:"🔵" }
};
const CAT: Record<string, string> = { superannuation:"Superannuation", trusts:"Trusts", wills:"Wills & Estate Planning", property:"Property", companies:"Companies & Directors", general:"General", insurance:"Insurance", tax:"Tax & CGT", centrelink:"Centrelink & Pensions", business:"Business" };

// ─── RESULT CARD ────────────────────────────────────────────
function Card({ doc, tc, expanded, onToggle }: { doc: any; tc: any; expanded: boolean; onToggle: () => void }) {
  const [ds, setDs] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (expanded && !ds && doc.variantUrls?.DS?.md) {
      setLoading(true);
      fetch(doc.variantUrls.DS.md).then(r=>r.text()).then(t => {
        setDs(t.replace(/<[^>]+>/g,'').trim()); setLoading(false);
      }).catch(()=>setLoading(false));
    }
  }, [expanded, ds, doc.variantUrls]);
  const ml = doc.variantUrls?.ML?.html, su = doc.variantUrls?.SU?.html;
  const cx = typeof doc.complexityLevel === 'object' ? doc.complexityLevel?.level : doc.complexityLevel;
  return (
    <div style={{ background:"#fff", borderRadius:14, border:`1px solid ${expanded?tc.border:"#e8ecef"}`, overflow:"hidden", transition:"all 0.25s", boxShadow:expanded?"0 4px 16px rgba(0,0,0,0.08)":"0 1px 3px rgba(0,0,0,0.04)" }}>
      <div onClick={onToggle} style={{ padding:"18px 20px", cursor:"pointer", display:"flex", gap:14, alignItems:"flex-start", ...(expanded?{background:tc.bg}:{}) }}>
        <div style={{fontSize:26,flexShrink:0,marginTop:2}}>{doc.icon||"📋"}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontWeight:600,color:"#1F4E79",lineHeight:1.3,marginBottom:6}}>{doc.title||`Document #${doc.runNumber}`}</div>
          <div style={{fontSize:15,color:"#4a5568",lineHeight:1.5}}>{doc.oneLineHook||doc.userOutcome||""}</div>
          <div style={{display:"flex",gap:10,marginTop:10,flexWrap:"wrap",alignItems:"center"}}>
            {cx && <span style={{fontSize:11,fontWeight:600,padding:"3px 8px",borderRadius:6,background:cx==="entry"?"#ECFDF5":cx==="intermediate"?"#EFF6FF":cx==="advanced"?"#FFF7ED":"#FDF2F8",color:cx==="entry"?"#065F46":cx==="intermediate"?"#1E40AF":cx==="advanced"?"#9A3412":"#9D174D",textTransform:"uppercase",letterSpacing:0.5}}>{cx}</span>}
            {doc.readingTime && <span style={{fontSize:12,color:"#8896a7"}}>{doc.readingTime} min read</span>}
            {doc.category && CAT[doc.category] && <span style={{fontSize:12,color:"#8896a7"}}>{CAT[doc.category]}</span>}
          </div>
        </div>
        <div style={{fontSize:18,color:"#9aa5b4",flexShrink:0,marginTop:4,transform:expanded?"rotate(180deg)":"rotate(0)",transition:"transform 0.25s"}}>▾</div>
      </div>
      {expanded && (
        <div style={{padding:"0 20px 20px",borderTop:`1px solid ${tc.border}`,animation:"fadeIn 0.3s ease"}}>
          {loading && <div style={{padding:"16px 0",color:"#8896a7",fontSize:14}}>Loading preview...</div>}
          {ds && <div style={{padding:"16px 0",fontSize:15,lineHeight:1.7,color:"#374151",maxHeight:280,overflow:"hidden",WebkitMaskImage:"linear-gradient(to bottom,black 70%,transparent 100%)",maskImage:"linear-gradient(to bottom,black 70%,transparent 100%)"}}>{ds.split("\n\n").filter(Boolean).slice(0,3).map((p,i)=><p key={i} style={{margin:"0 0 12px"}}>{p}</p>)}</div>}
          {!ds && !loading && doc.description && <div style={{padding:"16px 0",fontSize:15,lineHeight:1.7,color:"#374151"}}>{doc.description}</div>}
          {doc.userOutcome && <div style={{padding:"12px 16px",background:"#F0F9FF",borderRadius:10,borderLeft:"3px solid #2E75B6",fontSize:14,color:"#1F4E79",lineHeight:1.6,margin:"8px 0 16px"}}>{doc.userOutcome}</div>}
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {ml && <a href={ml} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,background:"#1F4E79",color:"#fff",padding:"10px 20px",borderRadius:8,fontSize:14,fontWeight:600,textDecoration:"none"}}>📖 Read Free Guide</a>}
            {su && <a href={su} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,background:"transparent",color:"#1F4E79",padding:"10px 20px",borderRadius:8,fontSize:14,fontWeight:600,border:"2px solid #1F4E79",textDecoration:"none"}}>⚡ Quick Summary</a>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TIER SECTION ───────────────────────────────────────────
function Tier({ tier, docs, open }: { tier: string; docs: any[]; open: boolean }) {
  const c = TC[tier as keyof typeof TC];
  const [collapsed, setCollapsed] = useState(!open);
  const [exp, setExp] = useState<string | null>(null);
  if (!c || !docs?.length) return null;
  return (
    <div style={{marginBottom:28}}>
      <div onClick={()=>setCollapsed(!collapsed)} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"14px 18px",background:c.bg,borderRadius:12,border:`1px solid ${c.border}`,marginBottom:collapsed?0:14,transition:"all 0.2s"}}>
        <span style={{fontSize:18}}>{c.icon}</span>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:c.color}}>{c.label}</div>
          <div style={{fontSize:13,color:"#6b7a8d",marginTop:2}}>{docs.length} topic{docs.length!==1?"s":""} — {c.desc}</div>
        </div>
        <span style={{fontSize:18,color:c.color,transition:"transform 0.2s",transform:collapsed?"rotate(-90deg)":"rotate(0)"}}>▾</span>
      </div>
      {!collapsed && <div style={{display:"flex",flexDirection:"column",gap:10,animation:"fadeIn 0.3s ease"}}>
        {docs.map(d=><Card key={d.runNumber} doc={d} tc={c} expanded={exp===d.runNumber} onToggle={()=>setExp(exp===d.runNumber?null:d.runNumber)}/>)}
      </div>}
    </div>
  );
}

// ─── OPUS SYNTHESIS ─────────────────────────────────────────
function Synthesis({ results, answers }: { results: any; answers: Record<string, any> }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || !results) return;
    ran.current = true; setLoading(true);
    const allDocs = [...(results.critical||[]),...(results.important||[])].slice(0,12);
    if (!allDocs.length) { setLoading(false); return; }
    const docSum = allDocs.map(d=>`[${d.icon||"📋"} #${d.runNumber}] ${d.title}\n  Hook: ${d.oneLineHook||"N/A"}\n  Outcome: ${d.userOutcome||"N/A"}\n  Tier: ${d.tier}`).join("\n\n");
    const anSum = Object.entries(answers).filter(([,v])=>v!=null).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(", "):v}`).join("\n");
    fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:`You are a senior Australian estate planning advisor writing a personalised 3-paragraph snapshot for someone who just completed an estate planning assessment.\n\nUSER'S SITUATION:\n${anSum}\n\nMATCHED TOPICS (ordered by relevance):\n${docSum}\n\nWrite exactly 3 paragraphs:\n1. Acknowledge their specific situation and key complexity factors. Be specific.\n2. Name the 2-3 most critical topics and explain WHY they matter for this person. Reference specific dollar amounts or risks where available.\n3. Recommend sharing this with their professional advisor and suggest the single most important conversation to have first.\n\nRules: Plain Australian English. Be warm but direct. Never use bullet points. Never say "based on your answers". Reference topics by plain English title. Under 250 words.`}]
    })}).then(r=>r.json()).then(d=>{setText(d.content?.map((c: any)=>c.text||"").join("")||"");setLoading(false);}).catch(()=>setLoading(false));
  }, [results, answers]);
  if (!loading && !text) return null;
  return (
    <div style={{background:"#1F4E79",borderRadius:16,padding:"28px",marginBottom:28,color:"#fff"}}>
      <div style={{fontSize:12,letterSpacing:2,textTransform:"uppercase",opacity:0.7,marginBottom:10}}>Your Personalised Assessment</div>
      {loading && <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:20,height:20,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/><span style={{fontSize:15,opacity:0.8}}>Analysing your situation...</span></div>}
      {text && <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,lineHeight:1.7}}>{text.split("\n\n").filter(Boolean).map((p,i)=><p key={i} style={{margin:i===0?0:"16px 0 0"}}>{p}</p>)}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function EstatePlanningQuiz() {
  const [phase, setPhase] = useState("welcome");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [qIdx, setQIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [triggerFacts, setTriggerFacts] = useState<string[]>([]);
  const [results, setResults] = useState<any>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const guideNum = useRef(Math.floor(10000000 + Math.random() * 90000000).toString());

  const visQ = useMemo(() => getVis(answers), [answers]);
  const curQ = visQ[qIdx];
  const curPh = curQ ? PHASES.find(p => p.id === curQ.ph) : null;
  const pct = visQ.length > 0 ? (qIdx / visQ.length) * 100 : 0;

  const scroll = useCallback(() => topRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), []);

  const goNext = useCallback(() => {
    if (qIdx < visQ.length - 1) { setQIdx(i=>i+1); setAnimKey(k=>k+1); scroll(); }
    else { setTriggerFacts(getTF(answers)); setPhase("summary"); scroll(); }
  }, [qIdx, visQ.length, answers, scroll]);

  const goBack = useCallback(() => { if(qIdx>0){setQIdx(i=>i-1);setAnimKey(k=>k+1);scroll();} }, [qIdx, scroll]);

  const selSingle = useCallback((variable: string, value: string) => {
    setAnswers((p: Record<string, any>) => ({...p, [variable]: value}));
    setTimeout(() => goNext(), 280);
  }, [goNext]);

  const togMulti = useCallback((variable: string, value: string, maxSel?: number) => {
    setAnswers((p: any) => {
      const cur = p[variable] || [];
      if (value === "none") return {...p, [variable]: ["none"]};
      let next = cur.filter((v: string) => v !== "none");
      if (next.includes(value)) next = next.filter((v: string) => v !== value);
      else { if (maxSel && next.length >= maxSel) return p; next = [...next, value]; }
      return {...p, [variable]: next};
    });
  }, []);

  const submit = useCallback(async () => {
    setPhase("scoring"); scroll();
    try {
      const r = await fetch(SCORING_URL, { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ triggerFacts, answers, quizId:"estate-planning" }) });
      const d = await r.json(); setResults(d); setPhase("results");
    } catch(e) { setResults({ error:true, triggerFacts }); setPhase("results"); }
  }, [triggerFacts, answers, scroll]);

  const restart = useCallback(() => { setPhase("welcome"); setAnswers({}); setQIdx(0); setResults(null); setTriggerFacts([]); scroll(); }, [scroll]);

  // Derive results data
  const hasRes = results?.success && results?.results;
  const critical = hasRes ? results.results.critical : [];
  const important = hasRes ? results.results.important : [];
  const worthExp = hasRes ? results.results.worthExploring : [];
  const totalMatch = critical.length + important.length + worthExp.length;

  // Shared styles
  const serif = {fontFamily:"'Cormorant Garamond',serif"};
  const heading = {...serif, color:"#1F4E79", fontWeight:600};
  const card = {background:"#fff",borderRadius:16,padding:"36px 32px",boxShadow:"0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)"};
  const btn = {background:"#1F4E79",color:"#fff",border:"none",borderRadius:10,padding:"14px 32px",fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:"'Source Sans 3',sans-serif",transition:"all 0.2s"};
  const btnO = {background:"transparent",color:"#1F4E79",border:"2px solid #1F4E79",borderRadius:10,padding:"12px 28px",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'Source Sans 3',sans-serif"};

  return (
    <div style={{fontFamily:"'Source Sans 3',sans-serif",background:"#F8F6EC",minHeight:"100vh",color:"#1a2332"}}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}.qopt:hover{border-color:#2E75B6!important;background:#f7fafd!important}`}</style>
      <div ref={topRef}/>
      <div style={{maxWidth:720,margin:"0 auto",padding:"24px 20px 80px"}}>

      {/* ═══ WELCOME ═══ */}
      {phase==="welcome" && <>
        <div style={{textAlign:"center",paddingTop:48}}>
          <div style={{fontSize:13,letterSpacing:3,textTransform:"uppercase",color:"#2E75B6",fontWeight:600,marginBottom:16}}>Help Guide Me</div>
          <h1 style={{...heading,fontSize:44,lineHeight:1.2,marginBottom:20}}>Estate Planning<br/>Discovery</h1>
          <p style={{fontSize:18,color:"#4a5568",maxWidth:540,margin:"0 auto 40px",lineHeight:1.7}}>The decisions you make about your estate affect every person you care about. This assessment identifies the specific topics that matter to your situation — so you can focus your time and professional advice where it counts most.</p>
        </div>
        <div style={{...card,marginBottom:24}}>
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {[{i:"🎯",t:"Personalised to you",d:"Every question adapts based on your previous answers. If something doesn't apply to you, you won't be asked about it."},
              {i:"📚",t:"139 expert-reviewed topics",d:"Written by Chartered Accountants and estate planning specialists. No products to sell, no commissions to earn."},
              {i:"🔒",t:"Completely private",d:"Your answers are not stored, not shared, and not used for marketing. This is a tool for you."}
            ].map((x,i)=><div key={i} style={{display:"flex",gap:16,alignItems:"flex-start"}}><div style={{fontSize:28,flexShrink:0,marginTop:2}}>{x.i}</div><div><div style={{fontWeight:600,fontSize:16,marginBottom:4,color:"#1F4E79"}}>{x.t}</div><div style={{fontSize:15,color:"#5a6577",lineHeight:1.6}}>{x.d}</div></div></div>)}
          </div>
        </div>
        <div style={{...card,background:"#1F4E79",color:"#fff",marginBottom:32}}>
          <p style={{...serif,fontSize:20,lineHeight:1.6,margin:0,fontStyle:"italic"}}>&ldquo;Most Australians don&rsquo;t know what they don&rsquo;t know about estate planning. This assessment was designed to surface the gaps — the things that could cost your family tens of thousands of dollars, or cause years of unnecessary conflict.&rdquo;</p>
          <p style={{fontSize:14,marginTop:16,marginBottom:0,opacity:0.8}}>— BAKR Advisory Team, Chartered Accountants</p>
        </div>
        <div style={{textAlign:"center"}}>
          <button style={{...btn,fontSize:18,padding:"18px 48px"}} onClick={()=>{setPhase("quiz");scroll();}}>Begin Your Assessment</button>
          <p style={{fontSize:14,color:"#8896a7",marginTop:16}}>Takes 5–10 minutes depending on your situation</p>
        </div>
      </>}

      {/* ═══ QUIZ ═══ */}
      {phase==="quiz" && curQ && <>
        {/* Phase pills */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,flexWrap:"wrap"}}>
          {PHASES.map((p,i)=>{
            const cur=curPh?.id===p.id, past=p.order<(curPh?.order||0);
            return <div key={p.id} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{fontSize:11,fontWeight:600,padding:"3px 8px",borderRadius:20,background:cur?"#1F4E79":past?"#d4e4f1":"#e8ecef",color:cur?"#fff":past?"#1F4E79":"#9aa5b4",whiteSpace:"nowrap"}}>{p.icon} {p.name}</div>
              {i<PHASES.length-1 && <div style={{width:8,height:1,background:"#d0d5dc"}}/>}
            </div>;
          })}
        </div>
        {/* Progress */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:13,color:"#8896a7"}}>Question {qIdx+1} of {visQ.length}</span>
            <span style={{fontSize:13,color:"#8896a7"}}>{Math.round(pct)}%</span>
          </div>
          <div style={{height:4,background:"#e2e6ea",borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#1F4E79,#2E75B6)",borderRadius:2,transition:"width 0.5s ease"}}/>
          </div>
        </div>
        {/* Question */}
        <div key={animKey} style={{...card,animation:"fadeIn 0.35s ease-out"}}>
          <h2 style={{...heading,fontSize:26,marginBottom:curQ.h?8:24,lineHeight:1.3}}>{curQ.q}</h2>
          {curQ.h && <p style={{fontSize:15,color:"#6b7a8d",marginBottom:24,lineHeight:1.6}}>{curQ.h}</p>}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {curQ.o.map(opt=>{
              const isM=curQ.t==="m", val=answers[curQ.v], sel=isM?(val||[]).includes(opt.v):val===opt.v;
              return <div key={opt.v} className="qopt" style={{background:sel?"#EDF4FB":"#fff",border:`2px solid ${sel?"#2E75B6":"#e2e6ea"}`,borderRadius:12,padding:"16px 20px",cursor:"pointer",transition:"all 0.2s",display:"flex",alignItems:"center",gap:14,...(sel?{boxShadow:"0 0 0 1px #2E75B6"}:{})}}
                onClick={()=>isM?togMulti(curQ.v,opt.v,curQ.mx):selSingle(curQ.v,opt.v)}
                onMouseEnter={()=>setHovered(opt.v)} onMouseLeave={()=>setHovered(null)}>
                <div style={{width:22,height:22,borderRadius:isM?6:"50%",border:`2px solid ${sel?"#2E75B6":"#c4c9cf"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:sel?"#2E75B6":"#fff",transition:"all 0.2s"}}>
                  {sel && <svg width="12" height="12" viewBox="0 0 12 12" fill="none">{isM?<path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>:<circle cx="6" cy="6" r="4" fill="#fff"/>}</svg>}
                </div>
                <span style={{fontSize:16,fontWeight:sel?600:400,color:sel?"#1F4E79":"#2d3748"}}>{opt.l}</span>
              </div>;
            })}
          </div>
          {curQ.t==="m" && <div style={{marginTop:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,color:"#8896a7"}}>{curQ.mx?`${(answers[curQ.v]||[]).filter((v: string)=>v!=="none").length} of ${curQ.mx} selected`:`${(answers[curQ.v]||[]).length} selected`}</span>
            <button style={{...btn,opacity:(answers[curQ.v]||[]).length>0?1:0.4}} disabled={!(answers[curQ.v]||[]).length} onClick={goNext}>Continue →</button>
          </div>}
        </div>
        <div style={{marginTop:20,display:"flex",justifyContent:"space-between"}}>
          {qIdx>0?<button style={{...btnO,border:"none",color:"#6b7a8d",padding:"10px 20px",fontSize:14}} onClick={goBack}>← Back</button>:<div/>}
          {curQ.t==="s"&&<button style={{...btnO,padding:"10px 20px",fontSize:14,opacity:0.5}} onClick={goNext}>Skip →</button>}
        </div>
      </>}

      {/* ═══ SUMMARY ═══ */}
      {phase==="summary" && <>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:48,marginBottom:12}}>✅</div>
          <h2 style={{...heading,fontSize:32,marginBottom:8}}>Assessment Complete</h2>
          <p style={{fontSize:17,color:"#5a6577",maxWidth:480,margin:"0 auto"}}>We&rsquo;ve identified {triggerFacts.length} factors specific to your situation from {Object.keys(answers).length} questions answered.</p>
        </div>
        {PHASES.map(p=>{
          const pqs=visQ.filter(q=>q.ph===p.id&&answers[q.v]!==undefined);
          if(!pqs.length) return null;
          return <div key={p.id} style={{...card,marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:600,color:"#2E75B6",marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>{p.icon} {p.name}</div>
            {pqs.map(q=>{
              const a=answers[q.v], disp=Array.isArray(a)?a.map(v=>q.o.find(x=>x.v===v)?.l).filter(Boolean).join(", "):q.o.find(x=>x.v===a)?.l||"—";
              return <div key={q.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:"1px solid #f0f2f4",gap:16}}>
                <span style={{fontSize:14,color:"#6b7a8d",flex:1}}>{q.q}</span>
                <span style={{fontSize:14,fontWeight:600,color:"#1a2332",textAlign:"right",flexShrink:0,maxWidth:"45%"}}>{disp}</span>
              </div>;
            })}
          </div>;
        })}
        <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:32}}>
          <button style={btnO} onClick={()=>{setPhase("quiz");setQIdx(visQ.length-1);scroll();}}>← Change Answers</button>
          <button style={{...btn,fontSize:18,padding:"16px 40px"}} onClick={submit}>Get My Results</button>
        </div>
      </>}

      {/* ═══ SCORING ═══ */}
      {phase==="scoring" && <div style={{textAlign:"center",paddingTop:80}}>
        <div style={{width:48,height:48,border:"4px solid #e2e6ea",borderTopColor:"#1F4E79",borderRadius:"50%",margin:"0 auto 24px",animation:"spin 0.8s linear infinite"}}/>
        <h2 style={{...heading,fontSize:24,marginBottom:8}}>Analysing your situation</h2>
        <p style={{fontSize:16,color:"#6b7a8d"}}>Matching {triggerFacts.length} factors against 139 expert-reviewed topics...</p>
      </div>}

      {/* ═══ RESULTS ═══ */}
      {phase==="results" && <>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:12,letterSpacing:3,textTransform:"uppercase",color:"#2E75B6",fontWeight:600,marginBottom:10}}>Help Guide Me</div>
          <h1 style={{...heading,fontSize:36,lineHeight:1.2,margin:"0 0 12px"}}>Your Estate Planning Guide</h1>
          <p style={{fontSize:16,color:"#6b7a8d",maxWidth:480,margin:"0 auto"}}>{totalMatch>0?`We identified ${totalMatch} topics relevant to your situation.`:"Processing your results..."}</p>
          <div style={{display:"inline-block",marginTop:12,padding:"6px 16px",background:"#EDF4FB",borderRadius:20,fontSize:13,color:"#1F4E79",fontWeight:600}}>Guide Me #{guideNum.current}</div>
        </div>

        {totalMatch>0 && <Synthesis results={hasRes?results.results:null} answers={answers}/>}
        <Tier tier="critical" docs={critical} open={true}/>
        <Tier tier="important" docs={important} open={true}/>
        <Tier tier="worth_exploring" docs={worthExp} open={false}/>

        {totalMatch===0 && !results?.error && <div style={{...card,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>📭</div>
          <div style={{...heading,fontSize:24,marginBottom:8}}>No matched topics found</div>
          <p style={{fontSize:15,color:"#6b7a8d",maxWidth:400,margin:"0 auto"}}>This is unusual. Please try the assessment again or contact us for help.</p>
        </div>}

        {/* Error fallback — show trigger facts */}
        {results?.error && <div style={{...card,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:600,color:"#2E75B6",marginBottom:12}}>Trigger Facts Collected ({triggerFacts.length})</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{triggerFacts.map(f=><span key={f} style={{fontSize:12,background:"#EDF4FB",color:"#1F4E79",padding:"4px 10px",borderRadius:20}}>{f}</span>)}</div>
          <p style={{fontSize:14,color:"#6b7a8d",marginTop:16}}>The scoring endpoint returned an error. These trigger facts will be used once the endpoint is connected.</p>
        </div>}

        {/* Share With Advisor */}
        {totalMatch>0 && <div style={{...card,marginTop:8}}>
          <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
            <div style={{fontSize:32,flexShrink:0}}>👨‍💼</div>
            <div>
              <div style={{...heading,fontSize:22,marginBottom:6}}>Share With Your Advisor</div>
              <p style={{fontSize:15,color:"#5a6577",lineHeight:1.6,margin:"0 0 16px"}}>Your Guide Me number is <strong>#{guideNum.current}</strong>. Share this with your accountant, financial planner, or estate planning lawyer so they can see exactly which topics apply to you.</p>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <button onClick={()=>{
                  const t=`Estate Planning Guide Me #${guideNum.current}\n\n${critical.length} critical, ${important.length} important, ${worthExp.length} worth exploring\n\nCritical:\n${critical.map(d=>`• ${d.title}`).join("\n")}\n\nImportant:\n${important.map(d=>`• ${d.title}`).join("\n")}\n\nhelpguideme.com.au`;
                  navigator.clipboard?.writeText(t);
                }} style={{...btn,padding:"10px 20px",fontSize:14}}>📋 Copy Summary</button>
                <button onClick={()=>window.print()} style={{...btnO,padding:"10px 20px",fontSize:14}}>🖨️ Print Results</button>
              </div>
            </div>
          </div>
        </div>}

        <div style={{textAlign:"center",marginTop:32}}>
          <button onClick={restart} style={{background:"transparent",color:"#6b7a8d",border:"none",fontSize:14,cursor:"pointer",textDecoration:"underline",fontFamily:"'Source Sans 3',sans-serif"}}>Start a new assessment</button>
        </div>
      </>}

      {/* Footer */}
      <div style={{textAlign:"center",padding:"32px 20px 0",fontSize:13,color:"#9aa5b4"}}>
        © 2026 Business and Accountants Knowledge Resource Pty Ltd. All rights reserved.
        <br/>No products. No commissions. No agenda — just educating Australians.
      </div>
      </div>
    </div>
  );
}
