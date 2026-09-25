import { useState } from 'react';
import type { PatternSkeleton, PatternUnit, VerbConstraint } from '@/types';
import { Chip, unitColor } from '@/components/badges';
import { Button, inputClass } from '@/components/ui';
import { parseSkeletonJson } from '@/lib/llm/analyze';
import { labelFor } from '@/lib/llm/vocab';

const words = (s: string) => s.replace(/_/g, ' ');

function verbSummary(v: VerbConstraint): string {
  return [
    v.finite ? 'finite' : 'non-finite',
    v.mood,
    v.tense,
    v.voice && words(v.voice),
    v.person && `${v.person}${['st', 'nd', 'rd'][v.person - 1]} person`,
    v.number,
    v.specialUse && words(v.specialUse),
  ]
    .filter(Boolean)
    .join(' · ');
}

function UnitBox({
  unit,
  index,
  skeleton,
  onFocus,
}: {
  unit: PatternUnit;
  index: number;
  skeleton: PatternSkeleton;
  onFocus: (quotes: string[]) => void;
}) {
  const color = unitColor(index);
  const quotes = unit.slots.map((s) => s.exampleText);
  const head = unit.headsTo ? skeleton.units.findIndex((u) => u.id === unit.headsTo) : -1;
  return (
    <li
      tabIndex={0}
      onMouseEnter={() => onFocus(quotes)}
      onFocus={() => onFocus(quotes)}
      className="w-64 shrink-0 rounded-md border-2 bg-paper px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ borderColor: color }}
      aria-label={`Unit ${unit.id}`}
    >
      <p className="flex items-baseline justify-between gap-2">
        <span className="font-semibold" style={{ color }}>
          {unit.id}
        </span>
        <span className="text-xs text-muted">
          {unit.kind} · {unit.role}
        </span>
      </p>
      {head !== -1 && (
        <p className="text-xs">
          depends on{' '}
          <span className="font-semibold" style={{ color: unitColor(head) }}>
            {unit.headsTo}
          </span>
        </p>
      )}
      <div className="mt-1 flex flex-wrap gap-1">
        {unit.construction && (
          <Chip title={unit.construction}>{labelFor('construction', unit.construction, skeleton.language)}</Chip>
        )}
        {unit.connective && (
          <Chip title="Connective">
            <span className="font-classical">{unit.connective}</span>
          </Chip>
        )}
      </div>
      {unit.verb && <p className="mt-1 text-xs text-muted">Verb: {verbSummary(unit.verb)}</p>}
      <ol className="mt-2 space-y-1.5">
        {unit.slots.map((s) => (
          <li key={s.position} className="text-sm">
            <p className="font-classical text-base">{s.exampleText}</p>
            <p className="text-xs text-muted">
              {[words(s.function), s.case, s.realization && words(s.realization)].filter(Boolean).join(' · ')}
              {s.informationStatus && s.informationStatus !== 'neutral' && (
                <span className="text-ink"> · {words(s.informationStatus)}</span>
              )}
            </p>
          </li>
        ))}
      </ol>
      {unit.note && <p className="mt-2 text-xs text-muted">{unit.note}</p>}
    </li>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-1 list-disc pl-5 text-sm space-y-1">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

/** Raw skeleton JSON, validated against the schema before it is saved (§9.3). */
function JsonEditor({ skeleton, onSave }: { skeleton: PatternSkeleton; onSave: (s: PatternSkeleton) => Promise<void> }) {
  const original = JSON.stringify(skeleton, null, 2);
  const [text, setText] = useState(original);
  const [errors, setErrors] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    const parsed = parseSkeletonJson(text, skeleton);
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors(null);
    await onSave(parsed.skeleton);
    setSaved(true);
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        aria-label="Skeleton JSON"
        spellCheck={false}
        rows={20}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        className={`${inputClass} font-mono text-xs`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void save()} disabled={text === original}>
          Validate and save
        </Button>
        <Button onClick={() => { setText(original); setErrors(null); }} disabled={text === original}>
          Revert
        </Button>
        <span className="text-xs text-muted" aria-live="polite">
          {saved ? 'Saved.' : 'schemaVersion, language and level are kept as they are.'}
        </span>
      </div>
      {errors && (
        <div role="alert" className="rounded-md border border-accent/60 bg-accent/5 p-3 text-xs">
          <p className="font-medium">Not saved: the JSON does not match the skeleton schema.</p>
          <pre className="mt-1 whitespace-pre-wrap">{errors}</pre>
        </div>
      )}
    </div>
  );
}

export function SkeletonTab({
  skeleton,
  onFocus,
  onSave,
}: {
  skeleton: PatternSkeleton;
  onFocus: (quotes: string[]) => void;
  onSave?: (s: PatternSkeleton) => Promise<void>;
}) {
  const [json, setJson] = useState(false);
  const unitIndex = (id: string) => skeleton.units.findIndex((u) => u.id === id);
  const unitRef = (id: string) => (
    <span key={id} className="font-semibold" style={{ color: unitColor(unitIndex(id)) }}>
      {id}
    </span>
  );

  return (
    <div className="space-y-6">
      <p className="font-medium">{skeleton.summary}</p>

      <ol className="flex gap-3 overflow-x-auto pb-2 items-start" aria-label="Units in surface order">
        {skeleton.units.map((u, i) => (
          <UnitBox key={u.id} unit={u} index={i} skeleton={skeleton} onFocus={onFocus} />
        ))}
      </ol>

      <div className="grid gap-6 sm:grid-cols-2">
        <List title="Invariants: must be kept" items={skeleton.invariants} />
        <List title="Free slots: may change" items={skeleton.freeSlots} />
      </div>

      {skeleton.devices.length > 0 && (
        <div>
          <h3 className="font-semibold">Style devices</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {skeleton.devices.map((d, i) => (
              <li key={i}>
                <Chip title={d.type}>{labelFor('device', d.type, skeleton.language)}</Chip>{' '}
                {d.span.map((id, k) => (
                  <span key={id}>
                    {k > 0 && ', '}
                    {unitRef(id)}
                  </span>
                ))}
                : {d.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="font-semibold">Discourse</h3>
        <p className="mt-1 text-sm">
          Function: <Chip>{words(skeleton.discourse.function)}</Chip>
          {skeleton.discourse.register && <span className="text-muted"> · register: {skeleton.discourse.register}</span>}
        </p>
        <p className="mt-2 flex flex-wrap gap-2 text-sm">
          {skeleton.discourse.moves.map((m, i) => (
            <span key={i}>
              {unitRef(m.unitId)} <Chip title={m.move}>{labelFor('move', m.move, skeleton.language)}</Chip>
            </span>
          ))}
        </p>
        <p className="mt-2 text-sm">{skeleton.discourse.informationStructure}</p>
        {skeleton.discourse.cohesion.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
            {skeleton.discourse.cohesion.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <Button variant="quiet" onClick={() => setJson((j) => !j)} aria-expanded={json}>
          {json ? 'Hide JSON' : 'View JSON'}
        </Button>
        {json && (onSave ? <JsonEditor skeleton={skeleton} onSave={onSave} /> : (
          <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-rule/40 p-3 text-xs">
            {JSON.stringify(skeleton, null, 2)}
          </pre>
        ))}
      </div>
    </div>
  );
}
