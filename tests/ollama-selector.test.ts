import assert from "node:assert/strict";
import { test } from "node:test";
import { OllamaCoverageIntentSelector } from "../src/ollama-selector.ts";
import { createDemoIntentSelector } from "../src/selector-factory.ts";

const model = "qwen3:4b-instruct";
const question = "هو الرنين المغناطيسي بيتغطى؟";
const installed = { models: [{ name: model, size: 2_497_293_803, details: { format: "gguf" } }] };
const call = (name: string, args: unknown) => ({ function: { name, arguments: args } });
const valid = call("get_member_coverage", { serviceCode: "MRI" });
const reply = (toolCalls?: unknown) => ({
  done: true, done_reason: "stop", message: { role: "assistant", content: "", tool_calls: toolCalls }
});
const eligibility = (value: string) => ({ ...reply(), message: { role: "assistant", content: value } });

function selectorFor(payload: unknown, manifest: unknown = installed, eligibilityReply = eligibility('{"eligible":true}')) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const selector = new OllamaCoverageIntentSelector(model, async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/api/tags")) return Response.json(manifest);
    return Response.json(JSON.parse(String(init?.body)).format ? eligibilityReply : payload);
  });
  return { requests, selector };
}

test("Ollama sends only the public catalog and question to a fixed loopback endpoint", async () => {
  const { selector, requests } = selectorFor(reply([valid]));
  assert.deepEqual(await selector.selectCoverageIntent(question), {
    kind: "tool", name: "get_member_coverage", serviceCode: "MRI"
  });
  assert.deepEqual(requests.map(({ url }) => url), [
    "http://127.0.0.1:11434/api/tags", "http://127.0.0.1:11434/api/chat", "http://127.0.0.1:11434/api/chat"
  ]);
  assert.ok(requests.every(({ init }) => init?.redirect === "error" && init.signal === requests[0].init?.signal));
  const screening = JSON.parse(String(requests[1].init?.body));
  assert.equal(screening.tools, undefined);
  assert.deepEqual(screening.messages.slice(1), [{ role: "user", content: question }]);
  const body = JSON.parse(String(requests[2].init?.body));
  assert.equal(body.model, model);
  assert.equal(body.stream, false);
  assert.deepEqual(body.messages.slice(1), [{ role: "user", content: question }]);
  assert.equal(body.tools.length, 1);
  assert.deepEqual(body.tools[0].function.parameters, {
    type: "object", properties: { serviceCode: { type: "string", enum: ["MRI", "CBC", "XRAY"] } },
    required: ["serviceCode"], additionalProperties: false
  });
});

test("an ineligible or malformed screening response never reaches tool selection", async () => {
  const blocked = selectorFor(reply([valid]), installed, eligibility('{"eligible":false}'));
  assert.deepEqual(await blocked.selector.selectCoverageIntent(question), { kind: "clarify" });
  assert.equal(blocked.requests.length, 2);
  for (const content of ["no", '{"eligible":"true"}', '{"eligible":true,"serviceCode":"MRI"}']) {
    const malformed = selectorFor(reply([valid]), installed, eligibility(content));
    await assert.rejects(malformed.selector.selectCoverageIntent(question), /OLLAMA_INVALID_RESPONSE/);
    assert.equal(malformed.requests.length, 2);
  }
});

test("a completed response with no calls or an empty call list requests clarification", async () => {
  for (const calls of [undefined, []]) {
    const { selector } = selectorFor(reply(calls));
    assert.deepEqual(await selector.selectCoverageIntent(question), { kind: "clarify" });
  }
});

test("two different allowlisted services are ambiguous and neither is selected", async () => {
  const { selector } = selectorFor(reply([valid, call("get_member_coverage", { serviceCode: "CBC" })]));
  assert.deepEqual(await selector.selectCoverageIntent(question), { kind: "clarify" });
});

test("wrong tools, codes, extra arguments, multiple calls and malformed responses fail closed", async () => {
  for (const payload of [
    {}, { ...reply([valid]), done: false }, { ...reply([valid]), done_reason: "length" },
    reply(null), reply([valid, valid]), reply([call("approve", { serviceCode: "MRI" })]),
    reply([call("get_member_coverage", { serviceCode: "CT" })]),
    reply([call("get_member_coverage", { serviceCode: "MRI", memberKey: "demo-vip" })]),
    reply([call("get_member_coverage", '{"serviceCode":"MRI"}')])
  ]) {
    await assert.rejects(selectorFor(payload).selector.selectCoverageIntent(question), /OLLAMA_INVALID_RESPONSE/);
  }
});

test("remote aliases and missing local models never receive a prompt", async () => {
  for (const models of [[], [{ ...installed.models[0], remote_host: "https://example.test" }],
    [{ ...installed.models[0], remote_model: "upstream" }]]) {
    const { selector, requests } = selectorFor(reply([valid]), { models });
    await assert.rejects(selector.selectCoverageIntent(question), /OLLAMA_LOCAL_MODEL_UNAVAILABLE/);
    assert.equal(requests.length, 1);
  }
});

test("sensitive chat input is blocked before sending anything to Ollama", async () => {
  const { selector, requests } = selectorFor(reply([valid]));
  for (const input of [
    "MRI for M-DEMO-002", "MRI " + "a".repeat(43), "MRI ١٣٥٧٩٠",
    "MRI for demo-tenant-a", "MRI for demo-gold", "MRI under my policy number ABC",
    "الرنين مغطى؟ نسبة التحمل عندي ٢٠٪", "هل الرنين مغطى؟ رقم الوثيقة ABC"
  ]) {
    assert.deepEqual(await selector.selectCoverageIntent(input), { kind: "clarify" });
  }
  assert.equal(requests.length, 0);
});

test("HTTP error, invalid JSON, oversized body and timeout are observable", async () => {
  const oversized = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(65_537)); }
  });
  for (const response of [new Response("provider details", { status: 404 }), new Response("{"), new Response(oversized)]) {
    const selector = new OllamaCoverageIntentSelector(model, async (url) =>
      String(url).endsWith("/api/tags") ? Response.json(installed) : response);
    await assert.rejects(selector.selectCoverageIntent(question), /OLLAMA_/);
  }
  const timeout = new OllamaCoverageIntentSelector(model, async (_url, init) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 200);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(init.signal?.reason);
      }, { once: true });
    });
    return Response.json(installed);
  }, 10);
  await assert.rejects(timeout.selectCoverageIntent(question), /OLLAMA_UNAVAILABLE/);
});

test("Ollama is opt-in and model configuration excludes cloud and registry names", () => {
  assert.ok(createDemoIntentSelector({ DEMO_INTENT_MODE: "ollama", OLLAMA_MODEL: model }) instanceof OllamaCoverageIntentSelector);
  for (const name of [undefined, "gpt-oss:120b-cloud", "qwen3:cloud", "example.test/qwen3:4b", "qwen3"]) {
    assert.throws(() => createDemoIntentSelector({ DEMO_INTENT_MODE: "ollama", OLLAMA_MODEL: name }), /OLLAMA_MODEL_NOT_LOCAL/);
  }
});
