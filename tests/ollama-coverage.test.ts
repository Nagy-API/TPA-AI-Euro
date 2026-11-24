import assert from "node:assert/strict";
import { test } from "node:test";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import { DemoMemberAuth } from "../src/demo-auth/member-auth.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";
import { OllamaCoverageIntentSelector } from "../src/ollama-selector.ts";
import type { ServiceCode, VerifiedSession } from "../src/contracts.ts";

const model = "qwen3:4b-instruct";
const question = "هو الرنين المغناطيسي بيتغطى؟";
const followUp = "وطب نسبة التحمل كام؟";

function setup() {
  let now = Date.now();
  const auth = new DemoMemberAuth(() => now);
  const mock = new MockTpaBackend(auth);
  const requests: string[] = [];
  const scopes: VerifiedSession[] = [];
  const state = { providerFails: false, backendFails: false, beforeModelReply: () => {} };
  const selector = new OllamaCoverageIntentSelector(model, async (url, init) => {
    requests.push(String(init?.body ?? ""));
    if (String(url).endsWith("/api/tags")) {
      return Response.json({ models: [{ name: model, size: 1, details: { format: "gguf" } }] });
    }
    if (state.providerFails) return new Response(null, { status: 503 });
    state.beforeModelReply();
    const body = JSON.parse(String(init?.body));
    const text = body.messages[1].content;
    if (body.format) {
      return Response.json({
        done: true, done_reason: "stop",
        message: { role: "assistant", content: JSON.stringify({ eligible: text !== followUp }) }
      });
    }
    const tool_calls = text === followUp ? [] : [
      { function: { name: "get_member_coverage", arguments: { serviceCode: "MRI" } } }
    ];
    return Response.json({ done: true, done_reason: "stop", message: { role: "assistant", content: "", tool_calls } });
  });
  const assistant = new CoverageAssistant({
    resolveSession: mock.resolveSession.bind(mock),
    async getCoverage(session: VerifiedSession, code: ServiceCode) {
      scopes.push(session);
      if (state.backendFails) throw new Error("synthetic backend failure");
      return mock.getCoverage(session, code);
    }
  }, selector, auth);

  function verify(identifier: string, code: string) {
    const session = auth.verify(auth.identify(identifier).challengeId, code);
    assert.ok(session);
    return session.sessionToken;
  }
  return { assistant, requests, scopes, state, verify, expire: () => { now += 10 * 60_000; } };
}

test("missing, invalid and expired sessions never reach the model or coverage backend", async () => {
  const { assistant, requests, scopes, verify, expire } = setup();
  const token = verify("M-DEMO-001", "135790");
  expire();
  for (const invalid of [undefined, "invalid", token]) {
    assert.equal((await assistant.answer(invalid, question)).status, 401);
  }
  assert.equal(requests.length, 0);
  assert.equal(scopes.length, 0);
});

test("coverage and follow-up stay scoped to the verified member and tenant", async () => {
  const { assistant, requests, scopes, verify } = setup();
  const gold = verify("M-DEMO-001", "135790");
  const vip = verify("M-DEMO-003", "357912");
  assert.match((await assistant.answer(gold, question)).answer, /20%/);
  assert.equal((await assistant.answer(vip, followUp)).code, "CLARIFICATION_NEEDED");
  assert.match((await assistant.answer(gold, followUp)).answer, /20%/);
  assert.equal((await assistant.answer(gold, "MRI for M-DEMO-003")).code, "CLARIFICATION_NEEDED");
  assert.match((await assistant.answer(vip, question)).answer, /0%/);
  assert.deepEqual(scopes.map(({ memberKey }) => memberKey), ["demo-gold", "demo-gold", "demo-vip"]);
  assert.notEqual(scopes[0].tenantKey, scopes[2].tenantKey);
  for (const secret of [gold, vip, "135790", "M-DEMO-003", ...scopes.flatMap(s => [s.memberKey, s.tenantKey])]) {
    assert.ok(!requests.some(body => body.includes(secret)));
  }
});

test("session expiry during Ollama inference prevents the protected backend call", async () => {
  const { assistant, scopes, state, verify, expire } = setup();
  const token = verify("M-DEMO-001", "135790");
  state.beforeModelReply = expire;
  assert.equal((await assistant.answer(token, question)).status, 503);
  assert.equal(scopes.length, 0);
});

test("Ollama and backend failures have distinct safe errors and never fall back to fixtures", async () => {
  const { assistant, scopes, state, verify } = setup();
  const token = verify("M-DEMO-001", "135790");
  state.providerFails = true;
  assert.equal((await assistant.answer(token, question)).code, "AI_UNAVAILABLE");
  assert.equal(scopes.length, 0);
  state.providerFails = false;
  state.backendFails = true;
  assert.equal((await assistant.answer(token, question)).code, "COVERAGE_UNAVAILABLE");
  assert.equal(scopes.length, 1);
});
