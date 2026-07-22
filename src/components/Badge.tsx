import type { Severidade } from "../lib/types";

const COLORS: Record<Severidade, string> = {
  ok: "bg-[color:var(--sm-ok-bg)] text-[color:var(--sm-ok-text)] border-[color:var(--sm-ok-border)]",
  atencao: "bg-[color:var(--sm-atencao-bg)] text-[color:var(--sm-atencao-text)] border-[color:var(--sm-atencao-border)]",
  bloqueio: "bg-[color:var(--sm-bloqueio-bg)] text-[color:var(--sm-bloqueio-text)] border-[color:var(--sm-bloqueio-border)]",
};

const LABELS: Record<Severidade, string> = {
  ok: "Pode",
  atencao: "Olhe com atenção",
  bloqueio: "Não pode",
};

/** Cada severidade também tem uma forma fixa (círculo/triângulo/losango) além da cor — funciona em alto contraste e para quem não distingue bem cores. */
function Forma({ severidade }: { severidade: Severidade }) {
  if (severidade === "ok") {
    return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-full bg-current" />;
  }
  if (severidade === "atencao") {
    return (
      <span
        aria-hidden="true"
        className="inline-block h-0 w-0 flex-none border-x-[6px] border-b-[10px] border-x-transparent"
        style={{ borderBottomColor: "currentColor" }}
      />
    );
  }
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rotate-45 bg-current" />;
}

export function Badge({ severidade }: { severidade: Severidade }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${COLORS[severidade]}`}
      style={{ borderWidth: "var(--sm-border-width-severidade)" }}
    >
      <Forma severidade={severidade} />
      {LABELS[severidade]}
    </span>
  );
}
