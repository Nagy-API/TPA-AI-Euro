import assert from "node:assert/strict";
import { test } from "node:test";
import type { CoverageIntentSelector, ToolSelection, TpaBackend } from "../src/contracts.ts";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";

const question = "هل الرنين المغناطيسي مغطى؟";
const mriSelection: ToolSelection = { kind: "tool", name: "get_member_coverage", serviceCode: "MRI" };
const mriSelector: CoverageIntentSelector = { selectCoverageIntent: async () => mriSelection };

test("expired sessions stop before intent selection and policy lookup", async (t) => {
  const selectCoverageIntent = t.mock.fn(mriSelector.selectCoverageIntent);
  const getCoverage = t.mock.fn(async () => { throw new Error("unexpected policy lookup"); });
  const assistant = new CoverageAssistant({
    resolveSession: async () => ({ memberKey: "demo-gold", tenantKey: "demo-insurer-a", expiresAt: 0 }),
    getCoverage,
  }, { selectCoverageIntent });

  const reply = await assistant.answer("demo-gold-session", question);

  assert.equal(reply.status, 401);
  assert.equal(reply.code, "VERIFICATION_REQUIRED");
  assert.equal(selectCoverageIntent.mock.callCount(), 0);
  assert.equal(getCoverage.mock.callCount(), 0);
});

test("identity lookup failure redacts the cause and stops before privileged operations", async (t) => {
  const diagnostic = "synthetic identity service diagnostic";
  const selectCoverageIntent = t.mock.fn(mriSelector.selectCoverageIntent);
  const getCoverage = t.mock.fn(async () => { throw new Error("unexpected policy lookup"); });
  const assistant = new CoverageAssistant({
    resolveSession: async () => { throw new Error(diagnostic); },
    getCoverage,
  }, { selectCoverageIntent });

  const reply = await assistant.answer("demo-gold-session", question);

  assert.equal(reply.status, 503);
  assert.equal(reply.code, "IDENTITY_UNAVAILABLE");
  assert.ok(!reply.answer.includes(diagnostic));
  assert.equal(selectCoverageIntent.mock.callCount(), 0);
  assert.equal(getCoverage.mock.callCount(), 0);
});

test("assistant rejects a tool outside its allowlist even with a supported service code", async (t) => {
  const mock = new MockTpaBackend();
  const getCoverage = t.mock.fn(mock.getCoverage.bind(mock));
  const unsupportedTool: unknown = { kind: "tool", name: "unsupported_tool", serviceCode: "MRI" };
  const assistant = new CoverageAssistant({ resolveSession: mock.resolveSession.bind(mock), getCoverage }, {
    selectCoverageIntent: async () => unsupportedTool as ToolSelection,
  });

  const reply = await assistant.answer("demo-gold-session", question);

  assert.equal(reply.code, "CLARIFICATION_NEEDED");
  assert.equal(getCoverage.mock.callCount(), 0);
});

test("overlapping requests for the same service keep each member and tenant scoped", async (t) => {
  const mock = new MockTpaBackend();
  const getCoverage = t.mock.fn(mock.getCoverage.bind(mock));
  const assistant = new CoverageAssistant({ resolveSession: mock.resolveSession.bind(mock), getCoverage }, mriSelector);

  const [gold, silver, vip] = await Promise.all([
    assistant.answer("demo-gold-session", question),
    assistant.answer("demo-silver-session", question),
    assistant.answer("demo-vip-session", question),
  ]);

  const scopes = getCoverage.mock.calls.map(({ arguments: [session, serviceCode] }) => ({
    memberKey: session.memberKey, tenantKey: session.tenantKey, serviceCode,
  })).sort((left, right) => left.memberKey.localeCompare(right.memberKey));
  assert.deepEqual(scopes, [
    { memberKey: "demo-gold", tenantKey: "demo-insurer-a", serviceCode: "MRI" },
    { memberKey: "demo-silver", tenantKey: "demo-insurer-a", serviceCode: "MRI" },
    { memberKey: "demo-vip", tenantKey: "demo-insurer-b", serviceCode: "MRI" },
  ]);
  for (const reply of [gold, silver, vip]) {
    assert.equal(reply.status, 200);
    assert.equal(reply.code, "COVERAGE_RESULT");
  }
  assert.match(gold.answer, /5,000/);
  assert.doesNotMatch(gold.answer, /12,000/);
  assert.match(silver.answer, /غير مغطّى/);
  assert.doesNotMatch(silver.answer, /5,000|12,000/);
  assert.match(vip.answer, /12,000/);
  assert.doesNotMatch(vip.answer, /5,000/);
});

test("a well-formed result for the wrong service is suppressed and a later lookup can recover", async (t) => {
  const mock = new MockTpaBackend();
  const getCoverage = t.mock.fn<TpaBackend["getCoverage"]>(mock.getCoverage.bind(mock));
  getCoverage.mock.mockImplementationOnce(async (session) => mock.getCoverage(session, "CBC"));
  const assistant = new CoverageAssistant({ resolveSession: mock.resolveSession.bind(mock), getCoverage }, mriSelector);

  const rejected = await assistant.answer("demo-gold-session", question);
  const recovered = await assistant.answer("demo-gold-session", question);

  assert.equal(rejected.status, 503);
  assert.equal(rejected.code, "COVERAGE_UNAVAILABLE");
  assert.doesNotMatch(rejected.answer, /1,000|صورة الدم/);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.code, "COVERAGE_RESULT");
  assert.match(recovered.answer, /5,000/);
  assert.equal(getCoverage.mock.callCount(), 2);
});
