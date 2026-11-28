import assert from "node:assert/strict";
import { once } from "node:events";
import { test, type TestContext } from "node:test";
import type { ConversationIntent, DialogueContext, TurnEvidence } from "../src/conversation-intent.ts";
import type { ServiceCode } from "../src/contracts.ts";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import { DEMO_MEMBERS } from "../src/demo-auth/fixtures.ts";
import { DemoMemberAuth } from "../src/demo-auth/member-auth.ts";
import { createDemoServer } from "../src/http-server.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";
import { OllamaCoverageIntentSelector } from "../src/ollama-selector.ts";

const model = "qwen:test";
const mri = { intent: "COVERAGE_LOOKUP", subject: "MRI", focus: "OVERVIEW" } as const;
const cbc = { ...mri, subject: "CBC" } as const;
const services = { intent: "CAPABILITIES", subject: "SERVICES", focus: "OVERVIEW" } as const;
const copay = { intent: "FOLLOW_UP", subject: "NONE", focus: "COPAY" } as const;
const idle = { kind: "idle" } as const;
const activeCbc = { kind: "active", service: "CBC" } as const;
const activeMri = { kind: "active", service: "MRI" } as const;
const referral = { kind: "referral", reason: "unsupported" } as const;
const pendingCopay = { kind: "pending", focus: "COPAY" } as const;

type Proposal = ConversationIntent | TurnEvidence | ((signal: AbortSignal) => Promise<TurnEvidence>);

async function start(t: TestContext, deadline = 5_000) {
  let clockOffset = 0;
  const auth = new DemoMemberAuth(() => Date.now() + clockOffset);
  const backend = new MockTpaBackend(auth);
  const proposals: Proposal[] = [];
  const lookups: { service: ServiceCode; member: string; tenant: string }[] = [];
  const selector = new OllamaCoverageIntentSelector(model, async (input, init) => {
    if (String(input).endsWith("/api/tags")) {
      return Response.json({ models: [{ name: model, size: 1, details: { format: "gguf" } }] });
    }
    const next = proposals.shift();
    assert.ok(next, "Unexpected inference");
    const { format } = JSON.parse(String(init?.body));
    assert.ok(init?.signal);
    if (typeof next === "function") assert.ok(format.properties.match, "Expected follow-up grounding");
    const value = typeof next === "function" ? await next(init.signal) : next;
    assert.deepEqual(Object.keys(value).sort(), [...format.required].sort());
    return Response.json({ done: true, done_reason: "stop", message: { role: "assistant", content: JSON.stringify(value) } });
  });
  const assistant = new CoverageAssistant({
    resolveSession: backend.resolveSession.bind(backend),
    getCoverage(session, service) {
      lookups.push({ service, member: session.memberKey, tenant: session.tenantKey });
      return backend.getCoverage(session, service);
    }
  }, selector, auth, selector);
  const server = createDemoServer(assistant, true, auth, true, deadline);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;

  async function post(path: string, body: object, token?: string, signal?: AbortSignal) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers["x-demo-session"] = token;
    const response = await fetch(base + path, { method: "POST", headers, body: JSON.stringify(body), signal });
    return { status: response.status, body: await response.json() as { answer: string; code: string; challengeId?: string; sessionToken?: string } };
  }
  async function login(index = 0) {
    const fixture = DEMO_MEMBERS[index];
    const challenge = await post("/v1/member-auth/challenges", { memberIdentifier: fixture.identifier });
    assert.equal(challenge.status, 202);
    assert.ok(challenge.body.challengeId);
    const verified = await post(`/v1/member-auth/challenges/${challenge.body.challengeId}/verify`, { oneTimeCode: fixture.code });
    assert.equal(verified.status, 200);
    assert.ok(verified.body.sessionToken);
    return verified.body.sessionToken;
  }
  function context(token: string): DialogueContext {
    const session = auth.resolveSession(token);
    return session ? auth.conversationContext(session) : idle;
  }
  function chat(token: string | undefined, message: string, signal?: AbortSignal) {
    return post("/v1/chat", { message }, token, signal);
  }
  return { login, context, chat, post, proposals, lookups, advance: (ms: number) => { clockOffset += ms; } };
}

type ExpectedTurn = readonly [
  message: string, code: string, answer: RegExp, context: DialogueContext,
  service: ServiceCode | null, ...proposals: Proposal[]
];

async function replay(demo: Awaited<ReturnType<typeof start>>, memberIndex: number, turns: readonly ExpectedTurn[]) {
  const token = await demo.login(memberIndex);
  const { memberKey: member, tenantKey: tenant } = DEMO_MEMBERS[memberIndex];
  for (const [message, code, answer, context, service, ...proposals] of turns) {
    demo.proposals.push(...proposals);
    const before = demo.lookups.length;
    const response = await demo.chat(token, message);
    assert.equal(response.status, 200, message);
    assert.equal(response.body.code, code, message);
    assert.match(response.body.answer, answer, message);
    assert.deepEqual(demo.context(token), context, message);
    assert.deepEqual(demo.lookups.slice(before), service ? [{ service, member, tenant }] : [], message);
    assert.deepEqual(demo.proposals, [], message);
  }
}

