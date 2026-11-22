# TPA AI Service — In-House AI Layer

> **Status:** Discovery / architecture baseline (V0.1). **Not production-ready.**  
> **Last updated:** 2026-11-22. **GitHub repository:** [`Nagy-API/TPA-AI-Euro`](https://github.com/Nagy-API/TPA-AI-Euro).  
> **Visibility:** PRIVATE (verified 2026-11-22). Do not add real patient data or credentials.

## المشروع باختصار

ده الـAI Layer المقترح لمنصة Third-Party Administrator (TPA) للتأمين الطبي. بنتعلم ونبني بالتوازي؛ بنستخدم Coding Agents في التنفيذ لكن القرارات، الـArchitecture، والاختبارات مسؤوليتنا.

**أول هدف قابل للتسليم:** Policy-aware member assistant مع هوية موثقة وCoverage Lookup باستخدام Mock Backend، ثم real integration بعد اتفاق الفريق على الـAPI contracts.

## Product intent

The full TPA platform may include insurers, corporate clients, groups, plans, member eligibility, benefits, provider network, approvals, claims, and dashboards. **This repository is ONLY the AI layer** and its contracts and test assets, not the full core TPA platform.

Initial proposed AI responsibilities:
- Member-facing policy-aware assistant, chat routing, and supported tool use.
- Document extraction (later), human-reviewed clinician summaries (later).
- Knowledge retrieval over approved, versioned documents (later).
- Operational insights / anomaly detection (future, separate scope).

**Non-responsibilities:** medical approval/rejection; claims adjudication; policy calculation; identity authorization; direct database access; independent changes to member records.

## Start here (for humans or a new AI agent)

Read these files **in order**:

1. [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — latest actual status, verified work, blockers, next action.
2. [`HANDOFF.md`](HANDOFF.md) — what another chat or agent must know.
3. [`AGENTS.md`](AGENTS.md) — how to work with Nagy, safety and evidence rules.
4. [`docs/architecture.md`](docs/architecture.md) — system boundaries and technical decisions.
5. [`docs/member-identity.md`](docs/member-identity.md) — authentication gate before AI.
6. [`docs/api-contracts.md`](docs/api-contracts.md) — first proposed REST contracts, errors.
7. [`ROADMAP.md`](ROADMAP.md) — incremental milestones and acceptance criteria.
8. [`docs/first-vertical-slice.md`](docs/first-vertical-slice.md) — first end-to-end implementation plan.
9. [`docs/diagrams/`](docs/diagrams/) — editable Mermaid diagrams.

## Current architecture (proposed)

```mermaid
flowchart TB
  User[Member via WhatsApp / App / Portal] --> Channel[Channel Adapter / Identity Gateway]
  Channel --> Auth[TPA Auth & Session Service]
  Auth -->|verified, scoped session| AI[Modular AI Service]
  AI --> LLM[LLM Provider Adapter]
  AI --> Tools[Allowlisted Tool Gateway]
  Tools --> Core[TPA Backend Business APIs]
  Core --> Policy[Deterministic Coverage & Policy Engine]
  AI --> Logs[Redacted audit / telemetry]
  Med[Doctor / employee] --> Core
```

**Core rule:** verified session comes from trusted backend, NOT a member ID picked by an LLM. Data retrieved for each question must be minimal and appropriately authorized. The LLM drafts explanations, not medical/financial decisions.

## Stack direction (subject to team agreement)

- TypeScript + Node.js (proposed due to prior prototype's Node.js role split).
- Official provider SDK, simple function/tool calls before agent frameworks.
- Zod for boundaries; Vitest for tests; Docker when service code starts.
- LLM provider **not chosen**. Compare models against Arabic TPA evaluation cases, data-processing constraints, latency and price.
- Do not introduce a vector database, LangChain, microservices, or OCR service without a demonstrated use case.

## Scope and sources

The initial planning inputs were: (1) user-shared TPA AI proposal dated 2026-11-21, (2) three WhatsApp voice notes (Nov 21–22), (3) Limitless Care corporate profile shared as a **benchmark**, and (4) the team-created TPA AI In-House Hub: https://qr.euro-assist.com/TPA_Prototype/index.html. Prototype landing-page claims are **not verified code features**. Source files are intentionally not copied here and may include confidential data. All scope estimates and requirements need confirmation with product/domain owners.

## What is not done

No live backend integration, no actual LLM endpoint, no user accounts, no live OTP delivery, no production data, no deployed app, no security certification, and no passing test suite are claimed at this stage.

## Workflow and reporting

- Every meaningful change should update `PROJECT_STATUS.md` and append to `docs/CHANGELOG.md`; design changes get a new ADR in `docs/decisions/`.
- Work on short-lived branches/PRs; no production deploy, destructive migration, branch deletion, force push, or secret rotation without Nagy's explicit approval.
- Report what changed, commands run, results, what remains unverified, and next action. No fabricated evidence.
- For requests to resume, **read `HANDOFF.md` and `PROJECT_STATUS.md` first**, then inspect repository status and commit history.

## Success criterion for first vertical slice

A member can identify and verify through trusted backend/mock; a scoped session is established; an Arabic coverage question triggers an allowlisted read-only tool; tool results drive an accurate answer; inaccessible or uncertain data leads to safe clarification/escalation. Test happy path, invalid member, wrong OTP, rate limit, cross-member attempt, unavailable API, and misleading prompt.

## Repository checks

Run `python scripts/validate_repository.py` to check local Markdown links, code fences, JSON and eval definitions; GitHub Actions runs the same sanity check on PRs and pushes to `main`. **This does not prove the application works**, and no LLM/backend integration exists yet.

## First working slice (feature branch, not yet production)

A real, runnable **demo** implementation is under `src/` with no runtime npm dependencies:

- `/health` reports demo status (not production readiness).
- `POST /v1/chat` requires a **synthetic** `x-demo-session` header resolved by the local fixture backend; it never trusts member/tier values in the message or LLM arguments.
- `ClaudeIntentSelector` uses the Anthropic Messages HTTP API tool-use response to pick **one** allowed service code (MRI/CBC/XRAY), with no member ID in tool input.
- A mock backend returns member-scoped deterministic coverage. Output is rendered by a **deterministic formatter**, not free-form LLM drafting, to prevent hallucinated co-pay/limits/approvals.
- `DemoKeywordSelector` is an explicitly **non-AI offline substitute** for local development and tests.

### Run without an API key (non-AI offline demo)

Requires Node.js 22.16+ (native experimental TypeScript stripping). **Do not expose this HTTP server on a public interface.** It binds to `127.0.0.1` and includes fixed demo tokens. Never send real member data.

```bash
ENABLE_DEMO_AUTH=true DEMO_INTENT_MODE=fixture npm run dev
```

In a second terminal:

```bash
curl -X POST http://127.0.0.1:3000/v1/chat \
  -H 'Content-Type: application/json' \
  -H 'x-demo-session: demo-gold-session' \
  -d '{"message":"هل الرنين المغناطيسي مغطى؟"}'
```

Switch `demo-gold-session` to `demo-silver-session` or `demo-vip-session` to compare **fictional** results. Missing or incorrect session tokens return HTTP 401. `ENABLE_DEMO_AUTH=true` must be explicitly set and the process refuses `NODE_ENV=production`.

### Run with Claude tool-use (requires your own key)

```bash
ENABLE_DEMO_AUTH=true ANTHROPIC_API_KEY='<your key from local secret storage>' ANTHROPIC_MODEL='<model ID verified in your Anthropic account>' npm run dev
```

Unset `DEMO_INTENT_MODE` to use Claude. **Never put keys in Git or chat.** Claude receives the text of the question and the *public fake service catalog*, but no profile, tenant/member ID, token, policy tier or coverage amounts. As with all user text, the question itself could contain personal information; therefore this implementation is for **synthetic queries only**, pending data-handling approval and a PII minimization design.

This integration calls the documented Anthropic Messages HTTPS endpoint directly for now, with a small replaceable adapter; migrating to the official SDK is a planned follow-up. **No real Claude call is claimed as verified** without credentials and measured outputs. Official tool-use docs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works

### Test

```bash
npm test
python scripts/validate_repository.py
```

No `npm install` is needed for the zero-dependency demo. Node.js TypeScript stripping executes code but does **not** type-check it; type-checking was performed locally using TypeScript 5.8.3 + Node type declarations, and automated type-check setup is planned. **Do not deploy this demo**: no genuine OTP/session issuer, persistent storage, concurrency controls, real backend, redacted audit system, regulatory review or production security validation are included.
