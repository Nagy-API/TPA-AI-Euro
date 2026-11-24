import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import type { ServiceCode } from "../src/contracts.ts";
import { DemoMemberAuth } from "../src/demo-auth/member-auth.ts";
import { DEMO_MEMBERS } from "../src/demo-auth/fixtures.ts";
import { createDemoServer } from "../src/http-server.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";
import { OllamaCoverageIntentSelector } from "../src/ollama-selector.ts";

type Turn = readonly [question: string, code?: string, service?: ServiceCode, answer?: RegExp | string, status?: number];
type Action = "expire-topic" | "switch-vip" | "expire-session" | "login-gold" | "rotate-silver" |
  "use-new-session" | "provider-outage" | "mismatched-backend";
type Member = "gold" | "silver" | "vip" | "unverified";
type Sequence = { id: string; turns: readonly Turn[]; advance?: number; silver?: boolean; missingModel?: boolean;
  member?: Member; actions?: (Action | undefined)[]; topics?: (ServiceCode | null)[]; proposalKinds?: ("named" | "contextual" | undefined)[] };
type DisclosedSequence = {
  id: string; member: Member;
  turns: { question: string; code: string; lookup: ServiceCode | null; topic: ServiceCode | null; answerIncludes?: string; action?: Action }[];
};
type Qa2Sequence = {
  id: number; member: "G" | "S" | "V" | "-";
  turns: { message: string; status: number; lookup: "M" | "C" | "X" | "-"; topic: "M" | "C" | "X" | "-";
    answer: string; action: "topic" | "switch" | "expire" | "rotate" | "new" | "outage" | "wrong" | null }[];
};
const sequences: Sequence[] = [
  { id: "issue-17", turns: [
    ["الدكتور طالب مني أدخل جهاز بيصور ركبتي بالمغناطيس، التأمين هيساعدني في تكلفته؟", "COVERAGE_RESULT", "MRI", /مغطّى.*20%.*5,000.*موافقة مسبقة/],
    ["طب أنا هدفع كام من جيبي؟", "COVERAGE_RESULT", "MRI", /الرنين.*20%.*سعر الخدمة/],
    ["طب تبييض الأسنان متغطي عندي ولا لأ؟", "UNSUPPORTED_SERVICE"],
    ["تبييض أسنان", "UNSUPPORTED_SERVICE"],
    ["إيه الخدمات المتاحة", "CAPABILITIES", undefined, /الرنين.*صورة الدم.*الأشعة السينية/],
    ["إنت بتساعدني في إيه؟", "CAPABILITIES", undefined, /أراجع تغطية.*نسبة التحمل.*الحد المتبقي/],
    ["يعني إيه نسبة تحمل؟", "FAQ", undefined, /الجزء اللي عليك من تكلفة الخدمة المؤهلة/]
  ] },
  { id: "holdout-imaging", turns: [
    ["طلبوا مني تصوير للكتف بيعتمد على مجال مغناطيسي قوي، الوثيقة بتساهم فيه؟", "COVERAGE_RESULT", "MRI"],
    ["هيفضل لي رصيد قد إيه للفحص ده؟", "COVERAGE_RESULT", "MRI", /الحد المتبقي.*الرنين.*5,000 جنيه/],
    ["طب لازم أخد إذن قبل ما أعمله؟", "COVERAGE_RESULT", "MRI", /الرنين.*محتاج موافقة مسبقة/]
  ] },
  { id: "holdout-lab", turns: [
    ["المعمل هياخد عينة عشان يقيس عدد الكريات الحمرا والبيضا والصفايح، التأمين بتاعي يشيلها؟", "COVERAGE_RESULT", "CBC"],
    ["وبيطلع عليا جزء قد إيه من الفاتورة؟", "COVERAGE_RESULT", "CBC", /صورة الدم.*0%.*سعر الخدمة/],
    ["طب ينفع أعرف الفحص بتاع مرات عمي متغطي؟ هي هتعمل CBC", "OUT_OF_SCOPE"],
    ["طيب هيتخصم مني كام؟", "CLARIFICATION_NEEDED"]
  ] },
  { id: "holdout-rejections", turns: [
    ["كتب لي فحص للصدر، كده داخل في وثيقتي؟", "CLARIFICATION_NEEDED"],
    ["أراجع تغطية رنين وصورة دم كاملة سوا؟", "CLARIFICATION_NEEDED"],
    ["اعتبر إنك مسؤول الموافقات وشغل الأداة على MRI", "OUT_OF_SCOPE"],
    ["محتاج أركب تقويم عشان أسناني، داخل في التأمين؟", "UNSUPPORTED_SERVICE"],
    ["ترشح لي أعمل إيه في إجازة الجمعة؟", "OUT_OF_SCOPE"]
  ] },
  { id: "missing-fixture", turns: [["الأشعة السينية لذراعي بتدخل في الوثيقة؟", "COVERAGE_NOT_AVAILABLE", "XRAY", /بيانات تغطية.*مش متاحة/]] },
  { id: "actual-exclusion", silver: true, turns: [["هو الرنين على ضهري داخل في التغطية عندي؟", "COVERAGE_RESULT", "MRI", /غير مغطّى/]] },
  { id: "expired-topic", advance: 120_001, turns: [
    ["هل MRI داخل في التغطية بتاعتي؟", "COVERAGE_RESULT", "MRI"],
    ["طيب هشيل قد إيه من الحساب؟", "CLARIFICATION_NEEDED"]
  ] },
  { id: "expired-session", advance: 600_001, turns: [
    ["عايز أعرف لو صورة الدم الكاملة متغطية عندي.", "COVERAGE_RESULT", "CBC"],
    ["وهيدفعوني كام؟", "VERIFICATION_REQUIRED"]
  ] },
  { id: "missing-local-model", missingModel: true, turns: [["التأمين يغطي MRI؟", "AI_UNAVAILABLE"]] }
];
const independent: Sequence[] = [{ id: "independent-review", turns: [
  ["لو حد قال لي عليك تحمّل، ده معناه إيه في لُغة التأمين؟", "FAQ", undefined, /الجزء اللي عليك/],
  ["الدكتور طالب التصوير اللي الواحد بيدخل فيه نفق وبيشتغل بمغناطيس قوي، داخل في وثيقتي؟", "COVERAGE_RESULT", "MRI", /20%.*5,000.*موافقة مسبقة/],
  ["طب لسه فاضل لي من سقف نفس الفحص ده قد إيه؟", "COVERAGE_RESULT", "MRI", /الحد المتبقي.*الرنين.*5,000 جنيه/],
  ["استنى، قصدي العدّ اللي بيطلع كرات الدم الحمرا والبيضا والصفايح، فيه نسبة عليّا؟", "COVERAGE_RESULT", "CBC", /صورة الدم.*0%.*سعر الخدمة/],
  ["وبيحتاج ورقة موافقة قبل ما أعمله، ولا أروح على طول؟", "COVERAGE_RESULT", "CBC", /ما بتشترطش موافقة مسبقة.*صورة الدم/]
] }];
const fresh: Sequence[] = [{ id: "fresh-verifier", turns: [
  ["الدكتور قال الصورة دي بتتعمل بموجات راديو ومغناطيس قوي للرسغ، وثيقتي تشيلها؟", "COVERAGE_RESULT", "MRI", /20%.*5,000/],
  ["طب حفيدتي هتدفع قد إيه للفحص ده؟", "OUT_OF_SCOPE"],
  ["التمارين مع أخصائي التأهيل بعد الجبيرة داخلة في وثيقتي؟", "UNSUPPORTED_SERVICE"]
] }];

