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

## 2026-11-23 — Local Web Chat for the synthetic demo

- Added the Arabic RTL browser journey and three public fictional accounts for [Issue #11](https://github.com/Nagy-API/TPA-AI-Euro/issues/11). The page reuses the existing verification, chat and logout APIs and is available in verified offline mode at `/demo` on loopback.
- Added HTTP tests for the page, assets, security headers and access gates. On Node 24.14.1, `npm test` passed **63/63**, `npm run docs:check` passed, `npm run eval:cases` listed **14** fixtures, and strict TypeScript 5.9.3 passed.
- Chrome verified Gold, Silver and VIP MRI and co-pay follow-ups, responsive desktop/tablet/mobile layouts, invalid OTP recovery, logout, reload reset, and automatic expiry and retry after an injected synthetic 503. See [Project Status](../PROJECT_STATUS.md#local-web-chat-demo).

## 2026-11-24 — Local Ollama intent selection for review

- Added opt-in Ollama intent selection for [Issue #13](https://github.com/Nagy-API/TPA-AI-Euro/issues/13), with a fixed loopback endpoint, local-model check, eligibility screening, exact tool validation and observable failures. The same Web Chat and mock coverage flow support both fixture and Ollama modes.
- Added simulated provider tests, verified scoping integration tests and an opt-in comparison across 21 synthetic cases. Local tests passed 77/77 with docs and typecheck. The real model matched 19/21 and the verified browser/HTTP flow passed. See [Project Status](../PROJECT_STATUS.md#v03-local-ollama-review) for timings and the two mismatches.

## 2026-11-24 — PR #16 architectural review follow-up

- Added application-side third-party refusal with topic clearing, more precise credential screening, and a bounded chat deadline that cancels Ollama on timeout, disconnect, or imminent session expiry. Existing exact co-pay follow-ups resolve in the authenticated session without inference.
- Re-ran the 29 supplied Issue #15 scenarios and a separate 16-case frozen holdout through verified HTTP. Recorded outcomes, proposal and lookup counts, latency and open issues in [Project Status](../PROJECT_STATUS.md#pr-16-architectural-review-follow-up).

## 2026-11-24 — Ground service selection before coverage

- Added a fail-closed service evidence check before policy lookups and topic storage. The check applies to model proposals for all three catalog services and handles common Egyptian Arabic paraphrases, conflicting evidence, and recognized third-party requests.
- The exposed dental-to-CBC case now clarifies despite the model's invalid service proposal. The fresh verified HTTP holdout recorded 11/12 correct required lookups and zero wrong-service or unauthorized lookups. See [Project Status](../PROJECT_STATUS.md#pr-16-service-grounding-review).

## 2026-11-24 — Ollama V0.3 approved and merged into main

- Nagy approved the bounded, synthetic, local-only model integration after architecture review. [PR #16](https://github.com/Nagy-API/TPA-AI-Euro/pull/16) squash-merged into `main`, SHA `b44596071798aeee1fac6e1162022754e8185c81`. No deployment, branch deletion or paid API calls.
- GitHub-hosted Node tests and docs validator passed on the resulting merge commit. Known limitation: first fresh 24-case grounding holdout yielded 11/12 required coverage lookups and 0 wrong/unauthorized lookups in those cases; the system clarified a valid CBC paraphrase.
- Updated root status/hand-off docs for merged local Ollama experiment and local-only browser trial. Real identity, policy APIs, WhatsApp, production hardening and broader model accuracy remain out of scope.

## 2026-11-24 — V0.4 grounded conversation draft

- Added explicit conversational intents and approved Egyptian Arabic replies for verified local Ollama chat. A scoped topic supports fresh copay, limit and preapproval lookups. The fixture selector stays the default.
- Distinguished unsupported procedures, missing fixture data and confirmed policy exclusions. Protected lookups require corroborated service evidence, and the server renders benefits from the validated policy result.
- Reproduced the reported Gold conversation in the existing Web Demo. Recorded test, model, tool and latency evidence, including the safe rehabilitation miss, in [Project Status](../PROJECT_STATUS.md#v04-grounded-conversation--issue-17).

## 2026-11-24 — V0.4 recall revision after independent QA

- Resolve positively identified catalog requests without requiring a second model vote. Retain corroboration for descriptive services and non-explicit follow-ups, and keep competing, unsupported and out-of-scope requests away from policy lookups.
- Keep a scoped, time-bounded pending benefit when asking which procedure the user meant. A later choice can complete that request. An active topic and pending clarification cannot coexist.
- Added exposed multi-turn HTTP regressions and tests for personalized versus general benefits, clarification, and non-lookup replies. The replay recovered 35/38 required lookups with zero wrong, unexpected or unauthorized lookups. Fresh independent QA remains pending.

## 2026-11-24 — Typed resolution after the second V0.4 acceptance review

- Split semantic proposals and conditional grounding from deterministic turn resolution. Store one expiring active service or pending clarification per verified session.
- Added tests for service correction, pending expiry, general price questions and recovery from a mistaken first-pass route.
- Preserved the second independent suite as an exposed HTTP replay. See the [baseline diagnosis](v04-qa2-diagnostics.md) and [candidate evidence](../PROJECT_STATUS.md#typed-turn-resolution-after-qa2).

## 2026-11-25 — Grounded response usefulness

- Retained a non-lookup referral after missing fixture data or an unsupported procedure. Added bounded replies for coverage escalation, exclusion questions and unauthorized approval or policy actions.
- Distinguished definitions from personal questions that need a service, kept the active topic when explaining a displayed balance, and corroborated contextual coverage questions before looking up the verified topic.
- Documented the ten incomplete reviewed QA2 scenarios and the disclosed replays in the [diagnostic report](v04-qa2-diagnostics.md).

## 2026-11-25 — Verified Web Chat manual acceptance fixes

- Accept a complete, unambiguous service selection in the verified chat. Resolve CBC shorthand while clarification is pending or while CBC is active. Return distinct replies for policy tier, name and nearest branch questions.
- Require corroborating benefit evidence for contextual coverage and retain the conditional status returned by the policy fixture.
- Added deterministic resolver cases, verified HTTP replay and transport cancellation and session revocation regressions. Recorded the baseline trace and local browser evidence in the [diagnostic report](v04-qa2-diagnostics.md#nagy-manual-web-chat).

## 2026-11-28 — V0.4 acceptance follow-up

- Route explicit provider logistics and approval execution requests to replies before inference or policy lookup. A service mention in a broader message also needs coverage evidence or a pending service clarification.
- Keep an active service and its original expiry when grounded benefit categories conflict. Ask which benefit the member meant with no additional lookup. Preserve the service when explaining the difference between a displayed limit and an amount due.
- Accept corroborated preapproval and CBC descriptions, and preserve the referral when the member asks whom to contact. Added resolver and verified HTTP coverage for these cases.

## 2026-11-28 — V0.5 bounded conversational experiment

- Added `hub` and `ollama-v05` for the verified localhost demo. Both transports use structured interpretation and approved reply composition through the same inference port.
- Bound conversation summaries to the verified session and corroborate the proposed read against the current turn. Preserve fresh synthetic policy values, conditions and currency by rendering approved clauses in TPA.
- Added contextual public FAQ examples, human contact guidance, provider timeout handling and regression tests for unsafe proposals, fabricated benefits, session isolation and cancellation. See the [V0.5 verification record](../PROJECT_STATUS.md#v05-bounded-conversational-experiment).

## 2026-11-28 — Synthetic WhatsApp Cloud API candidate

- Added a dedicated opt-in loopback callback with Meta challenge verification and raw-body signatures. It limits incoming events to the configured test WABA, phone number ID and senders, then deduplicates and queues them per sender.
- Reused the synthetic member verification, authorized coverage and V0.5 conversation services. The channel keeps challenges and sessions on the server and sends replies through the official Meta Graph endpoint.
- Added 14 WhatsApp tests using signed fixtures and stubbed model and Graph transports within the 152-test local suite. Documented Meta test number setup, restricted HTTPS tunneling and mobile acceptance. Live Meta delivery remains pending approval. See the [verification record](../PROJECT_STATUS.md#synthetic-whatsapp-test-adapter).
