import type { Project } from "./types";
import type { ResultadoBusca } from "./websearch";
import { pesquisarProfundo } from "./deep-research";
import danos from "../data/danos.json";
import arquetipos from "../data/arquetipos.json";

export interface PesquisaResultado<T> {
  ok: boolean;
  dado?: T;
  fontesConsultadas?: ResultadoBusca[];
  subperguntas?: string[];
  erro?: string;
}

/**
 * Justificativa com dado público real (Censo/IBGE/indicadores) + referência
 * ABNT e link de acesso. Deep Research multi-etapas (Fase 11b): planeja
 * subperguntas de busca em vez de 1 query só, melhorando a chance de achar um
 * dado específico e citável. Guardrail preservado: o LLM só pode citar o que
 * veio das buscas — se nada específico aparecer, retorna erro em vez de
 * inventar número/link.
 */
export async function pesquisarJustificativaComReferencia(project: Project): Promise<PesquisaResultado<string>> {
  const nomeDano = danos.find((d) => d.id === project.danoId)?.nome ?? project.ideiaTexto ?? "";
  const local = project.local || "Brumadinho, bacia do Paraopeba, MG";

  const resultado = await pesquisarProfundo(
    `Que dado público (Censo/IBGE/indicador socioeconômico) sustenta a necessidade de reparar o dano "${nomeDano}" em "${local}"?`,
    `Projeto comunitário de reparação, dano coletivo: "${nomeDano}", local: "${local}".`,
    [
      "Escreva uma justificativa de projeto (2 a 4 frases) citando UM dado público real dos resultados de busca.",
      "Termine com uma referência em formato ABNT incluindo o link de acesso, ex.: AUTOR/ÓRGÃO. Título. Local: Editora, ano. Disponível em: <link>. Acesso em: [indique que é necessário confirmar a data].",
    ].join(" "),
  );
  if (!resultado.ok || !resultado.textoSintetizado) return { ok: false, erro: resultado.erro, subperguntas: resultado.subperguntas };
  if (/nenhum dado espec[ií]fico encontrado/i.test(resultado.textoSintetizado)) {
    return { ok: false, erro: "Nenhum dado público específico encontrado nos resultados — preencha a justificativa manualmente.", subperguntas: resultado.subperguntas };
  }
  return { ok: true, dado: resultado.textoSintetizado, fontesConsultadas: resultado.fontesConsultadas, subperguntas: resultado.subperguntas };
}

export interface PrecoSugerido {
  valorEstimado: number | null;
  fonte: string | null;
}

/** Pesquisa de preço de mercado (MG/Brasil) para uma linha de orçamento — Deep Research multi-etapas; nunca inventa valor fora do que a busca retornou. */
export async function pesquisarPrecoItem(descricaoItem: string): Promise<PesquisaResultado<PrecoSugerido>> {
  const resultado = await pesquisarProfundo(
    `Qual o preço ou faixa de preço em reais (R$) para "${descricaoItem}" no Brasil/MG, referência aproximada julho de 2026?`,
    `Linha de orçamento de projeto comunitário: "${descricaoItem}".`,
    'Responda SOMENTE com um bloco json, sem mais nada: ```json\n{"valorEstimado": numero_em_reais_ou_null, "fonte": "descrição curta + url, ou null"}\n```. Se não houver preço confiável e específico nos resultados, responda valorEstimado: null.',
  );
  if (!resultado.ok || !resultado.textoSintetizado) return { ok: false, erro: resultado.erro, subperguntas: resultado.subperguntas };

  const match = resultado.textoSintetizado.match(/```json\s*([\s\S]*?)```/i) ?? resultado.textoSintetizado.match(/\{[\s\S]*\}/);
  if (!match) return { ok: false, erro: "Não foi possível interpretar a resposta da IA sobre preço.", subperguntas: resultado.subperguntas };
  try {
    const obj = JSON.parse((match[1] ?? match[0]).trim());
    const valor = typeof obj.valorEstimado === "number" ? obj.valorEstimado : null;
    if (valor === null) return { ok: false, erro: `Nenhum preço confiável encontrado para "${descricaoItem}" nos resultados — preencha manualmente.`, subperguntas: resultado.subperguntas };
    return { ok: true, dado: { valorEstimado: valor, fonte: obj.fonte ?? null }, fontesConsultadas: resultado.fontesConsultadas, subperguntas: resultado.subperguntas };
  } catch {
    return { ok: false, erro: "Não foi possível interpretar a resposta da IA sobre preço.", subperguntas: resultado.subperguntas };
  }
}

/** Pesquisa de políticas públicas de fomento (federal/MG/município, se local já informado) — Deep Research multi-etapas. */
export async function pesquisarArrecadacaoSugestoes(project: Project): Promise<PesquisaResultado<string[]>> {
  const arquetipo = arquetipos.find((a) => a.id === project.arquetipoId);
  const escopo = project.local ? `federais, estaduais (MG) e municipais de ${project.local}` : "federais e estaduais (MG)";
  const tema = arquetipo?.nome ?? project.ideiaTexto ?? "projeto comunitário";

  const resultado = await pesquisarProfundo(
    `Quais linhas de crédito/editais/programas de fomento ${escopo} existem para "${tema}"?`,
    `Projeto comunitário do tipo "${tema}", buscando formas de arrecadação/captação.`,
    [
      `Liste até 3 linhas de crédito/editais/programas de fomento ${escopo} relevantes, usando SÓ os resultados de busca.`,
      "Formato: uma linha por sugestão, curta: 'Nome do programa — 1 frase de descrição — link'.",
    ].join(" "),
  );
  if (!resultado.ok || !resultado.textoSintetizado) return { ok: false, erro: resultado.erro, subperguntas: resultado.subperguntas };

  const linhas = resultado.textoSintetizado
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.toLowerCase().startsWith("nenhum"));
  if (linhas.length === 0) return { ok: false, erro: "Nenhuma política pública específica encontrada nos resultados — preencha manualmente.", subperguntas: resultado.subperguntas };
  return { ok: true, dado: linhas, fontesConsultadas: resultado.fontesConsultadas, subperguntas: resultado.subperguntas };
}
