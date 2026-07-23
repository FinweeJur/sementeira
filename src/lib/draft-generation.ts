import type { EquipeMembro, Indicador, Project } from "./types";
import { extrairBlocoJson } from "./json-parsing";
import danos from "../data/danos.json";
import arquetipos from "../data/arquetipos.json";

export interface RascunhoDados {
  danoId?: string;
  arquetipoId?: string;
  objetivo?: string;
  objetivosEspecificos?: string[];
  justificativa?: string;
  metas?: string[];
  indicadores?: Indicador[];
  boasPraticas?: string[];
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
    '```json\n{"danoId": "um id da lista de danos abaixo", "arquetipoId": "um id da lista de arquétipos abaixo (ou omita se nenhum combinar bem)", "objetivo": "objetivo GERAL, pelo menos 2 parágrafos", "objetivosEspecificos": ["objetivo específico 1 mensurável", "objetivo específico 2"], "justificativa": "pelo menos 2 parágrafos ligando ao dano", "metas": ["meta 1", "meta 2"], "indicadores": [{"nome": "o que medir", "meta": "valor/prazo verificável", "meioVerificacao": "como comprovar (livro de registro, foto, recibo...)", "frequencia": "mensal/trimestral/..."}], "boasPraticas": ["prática de governança/ambiental/financeira/segurança 1", "prática 2"], "comoComunidadeAjuda": "1-2 parágrafos", "missaoImpacto": "1-2 parágrafos", "equipe": [{"nome": "papel/função", "formacaoNecessaria": "...", "horasSemanais": 20, "duracaoMeses": 6, "planoTrabalho": "o que a pessoa faz"}]}\n```',
    "",
    "IMPORTANTE — profundidade exigida (padrão mínimo observado em editais e projetos técnicos reais, não um rascunho superficial): o `objetivo` é o objetivo GERAL (2+ parágrafos); `objetivosEspecificos` são 3 a 6 objetivos numeráveis e MENSURÁVEIS, cada um casável com um indicador (ex.: \"Capacitar 30 mulheres em triagem e artesanato até o mês 5\"). `justificativa` deve ter PELO MENOS 2 PARÁGRAFOS com detalhamento concreto (números, local, contexto real) — nunca frases genéricas. `metas` REALISTAS e proporcionais ao porte/orçamento do arquétipo. Para CADA meta, gere um `indicadores` no padrão marco lógico (indicador mensurável + meta verificável + meio de verificação + frequência). `boasPraticas`: 3 a 6 práticas concretas de governança (ex.: conta coletiva com dupla assinatura, alternância de liderança), ambientais, financeiras e de segurança — não genéricas. `equipe` com PELO MENOS 2 PESSOAS, cada uma com papel, formação e plano de trabalho — nunca invente nomes próprios, use papéis/funções.",
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
      objetivosEspecificos: Array.isArray(obj.objetivosEspecificos) ? obj.objetivosEspecificos.filter((o: unknown) => typeof o === "string") : undefined,
      justificativa: typeof obj.justificativa === "string" ? obj.justificativa : undefined,
      metas: Array.isArray(obj.metas) ? obj.metas.filter((m: unknown) => typeof m === "string") : undefined,
      indicadores: sanitizarIndicadoresRascunho(obj.indicadores),
      boasPraticas: Array.isArray(obj.boasPraticas) ? obj.boasPraticas.filter((b: unknown) => typeof b === "string") : undefined,
      comoComunidadeAjuda: typeof obj.comoComunidadeAjuda === "string" ? obj.comoComunidadeAjuda : undefined,
      missaoImpacto: typeof obj.missaoImpacto === "string" ? obj.missaoImpacto : undefined,
      equipe: sanitizarEquipeRascunho(obj.equipe),
    };
    return { tipo: "rascunho", dados };
  } catch {
    return null;
  }
}

/**
 * Quantos campos o rascunho realmente traz.
 *
 * Um JSON sintaticamente perfeito com todos os campos vazios faz
 * `interpretarRespostaRascunho` devolver sucesso. Sem esta contagem, o app
 * aplicaria um rascunho oco como se a IA tivesse preenchido — e o plano B
 * nunca entraria justamente quando é mais necessário.
 */
export function contarCamposPreenchidos(dados: RascunhoDados): number {
  return Object.values(dados).filter((v) => {
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null;
  }).length;
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
    objetivosEspecificos: dados.objetivosEspecificos && dados.objetivosEspecificos.length > 0 ? dados.objetivosEspecificos : project.objetivosEspecificos,
    justificativa: dados.justificativa ?? project.justificativa,
    metas: dados.metas && dados.metas.length > 0 ? dados.metas : project.metas,
    indicadores: dados.indicadores && dados.indicadores.length > 0 ? dados.indicadores : project.indicadores,
    boasPraticas: dados.boasPraticas && dados.boasPraticas.length > 0 ? dados.boasPraticas : project.boasPraticas,
    comoComunidadeAjuda: dados.comoComunidadeAjuda ?? project.comoComunidadeAjuda,
    missaoImpacto: dados.missaoImpacto ?? project.missaoImpacto,
    equipe: dados.equipe && dados.equipe.length > 0 ? dados.equipe : project.equipe,
  };
}
