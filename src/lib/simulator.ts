import type { Cenario, CustoNaoCobertoItem, Project } from "./types";
import { PORTE_POR_ABRANGENCIA } from "./types";

export interface SimulacaoResultado {
  cenario: Cenario["nome"];
  custoOperacionalTotalMensal: number;
  receitaMensalEstimada: number;
  saldoMensal: number;
  autossustentavel: boolean;
  custosSemFonteFutura: CustoNaoCobertoItem[];
  depreciacaoMensal: number;
}

const VIDA_UTIL_PADRAO_ANOS = 5;

/**
 * Depreciação mensal do maquinário/equipamentos comprados pelo projeto —
 * sem isso, o POS ignora que equipamento se desgasta e precisa ser reposto,
 * o que superestima a sustentabilidade real do projeto após o repasse.
 */
export function calcularDepreciacaoMensal(project: Project): number {
  return project.orcamento
    .filter((l) => l.categoria === "equipamento" && l.valor > 0)
    .reduce((soma, l) => soma + l.valor / ((l.vidaUtilAnos ?? VIDA_UTIL_PADRAO_ANOS) * 12), 0);
}

/**
 * Simulador "o dia seguinte ao fim do dinheiro": soma o custo operacional
 * informado no cenário aos custos não cobertos pelo Anexo I.1 (água, energia,
 * internet, telefone, contabilidade, jurídico, propaganda etc.) e à
 * depreciação mensal de equipamentos, e verifica se a receita projetada
 * cobre esse total, mês a mês, sem novo repasse.
 */
export function simularCenario(project: Project, cenario: Cenario): SimulacaoResultado {
  const custosNaoCobertosMensal = project.custosNaoCobertos.reduce(
    (soma, c) => soma + c.valorMensalEstimado,
    0,
  );
  const depreciacaoMensal = calcularDepreciacaoMensal(project);
  const custoOperacionalTotalMensal = cenario.custoOperacionalMensal + custosNaoCobertosMensal + depreciacaoMensal;
  const saldoMensal = cenario.receitaMensalEstimada - custoOperacionalTotalMensal;

  const custosSemFonteFutura = project.custosNaoCobertos.filter((c) => !c.fonteCusteioFuturo);
  const depreciacaoSemFonte = depreciacaoMensal > 0 && !project.fonteReposicaoEquipamentos;

  return {
    cenario: cenario.nome,
    custoOperacionalTotalMensal,
    receitaMensalEstimada: cenario.receitaMensalEstimada,
    saldoMensal,
    autossustentavel: saldoMensal >= 0 && custosSemFonteFutura.length === 0 && !depreciacaoSemFonte,
    custosSemFonteFutura,
    depreciacaoMensal,
  };
}

export function simularTodos(project: Project): SimulacaoResultado[] {
  return project.cenarios.map((c) => simularCenario(project, c));
}

/** Grau de exigência do POS conforme o porte territorial (não o R$). */
export function exigenciaPOS(project: Project): "dispensado" | "simplificado" | "completo" {
  const porte = PORTE_POR_ABRANGENCIA[project.abrangencia];
  if (porte === "pequeno") return "simplificado";
  return "completo";
}

/**
 * Onda de execução (Proposta pág. 25): a 1ª onda cobre projetos locais e
 * regionais, com teto de 12 meses até a contratação. Projetos inter-regionais
 * só entram na 2ª onda (após a contratação da 1ª). Isso não é uma regra
 * rígida de calendário — é a expectativa de cronograma que a pessoa deve
 * respeitar ao preencher o campo de cronograma.
 */
export function ondaEsperada(project: Project): { onda: 1 | 2; tetoMeses?: number } {
  if (project.abrangencia === "inter-regional") return { onda: 2 };
  return { onda: 1, tetoMeses: 12 };
}
