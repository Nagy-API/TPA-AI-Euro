import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";
import { createDemoServer } from "../src/http-server.ts";

const app = () => createDemoServer(new CoverageAssistant(new MockTpaBackend(), { selectCoverageIntent: async () => ({ kind: "tool", name: "get_member_coverage", serviceCode: "MRI" }) }), true);

test("HTTP demo endpoint receives verified fixture token and returns grounded result", async () => {
  const server = app(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const addr = server.address(); if (!addr || typeof addr === "string") throw new Error("bad address");
    const res = await fetch(`http://127.0.0.1:${addr.port}/v1/chat`, { method: "POST", headers: { "content-type": "application/json", "x-demo-session": "demo-gold-session" }, body: JSON.stringify({ message: "هل الرنين مغطى؟" }) });
    const body = await res.json() as { code: string; answer: string };
    assert.equal(res.status, 200); assert.equal(body.code, "COVERAGE_RESULT"); assert.match(body.answer, /20%/);
  } finally { server.close(); await once(server, "close"); }
});
test("HTTP endpoint is disabled by default", async () => {
  const server = createDemoServer(new CoverageAssistant(new MockTpaBackend(), { selectCoverageIntent: async () => ({ kind: "clarify" }) }), false);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const addr = server.address(); if (!addr || typeof addr === "string") throw new Error("bad address");
    const res = await fetch(`http://127.0.0.1:${addr.port}/v1/chat`, { method: "POST" });
    assert.equal(res.status, 503);
  } finally { server.close(); await once(server, "close"); }
});
