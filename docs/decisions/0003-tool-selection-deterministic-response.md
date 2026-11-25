# ADR 0003 — Tool selection by LLM, deterministic coverage response (first slice)

Status: **Accepted for isolated V1 demo only**, pending core/domain review. Date: 2026-11-23.

## Context

Financial/coverage values and medical approvals must not be invented by an LLM. We need a useful AI integration milestone before the core TPA backend is available. Live models may hallucinate even when tool results are present.

## Decision

Use Claude Messages API tool use to select exactly one service code (`MRI`, `CBC`, `XRAY`) from a public *fictional* catalog. Code validates this tool name and argument, uses the already-verified trusted session to look up a fake policy-engine result, and formats the result deterministically. No member ID/tier/tenant or result value is accepted from the LLM. The model never grants/rejects medical care. An offline keyword selector is provided for no-key tests and must be described as non-AI.

### 2026-11-24 — Local Ollama extension pending architectural review

Verified demo mode may opt into Ollama at a fixed loopback endpoint with a locally installed model. The adapter first asks for a schema-constrained eligibility decision without tools, then asks an eligible question to select the same single allowlisted tool. Both responses are untrusted and parsed at runtime. Multiple distinct service calls clarify without a lookup. Selector failures surface as `AI_UNAVAILABLE`. Fixture selection stays the default. The application owns identity, conversation topic, backend access and formatting. See [local evidence](../../PROJECT_STATUS.md#v03-local-ollama-review).

The application also checks recognizable third-party subjects before model or policy access and clears the conversation topic on refusal. The HTTP route owns the chat deadline and passes cancellation to the model adapter. The same verified session continues to enforce member and tenant authorization on each lookup. See the [review follow-up evidence](../../PROJECT_STATUS.md#pr-16-architectural-review-follow-up).

The application requires positive evidence in the actual question for one catalog service that agrees with the selector proposal. The guard recognizes names and bounded paraphrases, and clarifies on missing, conflicting or uncertain evidence. Exact authenticated co-pay follow-ups can use a previously grounded topic. This favors precision over recall for the synthetic catalog. Detecting arbitrary unsupported comparisons or third-party wording in free text remains limited. See the [service-grounding evidence](../../PROJECT_STATUS.md#pr-16-service-grounding-review).

### V0.4 decision for verified local Ollama

The Web Demo routes Ollama turns through explicit conversational intents and approved Arabic reply text. A supported service explicitly identified in a personal policy request or in a scoped clarification has positive catalog evidence in the current text. It can proceed after the validated initial classification if the application finds no conflict, including an out-of-scope, unsupported or multiple-service verdict. Descriptive service proposals need a second semantic check and a copied excerpt with service-specific evidence. Indirect follow-ups use a grounded benefit label or a second semantic check. Deterministic checks reject recognized scope changes, competing procedures and override requests. Both model calls can still make correlated semantic errors. Policy and authorization remain server-side.

The server keeps the latest successfully validated service or the benefit awaiting clarification in the verified session, for up to two minutes. A pending clarification cannot authorize a lookup by itself. An accepted follow-up re-fetches data without extending the service lifetime. Session rotation, expiry and logout remove access. Non-coverage turns clear the topic, except for a general explanation of the meaning of a displayed amount. The backend response determines coverage status, financial values, approval requirements and missing fixture data. No benefit value, identity field or tool arguments from the model reach the backend.

### Typed resolution following the second acceptance review

The Ollama adapter returns a validated semantic proposal. A deterministic resolver combines it with evidence from the current message and an idle, active, or pending dialogue snapshot. Its `TurnResolution` permits a scoped lookup, a clarification with the missing information and focus, or an approved reply. A second Ollama call is requested only for unresolved service descriptions or contextual benefit questions. It provides evidence for the same decision. It has no access to the session or backend and cannot dispatch a tool.

The executor re-reads session dialogue after inference. A lookup that replaces the topic commits the new service only after a valid backend result. A contextual lookup keeps the existing expiry. Repeating the same clarification does not extend its lifetime. Privacy, scope, service conflicts and unsupported procedures still block protected actions. See [QA2 trace diagnosis](../v04-qa2-diagnostics.md).

An explicit selection of one complete catalog name can start an overview lookup with no prior topic. A recognized answer to a pending service clarification uses the pending benefit. The short Egyptian Arabic CBC label `صورة دم` is accepted as a whole selection only when a service clarification is pending or CBC is already active. A repeat against active CBC keeps its expiry. A conflicting service or scope verdict prevents these shortcuts. Positive evidence of a requested benefit is required to use an active topic. A verbatim quote accompanies semantic grounding when the current text does not otherwise confirm the same benefit and policy purpose. Distinct non-lookup replies cover name, policy tier and branch questions. The only protected read remains the session-scoped coverage call.

## Alternatives and trade-offs

- Free-form LLM response after tool result: more natural but adds hallucination risk for co-pay, limits and approval; postpone until output-grounding evals exist.
- All rule-based chat: fast and deterministic but weak natural-language coverage and Arabic understanding; keep only as offline demo mode.
- Multi-agent workflow / RAG: no need for this narrow lookup and adds operational complexity.

## Risks / prerequisites

- Real member messages can carry sensitive data, even if no profile is attached. Never use real data in this demo or external API without compliance approval.
- Fixed `x-demo-session` tokens are not authentication and are enabled only by explicit demo flag on local loopback; replace with a true trusted session service and backend authorization.
- HTTPS integration and model-choice accuracy unverified without an approved key. The first provider adapter uses raw Anthropic HTTPS for minimal dependencies; a follow-up can adopt its official SDK.
- Validate production backend response schemas, reauthorization, data minimization, refusal cases and audit trails before real data.
