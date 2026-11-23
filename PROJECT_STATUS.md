# Project Status — source of truth

**Last review:** 2026-11-23  
**Lifecycle:** Offline verification and coverage integration candidate verified locally, with Nagy's review pending.

**Owner:** Nagy's AI workstream  
**Repository:** `Nagy-API/TPA-AI-Euro` (private), default branch `main`  
**Known main baseline before this branch:** `8c526e2398f84cb77d457ec0a7d971d9fa6036d0`  
**Implementation branch:** `feat/coverage-inquiry-v1`  
**Coverage base:** Draft [PR #1](https://github.com/Nagy-API/TPA-AI-Euro/pull/1), `bd3406439e8a86e00a1e0eecb9c4f62190d6825a`

**Integration candidate:** `integration/offline-member-journey`, [Issue #6](https://github.com/Nagy-API/TPA-AI-Euro/issues/6)

## Integration verification — 2026-11-23

- PR #4 `3765e32` and PR #5 `6db4bc4` were reviewed and cherry-picked onto the live coverage branch tip without conflicts. The source PRs and PR #1 remain unmerged. The candidate uses the verified challenge flow by default; fixed tokens require explicit `DEMO_AUTH_MODE=legacy`.
- `npm test` passed **53/53** on Node **24.14.1** (npm **11.11.0**). `python scripts/validate_repository.py` passed on Python **3.12.10**. `npm run eval:cases` listed **14** synthetic intent cases without provider calls.
- Strict TypeScript passed using local TypeScript **5.9.3** and `@types/node` **24.19.2**, with all `src`, `scripts`, and `tests` TypeScript files discovered recursively. No dependencies were added to the repository. The PowerShell check uses `$files = Get-ChildItem src,scripts,tests -Recurse -File -Filter '*.ts' | ForEach-Object FullName` followed by `node $tsc --noEmit --strict --target ES2022 --module NodeNext --allowImportingTsExtensions --types node --typeRoots $nodeTypes $files`. Set `$tsc` to the local compiler entrypoint and `$nodeTypes` to the directory containing the `node` declarations.
- `node --experimental-strip-types src/index.ts` with `ENABLE_DEMO_AUTH=true`, `DEMO_INTENT_MODE=fixture` and an ephemeral loopback port passed a PowerShell HTTP smoke test. Health returned 200, challenge returned 202, wrong/unknown/replayed codes returned 401, and sessions returned 200. The Arabic Gold MRI reply gave 20% copay, EGP 5,000 remaining and a preapproval requirement. Silver MRI was excluded and VIP MRI gave EGP 12,000 remaining. A Gold session retained the Gold output even when the request named the VIP tenant and member. Logout revoked access with a subsequent 401.
- A separate in-process loopback check used `node --experimental-strip-types --input-type=module -` with an injected clock and backend faults. Identity failure returned 503 `IDENTITY_UNAVAILABLE`; coverage failure and a wrong-service result returned 503 `COVERAGE_UNAVAILABLE`. Replies suppressed diagnostics and fixture amounts. After recovery coverage returned 200. At the ten-minute expiry boundary the session returned 401 `VERIFICATION_REQUIRED`. The combined suite also checks expiry, failed verification, verified scope, production refusal, and the offline selector boundary.
- Hosted CI on PR #1 was rechecked with `gh pr checks 1 --repo Nagy-API/TPA-AI-Euro` and `gh api repos/Nagy-API/TPA-AI-Euro/check-runs/<id>/annotations` for checks `137565250013` and `137565250093`. GitHub reported a payment/spending-limit restriction before the jobs started. See [CI diagnostics](docs/ci-diagnostics.md).
- Node 22 runtime, real OTP delivery, live TPA and LLM integrations, and production security remain unverified. The demo codes are public fixtures and the attempt limits are process-local. Nagy reviews the draft before any merge.

## Completed and verified

- [x] Architecture bootstrap and 31 source-of-truth docs/diagram files published in `461868c93b3ffd0eab00ff1f1455be701cfcedb4`.
- [x] GitHub follow-up status commit `8c526e2398f84cb77d457ec0a7d971d9fa6036d0`.
- [x] TypeScript Node 22.16+ demo HTTP server with health route and protected `/v1/chat`.
- [x] Fake **trusted session** resolution and tenant-scoped synthetic TPA coverage backend; no real identities.
- [x] Claude Messages HTTP tool-use intent adapter with allowlisted `get_member_coverage` code-only argument; actual hosted model not invoked.
- [x] Safe deterministic result formatting and clarification/failure paths.
- [x] Offline (non-AI) keyword adapter for API demonstration with no API key.
- [x] Added 14 synthetic intent evaluation cases, a live opt-in evaluation runner, and deterministic evaluator tests.
- [x] Local tests: `npm test` **32/32 passed**, `python scripts/validate_repository.py` passed, strict TypeScript static check passed using installed TypeScript 5.8.3 + Node typings (local global TS tooling). Local curl smoke: healthy, GOLD MRI answer (synthetic), unauthenticated 401.

## Explicitly NOT verified / NOT done

- No actual Claude/DeepSeek/OpenAI live API call; no provider cost or accuracy benchmarks.
- No real OTP, member session, CRM/policy API or healthcare data. Mock tokens are insecure, *localhost demo only*.
- No production security audit, data-residency/privacy/legal assessment, human handoff, access-token lifecycle, runtime tracing, caching or service monitoring.
- No deployed app or production traffic. Real integration and domain contract still need agreement.
- Native Node TS type stripping is experimental; CI currently covers tests/docs, not compilation/type checking on a clean install.

## Next prioritized actions

1. Review PR and tested code; keep `main` unchanged until review/explicit merge approval.
2. Confirm with core Backend + TPA Domain owner: identity/session/auth and Coverage API contract, service taxonomy, fake vs real data.
3. Choose approved Claude model and approved processing/data residency terms; run **synthetic** Arabic model cases with a privately configured key and record tool-choice evaluations.
4. Replace demo identity fixture with authenticated sandbox integration, add authoritative typed tool response schema validation, telemetry redaction, rate limits and abuse protections before any real data.

## Risks / assumptions

- First slice uses `MRI/CBC/XRAY` fake catalog and fictional Gold/Silver/VIP benefits; not approved business coverage rules.
- Real user text can include personal information even when no profile is sent. Never use live personal data until reviewed and appropriately filtered.
- Tool call chooses a service code; it cannot choose member ID, tenant, plan or financial values.

At each accepted change: update this file + `HANDOFF.md` and append `docs/CHANGELOG.md`, with observed SHA, tests and next step.

## Free-first progress — 2026-11-23 (feature branch)

- **Decision:** No paid LLM API keys, hosting, or subscriptions until Nagy approves spending. Offline, synthetic work is the current scope.
- Added **runtime coverage payload validator**: rejects wrong service/provenance/currency/status, invalid numbers and contradictory excluded/unknown financial fields; on failure returns generic `COVERAGE_UNAVAILABLE`.
- Added **offline-by-default demo selector factory**: setting an API key alone does not enable paid calls; Claude mode requires `DEMO_INTENT_MODE=claude` and `ALLOW_PAID_LLM=true` plus credentials.
- Local evidence: `npm test` 32/32 passed; `tsc --noEmit --strict ...` passed using local installed TypeScript and Node typings; `python scripts/validate_repository.py` passed; HTTP smoke health 200, GOLD MRI 200, missing session 401.
- Still unverified: real AI model behavior, live TPA API, actual user identity, production security, GitHub CI (job failures before runner start; cause unknown).
- Next free tasks: review fake session/API contract with Core team, offline scenario tests (member/tenant errors, ambiguity), optional local LLM evaluation after confirming Nagy's hardware; preserve clean, replaceable provider boundary.

## Parallel Codex task completion / integration queue (2026-11-23)

- [x] Codex A completed implementation proposal for **fictional local member verification**, PR [#5](https://github.com/Nagy-API/TPA-AI-Euro/pull/5) (`feat/demo-member-verification`, head `6db4bc466572584a73a5f9ba4b82d5c252b3d7b0`); agent-reported **48/48 local tests**. **Not yet merged or independently retested as part of combined suite.**
- [x] Codex B completed **offline contract regressions + GitHub CI diagnosis**, PR [#4](https://github.com/Nagy-API/TPA-AI-Euro/pull/4) (`test/offline-qa-ci`, head `3765e32c0b3328a2adba6c799e01c989d9ce7549`); agent-reported **37/37 local tests**. **Not yet merged or independently retested as part of combined suite.**
- Both PRs target `feat/coverage-inquiry-v1`, which in turn targets `main` through Draft PR #1. `main` unchanged as verified; **no full integrated working tree or CI-green build yet**.
- CI blocker more specifically diagnosed by Codex B: GitHub check annotations say *"The job was not started because recent account payments have failed or your spending limit needs to be increased."* Jobs had no allocated runner/steps. Root billing condition (failed payments vs spending limit) unresolved; GitHub account owner may inspect settings, **no spending approved**.
- Review found proposed component boundaries generally aligned; PR #5 adds **demo-only public fixed codes** and requires main README/runbook update. Cannot treat this authentication as real identity proof.
- Next milestone tracked in [Issue #6](https://github.com/Nagy-API/TPA-AI-Euro/issues/6): one-writer integration review, combined offline tests, documentation sync, prepare draft integration candidate; **no merges without Nagy's approval**.
- **Workspace rule:** no new sibling clones/worktrees; primary project folder only; one active writer/branch-switching owner if two Codex clients share files.
- **Agent model rule:** every new Codex task gets a model + effort recommendation; default `GPT-6.2 Sol — Medium`, reserve High for genuinely difficult reviews.
