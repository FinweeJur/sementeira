import type { FontScale, Tema } from "../lib/preferences";
import { Tooltip } from "./Tooltip";

const TEMAS: { id: Tema; rotulo: string; icone: string; dica: string }[] = [
  { id: "escuro", rotulo: "Escuro", icone: "🌙", dica: "Tema escuro (padrão)" },
  { id: "claro", rotulo: "Claro", icone: "☀️", dica: "Tema claro" },
  { id: "alto-contraste", rotulo: "Alto contraste", icone: "◐", dica: "Tema de alto contraste (acessibilidade)" },
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
    <div className="no-print sticky top-0 z-40 flex items-center justify-between border-b border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] px-4 py-1.5">
      <span className="text-xs font-medium text-[color:var(--sm-text-dim)]">🌱 Sementeira</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {TEMAS.map((t) => (
            <Tooltip key={t.id} texto={t.dica} posicao="bottom">
              <button
                onClick={() => onTema(t.id)}
                aria-label={`Tema ${t.rotulo}`}
                className={`rounded border px-1.5 py-1 text-xs ${tema === t.id ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)]"}`}
              >
                {t.icone}
              </button>
            </Tooltip>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(["pequena", "normal", "grande"] as FontScale[]).map((s) => (
            <Tooltip key={s} texto={`Tamanho de fonte ${s}`} posicao="bottom">
              <button
                onClick={() => onFontScale(s)}
                className={`rounded border px-2 py-1 ${fontScale === s ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)]"}`}
              >
                A{s === "pequena" ? "-" : s === "grande" ? "+" : ""}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
