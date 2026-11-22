# Domain glossary and scope boundaries

## Terms

- **TPA**: Third-Party Administrator managing health insurance administration/services on behalf of insurers/employers, depending on contracts.
- **Insurer**: insurance entity; **Corporate client**: an employer/customer on a plan; **Group**: plan grouping by product/department/contract; **Tier**: an entitlement category (e.g. VIP/GOLD/SILVER) — **exact hierarchy is to be confirmed**.
- **Member / Beneficiary**: enrolled individual; membership ID may not be globally unique without tenant context.
- **Policy / Benefit**: contract terms and entitlements; **Exclusion**: non-covered service; **Sub-limit**: benefit-specific maximum; **Co-pay**: member share; **Deductible**: eligible out-of-pocket amount.
- **Pre-approval / Preauthorization**: prior human/authorized process for certain procedures. The AI does not issue approvals.
- **Claim**: record of expense/service submitted for review and financial processing.
- **Provider network**: providers with contracts and network categories.

## Product/domain inputs vs confirmed requirements

The initial TPA proposal and user voice notes discuss full TPA workflows, accelerated prototype and AI automation. A separate Limitless Care corporate profile is **competitor/benchmark context only**, not proof of required modules, integrations, or service-level targets. The team-created prototype showcases six linked experiences and VIP/GOLD/SILVER switching in its landing-page description, **not independently verified production functionality**.

## AI V1 in scope

- Deterministic member identification + authorized session **integration** (owned by backend, mocked initially).
- Coverage information conversational UI using trusted coverage API and minimal data.
- Tool invoking, safe fallbacks, evaluation, observability and redacted evidence.

## Out of scope for AI V1

- Full TPA DB, policy underwriting, benefit calculations, clinical approvals or claims settlements.
- Live production patient data, real provider network/map/medical OCR, advanced RAG or fraud ML.
- All WhatsApp vendor billing/production integrations without verified vendors, approval and infrastructure.

## Open questions to confirm with TPA domain owner

Who is the legal service operator and tenant? What are the actual roles and hierarchy? What sources determine member eligibility and tier? How do dependents work? What data are approved for sharing with an LLM? Where is clinical approval performed? What is the first demo audience and must-have flow?
