// Beta Code → polytonic Unicode, spec §10.1.
//
// Diacritics follow the letter, breathing before accent (a)/ → ἄ). For
// capitals they come between the asterisk and the letter (*)a → Ἀ); marks
// after a capital are accepted too (*a| → ᾼ). Letters are case-insensitive;
// only * makes a capital. A final s becomes ς. Anything else, including Greek
// already in Unicode, passes through unchanged, so pasting Unicode always works.

const LETTERS: Record<string, string> = {
  a: 'α', b: 'β', g: 'γ', d: 'δ', e: 'ε', z: 'ζ', h: 'η', q: 'θ',
  i: 'ι', k: 'κ', l: 'λ', m: 'μ', n: 'ν', c: 'ξ', o: 'ο', p: 'π',
  r: 'ρ', s: 'σ', t: 'τ', u: 'υ', f: 'φ', x: 'χ', y: 'ψ', w: 'ω',
  v: 'ϝ', // digamma (TLG)
};

// Combining marks, emitted in the order NFC composes them into precomposed
// letters: diaeresis, breathing, accent, then iota subscript.
const MARKS: Record<string, { mark: string; rank: number }> = {
  '+': { mark: '̈', rank: 0 }, // diaeresis
  ')': { mark: '̓', rank: 1 }, // smooth breathing
  '(': { mark: '̔', rank: 1 }, // rough breathing
  '/': { mark: '́', rank: 2 }, // acute
  '\\': { mark: '̀', rank: 2 }, // grave
  '=': { mark: '͂', rank: 2 }, // circumflex (perispomeni)
  '|': { mark: 'ͅ', rank: 3 }, // iota subscript
};

const PUNCTUATION: Record<string, string> = {
  ':': '·', // ano teleia (U+0387 normalises to U+00B7)
  "'": '’', // elision
};

const isMark = (c: string | undefined) => c !== undefined && Object.hasOwn(MARKS, c);
const isLetter = (c: string | undefined) => c !== undefined && Object.hasOwn(LETTERS, c.toLowerCase());

function combine(base: string, marks: string[]): string {
  const sorted = marks
    .map((m) => MARKS[m])
    .sort((a, b) => a.rank - b.rank)
    .map((m) => m.mark);
  return (base + [...new Set(sorted)].join('')).normalize('NFC');
}

export function betaToUnicode(beta: string): string {
  const chars = [...beta];
  let out = '';
  let i = 0;

  while (i < chars.length) {
    const c = chars[i];

    if (c === '*') {
      // * [marks] letter [marks]
      let j = i + 1;
      const marks: string[] = [];
      while (isMark(chars[j])) marks.push(chars[j++]);
      if (!isLetter(chars[j])) {
        out += c + marks.join(''); // a stray asterisk: leave it visible
        i = j;
        continue;
      }
      const letter = LETTERS[chars[j].toLowerCase()].toUpperCase();
      j++;
      while (isMark(chars[j])) marks.push(chars[j++]);
      out += combine(letter, marks);
      i = j;
      continue;
    }

    if (isLetter(c)) {
      const lower = c.toLowerCase();
      let j = i + 1;
      // s1 / s2 / s3: explicit medial, final and lunate sigma.
      if (lower === 's' && /[123]/.test(chars[j] ?? '')) {
        out += { '1': 'σ', '2': 'ς', '3': 'ϲ' }[chars[j] as '1' | '2' | '3'];
        i = j + 1;
        continue;
      }
      const marks: string[] = [];
      while (isMark(chars[j])) marks.push(chars[j++]);
      let letter = LETTERS[lower];
      // Final sigma: s not followed by another letter (or a capital).
      if (lower === 's' && !isLetter(chars[j]) && chars[j] !== '*') letter = 'ς';
      out += combine(letter, marks);
      i = j;
      continue;
    }

    out += PUNCTUATION[c] ?? c;
    i++;
  }
  return out.normalize('NFC');
}
