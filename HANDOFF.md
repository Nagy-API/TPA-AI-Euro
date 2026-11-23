# TPA AI Euro — Handoff for next chat / Codex agent

**As of:** 2026-11-23. Read this file, `README.md`, `AGENTS.md`, `PROJECT_STATUS.md`, `ROADMAP.md`, `docs/architecture.md` and `docs/api-contracts.md` before making changes. Re-check GitHub live HEAD, status, CI and working tree; these notes can become stale.

## Project identity and state

- Repository: [Nagy-API/TPA-AI-Euro](https://github.com/Nagy-API/TPA-AI-Euro), **PUBLIC**, default `main`.
- First offline member verification + coverage demo **merged into `main`** by [PR #1](https://github.com/Nagy-API/TPA-AI-Euro/pull/1) at commit `aec8b58f2ef9cea806b10157a34d067a5370b3b6` (this is the approved feature baseline, not necessarily the live HEAD).
- Integration PR #7 was merged into `feat/coverage-inquiry-v1` at `6a0a65dae3ea5115df9c2facb68060caeb3cfe23`, then PR #1 squash-merged the feature to `main`. Source PRs #4 and #5 were closed as incorporated; their branches were not deleted.
- Hosted GitHub Actions tests and docs **passed on the original `main` feature-merge commit**. The historical billing/spending-limit runner startup restriction was resolved by Nagy's change to Public.
- Integration agent reports 53/53 local tests on Node 24.14.1; synthetic localhost E2E, strict TypeScript check and docs validator passed. No live clinical/insurance system tested.

## Current review — V0.2 offline coverage follow-ups

- See [Issue #8](https://github.com/Nagy-API/TPA-AI-Euro/issues/8) and `feat/offline-conversation-state`. Verify a fictional member, ask about MRI, then send «وطب نسبة التحمل كام؟» with the same session header.
- The offline selector is **NOT a real LLM**. It resolves a narrow co-pay follow-up using one synthetic service code per active session for up to two minutes. Logout, revocation, rotation and expiry invalidate the topic. Coverage and financial values come from a fresh, validated mock backend lookup.
- Local V0.2 evidence: `npm test` **60/60**, `npm run docs:check` passed, `npm run eval:cases` listed **14** synthetic fixtures, and strict TypeScript passed. See [Project Status](PROJECT_STATUS.md#v02-offline-coverage-follow-ups) for the compiler flags and typings.
- Review the draft before integration. Keep real identity, policy data, medical and financial decisions, paid model calls and production deployment outside this milestone.

## Architecture — nonnegotiable boundaries

- This repo owns **the AI layer** and its mock integration boundaries, NOT the full TPA platform.
- Deterministic identity gateway **before** protected AI conversation; member ID is an identifier, not proof of identity.
- Trusted server session supplies member/tenant scope; the LLM cannot override it. Core backend authorizes and calculates coverage; doctors own clinical decisions.
- Local demo uses fictional identifiers and *public fake OTP codes* with in-memory sessions. It is **not secure production authentication** and must remain loopback-only, disabled in production.
- Default selector is a **non-AI offline keyword matcher**. Live Claude adapter and paid provider calls are deferred until Nagy approves budget/privacy terms. No real TPA data, credentials or patient data may enter the public GitHub repo, source prompts or model calls.

## Next engineering objective

- Confirm with Core Backend and TPA/domain owners: member identifier / verification channel, tenant resolution, authorized `GET /members/me/coverage` semantics and service-code taxonomy.
- Build next free, synthetic feature with narrow typed contracts, meaningful negative tests and a Draft PR. Avoid external dependencies, microservice fragmentation or premature RAG/OCR.
- Run `npm test`, `python scripts/validate_repository.py`, `npm run eval:cases` and strict TS check if tooling present. Do not equate local tests with production readiness. Refer to current GitHub CI.

## Nagy's working agreement

- Address Nagy in natural Egyptian Arabic; lead technical decisions jointly, challenge risky shortcuts constructively, explain only what matters for the active task. Learn while building; no prerequisite lecture.
- Use a **new Codex chat for each completed task**, and read current repo state first. The user wants **one existing main project folder**; do **not** create sibling clones or worktrees without permission.
- Two Codex sessions with the same working tree must not write or change Git state concurrently. One writer at a time; second may review read-only.
- Every agent prompt should state preferred model and reasoning effort (normally visible `GPT-6.2 Sol — Medium`; High only for genuinely difficult security/architecture/debugging).
- No paid API, deployment, force push, branch deletion, production-data access or destructive operations without explicit user approval.
- For every completion, record changes, tests and their exact results, GitHub PR/SHA, unverified gaps and next action in the repo docs.

**Important:** Returning this repository from Public to Private later cannot erase copies already made while public. Never commit sensitive material, even to a private repository without approved controls.
