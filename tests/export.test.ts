import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ImitatioDB } from '../src/lib/db/db.ts';
import { saveAnalysis, updateEntry } from '../src/lib/db/entries.ts';
import { saveGeneration, toggleStar } from '../src/lib/db/generations.ts';
import { saveApiKey } from '../src/lib/db/settings.ts';
import { buildExport, exportFileName, importNotebook, parseNotebookFile } from '../src/lib/export/notebook.ts';
import { finalize } from '../src/lib/llm/analyze.ts';
import { PASSAGE, response } from './fixtures/anabasis.ts';
import { CLEAN } from './fixtures/generation.ts';

const INPUT = { language: 'grc' as const, variety: 'attic' as const, level: 'sentence' as const, text: PASSAGE };

async function notebook() {
  const db = new ImitatioDB(`export-${crypto.randomUUID()}`);
  const result = { ...finalize(response() as never, INPUT), model: 'm', repaired: false };
  const entryId = await saveAnalysis({ ...INPUT, source: { author: 'Xenophon' } }, result, db);
  const genId = await saveGeneration(
    entryId,
    { variations: 1 },
    { outputs: [{ ...CLEAN, label: 'composition', starred: false }], model: 'm', repaired: false },
    db,
  );
  return { db, entryId, genId };
}

const roundTrip = async (db: ImitatioDB) => {
  const parsed = parseNotebookFile(JSON.stringify(await buildExport(db)));
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  return parsed.file;
};

describe('export', () => {
  test('contains the notebook and never settings or the API key', async () => {
    const { db } = await notebook();
    await saveApiKey('sk-or-secret', 'store', db);
    const file = await buildExport(db, new Date('2026-09-25T10:00:00Z'));
    assert.equal(file.app, 'imitatio');
    assert.equal(file.schemaVersion, 1);
    assert.equal(file.exportedAt, '2026-09-25T10:00:00.000Z');
    assert.deepEqual([file.passages.length, file.entries.length, file.generations.length], [1, 1, 1]);
    const text = JSON.stringify(file);
    assert.ok(!text.includes('sk-or-secret'));
    assert.ok(!('settings' in file));
    assert.equal(exportFileName(new Date('2026-09-25T10:00:00Z')), 'imitatio-notebook-2026-09-25.json');
    db.close();
  });

  test('round-trips losslessly, including fields the model schema omits', async () => {
    const { db } = await notebook();
    const original = await buildExport(db);
    const file = await roundTrip(db);
    assert.deepEqual(file.entries, original.entries);
    assert.equal(file.entries[0].notes.syntax.constructions[0].reference?.verified, false);
    db.close();
  });
});

describe('import', () => {
  test('into an empty notebook adds everything', async () => {
    const { db: source } = await notebook();
    const file = await roundTrip(source);
    const target = new ImitatioDB(`target-${crypto.randomUUID()}`);
    const report = await importNotebook(file, 'merge', target);
    assert.deepEqual(report.entries, { added: 1, updated: 0, kept: 0 });
    assert.equal(await target.entries.count(), 1);
    assert.equal(await target.generations.count(), 1);
    source.close();
    target.close();
  });

  test('merge: the later updatedAt wins, in both directions', async () => {
    const { db, entryId } = await notebook();
    const older = await roundTrip(db);
    await new Promise((r) => setTimeout(r, 2));
    await updateEntry(entryId, { title: 'Edited here' }, db);

    // The file is older: the local edit is kept.
    let report = await importNotebook(older, 'merge', db);
    assert.deepEqual(report.entries, { added: 0, updated: 0, kept: 1 });
    assert.equal((await db.entries.get(entryId))!.title, 'Edited here');

    // The file is newer: it wins.
    const newer = structuredClone(older);
    newer.entries[0].title = 'Edited elsewhere';
    newer.entries[0].updatedAt = Date.now() + 1000;
    report = await importNotebook(newer, 'merge', db);
    assert.deepEqual(report.entries, { added: 0, updated: 1, kept: 0 });
    assert.equal((await db.entries.get(entryId))!.title, 'Edited elsewhere');
    db.close();
  });

  test('merge: a starred generation carries over', async () => {
    const { db, genId } = await notebook();
    const target = new ImitatioDB(`target-${crypto.randomUUID()}`);
    await importNotebook(await roundTrip(db), 'merge', target);
    await new Promise((r) => setTimeout(r, 2));
    await toggleStar(genId, 0, db); // starred on the other machine
    const report = await importNotebook(await roundTrip(db), 'merge', target);
    assert.deepEqual(report.generations, { added: 0, updated: 1, kept: 0 });
    assert.equal((await target.generations.get(genId))!.outputs[0].starred, true);
    db.close();
    target.close();
  });

  test('replace: clears the notebook first', async () => {
    const { db: source } = await notebook();
    const { db: target } = await notebook();
    const file = await roundTrip(source);
    await importNotebook(file, 'replace', target);
    assert.deepEqual(
      (await target.entries.toArray()).map((e) => e.id),
      file.entries.map((e) => e.id),
    );
    assert.equal(await target.passages.count(), 1);
    source.close();
    target.close();
  });

  test('bad files are refused with a reason, and nothing is written', async () => {
    const { db } = await notebook();
    const good = await buildExport(db);
    const reject = (value: unknown, pattern: RegExp) => {
      const r = parseNotebookFile(typeof value === 'string' ? value : JSON.stringify(value));
      assert.equal(r.ok, false);
      assert.match(r.ok ? '' : r.error, pattern);
    };
    reject('not json', /not a JSON file/);
    reject({ hello: 'world' }, /not an Imitatio notebook/);
    reject({ ...good, schemaVersion: 2 }, /newer version/);
    reject({ ...good, entries: [{ ...good.entries[0], level: 'chapter' }] }, /Entry 1: level/);
    const brokenSkeleton = structuredClone(good);
    (brokenSkeleton.entries[0].skeleton.units[0] as { role: string }).role = 'boss';
    reject(brokenSkeleton, /Entry 1: skeleton\.units\.0\.role/);
    reject({ ...good, passages: [] }, /refers to a passage that is not in the file/);
    reject({ ...good, entries: [], passages: good.passages }, /generation refers to a pattern/);
    db.close();
  });
});
