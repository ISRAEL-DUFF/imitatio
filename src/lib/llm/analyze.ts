import { z } from 'zod';
import type { AnalysisNotes, NoteItem, PatternSkeleton } from '@/types';
import { normalizeText } from '@/lib/greek/normalize';
import { completeTask, type TaskRequest } from './index';
import type { CompletionResult } from './openrouter';
import {
  analysisSystemPrompt,
  analysisUserPrompt,
  repairSystemPrompt,
  repairUserPrompt,
  type AnalysisInput,
} from './prompts';
import { analysisResponseSchema, skeletonSchema, stripNulls, type AnalysisResponse } from './schemas';
import { isValidKey } from './vocab';

// analyze(), spec §8.1–8.2: one analysis call, one repair call if the output
// does not parse or validate, and nothing invalid ever returned.

const MAX_TOKENS = 16_000; // reasoning models spend part of this thinking
const TIMEOUT_MS = 300_000;

export interface AnalysisResult {
  text: string; // the normalised passage that was analysed
  notes: AnalysisNotes;
  skeleton: PatternSkeleton;
  constructionKeys: string[];
  deviceKeys: string[];
  model: string;
  repaired: boolean;
}

/** The model's output could not be turned into a valid analysis. */
export class AnalysisFormatError extends Error {
  constructor(
    readonly raw: string,
    readonly errors: string,
    readonly truncated = false,
  ) {
    super(truncated ? 'The response was cut off before it finished.' : 'The response did not match the schema.');
    this.name = 'AnalysisFormatError';
  }
}

type Completer = (req: TaskRequest) => Promise<CompletionResult>;

type Parsed = { ok: true; data: AnalysisResponse } | { ok: false; errors: string };

/** Pull the JSON object out of a response: code fences and stray prose removed. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}

export function parseAnalysis(text: string): Parsed {
  let json: unknown;
  try {
    json = JSON.parse(extractJson(text));
  } catch (err) {
    return { ok: false, errors: `Not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  const result = analysisResponseSchema.safeParse(stripNulls(json));
  return result.success ? { ok: true, data: result.data } : { ok: false, errors: z.prettifyError(result.error) };
}

function nfcDeep<T>(value: T): T {
  if (typeof value === 'string') return value.normalize('NFC') as T;
  if (Array.isArray(value)) return value.map(nfcDeep) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, nfcDeep(v)])) as T;
  }
  return value;
}

/** Add the fields the app owns and normalise the Greek/Latin quoted from the passage. */
export function finalize(data: AnalysisResponse, input: AnalysisInput): Omit<AnalysisResult, 'model' | 'repaired'> {
  const { language } = input;
  const norm = (s: string) => normalizeText(s, language);
  const d = nfcDeep(data);

  const note = (n: AnalysisResponse['notes']['discourse'][number]): NoteItem => ({
    ...n,
    evidence: n.evidence.map(norm),
    reference: n.reference && { ...n.reference, verified: false }, // §12: never trust LLM section numbers
  });

  const notes: AnalysisNotes = {
    ...d.notes,
    tokens: d.notes.tokens?.map((t) => ({ ...t, form: norm(t.form) })),
    syntax: { ...d.notes.syntax, constructions: d.notes.syntax.constructions.map(note) },
    discourse: d.notes.discourse.map(note),
    style: d.notes.style.map(note),
  };

  const skeleton: PatternSkeleton = {
    ...d.skeleton,
    schemaVersion: 1,
    language,
    variety: input.variety ?? d.skeleton.variety,
    level: input.level,
    units: d.skeleton.units.map((u) => ({
      ...u,
      slots: u.slots.map((s) => ({ ...s, exampleText: norm(s.exampleText) })),
    })),
  };

  return { text: norm(input.text), notes, skeleton, ...indexKeys(skeleton) };
}

/** The denormalised keys an entry is indexed by (spec §6.1). */
export function indexKeys(skeleton: PatternSkeleton): { constructionKeys: string[]; deviceKeys: string[] } {
  const constructionKeys = new Set<string>();
  for (const u of skeleton.units) {
    if (u.construction) constructionKeys.add(u.construction);
    // A special verb use that is itself a construction (historic_present) is indexed too.
    const special = u.verb?.specialUse;
    if (special && !special.startsWith('other:') && isValidKey('construction', special, skeleton.language)) {
      constructionKeys.add(special);
    }
  }
  return {
    constructionKeys: [...constructionKeys],
    deviceKeys: [...new Set(skeleton.devices.map((d) => d.type))],
  };
}

export async function analyze(
  input: AnalysisInput,
  opts: { signal?: AbortSignal; complete?: Completer } = {},
): Promise<AnalysisResult> {
  const complete: Completer = opts.complete ?? ((req) => completeTask('analysis', req));
  const normalized = { ...input, text: normalizeText(input.text, input.language) };
  const base = { json: true, maxTokens: MAX_TOKENS, timeoutMs: TIMEOUT_MS, signal: opts.signal };

  const first = await complete({
    ...base,
    system: analysisSystemPrompt(input.language),
    user: analysisUserPrompt(normalized),
  });
  if (first.finishReason === 'length') throw new AnalysisFormatError(first.text, 'Hit the output token limit.', true);

  let parsed = parseAnalysis(first.text);
  let model = first.model;
  let repaired = false;

  if (!parsed.ok) {
    const second = await complete({
      ...base,
      system: repairSystemPrompt(),
      user: repairUserPrompt(first.text, parsed.errors),
    });
    if (second.finishReason === 'length') {
      throw new AnalysisFormatError(second.text, 'Hit the output token limit during repair.', true);
    }
    parsed = parseAnalysis(second.text);
    if (!parsed.ok) throw new AnalysisFormatError(second.text, parsed.errors);
    model = second.model;
    repaired = true;
  }

  return { ...finalize(parsed.data, normalized), model, repaired };
}

/**
 * Validate a hand-edited skeleton (the JSON editor, spec §9.3) against the
 * same schema as model output. The app-owned fields are kept from `base`
 * whatever the JSON says, and quoted text is normalised as on analysis.
 */
export function parseSkeletonJson(
  text: string,
  base: Pick<PatternSkeleton, 'language' | 'level' | 'variety'>,
): { ok: true; skeleton: PatternSkeleton } | { ok: false; errors: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: `Not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  // Whatever the JSON says about the app-owned fields is ignored, not validated.
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const { schemaVersion: _v, language: _l, level: _lv, ...rest } = json as Record<string, unknown>;
    json = rest;
  }
  const parsed = skeletonSchema.safeParse(stripNulls(json));
  if (!parsed.success) return { ok: false, errors: z.prettifyError(parsed.error) };
  const d = nfcDeep(parsed.data);
  return {
    ok: true,
    skeleton: {
      ...d,
      schemaVersion: 1,
      language: base.language,
      level: base.level,
      variety: base.variety ?? d.variety,
      units: d.units.map((u) => ({
        ...u,
        slots: u.slots.map((s) => ({ ...s, exampleText: normalizeText(s.exampleText, base.language) })),
      })),
    },
  };
}
