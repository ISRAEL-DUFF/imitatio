import { EXAMPLE_PASSAGE, EXAMPLE_SKELETON } from '../../src/lib/llm/example.ts';

// A complete, valid analysis response for Anabasis 1.1.1, as the model would
// return it: the spec's skeleton (§7.2) plus notes and a token table.

export const PASSAGE = EXAMPLE_PASSAGE;

export const NOTES = {
  overview:
    'Xenophon opens the Anabasis by naming the parents first and then introducing their two sons. The sons are then distinguished one by one in a balanced μέν…δέ pair.',
  translation: {
    literal: 'Of Darius and Parysatis are born sons two, older on the one hand Artaxerxes, younger on the other Cyrus.',
    idiomatic: 'Darius and Parysatis had two sons: the elder was Artaxerxes, the younger Cyrus.',
  },
  tokens: [
    ['Δαρείου', 'Δαρεῖος', 'noun', 'gen. sg. masc.', 'of Darius', 'genitive of origin with παῖδες', 4],
    ['καὶ', 'καί', 'conjunction', '', 'and', 'joins the two genitives', 0],
    ['Παρυσάτιδος', 'Παρύσατις', 'noun', 'gen. sg. fem.', 'of Parysatis', 'genitive of origin, coordinated with Δαρείου', 0],
    ['γίγνονται', 'γίγνομαι', 'verb', 'pres. mid. ind. 3 pl.', 'are born', 'main verb, historic present', undefined],
    ['παῖδες', 'παῖς', 'noun', 'nom. pl. masc.', 'children, sons', 'subject of γίγνονται', 3],
    ['δύο', 'δύο', 'numeral', 'nom.', 'two', 'attributive with παῖδες', 4],
    ['πρεσβύτερος', 'πρέσβυς', 'adjective', 'comp. nom. sg. masc.', 'older', 'attributive with Ἀρταξέρξης', 8],
    ['μὲν', 'μέν', 'particle', '', 'on the one hand', 'opens the μέν…δέ contrast', 6],
    ['Ἀρταξέρξης', 'Ἀρταξέρξης', 'noun', 'nom. sg. masc.', 'Artaxerxes', 'in apposition to παῖδες', 4],
    ['νεώτερος', 'νέος', 'adjective', 'comp. nom. sg. masc.', 'younger', 'attributive with Κῦρος', 11],
    ['δὲ', 'δέ', 'particle', '', 'on the other', 'answers μέν', 9],
    ['Κῦρος', 'Κῦρος', 'noun', 'nom. sg. masc.', 'Cyrus', 'in apposition to παῖδες', 4],
  ].map(([form, lemma, pos, parse, gloss, fn, head], index) => ({
    index,
    form,
    lemma,
    pos,
    parse,
    gloss,
    function: fn,
    ...(head === undefined ? {} : { headIndex: head }),
    confidence: 'high',
  })),
  syntax: {
    clauseMap: 'Main clause: [Δαρείου καὶ Παρυσάτιδος] γίγνονται [παῖδες δύο]\n  apposition 1: πρεσβύτερος μὲν Ἀρταξέρξης\n  apposition 2: νεώτερος δὲ Κῦρος',
    constructions: [
      {
        title: 'Historic present',
        explanation: 'The present **γίγνονται** narrates a past event, giving the opening immediacy.',
        evidence: ['γίγνονται'],
        reference: { grammar: 'Smyth', section: '§1883' },
        confidence: 'high',
      },
      {
        title: 'μέν…δέ correlation',
        explanation: 'The particles split the two sons into balanced, contrasting members.',
        evidence: ['μὲν', 'δὲ'],
        confidence: 'high',
      },
    ],
  },
  discourse: [
    {
      title: 'Participant introduction',
      explanation: 'The parents frame the narrative; the sons are the new information after the verb.',
      evidence: ['Δαρείου καὶ Παρυσάτιδος', 'παῖδες δύο'],
      confidence: 'medium',
    },
  ],
  style: [
    {
      title: 'Isocolon',
      explanation: 'The two appositive members have the same shape and nearly the same length.',
      evidence: ['πρεσβύτερος μὲν Ἀρταξέρξης', 'νεώτερος δὲ Κῦρος'],
      confidence: 'high',
    },
  ],
};

/** What a well-behaved model returns: notes plus a skeleton, with no app-owned fields. */
export function response(overrides: Record<string, unknown> = {}) {
  const { schemaVersion: _v, language: _l, level: _lv, ...skeleton } = EXAMPLE_SKELETON;
  return { notes: NOTES, skeleton, ...overrides };
}
