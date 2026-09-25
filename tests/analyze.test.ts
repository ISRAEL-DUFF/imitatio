import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { analyze, FormatError, extractJson, parseAnalysis, parseSkeletonJson } from '../src/lib/llm/analyze.ts';
import { EXAMPLE_SKELETON } from '../src/lib/llm/example.ts';
import type { TaskRequest } from '../src/lib/llm/index.ts';
import type { CompletionResult } from '../src/lib/llm/openrouter.ts';
import { analysisSystemPrompt, analysisUserPrompt } from '../src/lib/llm/prompts.ts';
import { checkAnalysis } from '../src/lib/checks.ts';
import { PASSAGE, response } from './fixtures/anabasis.ts';

const INPUT = {
  language: 'grc' as const,
  variety: 'attic' as const,
  level: 'sentence' as const,
  text: PASSAGE,
  source: { author: 'Xenophon', work: 'Anabasis', locus: '1.1.1' },
};

function scripted(...replies: (string | Partial<CompletionResult>)[]) {
  const calls: TaskRequest[] = [];
  const complete = async (req: TaskRequest): Promise<CompletionResult> => {
    calls.push(req);
    const r = replies.shift();
    if (r === undefined) throw new Error('no more replies');
    return typeof r === 'string' ? { text: r, model: 'google/gemini-3.7-flash', finishReason: 'stop' } : { text: '', model: 'm', ...r };
  };
  return { complete, calls };
}

describe('parseAnalysis', () => {
  test('the spec example validates', () => {
    const parsed = parseAnalysis(JSON.stringify(response()));
    assert.ok(parsed.ok, parsed.ok ? '' : parsed.errors);
  });

  test('code fences and surrounding prose are stripped', () => {
    const json = JSON.stringify(response());
    assert.equal(extractJson('```json\n' + json + '\n```'), json);
    assert.equal(extractJson('Here you go:\n' + json + '\nHope that helps.'), json);
    assert.ok(parseAnalysis('```\n' + json + '\n```').ok);
  });

  test('null is treated as absent', () => {
    const r = response();
    (r.notes as Record<string, unknown>).tokens = null;
    assert.ok(parseAnalysis(JSON.stringify(r)).ok);
  });

  test('schema violations are reported, not thrown', () => {
    const parsed = parseAnalysis(JSON.stringify(response({ skeleton: { units: [] } })));
    assert.equal(parsed.ok, false);
    assert.match(parsed.ok ? '' : parsed.errors, /summary|units/);
    const bad = parseAnalysis('{ not json');
    assert.equal(bad.ok, false);
    assert.match(bad.ok ? '' : bad.errors, /Not valid JSON/);
  });
});

describe('analyze', () => {
  test('a valid response becomes a finished analysis', async () => {
    const { complete, calls } = scripted(JSON.stringify(response()));
    const r = await analyze(INPUT, { complete });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].json, true);
    assert.equal(r.repaired, false);
    assert.equal(r.model, 'google/gemini-3.7-flash');
    // App-owned fields
    assert.equal(r.skeleton.schemaVersion, 1);
    assert.equal(r.skeleton.language, 'grc');
    assert.equal(r.skeleton.level, 'sentence');
    assert.equal(r.notes.syntax.constructions[0].reference?.verified, false);
    // Denormalised keys, including historic_present from the verb's specialUse
    assert.deepEqual(r.constructionKeys.sort(), ['historic_present', 'men_de_antithesis']);
    assert.deepEqual(r.deviceKeys, ['antithesis', 'ellipsis', 'isocolon']);
    // The spec's example passes every client-side check
    assert.deepEqual(checkAnalysis(r.text, r.notes, r.skeleton, 'grc'), []);
  });

  test('one repair request, then success', async () => {
    const good = JSON.stringify(response());
    const { complete, calls } = scripted('{"notes": {}}', good);
    const r = await analyze(INPUT, { complete });
    assert.equal(calls.length, 2);
    assert.equal(r.repaired, true);
    assert.match(calls[1].user, /Errors:/);
    assert.match(calls[1].user, /\{"notes": \{\}\}/);
  });

  test('if repair fails too, nothing is returned and the raw output is kept', async () => {
    const { complete, calls } = scripted('garbage', 'still garbage');
    const err = await analyze(INPUT, { complete }).catch((e) => e);
    assert.ok(err instanceof FormatError);
    assert.equal(err.raw, 'still garbage');
    assert.equal(err.truncated, false);
    assert.equal(calls.length, 2);
  });

  test('a truncated response is not sent for repair', async () => {
    const { complete, calls } = scripted({ text: '{"notes": {', finishReason: 'length' });
    const err = await analyze(INPUT, { complete }).catch((e) => e);
    assert.ok(err instanceof FormatError);
    assert.equal(err.truncated, true);
    assert.equal(calls.length, 1);
  });

  test('the passage is normalised before sending and in the result', async () => {
    const decomposed = PASSAGE.normalize('NFD');
    const { complete, calls } = scripted(JSON.stringify(response()));
    const r = await analyze({ ...INPUT, text: decomposed }, { complete });
    assert.ok(calls[0].user.includes(PASSAGE));
    assert.equal(r.text, PASSAGE);
  });
});

