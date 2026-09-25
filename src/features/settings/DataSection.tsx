import { useRef, useState } from 'react';
import { Button, Callout, Section } from '@/components/ui';
import {
  buildExport,
  exportFileName,
  importNotebook,
  parseNotebookFile,
  type ImportMode,
  type ImportReport,
  type TableReport,
} from '@/lib/export/notebook';

// Export and import, spec §13.

function describe(label: string, r: TableReport): string {
  const parts = [r.added && `${r.added} added`, r.updated && `${r.updated} updated`, r.kept && `${r.kept} kept`].filter(Boolean);
  return `${label}: ${parts.join(', ') || 'none'}`;
}

export function DataSection() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  async function doExport() {
    const file = await buildExport();
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName();
    a.click();
    URL.revokeObjectURL(url);
    setExported(
      `${file.entries.length} pattern${file.entries.length === 1 ? '' : 's'} and ${file.generations.length} generation${
        file.generations.length === 1 ? '' : 's'
      } exported as ${a.download}.`,
    );
  }

  async function doImport(file: File) {
    setReport(null);
    setError(null);
    const parsed = parseNotebookFile(await file.text());
    if (!parsed.ok) return setError(parsed.error);
    if (
      mode === 'replace' &&
      !window.confirm(
        `Replace the whole notebook with the ${parsed.file.entries.length} patterns in this file? Everything not in the file will be deleted.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      setReport(await importNotebook(parsed.file, mode));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Notebook data"
      description="Your notebook lives only in this browser. Export it to back it up or move it to another computer. Settings and your API key are never included."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void doExport()}>Export notebook</Button>
        {exported && (
          <span className="text-sm text-muted" role="status">
            {exported}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <fieldset className="text-sm">
          <legend className="font-medium mb-1">Import</legend>
          <label className="flex gap-2 items-start">
            <input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-1" />
            <span>
              Merge <span className="text-muted">(recommended): add new patterns; where both have one, keep the more recently edited</span>
            </span>
          </label>
          <label className="flex gap-2 items-start">
            <input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-1" />
            <span>
              Replace <span className="text-muted">: delete this notebook and use the file instead</span>
            </span>
          </label>
        </fieldset>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Notebook file to import"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void doImport(f);
          }}
        />
        <Button onClick={() => fileInput.current?.click()} disabled={busy}>
          {busy ? 'Importing…' : 'Choose a file to import'}
        </Button>
      </div>

      {error && (
        <Callout tone="warn">
          <p role="alert">
            <span className="font-medium">Nothing was imported.</span> {error}
          </p>
        </Callout>
      )}
      {report && (
        <Callout tone="ok">
          <p role="status" className="font-medium">
            Import complete.
          </p>
          <ul className="mt-1 text-muted">
            <li>{describe('Patterns', report.entries)}</li>
            <li>{describe('Passages', report.passages)}</li>
            <li>{describe('Generations', report.generations)}</li>
          </ul>
        </Callout>
      )}
    </Section>
  );
}
