# First vertical slice — verified member coverage inquiry

**Target:** Demo-safe end-to-end path with synthetic data; not production access.

## Team division

| Responsibility | Owner | Dependency |
| --- | --- | --- |
| Session/OTP verification and member + tenant context | Core backend/security team | API contract and threat review |
| Business coverage, eligibility, benefit calculation | Core backend/domain team | Plan, service-code definitions |
| AI orchestration, provider SDK and grounded replies | Nagy's AI team | Trusted context + read-only coverage API |
| Mock identities, tool contract tests and AI evaluations | Nagy's AI team (shared review) | Synthetic domain fixtures |
| Approval/rejection of medical cases | Authorized medical operations | AI has **no** permission |

## V1 request lifecycle

1. Channel starts chat; **deterministic** gateway checks valid authenticated session.
2. If none, gateway requests agreed member identifier, triggers approved challenge (demo stub only initially), validates proof with Auth API and binds verified member+tenant scope.
3. A member asks a specific Arabic coverage question. AI gets a server-trusted session reference, not a raw personal identifier.
4. Model may select `get_member_coverage` with only a normalized service code. Ambiguous service => clarify.
5. Tool gateway validates the name and args, forwards a scoped request to Backend. Backend reauthorizes and policy engine calculates the result.
6. AI produces a concise Arabic answer grounded in the result. If unavailable/unknown, decline to guess and offer escalation.
7. Telemetry logs only non-sensitive correlation IDs, tool status, timing, model version and cost.

## Must-pass demo scenarios

- Existing verified GOLD member asking about MRI: display mock 20% co-pay, remaining EGP 5,000, requires preapproval; clarify this is **fake demo** data.
- Session absent/expired: no personalized answer or protected tool call.
- User says "I'm VIP": do not override server tier or tool result.
- Cross-tenant/member attempt: authorization denied by backend despite prompt.
- Unknown service code / API outage: safe clarification or escalation, never a made-up insurance decision.
- An instruction embedded in a tool response says to ignore safeguards: ignore as untrusted input.

## First engineering tasks (after GitHub remote exists)

- **Task A:** add a small TypeScript application skeleton only after validating team's runtime constraints; create Zod schemas and health check.
- **Task B:** mock Gateway and Coverage API from documented contracts; deterministic tests before LLM integration.
- **Task C:** add one LLM SDK with allowlisted read-only tool and run Arabic evals; capture measured results.

## Explicit V1 non-goals

Real OTP provider, claims settlement, autonomous approvals, all member records loaded into AI, vision/OCR, RAG, maps, fraud models, model fine-tuning and production deployment.

## Sign-off questions

- Is this onboarding valid across phone, app and portal?
- What is canonical unique member identifier per insurer/tenant?
- What codes are used for services; what is authoritative definition of coverage result?
- Does another team already implement verified sessions? If yes, integrate rather than duplicate.
