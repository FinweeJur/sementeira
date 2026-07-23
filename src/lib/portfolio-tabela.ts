import type { Project } from "./types";
import { PORTE_POR_ABRANGENCIA } from "./types";
import { avaliarConformidade } from "./compliance-engine";
import { simularTodos, exigenciaPOS } from "./simulator";
import { calcularSaldosRealistas, calcularCotaEquidade, simularFundoRotativo } from "./ecosystem";
import { municipioPorId, MUNICIPIOS_PARAOPEBA } from "./geografia";
import { normalizarTexto } from "./texto";
import { nomeArquetipo, nomeDano, nomeSetor } from "./nomes";
import { CABECALHOS_CALCULADOS, COLUNAS_PLANILHA } from "./planilha-colunas";

/**
 * Modelo da planilha do portfólio, independente de como ela é apresentada.
 *
 * Existe para que a planilha que a pessoa VÊ na tela e o .xlsx que ela BAIXA
 * sejam literalmente a mesma coisa. Quando a montagem das linhas morava dentro
 * do exportador, qualquer visualização na tela seria uma segunda implementação
 * — e as duas divergiriam na primeira mudança de coluna.
 */

export type Celula = string | number | null;

export type FormatoCelula = "texto" | "moeda" | "percentual" | "inteiro";

export interface ColunaTabela {
  titulo: string;
  formato: FormatoCelula;
  /** Largura em caracteres — usada no Excel e como base da largura na tela. */
  largura: number;
  /** Texto corrido (objetivo, justificativa): ocultável na tela para a tabela caber. */
  textoLongo?: boolean;
}

export interface LinhaTabela {
  celulas: Celula[];
  /** `secao` e `total` são destacadas em negrito nas duas saídas. */
  tipo?: "dados" | "secao" | "total";
  /** Formato por célula, quando a coluna sozinha não define (caso do Resumo). */
  formatos?: (FormatoCelula | undefined)[];
  /** Id do projeto da linha, quando houver — permite clicar e abrir o projeto. */
  projectId?: string;
}

