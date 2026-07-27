import { useEffect, useState } from "react";

const FASES_PADRAO = [
  "Pensando...",
  "Consultando regras do Ofício...",
  "Analisando o projeto...",
  "Estruturando a resposta...",
];

/** Fases de quem fala como Dona Lúcia — dialogam com os princípios da reparação (ver src/lib/documentos-base.ts). */
const FASES_DONA_LUCIA = [
  "Dona Lúcia está pensando...",
  "Lembrando os princípios da reparação integral...",
  "Conferindo o que o Ofício 46 permite...",
  "Pensando em quem esse projeto vai ajudar...",
  "Separando o que é regra do que é escolha da comunidade...",
];

/**
 * Indicador de "a IA está trabalhando" — spinner circular girando + texto de fase
 * rotativo. O texto cicla entre mensagens descritivas a cada ~2s para dar a
 * sensação de progresso real (não só "pensando" estático).
 * Respeita prefers-reduced-motion: sem rotação, só texto pulsando.
 *
 * `persona="dona-lucia"` troca as fases pelas da persona do Copiloto de chat
 * (ver documentos-base.ts) — usado só onde ela de fato "fala" com a pessoa.
 */
export function ThinkingIndicator({ persona = "padrao" }: { persona?: "padrao" | "dona-lucia" }) {
  const [fase, setFase] = useState(0);
  const fases = persona === "dona-lucia" ? FASES_DONA_LUCIA : FASES_PADRAO;

  useEffect(() => {
    const id = setInterval(() => {
      setFase((atual) => (atual + 1) % fases.length);
    }, 2000);
    return () => clearInterval(id);
  }, [fases.length]);

  return (
    <div className="sm-thinking">
      <span className="sm-thinking-spinner" />
      <span className="sm-thinking-text">{fases[fase]}</span>
    </div>
  );
}
