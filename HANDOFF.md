# Handoff to a new ChatGPT conversation, Codex or Claude

## First sentence for a new agent

"You are continuing Nagy's TPA AI workstream. Inspect the current GitHub repository first and read README.md, AGENTS.md, PROJECT_STATUS.md, and this HANDOFF.md; **do not assume** the README describes implemented code. Report actual verified repo state before proposing changes. Speak Egyptian Arabic to Nagy; use English for agent prompts and code."

## Mission

Design and build the secure **AI layer** in-house for a medical insurance Third-Party Administrator (TPA) platform. Learn-by-building with Nagy. The broader TPA core business backend is owned by another team; coordinate via contracts, fixtures, versioned APIs.

## Settled direction (architecture proposals, not external commitments)

- Scope V1 is a verified-member coverage assistant using an authenticated backend session, tool calling, mock backend first, later real integration.
- The first insurance number / card ID message belongs to deterministic Identity Gateway, **not to the LLM**. Verify via approved OTP or other method; secure web/mobile sessions may skip repeated ID entry.
- Discover membership tier/policy from trusted backend; **never trust user's claimed tier** or an LLM-picked member ID. Only query per-request minimal authorized context.
- Human owns medical decisions; deterministic core owns eligibility/coverage/financial rules.
- Prefer simple TypeScript/Node.js modular service, pending technical alignment with core team. No premature microservices/agent frameworks/RAG.
- Use fictitious data. Sensitive health/insurance data must not enter Git or unmanaged LLM providers.
- Version 1: small, reliable core with clean extension points; version 2: richer modules after evidence and agreement.

## What's verified vs unknown

- VERIFIED (source discussion): user wants repository documentation and continuity; user/team built a multi-screen TPA prototype landing page; three audio notes and two documents were considered in prior conversation.
- NOT VERIFIED: actual prototype source, production API availability, DB schema, authentication mechanism, policy rule specification, integration tests, legal approvals, model configuration, any real release or deployment.
- Do not re-create or invent requirements from source documents if unavailable. Ask for source access when needed.

## Latest status / next action

Read `PROJECT_STATUS.md` for the latest factual state. As of 2026-11-22, the private GitHub repository `Nagy-API/TPA-AI-Euro` on branch `main` was verified with an initial 13-byte README (`3d50b5fe163e3d9c880b5ffe956c220426b25cfb`); a local 31-file scaffold passed documentation/fixture checks. At preparation time upload is pending; **verify actual remote commit and content before changing this statement**. Next: publish scaffold; then settle identity + coverage API contracts with the backend/domain owners.

## How to work with Nagy

1. Natural Egyptian Arabic, address him as Nagy, be direct and collaborative.
2. Challenge bad assumptions; explain trade-offs concisely.
3. Prioritize execution and teach in parallel; no course prerequisite.
4. Produce ready-to-run prompts for coding agents, but inspect their diffs/tests rather than accepting claims.
5. When hands-on, issue 1–3 precise next steps. No unnecessary repeated questions.
6. Update the repo's durable docs/decisions/status after substantial work.
7. Do not claim tools, tests or deployment unless actually verified; protect secrets and collaborators' uncommitted work.

## New-session handoff checklist

- Repository URL / remote access: https://github.com/Nagy-API/TPA-AI-Euro (private; accessible via connected GitHub tools)
- Default branch: main (verified)
- Last commit SHA: initial pre-upload head `3d50b5fe163e3d9c880b5ffe956c220426b25cfb`; recheck after publishing
- Current PR / issue: NONE
- Completed implementation: NONE VERIFIED
- Pending: remote creation, mock service, contract alignment, tests
- Blockers: identity/tenant/channel and real coverage API details
- Security gates: private repo; synthetic test data; no medical AI decisions; no direct DB

When these values change, update **both** `HANDOFF.md` and `PROJECT_STATUS.md` with concrete verified identifiers and results.
