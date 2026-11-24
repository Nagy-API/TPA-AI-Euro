import type { ServiceCode } from "./contracts.ts";
import type { Focus } from "./conversation-intent.ts";

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
  private topic?: Readonly<{ serviceCode: ServiceCode; expiresAt: number }>;
  private clarification?: Readonly<{ focus: Focus; expiresAt: number }>;

  current(now: number): ServiceCode | undefined {
    return this.topic && this.topic.expiresAt > now ? this.topic.serviceCode : undefined;
  }

  pending(now: number): Focus | undefined {
    return this.clarification && this.clarification.expiresAt > now ? this.clarification.focus : undefined;
  }

  awaitService(focus: Focus, now: number, sessionExpiresAt: number): void {
    this.topic = undefined;
    this.clarification = { focus, expiresAt: Math.min(now + TOPIC_TTL_MS, sessionExpiresAt) };
  }

  resolve(followUp: string, explicitService: ServiceCode | undefined, now: number, sessionExpiresAt: number): ServiceCode | undefined {
    this.clarification = undefined;
    if (explicitService) {
      this.topic = { serviceCode: explicitService, expiresAt: Math.min(now + TOPIC_TTL_MS, sessionExpiresAt) };
      return explicitService;
    }

    const current = this.current(now);
    if (current && isCoverageFollowUp(followUp)) return current;

    this.topic = undefined;
    return undefined;
  }
}
