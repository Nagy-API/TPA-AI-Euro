import { CHAT_REQUEST_TIMEOUT_MS, isServiceCode } from "./contracts.ts";
import { validateCoverageResponse } from "./coverage-validation.ts";
import type { Coverage, CoverageIntentSelector, ToolSelection, TpaBackend, VerifiedSession } from "./contracts.ts";
import type { DemoMemberAuth } from "./demo-auth/member-auth.ts";
import { explicitBenefitFocus, hasPrivateCoverageInput, inspectServiceSubject, isGroundedCoverageService, isShortCbcSelection, isThirdPartyCoverage, nonCoveragePurpose, normalizeArabic } from "./coverage-input.ts";
import { isCoverageFollowUp } from "./coverage-conversation.ts";
import { SERVICE_CATALOG, type ConversationInterpreter, type ConversationNote } from "./conversation-intent.ts";
import { CLARIFY_SERVICE, conversationReply, explainConversation, formatFocusedCoverage, formatRemainingLimit, OTHER_ACCOUNT } from "./conversation-replies.ts";
import { resolveTurn } from "./turn-resolution.ts";
import { continuedFaq, FAQ_EXAMPLES, isFaqSubject, type ConversationExperiment } from "./conversation-experiment.ts";
import { InferenceDeadlineError } from "./conversation-provider.ts";

