/**
 * Novita AI transport for the live reasoning provider.
 *
 * Calls Novita's OpenAI-compatible Chat Completions endpoint
 * (POST {baseUrl}/chat/completions) for the same two model-backed components as
 * the other transports: request interpretation and negotiation lever choice.
 * The prompt is built exactly as the ZooWork transport builds it (system + user
 * + "one JSON object" instruction) and the reply goes through the same JSON
 * extraction; liveProvider then validates it against the Zod schema, counts it
 * against the call ceiling, and falls back to local rules on any failure.
 *
 * Failure handling: an HTTP error, a network error, this transport's own
 * timeout, or a reply without a JSON object returns null (liveProvider retries
 * once, then falls back). An abort of the caller's signal (liveProvider's
 * timeout or a superseded request) is rethrown so liveProvider labels it
 * "timeout" / "aborted" accurately.
 *
 * Evidence: offline-tested with a fake fetch (tests/novita.test.ts); NOT
 * live-verified until a real NOVITA_API_KEY run records a successful
 * `model.call` event. `novitaLiveVerified()` flips only after a reply parsed and
 * passed the call's schema in this process.
 */
import type { LiveTransport, TransportCall } from "./live";

export const NOVITA_DEFAULT_BASE_URL = "https://api.novita.ai/v3/openai";
/** Listed in Novita's model library; JSON-mode support for it is not verified here. */
export const NOVITA_DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct";

export interface NovitaTransportOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Transport-level timeout; liveProvider applies its own per-call timeout too. */
  timeoutMs?: number;
  /** Called after the first reply that parsed and passed the call's schema. */
  onVerified?: (info: { model: string }) => void;
}

/** Same extraction as the ZooWork transport: the outermost {...} span, parsed. */
function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function replyText(body: unknown): string | null {
  const content = (body as { choices?: Array<{ message?: { content?: unknown } }> } | null)?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

export function novitaTransport(opts: NovitaTransportOptions): LiveTransport {
  const model = opts.model ?? NOVITA_DEFAULT_MODEL;
  const baseUrl = (opts.baseUrl ?? NOVITA_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  let verified = false;

  return {
    name: `Novita · ${model}`,
    async parse<T>(call: TransportCall<T>): Promise<T | null> {
      const signal = AbortSignal.any([call.signal, AbortSignal.timeout(timeoutMs)]);
      let text: string | null;
      try {
        const res = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: call.system },
              { role: "user", content: `${call.user}\n\nReply with exactly one JSON object and nothing else.` },
            ],
            temperature: 0,
            max_tokens: call.maxTokens,
            response_format: { type: "json_object" },
          }),
          signal,
        });
        if (!res.ok) return null;
        text = replyText(await res.json());
      } catch (err) {
        if (call.signal.aborted) throw err;
        return null; // network error, own timeout, or a non-JSON HTTP body
      }
      if (text === null) return null;
      const obj = extractJsonObject(text);
      if (obj === null || typeof obj !== "object") return null;
      if (!verified && call.schema.safeParse(obj).success) {
        verified = true;
        opts.onVerified?.({ model });
      }
      return obj as T;
    },
  };
}

let liveVerified: { model: string } | null = null;
/** Set once a real Novita call produced a schema-valid reply in this process. */
export function novitaLiveVerified(): { model: string } | null {
  return liveVerified;
}

/** Selected model name for status labels (no network, presence-only). */
export function novitaModel(env: NodeJS.ProcessEnv): string {
  return env.NOVITA_MODEL || NOVITA_DEFAULT_MODEL;
}

/** Build the real transport when CLEARING_REASONING=novita and NOVITA_API_KEY is set; null otherwise. */
export function novitaTransportFromEnv(env: NodeJS.ProcessEnv, opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): LiveTransport | null {
  if (env.CLEARING_REASONING !== "novita" || !env.NOVITA_API_KEY) return null;
  return novitaTransport({
    apiKey: env.NOVITA_API_KEY,
    model: novitaModel(env),
    ...(env.NOVITA_BASE_URL ? { baseUrl: env.NOVITA_BASE_URL } : {}),
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
    onVerified: (info) => {
      liveVerified = info;
    },
  });
}
