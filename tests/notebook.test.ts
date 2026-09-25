import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ImitatioDB } from '../src/lib/db/db.ts';
import { deleteEntry, normalizeTags, saveAnalysis, updateEntry } from '../src/lib/db/entries.ts';
import { finalize } from '../src/lib/llm/analyze.ts';
import { EXAMPLE_SKELETON } from '../src/lib/llm/example.ts';
import { searchFold } from '../src/lib/greek/normalize.ts';
import {
  EMPTY_QUERY,
  facets,
  filterItems,
  isFiltered,
  paramsFromQuery,
  queryFromParams,
  toItem,
  type NotebookItem,
} from '../src/features/notebook/search.ts';
import type { Entry, Passage, PatternSkeleton } from '../src/types/index.ts';
import { NOTES, PASSAGE, response } from './fixtures/anabasis.ts';

function item(over: { id: string; entry?: Partial<Entry>; passage?: Partial<Passage> }): NotebookItem {
  const skeleton = structuredClone(EXAMPLE_SKELETON) as unknown as PatternSkeleton;
  const passage: Passage = {
    id: `p-${over.id}`,
    language: 'grc',
    text: PASSAGE,
    source: { author: 'Xenophon', work: 'Anabasis', locus: '1.1.1' },
    createdAt: 0,
    ...over.passage,
  };
  const entry: Entry = {
    id: over.id,
    passageId: passage.id,
    language: 'grc',
    level: 'sentence',
    title: 'Anabasis opening',
    notes: structuredClone(NOTES) as unknown as Entry['notes'],
    skeleton,
    tags: [],
    constructionKeys: ['men_de_antithesis', 'historic_present'],
    deviceKeys: ['antithesis', 'ellipsis', 'isocolon'],
    userEdited: false,
    model: 'm',
    createdAt: 1,
    updatedAt: 1,
    ...over.entry,
  };
  return toItem(entry, passage);
}

const latinNote = (title: string, evidence: string[]) => ({ title, explanation: title, evidence, confidence: 'high' });
const LATIN_NOTES = {
  overview: 'Caesar opens with a plain statement of division.',
  translation: { literal: 'Gaul is all divided into three parts.', idiomatic: 'Gaul as a whole is divided into three parts.' },
  syntax: { clauseMap: 'Main: Gallia est omnis divisa\n  rel.: quarum unam incolunt Belgae', constructions: [latinNote('Relative clause', ['quarum'])] },
  discourse: [latinNote('Setting', ['Gallia'])],
  style: [latinNote('Isocolon', ['in partes tres'])],
};

const ITEMS = [
  item({ id: 'xen', entry: { tags: ['narrative', 'openings'], createdAt: 10, updatedAt: 50 } }),
  item({
    id: 'caes',
    entry: {
      language: 'la',
      level: 'period',
      title: 'Gallia est omnis divisa',
      notes: LATIN_NOTES as unknown as Entry['notes'],
      constructionKeys: ['abl_absolute'],
      deviceKeys: ['tricolon'],
      tags: ['openings'],
      createdAt: 20,
      updatedAt: 20,
    },
    passage: {
      language: 'la',
      text: 'Gallia est omnis divisa in partes tres, quarum unam incolunt Belgae.',
      source: { author: 'Caesar', work: 'De Bello Gallico', locus: '1.1' },
    },
  }),
  item({ id: 'thuc', entry: { title: 'Thucydides period', createdAt: 30, updatedAt: 30 }, passage: { source: { author: 'Thucydides' } } }),
];

const ids = (xs: NotebookItem[]) => xs.map((x) => x.entry.id);
const find = (q: Partial<typeof EMPTY_QUERY>) => ids(filterItems(ITEMS, { ...EMPTY_QUERY, ...q }));