export type AssistantReply = Readonly<{ status: number; code: string; answer: string }>;
type ConversationDelivery = {
  update?: () => void;
  compose?: boolean;
  note?: ConversationNote;
  explainBenefit?: boolean;
  blocks?: Readonly<Record<string, string>>;
};
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
  private readonly experiment?: ConversationExperiment;
  private readonly inFlight = new WeakSet<VerifiedSession>();
  constructor(
    backend: TpaBackend, selector: CoverageIntentSelector, memberAuth?: DemoMemberAuth,
    interpreter?: ConversationInterpreter, experiment?: ConversationExperiment
  ) {
    this.backend = backend;
    this.selector = selector;
    this.memberAuth = memberAuth;
    this.interpreter = interpreter;
    this.experiment = experiment;
  }

  async answer(
    sessionToken: string | undefined, question: unknown, requestSignal?: AbortSignal, requestDeadline?: number
  ): Promise<AssistantReply> {
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
    if ((this.interpreter || this.experiment) && this.memberAuth) {
      if (this.inFlight.has(session)) {
        return { status: 409, code: "CHAT_BUSY", answer: "استنى رد السؤال الحالي وبعدين ابعت سؤالك." };
      }
      this.inFlight.add(session);
      try {
        const lifetime = this.experiment ? this.memberAuth.conversationSignal(session) : undefined;
        const conversationSignal = signal && lifetime ? AbortSignal.any([signal, lifetime]) : signal ?? lifetime;
        return await this.answerConversation(session, message, this.memberAuth, conversationSignal, requestDeadline);
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
    session: VerifiedSession, message: string, auth: DemoMemberAuth, signal?: AbortSignal, requestDeadline?: number
  ): Promise<AssistantReply> {
    const clear = () => auth.resolveConversationService(session, "", undefined);
    const interrupted = () => !auth.isActive(session) ? VERIFICATION_REQUIRED :
      signal?.aborted || this.experiment && requestDeadline !== undefined && Date.now() >= requestDeadline
        ? CHAT_TIMEOUT : undefined;
    const remainingSessionMs = auth.remainingSessionMs(session);
    const remainingRequestMs = requestDeadline === undefined ? Infinity : requestDeadline - Date.now();
    if (this.experiment) {
      const stoppedBeforeTurn = interrupted();
      if (stoppedBeforeTurn) return stoppedBeforeTurn;
      if (remainingSessionMs <= 0) return VERIFICATION_REQUIRED;
      if (remainingRequestMs < 100) return CHAT_TIMEOUT;
    }
    const turn = this.experiment && signal
      ? this.experiment.begin(message, Math.min(remainingSessionMs, remainingRequestMs), signal) : undefined;
    const recent = turn ? auth.recentConversationTurns(session) : [];
    const deliver = async (
      reply: { code: string; answer: string },
      { update, compose = true, note = { kind: "reply", code: reply.code }, explainBenefit = false,
        blocks = { answer: reply.answer } }: ConversationDelivery = {}
    ): Promise<AssistantReply> => {
      let answer = reply.answer;
      if (turn) {
        if (compose) {
          try {
            answer = await turn.compose(blocks, note, explainBenefit);
          } catch (error) {
            if (error instanceof InferenceDeadlineError) return interrupted() ?? CHAT_TIMEOUT;
            throw error;
          }
        }
        const stopped = interrupted();
        if (stopped) return stopped;
        auth.rememberConversationTurn(session, note);
      }
      update?.();
      return { status: 200, code: reply.code, answer };
    };
    const decline = (code: string, answer: string, compose = false) => deliver({ code, answer }, { update: clear, compose });
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
      return deliver(explainConversation("unsupported"), { update: () => auth.offerConversationReferral(session, "unsupported"), compose: false });
    }
    if (isThirdPartyCoverage(message)) return decline("OUT_OF_SCOPE", OTHER_ACCOUNT);
    if (turn && /^(?:(?:ممكن|عايز|عاوز)\s+)?(?:اكلم|اتواصل مع)\s+(?:خدم[هة] العملاء|موظف)|\b(?:speak to|talk to|connect me (?:with|to)) (?:a human|an agent|customer service)\b/iu.test(normalizeArabic(message))) {
      return decline("OUT_OF_SCOPE", "تقدر تكلم خدمة العملاء من الرقم أو وسيلة التواصل المكتوبة في وثيقتك. الشات ده ما يقدرش يحوّلك لموظف مباشرة.");
    }
    if (clues.named.length > 1) {
      const reply = conversationReply({ intent: "CLARIFY", subject: "MULTIPLE", focus: "OVERVIEW" });
      return deliver(reply, { update: () => auth.awaitConversationService(session, explicitBenefitFocus(message) ?? "OVERVIEW") });
    }

    const faqSubject = turn ? continuedFaq(message, recent.at(-1)) : undefined;
    if (faqSubject) {
      const reply = conversationReply({ intent: "FAQ", subject: faqSubject, focus: "OVERVIEW" });
      return deliver(reply, { note: { kind: "faq", subject: faqSubject },
        blocks: { answer: reply.answer, example: FAQ_EXAMPLES[faqSubject] } });
    }

    let resolution: ReturnType<typeof resolveTurn>;
    try {
      const context = auth.conversationContext(session);
      const experimentalProposal = turn && await turn.interpret(context, recent);
      const proposal = experimentalProposal ?? await this.interpreter!.interpret(message, context, signal);
      const current = auth.conversationContext(session);
      resolution = resolveTurn(message, current, proposal);
      if (resolution.action === "ground" && !interrupted() && (!experimentalProposal || experimentalProposal.tool !== "NONE")) {
        const kind = resolution.kind;
        const evidence = turn && kind === "follow-up" && isCoverageFollowUp(message)
          ? { match: "COPAY", quote: message }
          : turn ? await turn.ground(kind) : await this.interpreter!.ground(message, kind, signal);
        resolution = resolveTurn(message, auth.conversationContext(session), proposal, { kind, evidence });
      }
      if (experimentalProposal && resolution.action === "lookup") {
        const { tool, intent, subject } = experimentalProposal;
        const active = auth.conversationContext(session);
        const explicitSelection = resolution.topic === "replace" ||
          resolution.service === "CBC" && isShortCbcSelection(message);
        const matchesRequest = explicitSelection
          ? intent === "COVERAGE_LOOKUP" && subject === resolution.service
          : intent === "FOLLOW_UP" && subject === "NONE" &&
            active.kind === "active" && active.service === resolution.service;
        if (tool !== "get_member_coverage" || !matchesRequest) {
          resolution = { action: "clarify", focus: resolution.focus, reason: "conflict" };
        }
      }
    } catch (error) {
      const stopped = interrupted();
      if (turn && error instanceof InferenceDeadlineError) return stopped ?? CHAT_TIMEOUT;
      if (!turn || !stopped) clear();
      return stopped ?? { status: 503, code: "AI_UNAVAILABLE", answer: "المساعد المحلي مش متاح دلوقتي. جرّب تبعت سؤالك بعد شوية." };
    }
    const stopped = interrupted();
    if (stopped) {
      if (!turn) clear();
      return stopped;
    }
    if (resolution.action === "reply") {
      const reply = conversationReply(resolution.reply);
      const subject = resolution.reply.subject;
      const note = reply.code === "FAQ" && isFaqSubject(subject) ? { kind: "faq", subject } as const : undefined;
      return deliver(reply, { update: resolution.topic === "clear" ? clear : undefined, note });
    }
    if (resolution.action === "explain") {
      const update = resolution.purpose === "unsupported" ? () => auth.offerConversationReferral(session, "unsupported") :
        resolution.topic === "clear" ? clear : undefined;
      return deliver(explainConversation(resolution.purpose), { update });
    }
    if (resolution.action === "clarify-benefit") {
      const name = SERVICE_CATALOG[resolution.service].name;
      return deliver({ code: "CLARIFICATION_NEEDED",
        answer: `لو لسه بتسأل عن ${name}، تقصد نسبة التحمل، الحد المتبقي، ولا شرط الموافقة المسبقة؟` });
    }
    if (resolution.action === "ground" || resolution.action === "clarify" && resolution.reason === "conflict") {
      return decline("CLARIFICATION_NEEDED", CLARIFY_SERVICE, true);
    }
    if (resolution.action === "clarify") {
      const { reason, focus } = resolution;
      const reply = conversationReply({ intent: reason === "multiple" ? "CLARIFY" : "FOLLOW_UP",
        subject: reason === "multiple" ? "MULTIPLE" : "NONE", focus });
      return deliver(reply, { update: () => auth.awaitConversationService(session, focus) });
    }
    const { service: serviceCode, focus, topic } = resolution;
    if (topic === "replace" && !turn) clear();

    let coverage: Coverage;
    try {
      coverage = validateCoverageResponse(await this.backend.getCoverage(session, serviceCode), serviceCode);
    } catch {
      const stopped = interrupted();
      if (!turn || !stopped) clear();
      return stopped ?? COVERAGE_UNAVAILABLE;
    }
    const finished = interrupted();
    if (finished) {
      if (!turn) clear();
      return finished;
    }
    if (coverage.coverageStatus === "UNKNOWN") {
      return deliver({ code: "COVERAGE_NOT_AVAILABLE", answer: formatFocusedCoverage(coverage, focus) ?? SAFE_RETRY },
        { update: () => auth.offerConversationReferral(session, "unavailable") });
    }
    const focusedAnswer = formatFocusedCoverage(coverage, focus);
    const blocks = focusedAnswer ? { answer: focusedAnswer } : coverageBlocks(coverage);
    return deliver({ code: "COVERAGE_RESULT", answer: Object.values(blocks).join(" ") },
      { update: topic === "replace" ? () => auth.resolveConversationService(session, "", serviceCode) : undefined,
        note: { kind: "coverage", service: serviceCode, focus }, explainBenefit: coverage.coverageStatus !== "NOT_COVERED", blocks });
  }
}

