import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenAIResponsesProvider } from "../src/openai-responses-provider.ts";
import { InferenceDeadlineError, type InferenceRequest } from "../src/conversation-provider.ts";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import { ConversationExperiment } from "../src/conversation-experiment.ts";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import { DEMO_MEMBERS } from "../src/demo-auth/fixtures.ts";
import { DemoMemberAuth } from "../src/demo-auth/member-auth.ts";
import { DemoKeywordSelector } from "../src/demo-selector.ts";
import { createDemoServer } from "../src/http-server.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";

const request: InferenceRequest = {
  stage: "interpret",
  messages: [{ role: "system", content: "Choose from the schema." }, { role: "user", content: "هل الفحص مغطى؟" }],
  schema: { type: "object", properties: { intent: { type: "string", enum: ["CLARIFY"] } },
    required: ["intent"], additionalProperties: false },
  timeoutMs: 1000,
  maxOutputTokens: 1024
};
const value = { intent: "CLARIFY" };
const message = { type: "message", role: "assistant", status: "completed",
  content: [{ type: "output_text", text: JSON.stringify(value), annotations: [] }] };
const completed = {
  model: "gpt-6.2-sol", service_tier: "default", status: "completed", error: null, incomplete_details: null,
  output: [{ type: "reasoning", summary: [] }, message],
  usage: { input_tokens: 90, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 10,
    cache_write_tokens_details: { ttl_30m_tokens: 10, ttl_12h_tokens: 0 } },
    output_tokens: 50, output_tokens_details: { reasoning_tokens: 40 } }
};
const signal = new AbortController().signal;

test("V0.6 CLI runs the full synthetic corpus offline and reports a delivered composition fallback", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/evaluate-v06-conversation.ts", "--stub"], {
    encoding: "utf8", timeout: 15_000, env: { ...process.env, ALLOW_PAID_LLM: "false", OPENAI_API_KEY: "" }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const events = result.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  const summary = events.at(-1);
  assert.equal(summary.mode, "stub");
  assert.equal(summary.passed, 22);
  assert.equal(summary.complete, 9);
  assert.equal(summary.wrongOrUnexpected, 0);
  assert.equal(summary.wrongScope, 0);
  assert.equal(summary.compositionFallbacks, 1);
  assert.equal(summary.compositionAttempts, 12);
  assert.equal(events.find((event) => event.scenario === "missing-xray-referral" && event.turn === 1)?.composition, "not-attempted");
  assert.equal(events.filter((event) => event.event === "turn" && event.composition === "fallback-invalid-plan").length, 1);
  assert.ok(summary.compositionAttempts > summary.compositionFallbacks);
});

test("Responses rejects completed JSON outside the requested schema", async () => {
  const provider = new OpenAIResponsesProvider("fake-test-key", { fetcher: async () => Response.json({
    ...completed, output: [{ ...message, content: [{ type: "output_text", text: '{"intent":"OTHER"}' }] }]
  }) });
  await assert.rejects(provider.infer(request, signal), /OPENAI_INVALID_OUTPUT/);
});

test("Responses stops subsequent sends on reported token overruns even without usage details", async () => {
  let calls = 0;
  const provider = new OpenAIResponsesProvider("fake-test-key", { fetcher: async () => {
    calls++;
    return Response.json({ ...completed, usage: { input_tokens: 90, output_tokens: 1025 } });
  } });
  await assert.rejects(provider.infer(request, signal), /OPENAI_UNEXPECTED_USAGE/);
  assert.equal(provider.summary().stopReason, "usage-over-reservation");
  assert.ok(provider.summary().estimatedUsd > 0);
  await assert.rejects(provider.infer(request, signal), /OPENAI_BUDGET_EXHAUSTED/);
  assert.equal(calls, 1);
});

test("verified HTTP uses the injected Responses wire and isolates auth, coverage facts and referrals", async (t) => {
  const calls: { text: { format: { name: string } }; input: unknown[] }[] = [];
  const auth = new DemoMemberAuth();
  const provider = new OpenAIResponsesProvider("fake-test-key", { fetcher: async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as typeof calls[number];
    calls.push(body);
    const proposal = calls.length === 1
      ? { intent: "COVERAGE_LOOKUP", subject: "MRI", focus: "OVERVIEW", tool: "get_member_coverage" }
      : { parts: ["answer", "preapproval", "copay", "limit", "disclaimer"] };
    return Response.json({ ...completed, output: [{ ...message, content: [{ type: "output_text", text: JSON.stringify(proposal) }] }] });
  } });
  const assistant = new CoverageAssistant(new MockTpaBackend(auth), new DemoKeywordSelector(), auth, undefined,
    new ConversationExperiment(provider, { maxOutputTokens: 1024 }));
  const server = createDemoServer(assistant, true, auth);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const { port } = address;

  async function post(path: string, payload: object, token?: string) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers["x-demo-session"] = token;
    const response = await fetch("http://127.0.0.1:" + port + path, {
      method: "POST", headers, body: JSON.stringify(payload)
    });
    return { status: response.status, payload: await response.json() as {
      answer: string; code: string; challengeId: string; sessionToken: string
    } };
  }

  const question = "هل الرنين المغناطيسي مغطى؟";
  assert.equal((await post("/v1/chat", { message: question })).status, 401);
  assert.equal(calls.length, 0);
  const fixture = DEMO_MEMBERS[0];
  const challenge = await post("/v1/member-auth/challenges", { memberIdentifier: fixture.identifier });
  const verified = await post("/v1/member-auth/challenges/" + challenge.payload.challengeId + "/verify",
    { oneTimeCode: fixture.code });
  assert.equal(verified.status, 200);
  const token = verified.payload.sessionToken;
  const coverage = await post("/v1/chat", { message: question }, token);
  assert.equal(coverage.payload.code, "COVERAGE_RESULT");
  assert.match(coverage.payload.answer, /مغطّى بشروط.*موافقة مسبقة.*20%.*5,000 جنيه/u);
  const contact = await post("/v1/chat", { message: "ممكن رقم خدمة العملاء؟" }, token);
  assert.match(contact.payload.answer, /رقم خدمة العملاء مش متاح.*وثيقة التأمين/u);
  assert.deepEqual(calls.map(({ text }) => text.format.name), ["tpa_interpret", "tpa_compose"]);
  const outbound = JSON.stringify(calls);
  assert.doesNotMatch(outbound, /M-DEMO-001|demo-gold|135790|POL-DEMO|20%|5,000|رقم خدمة العملاء/u);
  assert.ok(!outbound.includes(token));
  assert.ok(!JSON.stringify(calls[1]).includes(question));
});

