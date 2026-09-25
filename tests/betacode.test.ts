import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { betaToUnicode as b } from '../src/lib/greek/betacode.ts';
import { EXAMPLE_PASSAGE } from '../src/lib/llm/example.ts';

describe('Beta Code', () => {
  test('every letter', () => {
    assert.equal(b('abgdezhqiklmncoprstufxyw'), 'αβγδεζηθικλμνξοπρστυφχψω'); // s before t is medial
    assert.equal(b('v'), 'ϝ');
  });

  test('breathings, accents and their combinations', () => {
    const cases: [string, string][] = [
      ['a)', 'ἀ'], ['a(', 'ἁ'], ['a/', 'ά'], ['a\\', 'ὰ'], ['a=', 'ᾶ'],
      ['a)/', 'ἄ'], ['a(/', 'ἅ'], ['a)\\', 'ἂ'], ['a(\\', 'ἃ'], ['a)=', 'ἆ'], ['a(=', 'ἇ'],
      ['e)/', 'ἔ'], ['h(=', 'ἧ'], ['i)/', 'ἴ'], ['o(\\', 'ὃ'], ['u(=', 'ὗ'], ['w)=', 'ὦ'], ['r(', 'ῥ'],
    ];
    for (const [beta, uni] of cases) assert.equal(b(beta), uni, beta);
  });

  test('accent written before breathing still composes correctly', () => {
    assert.equal(b('a/)'), 'ἄ');
  });

  test('iota subscript, alone and with breathing and accent', () => {
    assert.equal(b('a|'), 'ᾳ');
    assert.equal(b('h|='), 'ῇ');
    assert.equal(b('w)/|'), 'ᾤ');
    assert.equal(b('a(=|'), 'ᾇ');
  });

  test('diaeresis, alone and with an accent', () => {
    assert.equal(b('i+'), 'ϊ');
    assert.equal(b('u+/'), 'ΰ');
    assert.equal(b('i+\\'), 'ῒ');
  });

  test('capitals take diacritics between the asterisk and the letter', () => {
    assert.equal(b('*a'), 'Α');
    assert.equal(b('*)a'), 'Ἀ');
    assert.equal(b('*(/a'), 'Ἅ');
    assert.equal(b('*)=w'), 'Ὦ');
    assert.equal(b('*(r'), 'Ῥ');
    assert.equal(b('*a|'), 'ᾼ'); // iota adscript form after a capital
  });

  test('letters are case-insensitive; only * makes a capital', () => {
    assert.equal(b('LOGOS'), 'λογος');
    assert.equal(b('*LOGOS'), 'Λογος');
  });

  test('final sigma is automatic; s1/s2/s3 are explicit', () => {
    assert.equal(b('lo/gos'), 'λόγος');
    assert.equal(b('lo/gos kai\\'), 'λόγος καὶ');
    assert.equal(b('lo/gos,'), 'λόγος,');
    assert.equal(b('sofo/s'), 'σοφός');
    assert.equal(b('s1'), 'σ');
    assert.equal(b('s2'), 'ς');
    assert.equal(b('s3'), 'ϲ');
  });

  test('punctuation', () => {
    assert.equal(b('ti/;'), 'τί;');
    assert.equal(b('fi/le:'), 'φίλε·');
    assert.equal(b("d' e)gw/"), 'δ’ ἐγώ');
  });

  test('Unicode Greek, digits and spaces pass through', () => {
    assert.equal(b('ἄνθρωπος 12 a)/nqrwpos'), 'ἄνθρωπος 12 ἄνθρωπος');
  });

  test('a stray asterisk is left visible', () => {
    assert.equal(b('* '), '* ');
  });

  test('the Anabasis sentence', () => {
    assert.equal(
      b('*darei/ou kai\\ *parusa/tidos gi/gnontai pai=des du/o, presbu/teros me\\n *)artace/rchs, new/teros de\\ *ku=ros.'),
      EXAMPLE_PASSAGE,
    );
  });

  test('output is NFC', () => {
    const out = b('*)artace/rchs w)/|');
    assert.equal(out, out.normalize('NFC'));
  });
});
