import type { ServiceCode } from "./contracts.ts";

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

  current(now: number): ServiceCode | undefined {
    return this.topic && this.topic.expiresAt > now ? this.topic.serviceCode : undefined;
  }

  resolve(followUp: string, explicitService: ServiceCode | undefined, now: number, sessionExpiresAt: number): ServiceCode | undefined {
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
