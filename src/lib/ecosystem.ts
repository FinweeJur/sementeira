import type { Project } from "./types";
import { simularTodos } from "./simulator";
import { carregarConfigLLM, enviarMensagemLLM } from "./providers";
import { extrairBlocoJson } from "./json-parsing";
import arquetipos from "../data/arquetipos.json";
import danos from "../data/danos.json";
import setores from "../data/setores.json";

function nomeArquetipo(id: string): string {
  return arquetipos.find((a) => a.id === id)?.nome ?? "(sem arquétipo)";
}
function nomeDano(id: string): string {
  return danos.find((d) => d.id === id)?.nome ?? "(sem dano)";
}

export interface SaldoRealista {
  projectId: string;
  titulo: string;
  saldoMensalRealista: number;
}

/** Saldo do cenário "realista" de cada projeto — base tanto da análise de ecossistema quanto do fundo rotativo. */
export function calcularSaldosRealistas(projects: Project[]): SaldoRealista[] {
  return projects.map((p) => {
    const simulacoes = simularTodos(p);
    const realista = simulacoes.find((s) => s.cenario === "realista");
    return { projectId: p.id, titulo: p.titulo || "(sem título)", saldoMensalRealista: realista?.saldoMensal ?? 0 };
  });
}

const META_COTA_EQUIDADE = 0.3;

export interface CotaEquidadeResultado {
  valorPrioritario: number;
  valorTotal: number;
  percentual: number;
  meta: number;
  atingida: boolean;
  projetosPrioritarios: { projectId: string; titulo: string; motivo: string }[];
}

/**
 * Cota de equidade agregada do portfólio (Proposta pág. 53): mínimo 30% dos
 * recursos para pessoas mais pobres, PCTs, mulheres, Familiares de Vítimas
 * Fatais, Zona Quente. Um projeto conta para a cota se o setor/público
 * selecionado tiver `cota: true` OU se `coordenacaoFeminina` estiver marcado
 * (critério ortogonal ao setor, ver seção "Autoria e equidade" do plano) —
 * nesse caso o orçamento TOTAL do projeto conta, não uma fração.
 */
export function calcularCotaEquidade(projects: Project[]): CotaEquidadeResultado {
  let valorPrioritario = 0;
  let valorTotal = 0;
  const projetosPrioritarios: { projectId: string; titulo: string; motivo: string }[] = [];

  for (const p of projects) {
    const totalProjeto = p.orcamento.reduce((s, l) => s + l.valor, 0);
    valorTotal += totalProjeto;

    const setor = setores.find((s) => s.id === p.setorId);
    const contaPeloSetor = setor?.cota === true;
    const contaPelaCoordenacao = p.coordenacaoFeminina === true;
    if (contaPeloSetor || contaPelaCoordenacao) {
      valorPrioritario += totalProjeto;
      const motivos = [contaPeloSetor ? setor!.nome : null, contaPelaCoordenacao ? "coordenação por mulher(es)" : null].filter(Boolean).join(" + ");
      projetosPrioritarios.push({ projectId: p.id, titulo: p.titulo || "(sem título)", motivo: motivos });
    }
  }

  const percentual = valorTotal > 0 ? valorPrioritario / valorTotal : 0;
  return { valorPrioritario, valorTotal, percentual, meta: META_COTA_EQUIDADE, atingida: percentual >= META_COTA_EQUIDADE, projetosPrioritarios };
}

export interface AnaliseEcossistema {
  complementaridades: string[];
  redundancias: string[];
  mercadosCompradores: string[];
}

const ANALISE_ECOSSISTEMA_KEY = "sementeira-ecossistema-analise-v1";

/** Persiste a última análise do ecossistema — antes só existia em memória da tela; agora sobrevive entre sessões e pode ser atualizada em segundo plano (ex.: pela revisão em massa). */
export function carregarAnaliseEcossistema(): AnaliseEcossistema | null {
  try {
    const raw = localStorage.getItem(ANALISE_ECOSSISTEMA_KEY);
    if (raw) return JSON.parse(raw) as AnaliseEcossistema;
  } catch {
    /* ignora análise corrompida */
  }
  return null;
}

export function salvarAnaliseEcossistema(analise: AnaliseEcossistema): void {
  localStorage.setItem(ANALISE_ECOSSISTEMA_KEY, JSON.stringify(analise));
}

/**
 * Otimização incremental (Fase 5): quanto mais projetos cadastrados, mais a
 * IA tem para cruzar. Roda sob demanda (não em segundo plano) — analisa TODOS
 * os projetos juntos e aponta cadeias locais, redundância e onde um projeto
 * pode virar mercado comprador de outro (Ofício 46, 4.1 §4).
 */
