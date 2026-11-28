import { CHAT_REQUEST_TIMEOUT_MS, isServiceCode } from "./contracts.ts";
import { validateCoverageResponse } from "./coverage-validation.ts";
import type { Coverage, CoverageIntentSelector, ToolSelection, TpaBackend, VerifiedSession } from "./contracts.ts";
import type { DemoMemberAuth } from "./demo-auth/member-auth.ts";
import { explicitBenefitFocus, hasPrivateCoverageInput, inspectServiceSubject, isGroundedCoverageService, isThirdPartyCoverage, nonCoveragePurpose } from "./coverage-input.ts";
import { isCoverageFollowUp } from "./coverage-conversation.ts";
import { SERVICE_CATALOG, type ConversationInterpreter } from "./conversation-intent.ts";
import { CLARIFY_SERVICE, conversationReply, explainConversation, formatFocusedCoverage, OTHER_ACCOUNT } from "./conversation-replies.ts";
import { resolveTurn } from "./turn-resolution.ts";

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
  private readonly interpreter?: ConversationInterpreter;
  private readonly inFlight = new WeakSet<VerifiedSession>();
  constructor(
    backend: TpaBackend, selector: CoverageIntentSelector, memberAuth?: DemoMemberAuth,
    interpreter?: ConversationInterpreter
  ) {
    this.backend = backend;
    this.selector = selector;
    this.memberAuth = memberAuth;
    this.interpreter = interpreter;
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
    if (this.interpreter && this.memberAuth) {
      if (this.inFlight.has(session)) {
        return { status: 409, code: "CHAT_BUSY", answer: "استنى رد السؤال الحالي وبعدين ابعت سؤالك." };
      }
      this.inFlight.add(session);
      try {
        return await this.answerConversation(session, message, this.interpreter, this.memberAuth, signal);
      } finally {
        this.inFlight.delete(session);
      }
    }
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

  private async answerConversation(
    session: VerifiedSession, message: string, interpreter: ConversationInterpreter,
    auth: DemoMemberAuth, signal?: AbortSignal
  ): Promise<AssistantReply> {
    const clear = () => auth.resolveConversationService(session, "", undefined);
    const interrupted = () => !auth.isActive(session) ? VERIFICATION_REQUIRED : signal?.aborted ? CHAT_TIMEOUT : undefined;
    const decline = (code: string, answer: string): AssistantReply => {
      clear();
      return { status: 200, code, answer };
    };
    if (hasPrivateCoverageInput(message)) {
      return decline("CLARIFICATION_NEEDED", "اكتب اسم الفحص أو سؤالك عن التأمين من غير أرقام العضوية أو بيانات التحقق.");
    }
    const purpose = nonCoveragePurpose(message);
    if (purpose) {
      const reply = explainConversation(purpose);
      return decline(reply.code, reply.answer);
    }
    const clues = inspectServiceSubject(message);
    if (clues.unsupported && clues.named.length === 0 && !clues.comparison) {
      // This is a public catalog answer, even when a service possessive resembles an account cue.
      auth.offerConversationReferral(session, "unsupported");
      return { status: 200, ...explainConversation("unsupported") };
    }
    if (isThirdPartyCoverage(message)) return decline("OUT_OF_SCOPE", OTHER_ACCOUNT);
    if (clues.named.length > 1) {
      const reply = conversationReply({ intent: "CLARIFY", subject: "MULTIPLE", focus: "OVERVIEW" });
      auth.awaitConversationService(session, explicitBenefitFocus(message) ?? "OVERVIEW");
      return { status: 200, ...reply };
    }

    let resolution;
    try {
      const context = auth.conversationContext(session);
      const proposal = await interpreter.interpret(message, context, signal);
      resolution = resolveTurn(message, auth.conversationContext(session), proposal);
      if (resolution.action === "ground" && !interrupted()) {
        const kind = resolution.kind;
        const evidence = await interpreter.ground(message, kind, signal);
        resolution = resolveTurn(message, auth.conversationContext(session), proposal, { kind, evidence });
      }
    } catch {
      clear();
      return interrupted() ?? { status: 503, code: "AI_UNAVAILABLE", answer: "المساعد المحلي مش متاح دلوقتي. جرّب تبعت سؤالك بعد شوية." };
    }
    const stopped = interrupted();
    if (stopped) {
      clear();
      return stopped;
    }
    if (resolution.action === "reply") {
      if (resolution.topic === "clear") clear();
      return { status: 200, ...conversationReply(resolution.reply) };
    }
    if (resolution.action === "explain") {
      if (resolution.purpose === "unsupported") auth.offerConversationReferral(session, "unsupported");
      else if (resolution.topic === "clear") clear();
      return { status: 200, ...explainConversation(resolution.purpose) };
    }
    if (resolution.action === "clarify-benefit") {
      const name = SERVICE_CATALOG[resolution.service].name;
      return { status: 200, code: "CLARIFICATION_NEEDED",
        answer: `لو لسه بتسأل عن ${name}، تقصد نسبة التحمل، الحد المتبقي، ولا شرط الموافقة المسبقة؟` };
    }
    if (resolution.action === "ground" || resolution.action === "clarify" && resolution.reason === "conflict") {
      return decline("CLARIFICATION_NEEDED", CLARIFY_SERVICE);
    }
    if (resolution.action === "clarify") {
      auth.awaitConversationService(session, resolution.focus);
      const reply = conversationReply({ intent: resolution.reason === "multiple" ? "CLARIFY" : "FOLLOW_UP",
        subject: resolution.reason === "multiple" ? "MULTIPLE" : "NONE", focus: resolution.focus });
      return { status: 200, ...reply };
    }
    const { service: serviceCode, focus, topic } = resolution;
    if (topic === "replace") clear();

    let coverage: Coverage;
    try {
      coverage = validateCoverageResponse(await this.backend.getCoverage(session, serviceCode), serviceCode);
    } catch {
      clear();
      return interrupted() ?? COVERAGE_UNAVAILABLE;
    }
    const finished = interrupted();
    if (finished) {
      clear();
      return finished;
    }
    if (coverage.coverageStatus === "UNKNOWN") {
      auth.offerConversationReferral(session, "unavailable");
      return { status: 200, code: "COVERAGE_NOT_AVAILABLE", answer: formatFocusedCoverage(coverage, focus) ?? SAFE_RETRY };
    }
    if (topic === "replace") auth.resolveConversationService(session, "", serviceCode);
    return { status: 200, code: "COVERAGE_RESULT", answer: formatFocusedCoverage(coverage, focus) ?? formatCoverage(coverage) };
  }
}