describe('prompts', () => {
  test('the system prompt carries the schema, vocabulary and example', () => {
    const p = analysisSystemPrompt('grc');
    assert.match(p, /<schema>\s*\{/);
    assert.match(p, /gen_absolute/);
    assert.match(p, /participant_introduction/);
    assert.match(p, /Δαρείου/);
    assert.doesNotMatch(analysisSystemPrompt('la'), /gen_absolute/);
    assert.match(analysisSystemPrompt('la'), /abl_absolute/);
  });

  test('the user prompt follows the spec template', () => {
    const p = analysisUserPrompt(INPUT);
    assert.match(p, /^Language: grc \(Greek, Attic\)$/m);
    assert.match(p, /^Level: sentence$/m);
    assert.match(p, /^Source: Xenophon, Anabasis 1\.1\.1$/m);
    assert.match(p, /^Include token table: yes$/m);
    assert.match(analysisUserPrompt({ ...INPUT, level: 'paragraph', source: undefined }), /token table: no[\s\S]*Source: not given|Source: not given[\s\S]*token table: no/);
  });
});

describe('parseSkeletonJson (the JSON editor)', () => {
  const base = { language: 'grc' as const, level: 'sentence' as const, variety: 'attic' as const };

  test('a valid edit is accepted; app-owned fields are kept from the entry', () => {
    const edited = { ...structuredClone(EXAMPLE_SKELETON), summary: 'Edited', language: 'la', level: 'paragraph', schemaVersion: 9 };
    const r = parseSkeletonJson(JSON.stringify(edited), base);
    assert.ok(r.ok, r.ok ? '' : r.errors);
    assert.equal(r.skeleton.summary, 'Edited');
    assert.equal(r.skeleton.language, 'grc');
    assert.equal(r.skeleton.level, 'sentence');
    assert.equal(r.skeleton.schemaVersion, 1);
  });

  test('invalid JSON and schema violations are rejected with messages', () => {
    const bad = parseSkeletonJson('{ "summary": ', base);
    assert.equal(bad.ok, false);
    assert.match(bad.ok ? '' : bad.errors, /Not valid JSON/);
    const s = structuredClone(EXAMPLE_SKELETON) as Record<string, unknown>;
    (s.units as { role: string }[])[0].role = 'boss';
    const wrong = parseSkeletonJson(JSON.stringify(s), base);
    assert.equal(wrong.ok, false);
    assert.match(wrong.ok ? '' : wrong.errors, /role/);
  });

  test('quoted text is normalised as on analysis', () => {
    const s = structuredClone(EXAMPLE_SKELETON) as unknown as { units: { slots: { exampleText: string }[] }[] };
    s.units[0].slots[1].exampleText = 'γίγνονται'.normalize('NFD');
    const r = parseSkeletonJson(JSON.stringify(s), base);
    assert.ok(r.ok);
    assert.equal(r.skeleton.units[0].slots[1].exampleText, 'γίγνονται');
  });
});
