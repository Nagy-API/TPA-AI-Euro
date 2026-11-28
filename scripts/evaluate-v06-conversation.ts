import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ConversationExperiment } from "../src/conversation-experiment.ts";
import { HubConversationProvider, type ConversationProvider } from "../src/conversation-provider.ts";
import { isServiceCode, type ServiceCode } from "../src/contracts.ts";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import { DEMO_MEMBERS } from "../src/demo-auth/fixtures.ts";
import { DemoMemberAuth } from "../src/demo-auth/member-auth.ts";
import { DemoKeywordSelector } from "../src/demo-selector.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";
import { OllamaCoverageIntentSelector } from "../src/ollama-selector.ts";
import { OPENAI_MAX_OUTPUT_TOKENS, OpenAIResponsesProvider } from "../src/openai-responses-provider.ts";
import { v06ResponsesStub } from "./v06-responses-stub.ts";

type Turn = {
  question: string;
  code: string;
  lookup: ServiceCode | null;
  includes?: string[];
  excludes?: string[];
  advanceMs?: 120001 | 600001;
};
type Scenario = { id: string; member: "gold" | "silver" | "vip" | "unverified"; turns: Turn[] };

const MAX_TURNS = 80;
const MAX_RUN_MS = 30 * 60_000;
const args = process.argv.slice(2);

