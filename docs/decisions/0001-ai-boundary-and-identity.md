# ADR 0001: Identity gate before privileged AI interaction

**Status:** PROPOSED — security principle accepted in planning, mechanics pending backend sign-off  
**Date:** 2026-11-22

## Context

The desired conversational onboarding starts with member insurance/card ID so the system can resolve tier and policy automatically. However, a visible identifier can be stolen/guessed, and a phone/chat message doesn't prove authorization.

## Decision

Use deterministic Identity Gateway + backend verification before enabling personalized AI tools. Issue a scoped authenticated member session after approved challenge; derive member/tenant from backend claims. The model never sees OTP; never selects member ID or policy tier. Look up only the minimum authorized data for each intent.

## Alternatives rejected

- LLM receives ID and queries DB directly: unsafe/weak separation, account enumeration and cross-member risk.
- Trust WhatsApp sender or typed ID alone: insufficient authentication.
- Fetch entire member clinical profile at chat start: unnecessary privacy exposure.

## Consequences

Extra verification and expiry UX, gateway/backend dependency and contract alignment; safe and reusable across WhatsApp/app/portal. Real-world session TTL and method still need agreement.
