import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ImitatioDB } from '../src/lib/db/db.ts';
import type { Entry } from '../src/types/index.ts';

function entry(id: string, constructionKeys: string[], tags: string[] = []): Entry {
  return {
    id,
    passageId: `p-${id}`,
    language: 'grc',
    level: 'sentence',
    title: id,
    notes: {
      overview: '',
      translation: { literal: '', idiomatic: '' },
      syntax: { clauseMap: '', constructions: [] },
      discourse: [],
      style: [],
    },
    skeleton: {
      schemaVersion: 1,
      language: 'grc',
      level: 'sentence',
      summary: '',
      units: [],
      devices: [],
      discourse: { function: '', moves: [], informationStructure: '', cohesion: [] },
      invariants: [],
      freeSlots: [],
    },
    tags,
    constructionKeys,
    deviceKeys: [],
    userEdited: false,
    model: 'test',
    createdAt: 0,
    updatedAt: 0,
  };
}

test('multi-entry indexes find every entry carrying a construction key', async () => {
  const db = new ImitatioDB(`test-${crypto.randomUUID()}`);
  await db.entries.bulkAdd([
    entry('a', ['gen_absolute', 'men_de_antithesis']),
    entry('b', ['historic_present']),
    entry('c', ['gen_absolute'], ['thucydides']),
  ]);

  const withGenAbs = await db.entries.where('constructionKeys').equals('gen_absolute').primaryKeys();
  assert.deepEqual(withGenAbs.sort(), ['a', 'c']);

  const tagged = await db.entries.where('tags').equals('thucydides').primaryKeys();
  assert.deepEqual(tagged, ['c']);

  db.close();
});
