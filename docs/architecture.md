# Architecture V0.1 — proposed AI modular service

## Principles

1. Keep AI a **bounded assistant**, not the authority for eligibility, pricing or clinical approval.
2. Verified identity and authorization **precede privileged AI operations**.
3. The full TPA backend owns source-of-truth policies, benefits, member status, claims and approvals.
4. The AI layer uses a **narrow allowlist of typed, audited tools**; no direct DB connection.
5. Tenant ID / member identity come from backend-verified claims, never LLM text or claimed tiers.
6. Query only minimum data required for the user question, not "load whole medical profile at chat start".
7. Start simple (modular monolith style service); split infrastructure by demonstrated need.

## Bounded contexts

| Context | Owner | Responsibility |
| --- | --- | --- |
| WhatsApp/app/portal adapter | Channels / backend team | Receive messages, map channel sessions, verified origin |
| Identity & access gateway | Backend/security team | Member identifier lookup, approved verification, session issuance/expiry, multi-tenant authorization |
| AI orchestration | AI team | Interpret intent, choose allowlisted read-only tools, craft grounded messages |
| LLM provider adapter | AI team | Provider SDK, model configuration, retries/budgets, safe serialization |
| Typed tool gateway | AI team + backend | Contract validation, backend service call, tool-specific policy checks and tracing |
| Policy/coverage engine | Backend/domain team | Deterministic authoritative coverage, co-pay, limits, preapproval state |
| Human escalation | Backend + operations | Doctor/employee approves or rejects; AI supplies summary only |
| Observability & evals | AI team + security | Redacted tracing, test sets, metrics, cost, audit mapping |

## Data / trust flow

`Channel -> Deterministic Identity Gateway -> Verified session -> AI service -> allowlisted tool -> Authorized TPA API -> deterministic engine -> validated response -> model explanation -> channel`

Before verification the gateway may provide generic public FAQs, but never protected member or policy details. OTPs are never forwarded to the model. Model gets **minimal non-sensitive context** and scoped tool outputs after authorization.

## Initial modules (code to be implemented when contracts are accepted)

- `channel`: normalize inbound messages; state transitions controlled by gateway.
- `orchestrator`: stateless request coordination, tool selection and safe responses.
- `providers`: one LLM provider SDK adapter, no abstraction factory maze.
- `tools`: Zod schemas and allowlisted implementations.
- `backend`: client for TPA REST contract with authenticated server-bound context.
- `evaluations`: deterministic and model-based evaluations with verified fixtures.
- `observability`: traces without PHI/PII; safe correlation IDs.

## Failure policy

- Authentication missing/expired -> ask to reverify; don't call privileged tools.
- Unknown benefit/service -> clarify exact service; do not guess code/coverage.
- Coverage API 404/409/503 -> honest, generic safe response; offer human handling; never invent approval.
- Ambiguous or untrusted uploaded document -> do not infer a clinical decision; request review.
- Model outage -> non-AI fallback responses for session and application errors where possible.

## Security details

See [`security-and-privacy.md`](security-and-privacy.md) and [`member-identity.md`](member-identity.md). Each backend API must enforce authorization even when invoked via internal service credentials; service-to-service authentication is not a replacement for user/tenant scope.

## Architectural decisions

Read [`decisions/0001-ai-boundary-and-identity.md`](decisions/0001-ai-boundary-and-identity.md) for the proposed identity and AI boundary, and [`decisions/0002-simple-typescript-service.md`](decisions/0002-simple-typescript-service.md) for stack direction. Both are provisional until core team confirmation.

The [V0.5 conversation experiment](decisions/0004-bounded-conversational-composition.md) adds a provider-neutral inference port to the verified synthetic demo. TPA owns session state, proposal validation, the read-only policy lookup and approved response rendering.