async function main() {
  const stub = args.length === 1 && args[0] === "--stub";
  const mode = stub ? "stub" : args[1];
  const list = args.length === 0 || args.length === 1 && args[0] === "--list";
  const live = args.length === 3 && args[0] === "--provider" && mode === "openai" && args[2] === "--allow-paid";
  const local = args.length === 2 && args[0] === "--provider" && (mode === "ollama" || mode === "hub");
  if (!list && !stub && !live && !local) throw new Error("INVALID_ARGUMENTS");
  if (live && (process.env.ALLOW_PAID_LLM !== "true" || !process.env.OPENAI_API_KEY || process.env.CI ||
      process.env.NODE_ENV === "production")) throw new Error("PAID_EVALUATION_DISABLED");

  // The CLI accepts only this reviewed, bundled corpus. It never accepts a prompt or filename.
  const manifest = readFileSync(new URL("../evals/v06-synthetic-contract.json", import.meta.url));
  const manifestSha256 = createHash("sha256").update(manifest).digest("hex");
  if (live && process.env.OPENAI_EVAL_MANIFEST_SHA256 !== manifestSha256) {
    throw new Error("SYNTHETIC_MANIFEST_NOT_APPROVED");
  }
  const cases = JSON.parse(manifest.toString("utf8")) as Scenario[];
  const turns = cases.reduce((count, scenario) => count + scenario.turns.length, 0);
  if (turns < 1 || turns > MAX_TURNS || new Set(cases.map(({ id }) => id)).size !== cases.length ||
      cases.some(({ turns }) => turns.length === 0 || turns.some(({ question, lookup }) =>
        !question.trim() || question.length > 500 || lookup !== null && !isServiceCode(lookup)))) {
    throw new Error("INVALID_SYNTHETIC_MANIFEST");
  }
  if (list) {
    console.log(JSON.stringify({ manifestSha256, scenarios: cases.map(({ id }) => id), turns, network: "disabled" }));
    return;
  }

  const deadline = Date.now() + MAX_RUN_MS;
  const runSignal = AbortSignal.timeout(MAX_RUN_MS);
  const responses = live || stub ? new OpenAIResponsesProvider(stub ? "offline-stub" : process.env.OPENAI_API_KEY!, {
    fetcher: stub ? v06ResponsesStub : undefined,
    onAttempt: ({ stage, outcome, latencyMs, usage, reservedUsd }) => console.log(JSON.stringify({
      event: "provider", simulated: stub, stage, outcome, latencyMs, inputTokens: usage?.input, cachedTokens: usage?.cached,
      outputTokens: usage?.output, reasoningTokens: usage?.reasoning,
      estimatedUsd: usage ? usage.cost / 1_000_000_000 : reservedUsd
    }))
  }) : undefined;
  const provider: ConversationProvider = responses ?? (mode === "hub"
    ? new HubConversationProvider(process.env.LOCAL_AI_HUB_PROFILE)
    : new OllamaCoverageIntentSelector(process.env.OLLAMA_MODEL ?? ""));
  const model = responses?.summary().model ?? (mode === "hub"
    ? process.env.LOCAL_AI_HUB_PROFILE ?? "local-instruct"
    : process.env.OLLAMA_MODEL);
  console.log(JSON.stringify({ event: "run", mode, model, manifestSha256, scenarios: cases.length, turns }));
  const latencies: number[] = [];
  let attempts = 0;
  let passed = 0;
  let complete = 0;
  let required = 0;
  let correct = 0;
  let wrongOrUnexpected = 0;
  let wrongScope = 0;
  const compositions = { composed: 0, "fallback-invalid-plan": 0, "fallback-provider-error": 0, interrupted: 0 };
  let composition: keyof typeof compositions | "not-attempted" = "not-attempted";
  let stopped: string | undefined;
  for (const [scenarioIndex, scenario] of cases.entries()) {
    let offset = 0;
    const auth = new DemoMemberAuth(() => Date.now() + offset);
    const mock = new MockTpaBackend(auth);
    const fixture = { gold: DEMO_MEMBERS[0], silver: DEMO_MEMBERS[1], vip: DEMO_MEMBERS[2],
      unverified: undefined }[scenario.member];
    const token = fixture ? auth.verify(auth.identify(fixture.identifier).challengeId, fixture.code)?.sessionToken : undefined;
    if (fixture && !token) throw new Error("FIXTURE_AUTH_FAILED");
    const lookups: ServiceCode[] = [];
    let wrongScopeThisTurn = false;
    const assistant = new CoverageAssistant({
      resolveSession: mock.resolveSession.bind(mock),
      getCoverage(session, service) {
        lookups.push(service);
        if (!fixture || session.memberKey !== fixture.memberKey || session.tenantKey !== fixture.tenantKey) {
          wrongScopeThisTurn = true;
          throw new Error("FIXTURE_SCOPE_MISMATCH");
        }
        return mock.getCoverage(session, service);
      }
    }, new DemoKeywordSelector(), auth, undefined, new ConversationExperiment(provider, {
      maxOutputTokens: responses ? OPENAI_MAX_OUTPUT_TOKENS : undefined,
      unavailableAnswer: responses ? "المساعد مش متاح دلوقتي. جرّب تبعت سؤالك بعد شوية." : undefined,
      onComposition(outcome) {
        composition = outcome;
        compositions[outcome]++;
      }
    }));
    let scenarioPassed = true;
    for (const [index, turn] of scenario.turns.entries()) {
      if (runSignal.aborted || Date.now() >= deadline) {
        stopped = "run-deadline";
        break;
      }
      lookups.length = 0;
      wrongScopeThisTurn = false;
      composition = "not-attempted";
      offset += turn.advanceMs ?? 0;
      const start = performance.now();
      const reply = await assistant.answer(token, turn.question, runSignal, deadline);
      const ms = Math.round(performance.now() - start);
      latencies.push(ms);
      attempts++;
      const lookupOk = turn.lookup === null ? lookups.length === 0 : lookups.length === 1 && lookups[0] === turn.lookup;
      if (turn.lookup !== null) {
        required++;
        if (lookupOk && !wrongScopeThisTurn) correct++;
      }
      if (!lookupOk && lookups.length > 0) wrongOrUnexpected++;
      if (wrongScopeThisTurn) wrongScope++;
      const factsOk = (turn.includes ?? []).every((phrase) => reply.answer.includes(phrase)) &&
        (turn.excludes ?? []).every((phrase) => !reply.answer.includes(phrase));
      const ok = lookupOk && !wrongScopeThisTurn && reply.code === turn.code && factsOk;
      if (ok) passed++;
      scenarioPassed &&= ok;
      // These are server-rendered answers to disclosed fictional questions.
      console.log(JSON.stringify({ event: "turn", scenario: scenario.id, turn: index + 1, ms,
        expectedCode: turn.code, code: reply.code, expectedLookup: turn.lookup, lookups,
        lookupOk, factsOk, wrongScope: wrongScopeThisTurn, composition, ok, answer: reply.answer }));
      if (responses) {
        stopped = responses.summary().stopReason;
        if (!stopped && (wrongOrUnexpected > 0 || wrongScope > 0 ||
            !factsOk && (reply.code === turn.code || reply.code === "COVERAGE_RESULT"))) {
          stopped = "unexpected-read-or-facts";
        }
        if (!stopped && scenarioIndex === 0 && !ok) stopped = "smoke-failed";
        if (stopped) break;
      }
    }
    if (stopped) break;
    if (scenarioPassed) complete++;
  }
  latencies.sort((a, b) => a - b);
  const percentile = (p: number) => latencies[Math.ceil(latencies.length * p) - 1] ?? null;
  const p95Ms = percentile(0.95);
  const latencyGatePassed = !live || p95Ms !== null && p95Ms <= 15_000;
  const compositionFallbacks = compositions["fallback-invalid-plan"] + compositions["fallback-provider-error"];
  const compositionAttempts = compositions.composed + compositionFallbacks + compositions.interrupted;
  console.log(JSON.stringify({ event: "summary", mode, attempts, plannedTurns: turns, passed, complete, plannedScenarios: cases.length,
    required, correct, wrongOrUnexpected, wrongScope, compositionAttempts, compositionFallbacks, compositions,
    p50Ms: percentile(0.5), p95Ms, commercialLatencyGatePassed: live ? latencyGatePassed : undefined, stopped,
    commercial: live ? responses?.summary() : undefined }));
  if (stopped || attempts !== turns || stub && passed !== turns || wrongOrUnexpected || wrongScope || correct < required * 0.9 ||
      complete < cases.length * 0.9 || !latencyGatePassed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  // Never log thrown provider payloads, environment settings, or credentials.
  const publicErrors = ["INVALID_ARGUMENTS", "PAID_EVALUATION_DISABLED", "INVALID_SYNTHETIC_MANIFEST",
    "SYNTHETIC_MANIFEST_NOT_APPROVED"];
  console.error(error instanceof Error && publicErrors.includes(error.message) ? error.message : "EVALUATION_FAILED");
  process.exitCode = 1;
});
