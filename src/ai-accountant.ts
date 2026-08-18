export type Evidence = { sourceId: string; sourceType: string; field: string; value: unknown };
export type AgentDecision = { action: string; confidence: number; reason: string; evidence: Evidence[]; requiresReview: boolean };

const risky = new Set(['post_journal','file_return','change_tax_classification','approve_itc','delete_transaction']);

export function classifyTransaction(input: { narration: string; amount: number; counterparty?: string }): AgentDecision {
  const n = input.narration.toLowerCase();
  let action = 'review_transaction';
  let reason = 'No sufficiently strong deterministic pattern was found.';
  let confidence = 0.55;
  if (/salary|payroll/.test(n)) { action='salary_expense'; reason='Narration contains salary/payroll indicators.'; confidence=.94; }
  else if (/rent|lease/.test(n)) { action='rent_expense'; reason='Narration contains rent/lease indicators.'; confidence=.93; }
  else if (/gst|tax/.test(n)) { action='tax_payment'; reason='Narration contains tax indicators.'; confidence=.88; }
  else if (/invoice|inv\b|vendor|supplier/.test(n)) { action='purchase_candidate'; reason='Narration resembles a supplier/invoice payment.'; confidence=.82; }
  const requiresReview = confidence < .90 || risky.has(action);
  return { action, confidence, reason, evidence:[{sourceId:'transaction-input',sourceType:'BANK_OR_TRANSACTION',field:'narration',value:input.narration}], requiresReview };
}

export function buildMonthlyCloseChecklist(input: { unposted: number; unreconciled: number; gstExceptions: number; tdsExceptions: number; itrExceptions: number; balanceSheetBalanced: boolean }) {
  const checks = [
    { key:'unposted', ok:input.unposted===0, message: input.unposted===0?'All transactions posted':`${input.unposted} transactions remain unposted` },
    { key:'bank_reconciliation', ok:input.unreconciled===0, message: input.unreconciled===0?'Bank reconciliation complete':`${input.unreconciled} bank items remain unreconciled` },
    { key:'gst', ok:input.gstExceptions===0, message: input.gstExceptions===0?'GST exceptions clear':`${input.gstExceptions} GST exceptions need review` },
    { key:'tds', ok:input.tdsExceptions===0, message: input.tdsExceptions===0?'TDS exceptions clear':`${input.tdsExceptions} TDS exceptions need review` },
    { key:'itr', ok:input.itrExceptions===0, message: input.itrExceptions===0?'ITR exceptions clear':`${input.itrExceptions} ITR exceptions need review` },
    { key:'balance_sheet', ok:input.balanceSheetBalanced, message: input.balanceSheetBalanced?'Balance sheet balances':'Balance sheet does not balance' }
  ];
  return { ready: checks.every(c=>c.ok), checks };
}

export function explainDecision(decision: AgentDecision): string {
  return `${decision.action}: ${(decision.confidence*100).toFixed(0)}% confidence. ${decision.reason} ${decision.requiresReview?'Human review required before posting or filing.':'Eligible for controlled automation subject to domain validation.'}`;
}
