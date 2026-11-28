import type { ServiceCode } from "./contracts.ts";

export const SERVICE_CATALOG = {
  MRI: { name: "الرنين المغناطيسي", meaning: "images inside the body using strong magnetic fields and radio waves; often a tunnel" },
  CBC: { name: "صورة الدم الكاملة", meaning: "complete blood count: measures red cells, white cells and platelets" },
  XRAY: { name: "الأشعة السينية", meaning: "plain radiograph or standard X-ray; not CT, MRI or ultrasound" }
} satisfies Record<ServiceCode, { name: string; meaning: string }>;

export const CONVERSATION_INTENTS = [
  "COVERAGE_LOOKUP", "FOLLOW_UP", "CAPABILITIES", "FAQ", "UNSUPPORTED_SERVICE", "CLARIFY", "OUT_OF_SCOPE"
] as const;
export const SUBJECTS = ["MRI", "CBC", "XRAY", "SERVICES", "ROLE", "COPAY", "LIMIT", "PREAPPROVAL", "MULTIPLE", "THIRD_PARTY", "NONE"] as const;
export const FOCUSES = ["OVERVIEW", "COPAY", "LIMIT", "PREAPPROVAL"] as const;
export type Focus = (typeof FOCUSES)[number];
export type ConversationIntent = Readonly<{
  intent: (typeof CONVERSATION_INTENTS)[number];
  subject: (typeof SUBJECTS)[number];
  focus: Focus;
}>;

export type DialogueContext =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "active"; service: ServiceCode }>
  | Readonly<{ kind: "referral"; reason: "unavailable" | "unsupported" }>
  | Readonly<{ kind: "pending"; focus: Focus }>;

export type AccountQuestionPurpose = "clarify-policy-tier" | "policy-tier" | "member-name" | "nearest-branch";

export type TurnResolution =
  | Readonly<{ action: "lookup"; service: ServiceCode; focus: Focus; topic: "keep" | "replace" }>
  | Readonly<{ action: "clarify"; focus: Focus; reason: "service" | "multiple" | "conflict" }>
  | Readonly<{ action: "clarify-benefit"; service: ServiceCode }>
  | Readonly<{ action: "reply"; reply: ConversationIntent; topic: "clear" | "keep" }>
  | Readonly<{ action: "explain"; purpose: "referral" | "unsupported" | "approval-action" |
    AccountQuestionPurpose; topic: "clear" | "keep" }>;

export type GroundingKind = "service" | "follow-up";
export type TurnEvidence = Readonly<{ match: string; quote: string }>;

export interface ConversationInterpreter {
  interpret(question: string, context: DialogueContext, signal?: AbortSignal): Promise<ConversationIntent>;
  ground(question: string, kind: GroundingKind, signal?: AbortSignal): Promise<TurnEvidence>;
}
