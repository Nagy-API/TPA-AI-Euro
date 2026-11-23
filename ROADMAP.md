# Roadmap — learn and build in parallel

This is a **sequence of milestones, not duration or delivery commitment**. Scope is adjustable after domain validation. Every milestone has evidence-based acceptance criteria.

## Milestone 0 — Architecture & collaboration bootstrap

- [x] Repo-ready docs, diagrams, tool contracts and working rules.
- [x] Private GitHub remote created (`Nagy-API/TPA-AI-Euro`, `main`); initial README commit confirmed.
- [ ] Publish the complete 31-file architecture scaffold and verify remote commit.
- [ ] Product/TPA owner validates domain assumptions and non-goals.
- [ ] Backend team aligns on identity/session and coverage API.

**Done when:** remote exists with verified branch/SHA; open decisions recorded; aligned API contract versioned.

## Milestone 1 — Deterministic Identity Gateway (demo with synthetic members)

- [ ] Channel adapter distinguishes unauthenticated vs verified sessions.
- [ ] Member identification calls mock trusted backend (no model involved).
- [ ] OTP challenge/verification stub explicitly marked DEMO ONLY.
- [ ] Correct session scoping to member + tenant + expiry.
- [ ] Invalid ID, invalid OTP, expired/blocked session, brute-force/anti-enumeration test cases.

**Done when:** no protected member data or privileged tool available before successful verification. Real OTP provider not required for demo; cannot call this production authentication.

## Milestone 2 — First AI vertical slice: coverage inquiry

- [ ] One provider SDK and model behind small adapter (provider choice recorded).
- [ ] Typed `get_member_coverage` read-only tool; member resolved from trusted session, never from model input.
- [ ] Mock coverage records for VIP, GOLD, SILVER and excluded/unknown services.
- [ ] Arabic question maps to service code or asks clarification if ambiguous.
- [ ] Tool output grounding, safe uncertainty, request logging without PII.
- [ ] Evals: correct, excluded, preapproval, missing, API outage, cross-member and prompt injection.

**Done when:** tested response matches verified tool result, not self-generated insurance decisions.

## Milestone 3 — Integration & reliability

- [ ] Real backend sandbox contract validation; token/session policy agreed.
- [ ] Rate limits, timeouts, schema validation, retries for safe idempotent reads, error handling.
- [ ] Conversation state management, redacted tracing, cost/latency metrics.
- [ ] Human handoff for unclear/high-risk cases; integration and regression tests.

**Done when:** working sandbox demo with reproducible tests and explicit unverified caveats.

## Milestone 4 — AI document intake (only after priority confirmation)

- [ ] Opt-in upload, consent and minimum necessary file handling.
- [ ] Vision/OCR extraction with field confidence and human correction.
- [ ] Doctor-facing structured summary with source links; no autonomous clinical decision.
- [ ] Prompt injection and harmful document content evaluations.

## Milestone 5 — Version 2 candidates (not committed)

- [ ] RAG for approved versioned policy documents where rule API alone is insufficient.
- [ ] Provider search and claims status read-only tools.
- [ ] Analytics/anomaly triage under separate design and review.
- [ ] Model routing/cost optimization based on evaluation evidence.

## Parallel learning map

- While building Milestone 1: HTTP auth, sessions, tenant authorization, privacy and mocks.
- While building Milestone 2: LLM messages, tokens, tool calling, structured outputs, evals.
- While building Milestone 3: observability, retries, reliability, prompt injection, integration testing.
- While building Milestone 4: OCR/Vision, extraction uncertainty, clinically safe human-in-the-loop.

## Versioning / scope discipline

Document incremental improvements as GitHub Issues. "Ship V1 fast" means **small scope**, not bypassing basic authorization, security, maintainability or tests. Feature flags and versioned contracts are preferred over hidden hacks.

## Implementation note — 2026-11-23

On feature branch `feat/coverage-inquiry-v1`, a **synthetic** session resolver and mock coverage API are implemented, along with Claude intent tool selection, offline non-AI selector and local tests (16 passing). This does **not** complete Milestone 1 production authentication, Milestone 2 live provider evaluation or Milestone 3 integration. Review feature PR and verify CI before checking off acceptance boxes above.

## Execution strategy update — 2026-11-23 (free-first)

- [x] Make the demo **offline by default** and explicit-only opt-in for external paid LLM API.
- [x] Add runtime validation of untrusted coverage responses and negative-case tests.
- [x] Expand offline regression coverage for missing/expired sessions, scoped member/tenant access, and invalid backend results. The combined candidate passed `npm test` 53/53.
- [ ] Agree identity and coverage contracts with the Core Backend team (no production data or LLM needed).
- [x] Verify the fictional onboarding and coverage journey over localhost with Gold, Silver and VIP fixtures, failed verification, logout and enforced member scope.
- [ ] Revisit live LLM provider choice and budget **only when Nagy approves spending**. No commitment to Claude/DeepSeek/OpenAI now.

**Do not equate offline keyword matching with real AI quality.** No production claims or third-party integrations are validated.

The integration candidate is pending Nagy's review. [Local verification](PROJECT_STATUS.md#integration-verification--2026-11-23) includes docs validation, strict TypeScript, expiry and safe backend errors. Hosted CI remains blocked by GitHub's payment/spending-limit restriction. Real TPA contracts and live model evaluation remain open.