test("verified V0.4 HTTP replays Nagy's nine turns against the captured proposals", async (t) => {
  const demo = await start(t);
  await replay(demo, 0, [
    ["هل الرنين المغناطيسي مغطى؟", "COVERAGE_RESULT", /الرنين.*مغطّى بشروط.*20%.*5,000.*موافقة مسبقة/, activeMri, "MRI", mri],
    ["طيب تبييض الاسنان", "UNSUPPORTED_SERVICE", /مش ضمن الخدمات/, referral, null],
    ["وتلقيح المجهر", "UNSUPPORTED_SERVICE", /مش ضمن الخدمات/, referral, null, { ...services, intent: "UNSUPPORTED_SERVICE", subject: "NONE" }],
    ["ايه الخدمات المتاحه", "CAPABILITIES", /الرنين.*صورة الدم الكاملة.*الأشعة السينية/, idle, null, services],
    ["طيب انا نوعي ايه", "CLARIFICATION_NEEDED", /تقصد فئة وثيقة التأمين/, idle, null],
    ["طيب انا اسمي ايه", "OUT_OF_SCOPE", /اسمك المسجّل.*مش متاح/, idle, null],
    ["اقرب فرع ليا", "OUT_OF_SCOPE", /مواقع الفروع.*أقرب فرع/, idle, null],
    ["صورة الدم الكاملة", "COVERAGE_RESULT", /صورة الدم الكاملة مغطّى.*0%.*1,000/, activeCbc, "CBC", cbc],
    ["منا بقولك صوره دم", "COVERAGE_RESULT", /صورة الدم الكاملة مغطّى.*0%.*1,000/, activeCbc, "CBC", cbc]
  ]);
});

test("verified HTTP uses the pending focus for a short CBC selection and keeps risky alternatives at zero lookups", async (t) => {
  const demo = await start(t);
  const denied = await demo.chat(undefined, "صورة الدم الكاملة");
  assert.equal(denied.status, 401);
  assert.deepEqual(demo.lookups, []);
  await replay(demo, 1, [
    ["أقدر أختار من أنهي فحوصات؟", "CAPABILITIES", /صورة الدم الكاملة/, idle, null, services],
    ["طب نبدأ بتعداد الدم الكامل؟", "COVERAGE_RESULT", /صورة الدم الكاملة مغطّى بشروط.*30%.*400/, activeCbc, "CBC", services],
    ["هو أنا تبع أنهي فئة تأمينية؟", "OUT_OF_SCOPE", /فئة وثيقتك.*مش متاحة/, idle, null],
    ["تعرف الاسم المسجل على حسابي؟", "OUT_OF_SCOPE", /اسمك المسجّل.*مش متاح/, idle, null],
    ["فين أقرب فرع أعمل فيه CBC؟", "OUT_OF_SCOPE", /مواقع الفروع/, idle, null],
    ["هدفع قد إيه من جيبي؟", "CLARIFICATION_NEEDED", /أنهي فحص/, pendingCopay, null, copay],
    ["أنا قصدي صورة الدم", "COVERAGE_RESULT", /^(?!.*موافقة مسبقة).*صورة الدم.*30%.*التغطية مشروطة/, activeCbc, "CBC", services],
    ["طب قد إيه عليّا من جيبي؟", "COVERAGE_RESULT", /صورة الدم.*30%.*التغطية مشروطة/, activeCbc, "CBC",
      copay, { match: "COPAY", quote: "من جيبي" }],
    ["هل CBC محتاج موافقة؟", "COVERAGE_RESULT", /ما بتشترطش موافقة مسبقة.*التغطية مشروطة/, activeCbc, "CBC", cbc],
    ["صورة الدم الكاملة وجلسة علاج طبيعي", "CLARIFICATION_NEEDED", /اسم الفحص/, idle, null, cbc],
    ["التأمين يشيل تحليل دم؟", "CLARIFICATION_NEEDED", /اسم الفحص/, idle, null, cbc,
      { match: "CBC", quote: "تحليل دم" }],
    ["صورة الدم الكاملة والرنين", "CLARIFICATION_NEEDED", /فحص واحد/, { kind: "pending", focus: "OVERVIEW" }, null],
    ["مش صورة دم", "CLARIFICATION_NEEDED", /اسم الفحص/, idle, null, cbc],
    ["صورة الدم الكاملة لأخويا", "OUT_OF_SCOPE", /صاحب الحساب التاني/, idle, null],
    ["تبييض السنان", "UNSUPPORTED_SERVICE", /مش ضمن الخدمات/, referral, null]
  ]);
});

