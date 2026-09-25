import { useMemo } from 'react';
import type { Language, PatternSkeleton } from '@/types';
import { unitColor } from '@/components/badges';
import { findSpans } from '@/lib/greek/normalize';

// Text with each unit's words underlined in that unit's colour, the same
// colours as the Skeleton strip (spec §9.4), so the reader can see which new
// words fill which slot.

export interface Segment {
  unitId: string;
  quote: string;
}

interface Span {
  start: number;
  end: number;
  unit: number;
}

/** Place each quote at its first occurrence after the previous one, never overlapping. */
export function placeSegments(text: string, segments: Segment[], skeleton: PatternSkeleton, language: Language): Span[] {
  const placed: Span[] = [];
  let cursor = 0;
  for (const s of segments) {
    const unit = skeleton.units.findIndex((u) => u.id === s.unitId);
    if (unit === -1) continue;
    const candidates = findSpans(text, s.quote, language);
    const free = ([a, b]: [number, number]) => placed.every((p) => b <= p.start || a >= p.end);
    const hit = candidates.find((c) => c[0] >= cursor && free(c)) ?? candidates.find(free);
    if (!hit) continue;
    placed.push({ start: hit[0], end: hit[1], unit });
    cursor = hit[1];
  }
  return placed.sort((a, b) => a.start - b.start);
}

export function MappedText({
  text,
  segments,
  skeleton,
  language,
  className = '',
}: {
  text: string;
  segments: Segment[];
  skeleton: PatternSkeleton;
  language: Language;
  className?: string;
}) {
  const spans = useMemo(() => placeSegments(text, segments, skeleton, language), [text, segments, skeleton, language]);

  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.start > at) parts.push(text.slice(at, s.start));
    const color = unitColor(s.unit);
    parts.push(
      <span
        key={s.start}
        title={skeleton.units[s.unit].id}
        style={{
          textDecorationLine: 'underline',
          textDecorationColor: color,
          textDecorationThickness: '3px',
          textUnderlineOffset: '0.3em',
        }}
      >
        {text.slice(s.start, s.end)}
      </span>,
    );
    at = s.end;
  }
  if (at < text.length) parts.push(text.slice(at));

  return (
    <p lang={language} className={`font-classical text-xl leading-loose ${className}`}>
      {parts}
    </p>
  );
}

export function UnitLegend({ skeleton }: { skeleton: PatternSkeleton }) {
  return (
    <p className="flex flex-wrap gap-3 text-xs" aria-label="Unit colours">
      {skeleton.units.map((u, i) => (
        <span key={u.id} className="inline-flex items-center gap-1">
          <span className="inline-block h-1 w-4 rounded" style={{ background: unitColor(i) }} aria-hidden />
          <span style={{ color: unitColor(i) }} className="font-semibold">
            {u.id}
          </span>
          <span className="text-muted">{u.role}</span>
        </span>
      ))}
    </p>
  );
}

/** The source passage's own mapping, from the skeleton's example text. */
export function sourceSegments(skeleton: PatternSkeleton): Segment[] {
  return skeleton.units.flatMap((u) => u.slots.map((s) => ({ unitId: u.id, quote: s.exampleText })));
}
