import type { Language } from '@/types';

// Text normalisation, spec §10.3.
//
// `normalizeText` is applied to everything stored. `fold` is the accent- and
// breathing-insensitive form used for search and for the §8.3 checks.

/** Marks used for elision in the wild: apostrophe, psili, koronis, modifier apostrophe. */
const ELISION = /(?<=\p{L})['᾽᾿ʼ‘]/gu;

export function normalizeText(text: string, language: Language): string {
  let s = text.normalize('NFC'); // also maps oxia (U+1F71) to tonos (U+03AC)
  if (language === 'grc') {
    s = s.replace(ELISION, '’');
    s = s.replace(/σ(?![\p{L}\p{M}])/gu, 'ς'); // word-final sigma
  }
  return s;
}

function foldChar(ch: string, language: Language): string {
  let f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (language === 'grc') f = f.replace(/ς/g, 'σ');
  else f = f.replace(/v/g, 'u').replace(/j/g, 'i'); // macrons already gone with the marks
  return f;
}

/** Accent-, breathing-, case- and (for Latin) u/v, i/j-insensitive form. */
export function fold(text: string, language: Language): string {
  return Array.from(normalizeText(text, language), (c) => foldChar(c, language)).join('');
}

/**
 * All spans of `needle` in `haystack`, compared in folded form, as
 * [start, end) offsets into `haystack` (which should already be normalised).
 */
export function findSpans(haystack: string, needle: string, language: Language): [number, number][] {
  const target = fold(needle, language).trim();
  if (!target) return [];

  // Fold character by character, remembering where each folded char came from.
  let folded = '';
  const origin: number[] = []; // folded index -> haystack index
  let i = 0;
  for (const ch of haystack) {
    const f = foldChar(ch, language);
    for (let k = 0; k < f.length; k++) origin.push(i);
    folded += f;
    i += ch.length;
  }
  origin.push(haystack.length);

  const spans: [number, number][] = [];
  for (let at = folded.indexOf(target); at !== -1; at = folded.indexOf(target, at + target.length)) {
    const start = origin[at];
    const last = origin[at + target.length - 1];
    const end = last + (haystack.codePointAt(last)! > 0xffff ? 2 : 1);
    spans.push([start, end]);
  }
  return spans;
}

export interface WordSpan {
  text: string;
  start: number;
  end: number;
}

/** Words of a passage with their offsets. Elided words keep their apostrophe. */
export function words(text: string): WordSpan[] {
  return Array.from(text.matchAll(/[\p{L}\p{M}’]+/gu), (m) => ({
    text: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }));
}

export function wordCount(text: string): number {
  return words(text).length;
}
