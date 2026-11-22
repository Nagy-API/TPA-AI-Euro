# Diagram 05 — Conceptual data relationships AI depends on

```mermaid
erDiagram
    INSURER ||--o{ CORPORATE_CLIENT : contracts_with
    CORPORATE_CLIENT ||--o{ GROUP : defines
    GROUP ||--o{ POLICY_TIER : offers
    POLICY_TIER ||--o{ BENEFIT_RULE : configured_by
    CORPORATE_CLIENT ||--o{ MEMBER : enrolls
    POLICY_TIER ||--o{ MEMBER : assigned_to
    MEMBER ||--o{ AUTHORIZED_SESSION : authenticates_as
    MEMBER ||--o{ COVERAGE_QUERY : asks
    BENEFIT_RULE ||--o{ COVERAGE_QUERY : evaluated_for
```

**Conceptual only; NOT a database schema.** Real TPA may require policy history, dependents, overlap rules, endorsements, validity dates, network exclusions and many-to-many relations. Core/backend data architect owns the actual schema; AI team owns tool contracts and least-privilege access.