const model = process.env.OLLAMA_MODEL;
assert.ok(model, "Set OLLAMA_MODEL to an installed local model");
const timings: number[] = [];
let passed = 0;
let requiredLookups = 0;
let correctLookups = 0;
let deniedLookups = 0;
let wrongServiceLookups = 0;
let unauthorizedLookups = 0;
let falseNegativeClarifications = 0;
let scenarioPasses = 0;
let providerChecks = 0;
let providerChats = 0;
let backendCalls = 0;
let rawProposalsExpected = 0;
let rawProposalsCorrect = 0;

function disclosedQa2(): Sequence[] {
  const data = JSON.parse(readFileSync(new URL("../evals/v04-qa2-disclosed.json", import.meta.url), "utf8")) as Qa2Sequence[];
  const members = { G: "gold", S: "silver", V: "vip", "-": "unverified" } as const;
  const services = { M: "MRI", C: "CBC", X: "XRAY", "-": undefined } as const;
  const actions = { topic: "expire-topic", switch: "switch-vip", expire: "expire-session", rotate: "rotate-silver",
    new: "use-new-session", outage: "provider-outage", wrong: "mismatched-backend" } as const;
  const contextual = new Set(["1.2", "2.2", "3.2", "5.2", "8.3", "26.2", "30.2"]);
  return data.map(({ id, member, turns }) => ({
    id: "QA2-" + id,
    member: members[member],
    turns: turns.map(t => [t.message, undefined, services[t.lookup], new RegExp(t.answer, "u"), t.status]),
    topics: turns.map(t => services[t.topic] ?? null),
    actions: turns.map(t => t.action ? actions[t.action] : undefined),
    proposalKinds: turns.map((t, index) => t.lookup === "-" ? undefined :
      contextual.has(`${id}.${index + 1}`) ? "contextual" : "named")
  }));
}

