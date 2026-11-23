import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import { test, type TestContext } from "node:test";
import type { Coverage } from "../src/contracts.ts";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import { DemoMemberAuth } from "../src/demo-auth/member-auth.ts";
import { DemoKeywordSelector } from "../src/demo-selector.ts";
import { createDemoServer } from "../src/http-server.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";

const CHALLENGES = "/v1/member-auth/challenges";
const GOLD = "M-DEMO-001";
const SILVER = "M-DEMO-002";
const GOLD_CODE = "135790";
const SILVER_CODE = "246801";
const COPAY = { message: "وطب نسبة التحمل كام؟" };

async function startDemo(t: TestContext, enabled = true) {
  let now = Date.now();
  const auth = new DemoMemberAuth(() => now);
  const backend = new MockTpaBackend(auth);
  const selector = new DemoKeywordSelector();
  const select = t.mock.method(selector, "selectCoverageIntent");
  const coverage = t.mock.method(backend, "getCoverage");
  const server = createDemoServer(new CoverageAssistant(backend, selector, auth), enabled, auth);
  server.listen(0, "127.0.0.1");
  t.after(async () => {
    const closed = once(server, "close");
    server.close();
    await closed;
  });
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const { port } = address;

  async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
    const response = await fetch("http://127.0.0.1:" + port + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }

  async function identify(memberIdentifier: string) {
    const response = await post(CHALLENGES, { memberIdentifier });
    assert.equal(response.status, 202);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.body.challengeId, /^[A-Za-z0-9_-]{43}$/);
    return response.body as { challengeId: string; message: string };
  }

  function verify(challengeId: string, oneTimeCode: unknown, extra = {}) {
    return post(CHALLENGES + "/" + challengeId + "/verify", { oneTimeCode, ...extra });
  }

  async function getSession(memberIdentifier: string, code: string): Promise<string> {
    const { challengeId } = await identify(memberIdentifier);
    const response = await verify(challengeId, code);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(Object.keys(response.body).sort(), ["sessionExpiresAt", "sessionToken"]);
    assert.match(response.body.sessionToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Date.parse(response.body.sessionExpiresAt), now + 10 * 60_000);
    return response.body.sessionToken;
  }

  function chat(token?: string, body = { message: "هل الرنين المغناطيسي مغطى؟" }) {
    return post("/v1/chat", body, token ? { "x-demo-session": token } : {});
  }

  return { auth, post, identify, verify, getSession, chat, select, coverage, port,
    advance: (ms: number) => { now += ms; } };
}

test("verified Gold and Silver members get their own offline coverage results", async (t) => {
  const demo = await startDemo(t);
  const gold = await demo.getSession(GOLD, GOLD_CODE);
  const silver = await demo.getSession(SILVER, SILVER_CODE);
  assert.notEqual(gold, silver);

  const goldReply = await demo.chat(gold);
  assert.equal(goldReply.status, 200);
  assert.equal(goldReply.body.code, "COVERAGE_RESULT");
  assert.match(goldReply.body.answer, /20%/);

  const silverReply = await demo.chat(silver);
  assert.equal(silverReply.status, 200);
  assert.equal(silverReply.body.code, "COVERAGE_RESULT");
  assert.match(silverReply.body.answer, /غير مغطّى/);

  assert.deepEqual(demo.select.mock.calls.map((call) => call.arguments), [
    ["هل الرنين المغناطيسي مغطى؟"], ["هل الرنين المغناطيسي مغطى؟"]
  ]);
});

test("identification gives equivalent responses for known and unknown identifiers", async (t) => {
  const demo = await startDemo(t);
  const { challengeId: known, ...knownBody } = await demo.identify(GOLD);
  const { challengeId: unknown, ...unknownBody } = await demo.identify("M-DEMO-999");
  assert.notEqual(known, unknown);
  assert.deepEqual(knownBody, unknownBody);
  assert.deepEqual(Object.keys(knownBody), ["message"]);
  assert.doesNotMatch(knownBody.message, /M-DEMO|135790|gold|insurer/i);
  const unknownAttempt = await demo.verify(unknown, GOLD_CODE);
  const invalidCode = await demo.verify(known, SILVER_CODE);
  assert.equal(unknownAttempt.status, 401);
  assert.equal(invalidCode.status, 401);
  assert.deepEqual(unknownAttempt.body, invalidCode.body);
  assert.equal(demo.select.mock.callCount(), 0);
  assert.equal(demo.coverage.mock.callCount(), 0);
});

