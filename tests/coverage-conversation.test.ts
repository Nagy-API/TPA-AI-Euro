import assert from "node:assert/strict";
import { test } from "node:test";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import { DemoMemberAuth } from "../src/demo-auth/member-auth.ts";
import { DemoKeywordSelector } from "../src/demo-selector.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";

function verifiedAssistant() {
  let now = 0;
  const auth = new DemoMemberAuth(() => now);
  const backend = new MockTpaBackend(auth);
  const assistant = new CoverageAssistant(backend, new DemoKeywordSelector(), auth);
  const { challengeId } = auth.identify("M-DEMO-001");
  const session = auth.verify(challengeId, "135790");
  assert.ok(session);
  return {
    backend,
    ask: (question: string) => assistant.answer(session.sessionToken, question),
    advance: (ms: number) => { now += ms; }
  };
}

test("a narrow co-pay follow-up requires one explicit topic and uses the latest service", async () => {
  const demo = verifiedAssistant();
  assert.equal((await demo.ask("وطب نسبة التحمل كام؟")).code, "CLARIFICATION_NEEDED");
  assert.equal((await demo.ask("Is MRI covered?")).code, "COVERAGE_RESULT");
  assert.match((await demo.ask("وطب نسبة التحمل كام؟")).answer, /20%/);
  assert.equal((await demo.ask("Is CBC covered?")).code, "COVERAGE_RESULT");
  assert.match((await demo.ask("And how much is the co-pay?")).answer, /نسبة التحمل: 0%/);
});

test("ambiguous or unrelated turns clarify and clear the previous topic", async (t) => {
  const demo = verifiedAssistant();
  const coverage = t.mock.method(demo.backend, "getCoverage");
  for (const question of ["MRI or CBC?", "What is the copay for dental?", "Approve this claim", "Thanks"]) {
    assert.equal((await demo.ask("Is MRI covered?")).code, "COVERAGE_RESULT");
    assert.equal((await demo.ask(question)).code, "CLARIFICATION_NEEDED", question);
    assert.equal((await demo.ask("What is the copay?")).code, "CLARIFICATION_NEEDED", question);
  }
  assert.equal(coverage.mock.callCount(), 4);
});

test("a follow-up does not extend the two-minute topic lifetime", async () => {
  const demo = verifiedAssistant();
  assert.equal((await demo.ask("Is MRI covered?")).code, "COVERAGE_RESULT");
  demo.advance(119_999);
  assert.equal((await demo.ask("What is the copay?")).code, "COVERAGE_RESULT");
  demo.advance(1);
  const expired = await demo.ask("What is the copay?");
  assert.equal(expired.status, 200);
  assert.equal(expired.code, "CLARIFICATION_NEEDED");
});
