# API contracts V0.1 — DRAFT, not existing endpoints

**Important:** All endpoints, payloads and policies below are **proposals** for the backend team. No existing backend has been tested. Contracts must be agreed and versioned before real integration.

## Trust boundary

- Identity gateway may accept an entered insurance/member number; the **LLM must not**.
- Authenticated member + tenant are read from a trusted session claim on the backend, **never from model-generated input**.
- In examples, IDs and policies are synthetic. All endpoints require mutually agreed authentication and authorization.

### 1. Start identity challenge (gateway-only)

`POST /api/v1/member-auth/challenges`

```json
{"memberIdentifier":"M-DEMO-001","channel":"whatsapp","conversationId":"C-DEMO-001"}
```

Generic response (same public behavior for unknown vs existing identifier):

```json
{"challengeId":"challenge-demo-001","message":"If verification is available for this account, instructions will be sent to its registered contact."}
```

Implement backend-side anti-enumeration, expiry, rate limiting, trusted destination; no response with member name/tier/existence. No OTP in HTTP responses or model context.

### 2. Verify identity (gateway-only)

`POST /api/v1/member-auth/challenges/{challengeId}/verify`

```json
{"oneTimeCode":"<code-entered-by-user>"}
```

Successful response example (server issues secure session; browser/web token handling to be designed separately):

```json
{"sessionEstablished":true,"sessionExpiresAt":"2026-11-22T15:00:00Z"}
```

If unsuccessful, use generic denial and retry controls. Do **not** send raw OTP to LLM/logs. The actual session token/cookie is deliberately excluded from this documentation and mocks.

### 3. Authorized context summary (read-only)

`GET /api/v1/members/me/assistant-context`

Example safe minimal response:

```json
{"displayName":"Demo Member","policyTier":"GOLD","policyVersion":"POL-DEMO-2026-v1","locale":"ar-EG"}
```

`me` is derived from verified session; policy tier is **not** supplied by user. This is an optional endpoint — don't preload full member profile by default.

### 4. Coverage inquiry tool (read-only)

`GET /api/v1/members/me/coverage?serviceCode=MRI`

```json
{
  "serviceCode":"MRI",
  "policyVersion":"POL-DEMO-2026-v1",
  "coverageStatus":"COVERED_WITH_CONDITIONS",
  "copayPercent":20,
  "remainingLimit":5000,
  "currency":"EGP",
  "requiresPreApproval":true,
  "effectiveAt":"2026-11-22T12:00:00Z",
  "source":"POLICY_ENGINE"
}
```

- `serviceCode` is from normalized service catalog / backend validation. LLM may propose code; backend validates.
- `copayPercent`/limits/coverageStatus are authoritative outputs from policy engine. Never calculated or rewritten by LLM.
- Response above is a **fictional test fixture**, not an insurance promise.
- If status cannot be determined, return `UNKNOWN` and a human-handling reason, not a fabricated value.
- For V1 the LLM tool schema should have **only** service code (and maybe clarifier), never member ID, insurer ID, tier or policy overrides.

### 5. Error response envelope

```json
{"error":{"code":"SESSION_EXPIRED","message":"Verification required","correlationId":"req-demo-001"}}
```

Proposed errors: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `UNKNOWN_SERVICE` (422), `CONTEXT_UNAVAILABLE` (503), `RATE_LIMITED` (429), `SESSION_EXPIRED` (401), `HUMAN_REVIEW_REQUIRED` (409 or domain state, to agree). Never expose account existence during identification. Use opaque correlation IDs for troubleshooting.

## Local V0.4 chat codes

The Ollama Web Demo uses the existing verified `POST /v1/chat` request and answer envelope. It adds HTTP 200 codes `CAPABILITIES`, `FAQ`, `OUT_OF_SCOPE`, `UNSUPPORTED_SERVICE`, and `COVERAGE_NOT_AVAILABLE`. The last code means the mock policy engine returned `UNKNOWN` for an allowlisted service. A confirmed `NOT_COVERED` policy result uses `COVERAGE_RESULT`. Concurrent Ollama chat turns in a single verified session can receive HTTP 409 `CHAT_BUSY`. Fixture and legacy chat retain their previous response codes.

## Backend contract review checklist

- [ ] Tenant and member scoping must be server-side and enforced on every query.
- [ ] Session strategy across WhatsApp, mobile, web; no LLM-issued identity.
- [ ] Domain taxonomy for coverage codes, tiers and exclusions.
- [ ] Time validity, policy version/effective date, exhausted limits/plan renewal.
- [ ] Authorization matrices for member/provider/doctor/insurer/staff.
- [ ] Response semantics: missing data vs not covered vs needs approval.
- [ ] Field-level PII limits and data retention/consent.
- [ ] Test sandbox and synthetic fixtures contract.
