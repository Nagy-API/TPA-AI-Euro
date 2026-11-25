import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConversationIntent, DialogueContext } from "../src/conversation-intent.ts";
import { resolveTurn } from "../src/turn-resolution.ts";

const idle = { kind: "idle" } as const;
const pending = { kind: "pending", focus: "COPAY" } as const;
const cbc = { intent: "COVERAGE_LOOKUP", subject: "CBC", focus: "OVERVIEW" } as const;
const capabilities = { intent: "CAPABILITIES", subject: "SERVICES", focus: "OVERVIEW" } as const;

test("whole catalog selections open a lookup without borrowing a model focus or prior topic", () => {
  for (const [question, context, proposal, focus] of [
    ["صورة الدم الكاملة", idle, { ...cbc, focus: "COPAY" }, "OVERVIEW"],
    ["طب نبدأ بتعداد الدم الكامل؟", idle, capabilities, "OVERVIEW"],
    ["قصدي على صورة الدم الكاملة", pending, capabilities, "COPAY"]
  ] satisfies [string, DialogueContext, ConversationIntent, string][]) {
    assert.deepEqual(resolveTurn(question, context, proposal),
      { action: "lookup", service: "CBC", focus, topic: "replace" }, question);
  }
});

test("CBC shorthand needs a service clarification or an active CBC topic", () => {
  assert.deepEqual(resolveTurn("منا بقولك صوره دم", { kind: "active", service: "CBC" }, cbc),
    { action: "lookup", service: "CBC", focus: "OVERVIEW", topic: "keep" });
  assert.deepEqual(resolveTurn("أنا قصدي صورة الدم", pending, capabilities),
    { action: "lookup", service: "CBC", focus: "COPAY", topic: "replace" });
  for (const [question, context] of [
    ["صورة دم", idle],
    ["صورة دم", { kind: "active", service: "MRI" }],
    ["تحليل دم", pending],
    ["صورة دم للسكر", pending],
    ["صورة دم وسونار", pending],
    ["مش صورة دم", pending],
    ["صورة دم لأخويا", pending],
    ["صورة الدم الكاملة والرنين", idle]
  ] satisfies [string, DialogueContext][]) {
    const resolution = resolveTurn(question, context, cbc, { kind: "service", evidence: { match: "CBC", quote: question } });
    assert.notEqual(resolution.action, "lookup", question);
  }
  assert.notEqual(resolveTurn("صورة الدم الكاملة", idle, { ...cbc, subject: "MRI" }).action, "lookup");
  assert.notEqual(resolveTurn("صورة الدم الكاملة", idle, { ...cbc, intent: "OUT_OF_SCOPE", subject: "THIRD_PARTY" }).action, "lookup");
});

test("account and branch questions have distinct non-lookup purposes and clear the service topic", () => {
  for (const [question, purpose] of [
    ["طيب انا نوعي ايه", "clarify-policy-tier"],
    ["هو أنا تبع أنهي فئة تأمينية؟", "policy-tier"],
    ["طيب انا اسمي ايه", "member-name"],
    ["تعرف الاسم المسجل على حسابي؟", "member-name"],
    ["اقرب فرع ليا", "nearest-branch"],
    ["فين أقرب فرع أعمل فيه CBC؟", "nearest-branch"]
  ]) {
    assert.deepEqual(resolveTurn(question, { kind: "active", service: "MRI" }, capabilities),
      { action: "explain", purpose, topic: "clear" }, question);
  }
});

test("a verbatim quote needs benefit evidence and cannot override a contradictory benefit", () => {
  const active = { kind: "active", service: "CBC" } as const;
  const followUp = { intent: "FOLLOW_UP", subject: "NONE", focus: "COPAY" } as const;
  assert.equal(resolveTurn("طب والميعاد إمتى؟", active, followUp,
    { kind: "follow-up", evidence: { match: "COPAY", quote: "والميعاد إمتى" } }).action, "clarify");
  assert.equal(resolveTurn("فاضل كام من الحد المتبقي؟", active, followUp,
    { kind: "follow-up", evidence: { match: "COPAY", quote: "الحد المتبقي" } }).action, "clarify");
  assert.deepEqual(resolveTurn("طب هدفع كام من جيبي؟", active, followUp,
    { kind: "follow-up", evidence: { match: "COPAY", quote: "من جيبي" } }),
    { action: "lookup", service: "CBC", focus: "COPAY", topic: "keep" });
});
