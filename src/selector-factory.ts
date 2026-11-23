import { ClaudeIntentSelector } from "./claude-selector.ts";
import type { CoverageIntentSelector } from "./contracts.ts";
import { DemoKeywordSelector } from "./demo-selector.ts";

/**
 * Local demo is FREE and deterministic by default. Network/provider calls must
 * require an explicit model mode and an explicit paid-usage opt-in.
 */
export function createDemoIntentSelector(env: Record<string, string | undefined>): CoverageIntentSelector {
  const mode = env.DEMO_INTENT_MODE ?? "fixture";
  if (mode === "fixture") return new DemoKeywordSelector();
  if (mode !== "claude") throw new Error("UNSUPPORTED_INTENT_MODE");
  if (env.ALLOW_PAID_LLM !== "true") throw new Error("PAID_LLM_NOT_ENABLED");
  if (!env.ANTHROPIC_API_KEY || !env.ANTHROPIC_MODEL) throw new Error("LLM_NOT_CONFIGURED");
  return new ClaudeIntentSelector(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL);
}
