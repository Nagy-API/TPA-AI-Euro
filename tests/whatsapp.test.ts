import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test, type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { InferenceRequest } from "../src/conversation-provider.ts";
import { readWhatsAppConfig } from "../src/whatsapp/config.ts";
import { createWhatsAppServer } from "../src/whatsapp/server.ts";

const sender = "12025550101";
const otherSender = "12025550102";
const phoneNumberId = "111111111111111";
const wabaId = "222222222222222";
const env = {
  ENABLE_WHATSAPP_TEST: "true",
  WHATSAPP_WABA_ID: wabaId,
  WHATSAPP_PHONE_NUMBER_ID: phoneNumberId,
  WHATSAPP_ALLOWED_SENDERS: [sender, otherSender].join(","),
  WHATSAPP_VERIFY_TOKEN: "synthetic-verification-token-only",
  WHATSAPP_APP_SECRET: "synthetic-meta-app-secret",
  WHATSAPP_ACCESS_TOKEN: "synthetic-graph-access-token",
  WHATSAPP_GRAPH_VERSION: "v27.0"
};
const path = "/webhooks/whatsapp";
const question = "هل الرنين المغناطيسي مغطى؟";
const followUp = "وطب نسبة التحمل كام؟";
const wireOK = () => Response.json({ messages: [{ id: "wamid.reply" }] });

function pauseGraph() {
  let resume!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => { resume = resolve; });
  return { response, resume: () => resume(wireOK()) };
}

function signed(raw: string): string {
  return "sha256=" + createHmac("sha256", env.WHATSAPP_APP_SECRET).update(raw).digest("hex");
}

async function until(condition: () => boolean): Promise<void> {
  for (let count = 0; !condition(); count++) {
    assert.ok(count < 200, "expected asynchronous WhatsApp work to finish");
    await delay(5);
  }
}

async function setup(t: TestContext) {
  const initialTime = Date.now();
  let now = initialTime;
  let nextId = 0;
  const requests: InferenceRequest[] = [];
  const calls: Array<{ url: string; init?: RequestInit; body: { to: string; text: { body: string } } }> = [];
  const events: string[] = [];
  let infer = async (request: InferenceRequest): Promise<unknown> => {
    if (request.schema.required[0] === "parts") return { parts: ["answer"] };
    return request.messages.at(-1)?.content === followUp
      ? { intent: "FOLLOW_UP", subject: "NONE", focus: "COPAY", tool: "get_member_coverage" }
      : { intent: "COVERAGE_LOOKUP", subject: "MRI", focus: "OVERVIEW", tool: "get_member_coverage" };
  };
  let outbound = async (): Promise<Response> => wireOK();
  const server = createWhatsAppServer({
    config: readWhatsAppConfig(env), now: () => now, report: (event) => events.push(event),
    provider: { async infer(request) { requests.push(request); return infer(request); } },
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init, body: JSON.parse(String(init?.body)) });
      return outbound();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const message = (body: string, from = sender) => ({
    type: "text", from, id: "wamid.fixture" + ++nextId, text: { body },
    timestamp: String(Math.floor(now / 1000))
  });
  function envelope(messages: unknown[], phone = phoneNumberId, account = wabaId): string {
    return JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: account, changes: [{
      field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: phone }, messages }
    }] }] }, null, 2);
  }
  function post(raw: string, signature: string | null = signed(raw)): Promise<Response> {
    return fetch(origin + path, { method: "POST", body: raw, headers: {
      "content-type": "application/json",
      ...(signature === null ? {} : { "x-hub-signature-256": signature })
    } });
  }
  async function turn(body: string, from = sender): Promise<string> {
    const expected = calls.length + 1;
    now += 1000;
    assert.equal((await post(envelope([message(body, from)]))).status, 200);
    await until(() => calls.length === expected);
    assert.equal(calls.at(-1)?.body.to, from);
    return calls.at(-1)!.body.text.body;
  }
  async function login(member: string, otp: string, from = sender): Promise<void> {
    assert.match(await turn("login " + member, from), /verify/);
    assert.match(await turn("verify " + otp, from), /تم التحقق/);
  }
  return {
    origin, message, envelope, post, turn, login, requests, calls, events, initialTime,
    advance: (milliseconds: number) => { now += milliseconds; },
    setInfer: (replacement: typeof infer) => { infer = replacement; },
    setOutbound: (replacement: typeof outbound) => { outbound = replacement; }
  };
}

