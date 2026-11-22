# Definition of Done

A task is DONE only when:

1. Expected behavior & acceptance criteria are written and implemented within scope.
2. Input/output and authorization boundaries are explicit; errors are safe and deterministic.
3. Unit and negative tests exist where relevant (especially unauthenticated, expired, cross-tenant, unavailable API, malformed data); exact commands and results are recorded.
4. Agent/reviewer has inspected code diffs and avoided unrelated changes.
5. Documentation and affected diagrams/contracts updated; changelog/status updated; handoff if milestone changed.
6. No secrets or real patient data committed; demo mocks labeled.
7. Any unverified condition/risks recorded clearly before merge.

**Not required for V1:** speculative features, separate microservices, new ML training, rich vector search, perfect UI or zero future refactoring. **Never compromise:** authorization correctness, safe medical boundary, identifiable data protection, source-of-truth rules.

**Demo-ready** means synthetic end-to-end path works and limitations disclosed. **Production-ready** additionally requires approved integrations, tests, security/privacy validation, monitored deployments and domain sign-off.
