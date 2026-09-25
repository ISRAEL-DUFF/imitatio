import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { ImitatioDB } from '../src/lib/db/db.ts';
import {
  clearApiKey,
  DEFAULT_PREFERENCES,
  getApiKey,
  loadPreferences,
  saveApiKey,
  setApiKeyMode,
  updatePreferences,
} from '../src/lib/db/settings.ts';
import { DEFAULT_MODELS } from '../src/lib/llm/models.ts';

let db: ImitatioDB;

beforeEach(() => {
  db = new ImitatioDB(`settings-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await clearApiKey(db); // also resets the in-memory session key
  db.close();
});

test('preferences default to Gemini models and Greek', async () => {
  const prefs = await loadPreferences(db);
  assert.deepEqual(prefs, DEFAULT_PREFERENCES);
  assert.equal(prefs.analysisModel, DEFAULT_MODELS.analysis);
  assert.equal(prefs.generationModel, DEFAULT_MODELS.generation);
});

test('preference updates persist and merge over defaults', async () => {
  await updatePreferences({ analysisModel: 'google/other', defaultLanguage: 'la' }, db);
  const prefs = await loadPreferences(db);
  assert.equal(prefs.analysisModel, 'google/other');
  assert.equal(prefs.defaultLanguage, 'la');
  assert.equal(prefs.generationModel, DEFAULT_MODELS.generation);
});

test('a remembered key is stored, trimmed, and never part of the preferences', async () => {
  await saveApiKey('  sk-or-abc  ', 'store', db);
  assert.equal(await getApiKey(db), 'sk-or-abc');
  assert.equal((await db.settings.get('apiKey'))?.value, 'sk-or-abc');
  assert.ok(!Object.values(await loadPreferences(db)).includes('sk-or-abc'));
});

test('a session key is never written to the database', async () => {
  await saveApiKey('sk-or-session', 'session', db);
  assert.equal(await getApiKey(db), 'sk-or-session');
  assert.equal(await db.settings.get('apiKey'), undefined);
  assert.equal((await loadPreferences(db)).apiKeyMode, 'session');
});

test('switching to "ask each session" deletes the stored copy but keeps the key usable', async () => {
  await saveApiKey('sk-or-abc', 'store', db);
  await setApiKeyMode('session', db);
  assert.equal(await db.settings.get('apiKey'), undefined);
  assert.equal(await getApiKey(db), 'sk-or-abc');
});

test('switching back to "remember" writes the session key down', async () => {
  await saveApiKey('sk-or-abc', 'session', db);
  await setApiKeyMode('store', db);
  assert.equal((await db.settings.get('apiKey'))?.value, 'sk-or-abc');
});

test('clearing removes the key everywhere', async () => {
  await saveApiKey('sk-or-abc', 'store', db);
  await clearApiKey(db);
  assert.equal(await getApiKey(db), null);
});
