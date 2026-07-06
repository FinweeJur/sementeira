import type { Severidade } from "../lib/types";

const COLORS: Record<Severidade, string> = {
  ok: "bg-[color:var(--sm-green)]/20 text-[color:var(--sm-green)] border-[color:var(--sm-green)]/40",
  atencao: "bg-[color:var(--sm-yellow)]/20 text-[color:var(--sm-yellow)] border-[color:var(--sm-yellow)]/40",
  bloqueio: "bg-[color:var(--sm-red)]/20 text-[color:var(--sm-red)] border-[color:var(--sm-red)]/40",
};

const LABELS: Record<Severidade, string> = {
  ok: "🟢 OK",
  atencao: "🟡 Atenção",
  bloqueio: "🔴 Bloqueio",
};

export function Badge({ severidade }: { severidade: Severidade }) {
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${COLORS[severidade]}`}>
      {LABELS[severidade]}
    </span>
  );
}
