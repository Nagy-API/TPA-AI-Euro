import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isRecord, type ConversationProvider } from "../conversation-provider.ts";
import type { WhatsAppConfig } from "./config.ts";
import { WhatsAppConversation, WHATSAPP_RETRY } from "./conversation.ts";
import { sendWhatsAppText } from "./graph.ts";

const WEBHOOK_PATH = "/webhooks/whatsapp";
const MAX_BYTES = 256 * 1024;
const MAX_AGE_MS = 10 * 60_000;
const MAX_CLOCK_SKEW_MS = 60_000;
const MAX_SEEN_IDS = 2048;
const MAX_PER_SENDER = 8;
const SIGNATURE = /^sha256=([a-f0-9]{64})$/i;
const MESSAGE_ID = /^wamid\.[A-Za-z0-9_+=./-]{1,250}$/;

type Message = Readonly<{ id: string; sender: string; sentAt: number; text: string }>;
type SafeEvent = "TURN_FAILED" | "GRAPH_SEND_FAILED";
type ServerOptions = {
  config: WhatsAppConfig;
  provider: ConversationProvider;
  fetcher?: typeof fetch;
  now?: () => number;
  report?: (event: SafeEvent) => void;
};

function messagesFrom(payload: unknown, config: WhatsAppConfig, now: number): Message[] {
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) return [];
  const messages: Message[] = [];
  for (const entry of payload.entry) {
    if (!isRecord(entry) || entry.id !== config.wabaId || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!isRecord(change) || change.field !== "messages" || !isRecord(change.value)) continue;
      const { value } = change;
      if (value.messaging_product !== "whatsapp" || !isRecord(value.metadata) ||
          value.metadata.phone_number_id !== config.phoneNumberId || !Array.isArray(value.messages)) continue;
      for (const item of value.messages) {
        if (!isRecord(item) || item.type !== "text" || typeof item.from !== "string" ||
            !config.allowedSenders.has(item.from) || typeof item.id !== "string" || !MESSAGE_ID.test(item.id) ||
            typeof item.timestamp !== "string" || !/^[0-9]{10}$/.test(item.timestamp) ||
            !isRecord(item.text) || typeof item.text.body !== "string") continue;
        const sentAt = Number(item.timestamp) * 1000;
        if (sentAt + MAX_AGE_MS <= now || sentAt > now + MAX_CLOCK_SKEW_MS) continue;
        const text = item.text.body.normalize("NFKC").trim().replace(/\s+/gu, " ");
        if (text) messages.push({ id: item.id, sender: item.from, sentAt, text });
      }
    }
  }
  return messages;
}

function respond(res: ServerResponse, status: number, body = "", headers: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store",
    "x-content-type-options": "nosniff", ...headers });
  res.end(body);
}

async function readRawBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BYTES) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, size);
}

export function createWhatsAppServer({ config, provider, fetcher = fetch, now = Date.now, report = () => {} }: ServerOptions) {
  const conversation = new WhatsAppConversation(provider, now);
  const verificationDigest = createHash("sha256").update(config.verifyToken).digest();
  const seen = new Map<string, number>();
  const pending = new Map<string, Message[]>();
  const latest = new Map<string, number>();

  async function drain(sender: string, queue: Message[]): Promise<void> {
    while (queue.length) {
      const message = queue[0];
      try {
        if (message.sentAt + MAX_AGE_MS <= now() || message.sentAt < (latest.get(sender) ?? 0)) continue;
        latest.set(sender, message.sentAt);
        let reply;
        try {
          reply = await conversation.reply(sender, message.text, message.sentAt);
        } catch {
          report("TURN_FAILED");
          reply = { text: WHATSAPP_RETRY };
        }
        if (!reply.sessionSignal?.aborted) {
          try {
            await sendWhatsAppText(config, fetcher, sender, reply.text, reply.sessionSignal);
          } catch {
            report("GRAPH_SEND_FAILED");
          }
        }
      } finally {
        queue.shift();
      }
    }
    pending.delete(sender);
  }

  function accept(messages: Message[], receivedAt: number): boolean {
    for (const [id, expiresAt] of seen) if (expiresAt <= receivedAt) seen.delete(id);
    let allAccepted = true;
    for (const message of messages) {
      if (seen.has(message.id)) continue;
      const queue = pending.get(message.sender);
      if (seen.size >= MAX_SEEN_IDS || (queue?.length ?? 0) >= MAX_PER_SENDER) {
        // Keep admitting other senders. A retry can fill the slots freed by the saturated sender.
        allAccepted = false;
        continue;
      }
      seen.set(message.id, message.sentAt + MAX_AGE_MS);
      if (queue) {
        queue.push(message);
      } else {
        const newQueue = [message];
        pending.set(message.sender, newQueue);
        setImmediate(() => { void drain(message.sender, newQueue); });
      }
    }
    return allAccepted;
  }

  const server = createServer({ requestTimeout: 10_000, headersTimeout: 5000, connectionsCheckingInterval: 1000 },
    async (req, res) => {
      const [path, query] = (req.url ?? "").split(/\?(.*)/su, 2);
      if (path !== WEBHOOK_PATH) return respond(res, 404);
      if (req.method === "GET") {
        const params = new URLSearchParams(query);
        const mode = params.getAll("hub.mode");
        const challenge = params.getAll("hub.challenge");
        const token = params.getAll("hub.verify_token");
        if (mode.length !== 1 || mode[0] !== "subscribe" || challenge.length !== 1 ||
            !/^[0-9]{1,32}$/.test(challenge[0]) || token.length !== 1 ||
            !timingSafeEqual(createHash("sha256").update(token[0]).digest(), verificationDigest)) {
          return respond(res, 403);
        }
        return respond(res, 200, challenge[0]);
      }
      if (req.method !== "POST") return respond(res, 405, "", { allow: "GET, POST" });
      if (query !== undefined) return respond(res, 404);
      const signature = SIGNATURE.exec(req.headers["x-hub-signature-256"]?.toString() ?? "");
      if (!signature) return respond(res, 401, "", { connection: "close" });
      if (Number(req.headers["content-length"]) > MAX_BYTES) return respond(res, 413, "", { connection: "close" });
      try {
        const body = await readRawBody(req);
        if (!body) return respond(res, 413, "", { connection: "close" });
        const expected = createHmac("sha256", config.appSecret).update(body).digest();
        if (!timingSafeEqual(Buffer.from(signature[1], "hex"), expected)) return respond(res, 401);
        const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
        if (!isRecord(value)) return respond(res, 400);
        const receivedAt = now();
        const accepted = accept(messagesFrom(value, config, receivedAt), receivedAt);
        return accepted ? respond(res, 200) : respond(res, 503, "", { "retry-after": "5" });
      } catch {
        if (!res.destroyed && !res.headersSent) respond(res, 400, "", { connection: "close" });
      }
    }
  );
  server.maxConnections = 32;
  return server;
}
