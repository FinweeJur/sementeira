import { novoProjetoVazio, type ComplianceFinding, type Project } from "./types";
import { extrairPlanilha, type AbaPlanilha } from "./file-extraction";
import { avaliarConformidade } from "./compliance-engine";
import { COLUNAS_PLANILHA, reconhecerColuna } from "./planilha-colunas";
import { aplicarImportacaoAoProjeto, camposPreenchidos, novoContexto, sanitizarDadosImportacao } from "./importacao-dados";

/**
 * Importação de planilha em lote — uma linha por projeto.
 *
 * Por que isto é um caminho separado do `importar-projeto.ts`, e não mais uma
 * rota dentro dele: aquele módulo importa UM projeto de UM documento e tem a
 * invariante do plano B (a IA falha, a heurística salva). Aqui não há IA
 * nenhuma nem nada a salvar — cabeçalho reconhecido é extração 100%
 * determinística, e o resultado é N projetos, não um.
 *
 * Planilha cujo cabeçalho NÃO é reconhecido não vem para cá: ela vira tabela
 * Markdown em `planilhaParaTexto` e segue pelo pipeline normal de documento,
 * ganhando de graça a IA e o plano B heurístico. Assim nenhum arquivo lido é
 * descartado, que é a regra da casa.
 */

/** Um projeto candidato, ainda NÃO gravado — a pessoa confere e confirma. */
export interface ProjetoDaPlanilha {
  projeto: Project;
  /** Rótulos dos campos que vieram preenchidos, para a pessoa ver o que foi aproveitado. */
  camposPreenchidos: string[];
  /** O que não deu para aproveitar: valor ilegível, id fora da lista oficial... */
  avisos: string[];
  /** Motor determinístico rodado sobre o projeto importado — planilha não declara conformidade. */
  conformidade: ComplianceFinding[];
}

export interface PlanilhaEmLoteResultado {
  ok: boolean;
  erro?: string;
  projetos?: ProjetoDaPlanilha[];
  /** Cabeçalhos que não casaram com nenhum campo conhecido. */
  colunasNaoReconhecidas?: string[];
  avisos?: string[];
  /** false = cabeçalho não reconhecido; quem chamou deve cair no caminho de documento. */
  reconhecida: boolean;
}

/** Abaixo disto o cabeçalho não é confiável e a planilha vira documento para a IA ler. */
const MINIMO_COLUNAS_RECONHECIDAS = 3;

interface Mapeamento {
  colunas: (string | null)[];
  reconhecidas: number;
  naoReconhecidas: string[];
}

function mapearCabecalho(cabecalho: string[]): Mapeamento {
  const colunas = cabecalho.map((c) => reconhecerColuna(c));
  return {
    colunas,
    reconhecidas: colunas.filter(Boolean).length,
    naoReconhecidas: cabecalho.filter((c, i) => colunas[i] === null && c.trim() !== ""),
  };
}

/** Escolhe a aba que parece a lista de projetos: a com mais colunas reconhecidas. */
function escolherAba(abas: AbaPlanilha[]): { aba: AbaPlanilha; mapeamento: Mapeamento } | null {
  let melhor: { aba: AbaPlanilha; mapeamento: Mapeamento } | null = null;
  for (const aba of abas) {
    if (aba.linhas.length < 2) continue;
    const mapeamento = mapearCabecalho(aba.linhas[0]);
    if (!melhor || mapeamento.reconhecidas > melhor.mapeamento.reconhecidas) melhor = { aba, mapeamento };
  }
  return melhor;
}

function quebrarEmItens(texto: string): string[] {
  return texto
    .split(/\r?\n|;|•/)
    .map((i) => i.trim().replace(/^[-–]\s*/, "").replace(/^\d+[.)]\s*/, ""))
    .filter((i) => i.length > 1);
}

/**
 * Colunas que guardam uma lista dentro de uma célula só (o jeito que planilha
 * de verdade é escrita) viram as estruturas correspondentes do projeto.
 */
