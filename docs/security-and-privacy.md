# Security & privacy guardrails (non-negotiable)

## Threats in scope

- Guessable insurance ID used as unauthorized access; account enumeration during login.
- Cross-tenant / cross-member access (IDOR/BOLA); compromised provider/staff sessions.
- Prompt injection in chats, policy PDFs, prescriptions and tool outputs.
- Model hallucination of coverage, benefits, price or medical approval.
- Data leakage to LLM providers, application logs, analytics, tests and GitHub.
- Tool misuse, unbounded cost, rate abuse, repeated messages and retries.

## Controls by layer

**Channel/Identity:** approved challenge mechanism, rate limits, anonymous generic replies, secure session rotation, logout and re-verification, role separation; mobile/web can reuse trusted logged-in state.

**Backend APIs:** verified subject and tenant on every call; object-level authorization; deterministic policy engine; read-only AI tool scopes; service-to-service credentials rotated/secured externally; versioned responses; deny by default.

**AI layer:** strict tool allowlist and typed schemas, prompt/output separation, minimal context, no PII in model by default, guardrails before and after tool calls, safe handoff and fallback; never use LLM as auth/coverage oracle.

**Operations:** secure secret store and environment variables (never Git); redacted telemetry, retention periods, incident procedures, vendor DPA/data residency legal review, controlled access, privacy tests, budget/cost monitoring.

## Mandatory pre-production gates

- Dedicated threat model and privacy review, including cross-border processing conditions as applicable.
- Approved third-party data processors/provider contracts (if any).
- Penetration tests covering tenant boundaries, sessions and API misuse.
- Independently reviewed authorization rules, account enumeration checks, audit logging and verified session binding.
- Clinic/TPA review of all medical content outputs and unsafe escalation thresholds.

This doc is an engineering checklist, **not a legal opinion** or a claim of regulatory compliance.
