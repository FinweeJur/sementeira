import type { Project } from "../../lib/types";
import { calcularCronogramaImplantacao } from "../../lib/cronograma-gantt";

const PALETA = ["var(--sm-accent)", "var(--sm-green)", "var(--sm-yellow)", "var(--sm-red)", "var(--sm-accent)", "var(--sm-green)", "var(--sm-yellow)", "var(--sm-red)", "var(--sm-accent)", "var(--sm-green)"];

const LARGURA = 640;
const ALTURA_LINHA = 26;
const LARGURA_ROTULO = 160;
const LARGURA_GRADE = LARGURA - LARGURA_ROTULO;

/** Cronograma visual (Gantt simplificado) da implantação, agregado por categoria de orçamento — SVG puro, sem lib. */
export function CronogramaGantt({ project }: { project: Project }) {
  const faixas = calcularCronogramaImplantacao(project);
  if (faixas.length === 0) {
    return <p className="text-sm text-[color:var(--sm-text-dim)]">Sem linhas de orçamento com prazo definido ainda.</p>;
  }

  const mesesMax = Math.min(12, Math.max(...faixas.map((f) => f.fimMes)));
  const altura = faixas.length * ALTURA_LINHA + 24;

  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${LARGURA} ${altura}`} className="w-full" role="img" aria-label="Cronograma de implantação por categoria">
        {Array.from({ length: mesesMax }, (_, i) => i + 1).map((mes) => (
          <line
            key={mes}
            x1={LARGURA_ROTULO + (LARGURA_GRADE / mesesMax) * mes}
            y1={0}
            x2={LARGURA_ROTULO + (LARGURA_GRADE / mesesMax) * mes}
            y2={altura - 20}
            stroke="var(--sm-border)"
            strokeWidth={0.5}
          />
        ))}
        {faixas.map((f, i) => {
          const y = i * ALTURA_LINHA;
          const fimClamp = Math.min(f.fimMes, 12);
          const x = LARGURA_ROTULO + (LARGURA_GRADE / mesesMax) * (f.inicioMes - 1);
          const largura = (LARGURA_GRADE / mesesMax) * (fimClamp - f.inicioMes + 1);
          return (
            <g key={f.categoria}>
              <text x={0} y={y + ALTURA_LINHA / 2 + 4} fontSize={11} fill="var(--sm-text)">
                {f.label}
              </text>
              <rect x={x} y={y + 4} width={Math.max(4, largura)} height={ALTURA_LINHA - 10} fill={PALETA[i % PALETA.length]} rx={3} opacity={0.85} />
            </g>
          );
        })}
        {Array.from({ length: mesesMax }, (_, i) => i + 1).map((mes) => (
          <text key={mes} x={LARGURA_ROTULO + (LARGURA_GRADE / mesesMax) * (mes - 0.5)} y={altura - 6} textAnchor="middle" fontSize={9} fill="var(--sm-text-dim)">
            {mes}
          </text>
        ))}
      </svg>
      <p className="text-xs text-[color:var(--sm-text-dim)]">
        Meses de implantação por categoria de orçamento (agregado — não por linha individual). Estimativa derivada dos prazos informados no orçamento.
      </p>
    </div>
  );
}
