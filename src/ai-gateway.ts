import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { emitEvent } from './saas.js';

export type AIProvider = 'openai-compatible'|'ollama'|'none';
export type AIResult = { provider:AIProvider; model:string; output:string; inputHash:string };

const config=z.object({provider:z.enum(['openai-compatible','ollama','none']).default('none'),apiKey:z.string().optional(),baseUrl:z.string().url().optional(),model:z.string().default('gpt-5-mini'),ollamaModel:z.string().default('qwen3:8b')});
function settings(){return config.parse({provider:process.env.AI_PROVIDER??'none',apiKey:process.env.AI_API_KEY,baseUrl:process.env.AI_BASE_URL,model:process.env.AI_MODEL??'gpt-5-mini',ollamaModel:process.env.OLLAMA_MODEL??'qwen3:8b'});}

export async function runAI(input:{system:string;user:string;temperature?:number}):Promise<AIResult>{
  const c=settings(); const inputHash=createHash('sha256').update(`${input.system}\n${input.user}`).digest('hex');
  if(c.provider==='none') return {provider:'none',model:'disabled',output:'AI provider is not configured',inputHash};
  const base=c.provider==='ollama' ? (c.baseUrl??'http://localhost:11434') : (c.baseUrl??'https://api.openai.com/v1');
  const model=c.provider==='ollama'?c.ollamaModel:c.model;
  const headers:Record<string,string>={'content-type':'application/json'}; if(c.provider==='openai-compatible'&&c.apiKey) headers.authorization=`Bearer ${c.apiKey}`;
  const url=c.provider==='ollama'?`${base.replace(/\/$/,'')}/api/chat`:`${base.replace(/\/$/,'')}/chat/completions`;
  const body=c.provider==='ollama'?{model,messages:[{role:'system',content:input.system},{role:'user',content:input.user}],stream:false,options:{temperature:input.temperature??0}}:{model,messages:[{role:'system',content:input.system},{role:'user',content:input.user}],temperature:input.temperature??0};
  const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  if(!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
  const data=await response.json() as any;
  const output=c.provider==='ollama'?String(data.message?.content??''):String(data.choices?.[0]?.message?.content??'');
  if(!output) throw new Error('AI provider returned an empty response');
  return {provider:c.provider,model,output,inputHash};
}

export async function proposeTransaction(pool:Pool,organizationId:string,input:{narration:string;amount:number;counterparty?:string}){
  const system=`You are an accounting classification assistant for Indian bookkeeping. Return ONLY JSON with keys: action, account_hint, confidence, reason, needs_review. Never invent GST/TDS rates. Never claim a transaction was posted. Confidence must be 0..1. High-risk or ambiguous transactions must set needs_review=true.`;
  const user=JSON.stringify(input);
  const result=await runAI({system,user});
  let decision:any={action:'review_transaction',account_hint:null,confidence:0,reason:result.output,needs_review:true};
  try { const parsed=JSON.parse(result.output.replace(/^```json\s*|\s*```$/g,'')); decision={...decision,...parsed}; } catch { /* preserve safe review decision */ }
  const confidence=Math.max(0,Math.min(1,Number(decision.confidence)||0));
  const requiresReview=Boolean(decision.needs_review)||confidence<0.9;
  const row=await pool.query(`INSERT INTO ai_decisions(organization_id,task_type,model_provider,model_name,input_hash,decision,confidence,requires_review) VALUES($1,'TRANSACTION_CLASSIFICATION',$2,$3,$4,$5,$6,$7) RETURNING id,created_at`,[organizationId,result.provider,result.model,result.inputHash,JSON.stringify({...decision,requires_review:requiresReview}),confidence,requiresReview]);
  await emitEvent(pool,organizationId,'AI_DECISION_CREATED',{decisionId:row.rows[0].id,confidence,requiresReview});
  return {id:row.rows[0].id,...decision,confidence,requiresReview,provider:result.provider,model:result.model};
}
