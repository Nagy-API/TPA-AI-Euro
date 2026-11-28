import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { CHAT_TIMEOUT, type CoverageAssistant } from "./coverage-assistant.ts";
import type { DemoMemberAuth } from "./demo-auth/member-auth.ts";
import { CHAT_REQUEST_TIMEOUT_MS } from "./contracts.ts";

const MAX_BYTES = 2048;
const CHAT_BROWSER_GRACE_MS = 5_000;
const CHALLENGES_PATH = "/v1/member-auth/challenges";
const VERIFY_PATH = /^\/v1\/member-auth\/challenges\/([A-Za-z0-9_-]{43})\/verify$/;
const LOGOUT_PATH = "/v1/member-auth/logout";
const LOOPBACK_HOST = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::[0-9]{1,5})?$/i;
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const DEMO_PAGE = readFileSync(new URL("./web-demo/index.html", import.meta.url), "utf8");
const DEMO_ASSETS = new Map<string, { type: string; body: Buffer }>(([
  ["/demo/style.css", "style.css", "text/css"],
  ["/demo/chat.js", "chat.js", "text/javascript"]
] as const).map(([path, file, type]) => [
  path, { type, body: readFileSync(new URL(`./web-demo/${file}`, import.meta.url)) }
] as const));

type DemoDisplayMode = boolean | "hub" | "ollama-v05";

function demoPage(mode: DemoDisplayMode, chatTimeoutMs: number) {
  const experimental = mode === "hub" || mode === "ollama-v05";
  const label = experimental ? `Synthetic Data / ${mode === "hub" ? "Local AI Hub" : "Local Ollama"} / V0.5` :
    mode ? "Synthetic Data / Local Ollama" : "Synthetic Data / Offline Simulation / Not Real AI";
  const description = experimental ? "محادثة بموديل محلي وتغطية من بيانات وثائق تجريبية. استخدم بيانات وهمية فقط." : mode
    ? "اختيار الخدمة بموديل محلي. استخدم بيانات اختبار وهمية فقط."
    : "محاكاة بدون اتصال خارجي. استخدم بيانات اختبار وهمية فقط.";
  return {
    type: "text/html",
    body: Buffer.from(DEMO_PAGE.replace("{{demo-mode-label}}", label)
      .replace("{{demo-mode-description}}", description)
      .replace("{{chat-timeout-ms}}", String(chatTimeoutMs + CHAT_BROWSER_GRACE_MS)))
  };
}

function writeDemoAsset(res: ServerResponse, asset: { type: string; body: Buffer }): void {
  res.writeHead(200, {
    "content-type": `${asset.type}; charset=utf-8`,
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer"
  });
  res.end(asset.body);
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > MAX_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  const json: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (typeof json !== "object" || json === null || Array.isArray(json)) return {};
  return json as Record<string, unknown>;
}

function isLocalRequest(req: IncomingMessage): boolean {
  return LOOPBACK_ADDRESSES.has(req.socket.remoteAddress ?? "") &&
    LOOPBACK_ADDRESSES.has(req.socket.localAddress ?? "") &&
    LOOPBACK_HOST.test(req.headers.host ?? "");
}

/** Both the verified and compatibility demos require explicit enablement and loopback HTTP. */
export function createDemoServer(
  assistant: CoverageAssistant, demoEnabled: boolean, memberAuth?: DemoMemberAuth,
  displayMode: DemoDisplayMode = false, chatTimeoutMs = CHAT_REQUEST_TIMEOUT_MS
) {
  const page = demoPage(displayMode, chatTimeoutMs);
  return createServer(async (req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      writeJson(res, 200, { status: "ok", mode: "demo", productionReady: false });
      return;
    }
    const chat = req.url === "/v1/chat";
    const identify = req.url === CHALLENGES_PATH;
    const verify = VERIFY_PATH.exec(req.url ?? "");
    const logout = req.url === LOGOUT_PATH;
    const asset = req.method === "GET" && memberAuth
      ? req.url === "/demo" ? page : DEMO_ASSETS.get(req.url ?? "")
      : undefined;
    const api = req.method === "POST" && (chat || (memberAuth && (identify || verify || logout)));
    if (!asset && !api) {
      writeJson(res, 404, { error: "NOT_FOUND" });
      return;
    }
    if (!demoEnabled || process.env.NODE_ENV === "production" || !isLocalRequest(req)) {
      writeJson(res, 503, { error: "DEMO_DISABLED" });
      return;
    }
    const origin = req.headers.origin;
    if (memberAuth && origin !== undefined && origin !== "http://" + req.headers.host?.toLowerCase()) {
      writeJson(res, 403, { error: "ORIGIN_NOT_ALLOWED" });
      return;
    }
    if (asset) {
      writeDemoAsset(res, asset);
      return;
    }
    const header = req.headers["x-demo-session"];
    const token = typeof header === "string" ? header : undefined;
    if (memberAuth && logout) {
      if (token) memberAuth.revokeSession(token);
      writeJson(res, 200, { sessionRevoked: true });
      return;
    }
    const controller = chat ? new AbortController() : undefined;
    const requestDeadline = chat ? Date.now() + chatTimeoutMs : undefined;
    const deadline = controller && setTimeout(() => {
      controller.abort();
      if (!res.destroyed && !res.writableEnded) {
        writeJson(res, CHAT_TIMEOUT.status, { code: CHAT_TIMEOUT.code, answer: CHAT_TIMEOUT.answer });
      }
    }, chatTimeoutMs);
    function onClose() {
      controller?.abort();
      clearTimeout(deadline);
    }
    if (controller) res.once("close", onClose);

    try {
      const json = await readBody(req);
      if (controller?.signal.aborted || res.destroyed) return;
      if (memberAuth && identify) {
        writeJson(res, 202, memberAuth.identify(json.memberIdentifier));
        return;
      }
      if (memberAuth && verify) {
        const session = memberAuth.verify(verify[1], json.oneTimeCode);
        writeJson(res, session ? 200 : 401, session ?? { error: "VERIFICATION_FAILED" });
        return;
      }
      const reply = await assistant.answer(token, json.message, controller?.signal, requestDeadline);
      if (controller?.signal.aborted || res.destroyed) return;
      writeJson(res, reply.status, { code: reply.code, answer: reply.answer });
    } catch {
      if (!res.destroyed && !res.writableEnded) writeJson(res, 400, { error: "INVALID_JSON_OR_TOO_LARGE" });
    } finally {
      clearTimeout(deadline);
      res.off("close", onClose);
    }
  });
}