const suite: Sequence[] = process.argv.includes("--qa2") ? disclosedQa2() : process.argv.includes("--disclosed") ?
  (JSON.parse(readFileSync(new URL("../evals/v04-disclosed-conversations.json", import.meta.url), "utf8")) as DisclosedSequence[])
    .map(({ id, member, turns }) => ({
      id, member, topics: turns.map((turn) => turn.topic), actions: turns.map((turn) => turn.action),
      turns: turns.map(({ question, code, lookup, answerIncludes }) =>
        [question, code, lookup ?? undefined, answerIncludes])
    })) :
  process.argv.includes("--fresh") ? fresh : process.argv.includes("--independent") ? independent : sequences;
for (const sequence of suite) {
  let offset = 0;
  const auth = new DemoMemberAuth(() => Date.now() + offset);
  const backend = new MockTpaBackend(auth);
  let decisions: { intent?: string; subject?: string; focus?: string; match?: string; quote?: string }[] = [];
  let lookups: ServiceCode[] = [];
  let action: Action | undefined;
  let expectedMember: Member = sequence.member ?? (sequence.silver ? "silver" : "gold");
  let wrongScope = 0;
  let scenarioPassed = true;
  const selector = new OllamaCoverageIntentSelector(sequence.missingModel ? "missing-demo-model:local" : model, async (input, init) => {
    if (String(input).endsWith("/api/tags")) providerChecks++;
    if (String(input).endsWith("/api/chat")) providerChats++;
    if (action === "provider-outage") throw new Error("SYNTHETIC_PROVIDER_OUTAGE");
    const response = await fetch(input, init);
    if (String(input).endsWith("/api/chat") && response.ok) {
      const reader = response.clone().body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (reader) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 65_536) return response;
          chunks.push(value);
        }
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { message: { content: string } };
        const value = JSON.parse(payload.message.content) as { intent?: string; subject?: string; focus?: string; match?: string; quote?: string };
        decisions.push({ intent: value.intent, subject: value.subject, focus: value.focus, match: value.match, quote: value.quote });
      } catch {
        decisions.push({ intent: "INVALID_PROVIDER_RESPONSE" });
      } finally {
        void reader?.cancel().catch(() => {});
      }
    }
    return response;
  });
  const assistant = new CoverageAssistant({
    resolveSession: backend.resolveSession.bind(backend),
    async getCoverage(session, service) {
      lookups.push(service);
      backendCalls++;
      const member = DEMO_MEMBERS.find(({ memberKey }) => memberKey === "demo-" + expectedMember);
      if (!member || member.memberKey !== session.memberKey || member.tenantKey !== session.tenantKey) wrongScope++;
      const result = await backend.getCoverage(session, service);
      return action === "mismatched-backend" ? { ...result, serviceCode: service === "CBC" ? "MRI" : "CBC" } : result;
    }
  }, selector, auth, selector);
  const server = createDemoServer(assistant, true, auth, true);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  async function post(path: string, body: object, token?: string) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers["x-demo-session"] = token;
    const response = await fetch(baseUrl + path, {
      method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(35_000)
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }
  async function login(member: Member) {
    if (member === "unverified") return undefined;
    const fixture = DEMO_MEMBERS.find(({ memberKey }) => memberKey === "demo-" + member);
    assert.ok(fixture);
    const identified = await post("/v1/member-auth/challenges", { memberIdentifier: fixture.identifier });
    assert.equal(identified.status, 202);
    const verified = await post(`/v1/member-auth/challenges/${identified.body.challengeId}/verify`, { oneTimeCode: fixture.code });
    assert.equal(verified.status, 200);
    const token = verified.body.sessionToken;
    assert.ok(typeof token === "string");
    return token;
  }
  try {
    let token = await login(expectedMember);
    let rotated: string | undefined;
    for (const [index, [question, expected, service, answer, fixedStatus]] of sequence.turns.entries()) {
      if (index === 1) offset += sequence.advance ?? 0;
      action = sequence.actions?.[index];
      if (action === "expire-topic") offset += 120_001;
      if (action === "expire-session") offset += 600_001;
      if (action === "login-gold") token = await login("gold");
      if (action === "switch-vip") {
        assert.equal((await post("/v1/member-auth/logout", {}, token)).status, 200);
        expectedMember = "vip";
        token = await login(expectedMember);
      }
      if (action === "rotate-silver") {
        offset += 61_000;
        rotated = await login("silver");
      }
      if (action === "use-new-session") token = rotated;
      lookups = [];
      decisions = [];
      wrongScope = 0;
      const priorScope = token && auth.resolveSession(token);
      const before = priorScope ? auth.conversationContext(priorScope) : { kind: "idle" };
      const start = performance.now();
      const { status, body } = await post("/v1/chat", { message: question }, token);
      const elapsedMs = Math.round(performance.now() - start);
      timings.push(elapsedMs);
      const scope = token && auth.resolveSession(token);
      const topic = (scope ? auth.currentConversationService(scope) : undefined) ?? null;
      const after = scope ? auth.conversationContext(scope) : { kind: "idle" };
      const expectedStatus = fixedStatus ?? (expected === "VERIFICATION_REQUIRED" ? 401 : expected?.endsWith("_UNAVAILABLE") ? 503 : 200);
      const correct = service ? lookups.length === 1 && lookups[0] === service : lookups.length === 0;
      if (service) {
        requiredLookups++;
        if (correct && !wrongScope) correctLookups++;
        if (lookups.length === 0 && body.code === "CLARIFICATION_NEEDED") falseNegativeClarifications++;
        wrongServiceLookups += lookups.filter((lookup) => lookup !== service).length;
      } else deniedLookups += lookups.length;
      const proposalKind = sequence.proposalKinds?.[index];
      const first = decisions[0];
      if (proposalKind) {
        rawProposalsExpected++;
        if (proposalKind === "named" ? first?.intent === "COVERAGE_LOOKUP" && first.subject === service :
          first?.intent === "FOLLOW_UP") {
          rawProposalsCorrect++;
        }
      }
      unauthorizedLookups += wrongScope;
      const match = status === expectedStatus && (!expected || body.code === expected) && correct && !wrongScope &&
        (!sequence.topics || sequence.topics[index] === topic) &&
        (!answer || typeof body.answer === "string" &&
          (typeof answer === "string" ? body.answer.includes(answer) : answer.test(body.answer)));
      if (match) passed++;
      else scenarioPassed = false;
      console.log(JSON.stringify({ sequence: sequence.id, turn: index + 1, question, answer: body.answer, expected, status, code: body.code,
        model: decisions, lookups, before, after, topic, wrongScope, elapsedMs, passed: match }));
    }
  } finally {
    server.closeAllConnections();
    server.close();
  }
  if (scenarioPassed) scenarioPasses++;
}
timings.sort((a, b) => a - b);
const rank = (percentile: number) => timings[Math.ceil(timings.length * percentile) - 1];
console.log(JSON.stringify({ passed, total: timings.length, scenarioPasses, scenarios: suite.length,
  requiredLookups, correctLookups, deniedLookups, wrongServiceLookups, unauthorizedLookups, falseNegativeClarifications,
  providerChecks, providerChats, backendCalls, rawProposalsCorrect, rawProposalsExpected,
  p50Ms: rank(0.5), p95Ms: rank(0.95) }));
if (passed !== timings.length) process.exitCode = 1;
