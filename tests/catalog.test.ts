import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOG_MAX_AGE_MS, isStale, parseModelList, supportsJson } from '../src/lib/llm/catalog.ts';

const SAMPLE = {
  data: [
    {
      id: 'google/gemini-3.7-flash',
      name: 'Google: Gemini 3.7 Flash',
      context_length: 1048576,
      pricing: { prompt: '0.0000003', completion: '0.0000025' },
      supported_parameters: ['max_tokens', 'response_format', 'reasoning'],
    },
    {
      id: 'acme/tiny',
      pricing: { prompt: '0', completion: '0' },
      supported_parameters: null,
    },
  ],
};

test('parses the model list into sorted entries with prices per million tokens', () => {
  const models = parseModelList(SAMPLE);
  assert.deepEqual(
    models.map((m) => m.id),
    ['acme/tiny', 'google/gemini-3.7-flash'],
  );
  const gemini = models[1];
  assert.equal(gemini.name, 'Google: Gemini 3.7 Flash');
  assert.ok(Math.abs(gemini.promptPricePerM! - 0.3) < 1e-9);
  assert.ok(Math.abs(gemini.completionPricePerM! - 2.5) < 1e-9);
  assert.equal(gemini.supportsJson, true);
  assert.equal(models[0].name, 'acme/tiny');
  assert.equal(models[0].supportsJson, false);
});

test('JSON mode is off for models the catalog does not know', () => {
  const catalog = { fetchedAt: 0, models: parseModelList(SAMPLE) };
  assert.equal(supportsJson(catalog, 'google/gemini-3.7-flash'), true);
  assert.equal(supportsJson(catalog, 'acme/tiny'), false);
  assert.equal(supportsJson(catalog, 'unknown/model'), false);
  assert.equal(supportsJson(null, 'google/gemini-3.7-flash'), false);
});

test('the cache goes stale after a day', () => {
  assert.equal(isStale(null), true);
  assert.equal(isStale({ fetchedAt: 1000, models: [] }, 1000 + CATALOG_MAX_AGE_MS), false);
  assert.equal(isStale({ fetchedAt: 1000, models: [] }, 1001 + CATALOG_MAX_AGE_MS), true);
});
