import { useEffect, useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { Button, inputClass } from './ui';

// Inline editing (spec §9.3). Without `onSave` it just displays the value.
// Enter saves a single-line field; Ctrl/⌘+Enter saves a multi-line one;
// Escape cancels.
export function EditableText({
  value,
  onSave,
  label,
  multiline = false,
  markdown = false,
  classical = false,
  showValue = true,
  className = '',
}: {
  value: string;
  onSave?: (value: string) => void | Promise<void>;
  label: string;
  multiline?: boolean;
  markdown?: boolean;
  /** Set in Gentium (Greek/Latin text). */
  classical?: boolean;
  /** false: show only the Edit button (the value is displayed elsewhere). */
  showValue?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const field = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const display = !showValue ? null : markdown ? (
    <Markdown>{value}</Markdown>
  ) : (
    <span className={multiline ? 'whitespace-pre-wrap' : ''}>{value}</span>
  );

  if (!onSave) return <div className={className}>{display}</div>;

  if (!editing) {
    return (
      <div className={`group relative ${className}`}>
        {display}
        <Button
          variant="quiet"
          aria-label={`Edit ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            setDraft(value);
            setEditing(true);
          }}
          className="ml-2 text-xs font-normal align-middle opacity-40 group-hover:opacity-100 focus-visible:opacity-100"
        >
          Edit
        </Button>
      </div>
    );
  }

  const save = async () => {
    if (draft !== value) await onSave(draft);
    setEditing(false);
  };
  const cancel = () => setEditing(false);
  const common = {
    ref: field,
    value: draft,
    'aria-label': label,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement & HTMLInputElement>) => setDraft(e.target.value),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
      if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void save();
      }
    },
    className: `${inputClass} ${classical ? 'font-classical text-base' : ''}`,
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {multiline ? <textarea rows={Math.min(12, Math.max(3, draft.split('\n').length + 1))} {...common} /> : <input {...common} />}
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => void save()}>
          Save
        </Button>
        <Button onClick={cancel}>Cancel</Button>
      </div>
    </div>
  );
}
