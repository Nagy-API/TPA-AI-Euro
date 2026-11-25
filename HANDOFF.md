# Current handoff — TPA AI Euro (2026-11-25)

**Manual Web Chat checkpoint:** The reported conversation passed in the verified browser using the installed local Ollama model. Read the [baseline trace, regression results and Astra findings](docs/v04-qa2-diagnostics.md#nagy-manual-web-chat). The branch remains the sole change target for [Draft PR #19](https://github.com/Nagy-API/TPA-AI-Euro/pull/19). The manual replay is a disclosed regression. Fresh independent acceptance and Nagy's merge approval remain pending.

**V0.4 review checkpoint:** [Issue #17](https://github.com/Nagy-API/TPA-AI-Euro/issues/17) is implemented for the local synthetic demo on `codex/v04-grounded-conversation`, based on live `main` at `c5c5f4eedb5a8c9fc8ad5a9c6c089b47ca89786c`. Read the [observed conversations and evidence](PROJECT_STATUS.md#v04-grounded-conversation--issue-17). Review the Draft PR and remaining semantic risk before any merge. The approved workflow is fixture-default and free-first.

**Next QA — GPT-6.2 Sol, High reasoning.** Use the frozen head of [Draft PR #19](https://github.com/Nagy-API/TPA-AI-Euro/pull/19). Verify its SHA, local model digest and exclusive GPU window. Independently author an unseen synthetic multi-turn suite with fixed expectations and keep the prompts private until the first run ends. The 30 Issue #18 cases are disclosed regressions. Exercise the verified HTTP flow and record useful replies, required/actual lookup and scope, topic, refusal, failure handling, and p50/p95. Apply the existing ≥90% recall/usefulness and zero wrong or unauthorized lookup gates. Report first-run results without editing or tuning the frozen implementation. Keep the PR Draft pending Nagy's review.

**Response usefulness revision:** Both 30-scenario QA suites are disclosed. Read the [turn-level diagnosis](docs/v04-qa2-diagnostics.md) for the reviewed head's ten incomplete QA2 scenarios and the current replay. A short-lived referral has no lookup authority. If comparing another already-installed model, keep implementation, settings and cases fixed, and measure first-pass interpretation and grounding separately from scoped backend lookup recall. Independent acceptance is outstanding.

**Current checkpoint:** Nagy approved [PR #16](https://github.com/Nagy-API/TPA-AI-Euro/pull/16), and the V0.3 local Ollama PoC is now **merged into `main`** at `b44596071798aeee1fac6e1162022754e8185c81`. Start future work from verified live `main`, not the historical feature branch. The canonical checkout is the root `TPA-AI` folder. Preserve the historical agent folders and archive pending separate cleanup approval.

- Reproduce with [local Ollama setup](README.md#run-with-local-ollama-synthetic-demo) and the [evaluation runbook](docs/evaluation-runbook.md#local-ollama-evaluation). The installed `qwen3:4b-instruct` performed tool calling and the verified browser/HTTP flow passed. Fixture mode stays default.
- Check the [PR #16 service-grounding evidence](PROJECT_STATUS.md#pr-16-service-grounding-review). The exposed H-12 still produced a CBC proposal but now clarifies with zero lookups. The fresh holdout observed zero wrong-service or unauthorized lookups and 11/12 correct required lookups. Review the remaining recall and third-party wording limits. The PR was approved for **local synthetic PoC only**, merged, and is no longer Draft.

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

## V0.3 completed — where to resume

- Live evidence at merge: PR #16 merged, GitHub `test` and `validate` both passed on `main` merge commit `b44596071798aeee1fac6e1162022754e8185c81`. Later documentation commits need their own checks.
- **Local tryout:** run `ollama list` and verify `qwen3:4b-instruct`, then from canonical root `TPA-AI` start Node demo with `ENABLE_DEMO_AUTH=true`, `DEMO_AUTH_MODE=verified`, `DEMO_INTENT_MODE=ollama`, `OLLAMA_MODEL=qwen3:4b-instruct`; open `http://127.0.0.1:3000/demo`. The browser is a diagnostic UI. Fixture mode is still the default if Ollama mode isn't explicitly selected.
- **Known limitation:** one valid CBC paraphrase failed safe with clarification. Fresh 24-case holdout yielded 11/12 correct required lookups and zero wrong-service/unauthorized lookups on measured cases, not proof of clinical/production accuracy. Do not chase arbitrary regex rules to fit known test sets.
- **Other dependencies:** Core Backend/TPA contracts [Issue #9](https://github.com/Nagy-API/TPA-AI-Euro/issues/9) remain deferred. No real member records, real coverage or live Meta/WhatsApp. No paid APIs used. Workspace cleanup [Issue #14](https://github.com/Nagy-API/TPA-AI-Euro/issues/14) remains separate.
