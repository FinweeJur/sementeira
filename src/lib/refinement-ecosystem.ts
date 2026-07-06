import type { Project } from "./types";
import type { AnaliseEcossistema } from "./ecosystem";
import type { ClubeBeneficios } from "./clube-beneficios";
import { calcularSaldosRealistas } from "./ecosystem";
import { carregarConfigLLM, enviarMensagemLLM } from "./providers";
import { montarBlocoDiretrizesGlobais } from "./diretrizes-globais";
import { parseJsonDeResposta } from "./json-parsing";
import arquetipos from "../data/arquetipos.json";

// Para os alvos de portfólio (ecossistema/clube) o ciclo usa 3 papéis
// (crítico → sugestor → compilador) — escritor/orçamentista não fazem sentido
// fora do projeto individual.

export type EtapaPortfolio = "critico" | "sugestor" | "compilador";
export const ETAPAS_PORTFOLIO_ROTULO: Record<EtapaPortfolio, string> = {
  critico: "🔍 Crítico avaliando o conjunto",
  sugestor: "💡 Sugestor propondo integrações",
  compilador: "📦 Compilador consolidando a versão melhorada",
};

function resumoPortfolio(projects: Project[]): string {
  const saldos = calcularSaldosRealistas(projects);
  return projects
    .map((p, i) => {
      const arq = arquetipos.find((a) => a.id === p.arquetipoId);
      const saldo = saldos.find((s) => s.projectId === p.id)?.saldoMensalRealista ?? 0;
      return `${i + 1}. "${p.titulo}" — ${arq?.nome ?? p.arquetipoId} (${arq?.tipo ?? "?"}), local: ${p.local || "?"}, saldo realista: R$${saldo.toFixed(0)}/mês, objetivo: ${p.objetivo.slice(0, 140)}`;
    })
    .join("\n");
}

const CONTEXTO = [
  "Contexto: portfólio de projetos comunitários do Anexo I.1 (reparação Brumadinho). Regras: Ofício 46 veda custeio permanente sem fonte futura; projetos produtivos precisam de mercado comprador (4.1 §4).",
  "Diretriz obrigatória: economia circular entre os projetos — priorize integrações onde um projeto fornece insumo/serviço/mão de obra a outro, sugerindo inclusive reflexos no orçamento dos projetos envolvidos (não precisa cobrir todo o orçamento, mas é a direção preferida). O foco é qualidade e realismo dos projetos, não rapidez.",
  "Responda em português simples. Responda SOMENTE com o bloco json pedido, sem texto fora dele.",
].join("\n");

async function chamar(prompt: string): Promise<{ ok: boolean; texto?: string; erro?: string }> {
  const diretrizes = montarBlocoDiretrizesGlobais();
  const resposta = await enviarMensagemLLM(carregarConfigLLM(), [{ role: "user", content: diretrizes ? `${prompt}\n\n${diretrizes}` : prompt }]);
  if (!resposta.ok) return { ok: false, erro: resposta.erro };
  return { ok: true, texto: resposta.conteudo ?? "" };
}

function listaStrings(bruto: unknown): string[] {
  return Array.isArray(bruto) ? bruto.filter((s): s is string => typeof s === "string" && s.trim().length > 0) : [];
}

// ---------------------------------------------------------------------------
// Ecossistema
// ---------------------------------------------------------------------------

export interface SugestaoPorProjeto {
  projectId: string;
  titulo: string;
  sugestao: string;
}

export interface ResultadoLapidacaoEcossistema {
  ok: boolean;
  erro?: string;
  analise?: AnaliseEcossistema;
  sugestoesPorProjeto?: SugestaoPorProjeto[];
  problemas?: string[];
  changelog?: string[];
}

