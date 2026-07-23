import { normalizarTexto } from "./texto";

/**
 * Dicionário de colunas da planilha de projetos. É o contrato dos dois lados:
 * a aba "Projetos" exportada por `exportarPortfolioXlsx` usa exatamente estes
 * `cabecalho`, e a importação em lote reconhece o `cabecalho` mais os
 * `sinonimos` — por isso exportar, editar no Excel e reimportar não perde dado.
 *
 * `campo` é a chave crua entregue a `sanitizarDadosImportacao`, que valida tudo
 * contra os dados estáticos do app.
 */
export interface ColunaPlanilha {
  campo: string;
  cabecalho: string;
  sinonimos: string[];
  /** Colunas calculadas (total, conformidade...) são exportadas mas ignoradas na volta. */
  somenteLeitura?: boolean;
}

export const COLUNAS_PLANILHA: ColunaPlanilha[] = [
  { campo: "titulo", cabecalho: "Título", sinonimos: ["nome", "nome do projeto", "projeto"] },
  { campo: "arquetipoId", cabecalho: "Categoria (arquétipo)", sinonimos: ["categoria", "arquetipo", "tipo", "tipo de projeto"] },
  { campo: "danoId", cabecalho: "Dano vinculado", sinonimos: ["dano", "dano coletivo"] },
  { campo: "setorId", cabecalho: "Setor / público prioritário", sinonimos: ["setor", "publico prioritario", "grupo prioritario"] },
  { campo: "coordenacaoFeminina", cabecalho: "Coordenação feminina", sinonimos: ["coordenado por mulheres", "lideranca feminina"] },
  { campo: "local", cabecalho: "Local", sinonimos: ["onde", "endereco", "comunidade", "localidade"] },
  { campo: "municipioId", cabecalho: "Município", sinonimos: ["municipio", "cidade"] },
  { campo: "abrangencia", cabecalho: "Abrangência", sinonimos: ["porte", "alcance"] },
  { campo: "publicoAlvo", cabecalho: "Público-alvo", sinonimos: ["publico", "beneficiarios", "quem e atendido"] },
  { campo: "pessoasAtendidasDiretas", cabecalho: "Pessoas atendidas (diretas)", sinonimos: ["pessoas", "quantas pessoas", "beneficiarios diretos", "atendidos", "numero de pessoas"] },
  { campo: "pessoasAtendidasIndiretas", cabecalho: "Pessoas atendidas (indiretas)", sinonimos: ["beneficiarios indiretos", "alcance indireto"] },
  { campo: "objetivo", cabecalho: "Objetivo geral", sinonimos: ["objetivo"] },
  { campo: "objetivosEspecificos", cabecalho: "Objetivos específicos", sinonimos: ["objetivos especificos"] },
  { campo: "justificativa", cabecalho: "Justificativa", sinonimos: ["motivacao", "por que"] },
  { campo: "metas", cabecalho: "Metas", sinonimos: ["meta", "metas de publico", "resultados esperados"] },
  { campo: "valorTotal", cabecalho: "Valor total (R$)", sinonimos: ["valor", "orcamento", "orcamento total", "custo", "custo total", "quanto", "investimento"] },
  { campo: "producaoTexto", cabecalho: "Expectativa de produção", sinonimos: ["producao", "producao estimada", "o que produz", "capacidade produtiva"] },
  { campo: "itensTexto", cabecalho: "Itens necessários", sinonimos: ["itens", "materiais", "equipamentos necessarios", "o que precisa"] },
  { campo: "riscosTexto", cabecalho: "Riscos", sinonimos: ["risco", "principais riscos"] },
  { campo: "cronograma", cabecalho: "Cronograma", sinonimos: ["prazo", "duracao"] },
  { campo: "formasArrecadacao", cabecalho: "Formas de arrecadação", sinonimos: ["arrecadacao", "receita", "fontes de receita"] },
  { campo: "comoComunidadeAjuda", cabecalho: "Como a comunidade ajuda", sinonimos: ["participacao da comunidade"] },
  { campo: "missaoImpacto", cabecalho: "Missão e impacto", sinonimos: ["impacto"] },
  { campo: "contatoCoordenador", cabecalho: "Coordenador(a)", sinonimos: ["responsavel", "contato"] },
  { campo: "contatoTelefone", cabecalho: "Telefone", sinonimos: ["celular", "whatsapp"] },
  { campo: "contatoEmail", cabecalho: "E-mail", sinonimos: ["email"] },
];

/** Colunas calculadas: exportadas para leitura humana, ignoradas na reimportação. */
export const CABECALHOS_CALCULADOS = [
  "Porte",
  "Teto do porte (R$)",
  "% do teto",
  "Exigência de POS",
  "Saldo realista/mês (R$)",
  "Autossustentável?",
  "Nº de metas",
  "Nº de indicadores",
  "Nº de riscos altos",
  "Nº de itens necessários",
  "Bloqueios",
  "Atenções",
  "Versão da lapidação",
  "Criado em",
  "Atualizado em",
];

const CALCULADOS_NORMALIZADOS = CABECALHOS_CALCULADOS.map(normalizarTexto);

/** Mapeia um cabeçalho livre para o `campo` correspondente, ou null se não reconhecido. */
export function reconhecerColuna(cabecalho: string): string | null {
  const n = normalizarTexto(cabecalho).replace(/\(.*?\)/g, "").replace(/[?:]/g, "").trim();
  if (!n) return null;
  if (CALCULADOS_NORMALIZADOS.some((c) => c.replace(/\(.*?\)/g, "").trim() === n)) return null;
  for (const coluna of COLUNAS_PLANILHA) {
    const candidatos = [coluna.cabecalho, ...coluna.sinonimos].map((c) => normalizarTexto(c).replace(/\(.*?\)/g, "").trim());
    if (candidatos.includes(n)) return coluna.campo;
  }
  // Casamento por prefixo, para "Pessoas atendidas diretas (nº)" e afins.
  for (const coluna of COLUNAS_PLANILHA) {
    const candidatos = [coluna.cabecalho, ...coluna.sinonimos].map((c) => normalizarTexto(c).replace(/\(.*?\)/g, "").trim());
    if (candidatos.some((c) => c.length > 4 && (n.startsWith(c) || c.startsWith(n)))) return coluna.campo;
  }
  return null;
}