test("WhatsApp startup is explicitly enabled, local inference only, and fail-closed on config", () => {
  for (const values of [
    { ENABLE_WHATSAPP_TEST: "" }, { NODE_ENV: "production" }, { WHATSAPP_INTENT_MODE: "claude" },
    { WHATSAPP_ALLOWED_SENDERS: "*" }, { WHATSAPP_WABA_ID: "" }, { WHATSAPP_PHONE_NUMBER_ID: "../messages" },
    { WHATSAPP_GRAPH_VERSION: "https://example.invalid" }, { WHATSAPP_ACCESS_TOKEN: "" },
    { WHATSAPP_APP_SECRET: "" }, { WHATSAPP_VERIFY_TOKEN: "" }, { WHATSAPP_PORT: "0" }
  ]) assert.throws(() => readWhatsAppConfig({ ...env, ...values }));
  assert.equal(readWhatsAppConfig(env).port, 3010);
  assert.equal(readWhatsAppConfig({ ...env, WHATSAPP_INTENT_MODE: "ollama-v05" }).intentMode, "ollama-v05");
});

test("only the webhook route is mounted and Meta verification echoes a valid challenge", async (t) => {
  const d = await setup(t);
  const callback = d.origin + path + "?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=";
  const accepted = await fetch(callback + env.WHATSAPP_VERIFY_TOKEN);
  assert.equal(accepted.status, 200);
  assert.equal(await accepted.text(), "12345");
  assert.equal((await fetch(callback + "wrong")).status, 403);
  assert.equal((await fetch(callback + env.WHATSAPP_VERIFY_TOKEN + "&hub.challenge=54321")).status, 403);
  assert.equal((await fetch(d.origin + path, { method: "PUT" })).status, 405);
  for (const route of ["/", "/health", "/demo", "/v1/chat", "/v1/member-auth/challenges", "/v1/inference", "/api/chat"]) {
    for (const method of ["GET", "POST"]) assert.equal((await fetch(d.origin + route, { method })).status, 404);
  }
  assert.deepEqual(d.calls, []);
});

test("signature covers raw bytes and oversized or malformed signed payloads are rejected", async (t) => {
  const d = await setup(t);
  const raw = d.envelope([d.message("help")]);
  assert.equal((await d.post(raw, null)).status, 401);
  assert.equal((await d.post(raw, "sha256=" + "0".repeat(64))).status, 401);
  assert.equal((await d.post(raw + " ", signed(raw))).status, 401);
  assert.equal((await d.post("{")).status, 400);
  assert.equal((await d.post(" ".repeat(256 * 1024 + 1))).status, 413);
  assert.equal((await d.post(raw)).status, 200);
  await until(() => d.calls.length === 1);
  assert.deepEqual(d.requests, []);
});

test("only fresh, allowlisted text from the configured test WABA and phone is dispatched", async (t) => {
  const d = await setup(t);
  const invalid = d.message("login M-DEMO-001", "12025550103");
  const canonical = d.message("help");
  const stale = { ...d.message("help"), timestamp: String(Math.floor(d.initialTime / 1000) - 601) };
  const status = d.envelope([]).replace('"messages": []', '"statuses": [{"status":"delivered"}]');
  for (const raw of [
    d.envelope([canonical], "333333333333333"), d.envelope([canonical], phoneNumberId, "333333333333333"),
    status, d.envelope([invalid, stale, { ...d.message("help"), type: "image" }])
  ]) assert.equal((await d.post(raw)).status, 200);
  assert.match(await d.turn("help"), /login/);
  assert.equal(d.calls.length, 1);
  assert.deepEqual(d.requests, []);
});

