# Agent task prompt — fill before use

## Goal
Implement **[one small feature]** in the TPA AI service.

## Context
Repository: [verified URL]. Branch: [verified branch]. Last commit: [verified SHA]. Read README, AGENTS, PROJECT_STATUS, HANDOFF, architecture, identity flow, API contracts and relevant ADRs.

## Scope
Change only [paths]. Preserve all existing functionality and user/tenant isolation. Synthetic data only. Do not alter the real TPA backend or API contract without review.

## Requirements & constraints
- No sensitive identifiers or OTP in LLM requests/logs.
- Model never chooses memberId, tenantId or clinical decisions.
- Typed allowlisted tools; verified session required for coverage.
- Keep code clear, maintainable and minimal; no speculative dependencies.

## Acceptance criteria
[List happy, error, cross-tenant, expired session and malicious prompt cases with expected behavior.]

## Tests
Run actual available unit, integration and type checks. Document commands, exit codes, failures and environmental blockers. Do not claim tests that were not run.

## Safety gates
No production deployment, secrets, public visibility change, destructive DB migrations, force push, PR merge or branch deletion without Nagy's approval.

## Final response
Completed / Verified (real commands/results) / Unverified / Files changed / Risks / Next action. Update PROJECT_STATUS, CHANGELOG, HANDOFF and affected ADRs appropriately.
