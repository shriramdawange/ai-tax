# AI TAX — System Architecture

## Core flow

```text
Business data
  -> ingestion
  -> normalized financial events
  -> deterministic accounting engine
  -> ledger/reporting
  -> GST/TDS/ITR engines
  -> reconciliation
  -> compliance readiness
  -> official integration adapters
  -> authorization/submission
```

## Domain boundaries

### Accounting

Owns chart of accounts, journals, journal lines, ledger projections, periods and financial statements.

Invariant: every posted journal has equal total debit and credit.

### Documents

Owns uploaded source documents, OCR/extraction results and document-to-transaction links.

### Banking

Owns bank imports, normalized bank transactions and reconciliation matches. Imports must be idempotent.

### GST

Owns GST classifications, input/output tax records, ITC reconciliation and return preparation datasets. Rules are versioned and are not embedded in LLM prompts.

### TDS

Owns TDS applicability decisions, deductions, liabilities and return datasets. Rules are versioned.

### ITR

Owns taxpayer profile, tax computation inputs, form mapping and return preparation. Tax calculations are deterministic and versioned.

### Compliance

Owns readiness checks, exceptions, approvals, filing attempts and verified acknowledgements.

### AI

AI agents may interpret unstructured input, classify records, propose actions and explain results. They must use controlled tools and cannot directly mutate financial state without domain validation.

## Government integrations

Government-facing connectivity is isolated behind adapters. The application must never pretend a filing succeeded. States are explicitly tracked: DRAFT, VALIDATING, READY, AUTHORIZATION_REQUIRED, SUBMITTING, SUBMITTED, ACCEPTED, REJECTED, FAILED, UNKNOWN.
