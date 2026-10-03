import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Browser-runtime journey against an already running browser-runtime build:
 *
 *   NEXT_PUBLIC_CLEARING_RUNTIME=browser npm run build
 *   NEXT_PUBLIC_CLEARING_RUNTIME=browser npm start      # in another terminal
 *   npm run test:e2e:browser                             # or CLEARING_BASE_URL=https://<host>
 *
 * The default config's webServer probe expects /api/status to answer 2xx, which a browser-runtime
 * build never does (it answers 501 server_mode_disabled), so this config has no webServer.
 */
const rest = { ...base };
delete rest.webServer;

export default defineConfig({
  ...rest,
  testMatch: /(browser-runtime|simple|market)\.spec\.ts/,
  projects: (base.projects ?? []).filter((p) => p.name === "desktop"),
});
