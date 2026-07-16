import { useEffect, useState } from "react";

const FASES = [
  "Pensando...",
  "Consultando regras do Ofício...",
  "Analisando o projeto...",
  "Estruturando a resposta...",
];

/**
 * Indicador de "a IA está trabalhando" — spinner circular girando + texto de fase
 * rotativo. O texto cicla entre mensagens descritivas a cada ~2s para dar a
 * sensação de progresso real (não só "pensando" estático).
 * Respeita prefers-reduced-motion: sem rotação, só texto pulsando.
 */
export function ThinkingIndicator() {
  const [fase, setFase] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFase((atual) => (atual + 1) % FASES.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="sm-thinking">
      <span className="sm-thinking-spinner" />
      <span className="sm-thinking-text">{FASES[fase]}</span>
    </div>
  );
}
