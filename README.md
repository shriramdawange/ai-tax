# AI TAX

AI-first Indian accounting, GST, TDS and ITR compliance platform.

## What works now

- Dockerized PostgreSQL development environment
- Multi-tenant-ready organization model
- Financial periods
- Chart of accounts
- Parties/customers/vendors
- Invoices and GST transaction model
- Deterministic double-entry journal engine
- Journal balancing invariant
- Ledger endpoint with running balances
- Trial balance
- Revenue/expense reporting
- GST preparation endpoints for GSTR-1 and GSTR-3B datasets
- TDS preparation endpoint
- Compliance summary
- Audit log foundation
- Functional browser dashboard
- Automated accounting unit tests

## Start locally

Requirements: Docker + Docker Compose.

```bash
docker compose up --build
```

Open `http://localhost:3000`.

The database is seeded with a demo business, chart of accounts, customer/vendor, invoice, GST transaction, TDS transaction and balanced accounting entries.

To reset the demo database:

```bash
docker compose down -v
docker compose up --build
```

## API examples

Health:

`GET /api/health`

Dashboard:

`GET /api/dashboard`

Trial balance is included in the dashboard response.

Prepare GSTR-1 dataset:

`POST /api/compliance/gstr1/prepare`

```json
{"from":"2026-08-01","to":"2026-08-31"}
```

Prepare GSTR-3B dataset:

`POST /api/compliance/gstr3b/prepare`

Prepare TDS dataset:

`POST /api/compliance/tds/prepare`

## Architecture principles

- AI interprets; deterministic engines calculate.
- Money uses PostgreSQL NUMERIC rather than floating point.
- Every financial/tax number must be traceable to source records.
- Posted journals are immutable; corrections use reversal/adjustment workflows.
- Government filing is isolated behind replaceable official integration adapters.
- The application never fabricates government responses or filing status.
- Sensitive filing actions require the authorization required by the official mechanism.

## Current status

The repository now contains a runnable Phase-1 vertical slice. The remaining production work is the document/OCR pipeline, real bank import/reconciliation, versioned GST/TDS/ITR rule libraries, authentication/tenant enforcement, AI provider integration, and official government filing adapters. Those integrations must use the current authorized government/GSP/ERI mechanisms and real credentials; they cannot be safely or honestly mocked as production filing.
