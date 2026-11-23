# Handoff — TPA AI Euro workstream

## Mandatory reading for a new chat or coding agent

Start with `README.md`, `AGENTS.md`, `PROJECT_STATUS.md`, `ROADMAP.md`, `docs/architecture.md`, `docs/api-contracts.md`, and relevant code/tests. Check **live** GitHub branch, SHA, PR and CI before making changes; docs may lag. Address Nagy in Egyptian Arabic, explain design trade-offs, build while teaching; never claim execution without evidence.

## Project identity

- **Public GitHub repository** (Nagy changed visibility 2026-11-23): `Nagy-API/TPA-AI-Euro`, default branch `main`. Never commit confidential content, credentials, or real patient data.
- Main baseline before implementation: `8c526e2398f84cb77d457ec0a7d971d9fa6036d0`.
- First implementation branch: `feat/coverage-inquiry-v1`.
- Feature commit SHA and PR number: populate after GitHub push; never fabricate.
- Scope: AI layer only, not full TPA core/claims/eligibility engine.

## Current handoff — offline integration candidate (2026-11-23)

- Start from `integration/offline-member-journey` in the existing `TPA-AI-Euro-agent-a` checkout. It includes both source PR commits on coverage tip `bd3406439`, with no conflicts. Keep PR #1, #4 and #5 open for Nagy's review of the integration draft.
- Reproduce the verified member workflow from the [root README](README.md). The fixture selector is offline and the challenge flow is the default. Use the explicit legacy mode only for the old fixed-token demo.
- Local evidence on Node 24.14.1: `npm test` **53/53**, `python scripts/validate_repository.py` passed, and strict TypeScript 5.9.3 passed. Live loopback HTTP verified fictional Gold, Silver and VIP outcomes, failed OTPs, logout and session scoping. The injected-clock HTTP check covered expiry and sanitized backend 503s. See [Project Status](PROJECT_STATUS.md#integration-verification--2026-11-23) for the typecheck command and results.
- Hosted Actions remain blocked before runner allocation by GitHub's payment/spending-limit restriction. Live TPA, real identity/OTP and model integrations remain unverified. Wait for Nagy's review before selecting a merge strategy or changing billing.

## Settled decisions

- Learn by implementing. Use small reviewable changes, architecture reasoning and evidence-backed tests; not a course before development.
- Identity must be verified outside the LLM; member ID alone isn't authentication. WhatsApp/phone account existence must not be exposed.
- Real TPA backend owns identity, coverage/policy rules, monetary values, eligibility, claims, approvals, authorization; medical decisions belong to doctors.
- The AI receives only minimum needed context and may request allowlisted tools, never direct DB access.
- V1 demo uses **fictional sessions and mock coverage**, not live OTP, CRM or policy backend.
- TypeScript + Node.js modular service, no unnecessary microservices, RAG or orchestration framework.
- Claude chosen only as **first provider integration experiment**, not exclusive/approved product standard.
- For now model handles intent classification + tool selection, deterministic formatter handles final answer; avoiding generated financial/coverage claims is intentional.
- Fixture mode is explicitly non-AI (`DEMO_INTENT_MODE=fixture`).

## Verified tests and implementation (local, not release)

`npm test`: 16/16 passed on Node 22.16.0 (native TypeScript stripping); `python scripts/validate_repository.py` passed; `tsc --noEmit ... --strict` locally passed with installed Node typings; HTTP curl smoke: synthetic Gold MRI result plus unauthenticated 401. Tests do **not** prove live Anthropic API compatibility or security.

## Primary files

- `src/contracts.ts` — typed demo contracts.
- `src/mock-backend.ts` — fixed synthetic sessions and mock policy engine.
- `src/claude-selector.ts` — single-service-code tool-use selector via Anthropic HTTPS.
- `src/demo-selector.ts` — deterministic non-AI offline selector.
- `src/coverage-assistant.ts` — gate, allowlisted tool, error handling, deterministic coverage response.
- `src/http-server.ts`, `src/index.ts` — loopback-only demo HTTP endpoint.
- `tests/` — 16 local unit/integration tests.

## Open dependencies and next steps

1. Review feature PR; do not merge/deploy without Nagy's approval.
2. Agree with TPA domain/backend engineers on source-of-truth coverage taxonomy, auth/session and API contracts.
3. Obtain an approved model + local API key in secret manager (never Git/chat), run synthetic Arabic model evals. Real-data provider/privacy clearance is not obtained.
4. Improve service-token/session architecture, rate limiting, response schema verification, redacted observability and sandbox integration prior to production.

## Agent collaboration rules

Respect `AGENTS.md`. Observe actual branch/status and collaborator edits. Prefer explicit scope, clean code, narrow tests, clear handoff. No secrets, patient data, unreviewed medical decisions, production changes, force pushes or destructive actions.


## 2026-11-23 addition: model evaluation harness

- `evals/intent-cases.json`: 14 fictional cases with expected single tool or clarification, critical cases labeled.
- `src/intent-evaluator.ts` and `scripts/evaluate-intents.ts`: offline report logic plus deliberate paid live Anthropic run (`npm run eval:live`). `npm run eval:cases` needs no key/network.
- No real provider call made; `ANTHROPIC_API_KEY` not present in local execution environment. Keep questions fictional and credentials outside Git.
- Initial CI failed before any visible runner steps (`runner_id=0`, `steps=[]`); logs unavailable. Need GitHub UI investigation rather than guessing YAML changes.

## 2026-11-23 decision: no spending yet

- Nagy explicitly deferred **all paid LLM API/subscription work**. Do not request credentials or run `npm run eval:live` unless he later authorizes cost.
- Default `ENABLE_DEMO_AUTH=true npm run dev` runs fixture keyword selector only (NOT AI) and mock TPA backend. Paid provider is **double-opt-in**: `DEMO_INTENT_MODE=claude` + `ALLOW_PAID_LLM=true` and credentials.
- Runtime validator `src/coverage-validation.ts` rejects invalid coverage backend data before any member-facing insurance reply, with regression tests.
- Local evidence: 32/32 tests passing, strict TS check and docs validation passing, HTTP 200/200/401 smoke. GitHub Actions failures still unresolved; no Merge/production deployment.
- This change is added to existing Draft PR #1; check live PR HEAD and CI before proceeding. Next: free offline business-flow and integration contract tests.

## 2026-11-23: Two Codex agents' work is ready for integration review

- PR #4 `test/offline-qa-ci` → `feat/coverage-inquiry-v1`: offline regressions and real GitHub Actions billing/spending-limit annotation diagnosis; head `3765e32c0b3328a2adba6c799e01c989d9ce7549`; agent reports 37/37 passing tests locally.
- PR #5 `feat/demo-member-verification` → `feat/coverage-inquiry-v1`: synthetic challenge+OTP+10-minute session+coverage route; head `6db4bc466572584a73a5f9ba4b82d5c252b3d7b0`; agent reports 48/48 passing tests locally. **Fixed OTP codes in docs are public fixtures; do not mistake for live OTP.**
- PR #1 is still Draft and unmerged into `main`. Neither PR #4 nor #5 merged; agent test totals are **not a combined integration result**.
- Next: [Issue #6](https://github.com/Nagy-API/TPA-AI-Euro/issues/6) — review/integrate with local full tests and accurate README; explicit Nagy approval required before merges.
- **Nagy's operating rules:** start a **new Codex chat** after each fully completed task; do not create more local project clone/sibling directories; if both Codex clients share one Git working tree, only one may edit/checkout/commit at a time. Every future prompt must specify preferred model and reasoning effort: `GPT-6.2 Sol Medium` for ordinary tasks, `High` selectively for tough security/architecture.
- User continues **free-first**: zero paid provider calls; CI blocked before runner starts by GitHub billing/spending-limit annotation; don't change billing or public visibility. Follow project `AGENTS.md`.

## 2026-11-23 hosted CI unblocked by repo visibility change

- Repo visibility is **public**, user-confirmed and verified against GitHub metadata. This supersedes earlier notes that private-repo GitHub Actions were blocked. Continue zero-spend/no paid AI API policy.
- On integration commit `d29fd184d968b72a7bf03485968555a626e48092`, GitHub Actions reruns succeeded: AI demo tests [run 45137965791](https://github.com/Nagy-API/TPA-AI-Euro/actions/runs/45137965791) (attempt 2, success); Docs and fixtures sanity [run 45137965890](https://github.com/Nagy-API/TPA-AI-Euro/actions/runs/45137965890) (attempt 2, success).
- A newly created documentation commit must get its own successful checks; don't imply earlier runs validate newer HEAD. Integration Draft PR #7 remains unmerged; no permission for merge or production deployment was given.
