# AI TAX

Autonomous Indian accounting, GST, TDS and ITR compliance platform.

## Part 1 — Financial Core

Implemented: PostgreSQL financial model, FY seed data, chart of accounts, parties, invoices, double-entry journal engine, paise-level balancing, period controls, immutable posted journals, ledger, trial balance, P&L, balance sheet, compliance summary, audit log, dashboard and CI.

## Part 2 — Document + Banking Automation

Implemented in the repository:

- Source-document registry with SHA-256 deduplication
- Deterministic invoice/document text extraction provider
- Invoice number/date/GSTIN/PAN/party/taxable/GST/total extraction
- Extraction confidence and field-level provenance
- Bank CSV parser with quoted-field support
- Common Indian bank header normalization
- Debit/credit validation
- Idempotent bank-row hashing and duplicate detection
- Bank import batches and import error reporting
- Automatic bank-to-book reconciliation by amount/date
- Text/reference-assisted reconciliation confidence
- Matched vs suggested vs unmatched states
- Reconciliation history
- Automation summary endpoint
- Part 2 API routes mounted under `/api/part2`

### Part 2 API

```text
GET  /api/part2/banks
GET  /api/part2/banks/:bankId/transactions
POST /api/part2/banks/:bankId/import-csv
POST /api/part2/banks/:bankId/reconcile
GET  /api/part2/banks/:bankId/reconciliation
POST /api/part2/documents/extract
GET  /api/part2/documents
GET  /api/part2/documents/:id
GET  /api/part2/automation/summary
```

The document endpoint currently accepts machine-readable text. A binary PDF/image OCR provider is intentionally kept as a replaceable provider boundary rather than pretending regex extraction is OCR. That provider can be connected to a real OCR service in the production hardening phase.

## Run locally

Requirements: Docker Desktop.

```bash
git clone https://github.com/shriramdawange/ai-tax.git
cd ai-tax
docker compose up --build
```

Open `http://localhost:3000`.

To reset the demo database after schema changes:

```bash
docker compose down -v
docker compose up --build
```

## Architecture rule

AI interprets unstructured financial information and proposes actions. Deterministic domain engines calculate and persist accounting/tax values. Government filing is isolated behind official integration adapters and authorization gates. The application never fabricates a filing acknowledgement.

## Five-part build plan

1. **Financial core** — accounting, invoices, ledger, reports, auditability. **Done.**
2. **Document + banking automation** — document extraction, bank imports, BRS and matching. **Done.**
3. **GST + TDS engines** — versioned rules, reconciliation, GSTR-1/GSTR-3B and TDS preparation.
4. **ITR + AI Accountant** — tax computation, tax-data reconciliation and controlled AI agents.
5. **Government integrations + production hardening** — official GSP/ERI adapters, authorization, filing status, security, observability and deployment.

## Important

This is an actively developed compliance product. Actual government filing requires the relevant official integration access, credentials and taxpayer authorization.
