import { z } from 'zod';
import { LlmError, type LlmErrorKind } from './errors';

// Browser-direct client for OpenRouter's OpenAI-compatible chat completions
// endpoint (spec §8.1). Error handling and retries follow §8.5.

export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const MAX_ATTEMPTS = 3;
const RETRYABLE = new Set([429, 502, 503]);
const MAX_RETRY_AFTER_MS = 20_000;
const DEFAULT_TIMEOUT_MS = 120_000;

export interface CompletionRequest {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Ask for a JSON object. Send only when the model supports `response_format`. */
  json?: boolean;
  signal?: AbortSignal;
}

export interface CompletionResult {
  text: string;
  /** Model OpenRouter actually served, which can differ from the one requested. */
  model: string;
  finishReason?: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface ClientDeps {
  apiKey: string | null;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

const contentPart = z.object({ type: z.string(), text: z.string().optional() });

const completionSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({
          content: z.union([z.string(), z.array(contentPart)]).nullish(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({ prompt_tokens: z.number(), completion_tokens: z.number() })
    .optional(),
});

const errorSchema = z.object({
  error: z.object({ code: z.union([z.number(), z.string()]).optional(), message: z.string().optional() }),
});

export function kindForStatus(status: number): LlmErrorKind {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 402) return 'no_credits';
  if (status === 408) return 'timeout';
  if (RETRYABLE.has(status)) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'bad_request';
}

function retryDelay(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  return 1000 * 2 ** (attempt - 1); // 1 s, then 2 s
}

function errorDetail(body: unknown): { code?: number; message?: string } {
  const parsed = errorSchema.safeParse(body);
  if (!parsed.success) return {};
  const code = Number(parsed.data.error.code);
  return { code: Number.isFinite(code) ? code : undefined, message: parsed.data.error.message };
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function complete(req: CompletionRequest, deps: ClientDeps): Promise<CompletionResult> {
  const apiKey = deps.apiKey?.trim();
  if (!apiKey) throw new LlmError('no_key');

  const doFetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const sleep = deps.sleep ?? defaultSleep;
  const timeout = AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
    'X-Title': 'Imitatio',
  };
  if (typeof location !== 'undefined') headers['HTTP-Referer'] = location.origin;

  const body = JSON.stringify({
    model: req.model,
    max_tokens: req.maxTokens ?? 8000,
    ...(req.temperature === undefined ? {} : { temperature: req.temperature }),
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ],
    ...(req.json ? { response_format: { type: 'json_object' } } : {}),
  });

  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await doFetch(`${OPENROUTER_BASE}/chat/completions`, { method: 'POST', headers, body, signal });
    } catch (err) {
      if (req.signal?.aborted) throw new LlmError('aborted');
      if (timeout.aborted) throw new LlmError('timeout');
      throw new LlmError('network', { detail: err instanceof Error ? err.message : String(err) });
    }

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const { message } = errorDetail(json);
      if (RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS) {
        await sleep(retryDelay(attempt, res.headers.get('retry-after')));
        continue;
      }
      throw new LlmError(kindForStatus(res.status), { status: res.status, detail: message });
    }

    // OpenRouter can report an upstream failure inside a 200 response.
    const inline = errorDetail(json);
    if (inline.code !== undefined || inline.message !== undefined) {
      const status = inline.code ?? 500;
      if (RETRYABLE.has(status) && attempt < MAX_ATTEMPTS) {
        await sleep(retryDelay(attempt, null));
        continue;
      }
      throw new LlmError(kindForStatus(status), { status, detail: inline.message });
    }

    const parsed = completionSchema.safeParse(json);
    if (!parsed.success) throw new LlmError('empty', { detail: z.prettifyError(parsed.error) });

    const choice = parsed.data.choices[0];
    const content = choice.message.content;
    const text = Array.isArray(content)
      ? content.map((p) => p.text ?? '').join('')
      : (content ?? '');
    if (!text.trim()) {
      throw new LlmError('empty', { detail: choice.finish_reason ? `finish_reason: ${choice.finish_reason}` : undefined });
    }

    return {
      text,
      model: parsed.data.model ?? req.model,
      finishReason: choice.finish_reason ?? undefined,
      usage: parsed.data.usage && {
        promptTokens: parsed.data.usage.prompt_tokens,
        completionTokens: parsed.data.usage.completion_tokens,
      },
    };
  }
}
