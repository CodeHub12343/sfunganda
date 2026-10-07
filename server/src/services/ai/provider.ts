import { env } from "@/config/env.js";
import { log } from "@/util/log.js";

// =============================================================================
// DraftingProvider interface (TD-13). The vendor is swappable; behaviour is
// defined by §17's prompt and validators, not by the API shape.
//
// Three providers ship:
//   • "anthropic" — the default. Hits the Messages API over HTTPS.
//   • "mock"      — deterministic, returns input fragments. Used in CI and
//                   when ANTHROPIC_API_KEY is unset so the drafting button
//                   still works in dev without burning tokens.
//   • "disabled"  — refuses every call; makes the drafting feature invisible.
//                   Selected automatically when AI_PROVIDER=disabled.
//
// Everything the server builds a Draft from flows through `generate()`. We
// never speak to a vendor SDK outside this module.
// =============================================================================

export type DraftFields = {
  title: string;
  body: string;
  why_it_matters: string;
  next_steps: string;
  facts_used: string[];
};

export type GenerateInput = {
  system: string;
  user: string;
  // Hard upper bound on completion length. The provider is also told via the
  // prompt; this is the belt-and-braces cap.
  max_output_tokens: number;
  // Soft wall-clock budget. If the provider has not responded by then we
  // return a `timeout` error and the caller shows the "write manually"
  // fallback (§17.3).
  timeout_ms: number;
};

export type GenerateOk = {
  ok: true;
  provider: string;
  model: string;
  fields: DraftFields;
  tokens: { input: number; output: number };
  latency_ms: number;
};

export type GenerateErr = {
  ok: false;
  provider: string;
  model: string;
  error_code: "timeout" | "provider_error" | "parse_error" | "disabled";
  error_message: string;
  tokens: { input: number; output: number };
  latency_ms: number;
};

export type GenerateResult = GenerateOk | GenerateErr;

export interface DraftingProvider {
  readonly name: string;
  readonly model: string;
  readonly enabled: boolean;
  generate(input: GenerateInput): Promise<GenerateResult>;
  // Short text translation. Returns a translated string of a reviewed
  // English summary into the target BCP-47 language. The same contract as
  // generate(): never throws for provider-side errors — a shaped `err` is
  // returned so the caller logs it and the public page shows a fallback.
  translate(input: {
    text: string;
    target_language: string;
    timeout_ms: number;
  }): Promise<
    | { ok: true; provider: string; model: string; text: string; tokens: { input: number; output: number }; latency_ms: number }
    | { ok: false; provider: string; model: string; error_code: "timeout" | "provider_error"; error_message: string; latency_ms: number }
  >;
}

// ----------------------------------------------------------------------------
// Mock provider — deterministic. Used in tests (and in dev when no API key).
// Echoes the input, redacts anything that looks like PII, and preserves facts.
// Honours a `__inject__` instruction in the user prompt that forces an
// invalid number into the output so the validator fixtures can prove the
// fact-checker catches it (§17.5).
// ----------------------------------------------------------------------------
export class MockProvider implements DraftingProvider {
  readonly name = "mock";
  readonly model = "mock-echo-1";
  readonly enabled = true;

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 1));
    const inject = /__inject__:(.*)/.exec(input.user);
    const injectedNumber = inject?.[1]?.trim();
    const raw = input.user.replace(/__inject__:.*$/m, "").trim();
    const title = (raw.split("\n").find((l) => l.trim().length > 0) ?? "Draft update").slice(0, 180);
    const body = injectedNumber ? `${raw}\n\n${injectedNumber} children were helped.` : raw;
    const fields: DraftFields = {
      title,
      body,
      why_it_matters: "Supplied facts have been summarised; no numbers invented.",
      next_steps: "",
      facts_used: raw.split("\n").filter((l) => l.trim()).slice(0, 10),
    };
    return {
      ok: true,
      provider: this.name,
      model: this.model,
      fields,
      tokens: { input: Math.ceil(input.user.length / 4), output: Math.ceil(body.length / 4) },
      latency_ms: Date.now() - start,
    };
  }

  async translate(input: {
    text: string;
    target_language: string;
    timeout_ms: number;
  }): ReturnType<DraftingProvider["translate"]> {
    void input.timeout_ms;
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 1));
    return {
      ok: true,
      provider: this.name,
      model: this.model,
      text: `[${input.target_language}] ${input.text}`,
      tokens: { input: Math.ceil(input.text.length / 4), output: Math.ceil(input.text.length / 4) },
      latency_ms: Date.now() - start,
    };
  }
}

