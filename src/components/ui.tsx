import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Small shared controls, so screens share one look.

type Variant = 'primary' | 'secondary' | 'quiet';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-paper hover:opacity-90',
  secondary: 'border border-rule hover:border-muted',
  quiet: 'text-muted hover:text-ink underline underline-offset-2',
};

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const box = variant === 'quiet' ? '' : 'rounded-md px-3 py-1.5';
  return (
    <button
      type="button"
      className={`${box} text-sm ${VARIANTS[variant]} disabled:opacity-50 disabled:pointer-events-none ${className}`}
      {...props}
    />
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-rule pt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="text-sm text-muted mt-1 max-w-prose">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export const inputClass =
  'w-full rounded-md border border-rule bg-transparent px-3 py-1.5 text-sm placeholder:text-muted focus:border-muted';

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok'; children: ReactNode }) {
  const tones = {
    info: 'border-rule',
    warn: 'border-accent/60 bg-accent/5',
    ok: 'border-emerald-600/50 bg-emerald-600/5',
  };
  return <div className={`rounded-md border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}
