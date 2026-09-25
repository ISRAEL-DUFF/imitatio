import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { checkGeneration } from '../src/lib/checks.ts';
import { ImitatioDB } from '../src/lib/db/db.ts';
import { deleteOutput, saveGeneration, sortOutputs, toggleStar } from '../src/lib/db/generations.ts';
import { EXAMPLE_SKELETON } from '../src/lib/llm/example.ts';
import { generate, generationUserPrompt, parseGeneration } from '../src/lib/llm/generate.ts';
import type { TaskRequest } from '../src/lib/llm/index.ts';
import { FormatError } from '../src/lib/llm/structured.ts';
import type { PatternSkeleton } from '../src/types/index.ts';
import { CLEAN, MISSING_DE, REPLY, WITH_DEVIATION } from './fixtures/generation.ts';

const SKELETON = structuredClone(EXAMPLE_SKELETON) as unknown as PatternSkeleton;
const REQUEST = { topic: 'a merchant arriving in Corinth', constraints: 'use daughters', variations: 3 };

function scripted(...replies: string[]) {
  const calls: TaskRequest[] = [];
  return {
    calls,
    complete: async (req: TaskRequest) => {
      calls.push(req);
      const text = replies.shift();
      if (text === undefined) throw new Error('no more replies');
      return { text, model: 'google/gemini-3.1-flash-lite', finishReason: 'stop' };
    },
  };
}

describe('generate', () => {
  test('the prompt carries the skeleton, topic, constraints and count', () => {
    const p = generationUserPrompt(SKELETON, REQUEST);
    assert.match(p, /^Language: grc \(Greek, Attic\)$/m);
    assert.match(p, /^Variations: 3/m);
    assert.match(p, /^Topic: a merchant arriving in Corinth$/m);
    assert.match(p, /^Constraints: use daughters$/m);
    assert.ok(p.includes(JSON.stringify(SKELETON)));
    const bare = generationUserPrompt(SKELETON, { variations: 1 });
    assert.match(bare, /^Topic: your choice/m);
    assert.match(bare, /^Constraints: none$/m);
  });

  test('outputs are labelled as compositions, unstarred and normalised', async () => {
    const decomposed = { outputs: [{ ...CLEAN, text: CLEAN.text.normalize('NFD') }] };
    const { complete, calls } = scripted(JSON.stringify(decomposed));
    const r = await generate(SKELETON, { variations: 1 }, { complete });
    assert.equal(calls[0].json, true);
    assert.equal(r.model, 'google/gemini-3.1-flash-lite');
    assert.equal(r.outputs.length, 1);
    assert.equal(r.outputs[0].text, CLEAN.text);
    assert.equal(r.outputs[0].label, 'composition');
    assert.equal(r.outputs[0].starred, false);
  });

  test('extra outputs beyond the requested count are dropped', async () => {
    const { complete } = scripted(JSON.stringify(REPLY));
    assert.equal((await generate(SKELETON, { variations: 2 }, { complete })).outputs.length, 2);
  });

  test('one repair, then failure keeps the raw output', async () => {
    const ok = scripted('{"outputs": []}', JSON.stringify(REPLY));
    assert.equal((await generate(SKELETON, REQUEST, { complete: ok.complete })).repaired, true);
    assert.match(ok.calls[1].user, /Errors:/);
    const bad = scripted('nope', 'still nope');
    const err = await generate(SKELETON, REQUEST, { complete: bad.complete }).catch((e) => e);
    assert.ok(err instanceof FormatError);
    assert.equal(err.raw, 'still nope');
  });

  test('parseGeneration rejects an empty text', () => {
    const r = parseGeneration(JSON.stringify({ outputs: [{ ...CLEAN, text: '' }] }));
    assert.equal(r.ok, false);
  });
});