// ----------------------------------------------------------------------------
// Anthropic provider — Claude Messages API. We don't pull in the SDK; a
// 60-line fetch is sufficient and keeps the dependency surface flat.
// ----------------------------------------------------------------------------
export class AnthropicProvider implements DraftingProvider {
  readonly name = "anthropic";
  readonly model: string;
  readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly apiVersion = "2023-06-01";

  constructor(opts: { apiKey: string; model: string; baseUrl?: string }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.enabled = Boolean(opts.apiKey);
    this.baseUrl = opts.baseUrl ?? "https://api.anthropic.com";
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const start = Date.now();
    if (!this.enabled) {
      return {
        ok: false,
        provider: this.name,
        model: this.model,
        error_code: "disabled",
        error_message: "anthropic provider is not configured",
        tokens: { input: 0, output: 0 },
        latency_ms: 0,
      };
    }
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), input.timeout_ms);
    try {
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        signal: ctl.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": this.apiVersion,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: input.max_output_tokens,
          system: input.system,
          messages: [{ role: "user", content: input.user }],
        }),
      });
      const latency_ms = Date.now() - start;
      const json = (await res.json().catch(() => null)) as
        | {
            content?: Array<{ type: string; text?: string }>;
            usage?: { input_tokens?: number; output_tokens?: number };
            error?: { message?: string };
          }
        | null;
      if (!res.ok || !json) {
        return {
          ok: false,
          provider: this.name,
          model: this.model,
          error_code: "provider_error",
          error_message: json?.error?.message?.slice(0, 400) ?? `status ${res.status}`,
          tokens: { input: json?.usage?.input_tokens ?? 0, output: json?.usage?.output_tokens ?? 0 },
          latency_ms,
        };
      }
      const text = (json.content ?? [])
        .map((c) => (c.type === "text" ? c.text ?? "" : ""))
        .join("\n")
        .trim();
      const parsed = parseJsonFields(text);
      if (!parsed) {
        return {
          ok: false,
          provider: this.name,
          model: this.model,
          error_code: "parse_error",
          error_message: "model did not return valid JSON",
          tokens: { input: json.usage?.input_tokens ?? 0, output: json.usage?.output_tokens ?? 0 },
          latency_ms,
        };
      }
      return {
        ok: true,
        provider: this.name,
        model: this.model,
        fields: parsed,
        tokens: { input: json.usage?.input_tokens ?? 0, output: json.usage?.output_tokens ?? 0 },
        latency_ms,
      };
    } catch (err) {
      const aborted = (err as { name?: string })?.name === "AbortError";
      return {
        ok: false,
        provider: this.name,
        model: this.model,
        error_code: aborted ? "timeout" : "provider_error",
        error_message: aborted ? "provider timed out" : (err as Error).message.slice(0, 400),
        tokens: { input: 0, output: 0 },
        latency_ms: Date.now() - start,
      };
    } finally {
      clearTimeout(to);
    }
  }

  async translate(input: {
    text: string;
    target_language: string;
    timeout_ms: number;
  }): ReturnType<DraftingProvider["translate"]> {
    const start = Date.now();
    if (!this.enabled) {
      return {
        ok: false,
        provider: this.name,
        model: this.model,
        error_code: "provider_error",
        error_message: "anthropic provider is not configured",
        latency_ms: 0,
      };
    }
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), input.timeout_ms);
    try {
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        signal: ctl.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": this.apiVersion,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          system:
            "Translate the user message into the specified language. Preserve names and numbers exactly. Return only the translated text, no commentary.",
          messages: [
            {
              role: "user",
              content: `Target language (BCP-47): ${input.target_language}\n\n${input.text}`,
            },
          ],
        }),
      });
      const latency_ms = Date.now() - start;
      const json = (await res.json().catch(() => null)) as
        | { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: string } }
        | null;
      if (!res.ok || !json) {
        return {
          ok: false,
          provider: this.name,
          model: this.model,
          error_code: "provider_error",
          error_message: json?.error?.message?.slice(0, 400) ?? `status ${res.status}`,
          latency_ms,
        };
      }
      const text = (json.content ?? [])
        .map((c) => (c.type === "text" ? c.text ?? "" : ""))
        .join("\n")
        .trim();
      return {
        ok: true,
        provider: this.name,
        model: this.model,
        text,
        tokens: { input: json.usage?.input_tokens ?? 0, output: json.usage?.output_tokens ?? 0 },
        latency_ms,
      };
    } catch (err) {
      const aborted = (err as { name?: string })?.name === "AbortError";
      return {
        ok: false,
        provider: this.name,
        model: this.model,
        error_code: aborted ? "timeout" : "provider_error",
        error_message: aborted ? "provider timed out" : (err as Error).message.slice(0, 400),
        latency_ms: Date.now() - start,
      };
    } finally {
      clearTimeout(to);
    }
  }
}

