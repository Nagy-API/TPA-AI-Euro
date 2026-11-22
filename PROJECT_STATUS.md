# Project Status — source of truth

**Last review:** 2026-11-23  
**Lifecycle:** First vertical slice implemented locally; feature branch PR pending review  
**Owner:** Nagy's AI workstream  
**Repository:** `Nagy-API/TPA-AI-Euro` (private), default branch `main`  
**Known main baseline before this branch:** `8c526e2398f84cb77d457ec0a7d971d9fa6036d0`  
**Implementation branch:** `feat/coverage-inquiry-v1`  
**First implementation commit:** `5df0d9e946e55f976f90694d765eb039fd3195e4` · **Draft PR:** [#1](https://github.com/Nagy-API/TPA-AI-Euro/pull/1). Always inspect live branch HEAD.

## Completed and verified

- [x] Architecture bootstrap and 31 source-of-truth docs/diagram files published in `461868c93b3ffd0eab00ff1f1455be701cfcedb4`.
- [x] GitHub follow-up status commit `8c526e2398f84cb77d457ec0a7d971d9fa6036d0`.
- [x] TypeScript Node 22.16+ demo HTTP server with health route and protected `/v1/chat`.
- [x] Fake **trusted session** resolution and tenant-scoped synthetic TPA coverage backend; no real identities.
- [x] Claude Messages HTTP tool-use intent adapter with allowlisted `get_member_coverage` code-only argument; actual hosted model not invoked.
- [x] Safe deterministic result formatting and clarification/failure paths.
- [x] Offline (non-AI) keyword adapter for API demonstration with no API key.
- [x] Local tests: `npm test` **16/16 passed**, `python scripts/validate_repository.py` passed, strict TypeScript static check passed using installed TypeScript 5.8.3 + Node typings. Local curl smoke: healthy, GOLD MRI answer (synthetic), unauthenticated 401.

## Explicitly NOT verified / NOT done

- No actual Claude/DeepSeek/OpenAI live API call; no provider cost or accuracy benchmarks.
- No real OTP, member session, CRM/policy API or healthcare data. Mock tokens are insecure, *localhost demo only*.
- No production security audit, data-residency/privacy/legal assessment, human handoff, access-token lifecycle, runtime tracing, caching or service monitoring.
- No deployed app or production traffic. Real integration and domain contract still need agreement.
- Native Node TS type stripping is experimental; CI currently covers tests/docs, not compilation/type checking on a clean install.
- **CI failed for both workflows on first PR run** (AI demo tests run `45075707219`, docs validation run `45075707121`). GitHub job logs were unavailable (`BlobNotFound`), so the root cause is **UNKNOWN**. Local tests still passed; do not mark CI green.

## Next prioritized actions

1. Investigate failing GitHub Actions workflow runs on Draft PR #1. Job step details/logs unavailable during inspection; do not infer cause.
2. Review PR and tested code; keep `main` unchanged until review/explicit merge approval.
3. Confirm with core Backend + TPA Domain owner: identity/session/auth and Coverage API contract, service taxonomy, fake vs real data.
4. Choose approved Claude model and approved processing/data residency terms; run **synthetic** Arabic model cases with a privately configured key and record tool-choice evaluations.
5. Replace demo identity fixture with authenticated sandbox integration, add authoritative typed tool response schema validation, telemetry redaction, rate limits and abuse protections before any real data.

## Risks / assumptions

- First slice uses `MRI/CBC/XRAY` fake catalog and fictional Gold/Silver/VIP benefits; not approved business coverage rules.
- Real user text can include personal information even when no profile is sent. Never use live personal data until reviewed and appropriately filtered.
- Tool call chooses a service code; it cannot choose member ID, tenant, plan or financial values.

At each accepted change: update this file + `HANDOFF.md` and append `docs/CHANGELOG.md`, with observed SHA, tests and next step.
