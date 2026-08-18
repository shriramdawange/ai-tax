import { Pool, PoolClient } from 'pg';

export type JournalLineInput = {
  accountId: string;
  partyId?: string;
  description?: string;
  debit?: number;
  credit?: number;
};

export type PostJournalInput = {
  organizationId: string;
  financialPeriodId: string;
  voucherNumber: string;
  voucherType: string;
  entryDate: string;
  narration: string;
  sourceType?: string;
  sourceId?: string;
  lines: JournalLineInput[];
};

export function validateJournal(lines: JournalLineInput[]): void {
  if (lines.length < 2) throw new Error('A journal requires at least two lines');
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    const d = Number(line.debit ?? 0);
    const c = Number(line.credit ?? 0);
    if (d < 0 || c < 0 || (d > 0 && c > 0) || (d === 0 && c === 0)) {
      throw new Error('Each journal line must contain either a positive debit or a positive credit');
    }
    debit += d;
    credit += c;
  }
  if (Math.round(debit * 100) !== Math.round(credit * 100)) {
    throw new Error(`Journal is unbalanced: debit ${debit.toFixed(2)} != credit ${credit.toFixed(2)}`);
  }
}

export async function postJournal(pool: Pool, input: PostJournalInput): Promise<string> {
  validateJournal(input.lines);
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const period = await client.query(
      `SELECT status FROM financial_periods WHERE id=$1 AND organization_id=$2 FOR UPDATE`,
      [input.financialPeriodId, input.organizationId]
    );
    if (!period.rowCount) throw new Error('Financial period not found');
    if (period.rows[0].status !== 'OPEN') throw new Error('Financial period is not open');

    const totals = await client.query(
      `SELECT COALESCE(SUM(debit),0) debit, COALESCE(SUM(credit),0) credit
       FROM journal_lines jl JOIN journal_entries je ON je.id=jl.journal_id
       WHERE je.organization_id=$1 AND je.voucher_number=$2`,
      [input.organizationId, input.voucherNumber]
    );
    if (Number(totals.rows[0].debit) !== 0 || Number(totals.rows[0].credit) !== 0) {
      throw new Error('Voucher number already exists');
    }

    const entry = await client.query(
      `INSERT INTO journal_entries
       (organization_id,financial_period_id,voucher_number,voucher_type,entry_date,narration,source_type,source_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [input.organizationId,input.financialPeriodId,input.voucherNumber,input.voucherType,input.entryDate,input.narration,input.sourceType ?? null,input.sourceId ?? null]
    );
    const journalId = entry.rows[0].id as string;
    for (const line of input.lines) {
      await client.query(
        `INSERT INTO journal_lines(journal_id,account_id,party_id,description,debit,credit)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [journalId,line.accountId,line.partyId ?? null,line.description ?? null,line.debit ?? 0,line.credit ?? 0]
      );
    }
    await client.query(
      `INSERT INTO audit_logs(organization_id,actor_type,action,entity_type,entity_id,after_data)
       VALUES($1,'SYSTEM','JOURNAL_POSTED','journal_entry',$2,$3)`,
      [input.organizationId,journalId,JSON.stringify(input)]
    );
    await client.query('COMMIT');
    return journalId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function trialBalance(pool: Pool, organizationId: string) {
  const result = await pool.query(
    `SELECT a.code,a.name,a.type,
      COALESCE(SUM(jl.debit),0)::numeric AS debit,
      COALESCE(SUM(jl.credit),0)::numeric AS credit
     FROM accounts a
     LEFT JOIN journal_lines jl ON jl.account_id=a.id
     LEFT JOIN journal_entries je ON je.id=jl.journal_id AND je.status='POSTED'
     WHERE a.organization_id=$1
     GROUP BY a.id ORDER BY a.code`,
    [organizationId]
  );
  return result.rows;
}
