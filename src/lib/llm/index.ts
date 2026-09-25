import { getApiKey, loadPreferences } from '@/lib/db/settings';
import { loadCachedCatalog, supportsJson } from './catalog';
import type { ModelTask } from './models';
import { complete, type CompletionResult } from './openrouter';

export { describeLlmError, LlmError } from './errors';
export type { CompletionResult } from './openrouter';

export interface TaskRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Request JSON mode; sent only if the chosen model supports it. */
  json?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Override the model from Settings, e.g. to test an unsaved choice. */
  model?: string;
}

/**
 * Run a completion for a task using the user's settings: the analysis or
 * generation model, their key, and JSON mode where the model supports it.
 * `analyze()` and `generate()` (M2, M4) are built on this.
 */
export async function completeTask(task: ModelTask, req: TaskRequest): Promise<CompletionResult> {
  const [prefs, apiKey, catalog] = await Promise.all([loadPreferences(), getApiKey(), loadCachedCatalog()]);
  const model = req.model ?? (task === 'analysis' ? prefs.analysisModel : prefs.generationModel);
  return complete(
    {
      model,
      system: req.system,
      user: req.user,
      maxTokens: req.maxTokens,
      temperature: req.temperature,
      json: req.json && supportsJson(catalog, model),
      signal: req.signal,
    },
    { apiKey, timeoutMs: req.timeoutMs },
  );
}

export interface ConnectionTestResult {
  model: string;
  reply: string;
  ms: number;
}

/**
 * A minimal real call to confirm the key and model work (M1 "done when").
 * The token budget is generous because reasoning models spend tokens
 * thinking before they answer, and too small a cap returns empty content.
 */
export async function testConnection(task: ModelTask, model?: string): Promise<ConnectionTestResult> {
  const started = performance.now();
  const res = await completeTask(task, {
    system: 'You are a connection test. Reply with the single Greek word χαῖρε and nothing else.',
    user: 'Test.',
    maxTokens: 1024,
    model,
  });
  return { model: res.model, reply: res.text.trim(), ms: Math.round(performance.now() - started) };
}
