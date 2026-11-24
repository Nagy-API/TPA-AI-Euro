import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { ServiceCode, VerifiedSession } from "../contracts.ts";
import { CoverageConversation } from "../coverage-conversation.ts";
import { DEMO_MEMBERS } from "./fixtures.ts";

const CHALLENGE_TTL_MS = 2 * 60_000;
const SESSION_TTL_MS = 10 * 60_000;
const LIMIT_WINDOW_MS = 5 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;
const MAX_ISSUES = 3;
const MAX_ATTEMPTS = 3;
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

type VerificationWindow = {
  expiresAt: number;
  issuances: number;
  attempts: number;
  lastIssuedAt: number;
  challengeId?: string;
};

type Challenge = {
  identifier: string;
  expiresAt: number;
  window: VerificationWindow;
};

type SessionRecord = Readonly<{ scope: VerifiedSession; conversation: CoverageConversation }>;

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Process-local state for fixed synthetic fixtures. Start/verify are synchronous to serialize redemption. */
export class DemoMemberAuth {
  // The identifier format bounds these indexes to 1,000 entries each.
  private readonly windows = new Map<string, VerificationWindow>();
  private readonly challenges = new Map<string, Challenge>();
  // One record per fictional tenant/member, keyed by bearer-token digest. Deleting it drops its topic too.
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  identify(memberIdentifier: unknown): { challengeId: string; message: string } {
    const challengeId = randomToken();
    const response = {
      challengeId,
      message: "If verification is available, continue with the local demo instructions."
    };
    const identifier = typeof memberIdentifier === "string" ? memberIdentifier.trim().toUpperCase() : "";
    if (!/^M-DEMO-[0-9]{3}$/.test(identifier)) return response;

    const now = this.now();
    let window = this.windows.get(identifier);
    if (!window || window.expiresAt <= now) {
      if (window?.challengeId) this.challenges.delete(window.challengeId);
      window = { expiresAt: now + LIMIT_WINDOW_MS, issuances: 0, attempts: 0, lastIssuedAt: -Infinity };
      this.windows.set(identifier, window);
    }
    if (
      window.issuances >= MAX_ISSUES ||
      window.attempts >= MAX_ATTEMPTS ||
      now - window.lastIssuedAt < RESEND_COOLDOWN_MS
    ) return response;

    if (window.challengeId) this.challenges.delete(window.challengeId);
    window.challengeId = challengeId;
    window.issuances++;
    window.lastIssuedAt = now;
    this.challenges.set(challengeId, {
      identifier,
      expiresAt: Math.min(now + CHALLENGE_TTL_MS, window.expiresAt),
      window
    });
    return response;
  }

  verify(challengeId: string, code: unknown): { sessionToken: string; sessionExpiresAt: string } | null {
    const now = this.now();
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return null;
    if (challenge.expiresAt <= now) {
      this.challenges.delete(challengeId);
      return null;
    }

    const { identifier, window } = challenge;
    window.attempts++;
    if (window.attempts >= MAX_ATTEMPTS) this.challenges.delete(challengeId);
    const member = DEMO_MEMBERS.find((fixture) => fixture.identifier === identifier);
    if (typeof code !== "string" || !/^[0-9]{6}$/.test(code)) return null;
    const matches = timingSafeEqual(Buffer.from(code), Buffer.from(member?.code ?? "000000"));
    if (!matches || !member) return null;

    this.challenges.delete(challengeId);
    for (const [digest, { scope }] of this.sessions) {
      if (scope.expiresAt <= now || (scope.memberKey === member.memberKey && scope.tenantKey === member.tenantKey)) {
        this.sessions.delete(digest);
      }
    }
    const expiresAt = now + SESSION_TTL_MS;
    const sessionToken = randomToken();
    this.sessions.set(tokenDigest(sessionToken), {
      scope: Object.freeze({ memberKey: member.memberKey, tenantKey: member.tenantKey, expiresAt }),
      conversation: new CoverageConversation()
    });
    return { sessionToken, sessionExpiresAt: new Date(expiresAt).toISOString() };
  }

  resolveSession(token: string): VerifiedSession | null {
    if (!OPAQUE_TOKEN.test(token)) return null;
    const digest = tokenDigest(token);
    const session = this.sessions.get(digest);
    if (!session) return null;
    if (session.scope.expiresAt > this.now()) return session.scope;
    this.sessions.delete(digest);
    return null;
  }

  revokeSession(token: string): void {
    if (OPAQUE_TOKEN.test(token)) this.sessions.delete(tokenDigest(token));
  }

  isActive(session: VerifiedSession): boolean {
    return this.findActiveRecord(session, this.now()) !== undefined;
  }

  remainingSessionMs(session: VerifiedSession): number {
    return session.expiresAt - this.now();
  }

  /** null denotes an inactive session. undefined means the service needs clarification. */
  resolveConversationService(session: VerifiedSession, followUp: string, serviceCode: ServiceCode | undefined): ServiceCode | null | undefined {
    const now = this.now();
    const record = this.findActiveRecord(session, now);
    return record ? record.conversation.resolve(followUp, serviceCode, now, session.expiresAt) : null;
  }

  private findActiveRecord(session: VerifiedSession, now: number): SessionRecord | undefined {
    // Match the exact scope issued by this store, never caller-supplied member or tenant fields.
    for (const [digest, record] of this.sessions) {
      if (record.scope !== session) continue;
      if (session.expiresAt > now) return record;
      this.sessions.delete(digest);
      break;
    }
    return undefined;
  }
}
