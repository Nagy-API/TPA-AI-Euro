# TPA AI Euro — Project Status (source of truth)

**Updated:** 2026-11-28

**Repository:** [Nagy-API/TPA-AI-Euro](https://github.com/Nagy-API/TPA-AI-Euro) — **PUBLIC**  
**Default branch:** `main`  
**Current milestone:** V0.3 local Ollama intent-selection **MERGED into `main`** (synthetic local PoC); backend contract and real service integration remain deferred.

## V0.6 synthetic conversation evaluation

`codex/v06-openai-responses` is based on [WhatsApp Draft PR #21](https://github.com/Nagy-API/TPA-AI-Euro/pull/21) at `d455ff865bc16eb575547f9e5e10efc75f7c833e`. The OpenAI transport is available only in the bundled evaluator. Web Demo and WhatsApp still use their existing provider configuration. TPA validates model proposals, enforces session scope, preserves required prior approval, and renders approved facts and referral wording locally. See [ADR 0006](docs/decisions/0006-commercial-responses-adapter.md) and the [evaluation runbook](docs/evaluation-runbook.md#v06-synthetic-conversation-evaluation).

The offline Responses stub matched 22/22 turns, 9/9 scenarios and 8/8 required reads, with zero wrong, unexpected or wrong-scope reads. Of 12 composition attempts, 11 accepted the plan and one delivered the approved fallback after rejecting the plan. `npm test` passed 163/163 on Node.js 24.14.1, including Web Demo and signed synthetic WhatsApp HTTP tests. Strict TypeScript 5.9.3, `npm run docs:check` and `git diff --check` passed. Live commercial access, cost, latency and model quality on unseen Arabic conversations remain unverified.

## Synthetic WhatsApp test adapter

The opt-in branch `codex/whatsapp-cloud-test` uses [V0.5 Draft PR #20](https://github.com/Nagy-API/TPA-AI-Euro/pull/20) at `834bf56b1e020b74ee10952f5c0be5cb063e6703`. A dedicated loopback listener handles the signed Meta callback, synthetic login and Graph text replies. The [runbook](docs/whatsapp-test-runbook.md) covers Meta test assets, restricted HTTPS routing and mobile acceptance. The [channel decision](docs/decisions/0005-isolated-whatsapp-test-listener.md) records the local state and delivery semantics.

Local verification includes `npm test` (152/152, including 14 WhatsApp tests), strict TypeScript 5.9.3, `npm run docs:check` and `npm run eval:cases` (21 preview cases). The WhatsApp suite uses signed synthetic webhooks and stubbed Graph and inference transports. It covers route isolation, invalid signatures, scoped verification and expiry, duplicate delivery, queue limits, provider failure and Graph failure.

Live Meta webhook registration, public HTTPS routing and mobile acceptance require Nagy's explicit approval.

## V0.5 bounded conversational experiment

Experimental branch `codex/v05-conversational-slice` starts from reviewed V0.4 commit `3507ed632bb775d30d890f5c93249a341bbe9623`. The stacked review depends on [V0.4 Draft PR #19](https://github.com/Nagy-API/TPA-AI-Euro/pull/19). Choose `hub` or `ollama-v05` in the verified synthetic demo. [Architecture decision](docs/decisions/0004-bounded-conversational-composition.md) · [Browser walkthrough](README.md#run-the-v05-conversational-experiment)

The V0.5 model interprets current synthetic text with a bounded summary, proposes one coverage read where appropriate, and arranges approved answer clauses. TPA verifies the proposal against present-turn evidence and the authorized session. It owns model cancellation, tool execution, fresh validated coverage, exact values, coverage conditions and final rendering. Public definitions support contextual examples. Unavailable and unsupported requests can direct a member to the contact details in their policy.

### Verification

- `npm test` passed 138/138, including 14 V0.5 orchestration and stubbed-transport tests and two new startup checks. Strict TypeScript 5.9.3 over `src`, `scripts` and `tests`, `npm run docs:check` and `git diff --check` passed. `npm run eval:cases` listed 21 synthetic cases.
- Sequential verified HTTP smoke passed 9/9 turns with direct Ollama and 9/9 with the Local AI Hub. Both used the installed `qwen3:4b-instruct` on Ollama 0.40.19, digest prefix `0edcdef34593`. Each made the four expected policy reads. None was wrong, unexpected or out of scope in this sample. The smoke covered conditional Gold MRI, its copay follow-up, a definition and requested example, missing X-ray fixture data, an unsupported procedure, human contact guidance, a fresh Silver session without a topic and Silver MRI exclusion.
- Chrome exercised the Hub-backed Gold verification, conditional MRI overview, 20% copay follow-up with prior-approval condition and definition, and logout. The console showed zero warnings or errors for the checked flow.
- In this smoke the copay turn took about 1.24 s direct and 10.22 s via Hub. The Hub profile unloads the model after each completion. This is a small disclosed smoke, without a controlled cold/warm benchmark.

Model quality on unseen conversations, real authentication, production isolation and real policy data remain outside the experiment.

## V0.4 grounded conversation — Issue #17

V0.4 is proposed on `codex/v04-grounded-conversation`. The verified Web Demo uses local `qwen3:4b-instruct` for intent, reply subject and focus. A verified session holds one service topic, pending clarification, or non-lookup referral for up to two minutes. Every accepted coverage follow-up fetches current mock data. The model receives synthetic text and a dialogue-state hint. Approved reply text and validated mock benefits are rendered on the server. See the [response and state diagnosis](docs/v04-qa2-diagnostics.md#response-and-state-defects-at-reviewed-head-4b2b732).

### Independent acceptance follow-up

The independent 20-scenario evaluation on `a5b249d` measured 24/29 required lookups, 10/20 useful complete conversations and two unintended reads in the correct member sessions. The updated candidate blocks those provider-location and approval-execution reads. It accepts the corroborated preapproval question and implicit CBC description, and keeps the original topic expiry on a benefit clarification. See the [replay and remaining misses](docs/v04-qa2-diagnostics.md#independent-acceptance-follow-up).

### Manual Web Chat acceptance blocker

Reproduced [Nagy's transcript](https://github.com/Nagy-API/TPA-AI-Euro/pull/19#issuecomment-7158911501) on the clean Draft head `0c687038c630bda9fe32cb47c118fd24634af354`. The model correctly proposed CBC on both failed turns. The resolver treated the full name as a reply with no pending service and rejected the short name's grounding excerpt. The tier, name and branch questions all became the same capabilities reply. See the [verified HTTP trace and Astra review](docs/v04-qa2-diagnostics.md#nagy-manual-web-chat).

The fix accepts complete catalog selections and uses CBC shorthand only in a pending service clarification or an active CBC topic. The browser replayed all nine turns in the verified Gold fixture with local Ollama, including both CBC results at 0% copay and 1,000 EGP remaining. The three non-coverage questions produced distinct replies. The browser console showed no warnings or errors during replay. F1 now requires positive benefit evidence for contextual lookups, F2 preserves conditional coverage in overview and focused replies, and F3 is covered by verified V0.4 HTTP tests.

`npm test` passed 116/116. Strict TypeScript 5.9.3 over `src`, `scripts`, and `tests`, `npm run docs:check`, and `git diff --check` passed. The [live replay results](docs/v04-qa2-diagnostics.md#live-verified-http-replay) include 16/16 manual regression turns and zero wrong, unexpected or unauthorized lookups across the measured suites. QA1 remains below the independent acceptance threshold.

### Recall revision after independent QA

[Independent QA](https://github.com/Nagy-API/TPA-AI-Euro/pull/19#issuecomment-7132224667) on `10f81ad` found 14/38 required lookups, 12 false-negative clarifications and 5/30 complete scenarios. Initial intent routing suppressed personalized requests, a second model vote could veto a positively identified catalog service, and asking the member to pick a service discarded the pending benefit.

On the recall revision, replaying the 30 disclosed conversations through verified localhost HTTP on Node 24.14.1 and Ollama 0.40.17 (`qwen3:4b-instruct`, digest prefix `0edcdef34593`) measured **35/38 required lookups**, **2 false-negative clarifications**, **0 wrong, unexpected or unauthorized lookups**, and **62/74 exact coded checks, 20/30 complete scenarios**. There were 67 model availability checks, 79 inference requests and 35 backend calls. HTTP p50/p95 were 537/1,258 ms. Exact coded checks combine response codes, expected backend calls, stored topic and selected answer content. They do not replace the independent usefulness rubric. The original integrated suite passed 26/26 coded checks with 11/11 required lookups and zero wrong, unexpected or unauthorized lookups.

Remaining lookup misses were the implicit policy percentage (QA-07), a magnetic description with a negated alternative (QA-14), and a future conditional MRI inquiry (QA-16). The model also misrouted some service-desk, dental exclusion, unrelated FX and escalation follow-ups. The shared model can still make correlated errors on paraphrases. These measured gains apply to exposed regression cases. The Draft requires a new unseen acceptance run before merge review.

Reproduce with `OLLAMA_MODEL=qwen3:4b-instruct` and `node --experimental-strip-types scripts/evaluate-ollama-conversation.ts --disclosed`. The runner exits 1 when any coded check misses. See the [disclosed inputs and expectations](evals/v04-disclosed-conversations.json).

### Typed turn resolution after QA2

The second independent run measured 30/40 required lookups and 15/30 complete conversations. See the [per-failure trace and diagnosis](docs/v04-qa2-diagnostics.md). The resolver now makes explicit coverage, contextual coverage, clarification and static replies distinct actions. It rechecks session dialogue after semantic inference and before any lookup. Pending focus and active service use the same time-bounded session slot.

Verified HTTP replay on Ollama 0.40.17 with `qwen3:4b-instruct` (digest prefix `0edcdef34593`):

| Suite | Required lookups | Complete conversations | Matched turns | Wrong / unexpected / unauthorized lookups | p50 / p95 |
|---|---:|---:|---:|---:|---:|
| QA2, now disclosed | 38/40 | 20/30 | 57/69 | 0 / 0 / 0 | 561 / 1,142 ms |
| Original independent suite, disclosed | 35/38 | 20/30 | 62/74 | 0 / 0 / 0 | 566 / 1,297 ms |

On QA2 the first-pass model agreed with the expected route and service on 24/40 required turns, both before and after the revision. For contextual turns, the metric checks the raw FOLLOW_UP intent. For service-bearing turns it checks raw COVERAGE_LOOKUP and the target code. The metric measures route/service agreement without application state or benefit focus. The final application matched 38/40 lookups with 60 availability probes, 69 inference requests and two false-negative clarifications. Remaining cases include a misidentified reference to MRI and a personal copay follow-up classified as FAQ with no corroboration. The runner deliberately exits 1 on the disclosed suites because reply and state expectations still fail.

Run `node --experimental-strip-types scripts/evaluate-ollama-conversation.ts --qa2` with the same local model setting to reproduce. The installed model's proposal errors and the reply gaps warrant comparing a larger local model if approved. Fresh independent QA is required for acceptance. Neither replay establishes generalization or complete-scenario usefulness at the 90% threshold.

### V0.3 reproduction

The indirect knee-imaging question passed model eligibility and Ollama proposed MRI. The application rejected the proposal because the existing lexical guard expected the magnet cue next to the imaging phrase. The indirect copay question missed the fixture-style follow-up matcher, had no saved MRI topic and failed the model's single-turn eligibility screen. Dental and capability questions also failed eligibility by design. The orchestrator routed all those paths to the same generic clarification.

### Observed end-to-end replies

The existing RTL Web Demo was exercised in a verified fictional Gold session with real loopback Ollama. The five reported messages passed in one browser conversation. Two more turns verified distinct role and FAQ replies. The browser returned no console errors or warnings during that flow. At 768 px and 390 px the document was RTL and stayed within the viewport. Logout returned to identification.

| Gold member message | Actual reply content | Verified HTTP lookup |
| --- | --- | --- |
| الدكتور طالب مني أدخل جهاز بيصور ركبتي بالمغناطيس، التأمين هيساعدني في تكلفته؟ | الرنين المغناطيسي مغطّى حسب بيانات الوثيقة التجريبية. نسبة التحمل: 20%. الحد المتبقي: 5,000 جنيه. لازم موافقة مسبقة من المختص قبل تقديم الخدمة، وده مش قرار موافقة. | MRI |
| طب أنا هدفع كام من جيبي؟ | بالنسبة لـالرنين المغناطيسي، نسبة التحمل 20% من التكلفة المؤهلة. المبلغ بالجنيه محتاج سعر الخدمة. | MRI re-fetch |
| طب تبييض الأسنان متغطي عندي ولا لأ؟ | الخدمة دي مش ضمن الخدمات اللي أقدر أراجعها في الديمو. ده ما يحددش إذا كانت وثيقتك بتغطيها. اسأل خدمة العملاء عن الخدمة دي. | 0 |
| تبييض أسنان | The same service-availability reply. | 0 |
| إيه الخدمات المتاحة | في الديمو أقدر أراجع الرنين المغناطيسي، صورة الدم الكاملة، الأشعة السينية. نتيجة كل فحص بتعتمد على بيانات الوثيقة التجريبية. | 0 |
| إنت بتساعدني في إيه؟ | أقدر أراجع تغطية فحص في وثيقتك التجريبية، وأقولك نسبة التحمل والحد المتبقي ولو محتاج موافقة مسبقة، حسب البيانات المتاحة. | 0 |
| يعني إيه نسبة تحمل؟ | نسبة التحمل هي الجزء اللي عليك من تكلفة الخدمة المؤهلة للتغطية. النسبة بتختلف حسب الخدمة والوثيقة. | 0 |

Verified HTTP separately observed Gold plain X-ray returning `COVERAGE_NOT_AVAILABLE` based on the missing mock policy entry and Silver MRI returning `COVERAGE_RESULT` with an explicit exclusion. An expired session returned 401 before contacting Ollama. Selecting a nonexistent local model returned 503 `AI_UNAVAILABLE` without a lookup, with the provider still listening on loopback.

### Verification

| Integrated Ollama HTTP run | Exact status, reply and lookup | Correct / required lookups | Unexpected / wrong-service lookups | p50 / p95 |
| --- | ---: | ---: | ---: | ---: |
| Issue #17 and development replay | 26/26 | 11/11 | 0 / 0 | 589 / 1,363 ms |
| Reviewer sequence replay after fixes | 5/5 | 4/4 | 0 / 0 | 1,134 / 1,459 ms |
| Fresh verifier sequence, first run | 2/3 | 1/1 | 0 / 0 | 619 / 1,380 ms |

Across the final three runs, the server made **16 correct required lookups**, with **zero lookups on the 18 non-lookup turns**. The first reviewer run matched 2/5, including one of four required lookups. The replay uses the same questions after improving service and follow-up corroboration. In the untouched verifier sequence, the model correctly identified an indirect wrist MRI and the app refused a grandchild's question before inference. Ollama clarified a rehabilitation question instead of identifying it as unsupported. It made zero coverage calls for that turn, and the fresh evaluator exits 1 to report that mismatch.

Local `npm test` passed 92/92. Strict TypeScript 5.8.3 passed for `src`, `scripts`, and `tests` with `--noEmit --strict --allowImportingTsExtensions --module NodeNext --moduleResolution NodeNext --target ES2022 --types node` and the locally installed Node declaration path. `npm run docs:check` and `git diff --check` passed.

### Model behavior and remaining risks

- On the copay follow-up, the first model pass emitted `FOLLOW_UP` with an overly broad `OVERVIEW`. The contextual pass identified copay and the application rendered the freshly fetched MRI copay. On a CBC billing follow-up, both model calls initially leaned toward the limit. The explicit bill cue selected copay from the verified CBC object. The service and capability replies use maintained approved phrasing.
- On a generic chest test, a model proposed XRAY and the independent check refused to identify a service. The backend saw zero calls. The test suite also checks that a copied service from a superseded clause and an irrelevant copied excerpt cannot authorize a lookup.
- Scope recognition and semantic evidence are bounded. Both passes share a local model, which can produce correlated errors and vary across runs. The finite evaluation does not establish production coverage, safety or privacy. A real policy integration, approved identity, and privacy controls remain pending.

Reproduce with `OLLAMA_MODEL=qwen3:4b-instruct` and `node --experimental-strip-types scripts/evaluate-ollama-conversation.ts`. Add `--independent` for the reviewer sequence and `--fresh` for the verifier sequence. The runner prints synthetic transcripts, model decisions, actual lookup codes and per-turn latency. See the [local setup](README.md#run-with-local-ollama-synthetic-demo).

## PR 16 service-grounding review

- The coverage assistant requires a model proposal to agree with positive evidence for exactly one supported service in the question before saving a topic or querying the backend. The check recognizes catalog names and bounded Egyptian Arabic paraphrases, blocks conflicting evidence, and clarifies when evidence is missing. The same check is used by the standalone Ollama selector. The verified-session, tenant, and deadline behavior is unchanged.
- Frozen implementation: `ab69987344ef0f55baf949cf864b95166054fd80`. Ollama `0.40.17`, `qwen3:4b-instruct`, installed digest `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`. The new [24-case dataset](evals/ollama-grounding-holdout-cases.json) was authored after the implementation commit and evaluated once without changing inputs or code afterward. SHA-256 of the evaluated file bytes: `24ea4cf1cf752422718d23138b28011f12d6e85ba9301077ef96aa67a4bdd5e5`. The two older HTTP sets are exposed regression data.

| Verified HTTP dataset | Exact | Correct / required lookups | Denied cases with lookup | Wrong service / unauthorized lookups | Clarification false negatives | Model checks / eligibility / tool requests / raw proposals | p50 / p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Issue #15 replay | 28/29 | 14/15 | 0/14 | 0 / 0 | 1 | 22 / 22 / 14 / 15 | 303 / 917 ms |
| Exposed first holdout replay | 16/16 | 7/7 | 0/9 | 0 / 0 | 0 | 10 / 10 / 8 / 8 | 294 / 892 ms |
| Fresh service-grounding holdout | 23/24 | 11/12 | 0/12 | 0 / 0 | 1 | 19 / 19 / 12 / 13 | 328 / 1,104 ms |

- In the exposed replay, H-12 still elicited a CBC tool proposal, but the application clarified with zero lookups. H-05 reached the intended CBC lookup and H-08 clarified without a provider request or lookup. QA-12 still clarified before tool selection on a valid corrected XRAY request.
- In the fresh holdout, G-07 generated a correct CBC proposal that the guard rejected because the blood-cell description fell outside its recognized phrasing. G-21's third-party wording reached eligibility and clarified without a tool request or lookup. The fresh observed route match was **95.8%**, while correct required lookups were **91.7%**. This run does not meet a 95% required-lookup target. The bounded language rules can require clarification for valid questions, and a finite synthetic set cannot establish behavior for arbitrary service or ownership wording.
- Local verification: `npm test` **87/87**, with **57/57** in the separate non-HTTP run and **30/30** in the HTTP integration run. Strict TypeScript 5.9.3 targeting ES2022 and `npm run docs:check` passed. `npm run eval:ollama` matched **21/21** development cases. The review and fresh holdout exit 1 on their documented misses. The exposed first holdout exits 0. Commands are in the [evaluation runbook](docs/evaluation-runbook.md#verified-http-evaluation).

## PR 16 architectural review follow-up

- The application refuses recognizable third-party subjects before Ollama or coverage and clears the active service topic. Exact bounded co-pay follow-ups resolve from the authenticated session without Ollama. The adapter blocks recognizable credentials, demo IDs, and code-like numeric patterns while allowing ordinary percentages, amounts and counts. `INT-012` now expects clarification because the text includes a fictional membership ID.
- Chat has a **30 s HTTP / 35 s browser** deadline. Local HTTP regressions cover cancellation during slow inference, client disconnect, imminent session expiry, and a single successful explicit retry after a timeout. The synthetic Gold browser smoke completed a numeric MRI question in **10,221 ms**, including **9,100 ms** of injected delay before real Ollama inference. The browser held the submit control disabled while pending. A third-party turn refused coverage, the next co-pay follow-up asked for a topic, and logout returned to verification.
- On Ollama **0.40.17**, installed `qwen3:4b-instruct` matched **21/21** selector development cases with the updated expected behavior. The bare keyword selector matched **14/21** against those same labels. These cases informed tuning.

| Verified HTTP dataset | Exact matches | Correct requested lookups | Unexpected lookups | p50 | p95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Original Issue #15 questions and scenarios | 28/29 | 14/15 | 0 | 327 ms | 1,241 ms | 1,420 ms |
| First frozen holdout run | 13/16 | 6/7 | 1 | 315 ms | 1,138 ms | 1,138 ms |

- Review cases `QA-07` and `QA-29` each made one matching lookup (CBC and MRI). `QA-12` clarified at eligibility and made zero lookups. `QA-18` received two raw proposals (MRI, CBC) and made zero lookups. `QA-19` and `QA-25` clarified after eligibility. `QA-23/24/26/27` clarified without model calls. `QA-28` returned 401 before any model call or lookup. `QA-13` resolved an MRI follow-up without a model call. The original Issue #15 probe's 25/29 tool-count matches measured a different, one-pass model-only flow.
- Holdout misses: `H-05` clarified on a CBC paraphrase. `H-08` clarified with zero tool proposals and zero lookups, but only after the eligibility model saw the third-party wording. `H-12` misclassified a dental checkup as CBC and looked up the verified member's synthetic CBC benefit. These are open issues for architectural review. The scope and privacy screens cover recognizable patterns. The evaluation provides evidence for these cases, with broader coverage undetermined.
- `npm test` passed **83/83**. `npm run docs:check` and strict TypeScript 5.9.3 checking passed. The typecheck used `--noEmit --strict --target ES2022 --module NodeNext --allowImportingTsExtensions --types node` across `src`, `scripts`, and `tests`. Reproduce the model runs with `npm run eval:ollama`, `npm run eval:ollama:http -- review`, and `npm run eval:ollama:http -- holdout`. Both integrated runs exit 1 on the documented mismatches. See the [evaluation runbook](docs/evaluation-runbook.md#verified-http-evaluation).

## V0.3 local Ollama review

- [Issue #13](https://github.com/Nagy-API/TPA-AI-Euro/issues/13) adds opt-in local model intent selection, based on `main` at `752664ea34b0bce0f0ef2bedba2af3af3a42098f`. Fixture mode remains default. Use the [README setup](README.md#run-with-local-ollama-synthetic-demo) for the existing Web Chat.
- The adapter rejects recognizable sensitive chat input before sending it to Ollama. Verified member/tenant scope, auth fields, conversation state and mock benefit data stay on the application side. The input screen is limited to recognizable formats and the demo accepts fictional data only.
- `npm test`: **77/77** on Node 24.14.1. `npm run docs:check`, `npm run eval:cases` and strict TypeScript 5.9.3 for `src`, `scripts` and `tests` passed. Local browser verification covered Gold mock OTP, the colloquial MRI question, the co-pay follow-up and logout.
- Ollama **0.40.17** reported tool support for the installed `qwen3:4b-instruct` (Q4_K_M, digest prefix `0edcdef34593`). A direct tool probe took **8,630 ms** wall clock, with **7,855 ms** reported model load. The final 21-case run matched **19/21** versus fixture **15/21**. Accepted service turns took **789–1,045 ms** in that run. The model recognized all three added Egyptian Arabic paraphrases and the app clarified the multi-service case.
- Both remaining misses were critical. `INT-012` expected MRI but the privacy screen suppressed the pasted fictional membership identifier before inference. `INT-020` expected clarification for a neighbor's coverage and the model selected MRI. The HTTP path returned the caller's own synthetic result, confined to their verified member/tenant. The fixture also misses `INT-020`. The fixed suite was used for tuning and the result is regression evidence, with independent intent validation pending.
- Local HTTP end-to-end measured colloquial MRI **1,139 ms**, scoped co-pay follow-up **277 ms**, CBC paraphrase **790 ms**, multi-service clarification **1,317 ms**, and unrelated clarification **292 ms**. A deliberately missing model returned HTTP **503 `AI_UNAVAILABLE`** in **48 ms** and a logged-out request returned **401 `VERIFICATION_REQUIRED`**. Measurements are specific to this machine and run.

## Local Web Chat demo

- [Issue #11](https://github.com/Nagy-API/TPA-AI-Euro/issues/11) adds Arabic RTL membership verification, chat and logout at `http://127.0.0.1:3000/demo`. Start the verified offline server using the [README run instructions](README.md#run-without-an-api-key-non-ai-offline-demo).
- The page and two assets share the demo enablement, production, loopback and origin gates and are available in verified mode. Responses use `no-store` and a restrictive Content Security Policy. The client keeps its session token in volatile JavaScript state and renders messages as text.
- Local `npm test` passed **63/63** on Node 24.14.1. The three new HTTP tests cover page/assets, security headers, fictional credentials, and disabled, legacy, production, foreign Origin and non-loopback Host requests. `npm run docs:check` passed. `npm run eval:cases` listed **14** synthetic cases. Strict TypeScript 5.9.3 passed for `src`, `scripts` and `tests` with Node 22.19.17 typings.
- Windows Chrome verified desktop (1536 × 720), tablet (768 × 850) and mobile (390 × 844) layouts and keyboard form submission. All three public fixture accounts completed MRI and the co-pay follow-up. Chrome also showed invalid OTP recovery, logout, text-only rendering and reload reset. A temporary loopback test server verified a synthetic HTTP 503, successful retry and automatic expiry clearing the transcript.
- [Issue #9](https://github.com/Nagy-API/TPA-AI-Euro/issues/9) remains deferred. The default browser session uses synthetic identity, coverage and offline keyword rules.

## V0.2 offline coverage follow-ups

- [Issue #8](https://github.com/Nagy-API/TPA-AI-Euro/issues/8) is implemented on `feat/offline-conversation-state`, based on verified `origin/main` at `2162373b166205ce6af00f4e8af318a280bb76fc`.
- Implementation commit `cca12953a61dd9a237b00855683cc75102b2d66f` is under review in [Draft PR #10](https://github.com/Nagy-API/TPA-AI-Euro/pull/10) against `main`. See the PR for hosted checks on the current head.
- GitHub Actions passed on the implementation commit with [offline tests on Node 22.16.0](https://github.com/Nagy-API/TPA-AI-Euro/actions/runs/45145808513) and [documentation validation](https://github.com/Nagy-API/TPA-AI-Euro/actions/runs/45145808509).
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

## V0.2 release gate — approved and merged 2026-11-23

- [x] Reviewed [PR #10](https://github.com/Nagy-API/TPA-AI-Euro/pull/10) for scoped conversation state, session revocation/rotation, fresh backend fetch and negative tests; no blocker identified for its strictly local fictional-data use case.
- [x] PR #10 squash-merged to `main` with Nagy's explicit authorization. Feature merge SHA `a5edbec7d908f3bfd9e3e88a9415e2241e076649`.
- [x] PR #10 Node tests + docs checks were both **completed/success** on head `058ee88bc9f550c128e98aaf3a1c6e8be66d0a37`. Agent reported `npm test` **60/60 locally** with TypeScript check and offline fixture preview. The merged `main` commit and any subsequent docs commit must have their own CI results checked.
- [x] Coverage follow-ups: one prior explicit MRI/CBC/XRAY topic for up to two minutes in current verified demo session. Each follow-up re-queries mock backend. No stored medical history, financial coverage response or raw conversation transcript. Legacy mode remains single-turn.
- [x] Issue #8 completed. All earlier feature PRs #1, #7 and #10 merged; old source PRs #4 and #5 closed as incorporated.

## Decision: pause additional feature implementation

Nagy requested **no more artificial backlog or endless free-only features** after the present V0.2. The next steps are **external dependency gates**, not active implementation assignments:

1. **DEFERRED** — [Issue #9](https://github.com/Nagy-API/TPA-AI-Euro/issues/9): Core Backend + TPA domain confirm identity/session, tenant authorization and versioned coverage contract, error semantics, service taxonomy and synthetic sandbox. Current `docs/api-contracts.md` is a proposal, not an approved integration API.
2. **DEFERRED** — When a genuine backend sandbox exists, map agreed schemas to a typed adapter and run authorization/contract/integration tests. Do not replace `MOCK_POLICY_ENGINE` with an invented production contract.
3. **DEFERRED** — Nagy chooses budget, approved LLM provider/model and data-sharing/privacy rules before enabling any real LLM API and measuring Egyptian-Arabic intent accuracy. Current keyword selector is **not AI**; Claude adapter code has no verified live calls.
4. **DEFERRED** — Confirm channels/operations requirements (e.g. WhatsApp, human handoff) and approved credentials before any third-party integration or state-changing workflow.
5. **FUTURE PRODUCTION GATE** — Real identity/OTP provider, secret management, persistence, tenancy, security/privacy/compliance, monitoring, redacted audit, load/reliability tests, and human/domain sign-off. Not a V0.2 commitment.

**No credible end-to-end schedule or % complete for the full TPA or production AI layer can be derived without team size, accepted requirements and integration access.** We have completed the narrow offline prototype scope, NOT the full TPA/AI delivery. Repository is **PUBLIC** and must hold only synthetic data and safe docs; making it private later cannot undo historical public disclosure.

## V0.3 final release decision — merged 2026-11-24

- [x] Nagy authorized merge of [PR #16](https://github.com/Nagy-API/TPA-AI-Euro/pull/16) into `main`; squash commit `b44596071798aeee1fac6e1162022754e8185c81`.
- [x] GitHub hosted `test` and `validate` both passed on merged-main commit. Development agent reported `npm test` 87/87 and strict TS/docs checks locally; these are separate evidence sources.
- [x] Ollama 0.40.17 / `qwen3:4b-instruct` local evaluation reported 23/24 total matches, 11/12 required coverage lookups (91.7% recall) and zero wrong or unauthorized lookups **in the 24 measured holdout cases**. Correct CBC paraphrase G-07 was clarified, indicating a recall limitation. No arbitrary generalization to broader production questions.
- [x] Verified demo remains loopback-only and uses synthetic OTP, fake members and policies, no paid provider. UI defaults to fixture mode; `DEMO_INTENT_MODE=ollama` is opt-in. The Ollama tool only chooses from MRI/CBC/XRAY; the session and mock coverage engine determine authorization and financial figures.
- [ ] User-run browser trial from canonical local `TPA-AI` folder with merged main and Ollama enabled, to assess actual product value beyond narrow fixture evaluation.
- [ ] External blockers: real TPA service contract/identity [Issue #9](https://github.com/Nagy-API/TPA-AI-Euro/issues/9) deferred, real medical data prohibited, no WhatsApp production integration or security certification.
- [ ] Historical local clones/backup cleanup [Issue #14](https://github.com/Nagy-API/TPA-AI-Euro/issues/14) is separate and requires exact-path deletion approval. No folders deleted by this merge.

**Do not interpret this local AI PoC approval as approval for production deployment, cloud provider costs, real identity/medical information, or broad TPA coverage.**
