import { z } from 'zod';
import type { AnalysisNotes, NoteItem, PatternSkeleton } from '@/types';
import { normalizeText } from '@/lib/greek/normalize';
import { completeTask } from './index';
import { analysisSystemPrompt, analysisUserPrompt, type AnalysisInput } from './prompts';
import {
  analysisJsonSchema,
  analysisResponseSchema,
  skeletonSchema,
  stripNulls,
  type AnalysisResponse,
} from './schemas';
import { completeStructured, nfcDeep, parseWith, type Completer, type Parsed } from './structured';
import { isValidKey } from './vocab';

// analyze(), spec §8.1–8.2. The parse/validate/repair loop is shared with
// generate() in structured.ts; this file adds what is specific to analysis.

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

export { extractJson, FormatError } from './structured';

export function parseAnalysis(text: string): Parsed<AnalysisResponse> {
  return parseWith(analysisResponseSchema, text);
}

/** Add the fields the app owns and normalise the Greek/Latin quoted from the passage. */
export function finalize(data: AnalysisResponse, input: AnalysisInput): Omit<AnalysisResult, 'model' | 'repaired'> {
  const { language } = input;
  const norm = (s: string) => normalizeText(s, language);
  const d = nfcDeep(data);

  const note = ({ reference, ...n }: AnalysisResponse['notes']['discourse'][number]): NoteItem => ({
    ...n,
    evidence: n.evidence.map(norm),
    // §12: never trust LLM section numbers. No key at all when there is no reference.
    ...(reference ? { reference: { ...reference, verified: false } } : {}),
  });

  const notes: AnalysisNotes = {
    ...d.notes,
    ...(d.notes.tokens ? { tokens: d.notes.tokens.map((t) => ({ ...t, form: norm(t.form) })) } : {}),
    syntax: { ...d.notes.syntax, constructions: d.notes.syntax.constructions.map(note) },
    discourse: d.notes.discourse.map(note),
    style: d.notes.style.map(note),
  };

  const skeleton: PatternSkeleton = {
    ...d.skeleton,
    schemaVersion: 1,
    language,
    ...((input.variety ?? d.skeleton.variety) ? { variety: input.variety ?? d.skeleton.variety } : {}),
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
  const normalized = { ...input, text: normalizeText(input.text, input.language) };
  const { data, model, repaired } = await completeStructured({
    complete: opts.complete ?? ((req) => completeTask('analysis', req)),
    schema: analysisResponseSchema,
    schemaJson: analysisJsonSchema(),
    system: analysisSystemPrompt(input.language),
    user: analysisUserPrompt(normalized),
    maxTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
    signal: opts.signal,
  });
  return { ...finalize(data, normalized), model, repaired };
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
      ...((base.variety ?? d.variety) ? { variety: base.variety ?? d.variety } : {}),
      units: d.units.map((u) => ({
        ...u,
        slots: u.slots.map((s) => ({ ...s, exampleText: normalizeText(s.exampleText, base.language) })),
      })),
    },
  };
}
