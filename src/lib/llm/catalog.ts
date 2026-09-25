import { z } from 'zod';
import { db as defaultDb, type ImitatioDB } from '@/lib/db/db';
import { OPENROUTER_BASE } from './openrouter';

// OpenRouter's public model list (no key needed), cached in the settings
// table so the picker works offline and does not refetch on every visit.

export interface ModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  /** USD per million tokens, when OpenRouter reports it. */
  promptPricePerM?: number;
  completionPricePerM?: number;
  /** Whether the model accepts `response_format` (JSON mode). */
  supportsJson: boolean;
}

export interface ModelCatalog {
  fetchedAt: number;
  models: ModelInfo[];
}

const CATALOG_KEY = 'modelCatalog';
export const CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const modelsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      context_length: z.number().nullish(),
      pricing: z.object({ prompt: z.string().optional(), completion: z.string().optional() }).optional(),
      supported_parameters: z.array(z.string()).nullish(),
    }),
  ),
});

function perMillion(price: string | undefined): number | undefined {
  const n = Number(price);
  return price === undefined || !Number.isFinite(n) || n < 0 ? undefined : n * 1_000_000;
}

export function parseModelList(json: unknown): ModelInfo[] {
  const { data } = modelsSchema.parse(json);
  return data
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      contextLength: m.context_length ?? undefined,
      promptPricePerM: perMillion(m.pricing?.prompt),
      completionPricePerM: perMillion(m.pricing?.completion),
      supportsJson: (m.supported_parameters ?? []).some(
        (p) => p === 'response_format' || p === 'structured_outputs',
      ),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function fetchModelCatalog(doFetch: typeof fetch = fetch): Promise<ModelCatalog> {
  const res = await doFetch(`${OPENROUTER_BASE}/models`);
  if (!res.ok) throw new Error(`OpenRouter model list failed (${res.status})`);
  return { fetchedAt: Date.now(), models: parseModelList(await res.json()) };
}

export async function loadCachedCatalog(db: ImitatioDB = defaultDb): Promise<ModelCatalog | null> {
  const row = await db.settings.get(CATALOG_KEY);
  return (row?.value as ModelCatalog | undefined) ?? null;
}

export async function refreshCatalog(db: ImitatioDB = defaultDb, doFetch?: typeof fetch): Promise<ModelCatalog> {
  const catalog = await fetchModelCatalog(doFetch);
  await db.settings.put({ key: CATALOG_KEY, value: catalog });
  return catalog;
}

export function isStale(catalog: ModelCatalog | null, now = Date.now()): boolean {
  return !catalog || now - catalog.fetchedAt > CATALOG_MAX_AGE_MS;
}

/**
 * JSON mode only when the catalog says the model supports it. An unknown model
 * gets no `response_format`: the Zod validation and repair step (§8.2) cover it.
 */
export function supportsJson(catalog: ModelCatalog | null, modelId: string): boolean {
  return catalog?.models.find((m) => m.id === modelId)?.supportsJson ?? false;
}