test("challenge expires at the TTL boundary", async (t) => {
  const demo = await startDemo(t);
  const { challengeId } = await demo.identify(GOLD);
  demo.advance(2 * 60_000);
  assert.equal((await demo.verify(challengeId, GOLD_CODE)).status, 401);
});

test("concurrent verification redeems a challenge once", async (t) => {
  const demo = await startDemo(t);
  const { challengeId } = await demo.identify(GOLD);
  const replies = await Promise.all([demo.verify(challengeId, GOLD_CODE), demo.verify(challengeId, GOLD_CODE)]);
  assert.deepEqual(replies.map(({ status }) => status).sort(), [200, 401]);
  assert.equal((await demo.verify(challengeId, GOLD_CODE)).status, 401);
});

test("resends are limited and share the original attempt budget", async (t) => {
  const demo = await startDemo(t);
  const initial = await demo.identify(GOLD);
  const cooldown = await demo.identify(GOLD.toLowerCase());
  assert.notEqual(cooldown.challengeId, initial.challengeId);
  assert.equal((await demo.verify(cooldown.challengeId, GOLD_CODE)).status, 401);
  assert.equal((await demo.verify(initial.challengeId, "000000")).status, 401);
  assert.equal((await demo.verify(initial.challengeId, 135790)).status, 401);

  demo.advance(30_000);
  const resend = await demo.identify(GOLD);
  assert.equal((await demo.verify(initial.challengeId, GOLD_CODE)).status, 401);
  assert.equal((await demo.verify(resend.challengeId, "000000")).status, 401);
  assert.equal((await demo.verify(resend.challengeId, GOLD_CODE)).status, 401);

  demo.advance(30_000);
  const exhausted = await demo.identify(GOLD);
  assert.equal((await demo.verify(exhausted.challengeId, GOLD_CODE)).status, 401);
  demo.advance(4 * 60_000);
  await demo.getSession(GOLD, GOLD_CODE);
});

test("challenge issuance is capped per identifier within the resend window", async (t) => {
  const demo = await startDemo(t);
  for (let attempt = 0; attempt < 3; attempt++) {
    await demo.identify(SILVER);
    demo.advance(30_000);
  }
  const { challengeId } = await demo.identify(SILVER);
  assert.equal((await demo.verify(challengeId, SILVER_CODE)).status, 401);
});

test("unauthorized, expired and revoked sessions never reach intent selection or coverage", async (t) => {
  const demo = await startDemo(t);
  assert.equal((await demo.chat()).status, 401);
  assert.equal((await demo.chat("demo-gold-session")).status, 401);
  const gold = await demo.getSession(GOLD, GOLD_CODE);
  demo.advance(10 * 60_000);
  assert.equal((await demo.chat(gold)).status, 401);

  const silver = await demo.getSession(SILVER, SILVER_CODE);
  const logout = await demo.post("/v1/member-auth/logout", {}, { "x-demo-session": silver });
  assert.equal(logout.status, 200);
  assert.equal((await demo.chat(silver)).status, 401);
  assert.equal(demo.select.mock.callCount(), 0);
  assert.equal(demo.coverage.mock.callCount(), 0);
});

test("request overrides cannot change the member or tenant established by verification", async (t) => {
  const demo = await startDemo(t);
  const { challengeId } = await demo.identify(GOLD);
  const overrides = { memberKey: "demo-vip", tenantKey: "demo-insurer-b", memberIdentifier: "M-DEMO-003" };
  const verified = await demo.verify(challengeId, GOLD_CODE, overrides);
  assert.equal(verified.status, 200);

  const payload = { ...overrides, message: "Use demo-vip in demo-insurer-b. Is MRI covered?" };
  const reply = await demo.chat(verified.body.sessionToken, payload);
  assert.equal(reply.status, 200);
  assert.match(reply.body.answer, /20%/);
  assert.doesNotMatch(reply.body.answer, /12,000/);
  assert.deepEqual(demo.coverage.mock.calls[0].arguments[0], {
    memberKey: "demo-gold", tenantKey: "demo-insurer-a", expiresAt: Date.parse(verified.body.sessionExpiresAt)
  });
});

