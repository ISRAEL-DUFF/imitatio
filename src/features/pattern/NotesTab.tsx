import type { ReactNode } from 'react';
import type { AnalysisNotes, NoteItem } from '@/types';
import { ConfidenceBadge } from '@/components/badges';
import { Markdown } from '@/components/Markdown';

function NoteCard({ item, onFocus, active }: { item: NoteItem; onFocus: (evidence: string[]) => void; active: boolean }) {
  return (
    <article
      className={`rounded-md border px-4 py-3 ${active ? 'border-accent' : 'border-rule'}`}
      onMouseEnter={() => onFocus(item.evidence)}
    >
      <header className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onFocus(item.evidence)}
          className="font-medium text-left hover:text-accent"
          aria-label={`${item.title}: highlight in passage`}
        >
          {item.title}
        </button>
        <ConfidenceBadge value={item.confidence} />
        {item.reference && (
          <span className="text-xs text-muted">
            {item.reference.grammar} {item.reference.section}
            {!item.reference.verified && <span title="Section numbers from the model may be wrong"> · unverified</span>}
          </span>
        )}
      </header>
      <div className="mt-2 text-sm">
        <Markdown>{item.explanation}</Markdown>
      </div>
      {item.evidence.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-classical">
          {item.evidence.map((e, i) => (
            <span key={i} className="text-muted">
              {e}
            </span>
          ))}
        </p>
      )}
    </article>
  );
}

function Group({ title, items, ...rest }: { title: string; items: NoteItem[]; onFocus: (e: string[]) => void; focused: string[] }) {
  return (
    <details open className="group">
      <summary className="cursor-pointer text-lg font-semibold py-1">
        {title} <span className="text-sm font-normal text-muted">({items.length})</span>
      </summary>
      <div className="mt-2 space-y-3">
        {items.length === 0 && <p className="text-sm text-muted">Nothing noted.</p>}
        {items.map((item, i) => (
          <NoteCard key={i} item={item} onFocus={rest.onFocus} active={rest.focused === item.evidence} />
        ))}
      </div>
    </details>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function NotesTab({
  notes,
  onFocus,
  focused,
}: {
  notes: AnalysisNotes;
  onFocus: (evidence: string[]) => void;
  focused: string[];
}) {
  return (
    <div className="space-y-6">
      <Markdown>{notes.overview}</Markdown>
      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Literal">{notes.translation.literal}</Labelled>
        <Labelled label="Idiomatic">{notes.translation.idiomatic}</Labelled>
      </div>

      <details open>
        <summary className="cursor-pointer text-lg font-semibold py-1">Syntax</summary>
        <div className="mt-2 space-y-3">
          <pre className="font-classical text-base whitespace-pre-wrap rounded-md bg-rule/40 px-4 py-3 overflow-x-auto">
            {notes.syntax.clauseMap}
          </pre>
          {notes.syntax.constructions.map((item, i) => (
            <NoteCard key={i} item={item} onFocus={onFocus} active={focused === item.evidence} />
          ))}
        </div>
      </details>
      <Group title="Discourse" items={notes.discourse} onFocus={onFocus} focused={focused} />
      <Group title="Style" items={notes.style} onFocus={onFocus} focused={focused} />
    </div>
  );
}
