import crypto from 'node:crypto';

export type FilingKind = 'GSTR1' | 'GSTR3B' | 'TDS' | 'ITR';
export type FilingStatus = 'DRAFT' | 'VALIDATING' | 'READY' | 'AUTHORIZATION_REQUIRED' | 'SUBMITTING' | 'SUBMITTED' | 'VERIFIED' | 'ACCEPTED' | 'REJECTED' | 'FAILED' | 'UNKNOWN';

export type FilingRecord = {
  id: string;
  kind: FilingKind;
  period: string;
  payloadHash: string;
  status: FilingStatus;
  attempts: number;
  acknowledgement?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdapterResponse = {
  accepted: boolean;
  status: FilingStatus;
  externalReference?: string;
  acknowledgement?: string;
  errorCode?: string;
  errorMessage?: string;
};

export interface GovernmentAdapter {
  readonly name: string;
  validate(kind: FilingKind, payload: unknown): Promise<AdapterResponse>;
  submit(kind: FilingKind, payload: unknown, authorization: { mode: string; token?: string }): Promise<AdapterResponse>;
  verify(kind: FilingKind, reference: string, authorization: { mode: string; token?: string }): Promise<AdapterResponse>;
  acknowledgement(kind: FilingKind, reference: string): Promise<AdapterResponse>;
}

export function payloadHash(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload, Object.keys(payload as object).sort())).digest('hex');
}

export function createFiling(kind: FilingKind, period: string, payload: unknown): FilingRecord {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), kind, period, payloadHash: payloadHash(payload), status: 'DRAFT', attempts: 0, createdAt: now, updatedAt: now };
}

export function canTransition(from: FilingStatus, to: FilingStatus): boolean {
  const graph: Record<FilingStatus, FilingStatus[]> = {
    DRAFT: ['VALIDATING'],
    VALIDATING: ['READY', 'FAILED'],
    READY: ['AUTHORIZATION_REQUIRED', 'SUBMITTING'],
    AUTHORIZATION_REQUIRED: ['SUBMITTING', 'FAILED'],
    SUBMITTING: ['SUBMITTED', 'REJECTED', 'FAILED', 'UNKNOWN'],
    SUBMITTED: ['VERIFIED', 'ACCEPTED', 'UNKNOWN'],
    VERIFIED: ['ACCEPTED', 'UNKNOWN'],
    ACCEPTED: [], REJECTED: [], FAILED: ['VALIDATING'], UNKNOWN: ['VALIDATING', 'SUBMITTING']
  };
  return graph[from].includes(to);
}

export function transition(record: FilingRecord, next: FilingStatus): FilingRecord {
  if (!canTransition(record.status, next)) throw new Error(`Invalid filing transition ${record.status} -> ${next}`);
  return { ...record, status: next, updatedAt: new Date().toISOString() };
}

/** Safe development adapter. It never claims a real government submission succeeded. */
export class SandboxGovernmentAdapter implements GovernmentAdapter {
  readonly name = 'sandbox';
  async validate(): Promise<AdapterResponse> { return { accepted: true, status: 'READY', externalReference: `SANDBOX-${crypto.randomUUID()}` }; }
  async submit(): Promise<AdapterResponse> { return { accepted: false, status: 'AUTHORIZATION_REQUIRED', errorCode: 'SANDBOX_ONLY', errorMessage: 'Configure an approved government/GSP/ERI adapter before production submission.' }; }
  async verify(): Promise<AdapterResponse> { return { accepted: false, status: 'UNKNOWN', errorCode: 'SANDBOX_ONLY', errorMessage: 'No real verification is performed by the sandbox adapter.' }; }
  async acknowledgement(): Promise<AdapterResponse> { return { accepted: false, status: 'UNKNOWN', errorCode: 'SANDBOX_ONLY', errorMessage: 'No government acknowledgement exists for sandbox filings.' }; }
}

export function authorizationRequired(kind: FilingKind): boolean {
  return kind === 'ITR' || kind === 'GSTR1' || kind === 'GSTR3B' || kind === 'TDS';
}
