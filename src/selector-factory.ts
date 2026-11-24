import { ClaudeIntentSelector } from "./claude-selector.ts";
import type { CoverageIntentSelector } from "./contracts.ts";
import { DemoKeywordSelector } from "./demo-selector.ts";
import { OllamaCoverageIntentSelector } from "./ollama-selector.ts";

/**
 * Local demo uses fixtures by default. Both model modes are explicit, with a
 * separate paid-usage opt-in for Claude.
 */
export function createDemoIntentSelector(env: Record<string, string | undefined>): CoverageIntentSelector {
  const mode = env.DEMO_INTENT_MODE ?? "fixture";
  if (mode === "fixture") return new DemoKeywordSelector();
  if (mode === "ollama") return new OllamaCoverageIntentSelector(env.OLLAMA_MODEL ?? "");
  if (mode !== "claude") throw new Error("UNSUPPORTED_INTENT_MODE");
  if (env.ALLOW_PAID_LLM !== "true") throw new Error("PAID_LLM_NOT_ENABLED");
  if (!env.ANTHROPIC_API_KEY || !env.ANTHROPIC_MODEL) throw new Error("LLM_NOT_CONFIGURED");
  return new ClaudeIntentSelector(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL);
}
