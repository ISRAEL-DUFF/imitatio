import { useState } from 'react';
import { Button, Callout, inputClass, Section } from '@/components/ui';
import {
  clearApiKey,
  saveApiKey,
  setApiKeyMode,
  updatePreferences,
  useApiKey,
  useOptimisticPreferences,
  type ApiKeyMode,
  type Preferences,
} from '@/lib/db/settings';

export function ApiKeySection({ prefs: stored }: { prefs: Preferences }) {
  const [prefs, update] = useOptimisticPreferences(stored);
  const key = useApiKey();
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSave() {
    await saveApiKey(draft, prefs.apiKeyMode);
    if (!prefs.onboarded) await updatePreferences({ onboarded: true });
    setDraft('');
    setReveal(false);
    setSaved(true);
  }

  async function onModeChange(mode: ApiKeyMode) {
    setSaved(false);
    await update({ apiKeyMode: mode }, () => setApiKeyMode(mode));
  }

  return (
    <Section
      title="OpenRouter API key"
      description={
        <>
          Analysis and generation run through OpenRouter with your own key. Create one at{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-accent underline">
            openrouter.ai/keys
          </a>
          . The key is sent only to OpenRouter, and is never included in exports.
        </>
      }
    >
      <p className="text-sm" aria-live="polite">
        {key === undefined
          ? 'Checking…'
          : key.source === 'none'
            ? prefs.apiKeyMode === 'session'
              ? 'No key for this session. You chose to enter it each time you open the app.'
              : 'No key saved.'
            : `Key ending in …${key.hint ?? ''}, ${
                key.source === 'stored' ? 'remembered on this device' : 'held for this session only'
              }.`}
        {saved && key?.source !== 'none' && <span className="text-muted"> Saved.</span>}
      </p>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) void onSave();
        }}
      >
        <label htmlFor="api-key" className="sr-only">
          OpenRouter API key
        </label>
        <input
          id="api-key"
          type={reveal ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder={key?.source === 'none' ? 'sk-or-…' : 'Replace with a new key'}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          className={`${inputClass} font-mono flex-1 min-w-60`}
        />
        <Button onClick={() => setReveal((r) => !r)} aria-pressed={reveal}>
          {reveal ? 'Hide' : 'Show'}
        </Button>
        <Button type="submit" variant="primary" disabled={!draft.trim()}>
          Save key
        </Button>
      </form>

      <fieldset className="space-y-1 text-sm">
        <legend className="sr-only">Where to keep the key</legend>
        <label className="flex gap-2 items-start">
          <input
            type="radio"
            name="key-mode"
            checked={prefs.apiKeyMode === 'store'}
            onChange={() => void onModeChange('store')}
            className="mt-1"
          />
          <span>Remember on this device (stored in this browser only)</span>
        </label>
        <label className="flex gap-2 items-start">
          <input
            type="radio"
            name="key-mode"
            checked={prefs.apiKeyMode === 'session'}
            onChange={() => void onModeChange('session')}
            className="mt-1"
          />
          <span>Don&apos;t store it: ask each session</span>
        </label>
      </fieldset>

      {prefs.apiKeyMode === 'store' && (
        <Callout tone="warn">
          On a shared or public computer, choose &ldquo;ask each session&rdquo;. A remembered key can be read by
          anyone using this browser profile.
        </Callout>
      )}

      {key && key.source !== 'none' && (
        <Button variant="quiet" onClick={() => void clearApiKey().then(() => setSaved(false))}>
          Remove key
        </Button>
      )}
    </Section>
  );
}
