import { useState } from 'react';
import { normalizeTag } from '@/lib/tags';

// Tag editor: chips with remove buttons, plus a field that adds on Enter or
// comma. Existing notebook tags matching what is typed are offered as
// buttons. (Not a <datalist>: its popup swallows Enter in Chromium, so typing
// an existing tag and pressing Enter silently did nothing.)
export function TagInput({
  tags,
  suggestions = [],
  onChange,
}: {
  tags: string[];
  suggestions?: string[];
  /** Receives a change to apply to the latest stored tags, not a whole new list. */
  onChange: (change: (current: string[]) => string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const tag = normalizeTag(raw);
    if (tag) onChange((current) => (current.includes(tag) ? current : [...current, tag]));
    setDraft('');
  };

  const typed = normalizeTag(draft);
  const matches = typed
    ? suggestions.filter((s) => !tags.includes(s) && s.includes(typed) && s !== typed).slice(0, 6)
    : [];

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-rule/60 pl-2 pr-1 text-xs leading-6">
            {t}
            <button
              type="button"
              onClick={() => onChange((current) => current.filter((x) => x !== t))}
              aria-label={`Remove tag ${t}`}
              className="rounded-full px-1 text-muted hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(',')) add(v.slice(0, -1));
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            }
            if (e.key === 'Escape') setDraft('');
            if (e.key === 'Backspace' && !draft && tags.length) onChange((current) => current.slice(0, -1));
          }}
          placeholder={tags.length ? 'Add tag' : 'Add tags, e.g. narrative, thucydides'}
          aria-label="Add a tag"
          className="min-w-32 flex-1 bg-transparent px-1 text-sm placeholder:text-muted focus:outline-none"
        />
      </div>
      {matches.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          Existing tags:
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-rule px-2 leading-5 hover:border-muted hover:text-ink"
            >
              {s}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
