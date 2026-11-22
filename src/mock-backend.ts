import type { Coverage, ServiceCode, TpaBackend, VerifiedSession } from "./contracts.ts";

/** These values are fake and MUST NEVER be used for production authentication. */
const FIXTURE_SESSIONS: Record<string, { memberKey: string; tenantKey: string }> = {
  "demo-gold-session": { memberKey: "demo-gold", tenantKey: "demo-insurer-a" },
  "demo-silver-session": { memberKey: "demo-silver", tenantKey: "demo-insurer-a" },
  "demo-vip-session": { memberKey: "demo-vip", tenantKey: "demo-insurer-b" }
};

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
  async resolveSession(sessionToken: string): Promise<VerifiedSession | null> {
    const record = FIXTURE_SESSIONS[sessionToken];
    if (!record) return null;
    return { ...record, expiresAt: Date.now() + 5 * 60_000 };
  }

  async getCoverage(session: VerifiedSession, serviceCode: ServiceCode): Promise<Coverage> {
    // Defense in depth in the DEMO stub. Real backend must reauthorize every call.
    const belongsToTenant = Object.values(FIXTURE_SESSIONS).some(
      (item) => item.memberKey === session.memberKey && item.tenantKey === session.tenantKey
    );
    if (!belongsToTenant || session.expiresAt <= Date.now()) throw new Error("FORBIDDEN");
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
