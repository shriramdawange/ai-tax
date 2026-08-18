# AI TAX

Autonomous Indian accounting, GST, TDS and ITR compliance platform.

## Part 1 — Financial Core

The first full-stack milestone is now implemented in the repository:

- PostgreSQL financial data model
- Demo organization and FY 2026-27 seed data
- Chart of accounts
- Customers/vendors
- Sales/purchase invoice records with line items
- Double-entry journal engine
- Exact paise-level balance validation
- Financial-period locking checks
- Posted-journal immutability
- Ledger endpoint with running balance
- Trial balance
- Profit & loss calculation
- Balance-sheet summary
- GST/TDS preparation summary
- Audit log records
- Functional browser dashboard
- Journal posting UI
- Invoice creation UI
- Financial reports UI
- Compliance status UI
- TypeScript tests and GitHub Actions CI

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

1. **Financial core** — accounting, invoices, ledger, reports, auditability. **Current.**
2. **Document + banking automation** — OCR, invoice intelligence, bank imports, BRS and matching.
3. **GST + TDS engines** — versioned rules, reconciliation, GSTR-1/GSTR-3B and TDS preparation.
4. **ITR + AI Accountant** — tax computation, tax-data reconciliation and controlled AI agents.
5. **Government integrations + production hardening** — official GSP/ERI adapters, authorization, filing status, security, observability and deployment.

## Important

This is an actively developed compliance product, not a claim that government filing is already enabled. Actual filing requires the relevant official integration access, credentials and taxpayer authorization.
