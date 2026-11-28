import { CoverageAssistant } from "./coverage-assistant.ts";
import { DemoMemberAuth } from "./demo-auth/member-auth.ts";
import { createDemoServer } from "./http-server.ts";
import { MockTpaBackend } from "./mock-backend.ts";
import { createDemoIntentSelector } from "./selector-factory.ts";
import { OllamaCoverageIntentSelector } from "./ollama-selector.ts";
import { ConversationExperiment } from "./conversation-experiment.ts";
import { HubConversationProvider } from "./conversation-provider.ts";

if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEMO_AUTH !== "true") {
  throw new Error("Refusing to start: fake authentication may run only with ENABLE_DEMO_AUTH=true and NODE_ENV!=production");
}
const authMode = process.env.DEMO_AUTH_MODE ?? "verified";
if (authMode !== "verified" && authMode !== "legacy") throw new Error("UNSUPPORTED_DEMO_AUTH_MODE");
const intentMode = process.env.DEMO_INTENT_MODE ?? "fixture";
const experimentalMode = intentMode === "hub" || intentMode === "ollama-v05" ? intentMode : undefined;
if (authMode === "verified" && intentMode !== "fixture" && intentMode !== "ollama" && !experimentalMode) {
  throw new Error("VERIFIED_DEMO_REQUIRES_OFFLINE_SELECTOR");
}
if (intentMode === "ollama" && authMode !== "verified") throw new Error("OLLAMA_REQUIRES_VERIFIED_DEMO");
if (experimentalMode && authMode !== "verified") throw new Error("CONVERSATION_REQUIRES_VERIFIED_DEMO");
const memberAuth = authMode === "verified" ? new DemoMemberAuth() : undefined;
const selector = createDemoIntentSelector({
  ...process.env, DEMO_INTENT_MODE: intentMode === "hub" ? "fixture" : intentMode === "ollama-v05" ? "ollama" : intentMode
});
const directOllama = selector instanceof OllamaCoverageIntentSelector ? selector : undefined;
const provider = experimentalMode === "hub" ? new HubConversationProvider(process.env.LOCAL_AI_HUB_PROFILE) :
  experimentalMode === "ollama-v05" ? directOllama : undefined;
const assistant = new CoverageAssistant(
  new MockTpaBackend(memberAuth), selector, memberAuth,
  experimentalMode ? undefined : directOllama, provider ? new ConversationExperiment(provider) : undefined
);
const app = createDemoServer(assistant, true, memberAuth, experimentalMode ?? (intentMode === "ollama"));
const port = Number(process.env.PORT ?? "3000");
app.listen(port, "127.0.0.1", () => {
  const address = app.address();
  if (address && typeof address !== "string") {
    console.log("TPA AI demo server listening on http://127.0.0.1:" + address.port + " (mock identity / mock coverage)");
  }
});
