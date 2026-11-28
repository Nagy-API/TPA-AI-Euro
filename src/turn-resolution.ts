import type { ConversationIntent, DialogueContext, Focus, GroundingKind, TurnEvidence, TurnResolution } from "./conversation-intent.ts";
import { isServiceCode } from "./contracts.ts";
import {
  asksAboutExclusion, asksDefinition, asksPolicyBenefit, asksReferralFollowUp,
  asksWhetherReferencedAmountIsDue, correctedServiceSelection, coverageSubjectText, explicitBenefitFocus,
  explicitlyRefersToSameProcedure, hasGroundedServiceQuote, inspectServiceSubject, isShortCbcSelection,
  nonCoveragePurpose, normalizeArabic, serviceSelection, standaloneBenefitFocus
} from "./coverage-input.ts";

type Resolution = TurnResolution | Readonly<{ action: "ground"; kind: GroundingKind }>;
type Grounded = Readonly<{ kind: GroundingKind; evidence: TurnEvidence }>;

const clarify = (focus: Focus, reason: "service" | "multiple" | "conflict" = "service"): TurnResolution =>
  ({ action: "clarify", focus, reason });
const reply = (proposal: ConversationIntent, topic: "clear" | "keep" = "clear"): TurnResolution =>
  ({ action: "reply", reply: proposal, topic });

