import { useState } from "react";

const TELAS = [
  {
    titulo: "O que é a Sementeira",
    texto:
      "A Sementeira ajuda você a transformar uma ideia em um projeto completo para o Anexo I.1 — a mesma 'Sementeira de Ideias' prevista na Proposta Definitiva, agora com apoio passo a passo.",
  },
  {
    titulo: "Como funciona",
    texto:
      "1) Você conta o dano que quer reparar. 2) Escolhe um tipo de projeto. 3) Preenche o orçamento — o programa avisa na hora o que não pode ser pago. 4) Você simula se o projeto se sustenta sozinho depois. 5) Exporta tudo pronto.",
  },
  {
    titulo: "Vamos começar",
    texto: "Você pode rever este tutorial a qualquer momento pelo botão no rodapé da tela inicial.",
  },
];

export function Onboarding({ onConcluir }: { onConcluir: (comecarProjeto: boolean) => void }) {
  const [passo, setPasso] = useState(0);
  const tela = TELAS[passo];
  const ultimo = passo === TELAS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-6 space-y-4">
        <div className="flex gap-1">
          {TELAS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full sm-fade"
              style={{ background: i <= passo ? "var(--sm-accent)" : "var(--sm-border)" }}
            />
          ))}
        </div>
        <h2 className="text-lg font-semibold">{tela.titulo}</h2>
        <p className="text-sm text-[color:var(--sm-text-dim)]">{tela.texto}</p>
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => onConcluir(false)} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            Pular tutorial
          </button>
          <button
            onClick={() => (ultimo ? onConcluir(true) : setPasso(passo + 1))}
            className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-4 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/30"
          >
            {ultimo ? "🌱 Começar meu primeiro projeto" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
