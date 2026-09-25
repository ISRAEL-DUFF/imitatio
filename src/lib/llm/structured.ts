import { z } from 'zod';
import type { TaskRequest } from './index';
import type { CompletionResult } from './openrouter';
import { repairSystemPrompt, repairUserPrompt } from './prompts';
import { stripNulls } from './schemas';

// Structured output, spec §8.2, shared by analyze() and generate(): strip
// fences and prose, parse, drop nulls, validate; on failure one repair request
// with the errors; nothing invalid is ever returned.

export type Completer = (req: TaskRequest) => Promise<CompletionResult>;

/** The model's output could not be turned into valid data. */
export class FormatError extends Error {
  constructor(
    readonly raw: string,
    readonly errors: string,
    readonly truncated = false,
  ) {
    super(truncated ? 'The response was cut off before it finished.' : 'The response did not match the schema.');
    this.name = 'FormatError';
  }
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; errors: string };

/** Pull the JSON object out of a response: code fences and stray prose removed. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}

export function parseWith<S extends z.ZodType>(schema: S, text: string): Parsed<z.output<S>> {
  let json: unknown;
  try {
    json = JSON.parse(extractJson(text));
  } catch (err) {
    return { ok: false, errors: `Not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  const result = schema.safeParse(stripNulls(json));
  return result.success ? { ok: true, data: result.data } : { ok: false, errors: z.prettifyError(result.error) };
}

export function nfcDeep<T>(value: T): T {
  if (typeof value === 'string') return value.normalize('NFC') as T;
  if (Array.isArray(value)) return value.map(nfcDeep) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, nfcDeep(v)])) as T;
  }
  return value;
}

export async function completeStructured<S extends z.ZodType>(opts: {
  complete: Completer;
  schema: S;
  /** The schema as JSON Schema, for the repair prompt. */
  schemaJson: string;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{ data: z.output<S>; model: string; repaired: boolean }> {
  const base = { json: true, maxTokens: opts.maxTokens, timeoutMs: opts.timeoutMs, signal: opts.signal };

  const first = await opts.complete({ ...base, system: opts.system, user: opts.user });
  if (first.finishReason === 'length') throw new FormatError(first.text, 'Hit the output token limit.', true);
  const parsed = parseWith(opts.schema, first.text);
  if (parsed.ok) return { data: parsed.data, model: first.model, repaired: false };

  // A truncated answer is never sent for repair: it would be repaired into nonsense.
  const second = await opts.complete({
    ...base,
    system: repairSystemPrompt(opts.schemaJson),
    user: repairUserPrompt(first.text, parsed.errors),
  });
  if (second.finishReason === 'length') {
    throw new FormatError(second.text, 'Hit the output token limit during repair.', true);
  }
  const repaired = parseWith(opts.schema, second.text);
  if (!repaired.ok) throw new FormatError(second.text, repaired.errors);
  return { data: repaired.data, model: second.model, repaired: true };
}
