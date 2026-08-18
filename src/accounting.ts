import { Pool, PoolClient } from 'pg';

export type JournalLineInput={accountId:string;partyId?:string;description?:string;debit?:number;credit?:number};
export type PostJournalInput={organizationId:string;financialPeriodId:string;voucherNumber:string;voucherType:string;entryDate:string;narration:string;sourceType?:string;sourceId?:string;lines:JournalLineInput[]};

const cents=(v:number)=>{if(!Number.isFinite(v)||v<0)throw new Error('Amount must be a non-negative finite number');return Math.round(v*100)};
export function validateJournal(lines:JournalLineInput[]){
 if(lines.length<2)throw new Error('A journal requires at least two lines');
 let d=0,c=0;
 for(const l of lines){const debit=cents(Number(l.debit??0)),credit=cents(Number(l.credit??0));if((debit===0&&credit===0)||(debit>0&&credit>0))throw new Error('Each line must contain exactly one positive debit or credit');d+=debit;c+=credit}
 if(d!==c)throw new Error(`Journal is unbalanced: debit ${(d/100).toFixed(2)} != credit ${(c/100).toFixed(2)}`);
}

export async function postJournal(pool:Pool,input:PostJournalInput){
 validateJournal(input.lines); const client:PoolClient=await pool.connect();
 try{await client.query('BEGIN');
  const period=await client.query('SELECT status,starts_on,ends_on FROM financial_periods WHERE id=$1 AND organization_id=$2 FOR UPDATE',[input.financialPeriodId,input.organizationId]);
  if(!period.rowCount)throw new Error('Financial period not found');
  if(period.rows[0].status!=='OPEN')throw new Error('Financial period is not open');
  if(input.entryDate<period.rows[0].starts_on.toISOString().slice(0,10)||input.entryDate>period.rows[0].ends_on.toISOString().slice(0,10))throw new Error('Entry date is outside the financial period');
  const duplicate=await client.query('SELECT 1 FROM journal_entries WHERE organization_id=$1 AND voucher_number=$2',[input.organizationId,input.voucherNumber]);
  if(duplicate.rowCount)throw new Error('Voucher number already exists');
  for(const line of input.lines){const a=await client.query('SELECT 1 FROM accounts WHERE id=$1 AND organization_id=$2',[line.accountId,input.organizationId]);if(!a.rowCount)throw new Error('Account does not belong to organization')}
  const e=await client.query(`INSERT INTO journal_entries(organization_id,financial_period_id,voucher_number,voucher_type,entry_date,narration,source_type,source_id,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT') RETURNING id`,[input.organizationId,input.financialPeriodId,input.voucherNumber,input.voucherType,input.entryDate,input.narration,input.sourceType??null,input.sourceId??null]);
  const id=e.rows[0].id as string;
  for(const l of input.lines)await client.query('INSERT INTO journal_lines(journal_id,account_id,party_id,description,debit,credit) VALUES($1,$2,$3,$4,$5,$6)',[id,l.accountId,l.partyId??null,l.description??null,l.debit??0,l.credit??0]);
  await client.query(`UPDATE journal_entries SET status='POSTED' WHERE id=$1`,[id]);
  const check=await client.query('SELECT COALESCE(SUM(debit),0) debit,COALESCE(SUM(credit),0) credit FROM journal_lines WHERE journal_id=$1',[id]);
  if(Number(check.rows[0].debit)!==Number(check.rows[0].credit))throw new Error('Database balance check failed');
  await client.query(`INSERT INTO audit_logs(organization_id,actor_type,action,entity_type,entity_id,after_data) VALUES($1,'SYSTEM','JOURNAL_POSTED','journal_entry',$2,$3)`,[input.organizationId,id,JSON.stringify(input)]);
  await client.query('COMMIT');return id;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}

export async function trialBalance(pool:Pool,org:string){return (await pool.query(`SELECT a.id,a.code,a.name,a.type,COALESCE(SUM(jl.debit),0)::numeric debit,COALESCE(SUM(jl.credit),0)::numeric credit FROM accounts a LEFT JOIN journal_lines jl ON jl.account_id=a.id LEFT JOIN journal_entries je ON je.id=jl.journal_id AND je.organization_id=$1 AND je.status='POSTED' WHERE a.organization_id=$1 GROUP BY a.id ORDER BY a.code`,[org])).rows}

export async function financialSummary(pool:Pool,org:string){
 const r=await pool.query(`SELECT a.type,COALESCE(SUM(jl.debit),0)::numeric debit,COALESCE(SUM(jl.credit),0)::numeric credit FROM accounts a JOIN journal_lines jl ON jl.account_id=a.id JOIN journal_entries je ON je.id=jl.journal_id AND je.status='POSTED' WHERE a.organization_id=$1 GROUP BY a.type`,[org]);
 const x:{revenue:number;expenses:number;assets:number;liabilities:number;equity:number}={revenue:0,expenses:0,assets:0,liabilities:0,equity:0};
 for(const row of r.rows){const d=Number(row.debit),c=Number(row.credit);if(row.type==='INCOME')x.revenue+=c-d;else if(row.type==='EXPENSE')x.expenses+=d-c;else if(row.type==='ASSET')x.assets+=d-c;else if(row.type==='LIABILITY')x.liabilities+=c-d;else if(row.type==='EQUITY')x.equity+=c-d}
 return {...x,profit:x.revenue-x.expenses,balanced:true};
}
