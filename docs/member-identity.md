# Member identity & conversation lifecycle (proposed)

## Rationale

Nagy proposed asking for insurance/card number at the beginning so the system could automatically know the member's plan, tier and relevant information. **Intent accepted**; we add a deterministic authentication gate: identifier lookup alone does NOT prove identity.

## Per-channel experience

- **WhatsApp:** if no verified active session, present a welcome message and request the agreed member identifier via deterministic flow (not LLM); send challenge via previously verified/registered destination; verify challenge; issue scoped server session; then route queries to AI. Phone number alone is insufficient.
- **Mobile app/web:** reuse existing authenticated session (with step-up when needed); do not ask for an ID on every chat. Channel token must be verified server-side.
- **Provider/doctor:** entirely separate roles and access rules; a member chat session must not expose their tools.

## Session state machine

The [synthetic WhatsApp adapter](whatsapp-test-runbook.md) provides an allowlisted test conversation with `login`, `verify` and `logout`. The published fixture code is supplied separately from the chat prompts. The sender key stores only the local challenge or opaque verified-session token. The test listener uses its own instance of the shared demo authentication service.

`NEW -> AWAITING_IDENTIFIER -> CHALLENGE_PENDING -> VERIFIED -> EXPIRED/REVOKED`. Failed identification/OTP should return generic messages, with attempt limits. Re-authentication occurs on expiry or sensitive action; session switching must revoke old scopes.

## Security requirements

- Anti-account-enumeration: do not reveal whether a guessed ID is registered during challenge initiation.
- Only pre-registered, verified challenge destinations; avoid sending OTP to newly provided number.
- OTP expiry, single use, per-account/channel limits, abuse alerting, resend control; never log raw OTP.
- Session bound to verified principal, tenant and channel; TTL, logout, revoke, device consideration.
- Do not pass `memberId`, `tenantId`, tier or coverage override as LLM tool arguments. Tool may accept **serviceCode**, **location filters**, or another non-authoritative query parameter. Backend resolves principal.
- Backend enforces membership/tenant access at **every request**, regardless of AI's prompt.
- Member ID, national ID and health data are not included in telemetry/model calls unless specifically justified and approved; national ID must not be default login field.
- Consent, retention, international data processing and vendor contracts must be reviewed by designated legal/compliance personnel before production data use.

## Verification proof vs product behavior

For an early mock demo use a clearly labeled synthetic challenge. This tests flow and boundaries, **not** production-grade OTP or legal compliance. Security acceptance is necessary before real members access the AI.

## Unresolved domain decisions

1. Which exact identifier is accepted and unique across insurers, clients and tenants?
2. How do insurer/company/TPA administrators, dependents and family members authenticate?
3. How does the backend determine tenant context for the entered identifier?
4. Which channel handles OTP; can members without registered mobile use an alternative?
5. What session TTL/step-up/privacy requirements does the TPA approve?
