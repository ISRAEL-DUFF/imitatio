import type { AnalysisNotes, NoteItem } from '@/types';
import { ConfidenceBadge } from '@/components/badges';
import { EditableText } from '@/components/EditableText';

/** Apply a change to a copy of the notes. Absent when the card is read-only. */
export type EditNotes = (mutate: (draft: AnalysisNotes) => void) => void;

type Section = 'constructions' | 'discourse' | 'style';

function itemsOf(n: AnalysisNotes, section: Section): NoteItem[] {
  return section === 'constructions' ? n.syntax.constructions : n[section];
}

function NoteCard({
  item,
  onFocus,
  active,
  edit,
}: {
  item: NoteItem;
  onFocus: (evidence: string[]) => void;
  active: boolean;
  edit?: (mutate: (draft: NoteItem) => void) => void;
}) {
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
        {edit && (
          <EditableText
            value={item.title}
            label={`title of note “${item.title}”`}
            onSave={(v) => edit((d) => void (d.title = v))}
            showValue={false}
            className="text-xs"
          />
        )}
      </header>
      <EditableText
        value={item.explanation}
        label={`explanation of “${item.title}”`}
        multiline
        markdown
        onSave={edit && ((v) => edit((d) => void (d.explanation = v)))}
        className="mt-2 text-sm"
      />
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

function Items({
  section,
  notes,
  onFocus,
  focused,
  edit,
}: {
  section: Section;
  notes: AnalysisNotes;
  onFocus: (e: string[]) => void;
  focused: string[];
  edit?: EditNotes;
}) {
  const items = itemsOf(notes, section);
  return (
    <div className="mt-2 space-y-3">
      {items.length === 0 && <p className="text-sm text-muted">Nothing noted.</p>}
      {items.map((item, i) => (
        <NoteCard
          key={i}
          item={item}
          onFocus={onFocus}
          active={focused === item.evidence}
          edit={edit && ((mutate) => edit((d) => mutate(itemsOf(d, section)[i])))}
        />
      ))}
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
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
  edit,
}: {
  notes: AnalysisNotes;
  onFocus: (evidence: string[]) => void;
  focused: string[];
  edit?: EditNotes;
}) {
  const shared = { notes, onFocus, focused, edit };
  return (
    <div className="space-y-6">
      <EditableText
        value={notes.overview}
        label="overview"
        multiline
        markdown
        onSave={edit && ((v) => edit((d) => void (d.overview = v)))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Literal">
          <EditableText
            value={notes.translation.literal}
            label="literal translation"
            multiline
            onSave={edit && ((v) => edit((d) => void (d.translation.literal = v)))}
          />
        </Labelled>
        <Labelled label="Idiomatic">
          <EditableText
            value={notes.translation.idiomatic}
            label="idiomatic translation"
            multiline
            onSave={edit && ((v) => edit((d) => void (d.translation.idiomatic = v)))}
          />
        </Labelled>
      </div>

      <details open>
        <summary className="cursor-pointer text-lg font-semibold py-1">Syntax</summary>
        <EditableText
          value={notes.syntax.clauseMap}
          label="clause map"
          multiline
          classical
          onSave={edit && ((v) => edit((d) => void (d.syntax.clauseMap = v)))}
          className="mt-2 font-classical text-base whitespace-pre-wrap rounded-md bg-rule/40 px-4 py-3 overflow-x-auto"
        />
        <Items section="constructions" {...shared} />
      </details>
      {(['discourse', 'style'] as const).map((section) => (
        <details key={section} open>
          <summary className="cursor-pointer text-lg font-semibold py-1 capitalize">
            {section} <span className="text-sm font-normal text-muted">({notes[section].length})</span>
          </summary>
          <Items section={section} {...shared} />
        </details>
      ))}
    </div>
  );
}
