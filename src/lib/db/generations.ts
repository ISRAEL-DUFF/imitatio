import { useLiveQuery } from 'dexie-react-hooks';
import type { GeneratedText, Generation } from '@/types';
import type { GenerateResult, GenerationRequest } from '@/lib/llm/generate';
import { db as defaultDb, type ImitatioDB } from './db';

// Generation repository (spec §6.1, §9.4). Star, copy and delete act on one
// output; a generation with no outputs left is removed.

export async function saveGeneration(
  entryId: string,
  request: GenerationRequest,
  result: GenerateResult,
  db: ImitatioDB = defaultDb,
): Promise<string> {
  const generation: Generation = {
    id: crypto.randomUUID(),
    entryId,
    request,
    outputs: result.outputs,
    model: result.model,
    createdAt: Date.now(),
  };
  await db.generations.add(generation);
  return generation.id;
}

async function editOutputs(
  id: string,
  edit: (outputs: GeneratedText[]) => GeneratedText[],
  db: ImitatioDB,
): Promise<void> {
  await db.transaction('rw', db.generations, async () => {
    const g = await db.generations.get(id);
    if (!g) return;
    const outputs = edit(g.outputs);
    if (outputs.length) await db.generations.put({ ...g, outputs });
    else await db.generations.delete(id);
  });
}

export function toggleStar(id: string, index: number, db: ImitatioDB = defaultDb) {
  return editOutputs(id, (os) => os.map((o, i) => (i === index ? { ...o, starred: !o.starred } : o)), db);
}

export function deleteOutput(id: string, index: number, db: ImitatioDB = defaultDb) {
  return editOutputs(id, (os) => os.filter((_, i) => i !== index), db);
}

export interface OutputRef {
  generation: Generation;
  index: number;
  output: GeneratedText;
}

/** All outputs for an entry: starred first, then newest first (§9.3). */
export function sortOutputs(generations: Generation[]): OutputRef[] {
  return generations
    .flatMap((generation) => generation.outputs.map((output, index) => ({ generation, index, output })))
    .sort(
      (a, b) =>
        Number(b.output.starred) - Number(a.output.starred) ||
        b.generation.createdAt - a.generation.createdAt ||
        a.index - b.index,
    );
}

export function useGenerations(entryId: string | undefined): Generation[] | undefined {
  return useLiveQuery(
    () => (entryId ? defaultDb.generations.where('entryId').equals(entryId).toArray() : []),
    [entryId],
  );
}
