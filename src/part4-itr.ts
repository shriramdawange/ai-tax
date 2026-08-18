import { Pool } from 'pg';

export type TaxRegime = 'OLD' | 'NEW';
export type ItrProfile = {
  assessmentYear: string;
  taxpayerType: 'INDIVIDUAL' | 'HUF' | 'FIRM' | 'COMPANY';
  regime: TaxRegime;
  grossTotalIncome: number;
  salaryIncome?: number;
  housePropertyIncome?: number;
  businessIncome?: number;
  capitalGains?: number;
  otherIncome?: number;
  deductions80C?: number;
  deductions80D?: number;
  otherDeductions?: number;
  tdsCredit?: number;
  advanceTax?: number;
  selfAssessmentTax?: number;
};

export function chooseItrForm(p: ItrProfile): string {
  if (p.taxpayerType === 'COMPANY') return 'ITR-6';
  if (p.taxpayerType === 'FIRM') return 'ITR-5';
  if (p.taxpayerType === 'HUF') return 'ITR-2';
  if ((p.businessIncome ?? 0) > 0) return 'ITR-3';
  if ((p.capitalGains ?? 0) > 0 || (p.housePropertyIncome ?? 0) !== 0) return 'ITR-2';
  return 'ITR-1';
}

function slabTaxNew(income: number): number {
  let tax = 0;
  const slabs: [number, number, number][] = [
    [400000, 0, 0],
    [800000, 0.05, 400000],
    [1200000, 0.10, 800000],
    [1600000, 0.15, 1200000],
    [2000000, 0.20, 1600000],
    [2400000, 0.25, 2000000],
    [Infinity, 0.30, 2400000]
  ];
  for (const [upper, rate, lower] of slabs) {
    if (income > lower) tax += (Math.min(income, upper) - lower) * rate;
    if (income <= upper) break;
  }
  return Math.max(0, tax);
}

function slabTaxOld(income: number): number {
  let tax = 0;
  const slabs: [number, number, number][] = [[250000,0,0],[500000,0.05,250000],[1000000,0.20,500000],[Infinity,0.30,1000000]];
  for (const [upper, rate, lower] of slabs) {
    if (income > lower) tax += (Math.min(income, upper) - lower) * rate;
    if (income <= upper) break;
  }
  return Math.max(0, tax);
}

export function computeIndividualTax(p: ItrProfile) {
  const income = Math.max(0, p.grossTotalIncome);
  const deductions = p.regime === 'OLD'
    ? Math.min(income, (p.deductions80C ?? 0) + (p.deductions80D ?? 0) + (p.otherDeductions ?? 0))
    : 0;
  const taxableIncome = Math.max(0, income - deductions);
  const baseTax = p.regime === 'NEW' ? slabTaxNew(taxableIncome) : slabTaxOld(taxableIncome);
  const rebate = p.regime === 'NEW' && taxableIncome <= 1200000 ? baseTax : (p.regime === 'OLD' && taxableIncome <= 500000 ? baseTax : 0);
  const taxAfterRebate = Math.max(0, baseTax - rebate);
  const cess = taxAfterRebate * 0.04;
  const grossTax = taxAfterRebate + cess;
  const credits = (p.tdsCredit ?? 0) + (p.advanceTax ?? 0) + (p.selfAssessmentTax ?? 0);
  return { grossIncome: income, deductions, taxableIncome, baseTax, rebate, cess, grossTax, taxCredits: credits, balanceTax: Math.max(0, grossTax - credits), refund: Math.max(0, credits - grossTax) };
}

export async function reconcileTaxCredits(pool: Pool, organizationId: string, assessmentYear: string) {
  const { rows } = await pool.query(`SELECT COALESCE(SUM(tds_amount),0)::numeric AS tds FROM tds_transactions WHERE organization_id=$1 AND created_at >= $2::date AND created_at < ($2::date + interval '1 year')`, [organizationId, `${Number(assessmentYear.slice(0,4))-1}-04-01`]);
  return { assessmentYear, tdsCredit: Number(rows[0]?.tds ?? 0), source: 'BOOKS_TDS' };
}

export function validateItrProfile(p: ItrProfile): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}$/.test(p.assessmentYear)) errors.push('Invalid assessment year');
  if (p.grossTotalIncome < 0) errors.push('Gross total income cannot be negative');
  for (const [name, value] of Object.entries(p)) if (typeof value === 'number' && value < 0 && !['housePropertyIncome'].includes(name)) errors.push(`${name} cannot be negative`);
  if (p.regime === 'NEW' && ((p.deductions80C ?? 0) + (p.deductions80D ?? 0) + (p.otherDeductions ?? 0)) > 0) errors.push('Old-regime deductions were supplied for the new regime; review applicability');
  return errors;
}
