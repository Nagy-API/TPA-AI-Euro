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

The command compares the keyword baseline and Ollama on identical inputs. It emits case ID, expected and actual result, and wall-clock duration. Exit code 1 means at least one Ollama case missed its expected outcome, including a provider error. For a chat HTTP 503 `AI_UNAVAILABLE`, verify the server at `http://127.0.0.1:11434/api/version` and confirm the exact installed model tag. Each question has a shared 30-second provider deadline, including the manifest lookup and any inference. The selector accepts only local GGUF model entries and caps each response at 64 KiB.

See [measured results](../PROJECT_STATUS.md#v03-local-ollama-review) for the reference run. The fixed suite was used during prompt tuning and provides regression evidence. Generalization needs an independent holdout.

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
