import { readFileSync } from "node:fs";
import { ClaudeIntentSelector } from "../src/claude-selector.ts";
import { SERVICE_CODES } from "../src/contracts.ts";
import { evaluateIntents, type IntentEvalCase } from "../src/intent-evaluator.ts";

function loadCases(): IntentEvalCase[] {
  const raw: unknown = JSON.parse(readFileSync(new URL("../evals/intent-cases.json", import.meta.url), "utf8"));
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 30) throw new Error("Invalid evaluation fixture count");
  const codes: readonly string[] = SERVICE_CODES;
  const ids = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Malformed fixture");
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || !/^[A-Z]+-[0-9]{3}$/.test(row.id) || ids.has(row.id)) throw new Error("Invalid or duplicated fixture ID");
    ids.add(row.id);
    if (typeof row.question !== "string" || row.question.length > 500 || !row.question.trim()) throw new Error("Invalid synthetic question");
    if (row.expectedServiceCode !== null && (typeof row.expectedServiceCode !== "string" || !codes.includes(row.expectedServiceCode))) throw new Error("Invalid expected service code");
    if (typeof row.critical !== "boolean") throw new Error("Critical flag required");
  }
  return raw as IntentEvalCase[];
}

const cases = loadCases();
if (process.argv.length === 3 && process.argv[2] === "--cases") {
  for (const item of cases) console.log(`${item.id}: ${item.expectedServiceCode ?? "CLARIFY"}${item.critical ? " [critical]" : ""}`);
} else if (process.argv.length === 3 && process.argv[2] === "--live") {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!key || !model) {
    console.error("Missing ANTHROPIC_API_KEY or ANTHROPIC_MODEL in your local environment. No API requests sent.");
    process.exitCode = 2;
  } else {
    console.log(`Running ${cases.length} synthetic cases against model ${model}. Live provider usage may incur charges.`);
    const results = await evaluateIntents(new ClaudeIntentSelector(key, model), cases);
    for (const item of results) {
      console.log(`${item.id}: ${item.passed ? "PASS" : "FAIL"} expected=${item.expected} actual=${item.actual} elapsedMs=${item.elapsedMs}`);
    }
    const failed = results.filter(x => !x.passed);
    const criticalFailed = failed.filter(x => x.critical);
    console.log(`Summary: ${results.length - failed.length}/${results.length} passed; ${criticalFailed.length} critical failures.`);
    if (failed.length) process.exitCode = 1;
  }
} else {
  console.error("Usage: npm run eval:cases (offline) OR npm run eval:live (requires approved Anthropic key/model)");
  process.exitCode = 2;
}
