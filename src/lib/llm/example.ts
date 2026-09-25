// The worked example from spec §7.2: Xenophon, Anabasis 1.1.1. Shown to the
// model as a model skeleton, and used as a test fixture.

export const EXAMPLE_PASSAGE =
  'Δαρείου καὶ Παρυσάτιδος γίγνονται παῖδες δύο, πρεσβύτερος μὲν Ἀρταξέρξης, νεώτερος δὲ Κῦρος.';

export const EXAMPLE_SKELETON = {
  schemaVersion: 1,
  language: 'grc',
  variety: 'attic',
  level: 'sentence',
  summary: 'Fronted genitive of origin + historic present + numeral subject distributed by μέν…δέ apposition',
  units: [
    {
      id: 'U1',
      kind: 'clause',
      role: 'main',
      verb: {
        finite: true,
        mood: 'indicative',
        tense: 'present',
        voice: 'middle',
        person: 3,
        number: 'plural',
        specialUse: 'historic_present',
      },
      slots: [
        {
          position: 1,
          function: 'genitive_modifier',
          case: 'genitive',
          realization: 'coordinated_proper_nouns',
          informationStatus: 'topic',
          exampleText: 'Δαρείου καὶ Παρυσάτιδος',
        },
        { position: 2, function: 'verb', exampleText: 'γίγνονται' },
        {
          position: 3,
          function: 'subject',
          case: 'nominative',
          realization: 'noun_plus_numeral',
          informationStatus: 'focus',
          exampleText: 'παῖδες δύο',
        },
      ],
    },
    {
      id: 'U2',
      kind: 'phrase',
      role: 'appositive',
      headsTo: 'U1',
      construction: 'men_de_antithesis',
      connective: 'μέν',
      slots: [
        {
          position: 1,
          function: 'attribute',
          case: 'nominative',
          realization: 'comparative_adjective',
          informationStatus: 'contrastive_topic',
          exampleText: 'πρεσβύτερος',
        },
        { position: 2, function: 'particle', exampleText: 'μὲν' },
        { position: 3, function: 'apposition', case: 'nominative', realization: 'proper_noun', exampleText: 'Ἀρταξέρξης' },
      ],
    },
    {
      id: 'U3',
      kind: 'phrase',
      role: 'appositive',
      headsTo: 'U1',
      construction: 'men_de_antithesis',
      connective: 'δέ',
      slots: [
        {
          position: 1,
          function: 'attribute',
          case: 'nominative',
          realization: 'comparative_adjective',
          informationStatus: 'contrastive_topic',
          exampleText: 'νεώτερος',
        },
        { position: 2, function: 'particle', exampleText: 'δὲ' },
        { position: 3, function: 'apposition', case: 'nominative', realization: 'proper_noun', exampleText: 'Κῦρος' },
      ],
    },
  ],
  devices: [
    {
      type: 'antithesis',
      span: ['U2', 'U3'],
      description: 'Two parallel comparative + name pairs set against each other by μέν…δέ.',
    },
    {
      type: 'ellipsis',
      span: ['U2', 'U3'],
      description: 'No verb in the appositive members; the structure of U1 carries them.',
    },
    {
      type: 'isocolon',
      span: ['U2', 'U3'],
      description: 'The two members are near-equal in length and identical in shape.',
    },
  ],
  discourse: {
    function: 'narrative_opening',
    moves: [
      { unitId: 'U1', move: 'participant_introduction' },
      { unitId: 'U2', move: 'elaboration' },
      { unitId: 'U3', move: 'elaboration' },
    ],
    informationStructure:
      'The parents are fronted as the frame of the narrative; the two sons are the new information, placed after the verb, then individuated one by one.',
    cohesion: ['δύο sets up a set of two that μέν…δέ then distributes member by member.'],
    register: 'plain historical narrative',
  },
  invariants: [
    'Genitive of origin fronted before the verb',
    'Historic present of a verb of coming-to-be or existing',
    'Numeral in the subject matching the number of appositive members',
    'Appositive members in the shape [adjective] μέν [name], [adjective] δέ [name], with no verb',
  ],
  freeSlots: [
    'Names of the parents and children',
    'The choice of verb within the same semantic class',
    'The contrasting adjectives (e.g. older/younger, wiser/bolder)',
  ],
} as const;
