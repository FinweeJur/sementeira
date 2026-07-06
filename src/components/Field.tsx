import type { ReactNode } from "react";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-[color:var(--sm-text)]">{label}</span>
      {hint && <span className="block text-xs text-[color:var(--sm-text-dim)]">{hint}</span>}
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] px-3 py-2 text-sm text-[color:var(--sm-text)] outline-none focus:border-[color:var(--sm-accent)]";
