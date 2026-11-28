export type WhatsAppConfig = Readonly<{
  port: number;
  intentMode: "hub" | "ollama-v05";
  wabaId: string;
  phoneNumberId: string;
  allowedSenders: ReadonlySet<string>;
  appSecret: string;
  verifyToken: string;
  accessToken: string;
  graphVersion: string;
}>;

const META_ID = /^[1-9][0-9]{0,23}$/;
const PHONE = /^[1-9][0-9]{6,14}$/;

export function readWhatsAppConfig(env: NodeJS.ProcessEnv): WhatsAppConfig {
  if (env.NODE_ENV === "production" || env.ENABLE_WHATSAPP_TEST !== "true") {
    throw new Error("WHATSAPP_SYNTHETIC_MODE_DISABLED");
  }
  function required(name: string, format: RegExp): string {
    const value = env[name];
    if (!value || !format.test(value)) throw new Error("INVALID_" + name);
    return value;
  }
  const intentMode = env.WHATSAPP_INTENT_MODE ?? "hub";
  if (intentMode !== "hub" && intentMode !== "ollama-v05") throw new Error("INVALID_WHATSAPP_INTENT_MODE");
  const portText = env.WHATSAPP_PORT ?? "3010";
  const port = Number(portText);
  if (!/^[0-9]{1,5}$/.test(portText) || port < 1 || port > 65535) throw new Error("INVALID_WHATSAPP_PORT");
  const senders = (env.WHATSAPP_ALLOWED_SENDERS ?? "").split(",").map((sender) => sender.trim());
  const allowedSenders = new Set(senders);
  if (senders.length > 5 || allowedSenders.size !== senders.length || senders.some((sender) => !PHONE.test(sender))) {
    throw new Error("INVALID_WHATSAPP_ALLOWED_SENDERS");
  }
  return {
    port, intentMode, allowedSenders,
    wabaId: required("WHATSAPP_WABA_ID", META_ID),
    phoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID", META_ID),
    appSecret: required("WHATSAPP_APP_SECRET", /^[\x21-\x7e]{16,128}$/),
    verifyToken: required("WHATSAPP_VERIFY_TOKEN", /^[A-Za-z0-9_-]{24,128}$/),
    accessToken: required("WHATSAPP_ACCESS_TOKEN", /^[A-Za-z0-9._~-]{16,4096}$/),
    graphVersion: required("WHATSAPP_GRAPH_VERSION", /^v[1-9][0-9]{0,2}\.[0-9]{1,2}$/)
  };
}
