import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const ENTRYPOINT = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const NODE_ARGS = ["--experimental-strip-types", ENTRYPOINT];

function demoEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PORT: "0",
    NODE_ENV: "test",
    ENABLE_DEMO_AUTH: "true",
    DEMO_INTENT_MODE: "fixture",
    DEMO_AUTH_MODE: undefined
  };
}

async function startEntrypoint(t: TestContext, env = demoEnv()) {
  const child = spawn(process.execPath, NODE_ARGS, { env, stdio: ["ignore", "pipe", "ignore"] });
  const closed = once(child, "close");
  t.after(async () => {
    child.kill();
    await closed;
  });
  const output = await Promise.race([
    once(child.stdout, "data").then(([chunk]) => String(chunk)),
    closed.then(([code]) => { throw new Error("Demo server exited early with code " + code); })
  ]);
  const baseUrl = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  assert.ok(baseUrl);
  return baseUrl;
}

function post(baseUrl: string, path: string, body: unknown, token?: string) {
  return fetch(baseUrl + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { "x-demo-session": token } : {}) },
    body: JSON.stringify(body)
  });
}

test("entrypoint defaults to verification and listens on loopback", { timeout: 10_000 }, async (t) => {
  const baseUrl = await startEntrypoint(t);
  const question = { message: "Is MRI covered?" };
  const chat = await post(baseUrl, "/v1/chat", question, "demo-gold-session");
  assert.equal(chat.status, 401);

  const path = "/v1/member-auth/challenges";
  const challenge = await post(baseUrl, path, { memberIdentifier: "M-DEMO-001" });
  assert.equal(challenge.status, 202);
  const { challengeId } = await challenge.json() as { challengeId: string };
  const verification = await post(baseUrl, path + "/" + challengeId + "/verify", { oneTimeCode: "135790" });
  assert.equal(verification.status, 200);
  const { sessionToken } = await verification.json() as { sessionToken: string };
  const coverage = await post(baseUrl, "/v1/chat", question, sessionToken);
  assert.equal(coverage.status, 200);
  assert.match((await coverage.json() as { answer: string }).answer, /20%/);
  const followUp = await post(baseUrl, "/v1/chat", { message: "وطب نسبة التحمل كام؟" }, sessionToken);
  assert.equal(followUp.status, 200);
  assert.match((await followUp.json() as { answer: string }).answer, /20%/);
});

test("explicit legacy mode keeps fixed-token coverage without enabling challenge routes", { timeout: 10_000 }, async (t) => {
  const baseUrl = await startEntrypoint(t, { ...demoEnv(), DEMO_AUTH_MODE: "legacy" });
  const coverage = await post(baseUrl, "/v1/chat", { message: "Is MRI covered?" }, "demo-gold-session");
  assert.equal(coverage.status, 200);
  assert.match((await coverage.json() as { answer: string }).answer, /20%/);
  const followUp = await post(baseUrl, "/v1/chat", { message: "What is the copay?" }, "demo-gold-session");
  assert.equal((await followUp.json() as { code: string }).code, "CLARIFICATION_NEEDED");
  const identify = await post(baseUrl, "/v1/member-auth/challenges", { memberIdentifier: "M-DEMO-001" });
  assert.equal(identify.status, 404);
});

test("entrypoint refuses production and non-offline verified mode before startup", () => {
  for (const [settings, expected] of [
    [{ NODE_ENV: "production" }, /Refusing to start/],
    [{ DEMO_INTENT_MODE: "claude" }, /VERIFIED_DEMO_REQUIRES_OFFLINE_SELECTOR/]
  ] as const) {
    const result = spawnSync(process.execPath, NODE_ARGS, {
      env: { ...demoEnv(), ...settings },
      encoding: "utf8",
      timeout: 5000
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, expected);
  }
});
