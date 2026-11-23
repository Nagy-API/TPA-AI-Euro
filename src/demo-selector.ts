import type { CoverageIntentSelector, ToolSelection } from "./contracts.ts";

/** Deterministic offline DEMO selector, NOT AI. Enables local endpoint tests without an API key. */
export class DemoKeywordSelector implements CoverageIntentSelector {
  async selectCoverageIntent(question: string): Promise<ToolSelection> {
    const matches = [
      { code: "MRI", regex: /(?:رنين|mri|magnetic resonance)/i },
      { code: "CBC", regex: /(?:صورة\s*دم\s*كاملة|cbc|complete blood count)/i },
      { code: "XRAY", regex: /(?:اشعة\s*سينية|أشعة\s*سينية|x.?ray)/i }
    ].filter((item) => item.regex.test(question));
    return matches.length === 1
      ? { kind: "tool", name: "get_member_coverage", serviceCode: matches[0].code }
      : { kind: "clarify" };
  }
}
