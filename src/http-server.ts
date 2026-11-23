import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { CoverageAssistant } from "./coverage-assistant.ts";
import type { DemoMemberAuth } from "./demo-auth/member-auth.ts";

const MAX_BYTES = 2048;
const CHALLENGES_PATH = "/v1/member-auth/challenges";
const VERIFY_PATH = /^\/v1\/member-auth\/challenges\/([A-Za-z0-9_-]{43})\/verify$/;
const LOGOUT_PATH = "/v1/member-auth/logout";
const LOOPBACK_HOST = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::[0-9]{1,5})?$/i;
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

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
export function createDemoServer(assistant: CoverageAssistant, demoEnabled: boolean, memberAuth?: DemoMemberAuth) {
  return createServer(async (req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      writeJson(res, 200, { status: "ok", mode: "demo", productionReady: false });
      return;
    }
    const chat = req.url === "/v1/chat";
    const identify = req.url === CHALLENGES_PATH;
    const verify = VERIFY_PATH.exec(req.url ?? "");
    const logout = req.url === LOGOUT_PATH;
    if (req.method !== "POST" || !(chat || (memberAuth && (identify || verify || logout)))) {
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
    const header = req.headers["x-demo-session"];
    const token = typeof header === "string" ? header : undefined;
    if (memberAuth && logout) {
      if (token) memberAuth.revokeSession(token);
      writeJson(res, 200, { sessionRevoked: true });
      return;
    }
    try {
      const json = await readBody(req);
      if (memberAuth && identify) {
        writeJson(res, 202, memberAuth.identify(json.memberIdentifier));
        return;
      }
      if (memberAuth && verify) {
        const session = memberAuth.verify(verify[1], json.oneTimeCode);
        writeJson(res, session ? 200 : 401, session ?? { error: "VERIFICATION_FAILED" });
        return;
      }
      const reply = await assistant.answer(token, json.message);
      writeJson(res, reply.status, { code: reply.code, answer: reply.answer });
    } catch {
      writeJson(res, 400, { error: "INVALID_JSON_OR_TOO_LARGE" });
    }
  });
}
