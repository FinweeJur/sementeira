import type { Cenario, Project } from "./types";
import { simularTodos } from "./simulator";

export interface MesFluxoCaixa {
  mes: number;
  valor: number;
  fase: "implantacao" | "operacao";
}

const MESES_TOTAL = 12;

/**
 * Fluxo de caixa estimado ao longo de 12 meses — ESTIMATIVA derivada do
 * orçamento e do simulador, não é projeção contábil precisa (mesma
 * honestidade já aplicada à depreciação: mostrar a realidade, não inflar a
 * sustentabilidade). Modelo: meses 1..M são "implantação" — cada linha de
 * orçamento é distribuída uniformemente pelo seu próprio `prazoMeses`
 * (padrão 1 mês se não informado), M = maior prazo entre as linhas, com teto
 * de 12; meses (M+1)..12 usam o saldo em regime do cenário escolhido
 * (`simularTodos`, já incluindo depreciação).
 */
export function calcularFluxoCaixaAnual(project: Project, cenarioNome: Cenario["nome"]): { meses: MesFluxoCaixa[]; mesesImplantacaoReais: number } {
  const prazosLinhas = project.orcamento.map((l) => Math.max(1, l.prazoMeses ?? 1));
  const mesesImplantacaoReais = prazosLinhas.length > 0 ? Math.max(...prazosLinhas) : 1;
  const mesesImplantacao = Math.min(mesesImplantacaoReais, MESES_TOTAL);

  const capexPorMes = new Array(MESES_TOTAL + 1).fill(0);
  for (const linha of project.orcamento) {
    const prazo = Math.max(1, linha.prazoMeses ?? 1);
    const valorPorMes = linha.valor / prazo;
    for (let m = 1; m <= Math.min(prazo, MESES_TOTAL); m++) {
      capexPorMes[m] += valorPorMes;
    }
  }

  const simulacoes = simularTodos(project);
  const simulacao = simulacoes.find((s) => s.cenario === cenarioNome);
  const saldoEmRegime = simulacao?.saldoMensal ?? 0;

  const meses: MesFluxoCaixa[] = [];
  for (let m = 1; m <= MESES_TOTAL; m++) {
    if (m <= mesesImplantacao) {
      meses.push({ mes: m, valor: -capexPorMes[m], fase: "implantacao" });
    } else {
      meses.push({ mes: m, valor: saldoEmRegime, fase: "operacao" });
    }
  }

  return { meses, mesesImplantacaoReais };
}
