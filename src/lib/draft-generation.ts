import type { EquipeMembro, Indicador, Project } from "./types";
import { extrairBlocoJson } from "./json-parsing";
import danos from "../data/danos.json";
import arquetipos from "../data/arquetipos.json";

export interface RascunhoDados {
  danoId?: string;
  arquetipoId?: string;
  objetivo?: string;
  justificativa?: string;
  metas?: string[];
  indicadores?: Indicador[];
  comoComunidadeAjuda?: string;
  missaoImpacto?: string;
  equipe?: EquipeMembro[];
}

function sanitizarIndicadoresRascunho(bruto: unknown): Indicador[] | undefined {
  if (!Array.isArray(bruto)) return undefined;
  const indicadores: Indicador[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const nome = typeof o.nome === "string" ? o.nome.trim() : "";
    const meta = typeof o.meta === "string" ? o.meta.trim() : "";
    if (!nome || !meta) continue;
    indicadores.push({
      id: crypto.randomUUID(),
      nome,
      meta,
      meioVerificacao: typeof o.meioVerificacao === "string" && o.meioVerificacao.trim() ? o.meioVerificacao : undefined,
      frequencia: typeof o.frequencia === "string" && o.frequencia.trim() ? o.frequencia : undefined,
    });
  }
  return indicadores.length > 0 ? indicadores : undefined;
}

function sanitizarEquipeRascunho(bruto: unknown): EquipeMembro[] | undefined {
  if (!Array.isArray(bruto)) return undefined;
  const membros: EquipeMembro[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const nome = typeof o.nome === "string" ? o.nome.trim() : "";
    if (!nome) continue;
    membros.push({
      id: crypto.randomUUID(),
      nome,
      formacaoNecessaria: typeof o.formacaoNecessaria === "string" && o.formacaoNecessaria.trim() ? o.formacaoNecessaria : undefined,
      horasSemanais: typeof o.horasSemanais === "number" && o.horasSemanais > 0 ? o.horasSemanais : undefined,
      duracaoMeses: typeof o.duracaoMeses === "number" && o.duracaoMeses > 0 ? o.duracaoMeses : undefined,
      planoTrabalho: typeof o.planoTrabalho === "string" && o.planoTrabalho.trim() ? o.planoTrabalho : undefined,
    });
  }
  return membros.length > 0 ? membros : undefined;
}

export type RascunhoResultado = { tipo: "perguntas"; perguntas: string[] } | { tipo: "rascunho"; dados: RascunhoDados } | null;

export function montarPromptRascunho(project: Project): string {
  const listaDanos = danos.map((d) => `- ${d.id}: ${d.nome}`).join("\n");
  const listaArquetipos = arquetipos.map((a) => `- ${a.id}: ${a.nome} (tipo ${a.tipo})`).join("\n");

  return [
    `A pessoa quer um projeto chamado/descrito como: "${project.titulo || project.ideiaTexto}".`,
    "Sua tarefa: gerar um RASCUNHO completo desse projeto para o Anexo I.1, revisável pela pessoa depois — nunca é a versão final.",
    "",
    "Regras estritas de saída — siga exatamente uma das duas opções:",
    "",
    "OPÇÃO A — se faltar informação essencial para um rascunho responsável (ex.: não dá pra saber o porte, o local, ou o tipo de atividade real), responda SOMENTE com um bloco json contendo até 3 perguntas objetivas, sem mais nada:",
    '```json\n{"perguntas": ["pergunta 1", "pergunta 2", "pergunta 3"]}\n```',
    "",
    "OPÇÃO B — se já der para rascunhar com razoável confiança, responda SOMENTE com um bloco json neste formato, sem mais nada, sem inventar dados fora do que foi informado:",
    '```json\n{"danoId": "um id da lista de danos abaixo", "arquetipoId": "um id da lista de arquétipos abaixo (ou omita se nenhum combinar bem)", "objetivo": "pelo menos 2 parágrafos", "justificativa": "pelo menos 2 parágrafos ligando ao dano", "metas": ["meta 1", "meta 2"], "indicadores": [{"nome": "o que medir", "meta": "valor/prazo verificável", "meioVerificacao": "como comprovar (livro de registro, foto, recibo...)", "frequencia": "mensal/trimestral/..."}], "comoComunidadeAjuda": "1-2 parágrafos", "missaoImpacto": "1-2 parágrafos", "equipe": [{"nome": "papel/função", "formacaoNecessaria": "...", "horasSemanais": 20, "duracaoMeses": 6, "planoTrabalho": "o que a pessoa faz"}]}\n```',
    "",
    "IMPORTANTE — profundidade exigida (padrão mínimo observado em editais e projetos técnicos reais, não um rascunho superficial): `objetivo` e `justificativa` devem ter PELO MENOS 2 PARÁGRAFOS BEM DESENVOLVIDOS cada, com detalhamento concreto (números, local, contexto real ligados ao que foi informado) — nunca frases genéricas de 1 linha. `metas` devem ser REALISTAS e proporcionais ao porte/orçamento típico do arquétipo escolhido — nunca números desproporcionalmente grandes. Para CADA meta, gere um `indicadores` correspondente no padrão marco lógico (indicador mensurável + meta verificável + meio de verificação, ex.: livro de registro, relatório, foto, contrato + frequência de medição) — sem isso a meta não é auditável. `equipe` deve ter PELO MENOS 2 PESSOAS (diretriz local de equipe mínima), cada uma com papel, formação necessária e plano de trabalho coerente com o arquétipo — nunca invente nomes próprios reais, use papéis/funções (ex.: \"Coordenador(a) geral\").",
    "",
    "IMPORTANTE: `danoId` e `arquetipoId` DEVEM ser exatamente um dos ids das listas abaixo — nunca invente um id novo.",
    "",
    "Danos coletivos disponíveis:\n" + listaDanos,
    "Arquétipos de projeto disponíveis:\n" + listaArquetipos,
  ].join("\n");
}