function pauseGrounding(demo: Awaited<ReturnType<typeof start>>) {
  let announce!: () => void;
  let announceAbort!: () => void;
  let finish!: (evidence: TurnEvidence) => void;
  const started = new Promise<void>((resolve) => { announce = resolve; });
  const aborted = new Promise<void>((resolve) => { announceAbort = resolve; });
  demo.proposals.push(copay, (signal) => new Promise<TurnEvidence>((resolve, reject) => {
    function cancel() {
      announceAbort();
      reject(signal.reason);
    }
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
    finish = (evidence) => {
      signal.removeEventListener("abort", cancel);
      resolve(evidence);
    };
    announce();
  }));
  return { started, aborted, finish: (evidence: TurnEvidence) => finish(evidence) };
}

for (const transition of ["logout", "rotation"] as const) {
  test(`verified V0.4 HTTP ${transition} blocks a late grounding result and leaves the new session idle`,
    { timeout: 4_000 }, async (t) => {
      const demo = await start(t);
      const oldToken = await demo.login();
      demo.proposals.push(mri);
      assert.equal((await demo.chat(oldToken, "هل MRI مغطى؟")).body.code, "COVERAGE_RESULT");
      const { started, finish } = pauseGrounding(demo);
      const pending = demo.chat(oldToken, "هدفع كام من جيبي؟");
      await started;
      if (transition === "logout") assert.equal((await demo.post("/v1/member-auth/logout", {}, oldToken)).status, 200);
      demo.advance(61_000);
      const newToken = await demo.login();
      assert.notEqual(newToken, oldToken);
      finish({ match: "COPAY", quote: "من جيبي" });
      const oldResponse = await pending;
      assert.equal(oldResponse.status, 401);
      assert.equal(oldResponse.body.code, "VERIFICATION_REQUIRED");
      assert.deepEqual(demo.lookups.map(({ service }) => service), ["MRI"]);
      assert.deepEqual(demo.context(newToken), idle);
      demo.proposals.push(cbc);
      assert.equal((await demo.chat(newToken, "هل CBC مغطى؟")).body.code, "COVERAGE_RESULT");
      assert.deepEqual(demo.context(newToken), activeCbc);
      assert.deepEqual(demo.lookups.map(({ service }) => service), ["MRI", "CBC"]);
    });
}

for (const interruption of ["deadline", "disconnect", "expiry"] as const) {
  test(`verified V0.4 HTTP ${interruption} cancels grounding before lookup and releases the turn`, { timeout: 4_000 }, async (t) => {
    const demo = await start(t, interruption === "deadline" ? 450 : 2_000);
    const token = await demo.login();
    if (interruption === "expiry") demo.advance(600_000 - 450);
    demo.proposals.push(mri);
    assert.equal((await demo.chat(token, "هل MRI مغطى؟")).body.code, "COVERAGE_RESULT");
    assert.deepEqual(demo.context(token), activeMri);
    const { started, aborted } = pauseGrounding(demo);
    const controller = new AbortController();
    const response = demo.chat(token, "هدفع كام من جيبي؟", controller.signal);
    if (interruption === "disconnect") {
      const rejected = assert.rejects(response, { name: "AbortError" });
      await started;
      const busy = await demo.chat(token, "هل CBC مغطى؟");
      assert.equal(busy.status, 409);
      assert.equal(busy.body.code, "CHAT_BUSY");
      controller.abort();
      await rejected;
    } else {
      await started;
      const result = await response;
      assert.equal(result.status, interruption === "expiry" ? 401 : 503);
      assert.equal(result.body.code, interruption === "expiry" ? "VERIFICATION_REQUIRED" : "CHAT_TIMEOUT");
    }
    await aborted;
    assert.deepEqual(demo.lookups.map(({ service }) => service), ["MRI"]);
    // The transport may finish before the assistant's abort continuation.
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(demo.context(token), idle);
    if (interruption === "expiry") {
      demo.advance(451);
      assert.equal((await demo.chat(token, "هل CBC مغطى؟")).status, 401);
      return;
    }
    demo.proposals.push(copay, cbc);
    assert.equal((await demo.chat(token, "هدفع كام من جيبي؟")).body.code, "CLARIFICATION_NEEDED");
    assert.equal((await demo.chat(token, "هل CBC مغطى؟")).body.code, "COVERAGE_RESULT");
    assert.deepEqual(demo.context(token), activeCbc);
    assert.deepEqual(demo.lookups.map(({ service }) => service), ["MRI", "CBC"]);
  });
}

