import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import { DemoMemberAuth } from "../src/demo-auth/member-auth.ts";
import { createDemoServer } from "../src/http-server.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";
import { OllamaCoverageIntentSelector } from "../src/ollama-selector.ts";

const model = "qwen3:4b-instruct";

async function start(t: TestContext, deadline: number) {
  let now = Date.now();
  const auth = new DemoMemberAuth(() => now);
  const backend = new MockTpaBackend(auth);
  const state = { slow: false, lookups: 0, eligibility: 0, tools: 0, aborted: 0 };
  const events = new EventEmitter();
  const started = once(events, "started");
  const cancelled = once(events, "cancelled");
  const assistant = new CoverageAssistant({
    resolveSession: backend.resolveSession.bind(backend),
    getCoverage(session, code) {
      state.lookups++;
      return backend.getCoverage(session, code);
    }
  }, new OllamaCoverageIntentSelector(model, async (url, init) => {
    if (String(url).endsWith("/api/tags")) {
      return Response.json({ models: [{ name: model, size: 1, details: { format: "gguf" } }] });
    }
    const eligibility = Boolean(JSON.parse(String(init?.body)).format);
    if (eligibility) state.eligibility++;
    else state.tools++;
    if (state.slow) {
      events.emit("started");
      try {
        await delay(500, undefined, { signal: init?.signal ?? undefined });
      } catch (error) {
        state.aborted++;
        events.emit("cancelled");
        throw error;
      }
    }
    const message = eligibility
      ? { content: '{"eligible":true}' }
      : { content: "", tool_calls: [{ function: { name: "get_member_coverage", arguments: { serviceCode: "MRI" } } }] };
    return Response.json({ done: true, done_reason: "stop", message: { role: "assistant", ...message } });
  }), auth);
  const server = createDemoServer(assistant, true, auth, true, deadline);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = "http://127.0.0.1:" + address.port;
  const { challengeId } = auth.identify("M-DEMO-001");
  const verified = auth.verify(challengeId, "135790");
  assert.ok(verified);
  const token = verified.sessionToken;
  function chat(signal?: AbortSignal) {
    return fetch(base + "/v1/chat", {
      method: "POST", headers: { "content-type": "application/json", "x-demo-session": token },
      body: JSON.stringify({ message: "هو الرنين المغناطيسي متغطي؟" }), signal
    });
  }
  return { base, state, chat, started, cancelled, expireSoon: () => { now += 10 * 60_000 - 75; } };
}

test("server deadline aborts a slow upstream, surfaces a timeout and permits an explicit retry", { timeout: 2_000 }, async (t) => {
  const demo = await start(t, 120);
  const page = await (await fetch(demo.base + "/demo")).text();
  assert.match(page, /data-chat-timeout-ms="5120"/);
  demo.state.slow = true;
  const timedOut = await demo.chat();
  assert.equal(timedOut.status, 503);
  assert.equal((await timedOut.json()).code, "CHAT_TIMEOUT");
  await demo.cancelled;
  assert.deepEqual(demo.state, { slow: true, lookups: 0, eligibility: 1, tools: 0, aborted: 1 });
  demo.state.slow = false;
  const retry = await demo.chat();
  assert.equal((await retry.json()).code, "COVERAGE_RESULT");
  assert.deepEqual(demo.state, { slow: false, lookups: 1, eligibility: 2, tools: 1, aborted: 1 });
});

test("closing an in-flight chat cancels Ollama and does not look up coverage", { timeout: 2_000 }, async (t) => {
  const demo = await start(t, 750);
  demo.state.slow = true;
  const controller = new AbortController();
  const reply = demo.chat(controller.signal);
  const aborted = assert.rejects(reply, { name: "AbortError" });
  await demo.started;
  controller.abort();
  await aborted;
  await demo.cancelled;
  assert.deepEqual(demo.state, { slow: true, lookups: 0, eligibility: 1, tools: 0, aborted: 1 });
});

test("an expiring verified session cancels inference before the request deadline", { timeout: 2_000 }, async (t) => {
  const demo = await start(t, 750);
  demo.expireSoon();
  demo.state.slow = true;
  const expired = await demo.chat();
  assert.equal(expired.status, 401);
  assert.equal((await expired.json()).code, "VERIFICATION_REQUIRED");
  await demo.cancelled;
  assert.deepEqual(demo.state, { slow: true, lookups: 0, eligibility: 1, tools: 0, aborted: 1 });
});
