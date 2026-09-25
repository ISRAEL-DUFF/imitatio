import { z } from 'zod';

// Zod schemas for the analysis response (spec §6.2, §7.1). They validate
// every LLM response before it is shown or saved (§8.2), and their JSON Schema
// form is what the prompt shows the model, so the two cannot drift apart.
//
// Fields the app owns are not asked of the model: reference.verified (always
// false, §12) and the skeleton's schemaVersion, language and level. analyze()
// adds them, and its return types (AnalysisNotes, PatternSkeleton) are the
// compile-time check that validated output fits the data model.
//
// Controlled-vocabulary keys are plain strings here on purpose: an unknown key
// is flagged by the vocabulary check (§8.3), not rejected.

const confidence = z.enum(['high', 'medium', 'low']);
const variety = z.enum(['attic', 'ionic', 'homeric', 'koine', 'classical_latin', 'late_latin', 'other']);

const noteItem = z.object({
  title: z.string().describe('Name of the construction, discourse feature or device'),
  explanation: z.string().describe('The teaching note, in Markdown'),
  evidence: z.array(z.string()).describe('Exact substrings of the passage this note refers to'),
  reference: z
    .object({
      grammar: z.enum(['Smyth', 'Denniston', 'Allen & Greenough', 'Gildersleeve & Lodge', 'Wallace', 'Runge', 'BDF', 'other']),
      section: z.string().describe('e.g. "§2070"'),
    })
    .optional()
    .describe('Only when confident of the section; otherwise omit'),
  confidence,
});

const token = z.object({
  index: z.number().int(),
  form: z.string().describe('The word exactly as it appears in the passage'),
  lemma: z.string(),
  pos: z.string(),
  parse: z.string().describe('e.g. "aor. act. ptc. nom. sg. masc."'),
  gloss: z.string(),
  function: z.string().describe('e.g. "subject of γίγνονται"'),
  headIndex: z.number().int().optional(),
  confidence,
});

export const notesSchema = z.object({
  overview: z.string().describe('2–4 sentence plain-language summary'),
  translation: z.object({ literal: z.string(), idiomatic: z.string() }),
  tokens: z.array(token).optional().describe('One entry per word, in order. Omit at paragraph level.'),
  syntax: z.object({
    clauseMap: z.string().describe('Indented outline of the clause structure'),
    constructions: z.array(noteItem),
  }),
  discourse: z.array(noteItem).describe('Function, information structure, cohesion, particles'),
  style: z.array(noteItem).describe('Devices, rhythm, periodicity'),
});

const verb = z.object({
  finite: z.boolean(),
  mood: z
    .enum(['indicative', 'subjunctive', 'optative', 'imperative', 'infinitive', 'participle', 'gerund', 'gerundive', 'supine'])
    .optional(),
  tense: z.enum(['present', 'imperfect', 'future', 'aorist', 'perfect', 'pluperfect', 'future_perfect']).optional(),
  voice: z.enum(['active', 'middle', 'passive', 'middle_passive', 'deponent']).optional(),
  person: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  number: z.enum(['singular', 'dual', 'plural']).optional(),
  specialUse: z.string().optional().describe('e.g. "historic_present", "gnomic_aorist"'),
});

const slot = z.object({
  position: z.number().int(),
  function: z.enum([
    'subject',
    'verb',
    'object',
    'indirect_object',
    'predicate',
    'genitive_modifier',
    'attribute',
    'apposition',
    'adverbial',
    'prepositional_phrase',
    'particle',
    'conjunction',
    'vocative',
    'other',
  ]),
  case: z.enum(['nominative', 'genitive', 'dative', 'accusative', 'ablative', 'vocative']).optional(),
  realization: z.string().optional().describe('e.g. "proper_noun", "noun_plus_numeral"'),
  informationStatus: z.enum(['topic', 'contrastive_topic', 'focus', 'neutral']).optional(),
  exampleText: z.string().describe('Exact substring of the passage filling this slot'),
});

const unit = z.object({
  id: z.string().describe('"U1", "U2"...'),
  kind: z.enum(['clause', 'phrase']),
  role: z.enum(['main', 'subordinate', 'participial', 'infinitival', 'absolute', 'appositive', 'parenthetical', 'relative']),
  construction: z.string().optional().describe('Construction key from the vocabulary'),
  headsTo: z.string().optional().describe('id of the unit this one depends on'),
  connective: z.string().optional().describe('μέν, δέ, γάρ, autem, enim, cum...'),
  verb: verb.optional(),
  slots: z.array(slot).describe('In surface order'),
  note: z.string().optional(),
});

export const skeletonSchema = z.object({
  // Set by the app from the request; accepted if the model echoes them.
  schemaVersion: z.literal(1).optional(),
  language: z.enum(['grc', 'la']).optional(),
  variety: variety.optional(),
  level: z.enum(['sentence', 'period', 'paragraph']).optional(),
  summary: z.string().describe('One-line formula of the pattern'),
  units: z.array(unit).min(1).describe('In surface order'),
  devices: z.array(
    z.object({
      type: z.string().describe('Device key from the vocabulary'),
      span: z.array(z.string()).describe('Unit ids'),
      description: z.string(),
    }),
  ),
  discourse: z.object({
    function: z.string().describe('e.g. "narrative_opening", "argumentative_ground"'),
    moves: z.array(z.object({ unitId: z.string(), move: z.string().describe('Move key from the vocabulary') })),
    informationStructure: z.string(),
    cohesion: z.array(z.string()),
    register: z.string().optional(),
  }),
  invariants: z.array(z.string()).describe('What MUST be preserved in generation'),
  freeSlots: z.array(z.string()).describe('What MAY change in generation'),
});

export const analysisResponseSchema = z.object({ notes: notesSchema, skeleton: skeletonSchema });

export type AnalysisResponse = z.output<typeof analysisResponseSchema>;

/** The response schema as JSON Schema, for the prompt. */
export function analysisJsonSchema(): string {
  const { $schema: _, ...schema } = z.toJSONSchema(analysisResponseSchema) as Record<string, unknown>;
  return JSON.stringify(schema);
}

/** Models often write null for "absent"; the schema uses optional keys. */
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, stripNulls(v)]),
    );
  }
  return value;
}
