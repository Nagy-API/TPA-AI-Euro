# V0.4 second acceptance diagnosis

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
