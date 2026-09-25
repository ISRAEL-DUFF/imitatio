import type { Confidence, Language } from '@/types';
import { LANGUAGE_LABELS } from '@/lib/language';

const CONFIDENCE: Record<Confidence, string> = {
  high: 'border-emerald-600/40 text-emerald-700 dark:text-emerald-400',
  medium: 'border-amber-600/40 text-amber-700 dark:text-amber-400',
  low: 'border-red-600/40 text-red-700 dark:text-red-400',
};

export function ConfidenceBadge({ value }: { value: Confidence }) {
  return (
    <span className={`inline-block rounded border px-1.5 text-xs leading-5 ${CONFIDENCE[value]}`}>
      <span className="sr-only">Confidence: </span>
      {value}
    </span>
  );
}

export function LanguageBadge({ language }: { language: Language }) {
  return (
    <span className="inline-block rounded border border-rule px-1.5 text-xs leading-5 text-muted">
      {LANGUAGE_LABELS[language]}
    </span>
  );
}

export function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-block rounded-full bg-rule/60 px-2 text-xs leading-5">
      {children}
    </span>
  );
}

/** Colour for a unit id, by its position in the skeleton. */
export function unitColor(index: number): string {
  return `var(--color-unit-${(index % 6) + 1})`;
}
