import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { importBankCsv, reconcileBank } from './banking.js';
import { saveDocument } from './document-ai.js';

export function part2Routes(pool:Pool,org:string){
 const r=Router();
 r.get('/banks',async(_q,s)=>s.json((await pool.query('SELECT id,name,account_number_last4,opening_balance FROM bank_accounts WHERE organization_id=$1 ORDER BY name',[org])).rows));
 r.post('/banks/:bankId/import-csv',async(q,s)=>{try{const body=z.object({fileName:z.string().min(1),csv:z.string().min(2)}).parse(q.body);s.status(201).json(await importBankCsv(pool,{organizationId:org,bankAccountId:q.params.bankId,fileName:body.fileName,csv:body.csv}));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'Import failed'});}});
 r.post('/banks/:bankId/reconcile',async(q,s)=>{try{s.json(await reconcileBank(pool,org,q.params.bankId));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'Reconciliation failed'});}});
 r.post('/documents/extract',async(q,s)=>{try{const body=z.object({fileName:z.string().min(1),mimeType:z.string().min(1),text:z.string().min(1).max(2000000)}).parse(q.body);s.status(201).json(await saveDocument(pool,{organizationId:org,...body}));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'Extraction failed'});}});
 return r;
}
