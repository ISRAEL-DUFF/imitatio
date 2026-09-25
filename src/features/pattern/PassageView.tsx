import { useMemo } from 'react';
import type { Language } from '@/types';
import { findSpans, words } from '@/lib/greek/normalize';

// The passage, large, in Gentium Plus (§9.3). Each word is a button: clicking
// one selects its token. Words overlapping any highlighted quote are marked.
export function PassageView({
  text,
  language,
  highlights,
  selectedWord,
  onSelectWord,
}: {
  text: string;
  language: Language;
  highlights: string[];
  selectedWord: number | null;
  onSelectWord: (index: number) => void;
}) {
  const wordSpans = useMemo(() => words(text), [text]);

  const lit = useMemo(() => {
    const ranges = highlights.flatMap((h) => findSpans(text, h, language));
    return new Set(
      wordSpans.flatMap((w, i) => (ranges.some(([s, e]) => s < w.end && e > w.start) ? [i] : [])),
    );
  }, [text, language, highlights, wordSpans]);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  wordSpans.forEach((w, i) => {
    if (w.start > cursor) parts.push(text.slice(cursor, w.start));
    const selected = selectedWord === i;
    parts.push(
      <button
        key={i}
        type="button"
        onClick={() => onSelectWord(i)}
        aria-pressed={selected}
        className={`rounded-sm px-px -mx-px transition-colors hover:bg-rule ${
          lit.has(i) ? 'bg-highlight' : ''
        } ${selected ? 'outline-2 outline-accent' : ''}`}
      >
        {w.text}
      </button>,
    );
    cursor = w.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));

  return (
    <p lang={language === 'grc' ? 'grc' : 'la'} className="font-classical text-2xl sm:text-3xl leading-relaxed">
      {parts}
    </p>
  );
}
