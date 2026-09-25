import { useEffect } from 'react';
import type { TextSize, ThemePreference } from '@/lib/db/settings';

// Theme and text size (spec §9.6), applied as data-theme and a root font size
// on <html>. The last choice is mirrored to localStorage so it can be applied
// before the first render, avoiding a flash of the wrong theme; the database
// stays the source of truth.

const STORAGE_KEY = 'imitatio.appearance';

export const TEXT_SIZES: Record<TextSize, { label: string; percent: number }> = {
  small: { label: 'Small', percent: 93.75 },
  medium: { label: 'Medium', percent: 100 },
  large: { label: 'Large', percent: 112.5 },
  larger: { label: 'Larger', percent: 125 },
};

export interface Appearance {
  theme: ThemePreference;
  textSize: TextSize;
}

export function resolveTheme(theme: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export function applyAppearance(a: Appearance, root: HTMLElement = document.documentElement) {
  root.dataset.theme = resolveTheme(a.theme, systemDark());
  root.style.fontSize = `${(TEXT_SIZES[a.textSize] ?? TEXT_SIZES.medium).percent}%`;
}

/** Called before the first render, from the cached choice or the system theme. */
export function applyCachedAppearance() {
  let cached: Appearance = { theme: 'system', textSize: 'medium' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) cached = { ...cached, ...(JSON.parse(raw) as Partial<Appearance>) };
  } catch {
    // Private windows and blocked storage: fall back to the system theme.
  }
  applyAppearance(cached);
}

/** Keep <html> in step with the saved preferences and with the OS theme. */
export function useAppearance(a: Appearance | undefined) {
  const theme = a?.theme;
  const textSize = a?.textSize;
  useEffect(() => {
    if (!theme || !textSize) return;
    const apply = () => applyAppearance({ theme, textSize });
    apply();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, textSize }));
    } catch {
      // Not fatal: the next load just starts from the system theme.
    }
    if (theme !== 'system' || typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, textSize]);
}
