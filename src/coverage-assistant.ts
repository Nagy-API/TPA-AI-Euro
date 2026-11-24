import { CHAT_REQUEST_TIMEOUT_MS, isServiceCode } from "./contracts.ts";
import { validateCoverageResponse } from "./coverage-validation.ts";
import type { Coverage, CoverageIntentSelector, ToolSelection, TpaBackend } from "./contracts.ts";
import type { DemoMemberAuth } from "./demo-auth/member-auth.ts";
import { isGroundedCoverageService, isThirdPartyCoverage } from "./coverage-input.ts";
import { isCoverageFollowUp } from "./coverage-conversation.ts";

export type AssistantReply = Readonly<{ status: number; code: string; answer: string }>;
const SAFE_RETRY = "البيانات مش متاحة دلوقتي، من فضلك حاول مرة تانية أو تواصل مع خدمة العملاء. (بيانات تجريبية)";
const COVERAGE_UNAVAILABLE: AssistantReply = Object.freeze({ status: 503, code: "COVERAGE_UNAVAILABLE", answer: SAFE_RETRY });
const VERIFICATION_REQUIRED: AssistantReply = Object.freeze({
  status: 401, code: "VERIFICATION_REQUIRED", answer: "الجلسة غير صالحة. لازم تتحقق من هويتك الأول."
});
export const CHAT_TIMEOUT: AssistantReply = Object.freeze({ status: 503, code: "CHAT_TIMEOUT", answer: SAFE_RETRY });

export class CoverageAssistant {
  private readonly backend: TpaBackend;
  private readonly selector: CoverageIntentSelector;
  private readonly memberAuth?: DemoMemberAuth;
  constructor(backend: TpaBackend, selector: CoverageIntentSelector, memberAuth?: DemoMemberAuth) {
    this.backend = backend;
    this.selector = selector;
    this.memberAuth = memberAuth;
  }

  async answer(sessionToken: string | undefined, question: unknown, requestSignal?: AbortSignal): Promise<AssistantReply> {
    if (!sessionToken) return { status: 401, code: "VERIFICATION_REQUIRED", answer: "لازم تتحقق من هويتك الأول قبل الاستفسار عن تغطيتك." };
    let session;
    try {
      session = await this.backend.resolveSession(sessionToken);
    } catch {
      return { status: 503, code: "IDENTITY_UNAVAILABLE", answer: SAFE_RETRY };
    }
    if (!session || (this.memberAuth ? !this.memberAuth.isActive(session) : session.expiresAt <= Date.now())) {
      return VERIFICATION_REQUIRED;
    }
    if (typeof question !== "string" || !question.trim() || question.length > 500) {
      return { status: 400, code: "INVALID_QUESTION", answer: "اكتب سؤال واضح عن الخدمة الطبية (حتى 500 حرف)." };
    }
    const message = question.trim();
    if (requestSignal?.aborted) return CHAT_TIMEOUT;
    const remainingMs = this.memberAuth?.remainingSessionMs(session) ?? session.expiresAt - Date.now();
    if (remainingMs <= 0) return VERIFICATION_REQUIRED;
    const expiry = remainingMs <= CHAT_REQUEST_TIMEOUT_MS ? AbortSignal.timeout(remainingMs) : undefined;
    const signal = requestSignal && expiry ? AbortSignal.any([requestSignal, expiry]) : requestSignal ?? expiry;
    const otherPerson = isThirdPartyCoverage(message);
    const followUp = this.memberAuth && !otherPerson && isCoverageFollowUp(message) ? message : "";
    let selection: ToolSelection;
    try {
      selection = otherPerson || followUp ? { kind: "clarify" } : await this.selector.selectCoverageIntent(message, signal);
    } catch {
      if (expiry?.aborted) return VERIFICATION_REQUIRED;
      if (requestSignal?.aborted) return CHAT_TIMEOUT;
      return { status: 503, code: "AI_UNAVAILABLE", answer: SAFE_RETRY };
    }
    if (expiry?.aborted) return VERIFICATION_REQUIRED;
    if (requestSignal?.aborted) return CHAT_TIMEOUT;
    const explicitService = selection.kind === "tool" && selection.name === "get_member_coverage" &&
      isServiceCode(selection.serviceCode) && isGroundedCoverageService(message, selection.serviceCode)
      ? selection.serviceCode
      : undefined;
    const serviceCode = this.memberAuth
      ? this.memberAuth.resolveConversationService(session, followUp, explicitService)
      : explicitService;
    if (serviceCode === null) return COVERAGE_UNAVAILABLE;
    if (!serviceCode) {
      const answer = otherPerson
        ? "تقدر تستفسر هنا عن تغطية حسابك التجريبي الحالي بس. لو سؤالك عن تغطيتك أنت، اسأل عن الخدمة اللي محتاجها."
        : "تقصد أي خدمة بالتحديد؟ حاليًا في التجربة بندعم الرنين المغناطيسي، صورة الدم الكاملة، والأشعة السينية.";
      return { status: 200, code: "CLARIFICATION_NEEDED", answer };
    }
    let coverage: Coverage;
    try {
      // Backend data is untrusted at runtime, regardless of TypeScript annotations.
      coverage = validateCoverageResponse(await this.backend.getCoverage(session, serviceCode), serviceCode);
    } catch {
      return COVERAGE_UNAVAILABLE;
    }
    if (expiry?.aborted) return VERIFICATION_REQUIRED;
    if (requestSignal?.aborted) return CHAT_TIMEOUT;
    if (this.memberAuth && !this.memberAuth.isActive(session)) return COVERAGE_UNAVAILABLE;
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
