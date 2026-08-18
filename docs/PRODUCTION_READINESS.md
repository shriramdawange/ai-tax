# AI TAX — Production Readiness

## Current product boundary

AI TAX is an application platform for accounting, reconciliation, GST/TDS/ITR preparation and controlled compliance workflows. Production government submission is only enabled through an approved/credentialed provider adapter.

## Universal AI architecture

AI is provider-neutral. The application should expose one internal interface:

```text
AIProvider
  -> chat / structured extraction / classification / tool planning

Providers can include:
  OpenAI-compatible endpoint
  Gemini-compatible endpoint
  Anthropic-compatible endpoint
  Groq-compatible endpoint
  local Ollama endpoint
  deterministic fallback
```

The accounting and tax engines never depend on a particular model. AI proposes; domain services validate and commit.

## Required production controls

- tenant isolation on every query
- encrypted secrets and credential rotation
- immutable audit events
- idempotency keys for imports, tax calculations and submissions
- database transactions around financial mutations
- decimal/integer minor-unit money representation
- period locking
- role-based access control
- approval workflow for high-risk actions
- evidence links for every AI-generated proposal
- prompt/version/model provenance
- PII minimization and encryption at rest/in transit
- rate limits and abuse protection
- structured logging without PAN/Aadhaar/OTP/secrets
- backup and restore testing
- reconciliation before filing
- filing state machine with UNKNOWN/FAILED states
- never infer submission success from an HTTP timeout

## Filing state machine

DRAFT -> VALIDATING -> READY -> AUTHORIZATION_REQUIRED -> SUBMITTING -> SUBMITTED -> VERIFIED -> ACCEPTED

Failure states:

REJECTED, FAILED, UNKNOWN

Only an official provider response can move a filing into SUBMITTED/ACCEPTED. The UI must show the provider reference and acknowledgement where available.

## Government integration

Income Tax integration is implemented behind the ERI adapter boundary. The Income Tax Department documents ERI Type-2 API flows for login, add-client consent, prefill, validation/submission, e-verification and acknowledgement. Production access requires the appropriate registration, testing and approval/credentials.

GST integration is similarly isolated behind a provider/GSP adapter. No browser automation, credential scraping or fabricated government responses are part of this product.

## Tax-rule lifecycle

Rules are versioned by assessment/financial period. Never silently apply today's rule to historical records. Every calculation stores rule version, source-data fingerprint and calculation timestamp.

## Deployment target

Recommended production topology:

```text
CDN/WAF
  |
Web application
  |
API gateway
  |
Application services
  |--- PostgreSQL
  |--- Object storage
  |--- Queue/worker
  |--- AI gateway
  |--- Government adapters
```

Workers handle OCR, bank imports, reconciliation, report generation and filing jobs. User requests should remain short-lived and idempotent.