export function interpretarRespostaRascunho(texto: string): RascunhoResultado {
  const bloco = extrairBlocoJson(texto);
  if (!bloco) return null;
  try {
    const obj = JSON.parse(bloco.trim());
    if (Array.isArray(obj.perguntas)) {
      return { tipo: "perguntas", perguntas: obj.perguntas.filter((p: unknown) => typeof p === "string") };
    }
    const danoValido = danos.some((d) => d.id === obj.danoId);
    const arquetipoValido = arquetipos.some((a) => a.id === obj.arquetipoId);
    const dados: RascunhoDados = {
      danoId: danoValido ? obj.danoId : undefined,
      arquetipoId: arquetipoValido ? obj.arquetipoId : undefined,
      objetivo: typeof obj.objetivo === "string" ? obj.objetivo : undefined,
      justificativa: typeof obj.justificativa === "string" ? obj.justificativa : undefined,
      metas: Array.isArray(obj.metas) ? obj.metas.filter((m: unknown) => typeof m === "string") : undefined,
      indicadores: sanitizarIndicadoresRascunho(obj.indicadores),
      comoComunidadeAjuda: typeof obj.comoComunidadeAjuda === "string" ? obj.comoComunidadeAjuda : undefined,
      missaoImpacto: typeof obj.missaoImpacto === "string" ? obj.missaoImpacto : undefined,
      equipe: sanitizarEquipeRascunho(obj.equipe),
    };
    return { tipo: "rascunho", dados };
  } catch {
    return null;
  }
}

export function formatarPerguntas(perguntas: string[]): string {
  return "Antes de rascunhar, preciso entender melhor:\n" + perguntas.map((p, i) => `${i + 1}. ${p}`).join("\n");
}

export function aplicarRascunhoAoProjeto(project: Project, dados: RascunhoDados): Project {
  return {
    ...project,
    danoId: dados.danoId ?? project.danoId,
    arquetipoId: dados.arquetipoId ?? project.arquetipoId,
    objetivo: dados.objetivo ?? project.objetivo,
    justificativa: dados.justificativa ?? project.justificativa,
    metas: dados.metas && dados.metas.length > 0 ? dados.metas : project.metas,
    indicadores: dados.indicadores && dados.indicadores.length > 0 ? dados.indicadores : project.indicadores,
    comoComunidadeAjuda: dados.comoComunidadeAjuda ?? project.comoComunidadeAjuda,
    missaoImpacto: dados.missaoImpacto ?? project.missaoImpacto,
    equipe: dados.equipe && dados.equipe.length > 0 ? dados.equipe : project.equipe,
  };
}
