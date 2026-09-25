import { useMemo, useState, type ReactNode } from 'react';
import type { AnalysisNotes, Language, Level, PatternSkeleton, Passage } from '@/types';
import { LanguageBadge } from '@/components/badges';
import { EditableText } from '@/components/EditableText';
import { TagInput } from '@/components/TagInput';
import type { EntryEdit } from '@/lib/db/entries';
import { checkAnalysis, type CheckWarning } from '@/lib/checks';
import { VARIETIES } from '@/lib/language';
import { NotesTab, type EditNotes } from './NotesTab';
import { PassageView } from './PassageView';
import { SkeletonTab } from './SkeletonTab';
import { TokensTab } from './TokensTab';

// Pattern card, spec §9.3. Shared by an unsaved analysis result and a saved
// entry; `actions` holds Save/Discard or Generate. With `onEdit` every text
// field is editable inline; without it (an unsaved result) the card is read-only.

const TABS = ['Notes', 'Skeleton', 'Tokens', 'Generations'] as const;
type Tab = (typeof TABS)[number];

export interface PatternCardProps {
  title: string;
  text: string;
  language: Language;
  variety?: Passage['variety'];
  level: Level;
  source?: Passage['source'];
  notes: AnalysisNotes;
  skeleton: PatternSkeleton;
  model: string;
  actions?: ReactNode;
  generations?: ReactNode;
  tags?: string[];
  tagSuggestions?: string[];
  userEdited?: boolean;
  onEdit?: (edit: EntryEdit) => Promise<void>;
}

function sourceLine(source: Passage['source']): string | null {
  if (!source) return null;
  const s = [source.author, [source.work, source.locus].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return s || null;
}

const KIND_LABEL: Record<CheckWarning['kind'], string> = {
  evidence: 'quote',
  token: 'token',
  vocabulary: 'vocabulary',
};

function Warnings({ warnings }: { warnings: CheckWarning[] }) {
  if (!warnings.length) {
    return <span className="text-xs text-muted">All checks passed</span>;
  }
  const counts = warnings.reduce<Record<string, number>>((acc, w) => ({ ...acc, [w.kind]: (acc[w.kind] ?? 0) + 1 }), {});
  return (
    <details className="text-xs">
      <summary className="cursor-pointer list-none inline-flex flex-wrap gap-1">
        {Object.entries(counts).map(([kind, n]) => (
          <span key={kind} className="rounded border border-accent/60 bg-accent/5 px-1.5 leading-5 text-accent">
            {n} {KIND_LABEL[kind as CheckWarning['kind']]} warning{n === 1 ? '' : 's'}
          </span>
        ))}
      </summary>
      <ul className="mt-2 space-y-1 rounded-md border border-rule p-3">
        {warnings.map((w, i) => (
          <li key={i}>
            <span className="text-muted">{w.where}:</span> <span className="font-classical text-sm">{w.message}</span>
          </li>
        ))}
        <li className="pt-1 text-muted">
          These checks catch cheap-to-detect model errors (spec §12). They do not block saving.
        </li>
      </ul>
    </details>
  );
}

export function PatternCard(props: PatternCardProps) {
  const { notes, skeleton, text, language, onEdit } = props;
  const editNotes: EditNotes | undefined =
    onEdit &&
    ((mutate) =>
      void onEdit((current) => {
        const draft = structuredClone(current.notes);
        mutate(draft);
        return { notes: draft };
      }));
  const [tab, setTab] = useState<Tab>('Notes');
  const [focused, setFocused] = useState<string[]>([]);
  const [selectedWord, setSelectedWord] = useState<number | null>(null);

  const warnings = useMemo(() => checkAnalysis(text, notes, skeleton, language), [text, notes, skeleton, language]);
  const variety = VARIETIES[language].find((v) => v.value === props.variety)?.label;
  const source = sourceLine(props.source);

  const highlights = selectedWord !== null && notes.tokens?.[selectedWord] ? [] : focused;

  function selectWord(i: number) {
    setSelectedWord(i);
    setFocused([]);
    if (notes.tokens?.length) setTab('Tokens');
  }

  function focus(quotes: string[]) {
    setFocused(quotes);
    setSelectedWord(null);
  }

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          <EditableText value={props.title} label="title" onSave={onEdit && ((title) => onEdit({ title }))} />
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <LanguageBadge language={language} />
          {variety && <span>{variety}</span>}
          <span>· {props.level}</span>
          {source && <span>· {source}</span>}
          <span className="text-xs">· analysed by {props.model}</span>
          {props.userEdited && <span className="text-xs text-ink">· edited by you</span>}
        </p>
        {onEdit && props.tags && (
          <TagInput tags={props.tags} suggestions={props.tagSuggestions} onChange={(change) => void onEdit((current) => ({ tags: change(current.tags) }))} />
        )}
        <Warnings warnings={warnings} />
      </header>

      <PassageView
        text={text}
        language={language}
        highlights={highlights}
        selectedWord={selectedWord}
        onSelectWord={selectWord}
      />

      {props.actions && <div className="flex flex-wrap gap-2">{props.actions}</div>}

      <div>
        <div role="tablist" aria-label="Pattern" className="flex gap-1 border-b border-rule overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm -mb-px border-b-2 ${
                tab === t ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
          {tab === 'Notes' && <NotesTab notes={notes} onFocus={focus} focused={focused} edit={editNotes} />}
          {tab === 'Skeleton' && (
            <SkeletonTab skeleton={skeleton} onFocus={focus} onSave={onEdit && ((s) => onEdit({ skeleton: s }))} />
          )}
          {tab === 'Tokens' && (
            <TokensTab
              tokens={notes.tokens}
              selected={selectedWord}
              onSelect={setSelectedWord}
              edit={editNotes && ((i, field, value) => editNotes((d) => void (d.tokens![i][field] = value)))}
            />
          )}
          {tab === 'Generations' &&
            (props.generations ?? <p className="text-muted">Save this analysis to generate new text from its pattern.</p>)}
        </div>
      </div>
    </article>
  );
}