export interface AbaTabela {
  id: string;
  nome: string;
  descricao: string;
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function totalOrcamento(project: Project): number {
  return project.orcamento.reduce((s, l) => s + l.valor, 0);
}

function tetoDoProjeto(project: Project): number {
  return project.tetoPorte[PORTE_POR_ABRANGENCIA[project.abrangencia]];
}

export function tituloDe(project: Project): string {
  return project.titulo || "(sem título)";
}

function dataCurta(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

function col(titulo: string, formato: FormatoCelula = "texto", largura = 22, textoLongo = false): ColunaTabela {
  return { titulo, formato, largura, textoLongo };
}

/**
 * Município do projeto para fins de agrupamento. Muitos projetos só têm o
 * `local` em texto livre ("Comunidade de Aranha, Brumadinho/MG") — sem casar
 * esse texto contra a lista da bacia, a "distribuição por município" viraria
 * uma linha por projeto e não agruparia nada.
 */
export function municipioDoProjeto(project: Project): string {
  const porId = municipioPorId(project.municipioId);
  if (porId) return porId.nome;
  const local = normalizarTexto(project.local ?? "");
  if (local) {
    const achado = MUNICIPIOS_PARAOPEBA.find((m) => local.includes(normalizarTexto(m.nome)));
    if (achado) return achado.nome;
  }
  return project.local?.trim() || "(não informado)";
}

/** Formatação para leitura humana — usada na tela; no Excel o número vai cru com numFmt. */
export function formatarCelula(valor: Celula, formato: FormatoCelula): string {
  if (valor === null || valor === undefined || valor === "") return "";
  if (formato === "moeda" && typeof valor === "number") {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (formato === "percentual" && typeof valor === "number") {
    return (valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
  }
  if (formato === "inteiro" && typeof valor === "number") {
    return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
  return String(valor);
}

// ---------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------

/**
 * Aba "Projetos" — uma linha por projeto. Os títulos das colunas são
 * exatamente os `cabecalho` de COLUNAS_PLANILHA seguidos dos calculados, o que
 * permite exportar, editar no Excel e reimportar em lote sem perder o
 * mapeamento. Mexer na ordem aqui exige mexer em COLUNAS_PLANILHA.
 */
function abaProjetos(projects: Project[]): AbaTabela {
  const saldoPorId = new Map(calcularSaldosRealistas(projects).map((s) => [s.projectId, s.saldoMensalRealista]));

  const colunasEditaveis: ColunaTabela[] = COLUNAS_PLANILHA.map((c) => {
    const longo = ["objetivo", "objetivosEspecificos", "justificativa", "metas", "producaoTexto", "itensTexto", "riscosTexto", "cronograma", "formasArrecadacao", "comoComunidadeAjuda", "missaoImpacto", "publicoAlvo"].includes(c.campo);
    if (c.campo === "valorTotal") return col(c.cabecalho, "moeda", 18);
    if (c.campo === "pessoasAtendidasDiretas" || c.campo === "pessoasAtendidasIndiretas") return col(c.cabecalho, "inteiro", 16);
    return col(c.cabecalho, "texto", longo ? 40 : 22, longo);
  });

  const colunasCalculadas: ColunaTabela[] = CABECALHOS_CALCULADOS.map((titulo) => {
    if (titulo.includes("(R$)")) return col(titulo, "moeda", 18);
    if (titulo === "% do teto") return col(titulo, "percentual", 12);
    if (titulo.startsWith("Nº") || titulo === "Bloqueios" || titulo === "Atenções" || titulo === "Versão da lapidação") return col(titulo, "inteiro", 14);
    return col(titulo, "texto", 16);
  });

  const linhas: LinhaTabela[] = projects.map((p) => {
    const total = totalOrcamento(p);
    const teto = tetoDoProjeto(p);
    const conformidade = avaliarConformidade(p);
    const realista = simularTodos(p).find((s) => s.cenario === "realista");

    return {
      projectId: p.id,
      celulas: [
        tituloDe(p),
        nomeArquetipo(p.arquetipoId),
        nomeDano(p.danoId),
        nomeSetor(p.setorId),
        p.coordenacaoFeminina ? "Sim" : "Não",
        p.local,
        municipioPorId(p.municipioId)?.nome ?? "",
        p.abrangencia,
        p.publicoAlvo ?? "",
        p.pessoasAtendidasDiretas ?? null,
        p.pessoasAtendidasIndiretas ?? null,
        p.objetivo,
        (p.objetivosEspecificos ?? []).join("\n"),
        p.justificativa,
        p.metas.join("\n"),
        total,
        (p.producaoEstimada ?? []).map((i) => [i.quantidade, i.unidade, i.item, i.periodicidade].filter(Boolean).join(" ")).join("\n"),
        (p.itensNecessarios ?? []).map((i) => [i.quantidade, i.unidade, i.descricao, i.jaPossui ? "(já possui)" : ""].filter(Boolean).join(" ")).join("\n"),
        p.riscos.map((r) => r.descricao).join("\n"),
        p.cronograma,
        p.formasArrecadacao.join("\n"),
        p.comoComunidadeAjuda ?? "",
        p.missaoImpacto ?? "",
        p.contato.coordenador ?? "",
        p.contato.telefone ?? "",
        p.contato.email ?? "",
        // Calculados — ignorados na reimportação.
        PORTE_POR_ABRANGENCIA[p.abrangencia],
        teto,
        teto > 0 ? total / teto : 0,
        exigenciaPOS(p),
        saldoPorId.get(p.id) ?? 0,
        realista?.autossustentavel ? "Sim" : "Não",
        p.metas.length,
        (p.indicadores ?? []).length,
        p.riscos.filter((r) => r.probabilidade === "alto" || r.impacto === "alto").length,
        (p.itensNecessarios ?? []).length,
        conformidade.filter((f) => f.severidade === "bloqueio").length,
        conformidade.filter((f) => f.severidade === "atencao").length,
        p.versaoLapidacao ?? 0,
        dataCurta(p.criadoEm),
        dataCurta(p.atualizadoEm),
      ],
    };
  });

  return {
    id: "projetos",
    nome: "Projetos",
    descricao: "Um projeto por linha. Esta é a aba que pode ser editada no Excel e reimportada em lote.",
    colunas: [...colunasEditaveis, ...colunasCalculadas],
    linhas,
  };
}

function abaOrcamento(projects: Project[]): AbaTabela {
  const linhas: LinhaTabela[] = [];
  for (const p of projects) {
    for (const l of p.orcamento) {
      linhas.push({
        projectId: p.id,
        celulas: [tituloDe(p), l.categoria, l.descricao, l.valor, l.prazoMeses ?? null, l.fonteCusteioFuturo ?? "", l.vidaUtilAnos ?? null],
      });
    }
  }
  linhas.push({
    tipo: "total",
    celulas: ["TOTAL GERAL", "", "", projects.reduce((s, p) => s + totalOrcamento(p), 0), null, "", null],
  });

  return {
    id: "orcamento",
    nome: "Orçamento consolidado",
    descricao: "Todas as linhas de orçamento de todos os projetos, juntas.",
    colunas: [
      col("Projeto", "texto", 30),
      col("Categoria", "texto", 20),
      col("Descrição", "texto", 45),
      col("Valor (R$)", "moeda", 16),
      col("Prazo (meses)", "inteiro", 14),
      col("Fonte de custeio futuro", "texto", 32),
      col("Vida útil (anos)", "inteiro", 14),
    ],
    linhas,
  };
}

function abaMetas(projects: Project[]): AbaTabela {
  const linhas: LinhaTabela[] = [];
  for (const p of projects) {
    for (const m of p.metas) linhas.push({ projectId: p.id, celulas: [tituloDe(p), "Meta", m, "", "", ""] });
    for (const o of p.objetivosEspecificos ?? []) linhas.push({ projectId: p.id, celulas: [tituloDe(p), "Objetivo específico", o, "", "", ""] });
    for (const i of p.indicadores ?? []) {
      linhas.push({ projectId: p.id, celulas: [tituloDe(p), "Indicador", i.nome, i.meta, i.meioVerificacao ?? "", i.frequencia ?? ""] });
    }
  }
  return {
    id: "metas",
    nome: "Metas e indicadores",
    descricao: "O que cada projeto promete e como pretende comprovar.",
    colunas: [
      col("Projeto", "texto", 30),
      col("Tipo", "texto", 20),
      col("Descrição", "texto", 50),
      col("Meta / valor", "texto", 26),
      col("Meio de verificação", "texto", 30),
      col("Frequência", "texto", 16),
    ],
    linhas,
  };
}

function abaPublico(projects: Project[]): AbaTabela {
  const linhas: LinhaTabela[] = [];
  for (const p of projects) {
    const producao = p.producaoEstimada ?? [];
    if (producao.length === 0) {
      linhas.push({
        projectId: p.id,
        celulas: [tituloDe(p), p.publicoAlvo ?? "", nomeSetor(p.setorId), p.pessoasAtendidasDiretas ?? null, p.pessoasAtendidasIndiretas ?? null, "", null, "", ""],
      });
      continue;
    }
    producao.forEach((item, i) => {
      linhas.push({
        projectId: p.id,
        celulas: [
          tituloDe(p),
          i === 0 ? p.publicoAlvo ?? "" : "",
          i === 0 ? nomeSetor(p.setorId) : "",
          i === 0 ? p.pessoasAtendidasDiretas ?? null : null,
          i === 0 ? p.pessoasAtendidasIndiretas ?? null : null,
          item.item,
          item.quantidade ?? null,
          item.unidade ?? "",
          item.periodicidade ?? "",
        ],
      });
    });
  }
  return {
    id: "publico",
    nome: "Público e produção",
    descricao: "Quem é atendido, quantas pessoas e o que o projeto produz.",
    colunas: [
      col("Projeto", "texto", 30),
      col("Público-alvo", "texto", 35),
      col("Setor / público prioritário", "texto", 28),
      col("Pessoas atendidas (diretas)", "inteiro", 16),
      col("Pessoas atendidas (indiretas)", "inteiro", 16),
      col("Item produzido", "texto", 30),
      col("Quantidade", "inteiro", 12),
      col("Unidade", "texto", 12),
      col("Periodicidade", "texto", 18),
    ],
    linhas,
  };
}

function abaItens(projects: Project[]): AbaTabela {
  const linhas: LinhaTabela[] = [];
  for (const p of projects) {
    for (const item of p.itensNecessarios ?? []) {
      linhas.push({
        projectId: p.id,
        celulas: [tituloDe(p), item.descricao, item.quantidade ?? null, item.unidade ?? "", item.jaPossui ? "Sim" : "Não", item.observacoes ?? ""],
      });
    }
  }
  return {
    id: "itens",
    nome: "Itens necessários",
    descricao: "O que precisa existir para o projeto rodar, inclusive doações e o que a comunidade já tem.",
    colunas: [
      col("Projeto", "texto", 30),
      col("Item", "texto", 40),
      col("Quantidade", "inteiro", 12),
      col("Unidade", "texto", 12),
      col("Já possui?", "texto", 12),
      col("Observações", "texto", 35, true),
    ],
    linhas,
  };
}

function abaRiscos(projects: Project[]): AbaTabela {
  const linhas: LinhaTabela[] = [];
  for (const p of projects) {
    for (const r of p.riscos) {
      linhas.push({ projectId: p.id, celulas: [tituloDe(p), r.descricao, r.probabilidade, r.impacto, r.mitigacao] });
    }
  }
  return {
    id: "riscos",
    nome: "Riscos",
    descricao: "Matriz de risco de todos os projetos.",
    colunas: [
      col("Projeto", "texto", 30),
      col("Descrição", "texto", 45),
      col("Probabilidade", "texto", 16),
      col("Impacto", "texto", 14),
      col("Mitigação", "texto", 45),
    ],
    linhas,
  };
}

function abaConformidade(projects: Project[]): AbaTabela {
  const linhas: LinhaTabela[] = [];
  for (const p of projects) {
    for (const f of avaliarConformidade(p)) {
      linhas.push({ projectId: p.id, celulas: [tituloDe(p), f.severidade, f.regra, f.mensagem] });
    }
  }
  return {
    id: "conformidade",
    nome: "Conformidade",
    descricao: "Achados do motor determinístico — não é opinião de IA.",
    colunas: [col("Projeto", "texto", 30), col("Severidade", "texto", 14), col("Regra", "texto", 28), col("Mensagem", "texto", 70)],
    linhas,
  };
}

function abaResumo(projects: Project[]): AbaTabela {
  const totalGeral = projects.reduce((s, p) => s + totalOrcamento(p), 0);
  const cota = calcularCotaEquidade(projects);
  // `simularFundoRotativo` recebe o percentual em escala 0–100.
  const fundo = simularFundoRotativo(projects, 10);
  const pessoasDiretas = projects.reduce((s, p) => s + (p.pessoasAtendidasDiretas ?? 0), 0);
  const pessoasIndiretas = projects.reduce((s, p) => s + (p.pessoasAtendidasIndiretas ?? 0), 0);
  const bloqueios = projects.reduce((s, p) => s + avaliarConformidade(p).filter((f) => f.severidade === "bloqueio").length, 0);

  const linhas: LinhaTabela[] = [
    { celulas: ["Projetos no portfólio", projects.length, null], formatos: [undefined, "inteiro", undefined] },
    { celulas: ["Valor total solicitado", totalGeral, null], formatos: [undefined, "moeda", undefined] },
    { celulas: ["Pessoas atendidas diretamente", pessoasDiretas, null], formatos: [undefined, "inteiro", undefined] },
    { celulas: ["Pessoas alcançadas indiretamente", pessoasIndiretas, null], formatos: [undefined, "inteiro", undefined] },
    { celulas: ["Bloqueios de conformidade (total)", bloqueios, null], formatos: [undefined, "inteiro", undefined] },
    { celulas: ["Projetos com POS completo exigido", projects.filter((p) => exigenciaPOS(p) === "completo").length, null], formatos: [undefined, "inteiro", undefined] },
    { celulas: ["Cota de equidade — valor prioritário", cota.valorPrioritario, null], formatos: [undefined, "moeda", undefined] },
    { celulas: ["Cota de equidade — percentual", cota.percentual, null], formatos: [undefined, "percentual", undefined] },
    { celulas: ["Cota de equidade — meta", cota.meta, null], formatos: [undefined, "percentual", undefined] },
    { celulas: ["Cota de equidade atingida?", cota.atingida ? "Sim" : "Não", null] },
    { celulas: ["Fundo rotativo — pool mensal a 10% do saldo", fundo.poolMensal, null], formatos: [undefined, "moeda", undefined] },
    { celulas: ["Fundo rotativo — projetos contribuintes", fundo.contribuintes.length, null], formatos: [undefined, "inteiro", undefined] },
    { celulas: ["Fundo rotativo — projetos deficitários", fundo.beneficiarios.length, null], formatos: [undefined, "inteiro", undefined] },
  ];

  const agrupar = (chaveDe: (p: Project) => string) => {
    const mapa = new Map<string, { qtd: number; valor: number }>();
    for (const p of projects) {
      const chave = chaveDe(p);
      const atual = mapa.get(chave) ?? { qtd: 0, valor: 0 };
      mapa.set(chave, { qtd: atual.qtd + 1, valor: atual.valor + totalOrcamento(p) });
    }
    return mapa;
  };

  linhas.push({ celulas: ["", null, null] });
  linhas.push({ tipo: "secao", celulas: ["Distribuição por município", "Projetos", "Valor (R$)"] });
  for (const [nome, d] of agrupar(municipioDoProjeto)) {
    linhas.push({ celulas: [nome, d.qtd, d.valor], formatos: [undefined, "inteiro", "moeda"] });
  }

  linhas.push({ celulas: ["", null, null] });
  linhas.push({ tipo: "secao", celulas: ["Distribuição por categoria", "Projetos", "Valor (R$)"] });
  for (const [nome, d] of agrupar((p) => nomeArquetipo(p.arquetipoId) || "(sem categoria)")) {
    linhas.push({ celulas: [nome, d.qtd, d.valor], formatos: [undefined, "inteiro", "moeda"] });
  }

  return {
    id: "resumo",
    nome: "Resumo do portfólio",
    descricao: "Totais agregados, cota de equidade e distribuição por município e categoria.",
    colunas: [col("Indicador", "texto", 46), col("Valor", "texto", 18), col("Valor (R$)", "moeda", 18)],
    linhas,
  };
}

/** Monta todas as abas da planilha do portfólio. Fonte única para a tela e para o .xlsx. */
export function montarAbasPortfolio(projects: Project[]): AbaTabela[] {
  return [
    abaProjetos(projects),
    abaOrcamento(projects),
    abaMetas(projects),
    abaPublico(projects),
    abaItens(projects),
    abaRiscos(projects),
    abaConformidade(projects),
    abaResumo(projects),
  ];
}
