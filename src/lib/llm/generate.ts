import { z } from 'zod';
import type { GeneratedText, Generation, PatternSkeleton } from '@/types';
import { normalizeText } from '@/lib/greek/normalize';
import { LANGUAGE_LABELS, VARIETIES } from '@/lib/language';
import { completeTask } from './index';
import { completeStructured, nfcDeep, parseWith, type Completer, type Parsed } from './structured';

// generate(), spec §8.4: a new text with the same syntax and discourse as a
// saved pattern, telling a different story. Generation works from the
// skeleton, never from the prose notes (§1.2), and never sees the source's
// own words: shown them, a model paraphrases the source instead of
// composing something new.

const MAX_TOKENS = 6_000;
/** Higher than the default: the story is meant to be new, so variety is the point. */
const TEMPERATURE = 0.9;

export const generationResponseSchema = z.object({
  outputs: z
    .array(
      z.object({
        scenario: z
          .string()
          .min(1)
          .describe('The new story in one English sentence, decided before writing the text'),
        text: z.string().min(1).describe('The new Greek or Latin text'),
        literalTranslation: z.string(),
        unitMapping: z
          .array(z.object({ unitId: z.string(), text: z.string().describe('Exact words of the new text realising this unit') }))
          .describe('One entry per skeleton unit, in order'),
        deviations: z
          .array(z.string())
          .describe('Every place the grammar or discourse departs from the pattern; empty if none'),
      }),
    )
    .min(1),
});

export type GenerationResponse = z.output<typeof generationResponseSchema>;

export function generationJsonSchema(): string {
  const { $schema: _, ...schema } = z.toJSONSchema(generationResponseSchema) as Record<string, unknown>;
  return JSON.stringify(schema);
}

export function generationSystemPrompt(): string {
  return `You compose new Ancient Greek or Latin text that has the same syntax and
discourse structure as a model passage, but tells a completely different story.

You receive the model's pattern skeleton, without its words. KEEP the pattern:
- every unit, in the same order, with the same role, construction and dependency;
- each slot's grammatical function and case, in the same order within its unit;
- each verb's finiteness, mood, tense, voice, person, number and special use;
- the connectives and particles, in the same places;
- the style devices and the discourse moves;
- the information structure: what is topic and what is focus, and so where each stands.

Read "invariants" as constraints on grammar and discourse only. Where one names a
meaning or a word class ("a verb of coming-to-be", "older/younger"), keep the
grammar it describes and treat the meaning as free. The descriptions in the
skeleton (discourse, devices, notes) describe the model passage; carry over what
each element does, not what it is about.

CHANGE the story:
- invent a new situation from a different area of life than the model passage;
- new participants, places and things;
- new content words throughout: no noun, verb, adjective or adverb from the model
  passage, and no near-synonyms retelling the same event. Choose verbs of a
  different meaning that still take the same construction;
- if the user gives a topic, the story is about that topic;
- with several variations, each tells a different story from the others too.

For each output, first decide the story and state it in one English sentence
("scenario"), then write the text. Use correct morphology and idiom for the stated
variety. For Greek, write full polytonic accentuation and breathings. For Latin,
use classical orthography without macrons unless asked.

Give a literal English translation, map each unit id to the exact words that
realise it, and list honestly every place where the grammar or discourse departs
from the pattern. A change of content is not a departure: it is the point.

Return ONLY JSON matching this schema. No prose, no code fences.

<schema>
${generationJsonSchema()}
</schema>`;
}

/**
 * The skeleton as the model sees it: the source's own words (exampleText)
 * removed, so it composes rather than paraphrases.
 */
export function skeletonForGeneration(skeleton: PatternSkeleton) {
  const { schemaVersion: _v, ...rest } = skeleton;
  return {
    ...rest,
    units: skeleton.units.map((u) => ({
      ...u,
      slots: u.slots.map(({ exampleText: _t, ...slot }) => slot),
    })),
  };
}

export type GenerationRequest = Generation['request'];

export function generationUserPrompt(skeleton: PatternSkeleton, request: GenerationRequest): string {
  const variety = VARIETIES[skeleton.language].find((v) => v.value === skeleton.variety)?.label;
  const n = request.variations;
  return [
    `Language: ${skeleton.language} (${LANGUAGE_LABELS[skeleton.language]}${variety ? `, ${variety}` : ''})`,
    `Variations: ${n}${n > 1 ? ` (${n} different stories, each also different from the model passage)` : ''}`,
    `Topic: ${request.topic?.trim() || 'your choice, from a different area of life than the model passage'}`,
    `Constraints: ${request.constraints?.trim() || 'none'}`,
    '',
    'Pattern skeleton ("realization" says how the model passage filled a slot; follow it only where it is grammar):',
    JSON.stringify(skeletonForGeneration(skeleton)),
  ].join('\n');
}

export function parseGeneration(text: string): Parsed<GenerationResponse> {
  return parseWith(generationResponseSchema, text);
}

export interface GenerateResult {
  outputs: GeneratedText[];
  model: string;
  repaired: boolean;
}

export async function generate(
  skeleton: PatternSkeleton,
  request: GenerationRequest,
  opts: { signal?: AbortSignal; complete?: Completer } = {},
): Promise<GenerateResult> {
  const { data, model, repaired } = await completeStructured({
    complete: opts.complete ?? ((req) => completeTask('generation', req)),
    schema: generationResponseSchema,
    schemaJson: generationJsonSchema(),
    system: generationSystemPrompt(),
    user: generationUserPrompt(skeleton, request),
    maxTokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    signal: opts.signal,
  });
  const norm = (s: string) => normalizeText(s, skeleton.language);
  const outputs: GeneratedText[] = nfcDeep(data.outputs)
    .slice(0, request.variations)
    .map((o) => ({
      scenario: o.scenario,
      text: norm(o.text),
      literalTranslation: o.literalTranslation,
      unitMapping: o.unitMapping.map((m) => ({ unitId: m.unitId, text: norm(m.text) })),
      deviations: o.deviations,
      label: 'composition', // always; never presented as authentic text (§12)
      starred: false,
    }));
  return { outputs, model, repaired };
}
