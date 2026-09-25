import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Language, Variety } from '@/types';
import { DEFAULT_MODELS } from '@/lib/llm/models';
import { db as defaultDb, type ImitatioDB } from './db';

// Settings repository (spec §9.6, §14). Preferences live in the `settings`
// table, one row per key. The API key is kept apart from them: it is either
// stored under its own row ("remember on this device") or held only in memory
// ("ask each session"), and it never appears in the Preferences object.

export type ApiKeyMode = 'store' | 'session';

export interface Preferences {
  apiKeyMode: ApiKeyMode;
  analysisModel: string;
  generationModel: string;
  defaultLanguage: Language;
  defaultVariety: Variety;
  betaCodeInput: boolean;
  /** Set once the first-launch panel has been completed or skipped. */
  onboarded: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  apiKeyMode: 'store',
  analysisModel: DEFAULT_MODELS.analysis,
  generationModel: DEFAULT_MODELS.generation,
  defaultLanguage: 'grc',
  defaultVariety: 'attic',
  betaCodeInput: true,
  onboarded: false,
};

const PREF_KEYS = Object.keys(DEFAULT_PREFERENCES) as (keyof Preferences)[];
const API_KEY = 'apiKey';

export async function loadPreferences(db: ImitatioDB = defaultDb): Promise<Preferences> {
  const rows = await db.settings.bulkGet(PREF_KEYS);
  const prefs = { ...DEFAULT_PREFERENCES } as Record<string, unknown>;
  rows.forEach((row, i) => {
    if (row !== undefined) prefs[PREF_KEYS[i]] = row.value;
  });
  return prefs as unknown as Preferences;
}

export async function updatePreferences(
  patch: Partial<Preferences>,
  db: ImitatioDB = defaultDb,
): Promise<void> {
  await db.settings.bulkPut(Object.entries(patch).map(([key, value]) => ({ key, value })));
}

// Session-only key: module memory, observable so the UI updates.

let sessionKey: string | null = null;
const listeners = new Set<() => void>();

function setSessionKey(key: string | null) {
  sessionKey = key;
  listeners.forEach((l) => l());
}

export async function saveApiKey(key: string, mode: ApiKeyMode, db: ImitatioDB = defaultDb) {
  const trimmed = key.trim();
  if (mode === 'store') {
    await db.settings.put({ key: API_KEY, value: trimmed });
    setSessionKey(null);
  } else {
    // Switching to "ask each session" must remove any stored copy.
    await db.settings.delete(API_KEY);
    setSessionKey(trimmed);
  }
  await updatePreferences({ apiKeyMode: mode }, db);
}

/**
 * Change where the current key is kept without asking for it again:
 * "ask each session" moves a stored key into memory and deletes the row;
 * "remember" writes the in-memory key to the database.
 */
export async function setApiKeyMode(mode: ApiKeyMode, db: ImitatioDB = defaultDb) {
  const key = await getApiKey(db);
  if (key) await saveApiKey(key, mode, db);
  else await updatePreferences({ apiKeyMode: mode }, db);
}

export async function clearApiKey(db: ImitatioDB = defaultDb) {
  await db.settings.delete(API_KEY);
  setSessionKey(null);
}

/** The key to send, or null. The session key wins over a stored one. */
export async function getApiKey(db: ImitatioDB = defaultDb): Promise<string | null> {
  if (sessionKey) return sessionKey;
  const row = await db.settings.get(API_KEY);
  return typeof row?.value === 'string' && row.value ? row.value : null;
}

// React hooks

export function usePreferences(): Preferences | undefined {
  return useLiveQuery(() => loadPreferences());
}

/**
 * Preferences with changes shown immediately. Controlled inputs otherwise snap
 * back until the database write round-trips through the live query. Pending
 * changes are dropped as soon as the database reports a new value.
 */
export function useOptimisticPreferences(prefs: Preferences) {
  const [pending, setPending] = useState<Partial<Preferences>>({});
  useEffect(() => setPending({}), [prefs]);
  const update = (patch: Partial<Preferences>, write: () => Promise<void> = () => updatePreferences(patch)) => {
    setPending((p) => ({ ...p, ...patch }));
    return write();
  };
  return [{ ...prefs, ...pending }, update] as const;
}

function useSessionKey(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => sessionKey,
  );
}

export interface ApiKeyState {
  source: 'stored' | 'session' | 'none';
  /** Last four characters, for "key ending in …" without revealing it. */
  hint: string | null;
}

/** Where the current key comes from, or undefined while loading. */
export function useApiKey(): ApiKeyState | undefined {
  const session = useSessionKey();
  const stored = useLiveQuery(async () => {
    const row = await defaultDb.settings.get(API_KEY);
    return typeof row?.value === 'string' ? row.value : '';
  });
  const hint = (key: string) => (key.length >= 4 ? key.slice(-4) : null);
  if (session) return { source: 'session', hint: hint(session) };
  if (stored === undefined) return undefined;
  return stored ? { source: 'stored', hint: hint(stored) } : { source: 'none', hint: null };
}
