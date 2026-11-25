# V0.4 second acceptance diagnosis

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