describe('checkGeneration', () => {
  const check = (o: typeof CLEAN) => checkGeneration(o.text, o.unitMapping, SKELETON, 'grc');

  test('a faithful composition is clean, with connectives matched ignoring accents', () => {
    // The skeleton lists μέν / δέ (acute); the text has μὲν / δὲ (grave).
    assert.deepEqual(check(CLEAN), []);
    assert.deepEqual(check(WITH_DEVIATION), []); // declared deviations are not check failures
  });

  test('a missing connective and a mapping not in the text are both flagged', () => {
    assert.deepEqual(
      check(MISSING_DE).map((w) => w.message),
      ['U3: “νεώτερος δὲ Γλαύκων” is not in the generated text.', 'U3: the connective “δέ” is missing.'],
    );
  });

  test('connectives must be whole words', () => {
    const text = 'Κλεάρχου καὶ Μυρρίνης γίγνονται παῖδες δύο, σοφώτερος μὲν Δίων, θρασύτερος οὐδὲν Λύκων.';
    const w = checkGeneration(text, [], SKELETON, 'grc').filter((x) => x.kind === 'connective');
    assert.deepEqual(w.map((x) => x.message), ['U3: the connective “δέ” is missing.']);
  });

  test('unknown and unmapped units are flagged', () => {
    const mapping = [
      { unitId: 'U1', text: 'Κλεάρχου καὶ Μυρρίνης γίγνονται παῖδες δύο' },
      { unitId: 'U9', text: 'σοφώτερος μὲν Δίων' },
    ];
    const w = checkGeneration(CLEAN.text, mapping, SKELETON, 'grc').map((x) => x.message);
    assert.deepEqual(w, [
      'The mapping names U9, which is not a unit of this pattern.',
      'U2 has no words mapped to it.',
      'U3 has no words mapped to it.',
    ]);
  });
});

describe('generations repository', () => {
  async function setup() {
    const db = new ImitatioDB(`gen-${crypto.randomUUID()}`);
    const { complete } = scripted(JSON.stringify(REPLY));
    const result = await generate(SKELETON, REQUEST, { complete });
    const id = await saveGeneration('entry-1', REQUEST, result, db);
    return { db, id };
  }

  test('saved with its request and model', async () => {
    const { db, id } = await setup();
    const g = (await db.generations.get(id))!;
    assert.equal(g.entryId, 'entry-1');
    assert.deepEqual(g.request, REQUEST);
    assert.equal(g.outputs.length, 3);
    assert.deepEqual(await db.generations.where('entryId').equals('entry-1').primaryKeys(), [id]);
    db.close();
  });

  test('star toggles one output; starred outputs sort first', async () => {
    const { db, id } = await setup();
    await toggleStar(id, 2, db);
    let g = (await db.generations.get(id))!;
    assert.deepEqual(g.outputs.map((o) => o.starred), [false, false, true]);
    assert.deepEqual(sortOutputs([g]).map((r) => r.index), [2, 0, 1]);
    await toggleStar(id, 2, db);
    g = (await db.generations.get(id))!;
    assert.equal(g.outputs[2].starred, false);
    db.close();
  });

  test('newer generations sort before older ones', () => {
    const base = { entryId: 'e', request: { variations: 1 }, model: 'm' };
    const out = { ...CLEAN, label: 'composition' as const, starred: false };
    const old = { ...base, id: 'old', createdAt: 1, outputs: [out] };
    const recent = { ...base, id: 'new', createdAt: 2, outputs: [out] };
    assert.deepEqual(sortOutputs([old, recent]).map((r) => r.generation.id), ['new', 'old']);
  });

  test('deleting the last output removes the generation', async () => {
    const { db, id } = await setup();
    await deleteOutput(id, 1, db);
    assert.deepEqual((await db.generations.get(id))!.outputs.map((o) => o.text), [CLEAN.text, MISSING_DE.text]);
    await deleteOutput(id, 0, db);
    await deleteOutput(id, 0, db);
    assert.equal(await db.generations.get(id), undefined);
    db.close();
  });
});