test("a stalled response body is cancelled at the provider deadline", async () => {
  const keepAlive = setInterval(() => {}, 100);
  try {
    let cancelled = false;
    const provider = new OpenAIResponsesProvider("fake-test-key", { fetcher: async () =>
      new Response(new ReadableStream({ cancel() { cancelled = true; } })) });
    await assert.rejects(provider.infer({ ...request, timeoutMs: 10 }, signal), InferenceDeadlineError);
    assert.equal(cancelled, true);
    assert.equal(provider.summary().requests, 1);
  } finally {
    clearInterval(keepAlive);
  }
});

test("Responses sends a stateless JSON schema and accounts for reasoning only once", async () => {
  const provider = new OpenAIResponsesProvider("fake-test-key", { fetcher: async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fake-test-key");
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body, {
      model: "gpt-6.2-sol", reasoning: { effort: "medium" }, service_tier: "default",
      instructions: "Choose from the schema.", input: [request.messages[1]],
      text: { format: { type: "json_schema", name: "tpa_interpret", strict: true, schema: request.schema } },
      max_output_tokens: 1024, store: false, background: false, stream: false, tools: []
    });
    return Response.json(completed);
  } });
  assert.deepEqual(await provider.infer(request, signal), value);
  const stats = provider.summary();
  assert.equal(stats.requests, 1);
  assert.equal(stats.reasoningTokens, 40);
  assert.equal(stats.estimatedUsd, 0.000647);
});

test("Responses rejects refusal, partial output, unsolicited tool calls, malformed JSON and oversized bodies", async () => {
  const responses = [
    Response.json({ ...completed, output: [{ ...message, content: [{ type: "refusal", refusal: "private detail" }] }] }),
    Response.json({ ...completed, status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }),
    Response.json({ ...completed, output: [message, { type: "function_call", name: "get_member_coverage" }] }),
    Response.json({ ...completed, output: [{ ...message, content: [{ type: "output_text", text: "{" }] }] }),
    new Response("x".repeat(65537)),
    Response.json({ error: { message: "private detail" } }, { status: 429 }),
    Response.json({ error: { message: "private detail" } }, { status: 503 })
  ];
  for (const response of responses) {
    const provider = new OpenAIResponsesProvider("fake-test-key", { fetcher: async () => response });
    await assert.rejects(provider.infer(request, signal), (error: Error) =>
      /^OPENAI_[A-Z_]+$/.test(error.message));
    assert.equal(provider.summary().requests, 1);
  }
});

test("Responses reserves unknown spend and blocks sends beyond request, token and dollar limits", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return Response.json({ error: "unavailable" }, { status: 503 });
  };
  const provider = new OpenAIResponsesProvider("fake-test-key", { fetcher, maxRequests: 1 });
  await assert.rejects(provider.infer(request, signal));
  assert.ok(provider.summary().estimatedUsd > 0);
  await assert.rejects(provider.infer(request, signal), /OPENAI_BUDGET_EXHAUSTED/);
  await assert.rejects(new OpenAIResponsesProvider("fake-test-key", { fetcher, maxUsd: 0.00001 })
    .infer(request, signal), /OPENAI_BUDGET_EXHAUSTED/);
  await assert.rejects(new OpenAIResponsesProvider("fake-test-key", { fetcher })
    .infer({ ...request, maxOutputTokens: 1025 }, signal), /OPENAI_INVALID_REQUEST/);
  const oversized = { ...request, messages: [request.messages[0], { role: "user" as const, content: "أ".repeat(4000) }] };
  await assert.rejects(new OpenAIResponsesProvider("fake-test-key", { fetcher })
    .infer(oversized, signal), /OPENAI_INPUT_BUDGET_EXCEEDED/);
  assert.equal(calls, 1);
});

test("Responses aborts the transport on deadline and never refunds an unknown attempt", async () => {
  const keepAlive = setInterval(() => {}, 100);
  try {
    const provider = new OpenAIResponsesProvider("fake-test-key", { fetcher: async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }) });
    await assert.rejects(provider.infer({ ...request, timeoutMs: 10 }, signal), InferenceDeadlineError);
    assert.equal(provider.summary().requests, 1);
    assert.ok(provider.summary().estimatedUsd > 0);
  } finally {
    clearInterval(keepAlive);
  }
});
