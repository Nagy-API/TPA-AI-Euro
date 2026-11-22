import assert from "node:assert/strict";
import { test } from "node:test";
import { ClaudeIntentSelector } from "../src/claude-selector.ts";

const makeFetch = (content: unknown[]) => async (_input: RequestInfo | URL, _init?: RequestInit) =>
  new Response(JSON.stringify({ content }), { status: 200, headers: { "content-type": "application/json" } });

test("Claude tool-use response parsed and the only allowed tool forwarded", async () => {
  const selector = new ClaudeIntentSelector("fake-key", "fake-model", makeFetch([{ type: "tool_use", name: "get_member_coverage", input: { serviceCode: "MRI" } }]) as typeof fetch);
  assert.deepEqual(await selector.selectCoverageIntent("رنين مغناطيسي"), { kind: "tool", name: "get_member_coverage", serviceCode: "MRI" });
});
test("refuses unknown Claude tool use", async () => {
  const selector = new ClaudeIntentSelector("fake-key", "fake-model", makeFetch([{ type: "tool_use", name: "delete_member", input: { serviceCode: "MRI" } }]) as typeof fetch);
  assert.deepEqual(await selector.selectCoverageIntent("رنين"), { kind: "clarify" });
});
test("multiple tool calls rejected", async () => {
  const block = { type: "tool_use", name: "get_member_coverage", input: { serviceCode: "MRI" } };
  const selector = new ClaudeIntentSelector("fake-key", "fake-model", makeFetch([block, block]) as typeof fetch);
  assert.deepEqual(await selector.selectCoverageIntent("رنين"), { kind: "clarify" });
});
