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
