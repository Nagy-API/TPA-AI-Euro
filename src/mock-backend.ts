import type { Coverage, ServiceCode, TpaBackend, VerifiedSession } from "./contracts.ts";
import { DEMO_MEMBERS } from "./demo-auth/fixtures.ts";
import type { DemoMemberAuth } from "./demo-auth/member-auth.ts";

/** Fixed tokens belong to the legacy local demo only. */
const FIXTURE_SESSIONS = new Map(
  DEMO_MEMBERS.map(({ memberKey, tenantKey }) => [memberKey + "-session", { memberKey, tenantKey }])
);

const fixtures: Record<string, Partial<Record<ServiceCode, Omit<Coverage, "serviceCode" | "source" | "currency">>>> = {
  "demo-gold": {
    MRI: { policyVersion: "POL-DEMO-2026-v1", coverageStatus: "COVERED_WITH_CONDITIONS", copayPercent: 20, remainingLimit: 5000, requiresPreApproval: true },
    CBC: { policyVersion: "POL-DEMO-2026-v1", coverageStatus: "COVERED", copayPercent: 0, remainingLimit: 1000, requiresPreApproval: false }
  },
  "demo-silver": {
    MRI: { policyVersion: "POL-DEMO-2026-v2", coverageStatus: "NOT_COVERED", copayPercent: null, remainingLimit: null, requiresPreApproval: null },
    CBC: { policyVersion: "POL-DEMO-2026-v2", coverageStatus: "COVERED_WITH_CONDITIONS", copayPercent: 30, remainingLimit: 400, requiresPreApproval: false }
  },
  "demo-vip": {
    MRI: { policyVersion: "POL-DEMO-2026-v3", coverageStatus: "COVERED_WITH_CONDITIONS", copayPercent: 0, remainingLimit: 12000, requiresPreApproval: true },
    CBC: { policyVersion: "POL-DEMO-2026-v3", coverageStatus: "COVERED", copayPercent: 0, remainingLimit: 10000, requiresPreApproval: false }
  }
};

export class MockTpaBackend implements TpaBackend {
  private readonly memberAuth?: DemoMemberAuth;

  constructor(memberAuth?: DemoMemberAuth) {
    this.memberAuth = memberAuth;
  }

  async resolveSession(sessionToken: string): Promise<VerifiedSession | null> {
    if (this.memberAuth) return this.memberAuth.resolveSession(sessionToken);
    const record = FIXTURE_SESSIONS.get(sessionToken);
    if (!record) return null;
    return { ...record, expiresAt: Date.now() + 5 * 60_000 };
  }

  async getCoverage(session: VerifiedSession, serviceCode: ServiceCode): Promise<Coverage> {
    // Defense in depth in the DEMO stub. Real backend must reauthorize every call.
    const belongsToTenant = DEMO_MEMBERS.some(
      (item) => item.memberKey === session.memberKey && item.tenantKey === session.tenantKey
    );
    const active = this.memberAuth ? this.memberAuth.isActive(session) : session.expiresAt > Date.now();
    if (!belongsToTenant || !active) throw new Error("FORBIDDEN");
    const entry = fixtures[session.memberKey]?.[serviceCode];
    return {
      serviceCode,
      source: "MOCK_POLICY_ENGINE",
      currency: "EGP",
      policyVersion: entry?.policyVersion ?? "POL-DEMO-UNKNOWN",
      coverageStatus: entry?.coverageStatus ?? "UNKNOWN",
      copayPercent: entry?.copayPercent ?? null,
      remainingLimit: entry?.remainingLimit ?? null,
      requiresPreApproval: entry?.requiresPreApproval ?? null
    };
  }
}
