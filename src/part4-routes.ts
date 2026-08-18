import { Router } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import { aiAccountantPlan,computeTax,createItrDraft,financialTaxFacts,selectItrForm,validateTaxProfile } from './part4-itr-ai.js';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const profile=z.object({assessmentYear:z.string(),taxpayerType:z.enum(['INDIVIDUAL','HUF','COMPANY','FIRM','LLP','OTHER']),residentialStatus:z.string().optional(),age:z.number().optional(),regime:z.enum(['OLD','NEW']).optional(),businessIncome:z.number().optional(),salaryIncome:z.number().optional(),housePropertyIncome:z.number().optional(),capitalGains:z.number().optional(),otherIncome:z.number().optional(),deductions:z.number().optional(),tdsCredit:z.number().optional(),advanceTax:z.number().optional()});
export function part4Routes(pool:Pool,org:string){const r=Router();
 r.post('/itr/validate',async(q,s)=>{try{s.json(validateTaxProfile(profile.parse(q.body)));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'Invalid profile'});}});
 r.post('/itr/compute',async(q,s)=>{try{const p=profile.parse(q.body);const rules=z.object({standardDeduction:z.number().nonnegative().default(0),basicExemption:z.number().nonnegative().default(0),slabs:z.array(z.object({upto:z.number().positive().optional(),rate:z.number().min(0).max(1)})).min(1)}).parse(q.body.rules);s.json(computeTax(p,rules));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'Tax computation failed'});}});
 r.get('/itr/facts',async(q,s)=>{try{const p=z.object({from:date,to:date}).parse(q.query);s.json(await financialTaxFacts(pool,org,p.from,p.to));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'Could not compute financial facts'});}});
 r.post('/itr/form-select',async(q,s)=>{try{const p=profile.parse(q.body);const facts=q.body.facts??{};s.json(selectItrForm(p,facts));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'Form selection failed'});}});
 r.post('/itr/draft',async(q,s)=>{try{const p=profile.parse(q.body.profile);const computation=q.body.computation??{};const source=q.body.source??{};s.status(201).json(await createItrDraft(pool,org,p,computation,source));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'ITR draft failed'});}});
 r.get('/itr/drafts',async(_q,s)=>s.json((await pool.query(`SELECT id,assessment_year,taxpayer_type,regime,status,source_hash,created_at FROM itr_drafts WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`,[org])).rows));
 r.post('/ai-accountant/plan',async(q,s)=>{try{s.json(aiAccountantPlan(z.object({transactionCount:z.number().nonnegative(),unclassified:z.number().nonnegative(),unreconciled:z.number().nonnegative(),taxWarnings:z.number().nonnegative(),highRisk:z.number().nonnegative()}).parse(q.body)));}catch(e){s.status(400).json({error:e instanceof Error?e.message:'AI accountant plan failed'});}});
 return r;}
