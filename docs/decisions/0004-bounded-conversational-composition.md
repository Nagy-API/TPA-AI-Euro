# ADR 0004 — Bounded conversational composition

Status **Experimental for the synthetic verified demo** · 2026-11-28

## Context

V0.4 uses local Ollama to interpret a turn and corroborate service or follow-up evidence. It renders deterministic approved replies. V0.5 adds bounded continuity, a transport comparison and the ability to arrange and combine approved reply clauses.

## Decision

- The provider interface sends ordered messages, a closed JSON output schema, a token cap and the remaining inference budget. The Hub adapter uses a fixed loopback `POST /v1/inference` URL and an allowlisted local profile. The direct adapter calls the installed loopback Ollama model. Both receive the same orchestration inputs. A future commercial adapter needs separate privacy and cost approval.
- TPA owns one active service, a pending clarification, or a public referral per verified session. It also keeps up to three sanitized turn summaries, individually expiring after two minutes or at session expiry. The summary contains approved topic or reply labels. The interpretation and focused grounding requests use the current synthetic question. Only interpretation receives the earlier summaries. Concurrent turns in the same verified session are serialized by rejecting an overlapping request.
- Interpretation returns one candidate `get_member_coverage` read or abstention. TPA corroborates the service and purpose using its resolver, current-turn evidence and where needed a separate grounding request. An explicit service proposal names one catalog subject. A contextual proposal omits a service argument, and TPA reads only the matching verified active topic. The mock backend checks the trusted session again before the read. Session tokens, member IDs, tenant IDs and policy versions stay in TPA.
- The composer receives only labels for approved clauses available in the answer. TPA constructs those clauses from validated mock data or approved public definitions and examples. It renders exact coverage status, currency, amounts and conditions in the result. Plans must include every mandatory clause once and use only approved optional explanation or acknowledgment IDs. Invalid plans and ordinary drafting failures use the deterministic approved reply. A model deadline returns `CHAT_TIMEOUT`.
- One 20-second ceiling covers inference stages and is limited further by the verified session and HTTP request deadlines. Logout, session rotation, request disconnect and request or session expiry cancel the turn. TPA checks session validity before protected reading and before releasing a response and committing context.

## Trade-offs

Structured block composition gives the model control of presentation and supporting explanations. Available covered-benefit clauses are inferred by TPA from the result, and no actual benefit values are sent to the provider. The limited clause vocabulary and known synthetic catalog bound answer variety. A small model can still misread intent or decline valid paraphrases. A successful synthetic smoke test does not measure general conversational usefulness.

See [browser setup and walkthrough](../../README.md#run-the-v05-conversational-experiment) and [current verification](../../PROJECT_STATUS.md#v05-bounded-conversational-experiment).
