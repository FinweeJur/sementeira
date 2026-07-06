import type { CategoriaLinha, Project } from "./types";

export interface FaixaCronograma {
  categoria: CategoriaLinha;
  label: string;
  inicioMes: number;
  fimMes: number;
  valorTotal: number;
}

const ROTULO_CATEGORIA: Record<CategoriaLinha, string> = {
  infraestrutura: "Infraestrutura",
  equipamento: "Equipamento",
  regularizacao: "Regularização",
  capacitacao: "Capacitação",
  "capital-giro-inicial": "Capital de giro inicial",
  "insumos-iniciais": "Insumos iniciais",
  "equipe-implantacao": "Equipe de implantação",
  "operacao-assistida": "Operação assistida",
  "folha-permanente": "Folha permanente",
  outro: "Outro",
};

/**
 * Cronograma de implantação agregado POR CATEGORIA (não por linha individual)
 * — evita poluir visualmente projetos com muitas linhas de orçamento (até
 * 15-20 linhas viram no máximo 10 faixas, uma por categoria presente).
 * Todas as faixas começam no mês 1 (sem dados de dependência sequencial entre
 * itens) e vão até o maior `prazoMeses` das linhas daquela categoria.
 */
export function calcularCronogramaImplantacao(project: Project): FaixaCronograma[] {
  const porCategoria = new Map<CategoriaLinha, { fimMes: number; valorTotal: number }>();

  for (const linha of project.orcamento) {
    const prazo = Math.max(1, linha.prazoMeses ?? 1);
    const atual = porCategoria.get(linha.categoria) ?? { fimMes: 0, valorTotal: 0 };
    porCategoria.set(linha.categoria, {
      fimMes: Math.max(atual.fimMes, prazo),
      valorTotal: atual.valorTotal + linha.valor,
    });
  }

  return Array.from(porCategoria.entries())
    .map(([categoria, { fimMes, valorTotal }]) => ({
      categoria,
      label: ROTULO_CATEGORIA[categoria],
      inicioMes: 1,
      fimMes,
      valorTotal,
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal);
}
