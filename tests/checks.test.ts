import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAnalysis, locate } from '../src/lib/checks.ts';
import { EXAMPLE_SKELETON } from '../src/lib/llm/example.ts';
import type { AnalysisNotes, PatternSkeleton } from '../src/types/index.ts';
import { NOTES, PASSAGE } from './fixtures/anabasis.ts';

const notes = () => structuredClone(NOTES) as unknown as AnalysisNotes;
const skeleton = () => structuredClone(EXAMPLE_SKELETON) as unknown as PatternSkeleton;

test('locate distinguishes exact, accent-only and missing quotes', () => {
  assert.equal(locate(PASSAGE, 'πρεσβύτερος μὲν', 'grc'), 'exact');
  assert.equal(locate(PASSAGE, 'πρεσβύτερος μέν', 'grc'), 'folded');
  assert.equal(locate(PASSAGE, 'Δαρεῖος', 'grc'), 'missing');
  assert.equal(locate(PASSAGE, '  ', 'grc'), 'missing');
});

test('the spec example is clean', () => {
  assert.deepEqual(checkAnalysis(PASSAGE, notes(), skeleton(), 'grc'), []);
});

test('evidence not in the passage is flagged', () => {
  const n = notes();
  n.discourse[0].evidence.push('Κῦρος ὁ νεώτερος');
  const s = skeleton();
  s.units[0].slots[0].exampleText = 'Δαρείου τε';
  const w = checkAnalysis(PASSAGE, n, s, 'grc');
  assert.deepEqual(
    w.map((x) => [x.kind, x.where]),
    [
      ['evidence', 'Discourse · Participant introduction'],
      ['evidence', 'Skeleton · U1 slot 1'],
    ],
  );
});

test('a quote that differs only in accents is flagged separately', () => {
  const n = notes();
  n.style[0].evidence = ['πρεσβύτερος μέν Ἀρταξέρξης'];
  const [w] = checkAnalysis(PASSAGE, n, skeleton(), 'grc');
  assert.match(w.message, /only if accents are ignored/);
});

test('token misalignment is reported once, with the count', () => {
  const n = notes();
  n.tokens!.splice(1, 1); // drop καὶ
  const w = checkAnalysis(PASSAGE, n, skeleton(), 'grc').filter((x) => x.kind === 'token');
  assert.equal(w.length, 2);
  assert.match(w[0].message, /Παρυσάτιδος.*καὶ/);
  assert.equal(w[1].message, '11 tokens for 12 words in the passage.');
});

test('tokens are compared ignoring accents', () => {
  const n = notes();
  n.tokens![7].form = 'μέν';
  assert.deepEqual(checkAnalysis(PASSAGE, n, skeleton(), 'grc'), []);
});

test('unknown vocabulary keys are flagged; other: keys are allowed', () => {
  const s = skeleton();
  s.units[1].construction = 'men_de'; // typo
  s.units[2].construction = 'other:balanced apposition';
  s.devices[0].type = 'antithesys';
  s.discourse.moves[0].move = 'intro';
  const w = checkAnalysis(PASSAGE, notes(), s, 'grc').map((x) => x.message);
  assert.deepEqual(w, [
    '“men_de” is not a known construction key.',
    '“antithesys” is not a known device key.',
    '“intro” is not a known move key.',
  ]);
});

test('Latin keys are checked against the Latin vocabulary', () => {
  const s = skeleton();
  s.units[1].construction = 'gen_absolute';
  s.units[2].construction = 'abl_absolute';
  const w = checkAnalysis(PASSAGE, notes(), s, 'la').filter((x) => x.kind === 'vocabulary');
  assert.deepEqual(w.map((x) => x.message), ['“gen_absolute” is not a known construction key.']);
});
