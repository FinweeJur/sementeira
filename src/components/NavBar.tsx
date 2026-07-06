import type { FontScale, Tema } from "../lib/preferences";

const TEMAS: { id: Tema; rotulo: string; icone: string }[] = [
  { id: "escuro", rotulo: "Escuro", icone: "🌙" },
  { id: "claro", rotulo: "Claro", icone: "☀️" },
  { id: "alto-contraste", rotulo: "Alto contraste", icone: "◐" },
];

/** Barra fixa presente em todas as telas — tema e tamanho de texto ficam num só lugar, não duplicados por página. */
export function NavBar({
  tema,
  onTema,
  fontScale,
  onFontScale,
}: {
  tema: Tema;
  onTema: (t: Tema) => void;
  fontScale: FontScale;
  onFontScale: (s: FontScale) => void;
}) {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between border-b border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] px-4 py-1.5">
      <span className="text-xs font-medium text-[color:var(--sm-text-dim)]">🌱 Sementeira</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {TEMAS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTema(t.id)}
              title={t.rotulo}
              aria-label={`Tema ${t.rotulo}`}
              className={`rounded border px-1.5 py-1 text-xs ${tema === t.id ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)]"}`}
            >
              {t.icone}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(["pequena", "normal", "grande"] as FontScale[]).map((s) => (
            <button
              key={s}
              onClick={() => onFontScale(s)}
              className={`rounded border px-2 py-1 ${fontScale === s ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)]"}`}
              title={`Texto ${s}`}
            >
              A{s === "pequena" ? "-" : s === "grande" ? "+" : ""}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
