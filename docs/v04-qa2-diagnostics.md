# V0.4 second acceptance diagnosis

## Independent acceptance follow-up

The independent baseline on Draft PR #19 at `a5b249d3c1a6c681d81af82ec395669a3f0eb5d7` used 20 scenarios and 47 turns. A verified HTTP replay used the same prompts, lookup, topic and response expectations. The SHA-256 of the frozen manifest was `850eb25e3e4a57c91852db915cc06e992535d8341f9b7748defb5ce2136cf1ea`.

| Measure | Baseline | Replay |
| --- | ---: | ---: |
| Required lookups | 24/29 | 27/29 |
| Useful complete conversations, reviewed | 10/20 | 16/20 |
| Unrequested coverage reads | 2 | 0 |
| Wrong-service or wrong-scope reads | 0 | 0 |
| Fabricated coverage facts | 0 | 0 |

The audit's string matcher falsely flagged both Silver MRI exclusion replies by matching the covered phrase inside the negation. Both exclusions matched the policy fixture. The FAQ matcher also accepted a reply that defined copay without comparing it to the remaining limit. The complete-conversation count accounts for this.

- A11.1 and A13.1 made zero lookups. A procedure mentioned in a location request or an approval execution request does not establish authorization to read its coverage. The replacement replies appeared in the verified Gold browser. A subsequent MRI question displayed the fixture conditions and benefits.
- A01.2 and A20.2 still returned clarification after the model grounded a copay question as a limit. A01.3 now retrieved the correct limit because the resolver kept the verified MRI topic and its expiry. The Gold browser showed both the clarification and the recovered limit.
- A05.2 and A19.2 now made their required respective MRI and CBC lookups. Both model proposals already carried appropriate evidence. The application now recognizes a possessive preapproval reference and the diagnostic sample, count and cell components for CBC.
- A08.1 still clarified after the model proposed CBC for a liver-test question and grounding abstained. It made zero coverage calls. A19.1 still explained one concept in a two-concept FAQ.

The replay used local Ollama `qwen3:4b-instruct` with the existing provider settings. The original Web Chat regression passed 16/16 over verified HTTP. The disclosed replay meets the 90% recall threshold and falls short of the 90% complete-conversation threshold. Fresh independent evidence is still pending.

A prior QA2 case supplied the procedure directly as written on a referral. The resolver accepts that bounded selection, including a normal body-site qualifier. A location question about the same referral still makes no lookup. Local `npm test` passed 122/122. Strict TypeScript 5.9.3, `npm run docs:check`, and `git diff --check` passed.

## Nagy manual Web Chat

