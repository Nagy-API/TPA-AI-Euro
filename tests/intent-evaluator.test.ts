import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { CoverageIntentSelector } from "../src/contracts.ts";
import { evaluateIntents, type IntentEvalCase } from "../src/intent-evaluator.ts";

const cases = JSON.parse(readFileSync(new URL("../evals/intent-cases.json", import.meta.url), "utf8")) as IntentEvalCase[];

test("synthetic evaluation records passes for expected selections", async () => {
  const expectedByQuestion = new Map(cases.map(item => [item.question, item.expectedServiceCode]));
  const selector: CoverageIntentSelector = {
    async selectCoverageIntent(question) {
      const code = expectedByQuestion.get(question);
      return code ? { kind: "tool", name: "get_member_coverage", serviceCode: code } : { kind: "clarify" };
    }
  };
  const results = await evaluateIntents(selector, cases);
  assert.equal(results.length, 14);
  assert.ok(results.every(result => result.passed));
  assert.ok(results.some(result => result.critical));
});

test("evaluation reports mistakes rather than masking them", async () => {
  const selector: CoverageIntentSelector = { async selectCoverageIntent() { return { kind: "clarify" }; } };
  const results = await evaluateIntents(selector, cases.slice(0, 2));
  assert.equal(results.filter(x => !x.passed).length, 2);
  assert.equal(results[0].actual, "CLARIFY");
});

test("selector errors never leak provider exceptions or confidential values", async () => {
  const selector: CoverageIntentSelector = {
    async selectCoverageIntent() { throw new Error("SECRET_API_KEY_SHOULD_NOT_LEAK"); }
  };
  const result = (await evaluateIntents(selector, cases.slice(0, 1)))[0];
  assert.equal(result.actual, "SELECTOR_ERROR");
  assert.equal(result.passed, false);
  assert.doesNotMatch(JSON.stringify(result), /SECRET_API_KEY_SHOULD_NOT_LEAK/);
});
