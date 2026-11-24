# Current handoff — TPA AI Euro (2026-11-24)

**Current checkpoint.** [Issue #13](https://github.com/Nagy-API/TPA-AI-Euro/issues/13) is on `codex/ollama-coverage-intent` for architectural review. The canonical checkout is the root `TPA-AI` folder. Start future tasks from verified live GitHub `main`. Preserve the historical agent folders and archive.

- Reproduce with [local Ollama setup](README.md#run-with-local-ollama-synthetic-demo) and the [evaluation runbook](docs/evaluation-runbook.md#local-ollama-evaluation). The installed `qwen3:4b-instruct` performed tool calling and the verified browser/HTTP flow passed. Fixture mode stays default.
- Check the [measured results](PROJECT_STATUS.md#v03-local-ollama-review) before review. Local checks passed 77/77, strict TypeScript, and docs. The fixed model evaluation matched 19/21 and exposed a third-party intent miss. Cross-member isolation passed. Review that failure and the privacy filter's intentional clarification before approving any integration.

- Repo: [Nagy-API/TPA-AI-Euro](https://github.com/Nagy-API/TPA-AI-Euro), **PUBLIC**.
- Earlier offline V0.1 member verification and coverage demo merged as PR #1 (`aec8b58f2ef9cea806b10157a34d067a5370b3b6`).
- V0.2 offline session-scoped co-pay follow-ups merged as [PR #10](https://github.com/Nagy-API/TPA-AI-Euro/pull/10) (`a5edbec7d908f3bfd9e3e88a9415e2241e076649`). PR head `058ee88bc9f550c128e98aaf3a1c6e8be66d0a37` had 2/2 green GitHub Actions checks; agent reported 60/60 local tests. Check actual current `main` checks, including any documentation-only commit since then.
- The default assistant is **offline keyword matching**, NOT a real LLM. Real paid provider integration and evaluation deferred. OTPs, member IDs, tiers, coverage values and session data are fake and only for localhost demo. No actual TPA backend, DB, production identity, WhatsApp or medical workflow integration.
- [Issue #9](https://github.com/Nagy-API/TPA-AI-Euro/issues/9) contains proposed backend contract; user explicitly **DEFERRED** it until Core Backend / TPA domain availability. Do not infer its proposal is implemented.
- The bounded [Issue #11](https://github.com/Nagy-API/TPA-AI-Euro/issues/11) Web Chat changes merged via [PR #12](https://github.com/Nagy-API/TPA-AI-Euro/pull/12) at `752664ea34b0bce0f0ef2bedba2af3af3a42098f`. The [fixture run instructions](README.md#run-without-an-api-key-non-ai-offline-demo) remain available.
- Local evidence includes 63/63 Node tests, docs validation, 14 offline intent fixtures and strict TypeScript. Chrome verified Gold, Silver and VIP MRI follow-ups at desktop, tablet and mobile widths, plus invalid OTP, logout, retry after a synthetic HTTP 503, automatic session expiry and reload reset. See [Project Status](PROJECT_STATUS.md#local-web-chat-demo) for details.

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
