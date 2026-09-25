// Shared data model. Mirrors docs/SPEC.md §6 (entities, notes) and §7 (skeleton).

export type Language = 'grc' | 'la';
export type Level = 'sentence' | 'period' | 'paragraph';
export type Confidence = 'high' | 'medium' | 'low';
export type Variety =
  | 'attic'
  | 'ionic'
  | 'homeric'
  | 'koine'
  | 'classical_latin'
  | 'late_latin'
  | 'other';

// §6.1 Entities

export interface Passage {
  id: string; // uuid
  language: Language;
  variety?: Variety;
  text: string; // NFC-normalised
  source?: {
    author?: string;
    work?: string;
    locus?: string;
  };
  createdAt: number;
}

export interface Entry {
  id: string;
  passageId: string;
  language: Language;
  level: Level;
  title: string; // user-editable; defaults to skeleton.summary
  notes: AnalysisNotes;
  skeleton: PatternSkeleton;
  tags: string[];
  constructionKeys: string[]; // denormalised from skeleton, for indexing
  deviceKeys: string[]; // denormalised from skeleton, for indexing
  userEdited: boolean;
  model: string; // model that produced the analysis
  createdAt: number;
  updatedAt: number;
}

export interface Generation {
  id: string;
  entryId: string;
  request: {
    topic?: string;
    constraints?: string;
    variations: number; // 1–3
  };
  outputs: GeneratedText[];
  model: string;
  createdAt: number;
  /** Set when an output is starred or deleted, so import can merge (§13). */
  updatedAt?: number;
}

export interface GeneratedText {
  text: string; // NFC-normalised
  literalTranslation: string;
  unitMapping: { unitId: string; text: string }[];
  deviations: string[];
  label: 'composition'; // always; never presented as authentic text
  starred: boolean;
}

export interface Setting {
  key: string;
  value: unknown;
}

// §6.2 Analysis notes

export interface AnalysisNotes {
  overview: string;
  translation: {
    literal: string;
    idiomatic: string;
  };
  tokens?: TokenAnalysis[]; // omitted at paragraph level
  syntax: {
    clauseMap: string;
    constructions: NoteItem[];
  };
  discourse: NoteItem[];
  style: NoteItem[];
}

export interface TokenAnalysis {
  index: number;
  form: string;
  lemma: string;
  pos: string;
  parse: string;
  gloss: string;
  function: string;
  headIndex?: number;
  confidence: Confidence;
}

export type GrammarReference =
  | 'Smyth'
  | 'Denniston'
  | 'Allen & Greenough'
  | 'Gildersleeve & Lodge'
  | 'Wallace'
  | 'Runge'
  | 'BDF'
  | 'other';

export interface NoteItem {
  title: string;
  explanation: string; // markdown
  evidence: string[]; // exact words in the passage
  reference?: {
    grammar: GrammarReference;
    section: string;
    verified: boolean; // always false when produced by the LLM (§12)
  };
  confidence: Confidence;
}

// §7.1 Pattern skeleton

export interface PatternSkeleton {
  schemaVersion: 1;
  language: Language;
  variety?: Variety;
  level: Level;
  summary: string;
  units: PatternUnit[]; // in surface order
  devices: StyleDevice[];
  discourse: DiscourseProfile;
  invariants: string[];
  freeSlots: string[];
  children?: PatternSkeleton[]; // paragraph level (v2)
}

export interface PatternUnit {
  id: string; // "U1", "U2"...
  kind: 'clause' | 'phrase';
  role:
    | 'main'
    | 'subordinate'
    | 'participial'
    | 'infinitival'
    | 'absolute'
    | 'appositive'
    | 'parenthetical'
    | 'relative';
  construction?: string; // controlled vocabulary key (§7.3)
  headsTo?: string;
  connective?: string;
  verb?: VerbConstraint;
  slots: Slot[]; // in surface order
  note?: string;
}

export interface VerbConstraint {
  finite: boolean;
  mood?:
    | 'indicative'
    | 'subjunctive'
    | 'optative'
    | 'imperative'
    | 'infinitive'
    | 'participle'
    | 'gerund'
    | 'gerundive'
    | 'supine';
  tense?:
    | 'present'
    | 'imperfect'
    | 'future'
    | 'aorist'
    | 'perfect'
    | 'pluperfect'
    | 'future_perfect';
  voice?: 'active' | 'middle' | 'passive' | 'middle_passive' | 'deponent';
  person?: 1 | 2 | 3;
  number?: 'singular' | 'dual' | 'plural';
  specialUse?: string;
}

export interface Slot {
  position: number;
  function:
    | 'subject'
    | 'verb'
    | 'object'
    | 'indirect_object'
    | 'predicate'
    | 'genitive_modifier'
    | 'attribute'
    | 'apposition'
    | 'adverbial'
    | 'prepositional_phrase'
    | 'particle'
    | 'conjunction'
    | 'vocative'
    | 'other';
  case?: 'nominative' | 'genitive' | 'dative' | 'accusative' | 'ablative' | 'vocative';
  realization?: string;
  informationStatus?: 'topic' | 'contrastive_topic' | 'focus' | 'neutral';
  exampleText: string;
}

export interface StyleDevice {
  type: string; // controlled vocabulary key (§7.3)
  span: string[]; // unit ids
  description: string;
}

export interface DiscourseProfile {
  function: string;
  moves: { unitId: string; move: string }[];
  informationStructure: string;
  cohesion: string[];
  register?: string;
}
