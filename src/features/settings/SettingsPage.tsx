import { Button, Callout } from '@/components/ui';
import { updatePreferences, usePreferences } from '@/lib/db/settings';
import { ApiKeySection } from './ApiKeySection';
import { DefaultsSection } from './DefaultsSection';
import { ModelsSection } from './ModelsSection';

function Onboarding() {
  return (
    <Callout>
      <p className="font-medium">Welcome to Imitatio</p>
      <ol className="mt-2 list-decimal pl-5 space-y-1 text-muted">
        <li>
          Create an API key on{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-accent underline">
            OpenRouter
          </a>{' '}
          and add a few dollars of credit.
        </li>
        <li>Paste it below. It stays in this browser and is sent only to OpenRouter.</li>
        <li>Press Test next to a model to check that everything works.</li>
      </ol>
      <p className="mt-2 text-muted">
        Your notebook is stored locally and can be browsed without a key. Only analysis and generation need one.
      </p>
      <Button variant="quiet" className="mt-2" onClick={() => void updatePreferences({ onboarded: true })}>
        Skip for now
      </Button>
    </Callout>
  );
}

export function SettingsPage() {
  const prefs = usePreferences();

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      {prefs === undefined ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          {!prefs.onboarded && <Onboarding />}
          <ApiKeySection prefs={prefs} />
          <ModelsSection prefs={prefs} />
          <DefaultsSection prefs={prefs} />
          <p className="border-t border-rule pt-6 text-sm text-muted">
            Font size, theme, and notebook export and import arrive in M5.
          </p>
        </>
      )}
    </div>
  );
}
