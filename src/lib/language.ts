import type { Language, Variety } from '@/types';

export const LANGUAGE_LABELS: Record<Language, string> = { grc: 'Greek', la: 'Latin' };

export const VARIETIES: Record<Language, { value: Variety; label: string }[]> = {
  grc: [
    { value: 'attic', label: 'Attic' },
    { value: 'ionic', label: 'Ionic' },
    { value: 'homeric', label: 'Homeric' },
    { value: 'koine', label: 'Koine' },
    { value: 'other', label: 'Other' },
  ],
  la: [
    { value: 'classical_latin', label: 'Classical' },
    { value: 'late_latin', label: 'Late' },
    { value: 'other', label: 'Other' },
  ],
};

/** The variety to use when switching language: keep it if valid, else the first. */
export function varietyFor(language: Language, current?: Variety): Variety {
  const options = VARIETIES[language];
  return options.some((o) => o.value === current) ? current! : options[0].value;
}