test("verified HTTP rejects unrelated or contradictory copied benefit evidence and qualifies focused MRI", async (t) => {
  const demo = await start(t);
  await replay(demo, 0, [
    ["هل MRI مغطى؟", "COVERAGE_RESULT", /مغطّى بشروط.*موافقة مسبقة/, activeMri, "MRI", mri],
    ["هدفع كام من جيبي؟", "COVERAGE_RESULT", /20%.*التغطية مشروطة.*موافقة مسبقة/, activeMri, "MRI",
      copay, { match: "COPAY", quote: "من جيبي" }],
    ["طب والميعاد إمتى؟", "CLARIFICATION_NEEDED", /أنهي فحص/, pendingCopay, null,
      copay, { match: "COPAY", quote: "والميعاد إمتى" }],
    ["هل MRI مغطى؟", "COVERAGE_RESULT", /مغطّى بشروط/, activeMri, "MRI", mri],
    ["فاضل كام من الحد المتبقي؟", "CLARIFICATION_NEEDED", /الرنين.*نسبة التحمل.*الحد المتبقي/, activeMri,
      null, copay, { match: "COPAY", quote: "الحد المتبقي" }]
  ]);
});

test("verified HTTP refuses provider logistics and executing approval before inference or lookup", async (t) => {
  const demo = await start(t);
  await replay(demo, 0, [
    ["هل MRI مغطى؟", "COVERAGE_RESULT", /مغطّى بشروط/, activeMri, "MRI", mri],
    ["هو مكتبكم الأقرب لبيتي عشان أعمل فيه صورة الدم الكاملة؟", "OUT_OF_SCOPE", /مواقع الفروع/, idle, null],
    ["عايز موافقة تصدرلي على MRI", "OUT_OF_SCOPE", /اختصاص الجهة المختصة/, idle, null],
    ["هل وثيقتي تستلزم موافقة مسبقة للرنين؟", "COVERAGE_RESULT", /محتاج موافقة مسبقة/, activeMri, "MRI", mri],
    ["اسمي المسجّل عندكم إيه؟", "OUT_OF_SCOPE", /اسمك المسجّل.*مش متاح/, idle, null],
    ["أنا فئة إيه في التأمين؟", "OUT_OF_SCOPE", /فئة وثيقتك.*مش متاحة/, idle, null]
  ]);
});

test("verified HTTP keeps the active service during benefit clarification and displayed-limit explanations", async (t) => {
  const demo = await start(t);
  const followUp = { ...copay, focus: "OVERVIEW" } as const;
  await replay(demo, 0, [
    ["هل MRI مغطى؟", "COVERAGE_RESULT", /مغطّى بشروط/, activeMri, "MRI", mri],
    ["طيب هيتحملوني جزء من الفاتورة قد إيه؟", "CLARIFICATION_NEEDED", /الرنين.*نسبة التحمل.*الحد المتبقي/,
      activeMri, null, followUp, { match: "LIMIT", quote: "قد إيه" }],
    ["والحد لسه فيه كام لنفس الفحص؟", "COVERAGE_RESULT", /5,000.*مشروطة/, activeMri, "MRI",
      followUp, { match: "LIMIT", quote: "الحد لسه فيه كام" }],
    ["ده اللي هيتخصم مني ولا ده حد الوثيقة؟", "FAQ", /الحد المتبقي.*المبلغ اللي عليك/, activeMri, null, followUp]
  ]);
});

test("verified HTTP handles grounded preapproval, implicit CBC, and service-desk follow-up", async (t) => {
  const demo = await start(t);
  const approval = "موافقته لازم تيجي قبل ما أعمله؟";
  const description = "الفحص اللي بيتعمل بعينة عشان يعد الحمراء والبيضاء والصفائح";
  await replay(demo, 0, [
    ["هل MRI مغطى؟", "COVERAGE_RESULT", /مغطّى بشروط/, activeMri, "MRI", mri],
    [approval, "COVERAGE_RESULT", /محتاج موافقة مسبقة/, activeMri, "MRI",
      { ...copay, subject: "PREAPPROVAL", focus: "OVERVIEW" }, { match: "PREAPPROVAL", quote: approval }],
    [description + "، هتحمل فيه كام؟", "COVERAGE_RESULT", /صورة الدم.*0%/, activeCbc, "CBC",
      cbc, { match: "CBC", quote: description }],
    ["هل الأشعة العادية متغطية؟", "COVERAGE_NOT_AVAILABLE", /مش متاحة/,
      { kind: "referral", reason: "unavailable" }, "XRAY", { ...mri, subject: "XRAY" }],
    ["أسأل مين عشان أتأكد قبل المعاد؟", "OUT_OF_SCOPE", /خدمة العملاء/,
      { kind: "referral", reason: "unavailable" }, null, { ...services, intent: "CLARIFY", subject: "NONE" }]
  ]);
});
