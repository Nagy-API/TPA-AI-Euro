# ADR 0003 — Tool selection by LLM, deterministic coverage response (first slice)

Status: **Accepted for isolated V1 demo only**, pending core/domain review. Date: 2026-11-23.

## Context

Financial/coverage values and medical approvals must not be invented by an LLM. We need a useful AI integration milestone before the core TPA backend is available. Live models may hallucinate even when tool results are present.

## Decision

Use Claude Messages API tool use to select exactly one service code (`MRI`, `CBC`, `XRAY`) from a public *fictional* catalog. Code validates this tool name and argument, uses the already-verified trusted session to look up a fake policy-engine result, and formats the result deterministically. No member ID/tier/tenant or result value is accepted from the LLM. The model never grants/rejects medical care. An offline keyword selector is provided for no-key tests and must be described as non-AI.

### 2026-11-24 — Local Ollama extension pending architectural review

Verified demo mode may opt into Ollama at a fixed loopback endpoint with a locally installed model. The adapter first asks for a schema-constrained eligibility decision without tools, then asks an eligible question to select the same single allowlisted tool. Both responses are untrusted and parsed at runtime. Multiple distinct service calls clarify without a lookup. Selector failures surface as `AI_UNAVAILABLE`. Fixture selection stays the default. The application owns identity, conversation topic, backend access and formatting. See [local evidence](../../PROJECT_STATUS.md#v03-local-ollama-review).

The application also checks recognizable third-party subjects before model or policy access and clears the conversation topic on refusal. The HTTP route owns the chat deadline and passes cancellation to the model adapter. The same verified session continues to enforce member and tenant authorization on each lookup. See the [review follow-up evidence](../../PROJECT_STATUS.md#pr-16-architectural-review-follow-up).

## Alternatives and trade-offs

- Free-form LLM response after tool result: more natural but adds hallucination risk for co-pay, limits and approval; postpone until output-grounding evals exist.
- All rule-based chat: fast and deterministic but weak natural-language coverage and Arabic understanding; keep only as offline demo mode.
- Multi-agent workflow / RAG: no need for this narrow lookup and adds operational complexity.

## Risks / prerequisites

- Real member messages can carry sensitive data, even if no profile is attached. Never use real data in this demo or external API without compliance approval.
- Fixed `x-demo-session` tokens are not authentication and are enabled only by explicit demo flag on local loopback; replace with a true trusted session service and backend authorization.
- HTTPS integration and model-choice accuracy unverified without an approved key. The first provider adapter uses raw Anthropic HTTPS for minimal dependencies; a follow-up can adopt its official SDK.
- Validate production backend response schemas, reauthorization, data minimization, refusal cases and audit trails before real data.