export async function analisarEcossistemaComIA(projects: Project[]): Promise<{ ok: boolean; dado?: AnaliseEcossistema; erro?: string }> {
  if (projects.length < 2) {
    return { ok: false, erro: "Cadastre pelo menos 2 projetos para analisar o ecossistema." };
  }

  const resumoProjetos = projects
    .map(
      (p, i) =>
        `${i + 1}. "${p.titulo || "(sem título)"}" — arquétipo: ${nomeArquetipo(p.arquetipoId)}, dano: ${nomeDano(p.danoId)}, local: ${p.local || "(sem local)"}, objetivo: ${p.objetivo || "(vazio)"}`,
    )
    .join("\n");

  const prompt = [
    "Você está analisando um portfólio de projetos comunitários do Anexo I.1 (reparação de Brumadinho) para encontrar conexões entre eles.",
    "Projetos cadastrados:",
    resumoProjetos,
    "",
    "Responda SOMENTE com um bloco json, sem mais nada:",
    '```json\n{"complementaridades": ["ex: projeto X pode fornecer insumo Y para o projeto Z"], "redundancias": ["ex: projetos A e B atendem o mesmo público com a mesma solução"], "mercadosCompradores": ["ex: projeto X pode comprar regularmente do projeto Y, reforçando o mercado comprador exigido no Ofício 46"]}\n```',
    "Regras estritas: use SOMENTE os projetos listados acima — nunca invente um projeto que não está na lista. Se não houver nada relevante em alguma categoria, deixe a lista vazia [].",
  ].join("\n");

  const config = carregarConfigLLM();
  const resposta = await enviarMensagemLLM(config, [{ role: "user", content: prompt }], { esperaJson: true });
  if (!resposta.ok) return { ok: false, erro: resposta.erro };

  const bloco = extrairBlocoJson(resposta.conteudo ?? "");
  if (!bloco) return { ok: false, erro: "Não foi possível interpretar a resposta da IA." };
  try {
    const obj = JSON.parse(bloco.trim());
    const dado = {
      complementaridades: Array.isArray(obj.complementaridades) ? obj.complementaridades.filter((s: unknown) => typeof s === "string") : [],
      redundancias: Array.isArray(obj.redundancias) ? obj.redundancias.filter((s: unknown) => typeof s === "string") : [],
      mercadosCompradores: Array.isArray(obj.mercadosCompradores) ? obj.mercadosCompradores.filter((s: unknown) => typeof s === "string") : [],
    };
    // Se as TRÊS listas vierem vazias, o JSON parseou mas não trouxe análise
    // nenhuma (formato inesperado, chaves com outro nome). Devolver ok:true
    // aqui fazia a tela salvar esse vazio por cima da análise boa anterior —
    // o usuário via "analisado", um painel em branco, e perdia o que tinha.
    if (dado.complementaridades.length === 0 && dado.redundancias.length === 0 && dado.mercadosCompradores.length === 0) {
      return { ok: false, erro: "A IA não devolveu uma análise utilizável. A análise anterior foi mantida." };
    }
    return { ok: true, dado };
  } catch {
    return { ok: false, erro: "Não foi possível interpretar a resposta da IA." };
  }
}

export interface FundoRotativoResultado {
  poolMensal: number;
  contribuintes: { titulo: string; contribuicaoMensal: number }[];
  beneficiarios: { titulo: string; deficitMensal: number; coberturaEstimada: number }[];
  poolRestante: number;
}

/**
 * Simulação de Fundo Rotativo Solidário (Proposta 5.5): projetos com saldo
 * positivo contribuem um percentual para um fundo comum, que ajuda projetos
 * deficitários a fechar a conta — dentro das regras: isso é um mecanismo de
 * crédito/fundo solidário, não pode virar custeio permanente disfarçado
 * (Vedação Geral III). É só simulação — não move dinheiro de verdade.
 */
export function simularFundoRotativo(projects: Project[], percentualContribuicao: number): FundoRotativoResultado {
  const saldos = calcularSaldosRealistas(projects);
  const contribuintes = saldos
    .filter((s) => s.saldoMensalRealista > 0)
    .map((s) => ({ titulo: s.titulo, contribuicaoMensal: s.saldoMensalRealista * (percentualContribuicao / 100) }));
  const poolMensal = contribuintes.reduce((soma, c) => soma + c.contribuicaoMensal, 0);

  const deficitarios = saldos.filter((s) => s.saldoMensalRealista < 0);
  let poolRestante = poolMensal;
  const beneficiarios = deficitarios.map((s) => {
    const deficit = Math.abs(s.saldoMensalRealista);
    const cobertura = Math.min(deficit, poolRestante);
    poolRestante -= cobertura;
    return { titulo: s.titulo, deficitMensal: deficit, coberturaEstimada: cobertura };
  });

  return { poolMensal, contribuintes, beneficiarios, poolRestante };
}
