# Current handoff — TPA AI Euro (2026-11-23)

**CURRENT DECISION: PAUSE NEW FEATURE WORK AFTER V0.2.** Nagy asked for no speculative features or Codex prompts until real Core Backend/API agreements, permitted model/API access, or another confirmed requirement is ready. Start from live GitHub `main` and verify its HEAD, CI and issues. This file supersedes earlier draft-PR pending statements.

- Repo: [Nagy-API/TPA-AI-Euro](https://github.com/Nagy-API/TPA-AI-Euro), **PUBLIC**.
- Earlier offline V0.1 member verification and coverage demo merged as PR #1 (`aec8b58f2ef9cea806b10157a34d067a5370b3b6`).
- V0.2 offline session-scoped co-pay follow-ups merged as [PR #10](https://github.com/Nagy-API/TPA-AI-Euro/pull/10) (`a5edbec7d908f3bfd9e3e88a9415e2241e076649`). PR head `058ee88bc9f550c128e98aaf3a1c6e8be66d0a37` had 2/2 green GitHub Actions checks; agent reported 60/60 local tests. Check actual current `main` checks, including any documentation-only commit since then.
- The default assistant is **offline keyword matching**, NOT a real LLM. Real paid provider integration and evaluation deferred. OTPs, member IDs, tiers, coverage values and session data are fake and only for localhost demo. No actual TPA backend, DB, production identity, WhatsApp or medical workflow integration.
- [Issue #9](https://github.com/Nagy-API/TPA-AI-Euro/issues/9) contains proposed backend contract; user explicitly **DEFERRED** it until Core Backend / TPA domain availability. Do not infer its proposal is implemented.
- No additional feature tickets now. Reopen engineering only on a **concrete dependency or confirmed requirement**. See `PROJECT_STATUS.md`, `docs/api-contracts.md`, and `ROADMAP.md`.

## Collaboration rules (Nagy)

- Speak natural Egyptian Arabic, concise for simple questions; discuss trade-offs and teach while building. Lead architecture and decisions with Nagy; Codex executes narrowly scoped approved work.
- Start a **new Codex chat after each completed task**, but **do not start a new chat just to create work** when the project is paused.
- Use one existing local project folder; no adjacent/sibling clones or worktrees without Nagy's explicit approval. If two Codex clients share a physical Git working tree, only one can write/checkout/commit at a time.
- Every new agent prompt must specify recommended visible model and effort (default `GPT-6.2 Sol — Medium`; High only for real security/architecture complexity). Keep provider calls/WhatsApp/cloud paid work off until Nagy approves cost and privacy.
- Never force-push, delete branches, merge future PRs, deploy or modify GitHub billing/visibility without explicit Nagy approval. Keep real member records, credentials or patient data out of GitHub, even after any future return to Private.

## What to read before resuming

1. `README.md`, `AGENTS.md`, `PROJECT_STATUS.md`, `ROADMAP.md`.
2. `docs/architecture.md`, `docs/api-contracts.md`, `src/contracts.ts`, `src/demo-auth/**` and the current coverage + conversation code.
3. GitHub: live `main` SHA, latest CI, pending Issues/PRs. Record actual evidence, not assumptions. Scope tasks only after the dependency is real.
