/** First slice contracts: synthetic demo only, not an agreed TPA production API. */
export const SERVICE_CODES = ["MRI", "CBC", "XRAY"] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];
export type CoverageStatus = "COVERED" | "COVERED_WITH_CONDITIONS" | "NOT_COVERED" | "UNKNOWN";
export type VerifiedSession = Readonly<{ memberKey: string; tenantKey: string; expiresAt: number }>;
export type Coverage = Readonly<{
  serviceCode: ServiceCode;
  policyVersion: string;
  coverageStatus: CoverageStatus;
  copayPercent: number | null;
  remainingLimit: number | null;
  currency: "EGP";
  requiresPreApproval: boolean | null;
  source: "MOCK_POLICY_ENGINE";
}>;
export interface TpaBackend {
  resolveSession(sessionToken: string): Promise<VerifiedSession | null>;
  getCoverage(session: VerifiedSession, serviceCode: ServiceCode): Promise<Coverage>;
}
export type ToolSelection =
  | { kind: "tool"; name: "get_member_coverage"; serviceCode: string }
  | { kind: "clarify" };
export interface CoverageIntentSelector {
  selectCoverageIntent(question: string): Promise<ToolSelection>;
}
export const isServiceCode = (value: string): value is ServiceCode =>
  SERVICE_CODES.includes(value as ServiceCode);