function expandirCamposDeTexto(bruto: Record<string, unknown>): Record<string, unknown> {
  const dado = { ...bruto };

  if (dado.valorTotal !== undefined) {
    // A planilha traz só o total; o detalhamento por item é trabalho do wizard.
    dado.orcamento = [{ categoria: "outro", descricao: "Valor total informado na planilha (detalhar por item)", valor: dado.valorTotal }];
    delete dado.valorTotal;
  }

  const listas: [string, string, (t: string) => unknown][] = [
    ["producaoTexto", "producaoEstimada", (t) => ({ item: t })],
    ["itensTexto", "itensNecessarios", (t) => ({ descricao: t })],
    ["riscosTexto", "riscos", (t) => ({ descricao: t, probabilidade: "medio", impacto: "medio", mitigacao: "" })],
  ];
  for (const [origem, destino, montar] of listas) {
    const texto = typeof dado[origem] === "string" ? (dado[origem] as string) : "";
    if (texto.trim()) dado[destino] = quebrarEmItens(texto).map(montar);
    delete dado[origem];
  }

  const contato: Record<string, unknown> = {};
  if (dado.contatoCoordenador) contato.coordenador = dado.contatoCoordenador;
  if (dado.contatoTelefone) contato.telefone = dado.contatoTelefone;
  if (dado.contatoEmail) contato.email = dado.contatoEmail;
  if (Object.keys(contato).length > 0) dado.contato = contato;
  delete dado.contatoCoordenador;
  delete dado.contatoTelefone;
  delete dado.contatoEmail;

  return dado;
}

function linhaParaProjeto(linha: string[], mapeamento: Mapeamento, nomeArquivo: string): ProjetoDaPlanilha {
  const bruto: Record<string, unknown> = {};
  mapeamento.colunas.forEach((campo, i) => {
    if (!campo) return;
    const valor = (linha[i] ?? "").trim();
    if (valor) bruto[campo] = valor;
  });

  const ctx = novoContexto();
  const dados = sanitizarDadosImportacao(expandirCamposDeTexto(bruto), ctx);
  const base = aplicarImportacaoAoProjeto(novoProjetoVazio(), dados);
  // A linha da planilha JÁ é o dado — não faz sentido guardar o texto do
  // arquivo inteiro em cada um dos N projetos (é o mesmo conteúdo repetido, e
  // estoura a cota do localStorage num lote grande). Fica só a procedência.
  const projeto: Project = {
    ...base,
    ideiaTexto: base.ideiaTexto || `[Importado da planilha "${nomeArquivo}"] ${base.objetivo || base.titulo}`,
    documentoOrigem: { nomeArquivo, textoExtraido: "", anexadoEm: new Date().toISOString() },
  };
  return {
    projeto,
    camposPreenchidos: camposPreenchidos(dados),
    avisos: ctx.avisos,
    conformidade: avaliarConformidade(projeto),
  };
}

/**
 * Lê uma planilha e, se o cabeçalho for reconhecido, devolve um projeto por
 * linha. Nada é gravado aqui: quem confirma é a pessoa, na prévia.
 */
export async function importarPlanilhaEmLote(arquivo: File): Promise<PlanilhaEmLoteResultado> {
  const planilha = await extrairPlanilha(arquivo);
  if (!planilha.ok || !planilha.abas) {
    return { ok: false, reconhecida: false, erro: planilha.erro ?? "Não foi possível ler a planilha." };
  }

  const escolha = escolherAba(planilha.abas);
  if (!escolha || escolha.mapeamento.reconhecidas < MINIMO_COLUNAS_RECONHECIDAS) {
    // Não é erro: é uma planilha de formato livre. Quem chamou manda para o
    // caminho de documento, onde a IA e a heurística tentam entender.
    return { ok: false, reconhecida: false };
  }

  const { aba, mapeamento } = escolha;
  const projetos = aba.linhas
    .slice(1)
    .filter((linha) => linha.some((c) => c.trim() !== ""))
    .map((linha) => linhaParaProjeto(linha, mapeamento, arquivo.name));

  if (projetos.length === 0) {
    return { ok: false, reconhecida: true, erro: "A planilha tem cabeçalho reconhecido, mas nenhuma linha de dados preenchida." };
  }

  const avisos = [`${mapeamento.reconhecidas} de ${aba.linhas[0].length} colunas foram reconhecidas. Importação feita direto da planilha, sem IA.`];
  if (planilha.abas.length > 1) {
    avisos.unshift(`A planilha tem ${planilha.abas.length} abas; foi usada a "${aba.nome}", que tem mais colunas reconhecidas.`);
  }

  return { ok: true, reconhecida: true, projetos, colunasNaoReconhecidas: mapeamento.naoReconhecidas, avisos };
}

/** Os primeiros cabeçalhos canônicos — usados na dica da tela de importação. */
export const CABECALHOS_EXEMPLO = COLUNAS_PLANILHA.slice(0, 4).map((c) => c.cabecalho);
