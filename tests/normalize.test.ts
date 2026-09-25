import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findSpans, fold, normalizeText, wordCount, words } from '../src/lib/greek/normalize.ts';

test('NFC: oxia becomes tonos, decomposed input is composed', () => {
  assert.equal(normalizeText('ά', 'grc'), 'ά'); // ά with oxia -> with tonos
  assert.equal(normalizeText('ἄ', 'grc'), 'ἄ');
});

test('word-final sigma', () => {
  assert.equal(normalizeText('λογοσ καὶ σοφοσ.', 'grc'), 'λογος καὶ σοφος.');
  assert.equal(normalizeText('σοφός', 'grc'), 'σοφός'); // medial and initial σ untouched
});

test('elision marks become U+2019', () => {
  for (const mark of ["'", '᾽', '᾿', 'ʼ', '‘']) {
    assert.equal(normalizeText(`δ${mark} ἐγώ`, 'grc'), 'δ’ ἐγώ', `mark U+${mark.codePointAt(0)!.toString(16)}`);
  }
});

test('Latin is only NFC-normalised', () => {
  assert.equal(normalizeText("Gallia est omnis divisa in partes tres", 'la'), 'Gallia est omnis divisa in partes tres');
});

test('folding ignores accents, breathings, case and final sigma', () => {
  assert.equal(fold('Ἀρταξέρξης', 'grc'), fold('αρταξερξησ', 'grc'));
  assert.equal(fold('μὲν', 'grc'), fold('μέν', 'grc'));
  assert.equal(fold('ᾠδῇ', 'grc'), 'ωδη');
});

test('Latin folding: macrons, u/v, i/j', () => {
  assert.equal(fold('Iūlius vēnit', 'la'), fold('julius uenit', 'la'));
});

test('findSpans maps folded matches back to the original text', () => {
  const text = 'πρεσβύτερος μὲν Ἀρταξέρξης, νεώτερος δὲ Κῦρος.';
  const [[s, e]] = findSpans(text, 'μεν', 'grc');
  assert.equal(text.slice(s, e), 'μὲν');
  assert.deepEqual(
    findSpans('καὶ τὸ καὶ', 'καί', 'grc').map(([a, b]) => [a, b]),
    [
      [0, 3],
      [7, 10],
    ],
  );
  assert.deepEqual(findSpans(text, 'Δαρεῖος', 'grc'), []);
});

test('words keep elision and drop punctuation', () => {
  assert.deepEqual(
    words('δ’ ἐγώ, φίλε· τί;').map((w) => w.text),
    ['δ’', 'ἐγώ', 'φίλε', 'τί'],
  );
  assert.equal(wordCount('Δαρείου καὶ Παρυσάτιδος γίγνονται παῖδες δύο, πρεσβύτερος μὲν Ἀρταξέρξης, νεώτερος δὲ Κῦρος.'), 12);
});
