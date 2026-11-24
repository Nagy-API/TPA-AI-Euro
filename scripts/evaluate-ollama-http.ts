import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import { isServiceCode, type ServiceCode } from "../src/contracts.ts";
import { DemoMemberAuth } from "../src/demo-auth/member-auth.ts";
import { createDemoServer } from "../src/http-server.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";
import { OllamaCoverageIntentSelector } from "../src/ollama-selector.ts";

type Case = {
  id: string;
  question: string;
  expected: ServiceCode | "CLARIFICATION_NEEDED" | "VERIFICATION_REQUIRED";
  prior?: ServiceCode;
  expireTopic?: boolean;
  noModel?: boolean;
};

const dataset = process.argv[2];
const model = process.env.OLLAMA_MODEL;
if (!dataset || !["review", "holdout", "grounding-holdout"].includes(dataset) || process.env.DEMO_INTENT_MODE !== "ollama" || !model) {
  console.error("Set DEMO_INTENT_MODE=ollama and OLLAMA_MODEL, then run npm run eval:ollama:http -- review|holdout|grounding-holdout");
  process.exit(2);
}
const cases = JSON.parse(readFileSync(new URL(`../evals/ollama-${dataset}-cases.json`, import.meta.url), "utf8")) as Case[];
assert.ok(cases.length > 0);

function newTrace() {
  return { modelChecks: 0, eligibility: 0, toolRequests: 0, proposals: [] as string[], lookups: [] as ServiceCode[] };
}
let trace = newTrace();

const selector = new OllamaCoverageIntentSelector(model, async (url, init) => {
  const observed = trace;
  if (String(url).endsWith("/api/tags")) {
    observed.modelChecks++;
    return fetch(url, init);
  }
  const body = JSON.parse(String(init?.body)) as { tools?: unknown };
  if (body.tools) observed.toolRequests++;
  else observed.eligibility++;
  const response = await fetch(url, init);
  if (response.ok) {
    // Only count proposals and allowlisted codes. Keep prompts and provider text out of the report.
    const payload = await response.clone().json().catch(() => null) as {
      message?: { tool_calls?: { function?: { name?: string; arguments?: { serviceCode?: string } } }[] }
    } | null;
    if (Array.isArray(payload?.message?.tool_calls)) {
      for (const proposal of payload.message.tool_calls) {
        const fn = proposal?.function;
        const code = fn?.arguments?.serviceCode;
        observed.proposals.push(fn?.name === "get_member_coverage" && typeof code === "string" &&
          isServiceCode(code) && Object.keys(fn.arguments ?? {}).length === 1 ? code : "INVALID");
      }
    }
  }
  return response;
});

let clockOffset = 0;
const auth = new DemoMemberAuth(() => Date.now() + clockOffset);
const backend = new MockTpaBackend(auth);
const assistant = new CoverageAssistant({
  resolveSession: backend.resolveSession.bind(backend),
  getCoverage(session, code) {
    trace.lookups.push(code);
    return backend.getCoverage(session, code);
  }
}, selector, auth);
const server = createDemoServer(assistant, true, auth, true);
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = "http://127.0.0.1:" + address.port;

async function post(path: string, body: unknown, session?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (session) headers["x-demo-session"] = session;
  const response = await fetch(base + path, {
    method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(35_000)
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

async function verify() {
  clockOffset += 301_000;
  const identified = await post("/v1/member-auth/challenges", { memberIdentifier: "M-DEMO-001" });
  assert.equal(identified.status, 202);
  const { challengeId } = identified.body;
  assert.ok(typeof challengeId === "string");
  const verified = await post(`/v1/member-auth/challenges/${challengeId}/verify`, { oneTimeCode: "135790" });
  assert.equal(verified.status, 200);
  const { sessionToken } = verified.body;
  assert.ok(typeof sessionToken === "string");
  return sessionToken;
}

let passed = 0;
let correctCoverage = 0;
let coverageCases = 0;
let deniedCases = 0;
let deniedWithLookups = 0;
let wrongServiceLookups = 0;
let unauthorizedLookups = 0;
let clarificationFalseNegatives = 0;
const provider = { modelChecks: 0, eligibility: 0, toolRequests: 0, proposals: 0 };
const timings: number[] = [];
try {
  for (const item of cases) {
    const token = item.expected === "VERIFICATION_REQUIRED" ? undefined : await verify();
    if (item.prior) {
      trace = newTrace();
      const seed = await post("/v1/chat", { message: `Is ${item.prior} covered?` }, token);
      assert.equal(seed.body.code, "COVERAGE_RESULT", `${item.id} topic setup failed`);
      assert.deepEqual(trace.lookups, [item.prior]);
      if (item.expireTopic) clockOffset += 120_001;
    }
    trace = newTrace();
    const started = performance.now();
    const reply = await post("/v1/chat", { message: item.question }, token);
    const elapsedMs = Math.round(performance.now() - started);
    timings.push(elapsedMs);
    const expectedService = isServiceCode(item.expected) ? item.expected : undefined;
    const expectedCode = expectedService ? "COVERAGE_RESULT" : item.expected;
    const expectedStatus = item.expected === "VERIFICATION_REQUIRED" ? 401 : 200;
    const lookupMatches = expectedService
      ? trace.lookups.length === 1 && trace.lookups[0] === expectedService
      : trace.lookups.length === 0;
    const matches = reply.status === expectedStatus && reply.body.code === expectedCode && lookupMatches &&
      (!item.noModel || trace.modelChecks === 0 && trace.eligibility === 0 && trace.toolRequests === 0);
    if (matches) passed++;
    provider.modelChecks += trace.modelChecks;
    provider.eligibility += trace.eligibility;
    provider.toolRequests += trace.toolRequests;
    provider.proposals += trace.proposals.length;
    if (expectedService) {
      coverageCases++;
      if (matches) correctCoverage++;
      if (reply.body.code === "CLARIFICATION_NEEDED" && trace.lookups.length === 0) clarificationFalseNegatives++;
    } else {
      deniedCases++;
      if (trace.lookups.length) deniedWithLookups++;
    }
    wrongServiceLookups += trace.lookups.filter((code) => code !== expectedService).length;
    if (item.expected === "VERIFICATION_REQUIRED") unauthorizedLookups += trace.lookups.length;
    console.log(JSON.stringify({ id: item.id, expected: item.expected, passed: matches,
      status: reply.status, code: reply.body.code, ...trace, elapsedMs }));
  }
  timings.sort((a, b) => a - b);
  const rank = (percentile: number) => timings[Math.ceil(timings.length * percentile) - 1];
  console.log(JSON.stringify({ dataset, total: cases.length, passed, coverageCases, correctCoverage, deniedCases,
    deniedWithLookups, wrongServiceLookups, unauthorizedLookups, clarificationFalseNegatives, provider,
    minMs: timings[0], p50Ms: rank(0.5), p95Ms: rank(0.95), maxMs: timings.at(-1) }));
  if (passed !== cases.length) process.exitCode = 1;
} finally {
  server.closeAllConnections();
  server.close();
}
