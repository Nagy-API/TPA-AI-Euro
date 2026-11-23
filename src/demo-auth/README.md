# Local member verification demo

Use fictional identifiers and questions on a local machine. The verified demo uses the offline keyword selector and in-memory verification state. The codes below are public test fixtures.

| Identifier | Fixture | Code | MRI result |
| --- | --- | --- | --- |
| M-DEMO-001 | Gold | 135790 | 20% copay, EGP 5,000 remaining, requires preapproval |
| M-DEMO-002 | Silver | 246801 | Excluded |
| M-DEMO-003 | VIP | 357912 | 0% copay, EGP 12,000 remaining, requires preapproval |

## Run locally

Requires Node.js 22.16+. Start the server with DEMO_AUTH_MODE unset or set to verified and DEMO_INTENT_MODE unset or set to fixture.

```powershell
$env:ENABLE_DEMO_AUTH = 'true'
npm run dev
```

From another PowerShell terminal:

```powershell
$demoUrl = 'http://127.0.0.1:3000/v1'
$challenge = Invoke-RestMethod -Method Post -ContentType 'application/json' -Uri "$demoUrl/member-auth/challenges" -Body '{"memberIdentifier":"M-DEMO-001"}'
$verified = Invoke-RestMethod -Method Post -ContentType 'application/json' -Uri "$demoUrl/member-auth/challenges/$($challenge.challengeId)/verify" -Body '{"oneTimeCode":"135790"}'
$headers = @{ 'x-demo-session' = $verified.sessionToken }
Invoke-RestMethod -Method Post -ContentType 'application/json' -Uri "$demoUrl/chat" -Headers $headers -Body '{"message":"Is MRI covered?"}'
Invoke-RestMethod -Method Post -Uri "$demoUrl/member-auth/logout" -Headers $headers
```

## Request behavior

- Identification returns HTTP 202 with an opaque challenge ID and the same message for known, unknown and throttled identifiers. Each identifier gets up to three issuances and three verification attempts per five-minute window, with a 30-second cooldown between issuances. A resend replaces the previous challenge and shares its attempt budget.
- Challenges expire after two minutes or at the end of the current window, whichever comes first. Verification consumes a valid challenge once. Failed verification returns HTTP 401, including for unknown, expired, replaced and already used challenges.
- Successful verification returns a random bearer token and a ten-minute expiry. Keep the token in the request header. The process stores only a token digest and the verified member and tenant. Re-verification rotates that member's token. Logout and process restart revoke sessions.
- The Coverage Assistant resolves the session before selecting intent. The mock backend checks that the same verified scope is still active before reading policy fixtures. The offline selector receives only the chat question.
- The service binds to 127.0.0.1, checks the request socket and Host, rejects foreign browser origins, and refuses to start in production. Run it directly on loopback without a public proxy. This fixture flow simulates verification with known codes and process-local limits.

For the earlier fixed-token workflow, explicitly set DEMO_AUTH_MODE to legacy. That mode exposes the earlier chat endpoint and has no challenge routes. The verified flow is the default.

Run npm test and python scripts/validate_repository.py to check the change locally.
