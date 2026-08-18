import { Router } from 'express';
import { z } from 'zod';
import { GovernmentAdapter, SandboxGovernmentAdapter, authorizationRequired, createFiling, transition } from './part5-compliance.js';

const filingSchema = z.object({ kind:z.enum(['GSTR1','GSTR3B','TDS','ITR']), period:z.string().min(4), payload:z.unknown() });
const filings = new Map<string, ReturnType<typeof createFiling>>();
const adapter: GovernmentAdapter = new SandboxGovernmentAdapter();

export function part5Routes() {
  const r = Router();
  r.get('/compliance/health', (_req,res)=>res.json({ ok:true, adapter:adapter.name, productionSubmissionEnabled:false, message:'Government submission is disabled until approved credentials and the official adapter are configured.' }));
  r.post('/compliance/filings', async (req,res)=>{
    try {
      const input=filingSchema.parse(req.body); let filing=createFiling(input.kind,input.period,input.payload); filing=transition(filing,'VALIDATING');
      const result=await adapter.validate(input.kind,input.payload);
      filing=transition(filing,result.accepted?'READY':'FAILED');
      if (result.accepted && authorizationRequired(filing.kind)) filing=transition(filing,'AUTHORIZATION_REQUIRED');
      filings.set(filing.id,filing); res.status(201).json({ filing, adapter:adapter.name, validation:result });
    } catch(e) { res.status(400).json({ error:e instanceof Error?e.message:'Invalid filing' }); }
  });
  r.get('/compliance/filings', (_req,res)=>res.json([...filings.values()]));
  r.get('/compliance/filings/:id', (req,res)=>{ const f=filings.get(req.params.id); if(!f) return res.status(404).json({error:'Filing not found'}); return res.json(f); });
  r.post('/compliance/filings/:id/submit', async (req,res)=>{
    const f=filings.get(req.params.id); if(!f)return res.status(404).json({error:'Filing not found'});
    try { const auth=z.object({mode:z.string().min(1),token:z.string().optional()}).parse(req.body); if(f.status!=='AUTHORIZATION_REQUIRED'&&f.status!=='READY')return res.status(409).json({error:`Filing is ${f.status}`}); let next=transition(f,'SUBMITTING'); const result=await adapter.submit(f.kind,{},auth); next=transition(next,result.status); next={...next,attempts:next.attempts+1,errorCode:result.errorCode,errorMessage:result.errorMessage,acknowledgement:result.acknowledgement}; filings.set(next.id,next); return res.json({filing:next,result}); }
    catch(e){return res.status(400).json({error:e instanceof Error?e.message:'Submission failed'});}
  });
  return r;
}
