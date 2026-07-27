import { useEffect, useState } from "react";
import type { PassoWizard } from "../lib/types";
import { DICAS_POR_PASSO, DICAS_GERAIS, type DicaContextual as DicaContextualDados } from "../lib/dicas-contextuais";
import { dicaDispensada, marcarDicaDispensada } from "../lib/preferences";
import { BookOpen, X } from "lucide-react";

const ROTULO_DOCUMENTO: Record<DicaContextualDados["documento"], string> = {
  "proposta-definitiva": "Proposta Definitiva",
  "oficio-46": "Ofício 46",
};

/**
 * Dica não-invasiva de canto de tela, ligada à Biblioteca (Proposta
 * Definitiva/Ofício 46). Fica no canto inferior esquerdo — o único canto
 * livre: a sanfona (SidebarNav) fica à esquerda centralizada, o indicador de
 * tarefas fica embaixo à direita, e o Copiloto/chat ocupa a direita (tela
 * cheia no mobile). `z-30`, abaixo de todos esses (`z-40`/`z-50`), então
 * qualquer overlay cobre a dica sozinho — nunca precisa competir com o chat.
 */
export function DicaContextual({ passoAtual, onAbrirBiblioteca }: { passoAtual?: PassoWizard; onAbrirBiblioteca?: () => void }) {
  const dica = passoAtual ? DICAS_POR_PASSO[passoAtual] : undefined;
  const [dicaGeral] = useState(() => DICAS_GERAIS[Math.floor(Math.random() * DICAS_GERAIS.length)]);
  const efetiva = dica ?? dicaGeral;

  const [dispensada, setDispensada] = useState(() => dicaDispensada(efetiva.id));

  // Troca de passo pode trazer uma dica diferente já dispensada antes — reavalia.
  useEffect(() => {
    setDispensada(dicaDispensada(efetiva.id));
  }, [efetiva.id]);

  if (dispensada) return null;

  return (
    <div
      className="no-print fixed bottom-4 left-4 z-30 w-64 max-w-[calc(100vw-2rem)] rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-3 text-xs shadow-lg sm-fade"
      role="note"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 font-medium text-[color:var(--sm-accent)]">
          <BookOpen size={12} strokeWidth={2} />
          {ROTULO_DOCUMENTO[efetiva.documento]}
        </span>
        <button
          onClick={() => {
            marcarDicaDispensada(efetiva.id);
            setDispensada(true);
          }}
          aria-label="Dispensar dica"
          className="shrink-0 text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
      <p className="mt-1 text-[color:var(--sm-text-dim)]">{efetiva.texto}</p>
      {onAbrirBiblioteca && (
        <button onClick={onAbrirBiblioteca} className="mt-1.5 text-[color:var(--sm-accent)] hover:underline">
          Ver na Biblioteca →
        </button>
      )}
    </div>
  );
}
