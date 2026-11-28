# ADR 0005 — Isolated synthetic WhatsApp listener

Status **Proposed for Meta test assets** · 2026-11-28

## Decision

Use a dedicated loopback process with a single route for the official WhatsApp Cloud API callback. The opt-in process validates Meta's signature against the original body, selects the configured test WABA, phone ID and sender allowlist, and acknowledges admitted messages before inference or Graph requests. Only the dedicated port can be a tunnel origin.

Use the existing `DemoMemberAuth`, `MockTpaBackend` and V0.5 `CoverageAssistant` with an isolated authentication store. Bind challenges and opaque verified sessions to the server-side sender state. The channel handles all identity commands deterministically and sends only a synthetic question without identity data to the local model. The backend authorizes coverage with the trusted session. Attach that session's lifetime to outbound coverage requests.

Keep a bounded in-memory queue per configured sender and a bounded replay window. Acknowledge successfully admitted IDs once even when later delivery fails. Send bounded Graph requests without automatic retries. A session or accepted turn may be lost at process restart, and a turn whose reply fails can still update its conversation state. This is acceptable for the manual synthetic test. Durable state and outbound idempotency require a separate decision for a real rollout.

See the [operator runbook](../whatsapp-test-runbook.md).
