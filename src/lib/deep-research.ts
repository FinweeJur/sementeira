import { buscarWeb, type ResultadoBusca } from "./websearch";
import { carregarConfigLLM, enviarMensagemLLM } from "./providers";

/**
 * Deep Research multi-etapas (padrão Odysseus): em vez de 1 busca → 1 resposta,
 * planeja subperguntas objetivas de busca, roda cada uma na Tavily e sintetiza
 * uma resposta final com citações numeradas — só usando o que veio das buscas.
 * Mesmo guardrail anti-alucinação das funções que este módulo substitui:
 * nunca inventa número/nome/link fora dos resultados retornados.
 */

const MAX_SUBPERGUNTAS = 3;

export interface FontePesquisada {
  subpergunta: string;
  resultados: ResultadoBusca[];
}

export interface ResultadoDeepResearch {
  ok: boolean;
  textoSintetizado?: string;
  fontesConsultadas?: ResultadoBusca[];
  subperguntas?: string[];
  erro?: string;
}

async function perguntarLLM(prompt: string): Promise<{ ok: boolean; texto?: string; erro?: string }> {
  const config = carregarConfigLLM();
  const resposta = await enviarMensagemLLM(config, [{ role: "user", content: prompt }]);
  if (!resposta.ok) return { ok: false, erro: resposta.erro };
  return { ok: true, texto: resposta.conteudo ?? "" };
}

function resumirResultados(resultados: ResultadoBusca[], offset: number): string {
  return resultados.map((r, i) => `[${offset + i + 1}] ${r.titulo}\nURL: ${r.url}\nTrecho: ${r.conteudo.slice(0, 500)}`).join("\n\n");
}

function extrairJson(texto: string | undefined): unknown | null {
  const match = texto?.match(/```json\s*([\s\S]*?)```/i) ?? texto?.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse((match[1] ?? match[0]).trim());
  } catch {
    return null;
  }
}

/** Planeja até MAX_SUBPERGUNTAS queries de busca objetivas para responder a pergunta principal. */
export async function planejarSubperguntas(perguntaPrincipal: string, contexto: string): Promise<{ ok: boolean; subperguntas?: string[]; erro?: string }> {
  const prompt = [
    `Pergunta de pesquisa principal: "${perguntaPrincipal}"`,
    `Contexto: ${contexto}`,
    `Gere até ${MAX_SUBPERGUNTAS} subperguntas objetivas de busca na internet (queries curtas, não perguntas em linguagem natural longa) que, respondidas, permitem responder a pergunta principal com dados concretos (números, nomes de programas, preços).`,
    'Responda SOMENTE com um bloco json: ```json\n{"subperguntas": ["query 1", "query 2", "query 3"]}\n```',
  ].join("\n");

  const resposta = await perguntarLLM(prompt);
  if (!resposta.ok) return { ok: false, erro: resposta.erro };

  const obj = extrairJson(resposta.texto) as { subperguntas?: unknown } | null;
  if (!obj) return { ok: false, erro: "Não foi possível interpretar o planejamento de subperguntas." };
  const subperguntas = Array.isArray(obj.subperguntas)
    ? obj.subperguntas.filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0).slice(0, MAX_SUBPERGUNTAS)
    : [];
  if (subperguntas.length === 0) return { ok: false, erro: "A IA não gerou subperguntas de busca válidas." };
  return { ok: true, subperguntas };
}

/**
 * Pipeline completo: planeja subperguntas → busca cada uma na Tavily →
 * sintetiza uma resposta final com citações numeradas [N] referenciando os
 * resultados. `instrucoesSintese` define o formato de saída esperado (texto
 * livre, lista, JSON) — quem chama decide como interpretar `textoSintetizado`.
 */
export async function pesquisarProfundo(perguntaPrincipal: string, contexto: string, instrucoesSintese: string): Promise<ResultadoDeepResearch> {
  const plano = await planejarSubperguntas(perguntaPrincipal, contexto);
  if (!plano.ok || !plano.subperguntas) {
    return { ok: false, erro: plano.erro };
  }

  const fontesPorSubpergunta: FontePesquisada[] = [];
  for (const sub of plano.subperguntas) {
    const busca = await buscarWeb(sub);
    if (busca.ok && busca.resultados?.length) {
      fontesPorSubpergunta.push({ subpergunta: sub, resultados: busca.resultados });
    }
  }

  if (fontesPorSubpergunta.length === 0) {
    return { ok: false, erro: "Nenhuma das buscas encontrou resultados — preencha manualmente.", subperguntas: plano.subperguntas };
  }

  let blocoFontes = "";
  let offset = 0;
  for (const f of fontesPorSubpergunta) {
    blocoFontes += `\nSubpergunta: "${f.subpergunta}"\n${resumirResultados(f.resultados, offset)}\n`;
    offset += f.resultados.length;
  }
  const todasFontes = fontesPorSubpergunta.flatMap((f) => f.resultados);

  const prompt = [
    `Pergunta principal: "${perguntaPrincipal}"`,
    `Contexto: ${contexto}`,
    instrucoesSintese,
    "Regra estrita: cite apenas fatos/números/nomes/links que aparecem literalmente nos resultados abaixo, referenciando o número [N] do resultado usado. NUNCA invente número, nome de programa ou link fora do que está listado.",
    "Se nada relevante for encontrado nos resultados, responda apenas: 'Nenhum dado específico encontrado nos resultados — revisar manualmente.'",
    "",
    "Resultados de busca (organizados por subpergunta):",
    blocoFontes,
  ].join("\n");

  const resposta = await perguntarLLM(prompt);
  if (!resposta.ok) return { ok: false, erro: resposta.erro, subperguntas: plano.subperguntas };

  return { ok: true, textoSintetizado: resposta.texto, fontesConsultadas: todasFontes, subperguntas: plano.subperguntas };
}
