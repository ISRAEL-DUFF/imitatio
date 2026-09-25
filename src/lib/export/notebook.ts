import { z } from 'zod';
import type { Entry, Generation, Passage } from '@/types';
import { db as defaultDb, type ImitatioDB } from '@/lib/db/db';
import { notesSchema, skeletonSchema } from '@/lib/llm/schemas';

// Notebook export and import, spec §13. Settings and the API key are never
// exported. Import validates the whole file before touching the database.

export const EXPORT_SCHEMA_VERSION = 1;

export interface NotebookFile {
  app: 'imitatio';
  schemaVersion: number;
  exportedAt: string;
  passages: Passage[];
  entries: Entry[];
  generations: Generation[];
}

export async function buildExport(db: ImitatioDB = defaultDb, now = new Date()): Promise<NotebookFile> {
  const [passages, entries, generations] = await Promise.all([
    db.passages.toArray(),
    db.entries.toArray(),
    db.generations.toArray(),
  ]);
  return { app: 'imitatio', schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: now.toISOString(), passages, entries, generations };
}

export function exportFileName(now = new Date()): string {
  return `imitatio-notebook-${now.toISOString().slice(0, 10)}.json`;
}

// Validation. Records are checked for the fields the app relies on; the
// notes and skeleton are checked against the same schemas as model output.
// The original objects are what get stored (loose objects keep every field).

const id = z.string().min(1);
const language = z.enum(['grc', 'la']);

const passageSchema = z.looseObject({ id, language, text: z.string(), createdAt: z.number() });

const entrySchema = z.looseObject({
  id,
  passageId: id,
  language,
  level: z.enum(['sentence', 'period', 'paragraph']),
  title: z.string(),
  notes: notesSchema,
  skeleton: skeletonSchema,
  tags: z.array(z.string()),
  constructionKeys: z.array(z.string()),
  deviceKeys: z.array(z.string()),
  userEdited: z.boolean(),
  model: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const generationSchema = z.looseObject({
  id,
  entryId: id,
  request: z.looseObject({ variations: z.number() }),
  outputs: z.array(
    z.looseObject({
      text: z.string(),
      literalTranslation: z.string(),
      unitMapping: z.array(z.object({ unitId: z.string(), text: z.string() })),
      deviations: z.array(z.string()),
      starred: z.boolean(),
    }),
  ),
  model: z.string(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
});

const fileSchema = z.object({
  app: z.literal('imitatio'),
  schemaVersion: z.number(),
  exportedAt: z.string(),
  passages: z.array(z.unknown()),
  entries: z.array(z.unknown()),
  generations: z.array(z.unknown()),
});

/** Bring an older file up to the current version. Only version 1 exists so far. */
function migrate(file: z.output<typeof fileSchema>): z.output<typeof fileSchema> {
  // Future versions add cases here, one step at a time.
  return file;
}

function firstIssue(label: string, index: number, error: z.ZodError): string {
  const issue = error.issues[0];
  return `${label} ${index + 1}: ${issue.path.join('.') || 'record'}: ${issue.message}`;
}

export type ParseResult = { ok: true; file: NotebookFile } | { ok: false; error: string };

export function parseNotebookFile(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This is not a JSON file.' };
  }
  const top = fileSchema.safeParse(json);
  if (!top.success) {
    const isOurs = typeof json === 'object' && json !== null && (json as { app?: unknown }).app === 'imitatio';
    return { ok: false, error: isOurs ? `The file is damaged: ${z.prettifyError(top.error)}` : 'This is not an Imitatio notebook export.' };
  }
  if (top.data.schemaVersion > EXPORT_SCHEMA_VERSION) {
    return { ok: false, error: `This file was made by a newer version of Imitatio (format ${top.data.schemaVersion}). Update the app to import it.` };
  }
  const file = migrate(top.data);

  const check = <T>(label: string, schema: z.ZodType, rows: unknown[]): T[] | string => {
    for (let i = 0; i < rows.length; i++) {
      const r = schema.safeParse(rows[i]);
      if (!r.success) return firstIssue(label, i, r.error);
    }
    return rows as T[];
  };
  const passages = check<Passage>('Passage', passageSchema, file.passages);
  if (typeof passages === 'string') return { ok: false, error: passages };
  const entries = check<Entry>('Entry', entrySchema, file.entries);
  if (typeof entries === 'string') return { ok: false, error: entries };
  const generations = check<Generation>('Generation', generationSchema, file.generations);
  if (typeof generations === 'string') return { ok: false, error: generations };

  const passageIds = new Set(passages.map((p) => p.id));
  const orphanEntry = entries.find((e) => !passageIds.has(e.passageId));
  if (orphanEntry) return { ok: false, error: `Entry “${orphanEntry.title}” refers to a passage that is not in the file.` };
  const entryIds = new Set(entries.map((e) => e.id));
  if (generations.some((g) => !entryIds.has(g.entryId))) {
    return { ok: false, error: 'A generation refers to a pattern that is not in the file.' };
  }

  return {
    ok: true,
    file: { app: 'imitatio', schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: file.exportedAt, passages, entries, generations },
  };
}

export type ImportMode = 'merge' | 'replace';

export interface TableReport {
  added: number;
  updated: number;
  kept: number;
}

export interface ImportReport {
  passages: TableReport;
  entries: TableReport;
  generations: TableReport;
}

async function mergeTable<T extends { id: string }>(
  incoming: T[],
  stamp: (r: T) => number,
  get: (ids: string[]) => Promise<(T | undefined)[]>,
  put: (rows: T[]) => Promise<unknown>,
): Promise<TableReport> {
  const existing = await get(incoming.map((r) => r.id));
  const report: TableReport = { added: 0, updated: 0, kept: 0 };
  const rows: T[] = [];
  incoming.forEach((r, i) => {
    const current = existing[i];
    if (!current) {
      report.added++;
      rows.push(r);
    } else if (stamp(r) > stamp(current)) {
      report.updated++;
      rows.push(r);
    } else report.kept++;
  });
  await put(rows);
  return report;
}

/**
 * Merge (default): records matched by id; on conflict the later updatedAt
 * wins; new records are added. Passages are never edited, so a local copy
 * is kept. Replace: the notebook is cleared first (the UI confirms).
 */
export async function importNotebook(file: NotebookFile, mode: ImportMode, db: ImitatioDB = defaultDb): Promise<ImportReport> {
  return db.transaction('rw', db.passages, db.entries, db.generations, async () => {
    if (mode === 'replace') {
      await Promise.all([db.passages.clear(), db.entries.clear(), db.generations.clear()]);
    }
    return {
      passages: await mergeTable(
        file.passages,
        () => 0,
        (ids) => db.passages.bulkGet(ids),
        (rows) => db.passages.bulkPut(rows),
      ),
      entries: await mergeTable(
        file.entries,
        (e) => e.updatedAt,
        (ids) => db.entries.bulkGet(ids),
        (rows) => db.entries.bulkPut(rows),
      ),
      generations: await mergeTable(
        file.generations,
        (g) => g.updatedAt ?? g.createdAt,
        (ids) => db.generations.bulkGet(ids),
        (rows) => db.generations.bulkPut(rows),
      ),
    };
  });
}