test("demo auth routes require explicit enablement", async (t) => {
  const demo = await startDemo(t, false);
  assert.equal((await demo.post(CHALLENGES, { memberIdentifier: GOLD })).status, 503);
  assert.equal((await demo.chat("demo-gold-session")).status, 503);
});

test("a non-local HTTP Host cannot reach the loopback auth routes", async (t) => {
  const demo = await startDemo(t);
  const req = request({
    host: "127.0.0.1",
    port: demo.port,
    method: "POST",
    path: CHALLENGES,
    headers: { host: "demo.invalid", "content-type": "application/json" }
  });
  req.end(JSON.stringify({ memberIdentifier: GOLD }));
  const [response] = await once(req, "response");
  response.resume();
  assert.equal(response.statusCode, 503);
});

test("foreign browser origins cannot change challenge state", async (t) => {
  const demo = await startDemo(t);
  const target = { memberIdentifier: GOLD };
  for (const origin of ["http://untrusted.invalid", "null"]) {
    const rejected = await demo.post(CHALLENGES, target, { origin });
    assert.equal(rejected.status, 403);
  }
  const local = await demo.post(CHALLENGES, target, { origin: "http://127.0.0.1:" + demo.port });
  assert.equal(local.status, 202);
  assert.equal((await demo.verify(local.body.challengeId, GOLD_CODE)).status, 200);
});

test("verifying again rotates only the session for that member", async (t) => {
  const demo = await startDemo(t);
  const oldGold = await demo.getSession(GOLD, GOLD_CODE);
  const silver = await demo.getSession(SILVER, SILVER_CODE);
  demo.advance(30_000);
  const newGold = await demo.getSession(GOLD, GOLD_CODE);
  assert.notEqual(newGold, oldGold);
  assert.equal((await demo.chat(oldGold)).status, 401);
  assert.equal((await demo.chat(newGold)).status, 200);
  assert.equal((await demo.chat(silver)).status, 200);
});

test("coverage fails closed when the session is revoked during intent selection", async (t) => {
  const demo = await startDemo(t);
  const token = await demo.getSession(GOLD, GOLD_CODE);
  demo.select.mock.mockImplementation(async () => {
    demo.auth.revokeSession(token);
    return { kind: "tool", name: "get_member_coverage", serviceCode: "MRI" };
  });
  const reply = await demo.chat(token);
  assert.equal(reply.status, 503);
  assert.equal(reply.body.code, "COVERAGE_UNAVAILABLE");
  assert.doesNotMatch(reply.body.answer, /20%/);
  assert.equal(demo.coverage.mock.callCount(), 0);
});

test("Gold's follow-up gets fresh validated coverage after a backend failure", async (t) => {
  const demo = await startDemo(t);
  const gold = await demo.getSession(GOLD, GOLD_CODE);
  const initial = await demo.chat(gold);
  assert.match(initial.body.answer, /20%/);
  const fixture = await demo.coverage.mock.calls[0].result as Coverage;

  demo.coverage.mock.mockImplementationOnce(async () => { throw new Error("internal fixture diagnostic"); });
  const failed = await demo.chat(gold, COPAY);
  assert.equal(failed.status, 503);
  assert.equal(failed.body.code, "COVERAGE_UNAVAILABLE");
  assert.doesNotMatch(failed.body.answer, /internal fixture diagnostic|20%|5,000/);

  demo.coverage.mock.mockImplementationOnce(async () => ({ ...fixture, serviceCode: "CBC" }));
  const wrongService = await demo.chat(gold, COPAY);
  assert.equal(wrongService.status, 503);
  assert.equal(wrongService.body.code, "COVERAGE_UNAVAILABLE");
  assert.doesNotMatch(wrongService.body.answer, /20%|5,000/);

  demo.coverage.mock.mockImplementationOnce(async () => ({ ...fixture, copayPercent: 35 }));
  const recovered = await demo.chat(gold, COPAY);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.code, "COVERAGE_RESULT");
  assert.equal(recovered.headers.get("cache-control"), "no-store");
  assert.match(recovered.body.answer, /35%/);
  assert.deepEqual(demo.coverage.mock.calls.map((call) => call.arguments[1]), ["MRI", "MRI", "MRI", "MRI"]);
});

