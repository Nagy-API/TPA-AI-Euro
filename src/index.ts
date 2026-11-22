import { CoverageAssistant } from "./coverage-assistant.ts";
import { createDemoServer } from "./http-server.ts";
import { MockTpaBackend } from "./mock-backend.ts";
import { createDemoIntentSelector } from "./selector-factory.ts";

if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEMO_AUTH !== "true") {
  throw new Error("Refusing to start: fake authentication may run only with ENABLE_DEMO_AUTH=true and NODE_ENV!=production");
}
const selector = createDemoIntentSelector(process.env);
const app = createDemoServer(new CoverageAssistant(new MockTpaBackend(), selector), true);
const port = Number(process.env.PORT ?? "3000");
app.listen(port, "127.0.0.1", () => {
  console.log(`TPA AI demo server listening on http://127.0.0.1:${port} (mock identity / mock coverage)`);
});
