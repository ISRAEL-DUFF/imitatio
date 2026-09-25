// Every default model id lives here (spec §8.1), so a model withdrawn upstream
// is a one-line change rather than a hunt through call sites.
export const DEFAULT_MODELS = {
  /** Reasoning model: better morphology and syntax, bills reasoning tokens. */
  analysis: 'google/gemini-3.7-flash',
  /** No reasoning overhead: cheap and fast for compositions. */
  generation: 'google/gemini-3.1-flash-lite',
} as const;

export type ModelTask = keyof typeof DEFAULT_MODELS;
