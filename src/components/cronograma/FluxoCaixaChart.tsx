import { useState } from "react";
import type { Cenario, Project } from "../../lib/types";
import { calcularFluxoCaixaAnual } from "../../lib/fluxo-caixa";

const CENARIOS: { nome: Cenario["nome"]; rotulo: string }[] = [
  { nome: "otimista", rotulo: "Otimista" },
  { nome: "realista", rotulo: "Realista" },
  { nome: "pessimista", rotulo: "Pessimista" },
];

const LARGURA = 640;
const ALTURA = 220;
const MARGEM_INFERIOR = 26;
const MARGEM_SUPERIOR = 10;
const ALTURA_UTIL = ALTURA - MARGEM_INFERIOR - MARGEM_SUPERIOR;

/** Gráfico de barras SVG puro do fluxo de caixa estimado ao longo de 12 meses — sem libs, tokens de cor do próprio app. */
export function FluxoCaixaChart({ project }: { project: Project }) {
  const [cenario, setCenario] = useState<Cenario["nome"]>("realista");
  const { meses, mesesImplantacaoReais } = calcularFluxoCaixaAnual(project, cenario);

  const maiorAbsoluto = Math.max(1, ...meses.map((m) => Math.abs(m.valor)));
  const linhaZeroY = MARGEM_SUPERIOR + ALTURA_UTIL / 2;
  const escala = ALTURA_UTIL / 2 / maiorAbsoluto;

  const larguraBarra = LARGURA / 12 - 8;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {CENARIOS.map((c) => (
          <button
            key={c.nome}
            onClick={() => setCenario(c.nome)}
            className={`rounded border px-2 py-1 text-xs ${cenario === c.nome ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)] hover:border-[color:var(--sm-accent)]"}`}
          >
            {c.rotulo}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full" role="img" aria-label="Fluxo de caixa estimado ao longo de 12 meses">
        <line x1={0} y1={linhaZeroY} x2={LARGURA} y2={linhaZeroY} stroke="var(--sm-border)" strokeWidth={1} />
        {meses.map((m, i) => {
          const x = (LARGURA / 12) * i + 4;
          const alturaBarra = Math.abs(m.valor) * escala;
          const y = m.valor >= 0 ? linhaZeroY - alturaBarra : linhaZeroY;
          const cor = m.fase === "implantacao" ? "var(--sm-yellow)" : m.valor >= 0 ? "var(--sm-green)" : "var(--sm-red)";
          return (
            <g key={m.mes}>
              <rect x={x} y={y} width={larguraBarra} height={Math.max(1, alturaBarra)} fill={cor} rx={2} />
              <text x={x + larguraBarra / 2} y={ALTURA - 8} textAnchor="middle" fontSize={10} fill="var(--sm-text-dim)">
                {m.mes}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-[color:var(--sm-text-dim)]">
        🟡 implantação (meses 1–{Math.min(mesesImplantacaoReais, 12)}) · 🟢/🔴 operação em regime, cenário {CENARIOS.find((c) => c.nome === cenario)?.rotulo.toLowerCase()}.
        {mesesImplantacaoReais > 12 && ` A implantação real dura ~${mesesImplantacaoReais} meses — mostrando só os primeiros 12.`}
        {" "}Estimativa derivada do orçamento e do simulador — não é projeção contábil precisa.
      </p>
    </div>
  );
}
