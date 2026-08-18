import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { authRequired, emitEvent, realtimeRoute } from './saas.js';
import { proposeTransaction } from './ai-gateway.js';
import { financialSummary, trialBalance } from './accounting.js';

export function productionRoutes(pool:Pool){
  const r=Router();
  r.use(authRequired(pool));

  r.get('/dashboard',async(req,res)=>{
    const org=req.auth!.organizationId;
    const [summary,tb,exceptions,automation]=await Promise.all([
      financialSummary(pool,org),
      trialBalance(pool,org),
      pool.query(`SELECT id,severity,category,title,description,status,created_at FROM exceptions WHERE organization_id=$1 AND status='OPEN' ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,created_at DESC LIMIT 20`,[org]),
      pool.query(`SELECT level,auto_post_low_risk,auto_reconcile,auto_prepare_returns,filing_requires_authorization FROM automation_policies WHERE organization_id=$1`,[org])
    ]);
    const totals=tb.reduce((a:any,x:any)=>({debit:a.debit+Number(x.debit),credit:a.credit+Number(x.credit)}),{debit:0,credit:0});
    res.json({summary,trialBalance:tb,totals,balanced:Math.abs(totals.debit-totals.credit)<0.005,exceptions:exceptions.rows,automation:automation.rows[0]??null});
  });

  r.get('/transactions',async(req,res)=>{
    const org=req.auth!.organizationId;
    const rows=await pool.query(`SELECT id,transaction_date,narration,reference,debit,credit,balance,match_status,match_confidence,matched_journal_id FROM bank_transactions WHERE organization_id=$1 ORDER BY transaction_date DESC,id DESC LIMIT 500`,[org]);
    res.json(rows.rows);
  });

  r.post('/ai/classify-transaction',async(req,res)=>{
    try{
      const body=z.object({narration:z.string().min(1).max(2000),amount:z.number().positive(),counterparty:z.string().max(200).optional()}).parse(req.body);
      const result=await proposeTransaction(pool,req.auth!.organizationId,body);
      res.status(201).json(result);
    }catch(e){res.status(400).json({error:e instanceof Error?e.message:'AI classification failed'});}
  });

  r.get('/ai/decisions',async(req,res)=>{
    res.json((await pool.query(`SELECT id,task_type,model_provider,model_name,decision,confidence,requires_review,status,created_at FROM ai_decisions WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,[req.auth!.organizationId])).rows);
  });

  r.post('/events',async(req,res)=>{
    const body=z.object({type:z.string().min(2).max(100),payload:z.record(z.string(),z.unknown()).default({})}).parse(req.body);
    res.status(201).json(await emitEvent(pool,req.auth!.organizationId,body.type,body.payload));
  });

  r.get('/events/stream',realtimeRoute(pool));

  r.get('/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,service:'ai-tax-production-api',database:true});}catch{res.status(503).json({ok:false,database:false});}});
  return r;
}
