import type { AnalysisNotes, Language, PatternSkeleton } from '@/types';
import { findSpans, fold, normalizeText, words } from '@/lib/greek/normalize';
import { isValidKey, type VocabKind } from '@/lib/llm/vocab';

// Client-side checks, spec §8.3: cheap verification of the model's output
// without a parser. They never block saving; the pattern card shows them as
// warning badges.

export type CheckKind = 'evidence' | 'token' | 'vocabulary';

export interface CheckWarning {
  kind: CheckKind;
  /** Where in the analysis, for the details list. */
  where: string;
  message: string;
}

/** Where a quoted string sits in the passage: exactly, only if accents are ignored, or not at all. */
export function locate(passage: string, quote: string, language: Language): 'exact' | 'folded' | 'missing' {
  const q = normalizeText(quote, language).trim();
  if (!q) return 'missing';
  if (normalizeText(passage, language).includes(q)) return 'exact';
  return findSpans(passage, q, language).length ? 'folded' : 'missing';
}

function evidenceWarnings(passage: string, notes: AnalysisNotes, skeleton: PatternSkeleton, language: Language) {
  const out: CheckWarning[] = [];
  const check = (quote: string, where: string) => {
    const at = locate(passage, quote, language);
    if (at === 'missing') out.push({ kind: 'evidence', where, message: `“${quote}” is not in the passage.` });
    if (at === 'folded')
      out.push({ kind: 'evidence', where, message: `“${quote}” matches the passage only if accents are ignored.` });
  };
  const sections = [
    ['Syntax', notes.syntax.constructions],
    ['Discourse', notes.discourse],
    ['Style', notes.style],
  ] as const;
  for (const [section, items] of sections) {
    for (const item of items) for (const e of item.evidence) check(e, `${section} · ${item.title}`);
  }
  for (const u of skeleton.units) {
    for (const s of u.slots) check(s.exampleText, `Skeleton · ${u.id} slot ${s.position}`);
  }
  return out;
}

function tokenWarnings(passage: string, notes: AnalysisNotes, language: Language): CheckWarning[] {
  if (!notes.tokens?.length) return [];
  const expected = words(normalizeText(passage, language)).map((w) => fold(w.text, language));
  const got = notes.tokens.map((t) => fold(t.form, language));

  const out: CheckWarning[] = [];
  const n = Math.max(expected.length, got.length);
  for (let i = 0; i < n; i++) {
    if (expected[i] === got[i]) continue;
    out.push({
      kind: 'token',
      where: `Tokens · word ${i + 1}`,
      message:
        got[i] === undefined
          ? `The token table stops before “${words(passage)[i]?.text}”.`
          : expected[i] === undefined
            ? `Extra token “${notes.tokens[i].form}” after the end of the passage.`
            : `Token “${notes.tokens[i].form}” does not match the passage word “${words(passage)[i].text}”.`,
    });
    break; // after the first misalignment every later token is off too
  }
  if (out.length && expected.length !== got.length) {
    out.push({
      kind: 'token',
      where: 'Tokens',
      message: `${got.length} tokens for ${expected.length} words in the passage.`,
    });
  }
  return out;
}

function vocabularyWarnings(skeleton: PatternSkeleton, language: Language): CheckWarning[] {
  const out: CheckWarning[] = [];
  const check = (kind: VocabKind, key: string, where: string) => {
    if (!isValidKey(kind, key, language)) {
      out.push({ kind: 'vocabulary', where, message: `“${key}” is not a known ${kind} key.` });
    }
  };
  for (const u of skeleton.units) if (u.construction) check('construction', u.construction, `Skeleton · ${u.id}`);
  for (const d of skeleton.devices) check('device', d.type, 'Skeleton · devices');
  for (const m of skeleton.discourse.moves) check('move', m.move, `Skeleton · ${m.unitId}`);
  return out;
}

export function checkAnalysis(
  passage: string,
  notes: AnalysisNotes,
  skeleton: PatternSkeleton,
  language: Language,
): CheckWarning[] {
  return [
    ...evidenceWarnings(passage, notes, skeleton, language),
    ...tokenWarnings(passage, notes, language),
    ...vocabularyWarnings(skeleton, language),
  ];
}

// Generation check, spec §8.3.

export type GenerationCheckKind = 'mapping' | 'connective' | 'unit';

export interface GenerationWarning {
  kind: GenerationCheckKind;
  message: string;
}

/** Whether `phrase` occurs as whole words in `text`, ignoring accents. */
function hasWords(text: string, phrase: string, language: Language): boolean {
  const seq = (s: string) => ` ${words(normalizeText(s, language)).map((w) => fold(w.text, language)).join(' ')} `;
  const needle = seq(phrase).trim();
  return needle !== '' && seq(text).includes(` ${needle} `);
}

export function checkGeneration(
  text: string,
  unitMapping: { unitId: string; text: string }[],
  skeleton: PatternSkeleton,
  language: Language,
): GenerationWarning[] {
  const out: GenerationWarning[] = [];
  const ids = new Set(skeleton.units.map((u) => u.id));

  for (const m of unitMapping) {
    if (!ids.has(m.unitId)) {
      out.push({ kind: 'unit', message: `The mapping names ${m.unitId}, which is not a unit of this pattern.` });
      continue;
    }
    const at = locate(text, m.text, language);
    if (at === 'missing') out.push({ kind: 'mapping', message: `${m.unitId}: “${m.text}” is not in the generated text.` });
    if (at === 'folded')
      out.push({ kind: 'mapping', message: `${m.unitId}: “${m.text}” matches the text only if accents are ignored.` });
  }

  const mapped = new Set(unitMapping.map((m) => m.unitId));
  for (const u of skeleton.units) {
    if (!mapped.has(u.id)) out.push({ kind: 'unit', message: `${u.id} has no words mapped to it.` });
    if (u.connective && !hasWords(text, u.connective, language)) {
      out.push({ kind: 'connective', message: `${u.id}: the connective “${u.connective}” is missing.` });
    }
  }
  return out;
}
