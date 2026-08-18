import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseItrForm, computeIndividualTax, validateItrProfile } from '../src/part4-itr.js';
import { aiAccountantPlan } from '../src/part4-itr-ai.js';

test('ITR form selection distinguishes business income',()=>{
  assert.equal(chooseItrForm({assessmentYear:'2026-27',taxpayerType:'INDIVIDUAL',regime:'NEW',grossTotalIncome:100000,businessIncome:1} as any),'ITR-3');
});
test('ITR profile validation rejects negative income',()=>{
  const r=validateItrProfile({assessmentYear:'2026-27',taxpayerType:'INDIVIDUAL',regime:'NEW',grossTotalIncome:-1} as any);
  assert.ok(r.length>0);
});
test('deterministic tax computation never returns negative tax',()=>{
  const r=computeIndividualTax({assessmentYear:'2026-27',taxpayerType:'INDIVIDUAL',regime:'NEW',grossTotalIncome:100000} as any);
  assert.equal(r.grossTax,0);
});
test('AI accountant escalates high-risk work',()=>{
  const r=aiAccountantPlan({transactionCount:10,unclassified:0,unreconciled:0,taxWarnings:0,highRisk:2});
  assert.equal(r.priority,'HIGH');
});
