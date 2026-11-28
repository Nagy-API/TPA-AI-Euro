export type InferenceMessage = Readonly<{ role: "system" | "user" | "assistant"; content: string }>;
export type ObjectSchema = Readonly<{
  type: "object";
  properties: Record<string, object>;
  required: readonly string[];
  additionalProperties: false;
}>;
export type InferenceRequest = Readonly<{
  messages: readonly InferenceMessage[];
  schema: ObjectSchema;
  timeoutMs: number;
  maxOutputTokens: number;
}>;

/** Transport boundary. TPA validates the returned value before using it. */
export interface ConversationProvider {
  infer(request: InferenceRequest, signal: AbortSignal): Promise<unknown>;
}

export class InferenceDeadlineError extends Error {}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readInferenceJson(response: Response, signal?: AbortSignal | null): Promise<unknown> {
  if (!response.body) throw new Error("INVALID_INFERENCE_RESPONSE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64 * 1024) throw new Error("INFERENCE_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  signal?.throwIfAborted();
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))) as unknown;
}

const HUB_URL = "http://127.0.0.1:8000/v1/inference";
const LOCAL_PROFILES = ["local-instruct", "local-general"];

export class HubConversationProvider implements ConversationProvider {
  private readonly profile: string;
  private readonly fetcher: typeof fetch;

  constructor(profile = "local-instruct", fetcher: typeof fetch = fetch) {
    if (!LOCAL_PROFILES.includes(profile)) throw new Error("HUB_PROFILE_NOT_LOCAL");
    this.profile = profile;
    this.fetcher = fetcher;
  }

  async infer({ messages, schema, timeoutMs, maxOutputTokens }: InferenceRequest, signal: AbortSignal): Promise<unknown> {
    try {
      signal.throwIfAborted();
      const response = await this.fetcher(HUB_URL, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        redirect: "error",
        signal,
        body: JSON.stringify({ profile: this.profile, messages, timeoutMs, maxOutputTokens, thinking: "off",
          output: { kind: "json", schema } })
      });
      const value = await readInferenceJson(response, signal);
      if (!response.ok) {
        if (response.status === 504 && isRecord(value) && isRecord(value.error) && value.error.code === "DEADLINE_EXCEEDED") {
          throw new InferenceDeadlineError();
        }
        throw new Error("HUB_UNAVAILABLE");
      }
      if (!isRecord(value) || value.profile !== this.profile || !isRecord(value.output) ||
          value.output.kind !== "json" || Object.keys(value.output).length !== 2 || !Object.hasOwn(value.output, "value")) {
        throw new Error("HUB_INVALID_RESPONSE");
      }
      return value.output.value;
    } catch (error) {
      if (error instanceof InferenceDeadlineError) throw error;
      throw new Error("HUB_UNAVAILABLE");
    }
  }
}
