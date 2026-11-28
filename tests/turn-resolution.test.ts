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
    ["خلينا نبدأ بصورة الدم الكاملة", idle, cbc, "OVERVIEW"],
    ["طب نبدأ بتعداد الدم الكامل؟", idle, capabilities, "OVERVIEW"],
    ["قصدي على صورة الدم الكاملة", pending, capabilities, "COPAY"]
  ] satisfies [string, DialogueContext, ConversationIntent, string][]) {
    assert.deepEqual(resolveTurn(question, context, proposal),
      { action: "lookup", service: "CBC", focus, topic: "replace" }, question);
  }
});

test("a named procedure as written on a referral is a direct selection", () => {
  const xray = { ...cbc, subject: "XRAY" } as const;
  assert.deepEqual(resolveTurn("طلبه مكتوب X-ray عادي على أسفل الضهر", idle, xray),
    { action: "lookup", service: "XRAY", focus: "OVERVIEW", topic: "replace" });
  assert.notEqual(resolveTurn("طلبه مكتوب X-ray عادي على أسفل الضهر، اعمله فين؟", idle, xray).action, "lookup");
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
  assert.deepEqual(resolveTurn("فاضل كام من الحد المتبقي؟", active, followUp,
    { kind: "follow-up", evidence: { match: "COPAY", quote: "الحد المتبقي" } }),
    { action: "clarify-benefit", service: "CBC" });
  assert.deepEqual(resolveTurn("طب هدفع كام من جيبي؟", active, followUp,
    { kind: "follow-up", evidence: { match: "COPAY", quote: "من جيبي" } }),
    { action: "lookup", service: "CBC", focus: "COPAY", topic: "keep" });
});

test("provider location and approval execution veto a model's coverage proposal", () => {
  for (const [question, service, purpose] of [
    ["هو مكتبكم الأقرب لبيتي عشان أعمل فيه صورة الدم الكاملة؟", "CBC", "nearest-branch"],
    ["فين أقدر أعمل CBC في أقرب معمل؟", "CBC", "nearest-branch"],
    ["Where can I get an MRI?", "MRI", "nearest-branch"],
    ["عايز موافقة تصدرلي على MRI", "MRI", "approval-action"],
    ["قدم طلب موافقة على CBC", "CBC", "approval-action"]
  ] as const) {
    assert.deepEqual(resolveTurn(question, idle, { ...cbc, subject: service }),
      { action: "explain", purpose, topic: "clear" }, question);
  }
  assert.notEqual(resolveTurn("اكتب وصف قصير لفحص CBC", idle, cbc).action, "lookup");
  assert.deepEqual(resolveTurn("بلاش التحليل، قصدي الأشعة السينية", { kind: "active", service: "CBC" },
    { ...cbc, subject: "XRAY" }),
    { action: "lookup", service: "XRAY", focus: "OVERVIEW", topic: "replace" });
});

test("valid proposals preserve preapproval and descriptive CBC grounding", () => {
  const approval = "موافقته لازم تيجي قبل ما أعمله؟";
  assert.deepEqual(resolveTurn(approval, { kind: "active", service: "MRI" },
    { intent: "FOLLOW_UP", subject: "PREAPPROVAL", focus: "OVERVIEW" },
    { kind: "follow-up", evidence: { match: "PREAPPROVAL", quote: approval } }),
    { action: "lookup", service: "MRI", focus: "PREAPPROVAL", topic: "keep" });
  const description = "الفحص اللي بيتعمل بعينة عشان يعد الحمراء والبيضاء والصفائح";
  assert.deepEqual(resolveTurn(description + "، هتحمل فيه كام؟", idle, cbc,
    { kind: "service", evidence: { match: "CBC", quote: description } }),
    { action: "lookup", service: "CBC", focus: "COPAY", topic: "replace" });
  const differentTest = "عايز تحليل عينة للصفائح مع السكر، التغطية كام؟";
  assert.notEqual(resolveTurn(differentTest, idle, cbc,
    { kind: "service", evidence: { match: "CBC", quote: differentTest } }).action, "lookup");
});