test("verified WhatsApp sessions reuse V0.5 and isolate member and tenant scope by sender", async (t) => {
  const d = await setup(t);
  assert.match(await d.turn(question), /login/);
  assert.match(await d.turn("verify 135790"), /التحقق فشل/);
  assert.match(await d.turn("login M-DEMO-001"), /verify/);
  assert.match(await d.turn(question), /verify/);
  assert.match(await d.turn("verify 135790", otherSender), /التحقق فشل/);
  assert.match(await d.turn("verify 000001"), /التحقق فشل/);
  assert.equal(d.requests.length, 0);
  assert.match(await d.turn("  VERIFY\t135790  "), /تم التحقق/);
  assert.match(await d.turn(question), /20%.*5,000/u);
  assert.match(await d.turn(followUp), /20%/);
  assert.match(await d.turn(question, otherSender), /login/);
  await d.login("M-DEMO-003", "357912", otherSender);
  assert.doesNotMatch(await d.turn(followUp, otherSender), /20%|5,000|12,000/);
  assert.match(await d.turn(question, otherSender), /0%.*12,000/u);
  assert.match(await d.turn(question), /20%.*5,000/u);
  assert.equal(d.calls.at(-1)?.url, `https://graph.facebook.com/v27.0/${phoneNumberId}/messages`);
  assert.equal(new Headers(d.calls.at(-1)?.init?.headers).get("authorization"), "Bearer " + env.WHATSAPP_ACCESS_TOKEN);
  assert.equal(d.calls.at(-1)?.init?.redirect, "error");
  assert.deepEqual(JSON.parse(String(d.calls.at(-1)?.init?.body)), {
    messaging_product: "whatsapp", recipient_type: "individual", to: sender, type: "text",
    text: { preview_url: false, body: d.calls.at(-1)?.body.text.body }
  });
  const requestsBeforeSensitiveInput = d.requests.length;
  for (const sensitive of [
    "هل الرنين متاح لعضوية M-DEMO-001؟", "code ١٣٥٧٩٠", "+1 (202) 555-0101 MRI", "رقم العضوية كذا",
    "MRI one three five seven nine zero", "هل الرنين مغطى واحد تلاتة خمسة سبعة تسعة صفر",
    "Is MRI covered? one and three and five and seven and nine and zero",
    "هل الرنين مغطى واحد وتلاتة وخمسة وسبعة وتسعة وصفر",
    "Is MRI covered? My member identifier is Example Alpha", "my verification code is confidential"
  ]) {
    assert.match(await d.turn(sensitive), /بدون|من غير/);
  }
  assert.equal(d.requests.length, requestsBeforeSensitiveInput);
  assert.doesNotMatch(JSON.stringify(d.requests), /1202555010[12]|135790|357912|M-DEMO|demo-insurer|5,000/);
  assert.match(await d.turn("x".repeat(501)), /500/);
  assert.equal(d.requests.length, requestsBeforeSensitiveInput);
});

test("switching revokes the previous session immediately and expiry and logout require fresh verification", async (t) => {
  const d = await setup(t);
  await d.login("M-DEMO-001", "135790");
  assert.match(await d.turn(question), /20%/);
  const delayed = d.message(question);
  d.advance(1000);
  assert.match(await d.turn("login M-DEMO-002"), /verify/);
  assert.match(await d.turn(question), /verify/);
  assert.match(await d.turn("verify 246801"), /تم التحقق/);
  assert.match(await d.turn("verify 246801"), /التحقق فشل/);
  assert.equal((await d.post(d.envelope([delayed]))).status, 200);
  assert.match(await d.turn(question), /غير مغط/u);
  assert.equal(d.requests.filter(({ schema }) => schema.required[0] === "intent").length, 2);
  d.advance(10 * 60_000);
  assert.match(await d.turn(question), /login/);
  await d.login("M-DEMO-001", "135790");
  assert.match(await d.turn("logout"), /تسجيل الخروج/);
  assert.match(await d.turn(question), /login/);
});

test("expired and over-attempted OTP challenges fail with the same response as unknown members", async (t) => {
  const d = await setup(t);
  const pending = await d.turn("login M-DEMO-999");
  const failed = await d.turn("verify 135790");
  assert.equal(await d.turn("login M-DEMO-001"), pending);
  for (let attempt = 0; attempt < 3; attempt++) assert.equal(await d.turn("verify 000001"), failed);
  assert.equal(await d.turn("verify 135790"), failed);
  assert.equal(await d.turn("login M-DEMO-002"), pending);
  d.advance(2 * 60_000);
  assert.equal(await d.turn("verify 246801"), failed);
  assert.deepEqual(d.requests, []);
});

test("webhook acknowledges before Graph completes and processes duplicates once with FIFO per sender", async (t) => {
  const d = await setup(t);
  const first = pauseGraph();
  let sendCount = 0;
  d.setOutbound(async () => ++sendCount === 1 ? first.response : wireOK());
  const login = d.message("login M-DEMO-001");
  d.advance(1000);
  const otp = d.message("verify 135790");
  const raw = d.envelope([login, login, otp]);
  try {
    assert.equal((await d.post(raw)).status, 200);
    assert.equal((await d.post(raw)).status, 200);
    await until(() => d.calls.length === 1);
    assert.match(await d.turn(question, otherSender), /login/);
    assert.equal(d.requests.length, 0);
  } finally {
    first.resume();
  }
  await until(() => d.calls.length === 3);
  assert.match(d.calls[2].body.text.body, /تم التحقق/);
  assert.match(await d.turn(question), /20%/);
  assert.equal(d.calls.length, 4);
});

