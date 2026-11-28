> **Cost decision:** Live Anthropic evaluation remains deferred pending explicit approval. The fixture preview runs offline and the opt-in Ollama evaluation uses the local server.

# AI intent evaluation runbook (synthetic only)

The `evals/intent-cases.json` dataset contains **21 fictional Arabic/English questions**, including the original 14. Expected outcomes are `MRI`, `CBC`, `XRAY`, or `CLARIFY`. The standalone follow-up case expects `CLARIFY` because the evaluator has no verified conversation state.

## Step 1 — inspect cases without API calls

```bash
npm run eval:cases
```

## Local Ollama evaluation

Check that `ollama list` shows the installed tagged model and `ollama show qwen3:4b-instruct` lists `tools`. Use a loopback Ollama service. To disable cloud features at the Ollama server, set `OLLAMA_NO_CLOUD=1` in its environment and restart its process. See [Ollama's cloud configuration](https://docs.ollama.com/faq#how-do-i-disable-ollamas-cloud-features).

```powershell
$env:DEMO_INTENT_MODE = 'ollama'
$env:OLLAMA_MODEL = 'qwen3:4b-instruct'
npm run eval:ollama
```

The command compares the keyword baseline and Ollama on identical inputs. It emits case ID, expected and actual result, and wall-clock duration. Exit code 1 means at least one Ollama case missed its expected outcome, including a provider error. For a chat HTTP 503 `AI_UNAVAILABLE`, verify the server at `http://127.0.0.1:11434/api/version` and confirm the exact installed model tag. The selector accepts only local GGUF model entries and caps each response at 64 KiB.

### Verified HTTP evaluation

With the same environment, run:

```powershell
npm run eval:ollama:http -- review
npm run eval:ollama:http -- holdout
npm run eval:ollama:http -- grounding-holdout
```

The first command transcribes the [Issue #15](https://github.com/Nagy-API/TPA-AI-Euro/issues/15) matrix supplied in chat. The second replays the first holdout, which was exposed before the service-grounding change. The third runs a separate dataset authored after freezing that change. All use the real verified HTTP route, loopback Ollama, and the synthetic coverage backend. Each case begins with a fresh session, except deliberate unauthenticated rows. Topic setup requests run before measurement. A test clock expires the topic without waiting two minutes.

Each row reports the HTTP status and response code, local model checks, eligibility calls, tool-selection calls, raw tool proposals, actual backend lookup codes and elapsed HTTP time. A prediction matches when the status, response code and exact lookup match the expectation, including zero provider calls for explicitly marked cases. The summary counts correct requested lookups, denied cases with lookups, wrong services, unauthorized lookups, and expected-service cases that got clarification. Model checks and inference totals exclude setup turns. A clear XRAY intent can retrieve a mock policy response with an unknown coverage status.

The app gives chat 30 seconds and returns HTTP 503 `CHAT_TIMEOUT` on deadline. The browser waits up to 35 seconds, allowing time to receive the server's response. Disconnect and imminent session expiry cancel provider fetches. Clicking send again after an error starts an explicit retry. Auth-only browser requests keep their 8-second deadline.

See [measured results](../PROJECT_STATUS.md#pr-16-service-grounding-review) for the integrated runs and remaining misclassifications.

### V0.4 manual transcript regression

Set `DEMO_INTENT_MODE=ollama` and `OLLAMA_MODEL=qwen3:4b-instruct`, then run:

```powershell
node --experimental-strip-types scripts/evaluate-ollama-conversation.ts --manual
```

The suite replays Nagy's fictional Gold Web Chat and a Silver follow-up sequence through verified HTTP. It checks the reply, exact allowlisted lookup count, member and tenant scope, and service topic. It emits the synthetic answers and first model proposals. Use only the included fictional cases. See the [baseline trace and browser evidence](v04-qa2-diagnostics.md#nagy-manual-web-chat).

## V0.6 synthetic conversation evaluation

From the repository root, use Node.js 22.16+ and run the bundled fictional conversation contract:

```powershell
npm run eval:v06 -- --list
npm run eval:v06 -- --stub
```

Listing prints the exact local manifest SHA-256 and scenario IDs. The stub exercises the Responses wire adapter, verified fixture sessions, scoped coverage lookups and deterministic reply rendering. It requires no key and makes no network calls. Its per-request tokens, cost and provider responses are simulated. It deliberately produces one invalid composition plan to verify the approved fallback response.

With your local model or Hub already running, the same contract can be checked via `npm run eval:v06 -- --provider ollama` with `OLLAMA_MODEL` set to the installed local tag, or `npm run eval:v06 -- --provider hub` with `LOCAL_AI_HUB_PROFILE` set to the local profile. The Web Demo and WhatsApp keep their existing provider configuration.

### Paid OpenAI run after explicit approval

Review [the bundled corpus](../evals/v06-synthetic-contract.json) and confirm every turn is fictional. Review the [current model pricing](https://developers.openai.com/api/docs/models/gpt-6.2-sol) and approve the exact SHA-256 printed by `--list` for this checkout. After Nagy approves the run and an existing authorized project key is available, execute these commands in a local PowerShell 7 session outside CI and production. Replace the hash placeholder with the approved digest. Never paste the key into a command, chat or repository file.

```powershell
$env:OPENAI_EVAL_MANIFEST_SHA256 = '<approved SHA-256 from --list>'
$env:OPENAI_API_KEY = Read-Host 'OpenAI project API key' -MaskInput
$env:ALLOW_PAID_LLM = 'true'
try {
    npm run eval:v06 -- --provider openai --allow-paid
} finally {
    $env:ALLOW_PAID_LLM = 'false'
    Remove-Item Env:OPENAI_API_KEY, Env:OPENAI_EVAL_MANIFEST_SHA256 -ErrorAction SilentlyContinue
}
```

The runner uses `gpt-6.2-sol` with `medium` reasoning and Standard processing. The local limits are 240 requests, an estimated USD 5 per process, a 6,144-token conservative request estimate, 1,024 output tokens per request, a 20-second turn inference budget and a 30-minute run deadline. A failed four-turn smoke, unexpected or wrong-scope read, checked fact mismatch, incompatible model/tier/usage, or exhausted budget stops the run. Acceptance requires at least 90% correct required reads and 90% complete scenarios, with zero wrong or unauthorized reads and a paid-run p95 at most 15 seconds. All nine scenarios must pass to meet the rounded 90% threshold on this corpus.

Each turn reports the exact scoped lookup and answer checks plus the composition outcome. The summary counts composition attempts, accepted plans, delivered fallbacks for invalid plans or provider errors, and interrupted attempts. Deterministic turns without composition appear as `not-attempted`. A provider attempt marked `completed` can still yield a rejected plan because the application also enforces required blocks and their order.

Interpretation and grounding can send fictional question text and interpretation can include bounded typed context. Composition sends approved block IDs, labels and focus. Block availability may reflect the fictional fixture shape. The API payload excludes identifiers, OTPs, session tokens, full policy records, rendered answers and authoritative benefit values. `store:false` disables stored response retrieval. Provider caching and abuse-monitoring retention can still apply. Local spend estimates and reservation cannot enforce provider-side billing. An aborted request can incur a charge. See [ADR 0006](decisions/0006-commercial-responses-adapter.md) and [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

## Deferred paid Anthropic run

Get a model identifier from the Anthropic model listing in your account. Set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` **locally** (never Git, PR text, chat, screenshots, terminal logs or an internet-accessible demo). Do not use real patient/customer questions. Then run:

```bash
npm run eval:live
```

This sends the synthetic dataset to Anthropic and may incur charges. The CLI prints case IDs and outcomes. It exits with code 1 on any failed case, 2 when misconfigured, and 0 only when all cases pass.

## Review findings

- Distinguish **tool intent accuracy** from **coverage correctness**: the AI selects only a service code; the deterministic TPA backend provides coverage.
- Inspect errors, prompt ambiguity, latency distribution and provider cost separately. This runner does not currently compute token costs or persist private transcripts.
- Tune prompts/model selection on a development set; retain evaluation examples for regression checks.
- Never promote demo identity, fake policies, or this test harness as approved healthcare processing.

## GitHub Actions status

Initial PR #1 Actions jobs failed *before starting any visible runner steps* (zero steps/runner ID). Job logs were unavailable at inspection. The cause is not proven; investigate repo/account Actions runner availability, eligibility and billing in the GitHub UI before changing workflow YAML on speculation.
