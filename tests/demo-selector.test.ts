import assert from "node:assert/strict";
import { test } from "node:test";
import { DemoKeywordSelector } from "../src/demo-selector.ts";

test("offline keyword selector is deterministic and limited to documented codes", async () => {
  const demo = new DemoKeywordSelector();
  assert.deepEqual(await demo.selectCoverageIntent("محتاج رنين مغناطيسي"), { kind: "tool", name: "get_member_coverage", serviceCode: "MRI" });
  assert.deepEqual(await demo.selectCoverageIntent("صورة دم كاملة"), { kind: "tool", name: "get_member_coverage", serviceCode: "CBC" });
  assert.deepEqual(await demo.selectCoverageIntent("أشعة سينية"), { kind: "tool", name: "get_member_coverage", serviceCode: "XRAY" });
  assert.deepEqual(await demo.selectCoverageIntent("كل التحاليل"), { kind: "clarify" });
  assert.deepEqual(await demo.selectCoverageIntent("رنين وصورة دم كاملة"), { kind: "clarify" });
});
