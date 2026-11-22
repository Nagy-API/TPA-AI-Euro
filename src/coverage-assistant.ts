import { isServiceCode } from "./contracts.ts";
import type { Coverage, CoverageIntentSelector, TpaBackend } from "./contracts.ts";

export type AssistantReply = Readonly<{ status: number; code: string; answer: string }>;
const SAFE_RETRY = "البيانات مش متاحة دلوقتي، من فضلك حاول مرة تانية أو تواصل مع خدمة العملاء. (بيانات تجريبية)";

export class CoverageAssistant {
  private readonly backend: TpaBackend;
  private readonly selector: CoverageIntentSelector;
  constructor(backend: TpaBackend, selector: CoverageIntentSelector) {
    this.backend = backend;
    this.selector = selector;
  }

  async answer(sessionToken: string | undefined, question: unknown): Promise<AssistantReply> {
    if (!sessionToken) return { status: 401, code: "VERIFICATION_REQUIRED", answer: "لازم تتحقق من هويتك الأول قبل الاستفسار عن تغطيتك." };
    let session;
    try {
      session = await this.backend.resolveSession(sessionToken);
    } catch {
      return { status: 503, code: "IDENTITY_UNAVAILABLE", answer: SAFE_RETRY };
    }
    if (!session || session.expiresAt <= Date.now()) return { status: 401, code: "VERIFICATION_REQUIRED", answer: "الجلسة غير صالحة. لازم تتحقق من هويتك الأول." };
    if (typeof question !== "string" || !question.trim() || question.length > 500) {
      return { status: 400, code: "INVALID_QUESTION", answer: "اكتب سؤال واضح عن الخدمة الطبية (حتى 500 حرف)." };
    }
    let selection;
    try {
      selection = await this.selector.selectCoverageIntent(question.trim());
    } catch {
      return { status: 503, code: "AI_UNAVAILABLE", answer: SAFE_RETRY };
    }
    if (selection.kind !== "tool" || selection.name !== "get_member_coverage" || !isServiceCode(selection.serviceCode)) {
      return { status: 200, code: "CLARIFICATION_NEEDED", answer: "تقصد أي خدمة بالتحديد؟ حاليًا في التجربة بندعم الرنين المغناطيسي، صورة الدم الكاملة، والأشعة السينية." };
    }
    let coverage: Coverage;
    try {
      coverage = await this.backend.getCoverage(session, selection.serviceCode);
      if (coverage.serviceCode !== selection.serviceCode || coverage.source !== "MOCK_POLICY_ENGINE") throw new Error("UNTRUSTED_TOOL_OUTPUT");
    } catch {
      return { status: 503, code: "COVERAGE_UNAVAILABLE", answer: SAFE_RETRY };
    }
    return { status: 200, code: "COVERAGE_RESULT", answer: formatCoverage(coverage) };
  }
}

function formatCoverage(coverage: Coverage): string {
  const serviceNames: Record<string, string> = { MRI: "الرنين المغناطيسي", CBC: "صورة الدم الكاملة", XRAY: "الأشعة السينية" };
  const name = serviceNames[coverage.serviceCode];
  if (coverage.coverageStatus === "UNKNOWN") return `مش قادرين نحدد تغطية ${name} من البيانات الحالية. راجع خدمة العملاء. (بيانات تجريبية)`;
  if (coverage.coverageStatus === "NOT_COVERED") return `${name} غير مغطّى حسب الوثيقة التجريبية الحالية. لو عندك استفسار راجع خدمة العملاء. (بيانات تجريبية)`;
  if (coverage.coverageStatus !== "COVERED" && coverage.coverageStatus !== "COVERED_WITH_CONDITIONS") return SAFE_RETRY;
  const parts = [`${name} مغطّى حسب بيانات الوثيقة التجريبية.`];
  if (coverage.copayPercent !== null && Number.isFinite(coverage.copayPercent)) parts.push(`نسبة التحمل: ${coverage.copayPercent}%.`);
  if (coverage.remainingLimit !== null && Number.isFinite(coverage.remainingLimit)) parts.push(`الحد المتبقي: ${coverage.remainingLimit.toLocaleString("en-US")} جنيه.`);
  if (coverage.requiresPreApproval === true) parts.push("لازم موافقة مسبقة من المختص قبل تقديم الخدمة، وده مش قرار موافقة.");
  else if (coverage.requiresPreApproval === null) parts.push("حالة الموافقة المسبقة غير معروفة؛ راجع خدمة العملاء.");
  parts.push("(بيانات تجريبية وليست تأكيد تغطية حقيقي)");
  return parts.join(" ");
}
