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

## Deferred paid live run

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
