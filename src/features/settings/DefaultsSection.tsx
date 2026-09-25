import { inputClass, Section } from '@/components/ui';
import { useOptimisticPreferences, type Preferences } from '@/lib/db/settings';
import { LANGUAGE_LABELS, VARIETIES, varietyFor } from '@/lib/language';
import type { Language, Variety } from '@/types';

export function DefaultsSection({ prefs: saved }: { prefs: Preferences }) {
  const [prefs, update] = useOptimisticPreferences(saved);
  return (
    <Section title="Defaults" description="What the Analyse screen starts with.">
      <div className="flex flex-wrap gap-6">
        <fieldset>
          <legend className="text-sm font-medium mb-1">Language</legend>
          <div className="flex gap-4 text-sm">
            {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
              <label key={lang} className="flex gap-2 items-center">
                <input
                  type="radio"
                  name="default-language"
                  checked={prefs.defaultLanguage === lang}
                  onChange={() =>
                    void update({
                      defaultLanguage: lang,
                      defaultVariety: varietyFor(lang, prefs.defaultVariety),
                    })
                  }
                />
                {LANGUAGE_LABELS[lang]}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="default-variety" className="block text-sm font-medium mb-1">
            Variety
          </label>
          <select
            id="default-variety"
            value={varietyFor(prefs.defaultLanguage, prefs.defaultVariety)}
            onChange={(e) => void update({ defaultVariety: e.target.value as Variety })}
            className={`${inputClass} w-auto`}
          >
            {VARIETIES[prefs.defaultLanguage].map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex gap-2 items-start text-sm">
        <input
          type="checkbox"
          checked={prefs.betaCodeInput}
          onChange={(e) => void update({ betaCodeInput: e.target.checked })}
          className="mt-1"
        />
        <span>
          Type Greek in Beta Code by default
          <span className="block text-xs text-muted">
            For example <code>a)/nqrwpos</code> becomes <span className="font-classical">ἄνθρωπος</span>. Pasted
            Unicode Greek always works.
          </span>
        </span>
      </label>
    </Section>
  );
}
