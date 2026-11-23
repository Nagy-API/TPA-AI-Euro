import type { CoverageIntentSelector, ServiceCode, ToolSelection } from "./contracts.ts";

/** Synthetic-only prompt evaluation. Never feed live patient data to this harness. */
export type IntentEvalCase = Readonly<{
  id: string;
  question: string;
  expectedServiceCode: ServiceCode | null;
  critical: boolean;
}>;
export type IntentEvalResult = Readonly<{
  id: string;
  expected: string;
  actual: string;
  passed: boolean;
  critical: boolean;
  elapsedMs: number;
}>;

function label(selection: ToolSelection): string {
  return selection.kind === "tool" && selection.name === "get_member_coverage"
    ? selection.serviceCode
    : "CLARIFY";
}

export async function evaluateIntents(
  selector: CoverageIntentSelector,
  cases: readonly IntentEvalCase[]
): Promise<IntentEvalResult[]> {
  const results: IntentEvalResult[] = [];
  for (const item of cases) {
    const started = performance.now();
    const expected = item.expectedServiceCode ?? "CLARIFY";
    let actual = "SELECTOR_ERROR";
    try {
      actual = label(await selector.selectCoverageIntent(item.question));
    } catch {
      // Do not expose provider error bodies: they may include request/user content.
    }
    results.push({
      id: item.id,
      expected,
      actual,
      passed: expected === actual,
      critical: item.critical,
      elapsedMs: Math.round(performance.now() - started)
    });
  }
  return results;
}