The working tree was clean and matched the open Draft head `0c687038c630bda9fe32cb47c118fd24634af354`. The [reported nine chat turns](https://github.com/Nagy-API/TPA-AI-Euro/pull/19#issuecomment-7158911501) were replayed before editing, using verified HTTP, the Gold fixture, Node 24.14.1 and local `qwen3:4b-instruct` (digest prefix `0edcdef34593`). The trace captures model JSON, catalog evidence, session state and scoped backend calls. Resolver actions were reproduced from the captured proposals and previously read state. The unsupported dental turn was handled before inference.

| Turn | Initial intent / subject | Catalog evidence | State before → after | Action | Lookup and final reply |
| --- | --- | --- | --- | --- | --- |
| MRI coverage | COVERAGE_LOOKUP / MRI | MRI | Idle → active MRI | Lookup, overview | 1 MRI. 20% copay, 5,000 EGP remaining, preapproval. |
| Teeth whitening | No model call | Unsupported dental procedure | Active MRI → unsupported referral | Pre-routing unsupported reply | 0. Outside the demo catalog. |
| Microscopic fertilization | UNSUPPORTED_SERVICE / NONE | None | Unsupported referral → unsupported referral | Explain unsupported | 0. Outside the demo catalog. |
| Available services | CAPABILITIES / SERVICES | None | Unsupported referral → idle | Reply with catalog | 0. Lists MRI, CBC and XRAY. |
| My type | CAPABILITIES / SERVICES | None | Idle → idle | Reply with assistant role | 0. Generic capabilities. |
| My name | CAPABILITIES / SERVICES | None | Idle → idle | Reply with assistant role | 0. Generic capabilities. |
| Nearest branch | CAPABILITIES / SERVICES | None | Idle → idle | Reply with assistant role | 0. Generic capabilities. |
| Full CBC name | COVERAGE_LOOKUP / CBC | CBC | Idle → idle | Reply with the coverage proposal | 0. Generic request for the procedure name. The reply path leaves no pending clarification. |
| Colloquial CBC repeat | COVERAGE_LOOKUP / CBC | None | Idle → idle | Ground service, then clarify conflict | 0. A second call proposed CBC and copied `صوره دم`. The short label did not satisfy the service grounding rule. Same generic request. |

The baseline made one backend call and matched four of nine expected reply-and-service outcomes. All initial proposals had overview focus. The corrected browser journey showed the Ollama mode banner, verified the Gold fixture, and replayed all nine turns in one session. Both CBC messages displayed 0% copay and 1,000 EGP remaining. The tier question asked whether the user meant their policy tier. Name and branch responses each explained the applicable data gap. The browser console reported zero errors or warnings.

### Astra's verified-chat findings

| Finding | Change and coverage |
| --- | --- |
| F1 · Benefit grounding | An active service requires positive evidence for the same benefit in the message. A copied date question or copied limit question labelled as copay both lead to zero extra lookups in resolver and verified HTTP tests. The existing scoped copay control still reads the authoritative fixture. |
| F2 · Conditional coverage | Overview and focused replies retain `COVERED_WITH_CONDITIONS`. Gold MRI reports the known approval requirement. Silver CBC remains conditional, including when the backend explicitly says preapproval is not required. |
| F3 · V0.4 HTTP cancellation | The tests use the same selector-as-interpreter wiring as `index.ts`. Deadline, disconnect and session expiry abort the grounding request with zero extra lookups. Logout and rotation suppress late grounding results. The tests check topic reset and exercise retry or re-verification where applicable. |

The deterministic transport tests use the real HTTP server and Ollama adapter with synthetic provider responses and shortened deadlines. The live Ollama replays use the installed model. They do not exercise a real 30-second provider stall.

### Live verified HTTP replay

| Suite | Matched turns | Complete scenarios | Required lookups matched |
| --- | ---: | ---: | ---: |
| Manual transcript and added Silver paraphrases (`--manual`) | 16/16 | 2/2 | 5/5 |
| Disclosed QA2 (`--qa2`) | 68/69 | 29/30 | 39/40 |
| Disclosed QA1 (`--disclosed`) | 63/74 | 22/30 | 33/38 |
| Original V0.4 | 25/26 | 8/9 | 10/11 |
| Historical independent sequence (`--independent`) | 5/5 | 1/1 | 4/4 |
| Historical verifier sequence (`--fresh`) | 2/3 | 0/1 | 1/1 |

Each suite measured zero wrong-service, unexpected or unauthorized calls. In the manual replay, the Gold turns used MRI once and CBC twice. The Silver replay selected CBC directly after the service listing and also selected it from pending copay, preserving the requested benefit. Manual suite HTTP p50/p95 were 567/816 ms.

QA2 still missed 30.2 because the grounding model abstained. The stricter F1 rule rejected QA1 01.2 when the model grounded a copay question as a limit based on a generic quote. That cleared the active service, so QA1 01.3 also requested clarification. This accounts for two fewer lookups than the previous disclosed QA1 result. The other QA1 lookup misses were 07.2, 14.2 and 16.2. In the original suite, the model classified the lab copay follow-up as a limit FAQ and grounding abstained. The historical verifier clarified the unsupported rehabilitation paraphrase and made zero lookups for it. These suites use disclosed cases. QA1 still falls short of the 90% complete-scenario acceptance gate.

## Response and state defects at reviewed head `4b2b732`

The disclosed QA2 replay reproduced the ten incomplete scenarios below. Two initial 30-second inference timeouts in scenario 01 were additional environment failures in that replay and are excluded from this attribution of the reviewed result.

| Scenario | Expected goal and observed path | Primary attribution |
| --- | --- | --- |
| 04.2 | Referral after an XRAY lookup returned missing data. The resolver received an idle session and rendered a generic scope reply. | Lost dialogue context and missing referral response. |
| 05.2 | Confirm coverage for the active MRI. First pass proposed XRAY; service grounding returned NONE. Zero lookup and the topic cleared. | Model semantic error and missing contextual overview grounding. |
| 07.1 | Identify the specific lab test before discussing the member's copay. FAQ/COPAY rendered a definition and left the session idle. | Incorrect non-lookup response and missing pending clarification. |
| 13.1–2 | Explain dental cleaning is outside the demo, then offer a referral. A service possessive triggered the other-account guard; the follow-up was generic scope. | Incorrect non-lookup response and missing referral context. |
| 14.1–2 | Explain Doppler is outside the demo and explain that this says nothing about payment. XRAY was rejected by grounding and both turns got clarification. | Model semantic error plus missing supported response path. |
| 16.2 | Redirect a sports question to coverage. The model classified it as THIRD_PARTY; the renderer produced an account refusal. | Model semantic error and overly specific non-lookup reply. The topic correctly cleared. |
| 23.3 | Ask which service the remaining benefit refers to after a refusal. FAQ/LIMIT produced a definition. | Incorrect non-lookup response. The earlier refusal correctly cleared the topic. |
| 24.2 | Explain that issuing approval is handled by the responsible authority. The CAPABILITIES proposal ultimately rendered generic clarification. | Model semantic error plus missing refusal route for an action request. |
| 27.3 | Explain the displayed balance is distinct from an invoice while retaining MRI. The wording narrowly missed the amount-reference branch; FAQ cleared the topic. | Lost dialogue context and incorrect non-lookup response. |
| 30.2 | Re-fetch CBC with copay focus. First pass said FAQ/COPAY, grounding said NONE, and the resolver moved from active CBC to pending. | Missing lookup from model grounding abstention; no backend or benefit renderer failure. |

None of these reproduced mismatches used a correct backend lookup and rendered the wrong benefit focus. The missed calls were 05.2 and 30.2. Grounding for contextual coverage overview now permits a verified active service only when the independent pass confirms the purpose and quotes the current input. An unsupported or unavailable result can leave a short-lived, non-lookup referral state. A referral stores neither a service code nor a benefit result.

### Disclosed replay of the response revision

| Suite | Complete scenarios | Exact turns | Required lookups matched | Wrong, extra, unauthorized | Model probes / inference / backend | HTTP p50 / p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| QA2 | 29/30 | 68/69 | 39/40 | 0 / 0 / 0 | 58 / 65 / 39 | 544 / 1,211 ms |
| QA1 | 23/30 | 65/74 | 35/38 | 0 / 0 / 0 | 67 / 78 / 35 | 554 / 1,258 ms |

Commands used `OLLAMA_MODEL=qwen3:4b-instruct` and `node --experimental-strip-types scripts/evaluate-ollama-conversation.ts --qa2` or `--disclosed`. Both commands report mismatches with exit 1. `npm test` passed 104/104. Strict TypeScript over `src`, `scripts` and `tests`, documentation validation and `git diff --check` passed.

QA2 30.2 remained the only mismatch. The model proposed FAQ/COPAY for a personal question about the active CBC and the grounding call returned NONE. The application requested clarification without a lookup. QA1 exact mismatches were 07.2, 13.1, 13.2, 14.2, 16.1, 16.2, 17.2, 22.3 and 28.3. The three missed lookups were 07.2, 14.2 and 16.2. These include uncorroborated benefit focus and service contrast/re-entry. The non-lookup reply issues include unsupported-service typing, unrelated replies, and an abbreviated repeat of a refused approval. These exposed results do not establish independent acceptance or isolate model capacity from prompt and application behavior. Only `qwen3:4b-instruct` was listed as locally installed.

The independent 69-turn trace was recorded at `3fb22a7701ddc2793a2d73d4404de9ce65a061a5`. The checked-in [disclosed input and oracle](../evals/v04-qa2-disclosed.json) preserves the original manifest. Its SHA-256 is `825ddb69d1df4f4c59d075c62133981ffc0a22b4c6586bac68f44d879161cb79` over the UTF-8 output of `JSON.stringify(JSON.parse(file))`. The replay uses the original HTTP status, reply pattern, lookup and topic expectations. See the [independent review](https://github.com/Nagy-API/TPA-AI-Euro/pull/19#issuecomment-7133214872).

## Baseline turns missing a required lookup

All rows made zero backend calls. The baseline trace retained the grounding category but omitted the quote. Where the code required the quote, the exact excerpt is unavailable. No missing lookup originated in backend response validation or financial formatting.

| Turn | Guards and dialogue before the turn | First proposal → evidence | Result and responsible stage |
|---|---|---|---|
| 02.2 | Guards pass, CBC active, deterministic limit cue | CAPABILITIES/SERVICES → LIMIT | Capabilities reply cleared the topic. The resolver required a copied quote for this route despite corroborating text and benefit match. Application evidence arbitration. |
| 05.2 | Guards pass, MRI active, no new named procedure | COVERAGE_LOOKUP/XRAY → NONE | Clarified and cleared topic. The model interpreted a reference to the prior procedure as a new service. The service guard correctly withheld XRAY. |
| 08.2 | CBC active, MRI named, contrast detected | CLARIFY → no second call | Clarified and cleared topic. The broad contrast guard had no transition for a positive replacement of the active procedure. |
| 08.3 | No active topic after 08.2, preapproval cue | FOLLOW_UP → no second call | Clarified. The session lookup correctly refused to reuse the superseded topic. Downstream state loss. |
| 09.1 | MRI named, request about authorization, old benefit detector found no cue | FOLLOW_UP/OVERVIEW → no second call | Clarified. First-pass route missed the explicit service and the application lacked sufficient request evidence to recover it. |
| 17.1 | MRI named, personal percentage, old benefit detector found no cue | FAQ/COPAY → no second call | Generic copay definition. First-pass personal versus generic error survived routing. |
| 25.1 | MRI named, user asks the policy's contribution, no old policy-benefit cue | CLARIFY → no second call | Clarified. First-pass intent and the application's request cue both missed positive intent. |
| 27.2 | Prior topic expired, attached Arabic preposition masked the MRI alias | COVERAGE_LOOKUP/MRI → MRI | Clarified. Agreement alone failed the excerpt/evidence path. The frozen trace does not say which quote subcheck failed. Application evidence recognition. |
| 30.1 | CBC named, personal price estimate, old benefit detector found no cue | FAQ/COPAY → no second call | Generic definition. First-pass error survived routing and no CBC topic was set. |
| 30.2 | No active topic after 30.1, copay cue | FAQ/COPAY → no second call | Clarified. The session correctly required a topic. Downstream state loss. |

## Other baseline usefulness failures

| Turn | Guard or proposal | Observed consequence |
|---|---|---|
| 04.2 | CLARIFY after XRAY returned UNKNOWN | Generic scope reply lost the service-desk referral. |
| 07.1 | FAQ/COPAY for a personal question about an unspecified test | Definition instead of asking which test. |
| 13.1–13.2 | Third-party guard matched a possessive referring to a service, then OUT_OF_SCOPE | Both replies missed the unsupported dental procedure or referral. |
| 14.1–14.2 | XRAY proposal for Doppler disagreed with evidence, then contrast guard | No wrong lookup. Both replies clarified without explaining that the demo could not check Doppler. |
| 16.2 | OUT_OF_SCOPE/THIRD_PARTY for a sports question | Safe redirect gave an unrelated account refusal. |
| 23.3 | FAQ/LIMIT after a refusal cleared the topic | General definition instead of asking which procedure. |
| 24.2 | CAPABILITIES on a request to issue an approval | No action. The reply failed to explain who handles approval requests. |
| 27.3 | FAQ/LIMIT after 27.2 failed to re-establish MRI | Definition was safe, but the scenario's topic expectation failed. |