function formatCoverage(coverage: Coverage): string {
  return Object.values(coverageBlocks(coverage)).join(" ");
}

function coverageBlocks(coverage: Coverage): Readonly<Record<string, string>> {
  const name = SERVICE_CATALOG[coverage.serviceCode].name;
  if (coverage.coverageStatus === "UNKNOWN") return { answer: `مش قادرين نحدد تغطية ${name} من البيانات الحالية. راجع خدمة العملاء. (بيانات تجريبية)` };
  if (coverage.coverageStatus === "NOT_COVERED") return { answer: `${name} غير مغطّى حسب الوثيقة التجريبية الحالية. لو عندك استفسار راجع خدمة العملاء. (بيانات تجريبية)` };
  const conditions = coverage.coverageStatus === "COVERED_WITH_CONDITIONS" ? " بشروط" : "";
  const blocks: Record<string, string> = { answer: `${name} مغطّى${conditions} حسب بيانات الوثيقة التجريبية.` };
  if (coverage.copayPercent !== null) blocks.copay = `نسبة التحمل: ${coverage.copayPercent}%.`;
  if (coverage.remainingLimit !== null) blocks.limit = `الحد المتبقي: ${formatRemainingLimit(coverage.remainingLimit)} جنيه.`;
  if (coverage.requiresPreApproval === true) blocks.preapproval = "لازم موافقة مسبقة من المختص قبل تقديم الخدمة، وده مش قرار موافقة.";
  else if (coverage.requiresPreApproval === null) blocks.preapproval = "حالة الموافقة المسبقة غير معروفة؛ راجع خدمة العملاء.";
  blocks.disclaimer = "(بيانات تجريبية وليست تأكيد تغطية حقيقي)";
  return blocks;
}
