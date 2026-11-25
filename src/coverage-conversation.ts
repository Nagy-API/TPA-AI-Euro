import type { ServiceCode } from "./contracts.ts";
import type { DialogueContext, Focus } from "./conversation-intent.ts";

const TOPIC_TTL_MS = 2 * 60_000;

// Allow only complete, service-free questions. Extra text may change the topic.
const COPAY_FOLLOW_UPS = [
  /^(?:(?:و\s*)?طب\s+|و\s*)?(?:نسبة\s+)?التحمل\s+(?:كام|قد إيه)$/u,
  /^(?:and )?(?:what|how much) is (?:the )?co[ -]?pay$/i
];

export function isCoverageFollowUp(message: string): boolean {
  const normalized = message.trim().replace(/[?؟.!]+$/u, "").trimEnd().replace(/\s+/gu, " ");
  return COPAY_FOLLOW_UPS.some((pattern) => pattern.test(normalized));
}

/** Offline deterministic topic resolution, NOT a real LLM. One slot per verified session. */
export class CoverageConversation {
  private state?: Readonly<{ value: Exclude<DialogueContext, { kind: "idle" }>; expiresAt: number }>;

  context(now: number): DialogueContext {
    return this.state && this.state.expiresAt > now ? this.state.value : { kind: "idle" };
  }

  current(now: number): ServiceCode | undefined {
    const context = this.context(now);
    return context.kind === "active" ? context.service : undefined;
  }

  awaitService(focus: Focus, now: number, sessionExpiresAt: number): void {
    const prior = this.context(now);
    if (prior.kind === "pending" && (prior.focus === focus || focus === "OVERVIEW")) return;
    this.state = { value: { kind: "pending", focus }, expiresAt: Math.min(now + TOPIC_TTL_MS, sessionExpiresAt) };
  }

  offerReferral(reason: "unavailable" | "unsupported", now: number, sessionExpiresAt: number): void {
    this.state = { value: { kind: "referral", reason }, expiresAt: Math.min(now + TOPIC_TTL_MS, sessionExpiresAt) };
  }

  resolve(followUp: string, explicitService: ServiceCode | undefined, now: number, sessionExpiresAt: number): ServiceCode | undefined {
    if (explicitService) {
      this.state = { value: { kind: "active", service: explicitService }, expiresAt: Math.min(now + TOPIC_TTL_MS, sessionExpiresAt) };
      return explicitService;
    }

    const current = this.current(now);
    if (current && isCoverageFollowUp(followUp)) return current;

    this.state = undefined;
    return undefined;
  }
}
