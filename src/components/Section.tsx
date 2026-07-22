import type { ReactNode } from "react";

export function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="sm-card rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-4 space-y-3">
      <h2 className="flex items-center gap-1.5 text-base font-semibold text-[color:var(--sm-text)]">{title}</h2>
      {children}
    </section>
  );
}
