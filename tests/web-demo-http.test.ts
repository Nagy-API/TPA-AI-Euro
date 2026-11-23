import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import { test, type TestContext } from "node:test";
import { CoverageAssistant } from "../src/coverage-assistant.ts";
import { DEMO_MEMBERS } from "../src/demo-auth/fixtures.ts";
import { DemoMemberAuth } from "../src/demo-auth/member-auth.ts";
import { DemoKeywordSelector } from "../src/demo-selector.ts";
import { createDemoServer } from "../src/http-server.ts";
import { MockTpaBackend } from "../src/mock-backend.ts";

const assets = [
  ["/demo", "text/html"],
  ["/demo/style.css", "text/css"],
  ["/demo/chat.js", "text/javascript"]
] as const;

async function start(t: TestContext, enabled = true, verified = true) {
  const memberAuth = verified ? new DemoMemberAuth() : undefined;
  const assistant = new CoverageAssistant(new MockTpaBackend(memberAuth), new DemoKeywordSelector(), memberAuth);
  const server = createDemoServer(assistant, enabled, memberAuth);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { port: address.port, url: `http://127.0.0.1:${address.port}` };
}

test("the local verified demo serves Arabic RTL and same-origin assets with restrictive headers", async (t) => {
  const { url } = await start(t);
  for (const [path, type] of assets) {
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), type + "; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("set-cookie"), null);
    const csp = response.headers.get("content-security-policy") ?? "";
    for (const directive of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "connect-src 'self'",
      "frame-ancestors 'none'", "form-action 'none'", "base-uri 'none'"]) {
      assert.ok(csp.split("; ").includes(directive), directive);
    }
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    const body = await response.text();
    if (path === "/demo") {
      assert.match(body, /<html lang="ar-EG" dir="rtl">/);
      assert.match(body, /Synthetic Data \/ Offline Simulation \/ Not Real AI/);
      for (const { identifier, code } of DEMO_MEMBERS) {
        assert.ok(body.includes(identifier));
        assert.ok(body.includes(code));
      }
      assert.doesNotMatch(body, /(?:src|href)="(?:https?:)?\/\/|<script[^>]*>\s*[^<\s]|\son\w+=/i);
      assert.deepEqual([...body.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]), [
        "/demo/style.css", "/demo/chat.js"
      ]);
    } else if (path.endsWith(".js")) {
      assert.match(body, /text\.textContent = content/);
      assert.doesNotMatch(body, /innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie|console\./);
    }
  }
});

test("all demo assets require enablement, verified mode, and a non-production environment", async (t) => {
  const off = await start(t, false);
  const legacy = await start(t, true, false);
  const production = await start(t);
  const environment = process.env.NODE_ENV;
  t.after(() => {
    if (environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = environment;
  });
  for (const [path] of assets) {
    assert.equal((await fetch(off.url + path)).status, 503);
    assert.equal((await fetch(legacy.url + path)).status, 404);
  }
  process.env.NODE_ENV = "production";
  for (const [path] of assets) assert.equal((await fetch(production.url + path)).status, 503);
});

test("all demo assets reject a non-loopback Host and foreign Origin", async (t) => {
  const { port, url } = await start(t);
  for (const [path] of assets) {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request({ hostname: "127.0.0.1", port, path, headers: { host: "demo.invalid" } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on("error", reject);
      req.end();
    });
    assert.equal(status, 503);
    const foreign = await fetch(url + path, { headers: { origin: "http://demo.invalid" } });
    assert.equal(foreign.status, 403);
    assert.equal(foreign.headers.get("access-control-allow-origin"), null);
    assert.equal((await fetch(url + path, { method: "POST" })).status, 404);
  }
});
