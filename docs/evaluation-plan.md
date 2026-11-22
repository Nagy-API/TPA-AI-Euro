# AI evaluation plan: correctness before sophistication

## Goal

Prove the assistant **uses trusted backend results** and refuses/clarifies when data is missing; never infer medical approvals or financial coverage. Track tool selection, factual consistency, cross-member protection, escalation, errors, latency and token cost.

## Eval types

- **Deterministic gateway tests:** unauthenticated query, invalid member ID, unknown account, wrong/expired OTP, throttling, tenant mix-up, expired session, cross-member tool attempt.
- **Tool contract tests:** valid/malformed/unknown service, unavailable backend, `coverageStatus=UNKNOWN`, policy version mismatch, missing numeric fields, proper error codes.
- **LLM behavior evals:** Egyptian Arabic, spelling variations, ambiguous exam names, hallucination resistance, prompt injection, medical autonomy refusal, human escalation.
- **Regression set:** known examples with exact expected tool invocation and response semantics.

## Proposed evidence

Capture case ID, fixture version, model/provider/version, input, expected tool, observed tool, expected safety assertions, pass/fail, redacted trace ID, measured latency/cost. **Never** log real policy/member/clinical information.

## Initial fixture dataset

See [`../evals/scenarios.jsonl`](../evals/scenarios.jsonl). Cases are **draft expected behavior**, not passing evaluation evidence.

## Gate to milestone completion

At minimum all deterministic and authorization tests must pass. LLM answer safety evaluation is reviewed on real outputs; no invented test coverage percentages. Any missed high-risk safety case blocks progression to live sensitive data.
