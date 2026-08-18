import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { importBankCsv, reconcileBank } from './banking.js';
import { saveDocument } from './document-ai.js';

export function part2Routes(pool:Pool,org:string){
 const r=Router();
 r.get('/banks',async(_q,s)=>s.json((await pool.query('SELECT id,name,account_number_last4,opening_balance FROM bank_accounts WHERE organization_id=$1 ORDER BY name',[org])).rows));
 r.get('/banks/:bankId/transactions',async(q,s)=>s.json((await pool.query(`SELECT id,transaction_date,value_date,narration,reference,debit,credit,balance,match_status,match_confidence,matched_journal_id FROM bank_transactions WHERE organization_id=$1 AND bank_account_id=$2 ORDER BY transaction_date DESC,id DESC LIMIT 500`,[org,q.params.bankId])).rows));
 r.post('/banks/:bankId/import-csv',async(q,s)=>{try{const body=z.object({fileName:z.string().min(1),csv:z.string().min(2)}).parse(q.body);s.status(201).json(await importBankCsv(pool,{organizationId:org,bankAccountId:q.params.bankId,fileName:body.fileName,csv:body.csv}));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'Import failed'});}});
 r.post('/banks/:bankId/reconcile',async(q,s)=>{try{s.json(await reconcileBank(pool,org,q.params.bankId));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'Reconciliation failed'});}});
 r.get('/banks/:bankId/reconciliation',async(q,s)=>s.json((await pool.query(`SELECT br.*,bt.transaction_date,bt.narration,bt.debit,bt.credit,je.voucher_number,je.narration journal_narration FROM bank_reconciliations br JOIN bank_transactions bt ON bt.id=br.bank_transaction_id LEFT JOIN journal_entries je ON je.id=br.journal_id WHERE br.organization_id=$1 AND bt.bank_account_id=$2 ORDER BY br.created_at DESC LIMIT 500`,[org,q.params.bankId])).rows));
 r.post('/documents/extract',async(q,s)=>{try{const body=z.object({fileName:z.string().min(1),mimeType:z.string().min(1),text:z.string().min(1).max(2000000),documentType:z.enum(['INVOICE','BANK_STATEMENT','TAX_DOCUMENT','OTHER','UNKNOWN']).optional()}).parse(q.body);s.status(201).json(await saveDocument(pool,{organizationId:org,...body}));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'Extraction failed'});}});
 r.get('/documents',async(_q,s)=>s.json((await pool.query(`SELECT id,file_name,mime_type,document_type,extraction_status,confidence,created_at,extracted_data FROM source_documents WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,[org])).rows));
 r.get('/documents/:id',async(q,s)=>{const d=await pool.query('SELECT * FROM source_documents WHERE id=$1 AND organization_id=$2',[q.params.id,org]);if(!d.rowCount)return s.status(404).json({error:'Document not found'});const f=await pool.query('SELECT field_name,field_value,confidence,source_hint FROM extraction_fields WHERE document_id=$1 ORDER BY id',[q.params.id]);s.json({document:d.rows[0],fields:f.rows})});
 r.get('/automation/summary',async(_q,s)=>{const [d,b,u,m]=await Promise.all([pool.query('SELECT count(*)::int count FROM source_documents WHERE organization_id=$1',[org]),pool.query('SELECT count(*)::int count FROM bank_transactions WHERE organization_id=$1',[org]),pool.query("SELECT count(*)::int count FROM bank_transactions WHERE organization_id=$1 AND match_status='UNMATCHED'",[org]),pool.query("SELECT count(*)::int count FROM bank_transactions WHERE organization_id=$1 AND match_status='MATCHED'",[org])]);s.json({documents:d.rows[0].count,bankTransactions:b.rows[0].count,unmatchedBank:u.rows[0].count,matchedBank:m.rows[0].count,automationRate:b.rows[0].count?Number((m.rows[0].count/b.rows[0].count*100).toFixed(2)):0})});
 return r;
}
