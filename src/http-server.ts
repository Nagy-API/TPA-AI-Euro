import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { CoverageAssistant } from "./coverage-assistant.ts";

const MAX_BYTES = 2048;
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(body));
}
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > MAX_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
/** The fixture-session HTTP boundary is enabled ONLY in explicit local demo mode. */
export function createDemoServer(assistant: CoverageAssistant, demoEnabled: boolean) {
  return createServer(async (req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      writeJson(res, 200, { status: "ok", mode: "demo", productionReady: false });
      return;
    }
    if (req.url !== "/v1/chat" || req.method !== "POST") {
      writeJson(res, 404, { error: "NOT_FOUND" });
      return;
    }
    if (!demoEnabled) {
      writeJson(res, 503, { error: "DEMO_DISABLED" });
      return;
    }
    try {
      const json = await readBody(req);
      const text = typeof json === "object" && json !== null && "message" in json ? json.message : undefined;
      const token = req.headers["x-demo-session"];
      const reply = await assistant.answer(typeof token === "string" ? token : undefined, text);
      writeJson(res, reply.status, { code: reply.code, answer: reply.answer });
    } catch {
      writeJson(res, 400, { error: "INVALID_JSON_OR_TOO_LARGE" });
    }
  });
}