test("a full sender queue returns a retryable response and admits only outstanding IDs on retry", async (t) => {
  const d = await setup(t);
  const first = pauseGraph();
  let sendCount = 0;
  d.setOutbound(async () => ++sendCount === 1 ? first.response : wireOK());
  const raw = d.envelope([...Array.from({ length: 9 }, () => d.message("help")), d.message("help", otherSender)]);
  try {
    assert.equal((await d.post(raw)).status, 503);
    assert.equal((await d.post(raw)).status, 503);
    await until(() => d.calls.some(({ body }) => body.to === otherSender));
  } finally {
    first.resume();
  }
  await until(() => d.calls.length === 9);
  assert.equal((await d.post(raw)).status, 200);
  await until(() => d.calls.length === 10);
  assert.equal((await d.post(raw)).status, 200);
  await d.turn("help");
  assert.equal(d.calls.length, 11);
});

test("provider errors return a safe reply and outbound failures stay deduplicated and redacted", async (t) => {
  const d = await setup(t);
  await d.login("M-DEMO-001", "135790");
  d.setInfer(async () => { throw new Error("private-inference-diagnostics"); });
  assert.match(await d.turn(question), /المساعد المحلي مش متاح/);
  d.setOutbound(async () => Response.json({ error: "private-graph-diagnostics" }, { status: 503 }));
  const raw = d.envelope([d.message("logout")]);
  assert.equal((await d.post(raw)).status, 200);
  await until(() => d.events.length === 1);
  assert.equal((await d.post(raw)).status, 200);
  d.setOutbound(async () => wireOK());
  assert.match(await d.turn(question), /login/);
  assert.equal(d.calls.length, 5);
  assert.deepEqual(d.events, ["GRAPH_SEND_FAILED"]);
  assert.doesNotMatch(JSON.stringify(d.calls.map(({ body }) => body.text)), /private-|135790|sessionToken/);
});

test("a malformed Graph success body is classified as an outbound failure", async (t) => {
  const d = await setup(t);
  d.setOutbound(async () => Response.json({ messages: [{ id: "wamid." }] }));
  assert.match(await d.turn("help"), /login/);
  await until(() => d.events.length > 0);
  assert.deepEqual(d.events, ["GRAPH_SEND_FAILED"]);
});

test("expiry during interpretation prevents use or release of a protected result", async (t) => {
  const d = await setup(t);
  await d.login("M-DEMO-001", "135790");
  d.setInfer(async () => {
    d.advance(10 * 60_000);
    return { intent: "COVERAGE_LOOKUP", subject: "MRI", focus: "OVERVIEW", tool: "get_member_coverage" };
  });
  assert.match(await d.turn(question), /login/);
  assert.doesNotMatch(d.calls.at(-1)!.body.text.body, /20%|5,000/);
  assert.equal(d.requests.length, 1, "expired interpretation cannot reach composition");
});

test("a delayed coverage question in the verification second cannot use the replacement scope", async (t) => {
  const d = await setup(t);
  await d.login("M-DEMO-001", "135790");
  assert.match(await d.turn("login M-DEMO-002"), /verify/);
  d.advance(1000);
  const delayed = d.message(question);
  assert.equal((await d.post(d.envelope([d.message("verify 246801")]))).status, 200);
  await until(() => d.calls.length === 4);
  assert.equal((await d.post(d.envelope([delayed]))).status, 200);
  await until(() => d.calls.length === 5);
  assert.match(d.calls.at(-1)!.body.text.body, /ابعت سؤالك تاني/);
  assert.deepEqual(d.requests, []);
  assert.match(await d.turn(question), /غير مغط/u);
});

test("an OTP timestamp that matches the login cannot redeem the pending challenge", async (t) => {
  const d = await setup(t);
  const login = d.message("login M-DEMO-001");
  const otp = d.message("verify 135790");
  assert.equal((await d.post(d.envelope([login, otp]))).status, 200);
  await until(() => d.calls.length === 2);
  assert.match(d.calls.at(-1)!.body.text.body, /ابعت كود التحقق تاني/);
  assert.match(await d.turn(question), /verify/);
  assert.deepEqual(d.requests, []);
  assert.match(await d.turn("verify 135790"), /تم التحقق/);
});
