import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoIntentSelector } from "../src/selector-factory.ts";
import { ClaudeIntentSelector } from "../src/claude-selector.ts";
import { DemoKeywordSelector } from "../src/demo-selector.ts";

test("offline fixture mode is the default even if a key happens to be set", () => {
  const selector = createDemoIntentSelector({ ANTHROPIC_API_KEY: "synthetic-key" });
  assert.ok(selector instanceof DemoKeywordSelector);
});

test("explicit fixture mode works without credentials", () => {
  assert.ok(createDemoIntentSelector({ DEMO_INTENT_MODE: "fixture" }) instanceof DemoKeywordSelector);
});

test("paid provider mode is blocked without explicit opt-in", () => {
  assert.throws(() => createDemoIntentSelector({ DEMO_INTENT_MODE: "claude", ANTHROPIC_MODEL: "fake", ANTHROPIC_API_KEY: "fake" }), /PAID_LLM_NOT_ENABLED/);
});

test("paid opt-in still requires private credentials and a model ID", () => {
  assert.throws(() => createDemoIntentSelector({ DEMO_INTENT_MODE: "claude", ALLOW_PAID_LLM: "true" }), /LLM_NOT_CONFIGURED/);
});

test("invalid mode fails before any provider is initialized", () => {
  assert.throws(() => createDemoIntentSelector({ DEMO_INTENT_MODE: "other" }), /UNSUPPORTED_INTENT_MODE/);
});

test("only explicit double-opt-in with credentials constructs Claude selector", () => {
  const selector = createDemoIntentSelector({ DEMO_INTENT_MODE: "claude", ALLOW_PAID_LLM: "true", ANTHROPIC_MODEL: "synthetic-model", ANTHROPIC_API_KEY: "synthetic-key" });
  assert.ok(selector instanceof ClaudeIntentSelector);
});
