// Error kinds and user-facing messages for spec §8.5.

export type LlmErrorKind =
  | 'no_key' // no key configured
  | 'unauthorized' // 401 / 403: key rejected
  | 'no_credits' // 402: OpenRouter account out of credits
  | 'rate_limited' // 429 / 502 / 503 after retries ran out
  | 'network' // fetch itself failed
  | 'timeout'
  | 'bad_request' // 400 / 404 / 422: usually a bad model slug or parameters
  | 'server' // other 5xx
  | 'empty' // 200 with no usable content
  | 'aborted'; // cancelled by the user

export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  readonly status?: number;
  /** Provider's own message, kept for the details panel. */
  readonly detail?: string;

  constructor(kind: LlmErrorKind, opts: { status?: number; detail?: string } = {}) {
    super(opts.detail ? `${kind}: ${opts.detail}` : kind);
    this.name = 'LlmError';
    this.kind = kind;
    this.status = opts.status;
    this.detail = opts.detail;
  }
}

export type LlmErrorAction = 'settings' | 'credits' | 'retry' | null;

export interface LlmErrorDescription {
  title: string;
  message: string;
  action: LlmErrorAction;
}

export function describeLlmError(err: unknown): LlmErrorDescription {
  if (!(err instanceof LlmError)) {
    return {
      title: 'Something went wrong',
      message: err instanceof Error ? err.message : String(err),
      action: 'retry',
    };
  }
  switch (err.kind) {
    case 'no_key':
      return {
        title: 'No API key',
        message: 'Add your OpenRouter API key in Settings to analyse and generate text.',
        action: 'settings',
      };
    case 'unauthorized':
      return {
        title: 'Your API key was rejected',
        message: 'OpenRouter did not accept the key. Check it, or create a new one on OpenRouter.',
        action: 'settings',
      };
    case 'no_credits':
      return {
        title: 'Your OpenRouter account is out of credits',
        message: 'Add credits on OpenRouter, then try again.',
        action: 'credits',
      };
    case 'rate_limited':
      return {
        title: 'The model is busy',
        message:
          'OpenRouter is rate-limiting requests or the model is temporarily unavailable. We retried three times. Wait a moment and try again, or pick another model in Settings.',
        action: 'retry',
      };
    case 'network':
      return {
        title: 'Could not reach OpenRouter',
        message: 'Check your connection and try again. Your input has not been lost.',
        action: 'retry',
      };
    case 'timeout':
      return {
        title: 'The request timed out',
        message: 'The model took too long to answer. Try again, or try a shorter passage.',
        action: 'retry',
      };
    case 'bad_request':
      return {
        title: 'OpenRouter rejected the request',
        message:
          'This usually means the model name is wrong or the model is no longer offered. Check the model in Settings.',
        action: 'settings',
      };
    case 'server':
      return {
        title: 'OpenRouter had an error',
        message: 'This is on their side. Try again in a moment.',
        action: 'retry',
      };
    case 'empty':
      return {
        title: 'The model returned nothing',
        message: 'The response had no text in it. Try again, or pick another model.',
        action: 'retry',
      };
    case 'aborted':
      return { title: 'Cancelled', message: 'The request was cancelled.', action: null };
  }
}
