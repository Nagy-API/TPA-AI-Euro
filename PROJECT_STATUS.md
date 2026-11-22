# Project Status — source of truth

**Last review:** 2026-11-22  
**Lifecycle:** Planning / architecture bootstrap  
**Owner:** Nagy (AI workstream); GitHub target owner `Nagy-API`  
**Repository:** Local starter scaffold only. **Remote GitHub repo has NOT been created** by this bootstrap.  
**Target name:** `tpa-ai-service` (PRIVATE recommended)  
**Default branch / commit SHA / PR:** UNVERIFIED until remote creation.

## Completed (documented, not implemented)

- [x] Captured project charter and initial AI/service ownership boundary.
- [x] Selected member-authentication gate **before** data-aware AI conversation as proposed architecture.
- [x] Created proposed context, sequence, use-case and state diagrams as Mermaid source.
- [x] Drafted initial contracts, discovery questions, tests, roadmap, governance, and handoff rules.
- [x] Prepared fictional demo scenarios and evaluation dataset draft.
- [x] Added first-vertical-slice task plan and repository-documentation validation script/CI workflow.

## Verified implementation evidence

- Repo bootstrap sanity validation **ran locally** on 2026-11-22: `python scripts/validate_repository.py` => `Validation OK` (links, Markdown fences, JSON, 9 draft eval cases). **This is only documentation/fixture verification.**
- No application runtime has been implemented or validated as part of this scaffold.
- No live backend/tool integration or end-to-end tests have run.
- The parent prototype's landing page was read, but its inner screens and source code were **not** inspected by this effort.

## Next prioritized actions

1. Upload this scaffold to verified private GitHub repository `Nagy-API/TPA-AI-Euro`, then capture publication commit SHA and verify contents.
2. Hold a short Backend + TPA Domain alignment: identity source/OTP channel/session model/tenant lookup; coverage response and error contract; approval authority; demo vs real data.
3. Implement mock identity gate + `get_member_coverage` tool + deterministic fixtures; connect 1 LLM provider and build evaluation tests for coverage and failure paths.

## Blockers / unknowns

- Does member identity use insurance card ID, company-issued member number, national ID, or provider-issued mapping? **Unconfirmed.** National ID should not be the default requested identifier.
- Auth system, tenant resolution, session lifetime, supported channels and regulatory/privacy requirements **unconfirmed**.
- Exact policy engine contract, service code taxonomy and medical authorization workflow **unconfirmed**.
- Actual team staffing and core backend language, deploy platform, LLM provider and data residency **unconfirmed**.
- Dates and budgets in original proposal are **estimates**, not verified scope commitments.

## Change log discipline

At the end of each merged task: check off a roadmap item if accepted, add test evidence, and update this file's next steps. If an item isn't proven by code/tests, mark it as design-only or unverified. Update `HANDOFF.md` on major milestones.
