import express from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { postJournal, trialBalance } from './accounting.js';

const app = express();
app.use(express.json({ limit: '2mb' }));
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://ai_tax:ai_tax_dev@localhost:5432/ai_tax' });
const ORG = '00000000-0000-0000-0000-000000000001';
const PERIOD = '00000000-0000-0000-0000-000000000101';

app.get('/api/health', async (_req,res) => {
  try { const r=await pool.query('SELECT 1 AS ok'); res.json({ok:true,database:r.rows[0].ok===1,service:'ai-tax-api'}); }
  catch { res.status(503).json({ok:false,database:false}); }
});

app.get('/api/dashboard', async (_req,res) => {
  const [org,tb,exceptions]=await Promise.all([
    pool.query('SELECT id,name,legal_name,pan,gstin,entity_type,state_code FROM organizations WHERE id=$1',[ORG]),
    trialBalance(pool,ORG),
    pool.query("SELECT severity,title,description,status FROM exceptions WHERE organization_id=$1 AND status='OPEN' ORDER BY created_at DESC LIMIT 10",[ORG])
  ]);
  const totals=tb.reduce((a:{debit:number;credit:number},r)=>({debit:a.debit+Number(r.debit),credit:a.credit+Number(r.credit)}),{debit:0,credit:0});
  res.json({organization:org.rows[0],trialBalance:tb,totals,exceptions:exceptions.rows});
});

app.get('/api/accounts',async(_req,res)=>res.json((await pool.query('SELECT id,code,name,type,parent_id FROM accounts WHERE organization_id=$1 ORDER BY code',[ORG])).rows));
app.get('/api/parties',async(_req,res)=>res.json((await pool.query('SELECT id,name,kind,gstin,pan,state_code FROM parties WHERE organization_id=$1 ORDER BY name',[ORG])).rows));

const journalSchema=z.object({
  voucherNumber:z.string().min(1), voucherType:z.string().min(1), entryDate:z.string().date(), narration:z.string().min(1),
  lines:z.array(z.object({accountId:z.string().uuid(),partyId:z.string().uuid().optional(),description:z.string().optional(),debit:z.number().nonnegative().default(0),credit:z.number().nonnegative().default(0)})).min(2)
});
app.post('/api/journals',async(req,res)=>{
  const parsed=journalSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid journal',details:parsed.error.flatten()});
  try { const id=await postJournal(pool,{organizationId:ORG,financialPeriodId:PERIOD,...parsed.data}); res.status(201).json({id,status:'POSTED'}); }
  catch(e){res.status(400).json({error:e instanceof Error?e.message:'Unable to post journal'});}
});

app.get('/api/ledger/:accountId',async(req,res)=>{
  const r=await pool.query(`SELECT je.entry_date,je.voucher_number,je.voucher_type,je.narration,jl.description,jl.debit,jl.credit FROM journal_lines jl JOIN journal_entries je ON je.id=jl.journal_id WHERE je.organization_id=$1 AND jl.account_id=$2 AND je.status='POSTED' ORDER BY je.entry_date,je.created_at`,[ORG,req.params.accountId]);
  let balance=0; res.json(r.rows.map(row=>{balance+=Number(row.debit)-Number(row.credit);return {...row,balance:balance.toFixed(2)}}));
});

app.get('/api/compliance/summary',async(_req,res)=>{
  const [gst,tds]=await Promise.all([
    pool.query(`SELECT COALESCE(SUM(CASE WHEN direction='OUTPUT' THEN cgst+sgst+igst+cess ELSE 0 END),0) output_tax,COALESCE(SUM(CASE WHEN direction='INPUT' THEN cgst+sgst+igst+cess ELSE 0 END),0) input_tax FROM gst_transactions WHERE organization_id=$1`,[ORG]),
    pool.query(`SELECT COALESCE(SUM(tds_amount),0) tds FROM tds_transactions WHERE organization_id=$1`,[ORG])
  ]);
  const output=Number(gst.rows[0].output_tax),input=Number(gst.rows[0].input_tax);
  res.json({gst:{outputTax:output,inputTax:input,netTax:Math.max(0,output-input)},tds:{liability:Number(tds.rows[0].tds)},status:'PREPARATION'});
});

app.get('/',(_req,res)=>res.sendFile('index.html',{root:'public'}));
app.use(express.static('public'));
const port=Number(process.env.PORT??3000);
app.listen(port,()=>console.log(`AI TAX running on http://localhost:${port}`));
