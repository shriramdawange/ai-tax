import { Pool } from 'pg';

export async function prepareGstr1(pool: Pool, organizationId: string, from: string, to: string) {
  const r = await pool.query(`SELECT i.invoice_number,i.invoice_date,p.gstin,p.name,i.taxable_value,i.cgst,i.sgst,i.igst,i.cess,i.total,i.place_of_supply
    FROM invoices i LEFT JOIN parties p ON p.id=i.party_id
    WHERE i.organization_id=$1 AND i.document_type='SALES' AND i.invoice_date BETWEEN $2 AND $3 ORDER BY i.invoice_date,i.invoice_number`,[organizationId,from,to]);
  return {returnType:'GSTR1',period:{from,to},documents:r.rows,summary:{invoiceCount:r.rowCount,taxableValue:r.rows.reduce((s,x)=>s+Number(x.taxable_value),0),tax: r.rows.reduce((s,x)=>s+Number(x.cgst)+Number(x.sgst)+Number(x.igst)+Number(x.cess),0)}};
}

export async function prepareGstr3b(pool: Pool, organizationId: string, from: string, to: string) {
  const r = await pool.query(`SELECT direction,COALESCE(SUM(taxable_value),0) taxable,COALESCE(SUM(cgst),0) cgst,COALESCE(SUM(sgst),0) sgst,COALESCE(SUM(igst),0) igst,COALESCE(SUM(cess),0) cess
    FROM gst_transactions WHERE organization_id=$1 AND created_at::date BETWEEN $2 AND $3 GROUP BY direction`,[organizationId,from,to]);
  const output=r.rows.find(x=>x.direction==='OUTPUT') ?? {taxable:0,cgst:0,sgst:0,igst:0,cess:0};
  const input=r.rows.find(x=>x.direction==='INPUT') ?? {taxable:0,cgst:0,sgst:0,igst:0,cess:0};
  const outputTax=Number(output.cgst)+Number(output.sgst)+Number(output.igst)+Number(output.cess);
  const inputTax=Number(input.cgst)+Number(input.sgst)+Number(input.igst)+Number(input.cess);
  return {returnType:'GSTR3B',period:{from,to},outward:{taxable:Number(output.taxable),tax:outputTax},itc:{taxable:Number(input.taxable),tax:inputTax},netTax:Math.max(0,outputTax-inputTax)};
}

export async function prepareTds(pool: Pool, organizationId: string, from: string, to: string) {
  const r=await pool.query(`SELECT t.transaction_date,t.section_code,p.pan,p.name,t.base_amount,t.rate,t.tds_amount,t.status FROM tds_transactions t LEFT JOIN parties p ON p.id=t.party_id WHERE t.organization_id=$1 AND t.transaction_date BETWEEN $2 AND $3 ORDER BY t.transaction_date`,[organizationId,from,to]);
  return {returnType:'TDS',period:{from,to},records:r.rows,totalTds:r.rows.reduce((s,x)=>s+Number(x.tds_amount),0)};
}

export function filingState(current: string, hasExceptions: boolean, authorization: boolean) {
  if(current==='ACCEPTED') return 'ACCEPTED';
  if(hasExceptions) return 'DRAFT';
  if(!authorization) return 'AUTHORIZATION_REQUIRED';
  return 'READY';
}
