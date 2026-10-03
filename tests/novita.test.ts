import { describe, expect, it } from "vitest";
import { ModelRequirementsOutput } from "@/lib/contracts";
import { liveProvider } from "@/lib/providers/live";
import { NOVITA_DEFAULT_BASE_URL, NOVITA_DEFAULT_MODEL, novitaLiveVerified, novitaTransport, novitaTransportFromEnv } from "@/lib/providers/novita";
import { integrationStatus } from "@/lib/providers/status";
import { PRESET_TEXT } from "@/lib/fixtures";

const REQUIREMENTS = {
  objective: "Dinner",
  headcount: 60,
  vegetarianMin: 20,
  readyByLocal: "18:30",
  budgetCents: 100000,
  wantsDrinks: true,
  wantsPlates: true,
  wantsUtensils: true,
  preferences: [],
};

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: { model: string; messages: Array<{ role: string; content: string }>; temperature: number; response_format?: { type: string } };
}

function fakeFetch(reply: () => { status: number; body: unknown }) {
  const sent: Sent[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
    const r = reply();
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { impl, sent };
}

const envOf = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
const chat = (content: string) => ({ status: 200, body: { choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] } });
const call = { schema: ModelRequirementsOutput, system: "sys", user: "usr", maxTokens: 500, signal: new AbortController().signal };

describe("Novita transport (offline, fake fetch)", () => {
  it("posts an OpenAI-compatible chat completion and parses a valid JSON reply", async () => {
    const f = fakeFetch(() => chat(JSON.stringify(REQUIREMENTS)));
    const t = novitaTransport({ apiKey: "nv_test", fetchImpl: f.impl });
    expect(t.name).toBe(`Novita · ${NOVITA_DEFAULT_MODEL}`);
    const out = await t.parse(call);
    expect(out).toEqual(REQUIREMENTS);
    expect(f.sent).toHaveLength(1);
    const req = f.sent[0]!;
    expect(req.url).toBe(`${NOVITA_DEFAULT_BASE_URL}/chat/completions`);
    expect(req.headers.Authorization).toBe("Bearer nv_test");
    expect(req.body.model).toBe(NOVITA_DEFAULT_MODEL);
    expect(req.body.temperature).toBe(0);
    expect(req.body.response_format).toEqual({ type: "json_object" });
    expect(req.body.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(req.body.messages[1]!.content).toContain("Reply with exactly one JSON object");
  });

  it("returns null on an HTTP 500, and liveProvider falls back to local rules", async () => {
    const f = fakeFetch(() => ({ status: 500, body: { error: "upstream" } }));
    const t = novitaTransport({ apiKey: "k", fetchImpl: f.impl });
    expect(await t.parse(call)).toBeNull();
    const r = await liveProvider({ transport: t }).interpret(PRESET_TEXT);
    expect(r.reasoning).toBe("local");
    expect(r.fallback?.reason).toBeTruthy();
    expect(r.value.headcount).toBe(60);
  });

  it("extracts the JSON object from prose or code fences, as the ZooWork transport does", async () => {
    const fenced = fakeFetch(() => chat("Sure, here it is:\n```json\n" + JSON.stringify(REQUIREMENTS) + "\n```\nAnything else?"));
    expect(await novitaTransport({ apiKey: "k", fetchImpl: fenced.impl }).parse(call)).toEqual(REQUIREMENTS);
    const prose = fakeFetch(() => chat("I cannot help with that."));
    expect(await novitaTransport({ apiKey: "k", fetchImpl: prose.impl }).parse(call)).toBeNull();
    const notJsonBody = fakeFetch(() => ({ status: 200, body: "<html>gateway</html>" }));
    expect(await novitaTransport({ apiKey: "k", fetchImpl: notJsonBody.impl }).parse(call)).toBeNull();
  });

  it("returns null on its own timeout", async () => {
    const hanging = ((_: unknown, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError"))))) as typeof fetch;
    expect(await novitaTransport({ apiKey: "k", fetchImpl: hanging, timeoutMs: 20 }).parse(call)).toBeNull();
  });

  it("novitaTransportFromEnv needs CLEARING_REASONING=novita and NOVITA_API_KEY", () => {
    expect(novitaTransportFromEnv(envOf({ CLEARING_REASONING: "novita" }))).toBeNull();
    expect(novitaTransportFromEnv(envOf({ NOVITA_API_KEY: "k" }))).toBeNull();
    const t = novitaTransportFromEnv(envOf({ CLEARING_REASONING: "novita", NOVITA_API_KEY: "k", NOVITA_MODEL: "qwen/some-model" }));
    expect(t).not.toBeNull();
    expect(t!.name).toBe("Novita · qwen/some-model");
  });

  it("the verified marker flips only after a successful, schema-valid call", async () => {
    const env = envOf({ CLEARING_REASONING: "novita", NOVITA_API_KEY: "k" });
    let next: { status: number; body: unknown } = { status: 500, body: {} };
    const f = fakeFetch(() => next);
    const t = novitaTransportFromEnv(env, { fetchImpl: f.impl })!;
    expect(novitaLiveVerified()).toBeNull();
    expect(integrationStatus(env).reasoning).toEqual({ mode: "live", provider: `Novita · ${NOVITA_DEFAULT_MODEL} (unverified until first successful call)`, verified: false });

    await t.parse(call); // HTTP 500
    next = chat('{"garbage":true}');
    await t.parse(call); // JSON, but fails the schema
    expect(novitaLiveVerified()).toBeNull();
    expect(integrationStatus(env).novita?.connected).toBe(false);

    next = chat(JSON.stringify(REQUIREMENTS));
    await t.parse(call);
    expect(novitaLiveVerified()).toEqual({ model: NOVITA_DEFAULT_MODEL });
    const st = integrationStatus(env);
    expect(st.reasoning).toEqual({ mode: "live", provider: `Novita · ${NOVITA_DEFAULT_MODEL} (live-verified this process)`, verified: true });
    expect(st.novita?.connected).toBe(true);
  });
});

describe("Novita status by default", () => {
  it("reports Novita as not connected and reasoning as local rules", () => {
    const st = integrationStatus(envOf({}));
    expect(st.reasoning).toEqual({ mode: "local", provider: "Local rules", verified: true });
    expect(st.novita).toEqual({ connected: false, note: "Not connected — set CLEARING_REASONING=novita and NOVITA_API_KEY" });
  });

  it("a key alone (without CLEARING_REASONING=novita) does not select Novita", () => {
    const st = integrationStatus(envOf({ NOVITA_API_KEY: "k" }));
    expect(st.reasoning.mode).toBe("local");
    expect(st.novita?.connected).toBe(false);
  });
});
