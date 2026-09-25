import { inputClass, Section } from '@/components/ui';
import { TEXT_SIZES } from '@/lib/appearance';
import { useOptimisticPreferences, type Preferences, type TextSize, type ThemePreference } from '@/lib/db/settings';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Match the system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function AppearanceSection({ prefs: saved }: { prefs: Preferences }) {
  const [prefs, update] = useOptimisticPreferences(saved);
  return (
    <Section title="Appearance">
      <div className="flex flex-wrap gap-6">
        <fieldset>
          <legend className="text-sm font-medium mb-1">Theme</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {THEMES.map((t) => (
              <label key={t.value} className="flex gap-2 items-center">
                <input type="radio" name="theme" checked={prefs.theme === t.value} onChange={() => void update({ theme: t.value })} />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="text-size" className="block text-sm font-medium mb-1">
            Text size
          </label>
          <select
            id="text-size"
            value={prefs.textSize}
            onChange={(e) => void update({ textSize: e.target.value as TextSize })}
            className={`${inputClass} w-auto`}
          >
            {(Object.keys(TEXT_SIZES) as TextSize[]).map((s) => (
              <option key={s} value={s}>
                {TEXT_SIZES[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="font-classical text-xl">Δαρείου καὶ Παρυσάτιδος γίγνονται παῖδες δύο.</p>
    </Section>
  );
}
