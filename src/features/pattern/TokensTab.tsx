import { useEffect, useRef } from 'react';
import type { TokenAnalysis } from '@/types';
import { ConfidenceBadge } from '@/components/badges';
import { EditableText } from '@/components/EditableText';

type EditableField = 'lemma' | 'parse' | 'gloss' | 'function';

export function TokensTab({
  tokens,
  selected,
  onSelect,
  edit,
}: {
  tokens: TokenAnalysis[] | undefined;
  selected: number | null;
  onSelect: (index: number) => void;
  edit?: (index: number, field: EditableField, value: string) => void;
}) {
  const selectedRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => selectedRow.current?.scrollIntoView({ block: 'nearest' }), [selected]);

  if (!tokens?.length) {
    return <p className="text-muted">No token table: it is left out at paragraph level to keep responses small.</p>;
  }

  const cell = (t: TokenAnalysis, i: number, field: EditableField, classical = false) => (
    <EditableText
      value={t[field]}
      label={`${field} of ${t.form}`}
      classical={classical}
      onSave={edit && ((v) => edit(i, field, v))}
      className={classical ? 'font-classical text-base' : ''}
    />
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            {['Form', 'Lemma', 'Part of speech', 'Parse', 'Gloss', 'Function', 'Confidence'].map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tokens.map((t, i) => (
            <tr
              key={i}
              ref={selected === i ? selectedRow : undefined}
              onClick={() => onSelect(i)}
              aria-selected={selected === i}
              className={`border-t border-rule cursor-pointer align-top ${selected === i ? 'bg-highlight' : 'hover:bg-rule/40'}`}
            >
              <td className="py-1.5 pr-4 font-classical text-base">{t.form}</td>
              <td className="py-1.5 pr-4">{cell(t, i, 'lemma', true)}</td>
              <td className="py-1.5 pr-4 text-muted">{t.pos}</td>
              <td className="py-1.5 pr-4">{cell(t, i, 'parse')}</td>
              <td className="py-1.5 pr-4">{cell(t, i, 'gloss')}</td>
              <td className="py-1.5 pr-4">{cell(t, i, 'function')}</td>
              <td className="py-1.5">
                <ConfidenceBadge value={t.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