export async function lapidarEcossistema(
  projects: Project[],
  analiseAtual: AnaliseEcossistema | null,
  onProgresso?: (etapa: EtapaPortfolio) => void,
): Promise<ResultadoLapidacaoEcossistema> {
  if (projects.length < 2) return { ok: false, erro: "Cadastre pelo menos 2 projetos para lapidar o ecossistema." };
  const resumo = resumoPortfolio(projects);
  const analiseTexto = analiseAtual ? JSON.stringify(analiseAtual) : "(nenhuma análise ainda)";

  onProgresso?.("critico");
  const critico = await chamar(
    [CONTEXTO, "Papel: CRÍTICO. Avalie o conjunto de projetos e a análise atual do ecossistema: conexões frágeis ou fictícias, redundâncias não tratadas, projetos isolados sem integração, dependências circulares perigosas.", "Projetos:", resumo, "Análise atual:", analiseTexto, 'Formato: ```json\n{"problemas": ["..."]}\n```'].join("\n\n"),
  );
  if (!critico.ok) return { ok: false, erro: critico.erro };
  const problemas = listaStrings(parseJsonDeResposta<Record<string, unknown>>(critico.texto ?? "")?.problemas);

  onProgresso?.("sugestor");
  const sugestor = await chamar(
    [CONTEXTO, "Papel: SUGESTOR. Proponha integrações concretas entre os projetos listados (quem fornece/compra de quem, capacitação compartilhada, comercialização conjunta). Use SÓ os projetos da lista — nunca invente um projeto.", "Projetos:", resumo, "Problemas apontados pelo crítico:", JSON.stringify(problemas), 'Formato: ```json\n{"sugestoesPorProjeto": [{"numeroProjeto": 1, "sugestao": "..."}]}\n```'].join("\n\n"),
  );
  if (!sugestor.ok) return { ok: false, erro: sugestor.erro };
  const brutoSugestoes = parseJsonDeResposta<Record<string, unknown>>(sugestor.texto ?? "")?.sugestoesPorProjeto;
  const sugestoesPorProjeto: SugestaoPorProjeto[] = [];
  if (Array.isArray(brutoSugestoes)) {
    for (const item of brutoSugestoes) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const indice = typeof o.numeroProjeto === "number" ? o.numeroProjeto - 1 : -1;
      const sugestao = typeof o.sugestao === "string" ? o.sugestao.trim() : "";
      const alvo = projects[indice];
      if (alvo && sugestao) sugestoesPorProjeto.push({ projectId: alvo.id, titulo: alvo.titulo, sugestao });
    }
  }

  onProgresso?.("compilador");
  const compilador = await chamar(
    [CONTEXTO, "Papel: COMPILADOR. Produza a versão melhorada da análise do ecossistema, incorporando os problemas e sugestões. Use SÓ os projetos da lista.", "Projetos:", resumo, "Análise atual:", analiseTexto, "Problemas:", JSON.stringify(problemas), "Sugestões:", JSON.stringify(sugestoesPorProjeto.map((s) => `${s.titulo}: ${s.sugestao}`)), 'Formato: ```json\n{"complementaridades": ["..."], "redundancias": ["..."], "mercadosCompradores": ["..."], "changelog": ["o que mudou em relação à análise anterior — máx 10 itens"]}\n```'].join("\n\n"),
  );
  if (!compilador.ok) return { ok: false, erro: compilador.erro };
  const brutoAnalise = parseJsonDeResposta<Record<string, unknown>>(compilador.texto ?? "");
  if (!brutoAnalise) return { ok: false, erro: "Não foi possível interpretar a resposta do Compilador." };

  return {
    ok: true,
    analise: {
      complementaridades: listaStrings(brutoAnalise.complementaridades),
      redundancias: listaStrings(brutoAnalise.redundancias),
      mercadosCompradores: listaStrings(brutoAnalise.mercadosCompradores),
    },
    sugestoesPorProjeto,
    problemas,
    changelog: listaStrings(brutoAnalise.changelog).slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Clube de benefícios
// ---------------------------------------------------------------------------

export interface ResultadoLapidacaoClube {
  ok: boolean;
  erro?: string;
  clube?: ClubeBeneficios;
  problemas?: string[];
  changelog?: string[];
}

export async function lapidarClube(
  clubeAtual: ClubeBeneficios,
  projects: Project[],
  onProgresso?: (etapa: EtapaPortfolio) => void,
): Promise<ResultadoLapidacaoClube> {
  const resumo = resumoPortfolio(projects);
  const clubeTexto = JSON.stringify({
    ofertas: clubeAtual.ofertas.map((o) => ({ numeroProjeto: projects.findIndex((p) => p.id === o.projectId) + 1, titulo: o.titulo, descricao: o.descricao })),
    regrasPontos: clubeAtual.regrasPontos.map((r) => ({ descricao: r.descricao, pontosGanhos: r.pontosGanhos })),
    premios: clubeAtual.premios.map((p) => ({ nome: p.nome, custoPontos: p.custoPontos })),
  });

  onProgresso?.("critico");
  const critico = await chamar(
    [CONTEXTO, "Papel: CRÍTICO. Avalie o clube de benefícios contra os projetos reais: projetos sem oferta, regras de pontos impossíveis de cumprir, prêmios com custo em pontos incoerente com as regras (ninguém junta pontos suficientes ou junta fácil demais), ofertas insustentáveis para o projeto que as banca.", "Projetos:", resumo, "Clube atual:", clubeTexto, 'Formato: ```json\n{"problemas": ["..."]}\n```'].join("\n\n"),
  );
  if (!critico.ok) return { ok: false, erro: critico.erro };
  const problemas = listaStrings(parseJsonDeResposta<Record<string, unknown>>(critico.texto ?? "")?.problemas);

  onProgresso?.("compilador");
  const compilador = await chamar(
    [CONTEXTO, "Papel: COMPILADOR. Produza a versão melhorada do clube (ofertas/regras/prêmios), corrigindo os problemas. Referencie projetos APENAS pelo numeroProjeto da lista — nunca invente projeto. Mantenha o que já está bom.", "Projetos:", resumo, "Clube atual:", clubeTexto, "Problemas:", JSON.stringify(problemas), 'Formato: ```json\n{"ofertas": [{"numeroProjeto": 1, "titulo": "...", "descricao": "..."}], "regrasPontos": [{"descricao": "...", "pontosGanhos": 10}], "premios": [{"nome": "...", "custoPontos": 100}], "changelog": ["máx 10 itens"]}\n```'].join("\n\n"),
  );
  if (!compilador.ok) return { ok: false, erro: compilador.erro };
  const bruto = parseJsonDeResposta<Record<string, unknown>>(compilador.texto ?? "");
  if (!bruto) return { ok: false, erro: "Não foi possível interpretar a resposta do Compilador." };

  const clube: ClubeBeneficios = { ofertas: [], regrasPontos: [], premios: [] };
  if (Array.isArray(bruto.ofertas)) {
    for (const item of bruto.ofertas) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const alvo = typeof o.numeroProjeto === "number" ? projects[o.numeroProjeto - 1] : undefined;
      const titulo = typeof o.titulo === "string" ? o.titulo.trim() : "";
      if (!alvo || !titulo) continue; // guardrail: oferta órfã de projeto inexistente é descartada
      clube.ofertas.push({ id: crypto.randomUUID(), projectId: alvo.id, titulo, descricao: typeof o.descricao === "string" ? o.descricao : "" });
    }
  }
  if (Array.isArray(bruto.regrasPontos)) {
    for (const item of bruto.regrasPontos) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const descricao = typeof o.descricao === "string" ? o.descricao.trim() : "";
      const pontos = typeof o.pontosGanhos === "number" && o.pontosGanhos > 0 ? o.pontosGanhos : 0;
      if (descricao && pontos > 0) clube.regrasPontos.push({ id: crypto.randomUUID(), descricao, pontosGanhos: pontos });
    }
  }
  if (Array.isArray(bruto.premios)) {
    for (const item of bruto.premios) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const nome = typeof o.nome === "string" ? o.nome.trim() : "";
      const custo = typeof o.custoPontos === "number" && o.custoPontos > 0 ? o.custoPontos : 0;
      if (nome && custo > 0) clube.premios.push({ id: crypto.randomUUID(), nome, custoPontos: custo });
    }
  }

  if (clube.ofertas.length === 0 && clube.regrasPontos.length === 0 && clube.premios.length === 0) {
    return { ok: false, erro: "O compilador não devolveu um clube utilizável — nada foi alterado." };
  }

  return { ok: true, clube, problemas, changelog: listaStrings(bruto.changelog).slice(0, 10) };
}
