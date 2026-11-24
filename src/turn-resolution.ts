import type { ConversationIntent, DialogueContext, Focus, GroundingKind, TurnEvidence, TurnResolution } from "./conversation-intent.ts";
import { isServiceCode } from "./contracts.ts";
import {
  asksDefinition, asksPolicyBenefit, asksWhetherReferencedAmountIsDue, correctedServiceSelection, coverageSubjectText,
  explicitBenefitFocus, hasGroundedServiceQuote, inspectServiceSubject, isServiceSelection, normalizeArabic, standaloneBenefitFocus
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
  const { intent, subject, focus } = proposal;
  const clues = inspectServiceSubject(question);
  const text = coverageSubjectText(question);
  const benefit = explicitBenefitFocus(text);
  const pending = context.kind === "pending" ? context.focus : undefined;
  const definition = asksDefinition(text);
  const policyCue = asksPolicyBenefit(text);

  if (intent === "OUT_OF_SCOPE" || intent === "UNSUPPORTED_SERVICE") return reply(proposal);
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
  const selection = named !== undefined && isServiceSelection(question, named);
  const picked = selection && pending !== undefined;
  // A quoted price is not authoritative. It can establish a personal copay
  // question only when the proposal confirms that benefit and the text asks
  // what the speaker owes.
  const personalPrice = intent === "FAQ" && subject === "COPAY" && /[؟?]\s*$/u.test(text) &&
    /\p{Nd}+\s*(?:جنيه|egp)/iu.test(text) && /(?:مني|علي[اّ]?|جيبي|ادفع|\b(?:my|me|i pay)\b)/iu.test(text);
  if (named) {
    if (definition) return intent === "FAQ" ? reply(proposal) : clarify("OVERVIEW", "conflict");
    if (intent === "COVERAGE_LOOKUP" && proposed !== named) return clarify(benefit ?? pending ?? focus, "conflict");
    if (intent === "COVERAGE_LOOKUP" && !selection || policyCue || personalPrice || picked || correction) {
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

  if (proposed && !definition && (intent === "COVERAGE_LOOKUP" || intent === "FAQ" && policyCue)) {
    if (!grounded) return { action: "ground", kind: "service" };
    const { match, quote } = grounded.evidence;
    return grounded.kind === "service" && match === proposed && copiedQuote(text, quote) &&
      hasGroundedServiceQuote(text, quote, proposed)
      ? { action: "lookup", service: proposed, focus: benefit ?? (policyCue ? focus : pending ?? focus), topic: "replace" }
      : clarify(benefit ?? pending ?? focus, "conflict");
  }

  const maybeFollowUp = !definition &&
    (intent === "FOLLOW_UP" || benefit !== undefined && policyCue || intent === "FAQ" && context.kind === "active");
  if (maybeFollowUp) {
    if (context.kind !== "active") return clarify(benefit ?? pending ?? focus);
    if (!grounded) return { action: "ground", kind: "follow-up" };
    const { match, quote } = grounded.evidence;
    const matchedBenefit = match === "COPAY" || match === "LIMIT" || match === "PREAPPROVAL";
    if (grounded.kind === "follow-up" && matchedBenefit &&
        (copiedQuote(text, quote) || (benefit === match && policyCue))) {
      return { action: "lookup", service: context.service, focus: benefit ?? match, topic: "keep" };
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
