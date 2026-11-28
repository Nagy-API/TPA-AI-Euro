import {
  InferenceDeadlineError, isRecord, readInferenceJson,
  type ConversationProvider, type InferenceRequest
} from "./conversation-provider.ts";

export const OPENAI_MODEL = "gpt-6.2-sol";
export const OPENAI_MAX_OUTPUT_TOKENS = 1024;
export const OPENAI_MAX_INPUT_TOKENS = 6144;
export const OPENAI_MAX_REQUESTS = 240;
export const OPENAI_MAX_USD = 5;

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const STAGES = ["interpret", "ground", "compose"] as const;
const NANOS_PER_DOLLAR = 1_000_000_000;
// USD per million tokens on 2026-11-28, represented as nanos per token.
const PRICE = { input: 2000, cached: 100, write30m: 2500, write12h: 5000, output: 10_000 };

type Usage = Readonly<{ input: number; cached: number; output: number; reasoning: number; cost: number }>;
type Attempt = Readonly<{
  stage: NonNullable<InferenceRequest["stage"]>;
  latencyMs: number;
  outcome: "completed" | "failed" | "incomplete" | "aborted";
  usage?: Usage;
  reservedUsd: number;
}>;

type Options = Readonly<{
  fetcher?: typeof fetch;
  maxRequests?: number;
  maxUsd?: number;
  onAttempt?: (event: Attempt) => void;
}>;

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseUsage(value: unknown): Usage | undefined {
  if (!isRecord(value) || !nonnegativeInteger(value.input_tokens) || !nonnegativeInteger(value.output_tokens) ||
      !isRecord(value.input_tokens_details) || !isRecord(value.output_tokens_details)) return;
  const input = value.input_tokens;
  const output = value.output_tokens;
  const inputDetails = value.input_tokens_details;
  const cached = inputDetails.cached_tokens;
  const reasoning = value.output_tokens_details.reasoning_tokens;
  if (!nonnegativeInteger(cached) || !nonnegativeInteger(reasoning) || cached > input || reasoning > output) return;

  // Missing write breakdown is billed conservatively at the highest documented input rate.
  const writes = inputDetails.cache_write_tokens;
  const writeDetails = inputDetails.cache_write_tokens_details;
  let inputCost = (input - cached) * PRICE.write12h + cached * PRICE.cached;
  if (nonnegativeInteger(writes) && writes <= input - cached) {
    const short = isRecord(writeDetails) ? writeDetails.ttl_30m_tokens : undefined;
    const long = isRecord(writeDetails) ? writeDetails.ttl_12h_tokens : undefined;
    const shortWrites = nonnegativeInteger(short) && nonnegativeInteger(long) && short + long === writes ? short : 0;
    inputCost = (input - cached - writes) * PRICE.input + cached * PRICE.cached +
      shortWrites * PRICE.write30m + (writes - shortWrites) * PRICE.write12h;
  }
  return { input, cached, output, reasoning, cost: inputCost + output * PRICE.output };
}

function outputValue(response: Record<string, unknown>): unknown {
  if (response.status !== "completed" || response.error != null || response.incomplete_details != null ||
      !Array.isArray(response.output) || response.output.some((item) =>
        !isRecord(item) || (item.type !== "reasoning" && item.type !== "message"))) {
    throw new Error("OPENAI_INVALID_OUTPUT");
  }
  const messages = response.output.filter((item) => item.type === "message");
  if (messages.length !== 1) throw new Error("OPENAI_INVALID_OUTPUT");
  const message = messages[0];
  if (message.role !== "assistant" || message.status !== "completed" || !Array.isArray(message.content) ||
      message.content.length !== 1) throw new Error("OPENAI_INVALID_OUTPUT");
  const content = message.content[0];
  if (!isRecord(content) || content.type !== "output_text" || typeof content.text !== "string") {
    throw new Error("OPENAI_INVALID_OUTPUT");
  }
  try {
    return JSON.parse(content.text) as unknown;
  } catch {
    throw new Error("OPENAI_INVALID_OUTPUT");
  }
}

// The conversation protocol uses a strict object with string and array fields.
function matchesSchema(value: unknown, schema: object): boolean {
  if (!isRecord(schema)) return false;
  if (schema.type === "string") {
    return typeof value === "string" && (!Array.isArray(schema.enum) || schema.enum.includes(value)) &&
      (typeof schema.maxLength !== "number" || value.length <= schema.maxLength);
  }
  if (schema.type === "array") {
    const { items } = schema;
    return Array.isArray(value) && isRecord(items) &&
      (typeof schema.minItems !== "number" || value.length >= schema.minItems) &&
      (typeof schema.maxItems !== "number" || value.length <= schema.maxItems) &&
      value.every((item) => matchesSchema(item, items));
  }
  const { properties, required } = schema;
  return schema.type === "object" && schema.additionalProperties === false && isRecord(value) &&
    isRecord(properties) && Array.isArray(required) && Object.keys(value).length === required.length &&
    required.every((key) => typeof key === "string" && Object.hasOwn(value, key) && Object.hasOwn(properties, key) &&
      isRecord(properties[key]) && matchesSchema(value[key], properties[key]));
}

/** A run-scoped transport. Only the synthetic evaluator constructs it with real fetch. */
export class OpenAIResponsesProvider implements ConversationProvider {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly maxRequests: number;
  private readonly maxCost: number;
  private readonly onAttempt?: Options["onAttempt"];
  private requests = 0;
  private estimatedCost = 0;
  private inputTokens = 0;
  private cachedTokens = 0;
  private outputTokens = 0;
  private reasoningTokens = 0;
  private stopReason?: string;

