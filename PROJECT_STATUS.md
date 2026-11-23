# TPA AI Euro — Project Status (source of truth)

**Updated:** 2026-11-23  
**Repository:** [Nagy-API/TPA-AI-Euro](https://github.com/Nagy-API/TPA-AI-Euro) — **PUBLIC**  
**Default branch:** `main`  
**Current milestone:** Offline member onboarding + coverage inquiry **MERGED**, V0.1 demo only

## V0.2 offline coverage follow-ups

- [Issue #8](https://github.com/Nagy-API/TPA-AI-Euro/issues/8) is implemented on `feat/offline-conversation-state`, based on verified `origin/main` at `2162373b166205ce6af00f4e8af318a280bb76fc`.
- One topic per current fictional tenant/member session (at most three across this demo), with a fixed two-minute lifetime capped by session expiry. Context stores only the synthetic service code and expiry. The verified session is checked before intent selection and backend lookup and again before returning coverage. Every successful follow-up uses a fresh, validated mock response.
- `npm test`: 60/60 passed on Node 24.14.1. `npm run docs:check`: passed. `npm run eval:cases`: listed 14 synthetic intent fixtures. Strict TypeScript 5.9.3 checking passed for `src`, `scripts` and `tests` using Node 22.19.17 typings, `--noEmit --strict --target ES2022 --module NodeNext --allowImportingTsExtensions --types node` and the local typings directory.
- Local regressions cover Gold MRI co-pay, a changed backend result after failure, wrong-service results, Silver/VIP isolation, explicit service changes, clarification, topic expiry, invalid sessions, rotation, logout and in-flight revocation.
- Follow-up phrases are a narrow Arabic/English co-pay allowlist. Expiry is enforced on access, with bounded, process-local storage that resets on restart. Real identity, policy coverage, model behavior, and production security remain unverified.

## Verified integration / merge evidence

- [x] Reviewed source code/diffs, identity/tenant/tool boundaries and current tracked files for common credential formats; no recognized key patterns found in the checked current tree. This is **not** a complete security/secret-history audit.
- [x] Offline authentication demo, synthetic scoped sessions, deterministic coverage answers, validation and regression tests integrated via [PR #7](https://github.com/Nagy-API/TPA-AI-Euro/pull/7). Integration merge commit: `6a0a65dae3ea5115df9c2facb68060caeb3cfe23`.
- [x] Feature delivered into `main` by [PR #1](https://github.com/Nagy-API/TPA-AI-Euro/pull/1), squash merge commit: `aec8b58f2ef9cea806b10157a34d067a5370b3b6`.
- [x] GitHub-hosted Node unit/HTTP tests and docs validation **both passed on the PR #1 head and on the resulting `main` merge SHA**. Historical runner billing failure resolved after the repository became public; see [CI diagnostics](docs/ci-diagnostics.md).
- [x] Integration Agent's local evidence: `npm test` 53/53 passed on Node 24.14.1; strict TypeScript check passed using TS 5.9.3 and Node typings; docs validator passed; synthetic localhost E2E tested Gold/Silver/VIP, wrong/expired/replayed OTP, cross-tenant protection, logout and generic failures. These are local-agent results, **not** proof of production use.
- [x] Previous PR #4 (offline QA) and PR #5 (member verification) changes included in PR #7; source PRs closed as incorporated, without branch deletion.

## Running code on main

- Local-only `POST /v1/member-auth/challenges` and `.../{challengeId}/verify` with **public synthetic test codes** and process-local limits.
- Local-only `POST /v1/chat` requires verified demo session and returns policy-engine **mock** coverage for MRI / CBC / XRAY. `GET /health` and logout endpoint are included.
- Source of member/tenant is server-side session, never model text; the coverage response has runtime schema checks; all financial figures and policies are fictional.
- Default selector is deterministic offline keyword mapping, **not AI**. Claude adapter exists but live use and all paid providers remain **deferred** by Nagy.

## NOT implemented or verified

- Real OTP/identity provider, session persistence, production authorization, real TPA backend/CRM/policy engine, real patient information, live AI evaluation, WhatsApp integration, operational monitoring and production deployment.
- Regulatory/privacy/security approval, SLA/reliability testing and real medical/financial correctness.
- The repo has **never been approved for real customer data**. Public-to-private later cannot undo copies of historical public commits.

## Next steps (free-first)

1. Agree a versioned real identity/session and read-only coverage contract with Core Backend/domain owners; keep implementation synthetic until sign-off.
2. Build the next fully offline vertical slice, e.g. claims status or provider network lookup, after domain contract validation; add regression tests.
3. Review the V0.2 follow-up behavior and continue synthetic evaluations **without paid APIs**. Budget, model selection and data processing approval are future gates.

## Collaboration rules

Read [AGENTS.md](AGENTS.md) and [HANDOFF.md](HANDOFF.md): new Codex chat after completed task; one primary local folder; one writer/Git owner at a time for a shared working tree; every agent prompt specifies model + effort; review, test, report, then integrate. No unrelated destructive operations, production releases or changes to billing without explicit approval.
