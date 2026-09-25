import type { Language, Level, Passage } from '@/types';
import { LANGUAGE_LABELS, VARIETIES } from '@/lib/language';
import { EXAMPLE_PASSAGE, EXAMPLE_SKELETON } from './example';
import { analysisJsonSchema } from './schemas';
import { vocabularyPrompt } from './vocab';

// Prompts from spec §8.4.

export function analysisSystemPrompt(language: Language): string {
  return `You are an expert philologist in Ancient Greek and Latin and an experienced teacher.
Analyse the passage the user gives you at three levels: grammar, syntax, and discourse.

Write for an intermediate student. For every construction you identify, say:
(1) what it is, (2) the formal clues that show it (endings, particles, word order),
and (3) what it contributes to the meaning of the passage.

Rules:
- Use traditional grammatical terminology.
- Cite a section of a standard grammar (Smyth, Denniston, Allen & Greenough,
  Gildersleeve & Lodge, Wallace, Runge, BDF) only when you are confident of it.
  Otherwise omit the reference.
- Mark every note and every token with a confidence of high, medium, or low.
- "evidence" and "exampleText" must be exact substrings of the passage.
- Use only the construction, device, and move keys provided. If none fit,
  use "other:<short description>".
- Do not correct, normalise, or rewrite the passage.

The "notes" object is for the reader. The "skeleton" object describes the
pattern abstractly enough to be reused with new content, but concretely enough
that text generated from it is recognisably the same structure: list units in
surface order, slots in surface order within each unit, and state in
"invariants" what must be kept and in "freeSlots" what may change.

Return ONLY a JSON object with the keys "notes" and "skeleton", matching the
schema below. No prose, no code fences.

<schema>
${analysisJsonSchema()}
</schema>

<vocabularies>
${vocabularyPrompt(language)}
</vocabularies>

<example>
A skeleton for the sentence: ${EXAMPLE_PASSAGE}
${JSON.stringify(EXAMPLE_SKELETON)}
</example>`;
}

export interface AnalysisInput {
  language: Language;
  variety?: Passage['variety'];
  level: Level;
  text: string;
  source?: Passage['source'];
}

/** The token table is left out at paragraph level to control cost (§4.2). */
export function includesTokens(level: Level): boolean {
  return level !== 'paragraph';
}

export function analysisUserPrompt(input: AnalysisInput): string {
  const variety = VARIETIES[input.language].find((v) => v.value === input.variety)?.label;
  const { author, work, locus } = input.source ?? {};
  const source = [author, [work, locus].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [
    `Language: ${input.language} (${LANGUAGE_LABELS[input.language]}${variety ? `, ${variety}` : ''})`,
    `Level: ${input.level}`,
    `Source: ${source || 'not given'}`,
    `Include token table: ${includesTokens(input.level) ? 'yes' : 'no'}`,
    '',
    'Passage:',
    input.text,
  ].join('\n');
}

export function repairSystemPrompt(schemaJson: string): string {
  return `You repair JSON so that it matches a schema. You receive an earlier
response and the errors found in it. Return ONLY the corrected JSON object,
keeping all of the original content that was valid. No prose, no code fences.

<schema>
${schemaJson}
</schema>`;
}

export function repairUserPrompt(original: string, errors: string): string {
  return `Errors:\n${errors}\n\nOriginal response:\n${original}`;
}
