import { Pool } from 'pg';
export async function syncGstFromInvoices(pool:Pool,org:string,from:string,to:string){
 const r=await pool.query(`SELECT i.id,i.document_type,i.invoice_date,i.taxable_value,i.cgst,i.sgst,i.igst,i.cess,i.reverse_charge FROM invoices i WHERE i.organization_id=$1 AND i.invoice_date BETWEEN $2 AND $3 AND i.status<>'VOID'`,[org,from,to]);
 let inserted=0;
 for(const i of r.rows){const direction=i.document_type==='PURCHASE'?'INPUT':'OUTPUT';const exists=await pool.query('SELECT 1 FROM gst_transactions WHERE organization_id=$1 AND invoice_id=$2 LIMIT 1',[org,i.id]);if(exists.rowCount)continue;await pool.query(`INSERT INTO gst_transactions(organization_id,invoice_id,direction,supply_category,taxable_value,cgst,sgst,igst,cess,reverse_charge,itc_status) VALUES($1,$2,$3,'B2B',$4,$5,$6,$7,$8,$9,$10)`,[org,i.id,direction,i.taxable_value,i.cgst,i.sgst,i.igst,i.cess,i.reverse_charge,direction==='INPUT'?'PROPOSED':null]);inserted++;}
 return {scanned:r.rowCount,inserted};
}