describe('search', () => {
  test('no query lists everything, newest first', () => {
    assert.deepEqual(find({}), ['thuc', 'caes', 'xen']);
  });

  test('sorts', () => {
    assert.deepEqual(find({ sort: 'oldest' }), ['xen', 'caes', 'thuc']);
    assert.deepEqual(find({ sort: 'edited' }), ['xen', 'thuc', 'caes']);
  });

  test('accent- and case-insensitive over passage, notes, title and source', () => {
    assert.deepEqual(find({ q: 'αρταξερξησ', sort: 'oldest' }), ['xen', 'thuc']); // passage text, no accents
    assert.deepEqual(find({ q: 'ΑΡΤΑΞΈΡΞΗΣ', sort: 'oldest' }), ['xen', 'thuc']);
    assert.deepEqual(find({ q: 'plain statement' }), ['caes']); // notes overview
    assert.deepEqual(find({ q: 'bello gallico' }), ['caes']); // source work
    assert.deepEqual(find({ q: 'isocolon', sort: 'oldest' }), ['xen', 'caes', 'thuc']); // note title
  });

  test('every word must match, in any order', () => {
    assert.deepEqual(find({ q: 'belgae gallia' }), ['caes']);
    assert.deepEqual(find({ q: 'belgae κῦρος' }), []);
  });

  test('Latin u/v and i/j are equivalent', () => {
    assert.deepEqual(find({ q: 'diuisa' }), ['caes']);
    assert.equal(searchFold('Iūlius'), searchFold('julius'));
  });

  test('filters combine with each other and with search', () => {
    assert.deepEqual(find({ language: 'la' }), ['caes']);
    assert.deepEqual(find({ level: 'sentence' }), ['thuc', 'xen']);
    assert.deepEqual(find({ author: 'Xenophon' }), ['xen']);
    assert.deepEqual(find({ construction: 'men_de_antithesis' }), ['thuc', 'xen']);
    assert.deepEqual(find({ device: 'tricolon' }), ['caes']);
    assert.deepEqual(find({ move: 'participant_introduction' }).length, 3);
    assert.deepEqual(find({ tag: 'openings' }), ['caes', 'xen']);
    assert.deepEqual(find({ tag: 'openings', language: 'grc' }), ['xen']);
    assert.deepEqual(find({ tag: 'openings', q: 'caesar' }), ['caes']);
  });

  test('facets count the values present', () => {
    const f = facets(ITEMS);
    assert.deepEqual(f.authors.map((a) => a.value).sort(), ['Caesar', 'Thucydides', 'Xenophon']);
    assert.deepEqual(f.tags, [
      { value: 'openings', count: 2 },
      { value: 'narrative', count: 1 },
    ]);
    assert.equal(f.constructions.find((c) => c.value === 'men_de_antithesis')?.count, 2);
  });

  test('query round-trips through the URL, dropping defaults and junk', () => {
    const q = { ...EMPTY_QUERY, q: 'μέν δέ', language: 'grc' as const, tag: 'openings', sort: 'edited' as const };
    const params = paramsFromQuery(q);
    assert.equal(params.toString(), 'q=%CE%BC%CE%AD%CE%BD+%CE%B4%CE%AD&lang=grc&tag=openings&sort=edited');
    const back = queryFromParams(params);
    assert.equal(back.q, 'μέν δέ');
    assert.equal(back.language, 'grc');
    assert.equal(back.tag, 'openings');
    assert.equal(back.sort, 'edited');
    assert.equal(paramsFromQuery(back).toString(), params.toString());
    assert.equal(paramsFromQuery(EMPTY_QUERY).toString(), '');
    const junk = queryFromParams(new URLSearchParams('lang=fr&sort=bogus&level=x'));
    assert.equal(junk.language, undefined);
    assert.equal(junk.level, undefined);
    assert.equal(junk.sort, 'newest');
    assert.equal(isFiltered(EMPTY_QUERY), false);
    assert.equal(isFiltered({ ...EMPTY_QUERY, sort: 'oldest' }), false);
    assert.equal(isFiltered({ ...EMPTY_QUERY, tag: 'x' }), true);
  });

  test('filtering 2,000 entries takes well under 100 ms (spec §15)', () => {
    const many = Array.from({ length: 2000 }, (_, i) =>
      item({ id: `e${i}`, entry: { tags: [`tag${i % 25}`], createdAt: i } }),
    );
    const started = performance.now();
    for (const q of ['κυροσ', 'isocolon balanced', 'nothing-matches-this']) {
      filterItems(many, { ...EMPTY_QUERY, q, tag: 'tag3', construction: 'historic_present' });
    }
    const perQuery = (performance.now() - started) / 3;
    assert.ok(perQuery < 100, `${perQuery.toFixed(1)} ms per query`);
  });
});

