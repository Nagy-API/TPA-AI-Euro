import { OPENAI_MODEL } from "../src/openai-responses-provider.ts";

const interpretations = new Map([
  ["هل الرنين المغناطيسي مغطى؟", ["COVERAGE_LOOKUP", "MRI", "OVERVIEW"]],
  ["الأشعة السينية مغطاة عندي؟", ["COVERAGE_LOOKUP", "XRAY", "OVERVIEW"]],
  ["صورة الدم الكاملة", ["COVERAGE_LOOKUP", "CBC", "OVERVIEW"]],
  ["وطب نسبة التحمل كام؟", ["FOLLOW_UP", "NONE", "COPAY"]],
  ["طب فاضل لي كام في الحد؟", ["FOLLOW_UP", "NONE", "LIMIT"]],
  ["ينفع أعمله على طول ولا لازم تصريح الأول؟", ["FOLLOW_UP", "NONE", "PREAPPROVAL"]],
  ["يعني إيه نسبة تحمل؟", ["FAQ", "COPAY", "OVERVIEW"]]
]);

const evidence = new Map([
  ["هل الرنين المغناطيسي مغطى؟", ["MRI", "الرنين المغناطيسي"]],
  ["الأشعة السينية مغطاة عندي؟", ["XRAY", "الأشعة السينية"]],
  ["صورة الدم الكاملة", ["CBC", "صورة الدم الكاملة"]],
  ["طب فاضل لي كام في الحد؟", ["LIMIT", "فاضل لي كام في الحد"]],
  ["ينفع أعمله على طول ولا لازم تصريح الأول؟", ["PREAPPROVAL", "لازم تصريح الأول"]]
]);

/** Scripted Responses wire data for the disclosed corpus. This transport has no network path. */
export const v06ResponsesStub: typeof fetch = async (_url, init) => {
  init?.signal?.throwIfAborted();
  const request = JSON.parse(String(init?.body)) as {
    instructions: string;
    input: { content: string }[];
    text: { format: { name: string } };
  };
  const input = request.input.at(-1)?.content ?? "";
  let value: object;
  switch (request.text.format.name) {
    case "tpa_interpret": {
      const interpretation = interpretations.get(input);
      if (!interpretation) throw new Error("UNSCRIPTED_INTERPRETATION");
      const [intent, subject, focus] = interpretation;
      const lookup = intent === "COVERAGE_LOOKUP" ||
        intent === "FOLLOW_UP" && request.instructions.includes('authoritative topic is {"kind":"active"');
      value = { intent, subject, focus, tool: lookup ? "get_member_coverage" : "NONE" };
      break;
    }
    case "tpa_ground": {
      const matchAndQuote = evidence.get(input);
      if (!matchAndQuote) throw new Error("UNSCRIPTED_GROUNDING");
      const [match, quote] = matchAndQuote;
      value = { match, quote };
      break;
    }
    case "tpa_compose": {
      const { required, labels } = JSON.parse(input) as { required: string[]; labels: Record<string, string> };
      // Repeating the definition block on the FAQ follow-up proves that the server retains its required example.
      const parts = required.includes("example") ? ["answer", "answer"] : [...required];
      const tip = parts.indexOf("disclaimer");
      if (Object.hasOwn(labels, "definition")) parts.splice(tip < 0 ? parts.length : tip, 0, "definition");
      value = { parts };
      break;
    }
    default:
      throw new Error("UNSCRIPTED_STAGE");
  }
  return Response.json({
    model: OPENAI_MODEL, service_tier: "default", status: "completed", error: null, incomplete_details: null,
    output: [{ type: "message", role: "assistant", status: "completed",
      content: [{ type: "output_text", text: JSON.stringify(value), annotations: [] }] }],
    usage: { input_tokens: 80, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      output_tokens: 40, output_tokens_details: { reasoning_tokens: 20 } }
  });
};
