> **Cost decision (2026-11-23): Live Anthropic evaluation is DEFERRED. Do not run paid provider tests or request API keys without Nagy's explicit approval. The current safe commands are `npm test` and `npm run eval:cases` (offline, no provider use).**

# AI intent evaluation runbook (synthetic only)

The `evals/intent-cases.json` dataset contains **14 fictional Arabic/English coverage questions**. Each case has an expected outcome: either a single allowed service code (`MRI`, `CBC`, `XRAY`) or `CLARIFY`. The seven flagged critical cases cover ambiguous requests, multi-service requests, prompt injection, and invalid coverage/approval claims.

## Step 1 — inspect cases without API calls

```bash
npm run eval:cases
```

## Step 2 — explicitly authorize a paid live run

Get a model identifier from the Anthropic model listing in your account. Set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` **locally** (never Git, PR text, chat, screenshots, terminal logs or an internet-accessible demo). Do not use real patient/customer questions. Then run:

```bash
npm run eval:live
```

This sends **14 synthetic questions** to Anthropic and may incur charges. The CLI intentionally prints *case IDs and outcomes*, not the full prompts, API keys or provider error details. It exits with code 1 on any failed case, 2 when misconfigured, and 0 only when all cases pass. A passing test suite doesn't prove production accuracy. Never merge code based solely on this score; review failed cases, especially all `critical` examples.

## Step 3 — review findings

- Distinguish **tool intent accuracy** from **coverage correctness**: the AI selects only a service code; the deterministic TPA backend provides coverage.
- Inspect errors, prompt ambiguity, latency distribution and provider cost separately. This runner does not currently compute token costs or persist private transcripts.
- Tune prompts/model selection on a development set; retain evaluation examples for regression checks.
- No live model run is verified unless an authorized key and explicit command are used.
- Never promote demo identity, fake policies, or this test harness as approved healthcare processing.

## GitHub Actions status

Initial PR #1 Actions jobs failed *before starting any visible runner steps* (zero steps/runner ID). Job logs were unavailable at inspection. The cause is not proven; investigate repo/account Actions runner availability, eligibility and billing in the GitHub UI before changing workflow YAML on speculation.
