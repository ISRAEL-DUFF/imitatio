import type { ReactNode } from 'react';

// Placeholder frame for screens that later milestones fill in.
export function PageStub({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">{title}</h1>
      <div className="text-muted space-y-3">{children}</div>
    </section>
  );
}