export class DisabledProvider implements DraftingProvider {
  readonly name = "disabled";
  readonly model = "none";
  readonly enabled = false;
  async generate(_input: GenerateInput): Promise<GenerateResult> {
    void _input;
    return {
      ok: false,
      provider: this.name,
      model: this.model,
      error_code: "disabled",
      error_message: "AI drafting is disabled",
      tokens: { input: 0, output: 0 },
      latency_ms: 0,
    };
  }
  async translate(_input: {
    text: string;
    target_language: string;
    timeout_ms: number;
  }): ReturnType<DraftingProvider["translate"]> {
    void _input;
    return {
      ok: false,
      provider: this.name,
      model: this.model,
      error_code: "provider_error",
      error_message: "translation is disabled",
      latency_ms: 0,
    };
  }
}

function parseJsonFields(raw: string): DraftFields | null {
  // Models often wrap JSON in ```json ... ``` or in prose. Strip to the
  // outer-most object before parsing.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as Partial<DraftFields> & Record<string, unknown>;
    const str = (v: unknown): string => (typeof v === "string" ? v : "");
    const list = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).slice(0, 20) : []);
    return {
      title: str(obj.title).slice(0, 200),
      body: str(obj.body).slice(0, 10_000),
      why_it_matters: str(obj.why_it_matters).slice(0, 1500),
      next_steps: str(obj.next_steps).slice(0, 1500),
      facts_used: list(obj.facts_used),
    };
  } catch {
    return null;
  }
}

// Singleton selected from env on first use. The pick itself is pure, which
// lets tests inject a `MockProvider` by resetting the module.
let cached: DraftingProvider | null = null;
let override: DraftingProvider | null = null;

export function setProviderForTests(p: DraftingProvider | null): void {
  override = p;
  cached = null;
}

export function getProvider(): DraftingProvider {
  if (override) return override;
  if (cached) return cached;
  const choice = (env.AI_PROVIDER ?? "").toLowerCase();
  if (choice === "disabled") {
    cached = new DisabledProvider();
  } else if (choice === "mock" || (!env.ANTHROPIC_API_KEY && choice !== "anthropic")) {
    cached = new MockProvider();
    if (!env.ANTHROPIC_API_KEY && choice !== "mock") {
      log.warn({ choice }, "ai.falling_back_to_mock_no_api_key");
    }
  } else {
    cached = new AnthropicProvider({
      apiKey: env.ANTHROPIC_API_KEY!,
      model: env.AI_MODEL,
    });
  }
  return cached;
}