  constructor(apiKey: string, options: Options = {}) {
    const maxRequests = options.maxRequests ?? OPENAI_MAX_REQUESTS;
    const maxUsd = options.maxUsd ?? OPENAI_MAX_USD;
    if (!/^[!-~]+$/.test(apiKey) || !Number.isInteger(maxRequests) || maxRequests < 1 ||
        maxRequests > OPENAI_MAX_REQUESTS || !Number.isFinite(maxUsd) || maxUsd <= 0 || maxUsd > OPENAI_MAX_USD) {
      throw new Error("OPENAI_INVALID_CONFIGURATION");
    }
    this.apiKey = apiKey;
    this.fetcher = options.fetcher ?? fetch;
    this.maxRequests = maxRequests;
    this.maxCost = Math.floor(maxUsd * NANOS_PER_DOLLAR);
    this.onAttempt = options.onAttempt;
  }

  summary() {
    return { model: OPENAI_MODEL, requests: this.requests, estimatedUsd: this.estimatedCost / NANOS_PER_DOLLAR,
      inputTokens: this.inputTokens, cachedTokens: this.cachedTokens, outputTokens: this.outputTokens,
      reasoningTokens: this.reasoningTokens, stopReason: this.stopReason };
  }

  async infer({ stage, messages, schema, timeoutMs, maxOutputTokens }: InferenceRequest, signal: AbortSignal): Promise<unknown> {
    signal.throwIfAborted();
    const [system, ...input] = messages;
    if (!stage || !STAGES.includes(stage) || system?.role !== "system" || input.length < 1 || input.length > 7 ||
        input.at(-1)?.role !== "user" || input.some(({ role }) => role !== "user" && role !== "assistant") ||
        !Number.isInteger(timeoutMs) || timeoutMs < 1 || !Number.isInteger(maxOutputTokens) ||
        maxOutputTokens < 1 || maxOutputTokens > OPENAI_MAX_OUTPUT_TOKENS) throw new Error("OPENAI_INVALID_REQUEST");
    const format = { type: "json_schema", name: "tpa_" + stage, strict: true, schema };
    const instructions = system.content;
    // Bound locally using UTF-8 bytes plus an allowance for provider message framing.
    const inputReservation = Buffer.byteLength(JSON.stringify({ instructions, input, format })) + 256;
    if (inputReservation > OPENAI_MAX_INPUT_TOKENS) throw new Error("OPENAI_INPUT_BUDGET_EXCEEDED");
    const reserved = inputReservation * PRICE.write12h + maxOutputTokens * PRICE.output;
    if (this.stopReason || this.requests >= this.maxRequests || this.estimatedCost + reserved > this.maxCost) {
      this.stopReason ??= "budget";
      throw new Error("OPENAI_BUDGET_EXHAUSTED");
    }

    const started = performance.now();
    const timeout = AbortSignal.timeout(Math.min(timeoutMs, 20_000));
    const requestSignal = AbortSignal.any([signal, timeout]);
    this.requests++;
    this.estimatedCost += reserved;
    let outcome: Attempt["outcome"] = "failed";
    let usage: Usage | undefined;
    try {
      let response: unknown;
      try {
        const http = await this.fetcher(RESPONSES_URL, {
          method: "POST", redirect: "error", signal: requestSignal,
          headers: { "authorization": "Bearer " + this.apiKey, "content-type": "application/json" },
          body: JSON.stringify({ model: OPENAI_MODEL, reasoning: { effort: "medium" }, service_tier: "default",
            instructions, input, text: { format }, max_output_tokens: maxOutputTokens,
            store: false, background: false, stream: false, tools: [] })
        });
        if (!http.ok) {
          void http.body?.cancel().catch(() => {});
          throw new Error("OPENAI_HTTP_ERROR");
        }
        response = await readInferenceJson(http, requestSignal);
      } catch {
        if (requestSignal.aborted) {
          outcome = "aborted";
          if (timeout.aborted && !signal.aborted) throw new InferenceDeadlineError();
          throw new Error("OPENAI_ABORTED");
        }
        throw new Error("OPENAI_TRANSPORT_ERROR");
      }
      if (!isRecord(response)) throw new Error("OPENAI_INVALID_OUTPUT");
      if (response.model !== OPENAI_MODEL || response.service_tier !== "default") {
        this.stopReason = "model-or-tier";
        throw new Error("OPENAI_UNEXPECTED_MODEL_OR_TIER");
      }
      const reported = response.usage;
      usage = parseUsage(reported);
      if (isRecord(reported) && (
        nonnegativeInteger(reported.input_tokens) && reported.input_tokens > inputReservation ||
        nonnegativeInteger(reported.output_tokens) && reported.output_tokens > maxOutputTokens
      )) {
        this.stopReason = "usage-over-reservation";
        throw new Error("OPENAI_UNEXPECTED_USAGE");
      }
      if (reported != null && !usage) {
        this.stopReason = "invalid-usage";
        throw new Error("OPENAI_UNEXPECTED_USAGE");
      }
      if (response.status === "incomplete") {
        outcome = "incomplete";
        if (isRecord(response.incomplete_details) && response.incomplete_details.reason === "max_output_tokens") {
          this.stopReason = "output-limit";
        }
        throw new Error("OPENAI_INCOMPLETE");
      }
      const value = outputValue(response);
      if (!matchesSchema(value, schema)) throw new Error("OPENAI_INVALID_OUTPUT");
      outcome = "completed";
      return value;
    } finally {
      if (usage) {
        this.inputTokens += usage.input;
        this.cachedTokens += usage.cached;
        this.outputTokens += usage.output;
        this.reasoningTokens += usage.reasoning;
        this.estimatedCost += usage.cost - reserved;
      }
      this.onAttempt?.({ stage, latencyMs: Math.round(performance.now() - started), outcome, usage,
        reservedUsd: reserved / NANOS_PER_DOLLAR });
    }
  }
}
