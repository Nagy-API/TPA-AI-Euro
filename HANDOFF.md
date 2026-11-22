# Handoff — TPA AI Euro workstream

## Mandatory reading for a new chat or coding agent

Start with `README.md`, `AGENTS.md`, `PROJECT_STATUS.md`, `ROADMAP.md`, `docs/architecture.md`, `docs/api-contracts.md`, and relevant code/tests. Check **live** GitHub branch, SHA, PR and CI before making changes; docs may lag. Address Nagy in Egyptian Arabic, explain design trade-offs, build while teaching; never claim execution without evidence.

## Project identity

- Private GitHub repository: `Nagy-API/TPA-AI-Euro`, default branch `main`.
- Main baseline before implementation: `8c526e2398f84cb77d457ec0a7d971d9fa6036d0`.
- First implementation branch: `feat/coverage-inquiry-v1`.
- Feature commit SHA and PR number: populate after GitHub push; never fabricate.
- Scope: AI layer only, not full TPA core/claims/eligibility engine.

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
