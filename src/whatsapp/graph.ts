import { isRecord, readInferenceJson } from "../conversation-provider.ts";
import type { WhatsAppConfig } from "./config.ts";

export async function sendWhatsAppText(
  config: WhatsAppConfig, fetcher: typeof fetch, to: string, body: string, sessionSignal?: AbortSignal
): Promise<void> {
  if (!config.allowedSenders.has(to) || !body || body.length > 4096) throw new Error("INVALID_WHATSAPP_REPLY");
  const timeout = AbortSignal.timeout(5000);
  const signal = sessionSignal ? AbortSignal.any([sessionSignal, timeout]) : timeout;
  signal.throwIfAborted();
  const response = await fetcher(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`, {
    method: "POST", redirect: "error", signal,
    headers: { authorization: "Bearer " + config.accessToken, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body }
    })
  });
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    throw new Error("GRAPH_SEND_FAILED");
  }
  const result = await readInferenceJson(response, signal);
  if (!isRecord(result) || !Array.isArray(result.messages) ||
      !isRecord(result.messages[0]) || typeof result.messages[0].id !== "string" ||
      !/^wamid\.[A-Za-z0-9_+=./-]+$/.test(result.messages[0].id)) {
    throw new Error("GRAPH_SEND_FAILED");
  }
}