describe('entries', () => {
  const input = { language: 'grc' as const, variety: 'attic' as const, level: 'sentence' as const, text: PASSAGE };

  async function saved() {
    const db = new ImitatioDB(`entries-${crypto.randomUUID()}`);
    const result = { ...finalize(response() as never, input), model: 'm', repaired: false };
    const id = await saveAnalysis({ ...input, source: { author: '', work: '' } }, result, db);
    return { db, id };
  }

  test('saving stores the passage and entry; an empty source is dropped', async () => {
    const { db, id } = await saved();
    const entry = (await db.entries.get(id))!;
    const passage = (await db.passages.get(entry.passageId))!;
    assert.equal(passage.text, PASSAGE);
    assert.equal(passage.source, undefined);
    assert.equal(entry.userEdited, false);
    db.close();
  });

  test('tags are normalised and de-duplicated', () => {
    assert.deepEqual(normalizeTags([' Thucydides ', 'thucydides', 'speech  openings', '', 'Speech Openings']), [
      'thucydides',
      'speech openings',
    ]);
  });

  test('title and tag edits do not mark the analysis as edited', async () => {
    const { db, id } = await saved();
    const before = (await db.entries.get(id))!.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    await updateEntry(id, { title: '  ', tags: ['Openings', 'openings'] }, db);
    const e = (await db.entries.get(id))!;
    assert.equal(e.title, 'Untitled pattern');
    assert.deepEqual(e.tags, ['openings']);
    assert.equal(e.userEdited, false);
    assert.ok(e.updatedAt > before);
    db.close();
  });

  test('concurrent function edits build on each other (no lost tags)', async () => {
    const { db, id } = await saved();
    await Promise.all([
      updateEntry(id, (e) => ({ tags: [...e.tags, 'narrative'] }), db),
      updateEntry(id, (e) => ({ tags: [...e.tags, 'xenophon'] }), db),
    ]);
    assert.deepEqual((await db.entries.get(id))!.tags.sort(), ['narrative', 'xenophon']);
    db.close();
  });

  test('editing the skeleton marks it edited and refreshes the index keys', async () => {
    const { db, id } = await saved();
    const e = (await db.entries.get(id))!;
    const skeleton = structuredClone(e.skeleton);
    skeleton.units[1].construction = 'gen_absolute';
    skeleton.units[2].construction = 'gen_absolute';
    skeleton.devices = [{ type: 'chiasmus', span: ['U2', 'U3'], description: 'x' }];
    await updateEntry(id, { skeleton }, db);
    const after = (await db.entries.get(id))!;
    assert.equal(after.userEdited, true);
    assert.deepEqual(after.constructionKeys.sort(), ['gen_absolute', 'historic_present']);
    assert.deepEqual(after.deviceKeys, ['chiasmus']);
    assert.deepEqual(await db.entries.where('constructionKeys').equals('gen_absolute').primaryKeys(), [id]);
    db.close();
  });

  test('deleting removes the entry, its passage and its generations', async () => {
    const { db, id } = await saved();
    const { passageId } = (await db.entries.get(id))!;
    await db.generations.add({ id: 'g1', entryId: id, request: { variations: 1 }, outputs: [], model: 'm', createdAt: 0 });
    await deleteEntry(id, db);
    assert.equal(await db.entries.get(id), undefined);
    assert.equal(await db.passages.get(passageId), undefined);
    assert.equal(await db.generations.count(), 0);
    db.close();
  });
});
