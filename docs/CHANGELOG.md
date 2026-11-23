# Changelog

## 2026-11-22 — Bootstrap documentation (local only)

- Initial architecture, secure identity gate, API contract draft, handoff, roadmap and source notes.
- Mermaid diagrams for system, member verification, coverage inquiry and states/use cases.
- Draft synthetic fixture and evaluation scenarios.
- First-vertical-slice task breakdown, zero-dependency docs/fixture checker, and GitHub Actions docs workflow.
- Local validator executed successfully (not an application test).
- No application code, tests, backend integration or GitHub remote creation claimed.

> Append an entry for each meaningful merged change including files/feature, evidence, risks and relevant issue/PR if known.

## 2026-11-23 — First runnable coverage inquiry slice (feature PR, not production)

- Added Node.js TypeScript server, demo-only fixed-scope sessions, synthetic tier coverage fixtures, Claude tool-use intent selector and deterministic safe formatter.
- Added offline keyword selector expressly marked NON-AI to demonstrate flow without credentials.
- Added executable unit/HTTP tests; local evidence `npm test`: 16/16 passed; strict typecheck and docs validator passed; live curl local smoke passed.
- Pending: real Anthropic model call, domain API agreement, OTP authentication, production security review, human escalation and deployment.


## 2026-11-23 — Intent evaluation harness (PR #1 follow-up)

- Added 14 synthetic Arabic/English intent cases with exact expected tool selection and critical-case markers.
- Added zero-dependency evaluation runner (`npm run eval:cases`, `npm run eval:live`) and offline evaluation unit tests.
- Observed GitHub Actions Jobs report `runner_id=0`, `steps=[]`, and failure within seconds; suspect scheduling/account runner issue, but root cause remains unverified without GitHub UI annotation/logs. No workflow YAML changed.
- Live Anthropic API not called (no key in local environment).

## 2026-11-23 — Free-first development / no external API costs

- Decided to defer all paid LLM and hosted integrations until Nagy explicitly authorizes budget.
- Introduced runtime coverage boundary validation and offline-by-default selector factory with double opt-in for paid provider mode.
- Added regression tests for invalid backend coverage, bad numeric values, mismatch of service or provenance, and accidental paid mode.
- Local validation evidence: 32/32 tests, strict local TypeScript check, docs sanity checker, health 200 / GOLD MRI 200 / unauthenticated 401 smoke.
- Draft PR #1 remains unmerged. CI failure before GitHub runner steps unresolved; do not mark green.

## 2026-11-23 — Parallel agent milestone / integration planning

- Verified remote Draft PR #4 (offline QA, 5 tests added) and Draft PR #5 (fictional member verification flow, 16 tests added), both pending integration and review into baseline feature PR #1.
- Recorded GitHub Actions check annotation indicating payment failure or spending-limit restriction before runner allocation; no hosted green CI and no charges approved.
- Established next Integration task in Issue #6 and permanent Nagy workflow rules: new Codex chat per completed task, one primary local project folder and one Git writer at a time, explicit model/effort choice per prompt, continued zero-paid-API work.

## 2026-11-23 — Offline member journey integration draft

- Combined PR #4's contract tests and CI diagnosis with PR #5's mock member verification on top of the latest coverage base. The README now walks through identification, mock OTP, scoped chat and logout. Fixed tokens are an explicit legacy option.
- Verified locally on Node 24.14.1 with `npm test` (53/53), `python scripts/validate_repository.py`, and strict TypeScript 5.9.3. Loopback HTTP confirmed fixture-specific MRI responses, failed OTP, scoped access, logout, expiry with an injected clock, and generic backend 503s. See [Project Status](../PROJECT_STATUS.md#integration-verification--2026-11-23).
- Hosted Actions runner allocation remains blocked by GitHub's payment/spending-limit restriction. Live TPA and LLM integrations and real OTP remain unverified. The integration candidate is for review under [Issue #6](https://github.com/Nagy-API/TPA-AI-Euro/issues/6).

## 2026-11-23 — GitHub Actions started and passed after public visibility change

- Nagy switched `Nagy-API/TPA-AI-Euro` from private to public. Verified visibility on GitHub. Avoid committing sensitive material.
- Re-ran the two previously blocked workflows at integration commit `d29fd184d968b72a7bf03485968555a626e48092`: Node offline tests [run 45137965791](https://github.com/Nagy-API/TPA-AI-Euro/actions/runs/45137965791) attempt 2 **success**; docs validator [run 45137965890](https://github.com/Nagy-API/TPA-AI-Euro/actions/runs/45137965890) attempt 2 **success**. Previous billing/spending-limit startup error no longer reproduced.
- Draft PR #7 remains pending review; main and production remain unchanged.

## 2026-11-23 — Nagy-approved first offline demo merged into main

- Reviewed complete synthetic member verification/coverage flow, tool scoping, validation, tests and documentation; checked current tracked tree for common committed secret formats (limited pattern scan; not a full historic secret audit).
- Merged [PR #7](https://github.com/Nagy-API/TPA-AI-Euro/pull/7) into `feat/coverage-inquiry-v1`, merge SHA `6a0a65dae3ea5115df9c2facb68060caeb3cfe23`.
- GitHub-hosted tests and docs validation both passed on the updated feature tip.
- Squash-merged [PR #1](https://github.com/Nagy-API/TPA-AI-Euro/pull/1) into `main`, SHA `aec8b58f2ef9cea806b10157a34d067a5370b3b6`. Both GitHub workflows passed on this main commit.
- Closed redundant source PR #4 and PR #5 with explanatory comments; their changes are already in the merged integration. No branch deleted; no deployment or paid API use.
- Updated source-of-truth status, handoff and roadmap. Only fictional mock data and offline selector work; production integration and true LLM behavior remain unverified.

## 2026-11-23 — V0.2 offline coverage follow-ups

- Added a two-minute, session-scoped topic for [Issue #8](https://github.com/Nagy-API/TPA-AI-Euro/issues/8). One synthetic service code and expiry let a verified member ask a narrow co-pay follow-up. Each lookup reads fresh mock coverage and validates the response.
- Clarification clears an ambiguous or unrelated topic. Session expiry, rotation, revocation and logout invalidate it. Existing chat and auth payloads and legacy single-turn behavior are compatible. The offline rules are **NOT a real LLM**.
- Local verification on Node 24.14.1 passed all 60 tests, docs validation and strict TypeScript 5.9.3 checking. The offline evaluation preview listed 14 synthetic cases.
- Opened [Draft PR #10](https://github.com/Nagy-API/TPA-AI-Euro/pull/10) against `main` with implementation commit `cca12953a61dd9a237b00855683cc75102b2d66f`.

## 2026-11-23 — V0.2 approved, merged, and paused

- Nagy authorized review and merge of [PR #10](https://github.com/Nagy-API/TPA-AI-Euro/pull/10) for offline conversation context. Reviewed scope/negative tests, merged into `main` at `a5edbec7d908f3bfd9e3e88a9415e2241e076649`.
- PR #10 checks passed on head `058ee88bc9f550c128e98aaf3a1c6e8be66d0a37`; 60/60 tests were agent-reported locally. Main checks must be verified per subsequent commit.
- Explicit project decision: **pause speculative AI feature work**. Backend/TPA contract [Issue #9](https://github.com/Nagy-API/TPA-AI-Euro/issues/9) remains deferred; paid LLM, live data and channels remain out of scope until approved.
- Updated status, handoff, roadmap and README to support future chat/agent continuity. No production release, secrets, healthcare data or paid API calls.
