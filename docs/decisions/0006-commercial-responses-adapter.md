# ADR 0006 — Synthetic evaluation of the OpenAI Responses adapter

Status **Experimental, synthetic fixtures only** · 2026-11-28

## Decision

Keep the V0.5 transport-neutral `ConversationProvider` and its validated interpretation, grounding and reply planning. A new transport maps those stages to the OpenAI Responses API with the documented `gpt-6.2-sol` model, `medium` reasoning, Standard processing and strict JSON Schema. The output is a proposal for TPA's resolver, not provider-executed tool use. TPA renders coverage values and mandatory prior approval from the validated policy result. A composition request carries approved block labels and focus only. Referral requests use deterministic text and a short-lived context without lookup authority.

Use the commercial transport only inside the synthetic evaluation runner. Live execution requires explicit command and environment opt-ins and an independently reviewed fingerprint of the bundled corpus. Evaluation stops on a failed four-turn smoke, a wrong or unauthorized read, unexpected policy facts, budget exhaustion, or incompatible model/tier/usage. Local channels retain their configured providers.

## Trade-offs

Approved text and fresh fixture reads keep the facts authoritative while allowing the provider to decide which supported facts and explanations to foreground. The shape of the supplied block list can reflect availability of fictional benefits. Unavailable coverage and explicit human-contact requests use deterministic replies. Naturalness and accuracy in Egyptian Arabic still require human review of unseen conversations. The local input bound uses a conservative UTF-8 estimate. Missing usage stays reserved and malformed reported usage stops the run. An aborted foreground request may incur charges. Provider caching and default abuse-monitoring retention can still apply with `store:false`.

[OpenAI Responses reference](https://developers.openai.com/api/reference/resources/responses/methods/create) · [Sol model and rates](https://developers.openai.com/api/docs/models/gpt-6.2-sol) · [Data controls](https://developers.openai.com/api/docs/guides/your-data) · [Evaluation runbook](../evaluation-runbook.md#v06-synthetic-conversation-evaluation)
