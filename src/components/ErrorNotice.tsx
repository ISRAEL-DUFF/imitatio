import { Link, useLocation } from 'react-router';
import { describeLlmError, LlmError } from '@/lib/llm/errors';
import { Button, Callout } from './ui';

// Shows an LLM failure the way spec §8.5 asks: what happened, and the one
// thing to do about it.
export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { pathname } = useLocation();
  const { title, message, action } = describeLlmError(error);
  const detail = error instanceof LlmError ? error.detail : undefined;
  const status = error instanceof LlmError ? error.status : undefined;

  return (
    <Callout tone="warn">
      <div role="alert">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-muted">{message}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 items-center">
        {action === 'settings' && pathname !== '/settings' && (
          <Link to="/settings" className="text-accent underline">
            Open Settings
          </Link>
        )}
        {action === 'credits' && (
          <a href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer" className="text-accent underline">
            Add credits on OpenRouter
          </a>
        )}
        {action === 'retry' && onRetry && (
          <Button variant="quiet" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
      {(detail || status) && (
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer">Details</summary>
          <p className="mt-1 font-mono break-words">
            {status && `HTTP ${status}. `}
            {detail}
          </p>
        </details>
      )}
    </Callout>
  );
}
