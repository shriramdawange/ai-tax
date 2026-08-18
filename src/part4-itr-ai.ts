import { Pool } from 'pg';
import crypto from 'node:crypto';

const n=(v:any)=>Number(v||0);
const money=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;

export type TaxProfile={
  assessmentYear:string;
  taxpayerType:'INDIVIDUAL'|'HUF'|'COMPANY'|'FIRM'|'LLP'|'OTHER';
  residentialStatus?:string;
  age?:number;
  regime?:'OLD'|'NEW';
  businessIncome?:number;
  salaryIncome?:number;
  housePropertyIncome?:number;
  capitalGains?:number;
  otherIncome?:number;
  deductions?:number;
  tdsCredit?:number;
  advanceTax?:number;
};

export function validateTaxProfile(p:TaxProfile){
  const errors:string[]=[];
  if(!/^\d{4}-\d{2}$/.test(p.assessmentYear)) errors.push('Assessment year must be YYYY-YY');
  for(const [k,v] of Object.entries(p)) if(['age','businessIncome','salaryIncome','housePropertyIncome','capitalGains','otherIncome','deductions','tdsCredit','advanceTax'].includes(k) && v!==undefined && n(v)<0) errors.push(`${k} cannot be negative`);
  if(p.taxpayerType==='INDIVIDUAL' && p.age!==undefined && (p.age<0||p.age>130)) errors.push('Age is invalid');
  return {valid:errors.length===0,errors};
}

/**
 * Transparent computation primitive. This is intentionally not presented as a complete statutory slab engine.
 * Rates/thresholds are configuration-driven so the final production rules can be versioned per assessment year.
 */
export function computeTax(profile:TaxProfile,rules:{standardDeduction?:number;basicExemption?:number;slabs:{upto?:number;rate:number}[]}){
  const validation=validateTaxProfile(profile); if(!validation.valid) throw new Error(validation.errors.join('; '));
  const salary=Math.max(0,n(profile.salaryIncome)-(profile.regime==='NEW'?n(rules.standardDeduction):n(rules.standardDeduction)));
  const gross=salary+n(profile.businessIncome)+n(profile.housePropertyIncome)+n(profile.capitalGains)+n(profile.otherIncome);
  const deductions=profile.regime==='OLD'?Math.min(Math.max(0,n(profile.deductions)),gross):0;
  const taxable=Math.max(0,gross-deductions);
  let remaining=taxable,last=0,tax=0;
  for(const slab of rules.slabs){if(remaining<=0)break;const width=slab.upto===undefined?remaining:Math.max(0,slab.upto-last);const part=Math.min(remaining,width);tax+=part*n(slab.rate);remaining-=part;last=slab.upto??last+part;}
  const credits=n(profile.tdsCredit)+n(profile.advanceTax);
  return {grossIncome:money(gross),deductions:money(deductions),taxableIncome:money(taxable),computedTax:money(tax),taxCredits:money(credits),balanceTax:money(Math.max(0,tax-credits)),refund:money(Math.max(0,credits-tax))};
}

export async function financialTaxFacts(pool:Pool,org:string,from:string,to:string){
  const [sales,expenses,tds]=await Promise.all([
    pool.query(`SELECT COALESCE(SUM(total),0)::numeric total FROM invoices WHERE organization_id=$1 AND document_type='SALES' AND invoice_date BETWEEN $2 AND $3 AND status<>'VOID'`,[org,from,to]),
    pool.query(`SELECT COALESCE(SUM(total),0)::numeric total FROM invoices WHERE organization_id=$1 AND document_type='PURCHASE' AND invoice_date BETWEEN $2 AND $3 AND status<>'VOID'`,[org,from,to]),
    pool.query(`SELECT COALESCE(SUM(tds_amount),0)::numeric total FROM tds_transactions WHERE organization_id=$1 AND transaction_date BETWEEN $2 AND $3`,[org,from,to])
  ]);
  const revenue=n(sales.rows[0]?.total),expensesTotal=n(expenses.rows[0]?.total);
  return {revenue:money(revenue),expenses:money(expensesTotal),estimatedBusinessResult:money(revenue-expensesTotal),tdsCreditFromBooks:money(n(tds.rows[0]?.total))};
}

export async function createItrDraft(pool:Pool,org:string,profile:TaxProfile,computation:any,source:any){
  const payload={profile,computation,source,createdAt:new Date().toISOString()};
  const hash=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const r=await pool.query(`INSERT INTO itr_drafts(organization_id,assessment_year,taxpayer_type,regime,payload,source_hash,status) VALUES($1,$2,$3,$4,$5,$6,'DRAFT') ON CONFLICT(organization_id,assessment_year,source_hash) DO NOTHING RETURNING id`,[org,profile.assessmentYear,profile.taxpayerType,profile.regime??null,JSON.stringify(payload),hash]);
  return {created:Boolean(r.rowCount),id:r.rows[0]?.id??null,sourceHash:hash,status:'DRAFT'};
}

export function selectItrForm(profile:TaxProfile,facts:any){
  if(profile.taxpayerType==='COMPANY') return {form:'ITR-6',reason:'Company taxpayer'};
  if(profile.taxpayerType==='FIRM'||profile.taxpayerType==='LLP') return {form:'ITR-5',reason:'Firm/LLP taxpayer'};
  if(profile.taxpayerType==='HUF') return {form:'ITR-2-or-3',reason:'HUF requires fact-based form selection'};
  if(n(facts.businessIncome)>0) return {form:'ITR-3',reason:'Individual/HUF with business or profession income'};
  return {form:'ITR-1-or-2',reason:'Individual without business income; final selection depends on return facts'};
}

export function aiAccountantPlan(input:{transactionCount:number;unclassified:number;unreconciled:number;taxWarnings:number;highRisk:number}){
  const actions:string[]=[];
  if(input.unclassified>0) actions.push(`Classify ${input.unclassified} unclassified transaction(s)`);
  if(input.unreconciled>0) actions.push(`Resolve ${input.unreconciled} unreconciled transaction(s)`);
  if(input.taxWarnings>0) actions.push(`Review ${input.taxWarnings} tax warning(s)`);
  if(input.highRisk>0) actions.push(`Escalate ${input.highRisk} high-risk item(s)`);
  if(!actions.length) actions.push('No blocking accounting actions detected');
  return {priority:input.highRisk>0?'HIGH':input.unreconciled+input.unclassified>0?'MEDIUM':'LOW',actions};
}
