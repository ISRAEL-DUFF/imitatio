import { z } from 'zod';
import type { GeneratedText, Generation, PatternSkeleton } from '@/types';
import { normalizeText } from '@/lib/greek/normalize';
import { LANGUAGE_LABELS, VARIETIES } from '@/lib/language';
import { completeTask } from './index';
import { completeStructured, nfcDeep, parseWith, type Completer, type Parsed } from './structured';

// generate(), spec §8.4: new text that follows a saved pattern. Generation
// works from the skeleton, never from the prose notes (§1.2).

const MAX_TOKENS = 6_000;

export const generationResponseSchema = z.object({
  outputs: z
    .array(
      z.object({
        text: z.string().min(1).describe('The new Greek or Latin text'),
        literalTranslation: z.string(),
        unitMapping: z
          .array(z.object({ unitId: z.string(), text: z.string().describe('Exact words of the new text realising this unit') }))
          .describe('One entry per skeleton unit, in order'),
        deviations: z.array(z.string()).describe('Every place the text departs from the pattern; empty if none'),
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
  return `You compose new Ancient Greek or Latin text that follows a given structural pattern.

You will receive a pattern skeleton. Write NEW text in the same language that:
- realises every unit, in the same order;
- preserves every item listed in "invariants";
- keeps the specified constructions, moods, tenses, particles/connectives,
  style devices, discourse moves, and topic/focus positions;
- changes only what "freeSlots" allows, following the user's topic if given.

Use correct morphology and idiom for the stated variety. For Greek, write full
polytonic accentuation and breathings. For Latin, use classical orthography
without macrons unless asked.

For each output, give a literal English translation, map each unit id to the
words that realise it, and list honestly any place where you departed from
the pattern.

Return ONLY JSON matching this schema. No prose, no code fences.

<schema>
${generationJsonSchema()}
</schema>`;
}

export type GenerationRequest = Generation['request'];

export function generationUserPrompt(skeleton: PatternSkeleton, request: GenerationRequest): string {
  const variety = VARIETIES[skeleton.language].find((v) => v.value === skeleton.variety)?.label;
  // exampleText shows the model how the source filled each slot; it is not to be copied.
  return [
    `Language: ${skeleton.language} (${LANGUAGE_LABELS[skeleton.language]}${variety ? `, ${variety}` : ''})`,
    `Variations: ${request.variations} (each a different realisation of the same pattern)`,
    `Topic: ${request.topic?.trim() || 'your choice, different from the source'}`,
    `Constraints: ${request.constraints?.trim() || 'none'}`,
    '',
    'Pattern skeleton (exampleText is how the source passage filled each slot; do not reuse it):',
    JSON.stringify(skeleton),
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
    signal: opts.signal,
  });
  const norm = (s: string) => normalizeText(s, skeleton.language);
  const outputs: GeneratedText[] = nfcDeep(data.outputs)
    .slice(0, request.variations)
    .map((o) => ({
      text: norm(o.text),
      literalTranslation: o.literalTranslation,
      unitMapping: o.unitMapping.map((m) => ({ unitId: m.unitId, text: norm(m.text) })),
      deviations: o.deviations,
      label: 'composition', // always; never presented as authentic text (§12)
      starred: false,
    }));
  return { outputs, model, repaired };
}
