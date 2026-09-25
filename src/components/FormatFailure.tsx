import type { FormatError } from '@/lib/llm/structured';
import { Button, Callout } from './ui';

// The model answered but its output could not be used (spec §8.2 step 4):
// say so, save nothing, and show the raw output for inspection.
export function FormatFailure({
  error,
  onRetry,
  what = 'analysis',
}: {
  error: FormatError;
  onRetry: () => void;
  what?: 'analysis' | 'generation';
}) {
  return (
    <Callout tone="warn">
      <div role="alert">
        <p className="font-medium">
          {error.truncated ? `The ${what} was cut off` : 'The model’s answer could not be read'}
        </p>
        <p className="mt-1 text-muted">
          {error.truncated
            ? what === 'analysis'
              ? 'The response hit the output limit before it finished. Try a shorter passage, or split a paragraph into periods.'
              : 'The response hit the output limit before it finished. Try fewer variations.'
            : 'It did not match the expected format, even after one repair attempt. Nothing was saved.'}
        </p>
      </div>
      <Button variant="quiet" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted">Raw output and errors</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-rule/40 p-2">{error.errors}</pre>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-rule/40 p-2">{error.raw}</pre>
      </details>
    </Callout>
  );
}
