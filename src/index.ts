import { CoverageAssistant } from "./coverage-assistant.ts";
import { DemoMemberAuth } from "./demo-auth/member-auth.ts";
import { createDemoServer } from "./http-server.ts";
import { MockTpaBackend } from "./mock-backend.ts";
import { createDemoIntentSelector } from "./selector-factory.ts";

if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEMO_AUTH !== "true") {
  throw new Error("Refusing to start: fake authentication may run only with ENABLE_DEMO_AUTH=true and NODE_ENV!=production");
}
const authMode = process.env.DEMO_AUTH_MODE ?? "verified";
if (authMode !== "verified" && authMode !== "legacy") throw new Error("UNSUPPORTED_DEMO_AUTH_MODE");
if (authMode === "verified" && (process.env.DEMO_INTENT_MODE ?? "fixture") !== "fixture") {
  throw new Error("VERIFIED_DEMO_REQUIRES_OFFLINE_SELECTOR");
}
const memberAuth = authMode === "verified" ? new DemoMemberAuth() : undefined;
const selector = createDemoIntentSelector(process.env);
const assistant = new CoverageAssistant(new MockTpaBackend(memberAuth), selector);
const app = createDemoServer(assistant, true, memberAuth);
const port = Number(process.env.PORT ?? "3000");
app.listen(port, "127.0.0.1", () => {
  const address = app.address();
  if (address && typeof address !== "string") {
    console.log("TPA AI demo server listening on http://127.0.0.1:" + address.port + " (mock identity / mock coverage)");
  }
});
