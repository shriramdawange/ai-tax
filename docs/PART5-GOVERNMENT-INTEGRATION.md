# Part 5 — Government Integration & Production

## What is implemented

AI TAX now has a provider-neutral compliance gateway with:

- filing package hashing
- filing lifecycle/state machine
- validation stage
- authorization gate
- submission stage
- verification stage
- acknowledgement stage
- explicit failure/rejection/unknown states
- adapter interface for official providers
- safe sandbox adapter
- compliance API
- Part 5 dashboard

## Critical production rule

The repository does **not** pretend to have government production access. The sandbox adapter intentionally refuses real submission. Production credentials, onboarding, certification/testing and approved integration access must be configured before a production adapter is enabled.

## Income Tax / ERI

The Income Tax Department documents an ERI API ecosystem. The published specifications describe Type-2 ERIs as tax software providers that can use APIs for return preparation/submission. The documented flow includes login/session establishment, adding clients with taxpayer consent, prefill, validation/submission, e-verification and acknowledgement retrieval.

The official specification also states that API requests are signed and that production API access follows the department's registration/testing/approval process. Therefore AI TAX exposes an ERI adapter boundary rather than hard-coding credentials or browser automation.

## GST / GSP

GST connectivity must be implemented through the applicable official/authorized GST integration route and credentials. The GST adapter boundary is intentionally separate from accounting/GST computation so provider changes do not require rewriting the tax engine.

## Filing state machine

DRAFT -> VALIDATING -> READY -> AUTHORIZATION_REQUIRED -> SUBMITTING -> SUBMITTED -> VERIFIED -> ACCEPTED

Terminal/error states:

- REJECTED
- FAILED
- UNKNOWN

UNKNOWN is deliberately preserved. A network timeout must never be interpreted as a successful filing.

## Production checklist

1. Obtain the required intermediary/provider authorization.
2. Complete sandbox/API testing and approval where required.
3. Store credentials in a secret manager, never source code.
4. Implement provider-specific request signing/encryption.
5. Map the exact current government schemas and validation rules.
6. Add idempotency keys and retry policies that cannot duplicate a filing.
7. Persist external reference IDs and acknowledgements.
8. Add reconciliation between our state and provider state.
9. Add immutable audit records for every authorization/submission action.
10. Run end-to-end certification tests before enabling production.

## Non-goals

- CAPTCHA bypass
- browser scraping as a substitute for official APIs
- storing taxpayer OTPs/passwords in plaintext
- claiming a filing is accepted without a provider acknowledgement
- allowing an LLM to directly mutate tax or accounting state
