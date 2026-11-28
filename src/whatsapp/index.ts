import { HubConversationProvider } from "../conversation-provider.ts";
import { OllamaCoverageIntentSelector } from "../ollama-selector.ts";
import { readWhatsAppConfig } from "./config.ts";
import { createWhatsAppServer } from "./server.ts";

const config = readWhatsAppConfig(process.env);
const provider = config.intentMode === "hub"
  ? new HubConversationProvider(process.env.LOCAL_AI_HUB_PROFILE)
  : new OllamaCoverageIntentSelector(process.env.OLLAMA_MODEL ?? "");
const server = createWhatsAppServer({ config, provider, report: (event) => console.error("WhatsApp test:", event) });
server.on("error", () => {
  console.error("WhatsApp test: LISTEN_FAILED");
  process.exitCode = 1;
});
server.listen(config.port, "127.0.0.1", () => {
  console.log(`WhatsApp test webhook listening on 127.0.0.1:${config.port} (synthetic accounts)`);
});