function formatCoverage(coverage: Coverage): string {
  const name = SERVICE_CATALOG[coverage.serviceCode].name;
  if (coverage.coverageStatus === "UNKNOWN") return `مش قادرين نحدد تغطية ${name} من البيانات الحالية. راجع خدمة العملاء. (بيانات تجريبية)`;
  if (coverage.coverageStatus === "NOT_COVERED") return `${name} غير مغطّى حسب الوثيقة التجريبية الحالية. لو عندك استفسار راجع خدمة العملاء. (بيانات تجريبية)`;
  if (coverage.coverageStatus !== "COVERED" && coverage.coverageStatus !== "COVERED_WITH_CONDITIONS") return SAFE_RETRY;
  const conditions = coverage.coverageStatus === "COVERED_WITH_CONDITIONS" ? " بشروط" : "";
  const parts = [`${name} مغطّى${conditions} حسب بيانات الوثيقة التجريبية.`];
  if (coverage.copayPercent !== null && Number.isFinite(coverage.copayPercent)) parts.push(`نسبة التحمل: ${coverage.copayPercent}%.`);
  if (coverage.remainingLimit !== null && Number.isFinite(coverage.remainingLimit)) parts.push(`الحد المتبقي: ${coverage.remainingLimit.toLocaleString("en-US")} جنيه.`);
  if (coverage.requiresPreApproval === true) parts.push("لازم موافقة مسبقة من المختص قبل تقديم الخدمة، وده مش قرار موافقة.");
  else if (coverage.requiresPreApproval === null) parts.push("حالة الموافقة المسبقة غير معروفة؛ راجع خدمة العملاء.");
  parts.push("(بيانات تجريبية وليست تأكيد تغطية حقيقي)");
  return parts.join(" ");
}