function copiedQuote(question: string, quote: string): boolean {
  const normalize = (text: string) => normalizeArabic(text).toLowerCase().replace(/ى/gu, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const excerpt = normalize(quote);
  return excerpt.length >= 3 && ` ${normalize(question)} `.includes(` ${excerpt} `);
}

/** Map untrusted observations to one action against the current trusted dialogue state. */
export function resolveTurn(
  question: string, context: DialogueContext, proposal: ConversationIntent, grounded?: Grounded
): Resolution {
  const purpose = nonCoveragePurpose(question);
  if (purpose) return { action: "explain", purpose, topic: "clear" };

  const { intent, subject, focus } = proposal;
  const clues = inspectServiceSubject(question);
  const text = coverageSubjectText(question);
  const benefit = explicitBenefitFocus(text);
  const pending = context.kind === "pending" ? context.focus : undefined;
  const definition = asksDefinition(text);
  const policyCue = asksPolicyBenefit(text);

  if (context.kind === "referral" && clues.named.length === 0 && asksReferralFollowUp(question)) {
    return { action: "explain", purpose: "referral", topic: "keep" };
  }
  if (context.kind === "referral" && context.reason === "unsupported" &&
      clues.named.length === 0 && asksAboutExclusion(question)) {
    return { action: "reply", reply: { intent: "UNSUPPORTED_SERVICE", subject: "NONE", focus: "OVERVIEW" }, topic: "keep" };
  }
  if (intent === "UNSUPPORTED_SERVICE") return { action: "explain", purpose: "unsupported", topic: "clear" };
  if (intent === "OUT_OF_SCOPE") {
    return reply(subject === "THIRD_PARTY" && !policyCue && !benefit && !clues.named.length
      ? { ...proposal, subject: "NONE" } : proposal);
  }
  if (clues.named.length > 1 || intent === "CLARIFY" && subject === "MULTIPLE") {
    return clarify(benefit ?? pending ?? focus, "multiple");
  }
  const correction = context.kind === "active" ? correctedServiceSelection(question) : undefined;
  if (clues.unsupported || clues.comparison && !correction) return clarify("OVERVIEW", "conflict");

  if (context.kind === "active" && clues.named.length === 0 && asksWhetherReferencedAmountIsDue(text)) {
    return reply({ intent: "FAQ", subject: "LIMIT", focus: "OVERVIEW" }, "keep");
  }

  const named = correction ?? clues.named[0];
  const proposed = isServiceCode(subject) ? subject : undefined;
  const continuesCbc = context.kind === "active" && context.service === "CBC";
  if (!named && (pending !== undefined || continuesCbc) && isShortCbcSelection(question)) {
    if (proposed && proposed !== "CBC") return clarify(pending ?? "OVERVIEW", "conflict");
    return { action: "lookup", service: "CBC", focus: pending ?? "OVERVIEW", topic: continuesCbc ? "keep" : "replace" };
  }
  // A quoted price is not authoritative. It can establish a personal copay
  // question only when the proposal confirms that benefit and the text asks
  // what the speaker owes.
  const personalPrice = intent === "FAQ" && subject === "COPAY" && /[؟?]\s*$/u.test(text) &&
    /\p{Nd}+\s*(?:جنيه|egp)/iu.test(text) && /(?:مني|علي[اّ]?|جيبي|ادفع|\b(?:my|me|i pay)\b)/iu.test(text);
  if (named) {
    if (definition) return intent === "FAQ" ? reply(proposal) : clarify("OVERVIEW", "conflict");
    if (intent === "COVERAGE_LOOKUP" && proposed !== named) return clarify(benefit ?? pending ?? focus, "conflict");
    const selection = serviceSelection(question, named);
    if (selection === "full" || selection === "short" && pending !== undefined) {
      if (proposed && proposed !== named) return clarify(pending ?? "OVERVIEW", "conflict");
      return { action: "lookup", service: named, focus: pending ?? "OVERVIEW", topic: "replace" };
    }
    // A procedure mentioned in a broader request does not establish a coverage request by itself.
    const namesPolicy = /تامين|وثيق[هةتي]|بوليص[هةتي]|\b(?:policy|insurance|coverage)\b/iu.test(text);
    if (policyCue || personalPrice || correction ||
        intent === "COVERAGE_LOOKUP" && !selection && (namesPolicy || pending !== undefined)) {
      const requestedFocus = benefit ?? (!policyCue && !personalPrice ? pending : undefined) ??
        (intent === "FAQ" && (subject === "COPAY" || subject === "LIMIT" || subject === "PREAPPROVAL") ? subject : focus);
      return { action: "lookup", service: named, focus: requestedFocus, topic: "replace" };
    }
    return intent === "FOLLOW_UP" ? clarify(benefit ?? focus) : reply(proposal);
  }

  const label = standaloneBenefitFocus(text);
  if (label) return context.kind === "active"
    ? { action: "lookup", service: context.service, focus: label, topic: "keep" }
    : clarify(label);

  const contextualCandidate = context.kind === "active" && (explicitlyRefersToSameProcedure(text) ||
    policyCue && /(?<!\p{L})(?:الفحص|التحليل|الخدمة)(?!\p{L})|\bthe (?:test|procedure|service)\b/iu.test(text) &&
    !(proposed && hasGroundedServiceQuote(text, text, proposed)));
  if (proposed && !definition && (intent === "COVERAGE_LOOKUP" || intent === "FAQ" && policyCue) && !contextualCandidate) {
    if (!grounded) return { action: "ground", kind: "service" };
    const { match, quote } = grounded.evidence;
    if (grounded.kind === "service" && match === proposed && copiedQuote(text, quote) &&
      hasGroundedServiceQuote(text, quote, proposed)
    ) return { action: "lookup", service: proposed, focus: benefit ?? (policyCue ? focus : pending ?? focus), topic: "replace" };
    return clarify(benefit ?? pending ?? focus, "conflict");
  }

  if (intent === "FAQ" && !definition && benefit && context.kind !== "active") return clarify(benefit);
  const maybeFollowUp = !definition &&
    (contextualCandidate && policyCue || intent === "FOLLOW_UP" || benefit !== undefined && policyCue ||
      intent === "FAQ" && context.kind === "active");
  if (maybeFollowUp) {
    if (context.kind !== "active") return clarify(benefit ?? pending ?? focus);
    if (!grounded) return { action: "ground", kind: "follow-up" };
    const { match, quote } = grounded.evidence;
    // A copied phrase establishes provenance, but the app must also recognize
    // the requested benefit independently of the model's two proposals.
    const confirmedFocus = benefit === match ? benefit :
      match === "OVERVIEW" && !benefit && contextualCandidate && policyCue ? "OVERVIEW" : undefined;
    if (grounded.kind === "follow-up" && confirmedFocus &&
        (copiedQuote(text, quote) || benefit === match && policyCue)) {
      return { action: "lookup", service: context.service, focus: confirmedFocus, topic: "keep" };
    }
    if (grounded.kind === "follow-up" && intent === "FOLLOW_UP" && benefit && policyCue &&
        (match === "COPAY" || match === "LIMIT" || match === "PREAPPROVAL") && match !== benefit &&
        copiedQuote(text, quote)) {
      return { action: "clarify-benefit", service: context.service };
    }
    if (intent === "FOLLOW_UP" || benefit && policyCue) return clarify(benefit ?? focus);
  }

  if (intent === "CAPABILITIES") {
    const namesCatalog = /خدمات|فحوص(?:ات)?|تحاليل|اشعات|\b(?:services|tests|list)\b/iu.test(text);
    const asksBeyondCatalog = /(?:تقدر|تساعد|able|can you).{0,40}(?:غير|besides|apart from)/iu.test(text);
    return reply({ ...proposal, subject: namesCatalog && !asksBeyondCatalog ? "SERVICES" : "ROLE" });
  }
  if (intent === "CLARIFY") {
    const coverageLanguage = /تامين|وثيق|فحص|تحليل|اشع|علاج|تصوير|\b(?:insurance|policy|test|scan|exam|imaging)\b/iu.test(text);
    if (policyCue || benefit || pending !== undefined || coverageLanguage) return clarify(benefit ?? pending ?? focus);
    return reply({ intent: "OUT_OF_SCOPE", subject: "NONE", focus: "OVERVIEW" });
  }
  return reply(proposal);
}
