import type { Language } from '@/types';

// Controlled vocabularies, spec §7.3. Inserted into the analysis prompt and
// used by the vocabulary check (§8.3). Anything outside them must be written
// "other:<short description>". Versioned with the skeleton schema.

export const VOCAB_VERSION = 1;

export const CONSTRUCTIONS: Record<Language, Record<string, string>> = {
  grc: {
    gen_absolute: 'Genitive absolute',
    circumstantial_ptc: 'Circumstantial participle (temporal, causal, concessive, etc.)',
    attributive_ptc: 'Attributive / substantival participle',
    supplementary_ptc: 'Supplementary participle (with τυγχάνω, λανθάνω, φαίνομαι...)',
    articular_inf: 'Articular infinitive',
    acc_inf_indirect_statement: 'Indirect statement with accusative + infinitive',
    ptc_indirect_statement: 'Indirect statement with participle',
    hoti_indirect_statement: 'Indirect statement with ὅτι / ὡς',
    purpose_clause: 'Purpose clause (ἵνα, ὅπως, ὡς + subj./opt.)',
    purpose_fut_ptc: 'Future participle of purpose',
    result_clause: 'Result clause (ὥστε + inf./indic.)',
    cond_simple: 'Simple conditional',
    cond_fmv: 'Future more vivid conditional',
    cond_flv: 'Future less vivid conditional',
    cond_contrary: 'Contrary-to-fact conditional',
    cond_general: 'General conditional',
    temporal_clause: 'Temporal clause',
    causal_clause: 'Causal clause',
    relative_clause: 'Relative clause',
    men_de_antithesis: 'μέν…δέ correlation',
    potential_optative: 'Potential optative with ἄν',
    deliberative_subj: 'Deliberative subjunctive',
    historic_present: 'Historic present',
  },
  la: {
    abl_absolute: 'Ablative absolute',
    acc_inf_indirect_statement: 'Indirect statement',
    indirect_question: 'Indirect question',
    ut_purpose: 'Purpose clause',
    ut_result: 'Result clause',
    rel_purpose: 'Relative clause of purpose',
    rel_characteristic: 'Relative clause of characteristic',
    cum_circumstantial: 'Circumstantial cum clause',
    cum_causal: 'Causal cum clause',
    cum_concessive: 'Concessive cum clause',
    fear_clause: 'Clause of fearing (ne / ut)',
    gerund: 'Gerund',
    gerundive_attraction: 'Gerundive (attraction)',
    gerundive_obligation: 'Gerundive of obligation',
    periphrastic_active: 'Active periphrastic',
    periphrastic_passive: 'Passive periphrastic',
    supine: 'Supine',
    historic_infinitive: 'Historic infinitive',
    dum_clause: 'dum / donec / quoad clause',
    cond_simple: 'Simple conditional',
    cond_fmv: 'Future more vivid conditional',
    cond_flv: 'Future less vivid conditional',
    cond_contrary: 'Contrary-to-fact conditional',
    relative_clause: 'Relative clause',
  },
};

export const DEVICES: Record<string, string> = {
  hyperbaton: 'Hyperbaton',
  chiasmus: 'Chiasmus',
  antithesis: 'Antithesis',
  isocolon: 'Isocolon',
  tricolon: 'Tricolon',
  anaphora: 'Anaphora',
  asyndeton: 'Asyndeton',
  polysyndeton: 'Polysyndeton',
  ellipsis: 'Ellipsis',
  periodic_structure: 'Periodic structure',
  loose_structure: 'Loose structure',
  litotes: 'Litotes',
  alliteration: 'Alliteration',
  parenthesis: 'Parenthesis',
};

export const MOVES: Record<string, string> = {
  setting: 'Setting',
  participant_introduction: 'Participant introduction',
  event: 'Event',
  background: 'Background',
  ground: 'Ground (γάρ / enim)',
  inference: 'Inference (οὖν / igitur)',
  contrast: 'Contrast',
  concession: 'Concession',
  elaboration: 'Elaboration',
  example: 'Example',
  climax: 'Climax',
  conclusion: 'Conclusion',
  speech_introduction: 'Speech introduction',
  transition: 'Transition',
};

export const OTHER_PREFIX = 'other:';

export type VocabKind = 'construction' | 'device' | 'move';

function table(kind: VocabKind, language: Language): Record<string, string> {
  if (kind === 'construction') return CONSTRUCTIONS[language];
  return kind === 'device' ? DEVICES : MOVES;
}

export function isValidKey(kind: VocabKind, key: string, language: Language): boolean {
  if (key.startsWith(OTHER_PREFIX)) return key.length > OTHER_PREFIX.length;
  return Object.hasOwn(table(kind, language), key);
}

/** Human label for a key: the vocabulary's label, or the text after "other:". */
export function labelFor(kind: VocabKind, key: string, language: Language): string {
  if (key.startsWith(OTHER_PREFIX)) return key.slice(OTHER_PREFIX.length).trim();
  return table(kind, language)[key] ?? key.replace(/_/g, ' ');
}

/** The vocabularies as prompt text. */
export function vocabularyPrompt(language: Language): string {
  const list = (t: Record<string, string>) =>
    Object.entries(t)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');
  return [
    `Construction keys (${language === 'grc' ? 'Greek' : 'Latin'}):`,
    list(CONSTRUCTIONS[language]),
    '',
    'Style device keys:',
    list(DEVICES),
    '',
    'Discourse move keys:',
    list(MOVES),
    '',
    `If nothing fits, use "${OTHER_PREFIX}<short description>", e.g. "${OTHER_PREFIX}accusative of respect".`,
  ].join('\n');
}
