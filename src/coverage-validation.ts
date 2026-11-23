import { isServiceCode } from "./contracts.ts";
import type { Coverage, CoverageStatus, ServiceCode } from "./contracts.ts";

/**
 * Runtime trust boundary for responses coming from the TPA backend.
 * TypeScript types disappear at runtime, so we must validate before presenting
 * any monetary or insurance result to a member.
 * This V1 parser only accepts the synthetic MOCK_POLICY_ENGINE contract.
 */
const STATUSES: readonly CoverageStatus[] = ["COVERED", "COVERED_WITH_CONDITIONS", "NOT_COVERED", "UNKNOWN"];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalNumber(value: unknown, min: number, max: number): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);
}

/** Throws a generic error: no raw backend payload or sensitive fields in logs. */
export function validateCoverageResponse(value: unknown, requestedService: ServiceCode): Coverage {
  if (!record(value) ||
      !isServiceCode(value.serviceCode as string) || value.serviceCode !== requestedService ||
      value.source !== "MOCK_POLICY_ENGINE" || value.currency !== "EGP" ||
      typeof value.policyVersion !== "string" ||
      value.policyVersion.length < 1 || value.policyVersion.length > 80 ||
      !/^[A-Za-z0-9._-]+$/.test(value.policyVersion) ||
      !STATUSES.includes(value.coverageStatus as CoverageStatus) ||
      !isOptionalNumber(value.copayPercent, 0, 100) ||
      !isOptionalNumber(value.remainingLimit, 0, Number.MAX_SAFE_INTEGER) ||
      !(value.requiresPreApproval === null || typeof value.requiresPreApproval === "boolean")) {
    throw new Error("INVALID_COVERAGE_RESPONSE");
  }

  // Unknown or excluded benefits must not carry contradictory financial data.
  if ((value.coverageStatus === "UNKNOWN" || value.coverageStatus === "NOT_COVERED") &&
      (value.copayPercent !== null || value.remainingLimit !== null || value.requiresPreApproval !== null)) {
    throw new Error("INVALID_COVERAGE_RESPONSE");
  }

  // No backend content is trusted merely because the TS interface says Coverage.
  return {
    serviceCode: value.serviceCode as ServiceCode,
    policyVersion: value.policyVersion as string,
    coverageStatus: value.coverageStatus as CoverageStatus,
    copayPercent: value.copayPercent as number | null,
    remainingLimit: value.remainingLimit as number | null,
    currency: "EGP",
    requiresPreApproval: value.requiresPreApproval as boolean | null,
    source: "MOCK_POLICY_ENGINE"
  };
}