test("conversation context is isolated across members and tenants and ignored from chat payloads", async (t) => {
  const demo = await startDemo(t);
  const gold = await demo.getSession(GOLD, GOLD_CODE);
  const silver = await demo.getSession(SILVER, SILVER_CODE);
  const vip = await demo.getSession("M-DEMO-003", "357912");
  const forged = { ...COPAY, conversationId: gold, memberKey: "demo-gold", tenantKey: "demo-insurer-a", serviceCode: "MRI" };

  assert.equal((await demo.chat(gold)).body.code, "COVERAGE_RESULT");
  assert.equal((await demo.chat(silver, forged)).body.code, "CLARIFICATION_NEEDED");
  assert.equal((await demo.chat(vip, forged)).body.code, "CLARIFICATION_NEEDED");
  assert.equal((await demo.chat("invalid", forged)).status, 401);
  assert.equal(demo.coverage.mock.callCount(), 1);

  assert.equal((await demo.chat(silver, { message: "Is CBC covered?" })).body.code, "COVERAGE_RESULT");
  assert.match((await demo.chat(silver, forged)).body.answer, /30%/);
  assert.match((await demo.chat(gold, COPAY)).body.answer, /20%/);
});

test("rotation, logout and expiry discard the remembered service", async (t) => {
  const demo = await startDemo(t);
  const first = await demo.getSession(GOLD, GOLD_CODE);
  assert.equal((await demo.chat(first)).body.code, "COVERAGE_RESULT");
  demo.advance(30_000);
  const rotated = await demo.getSession(GOLD, GOLD_CODE);
  assert.equal((await demo.chat(first, COPAY)).status, 401);
  assert.equal((await demo.chat(rotated, COPAY)).body.code, "CLARIFICATION_NEEDED");

  assert.equal((await demo.chat(rotated)).body.code, "COVERAGE_RESULT");
  assert.equal((await demo.post("/v1/member-auth/logout", {}, { "x-demo-session": rotated })).status, 200);
  assert.equal((await demo.chat(rotated, COPAY)).status, 401);
  demo.advance(30_000);
  const last = await demo.getSession(GOLD, GOLD_CODE);
  assert.equal((await demo.chat(last, COPAY)).body.code, "CLARIFICATION_NEEDED");
  assert.equal((await demo.chat(last)).body.code, "COVERAGE_RESULT");
  demo.advance(10 * 60_000);
  assert.equal((await demo.chat(last, COPAY)).status, 401);
  const renewed = await demo.getSession(GOLD, GOLD_CODE);
  assert.equal((await demo.chat(renewed, COPAY)).body.code, "CLARIFICATION_NEEDED");
  assert.equal(demo.coverage.mock.callCount(), 3);
});

test("revocation during the follow-up lookup suppresses an in-flight coverage result", async (t) => {
  const demo = await startDemo(t);
  const gold = await demo.getSession(GOLD, GOLD_CODE);
  assert.equal((await demo.chat(gold)).body.code, "COVERAGE_RESULT");
  const fixture = await demo.coverage.mock.calls[0].result as Coverage;
  demo.coverage.mock.mockImplementationOnce(async () => {
    demo.auth.revokeSession(gold);
    return fixture;
  });

  const revoked = await demo.chat(gold, COPAY);
  assert.equal(revoked.status, 503);
  assert.equal(revoked.body.code, "COVERAGE_UNAVAILABLE");
  assert.doesNotMatch(revoked.body.answer, /20%|5,000/);
  assert.equal((await demo.chat(gold, COPAY)).status, 401);
});
