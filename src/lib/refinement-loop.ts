import type { AcessoLogistico, BudgetLine, CategoriaLinha, EquipeMembro, Indicador, MesCronograma, NivelRisco, Project, RiskItem, VersaoSnapshot } from "./types";
import { calcularCronogramaImplantacao } from "./cronograma-gantt";
import { avaliarConformidade } from "./compliance-engine";
import { montarChecklistFinal } from "./checklist";
import { carregarConfigLLM, enviarMensagemLLM, nomeProvedor, type ProviderConfig } from "./providers";
import { montarBlocoDiretrizesGlobais } from "./diretrizes-globais";
import { parseJsonDeResposta } from "./json-parsing";
import danos from "../data/danos.json";
import arquetipos from "../data/arquetipos.json";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type EtapaLapidacao = "escritor" | "orcamentista" | "critico" | "riscos" | "sugestor" | "compilador";

export const ETAPAS_ROTULO: Record<EtapaLapidacao, string> = {
  escritor: "✍ Escritor melhorando os textos",
  orcamentista: "💰 Orçamentista revisando o orçamento",
  critico: "🔍 Crítico-realista atacando o projeto",
  riscos: "⚠ Analista de riscos completando a matriz",
  sugestor: "💡 Sugestor propondo melhorias",
  compilador: "📦 Compilador consolidando a nova versão",
};

/** Campos que o loop pode alterar — subconjunto de Project, sempre aplicado com confirmação humana. */
export interface LapidacaoDados {
  objetivo?: string;
  justificativa?: string;
  metas?: string[];
  indicadores?: Indicador[];
  comoComunidadeAjuda?: string;
  missaoImpacto?: string;
  cronograma?: string;
  cronogramaMensal?: MesCronograma[];
  formasArrecadacao?: string[];
  orcamento?: BudgetLine[];
  equipe?: EquipeMembro[];
  riscos?: RiskItem[];
  posCompleto?: Project["posCompleto"];
  planoImplementacao?: string[];
  espacoLogistica?: Project["espacoLogistica"];
  fonteReposicaoEquipamentos?: string;
}

export interface ScoreConformidade {
  bloqueios: number;
  atencoes: number;
  pendencias: number;
}

/** Notas 0-10 dadas pelo Crítico à versão avaliada, por dimensão das diretrizes. */
export interface NotasCritico {
  realismo: number;
  sustentabilidade: number;
  conformidade: number;
  integracaoRede: number;
  media: number;
}

/** Considerações do Crítico fora do compliance determinístico — leituras qualitativas que costumam derrubar projetos na prática, mesmo quando o papel/orçamento está correto. */
export interface ConsideracoesMultidisciplinares {
  juridica: string[];
  sociologica: string[];
  psicologica: string[];
}

export interface ResultadoVolta {
  dados: LapidacaoDados;
  changelog: string[];
  problemasApontados: string[];
  sugestoes: string[];
  scoreAntes: ScoreConformidade;
  scoreDepois: ScoreConformidade;
  introduziuBloqueio: boolean;
  resolveuAlgo: boolean;
  /** Notas do Crítico para a versão que ENTROU nesta volta. */
  notas?: NotasCritico;
  /** Leitura jurídico-fundiária, sociológica e psicológica da viabilidade e das metas/passos do projeto. */
  consideracoes?: ConsideracoesMultidisciplinares;
  /** Resumo avaliativo do Compilador: como a versão está frente às diretrizes/metas. */
  avaliacaoResumo?: string;
  /** Recomendação do Compilador sobre rodar mais uma volta (o motor determinístico continua sendo o juiz final). */
  recomendaNovaVolta?: boolean;
  /** Resultado do Crítico+Compilador rodados com um SEGUNDO provedor (Fase 11b), só para comparação — nunca afeta a progressão do ciclo. */
  comparacao?: ComparacaoModelo;
}

/** Crítico + Compilador rodados com um provedor alternativo, para o usuário comparar/escolher (mesmos papéis de maior impacto, mesmas entradas do Escritor/Orçamentista/Riscos/Sugestor da volta). */
export interface ComparacaoModelo {
  providerNome: string;
  problemas: string[];
  notas?: NotasCritico;
  consideracoes?: ConsideracoesMultidisciplinares;
  changelog: string[];
  avaliacaoResumo?: string;
  scoreDepois: ScoreConformidade;
  /** Projeto resultante desta versão alternativa — aplicável no lugar da versão do provedor principal. */
  projetoResultante: Project;
}

export interface ResultadoLapidacao {
  ok: boolean;
  erro?: string;
  voltas: ResultadoVolta[];
  /** Projeto final (não persistido — só vira real com "Aplicar"). */
  projetoFinal?: Project;
  convergiu: boolean;
}

// ---------------------------------------------------------------------------
// Medição (o motor determinístico é o instrumento)
// ---------------------------------------------------------------------------

export function calcularScore(project: Project): ScoreConformidade {
  const findings = avaliarConformidade(project);
  const checklist = montarChecklistFinal(project, null);
  return {
    bloqueios: findings.filter((f) => f.severidade === "bloqueio").length,
    atencoes: findings.filter((f) => f.severidade === "atencao").length,
    pendencias: checklist.pendencias.length,
  };
}

function totalScore(s: ScoreConformidade): number {
  return s.bloqueios + s.atencoes + s.pendencias;
}

// ---------------------------------------------------------------------------
// Prompts por papel
// ---------------------------------------------------------------------------

function resumoProjeto(p: Project): string {
  const arquetipo = arquetipos.find((a) => a.id === p.arquetipoId);
  const dano = danos.find((d) => d.id === p.danoId);
  return JSON.stringify(
    {
      titulo: p.titulo,
      arquetipo: arquetipo?.nome ?? p.arquetipoId,
      tipoOficio46: arquetipo?.tipo,
      dano: dano?.nome ?? p.danoId,
      local: p.local,
      abrangencia: p.abrangencia,
      objetivo: p.objetivo,
      justificativa: p.justificativa,
      metas: p.metas,
      indicadores: p.indicadores,
      comoComunidadeAjuda: p.comoComunidadeAjuda,
      missaoImpacto: p.missaoImpacto,
      cronograma: p.cronograma,
      formasArrecadacao: p.formasArrecadacao,
      orcamento: p.orcamento.map((l) => ({ id: l.id, categoria: l.categoria, descricao: l.descricao, valor: l.valor, prazoMeses: l.prazoMeses, fonteCusteioFuturo: l.fonteCusteioFuturo, justificativaCicloProdutivo: l.justificativaCicloProdutivo, vidaUtilAnos: l.vidaUtilAnos })),
      equipe: p.equipe.map((m) => ({ id: m.id, nome: m.nome, formacaoNecessaria: m.formacaoNecessaria, horasSemanais: m.horasSemanais, duracaoMeses: m.duracaoMeses, planoTrabalho: m.planoTrabalho })),
      custosNaoCobertos: p.custosNaoCobertos,
      cenarios: p.cenarios,
      riscos: p.riscos,
      posCompleto: p.posCompleto,
      espacoLogistica: p.espacoLogistica,
      fonteReposicaoEquipamentos: p.fonteReposicaoEquipamentos,
    },
    null,
    1,
  );
}

function contextoBase(): string {
  const aprendizado = montarContextoAprendizado();
  return [
    "Contexto: projeto comunitário do Anexo I.1 (reparação Brumadinho/bacia do Paraopeba). Regras duras do Ofício 46: vedado custeio permanente sem fonte futura; capital de giro/insumos preferencialmente ≤6 meses (exceção só com justificativa de ciclo produtivo); política pública exige anuência do ente público; todo projeto precisa se sustentar sozinho após o repasse (POS).",
    "Diretrizes locais do usuário (obrigatórias): (1) o foco é qualidade e realismo do projeto, não rapidez; (2) todo projeto tem porte mínimo de R$ 100.000,00 — o orçamento deve corresponder a esse valor detalhando bem os itens, sem inflar valores artificialmente; (3) todo projeto deve prever a liberação de pelo menos 2 pessoas por 6 meses (equipe de implantação/operação inicial); (4) economia circular entre os projetos da rede é diretriz: sempre que possível, prefira que insumos, serviços e mão de obra venham de outros projetos comunitários da rede (isso não precisa cobrir todo o orçamento, mas deve ser considerado).",
    "PADRÃO MÍNIMO DE DETALHAMENTO (calibrado contra projetos técnicos reais do setor, não um rascunho superficial): além do Ofício 46, cite as normas técnicas/órgãos de classe aplicáveis ao TIPO de atividade do arquétipo quando existirem (ex.: vigilância sanitária municipal, ABNT NBR aplicável, conselho profissional da área, RDC ANVISA se houver resíduos/saúde envolvidos) — sem inventar norma que não exista; se não souber uma norma específica, diga que a legislação municipal/setorial deve ser consultada em vez de inventar um nome de norma.",
    ...(aprendizado ? [aprendizado] : []),
    "Responda SEMPRE em português simples. Responda SOMENTE com o bloco json pedido, sem nenhum texto fora dele.",
  ].join("\n");
}

function promptEscritor(p: Project): string {
  return [
    contextoBase(),
    "Papel: ESCRITOR. Melhore a clareza e a especificidade dos textos do projeto abaixo, sem inventar fatos, números ou locais novos — só reescreva melhor o que já existe (mais concreto, menos genérico).",
    "EXIGÊNCIA DE PROFUNDIDADE: `objetivo` e `justificativa` devem ter PELO MENOS 2 PARÁGRAFOS BEM DESENVOLVIDOS cada (nunca 1 frase só) — detalhamento concreto ligado ao dano/local/arquétipo, sem generalidades vazias. `comoComunidadeAjuda` e `missaoImpacto` devem ter pelo menos 1-2 parágrafos.",
    "METAS REALISTAS NA ORIGEM: revise `metas` para serem proporcionais ao orçamento e ao porte informados — nunca números desproporcionalmente grandes para o tamanho real do projeto; prefira metas mensuráveis e plausíveis dentro do prazo do cronograma.",
    "INDICADORES (padrão marco lógico, exigido em editais/financiadores reais): se `metas` não tiver `indicadores` correspondentes, ou se estiverem incompletos, gere/complete `indicadores` — cada um com indicador mensurável, meta verificável, meio de verificação concreto (ex.: livro de registro, relatório fotográfico, nota fiscal, lista de presença) e frequência de medição. Sem meio de verificação, a meta não é auditável.",
    "Projeto:", resumoProjeto(p),
    'Formato: ```json\n{"objetivo": "...", "justificativa": "...", "metas": ["..."], "indicadores": [{"id": "id-existente-ou-omitir-se-novo", "nome": "...", "meta": "...", "meioVerificacao": "...", "frequencia": "..."}], "comoComunidadeAjuda": "...", "missaoImpacto": "..."}\n``` (omita campos que já estão bons e profundos o suficiente; `indicadores` vem COMPLETO — existentes mantidos/melhorados + novos).',
  ].join("\n\n");
}

function promptOrcamentista(p: Project): string {
  return [
    contextoBase(),
    "Papel: ORÇAMENTISTA. Revise as linhas de orçamento: valores incoerentes entre si, prazos errados, itens típicos faltando para esse tipo de projeto. Verifique o porte mínimo de R$ 100 mil (se o total está abaixo, aponte itens legítimos que faltam — implantação, equipamentos, capacitação, equipe de 2+ pessoas por 6 meses). Onde um insumo/serviço puder vir de outro projeto da rede (economia circular), anote isso na descrição da linha. Para linhas de categoria 'equipamento', sugira vidaUtilAnos (padrão 5, ajuste se o item durar mais/menos) — isso alimenta a depreciação mensal do simulador; não deixe o projeto parecer mais sustentável do que é.",
    "REGRAS ESTRITAS: você pode ajustar linhas EXISTENTES (valor/prazo/descrição) e pode ADICIONAR linhas faltantes, mas toda linha NOVA deve vir com valor 0 e a descrição terminando em '(pesquisar preço)' — NUNCA invente um valor de mercado.",
    "Projeto:", resumoProjeto(p),
    'Formato: ```json\n{"orcamento": [{"id": "id-existente-ou-omitir-se-nova", "categoria": "infraestrutura|equipamento|regularizacao|capacitacao|capital-giro-inicial|insumos-iniciais|equipe-implantacao|operacao-assistida|folha-permanente|outro", "descricao": "...", "valor": 0, "prazoMeses": null, "fonteCusteioFuturo": null, "justificativaCicloProdutivo": null, "vidaUtilAnos": null}], "observacoes": ["por que mudou o quê"]}\n``` — devolva a lista COMPLETA de linhas (as mantidas + ajustadas + novas).',
  ].join("\n\n");
}

function promptCritico(p: Project): string {
  return [
    contextoBase(),
    "Papel: CRÍTICO-REALISTA. Ataque o projeto: metas superdimensionadas ou vagas, receitas otimistas demais, prazos irreais, dependências não declaradas, sustentabilidade frágil. Seja específico e duro, mas justo.",
    "Além dos problemas, DÊ NOTAS de 0 a 10 para esta versão do projeto, uma por dimensão: realismo (metas/receitas/prazos são críveis?), sustentabilidade (sobrevive ao fim do repasse?), conformidade (respeita as vedações do Ofício 46 e as diretrizes locais, incl. porte de R$ 100 mil e equipe de 2 pessoas/6 meses?), integracaoRede (aproveita economia circular com outros projetos?). Notas honestas — 10 é raro.",
    "Além disso, avalie a viabilidade e as metas/passos do projeto (incl. o plano de implementação, se já existir) sob TRÊS lentes qualitativas que costumam derrubar projetos na prática mesmo com orçamento correto — seja concreto, ligado ao arquétipo/local informado, não genérico:",
    "(1) JURÍDICO-FUNDIÁRIA: a situação do terreno/espaço necessário está clara? Há risco de posse informal, disputa de propriedade, ausência de cessão/comodato formal, exigência de regularização (usucapião, doação, concessão de uso) antes de investir em construção/equipamento fixo? Projetos em área de reassentamento ou terreno de terceiros merecem atenção redobrada.",
    "(2) SOCIOLÓGICA: a forma de seleção das pessoas participantes é justa e reduz conflito? O projeto depende de uma única liderança (risco de captura/personalismo)? Há histórico de divisão comunitária que a governança do projeto precisa prever? A escala das metas é compatível com a coesão social real da comunidade descrita?",
    "(3) PSICOLÓGICA: a comunidade é uma população pós-desastre (Brumadinho) — considere fadiga de participação, luto/trauma não resolvido, risco de sobrecarga/burnout de poucos voluntários, e o risco de re-traumatização se metas forem prometidas e não cumpridas. As metas geram expectativa realista ou podem piorar a confiança da comunidade se falharem?",
    "Projeto:", resumoProjeto(p),
    'Formato: ```json\n{"problemas": ["problema concreto 1", "problema concreto 2"], "notas": {"realismo": 0, "sustentabilidade": 0, "conformidade": 0, "integracaoRede": 0}, "consideracoes": {"juridica": ["..."], "sociologica": ["..."], "psicologica": ["..."]}}\n``` (liste só o que for relevante para ESTE projeto; array vazio se não houver risco identificado nessa lente).',
  ].join("\n\n");
}

function promptRiscos(p: Project): string {
  return [
    contextoBase(),
    "Papel: ANALISTA DE RISCOS. Complete/melhore a matriz de riscos (o que pode barrar ou quebrar o projeto) e aponte insuficiências (campos vazios ou fracos que enfraquecem o projeto perante a Governança). Matriz de risco NÃO é desculpa para atraso (Ofício 45).",
    "Projeto:", resumoProjeto(p),
    'Formato: ```json\n{"riscos": [{"descricao": "...", "probabilidade": "baixo|medio|alto", "impacto": "baixo|medio|alto", "mitigacao": "..."}], "insuficiencias": ["..."]}\n``` — devolva a lista COMPLETA de riscos (existentes melhorados + novos).',
  ].join("\n\n");
}

function promptSugestor(p: Project): string {
  return [
    contextoBase(),
    "Papel: SUGESTOR. Sugestões acionáveis de melhoria: parcerias possíveis, formas de arrecadação adicionais, fortalecimento do POS e — prioridade — integração de economia circular com outros projetos comunitários da rede (quem pode fornecer insumo/serviço para este projeto, e o que este projeto pode fornecer aos outros, refletindo isso no orçamento quando fizer sentido).",
    "Projeto:", resumoProjeto(p),
    'Formato: ```json\n{"sugestoes": ["sugestão acionável 1", "sugestão 2"]}\n```',
  ].join("\n\n");
}

function promptCompilador(p: Project, saidas: { escritor: unknown; orcamentista: unknown; critico: string[]; notas?: NotasCritico; consideracoes?: ConsideracoesMultidisciplinares; riscos: unknown; sugestor: string[] }): string {
  return [
    contextoBase(),
    "Papel: COMPILADOR. Você recebe o projeto original e as saídas dos outros 5 agentes. Produza UMA versão consolidada melhorada do projeto, incorporando o que for bom e corrigindo o que o crítico apontou. Não invente valores de orçamento novos (linhas novas ficam com valor 0). Não invente fatos.",
    "Além disso, produza um PLANO DE IMPLEMENTAÇÃO passo a passo, na ordem real de execução, cobrindo da pré-produção até a operação — por exemplo: formalizar associação/cooperativa, definir forma de seleção das pessoas participantes, discutir integração com outros projetos da rede, ESTIMAR e conseguir o espaço físico necessário (m² e tipo de espaço, considerando o acesso/logística informados), conseguir fornecedores (priorizando projetos da rede — economia circular, considerando a distância estimada), regularizações/licenças, compra de equipamentos, capacitação da equipe (mínimo 2 pessoas por 6 meses), estratégia de marketing, divulgação, início da operação assistida e transição para autossustentação. Se o projeto ainda não tem espaço/logística preenchidos, o passo de 'conseguir o local' deve incluir uma estimativa concreta de m² e tipo de espaço necessário, com base no arquétipo e na escala do projeto. Adapte os passos ao projeto concreto — não copie a lista genérica; cada passo deve ser uma frase acionável em português simples.",
    "IMPORTANTE: incorpore as considerações jurídico-fundiárias, sociológicas e psicológicas do Crítico (abaixo) diretamente no plano de implementação como passos concretos quando fizer sentido (ex.: 'regularizar formalmente a cessão do terreno com a Cáritas/EG antes de iniciar a construção', 'buscar apoio da rede de atenção psicossocial do território para dar suporte ao grupo gestor', 'definir critério de seleção por sorteio/assembleia para reduzir risco de conflito') e, quando relevante, também na matriz de riscos — essas leituras não são bloqueio determinístico, mas costumam derrubar projetos na prática.",
    "EQUIPE COM PLANO DE TRABALHO POR PESSOA: revise/complete `equipe` — cada pessoa/papel precisa de `formacaoNecessaria` e `planoTrabalho` (o que faz, mês a mês) coerentes com o arquétipo e o plano de implementação; mínimo 2 pessoas (diretriz local). Mantenha `id` das pessoas já existentes (reaproveitadas do projeto original) e só omita `id` em pessoas novas.",
    (() => {
      const faixas = calcularCronogramaImplantacao(p);
      const mesesImplantacao = Math.min(12, Math.max(1, ...faixas.map((f) => f.fimMes)));
      return [
        `CRONOGRAMA MÊS A MÊS: a implantação estimada a partir do orçamento cobre até o mês ${mesesImplantacao} (ver dados abaixo). Gere \`cronogramaMensal\` cobrindo pelo menos esses meses de implantação (pode continuar até o mês 12 com a operação), cada mês com 1-3 atividades concretas ligadas ao plano de implementação.`,
        "Estimativa de meses de implantação por categoria de orçamento (referência para o cronograma mês a mês, não copie literalmente — adapte às atividades reais):",
        JSON.stringify(faixas),
      ].join("\n");
    })(),
    "Projeto original:", resumoProjeto(p),
    "Saída do Escritor:", JSON.stringify(saidas.escritor ?? {}),
    "Saída do Orçamentista:", JSON.stringify(saidas.orcamentista ?? {}),
    "Problemas do Crítico:", JSON.stringify(saidas.critico),
    "Notas do Crítico (0-10 por dimensão):", JSON.stringify(saidas.notas ?? "não fornecidas"),
    "Considerações jurídico-fundiárias/sociológicas/psicológicas do Crítico:", JSON.stringify(saidas.consideracoes ?? "não fornecidas"),
    "Com base nas notas do Crítico e nas diretrizes/metas do contexto, escreva um RESUMO AVALIATIVO curto (2-4 frases: onde a versão está forte, onde ainda está fraca) e diga se vale rodar MAIS UMA volta de lapidação (recomendaNovaVolta: true só se ainda houver ganho claro a extrair; false se a versão já está madura ou se os problemas restantes exigem decisão humana, não IA).",
    "Saída do Analista de Riscos:", JSON.stringify(saidas.riscos ?? {}),
    "Sugestões do Sugestor:", JSON.stringify(saidas.sugestor),
    'Formato: ```json\n{"objetivo": "...", "justificativa": "...", "metas": ["..."], "indicadores": [{"id": "id-existente-ou-omitir-se-novo", "nome": "...", "meta": "...", "meioVerificacao": "...", "frequencia": "..."}], "comoComunidadeAjuda": "...", "missaoImpacto": "...", "cronograma": "...", "cronogramaMensal": [{"mes": 1, "atividades": ["..."]}], "formasArrecadacao": ["..."], "orcamento": [...mesma estrutura do orçamentista...], "equipe": [{"id": "id-existente-ou-omitir-se-nova", "nome": "...", "formacaoNecessaria": "...", "horasSemanais": 20, "duracaoMeses": 6, "planoTrabalho": "..."}], "riscos": [...mesma estrutura do analista...], "posCompleto": {"responsavelOperacao": "...", "fonteCusteioFuturoGeral": "...", "metodologiaTransicao": "...", "indicadoresAutonomia": "..."}, "planoImplementacao": ["passo 1 na ordem de execução", "passo 2", "..."], "espacoLogistica": {"areaM2": null, "tipoEspaco": null, "observacoes": null}, "fonteReposicaoEquipamentos": null, "avaliacaoResumo": "resumo avaliativo em 2-4 frases", "recomendaNovaVolta": false, "changelog": ["o que mudou e por quê, frase completa em português simples — máximo 10 itens"]}\n``` — `equipe` e `indicadores` (um por meta) devem vir COMPLETOS (existentes mantidos/melhorados + novos). Omita os demais campos sem mudança; changelog obrigatório.',
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// Sanitização (guardrails em código, não em confiança no prompt)
// ---------------------------------------------------------------------------

const CATEGORIAS_VALIDAS: CategoriaLinha[] = ["infraestrutura", "equipamento", "regularizacao", "capacitacao", "capital-giro-inicial", "insumos-iniciais", "equipe-implantacao", "operacao-assistida", "folha-permanente", "outro"];
const NIVEIS_VALIDOS: NivelRisco[] = ["baixo", "medio", "alto"];

function sanitizarOrcamento(bruto: unknown, original: BudgetLine[]): BudgetLine[] | undefined {
  if (!Array.isArray(bruto) || bruto.length === 0) return undefined;
  const idsOriginais = new Set(original.map((l) => l.id));
  const linhas: BudgetLine[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const descricao = typeof o.descricao === "string" ? o.descricao.trim() : "";
    if (!descricao) continue;
    const categoria = CATEGORIAS_VALIDAS.includes(o.categoria as CategoriaLinha) ? (o.categoria as CategoriaLinha) : "outro";
    const idExistente = typeof o.id === "string" && idsOriginais.has(o.id) ? o.id : null;
    let valor = typeof o.valor === "number" && Number.isFinite(o.valor) && o.valor >= 0 ? o.valor : 0;
    let descricaoFinal = descricao;
    // Guardrail central: linha NOVA nunca entra com valor inventado.
    if (!idExistente && valor > 0) {
      valor = 0;
      if (!/pesquisar preço/i.test(descricaoFinal)) descricaoFinal += " (pesquisar preço)";
    }
    linhas.push({
      id: idExistente ?? crypto.randomUUID(),
      categoria,
      descricao: descricaoFinal,
      valor,
      prazoMeses: typeof o.prazoMeses === "number" && o.prazoMeses > 0 ? o.prazoMeses : undefined,
      fonteCusteioFuturo: typeof o.fonteCusteioFuturo === "string" && o.fonteCusteioFuturo.trim() ? o.fonteCusteioFuturo : undefined,
      justificativaCicloProdutivo: typeof o.justificativaCicloProdutivo === "string" && o.justificativaCicloProdutivo.trim() ? o.justificativaCicloProdutivo : undefined,
      vidaUtilAnos: typeof o.vidaUtilAnos === "number" && o.vidaUtilAnos > 0 ? o.vidaUtilAnos : undefined,
    });
  }
  return linhas.length > 0 ? linhas : undefined;
}

function sanitizarRiscos(bruto: unknown): RiskItem[] | undefined {
  if (!Array.isArray(bruto) || bruto.length === 0) return undefined;
  const riscos: RiskItem[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const descricao = typeof o.descricao === "string" ? o.descricao.trim() : "";
    if (!descricao) continue;
    riscos.push({
      id: crypto.randomUUID(),
      descricao,
      probabilidade: NIVEIS_VALIDOS.includes(o.probabilidade as NivelRisco) ? (o.probabilidade as NivelRisco) : "medio",
      impacto: NIVEIS_VALIDOS.includes(o.impacto as NivelRisco) ? (o.impacto as NivelRisco) : "medio",
      mitigacao: typeof o.mitigacao === "string" ? o.mitigacao : "",
    });
  }
  return riscos.length > 0 ? riscos : undefined;
}

function sanitizarEquipe(bruto: unknown, original: EquipeMembro[]): EquipeMembro[] | undefined {
  if (!Array.isArray(bruto) || bruto.length === 0) return undefined;
  const idsOriginais = new Set(original.map((m) => m.id));
  const membros: EquipeMembro[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const nome = typeof o.nome === "string" ? o.nome.trim() : "";
    if (!nome) continue;
    const idExistente = typeof o.id === "string" && idsOriginais.has(o.id) ? o.id : null;
    membros.push({
      id: idExistente ?? crypto.randomUUID(),
      nome,
      formacaoNecessaria: typeof o.formacaoNecessaria === "string" && o.formacaoNecessaria.trim() ? o.formacaoNecessaria : undefined,
      horasSemanais: typeof o.horasSemanais === "number" && o.horasSemanais > 0 ? o.horasSemanais : undefined,
      duracaoMeses: typeof o.duracaoMeses === "number" && o.duracaoMeses > 0 ? o.duracaoMeses : undefined,
      planoTrabalho: typeof o.planoTrabalho === "string" && o.planoTrabalho.trim() ? o.planoTrabalho : undefined,
    });
  }
  return membros.length > 0 ? membros : undefined;
}

/** Indicadores no padrão marco lógico gerados/refinados pelo Escritor ou Compilador — mesmo padrão defensivo de sanitizarEquipe (preserva id de indicadores já existentes). */
function sanitizarIndicadores(bruto: unknown, original: Indicador[] = []): Indicador[] | undefined {
  if (!Array.isArray(bruto) || bruto.length === 0) return undefined;
  const idsOriginais = new Set(original.map((i) => i.id));
  const indicadores: Indicador[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const nome = typeof o.nome === "string" ? o.nome.trim() : "";
    const meta = typeof o.meta === "string" ? o.meta.trim() : "";
    if (!nome || !meta) continue;
    const idExistente = typeof o.id === "string" && idsOriginais.has(o.id) ? o.id : null;
    indicadores.push({
      id: idExistente ?? crypto.randomUUID(),
      nome,
      meta,
      meioVerificacao: typeof o.meioVerificacao === "string" && o.meioVerificacao.trim() ? o.meioVerificacao : undefined,
      frequencia: typeof o.frequencia === "string" && o.frequencia.trim() ? o.frequencia : undefined,
    });
  }
  return indicadores.length > 0 ? indicadores : undefined;
}

function sanitizarCronogramaMensal(bruto: unknown): MesCronograma[] | undefined {
  if (!Array.isArray(bruto) || bruto.length === 0) return undefined;
  const meses: MesCronograma[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const mes = typeof o.mes === "number" && o.mes >= 1 && o.mes <= 12 ? Math.round(o.mes) : null;
    const atividades = listaDeStrings(o.atividades) ?? [];
    if (mes === null || atividades.length === 0) continue;
    meses.push({ mes, atividades });
  }
  return meses.length > 0 ? meses.sort((a, b) => a.mes - b.mes).slice(0, 12) : undefined;
}

function listaDeStrings(bruto: unknown): string[] | undefined {
  if (!Array.isArray(bruto)) return undefined;
  const lista = bruto.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  return lista.length > 0 ? lista : undefined;
}

function stringOpcional(bruto: unknown): string | undefined {
  return typeof bruto === "string" && bruto.trim().length > 0 ? bruto : undefined;
}

/** Nota 0-10 validada em código — valor fora da faixa/não numérico cai para 0. */
function nota(bruto: unknown): number {
  const n = typeof bruto === "number" && Number.isFinite(bruto) ? bruto : 0;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

function sanitizarNotas(bruto: unknown): NotasCritico | undefined {
  if (!bruto || typeof bruto !== "object") return undefined;
  const o = bruto as Record<string, unknown>;
  const realismo = nota(o.realismo);
  const sustentabilidade = nota(o.sustentabilidade);
  const conformidade = nota(o.conformidade);
  const integracaoRede = nota(o.integracaoRede);
  const media = Math.round(((realismo + sustentabilidade + conformidade + integracaoRede) / 4) * 10) / 10;
  return { realismo, sustentabilidade, conformidade, integracaoRede, media };
}

function sanitizarConsideracoes(bruto: unknown): ConsideracoesMultidisciplinares | undefined {
  if (!bruto || typeof bruto !== "object") return undefined;
  const o = bruto as Record<string, unknown>;
  const juridica = listaDeStrings(o.juridica) ?? [];
  const sociologica = listaDeStrings(o.sociologica) ?? [];
  const psicologica = listaDeStrings(o.psicologica) ?? [];
  if (juridica.length === 0 && sociologica.length === 0 && psicologica.length === 0) return undefined;
  return { juridica, sociologica, psicologica };
}

function sanitizarCompilado(bruto: Record<string, unknown>, original: Project): LapidacaoDados & { changelog: string[]; avaliacaoResumo?: string; recomendaNovaVolta?: boolean } {
  const pos = (bruto.posCompleto && typeof bruto.posCompleto === "object" ? (bruto.posCompleto as Record<string, unknown>) : {}) as Record<string, unknown>;
  const posCompleto = {
    responsavelOperacao: stringOpcional(pos.responsavelOperacao) ?? original.posCompleto.responsavelOperacao,
    fonteCusteioFuturoGeral: stringOpcional(pos.fonteCusteioFuturoGeral) ?? original.posCompleto.fonteCusteioFuturoGeral,
    metodologiaTransicao: stringOpcional(pos.metodologiaTransicao) ?? original.posCompleto.metodologiaTransicao,
    indicadoresAutonomia: stringOpcional(pos.indicadoresAutonomia) ?? original.posCompleto.indicadoresAutonomia,
  };
  const espacoBruto = (bruto.espacoLogistica && typeof bruto.espacoLogistica === "object" ? (bruto.espacoLogistica as Record<string, unknown>) : {}) as Record<string, unknown>;
  const ACESSOS_VALIDOS = ["asfalto", "estrada-terra", "transporte-publico-proximo", "dificil"];
  const espacoLogistica = {
    areaM2: typeof espacoBruto.areaM2 === "number" && espacoBruto.areaM2 > 0 ? espacoBruto.areaM2 : original.espacoLogistica?.areaM2,
    tipoEspaco: stringOpcional(espacoBruto.tipoEspaco) ?? original.espacoLogistica?.tipoEspaco,
    acesso: ACESSOS_VALIDOS.includes(espacoBruto.acesso as string) ? (espacoBruto.acesso as AcessoLogistico) : original.espacoLogistica?.acesso,
    distanciaFornecedoresKm: typeof espacoBruto.distanciaFornecedoresKm === "number" && espacoBruto.distanciaFornecedoresKm >= 0 ? espacoBruto.distanciaFornecedoresKm : original.espacoLogistica?.distanciaFornecedoresKm,
    observacoes: stringOpcional(espacoBruto.observacoes) ?? original.espacoLogistica?.observacoes,
  };
  return {
    objetivo: stringOpcional(bruto.objetivo),
    justificativa: stringOpcional(bruto.justificativa),
    metas: listaDeStrings(bruto.metas),
    indicadores: sanitizarIndicadores(bruto.indicadores, original.indicadores),
    comoComunidadeAjuda: stringOpcional(bruto.comoComunidadeAjuda),
    missaoImpacto: stringOpcional(bruto.missaoImpacto),
    cronograma: stringOpcional(bruto.cronograma),
    cronogramaMensal: sanitizarCronogramaMensal(bruto.cronogramaMensal),
    formasArrecadacao: listaDeStrings(bruto.formasArrecadacao),
    orcamento: sanitizarOrcamento(bruto.orcamento, original.orcamento),
    equipe: sanitizarEquipe(bruto.equipe, original.equipe),
    riscos: sanitizarRiscos(bruto.riscos),
    posCompleto,
    planoImplementacao: listaDeStrings(bruto.planoImplementacao)?.slice(0, 30),
    espacoLogistica: Object.values(espacoLogistica).some((v) => v !== undefined) ? espacoLogistica : undefined,
    fonteReposicaoEquipamentos: stringOpcional(bruto.fonteReposicaoEquipamentos) ?? original.fonteReposicaoEquipamentos,
    avaliacaoResumo: stringOpcional(bruto.avaliacaoResumo),
    recomendaNovaVolta: typeof bruto.recomendaNovaVolta === "boolean" ? bruto.recomendaNovaVolta : undefined,
    changelog: (listaDeStrings(bruto.changelog) ?? []).slice(0, 10),
  };
}

export function aplicarLapidacao(project: Project, dados: LapidacaoDados): Project {
  return {
    ...project,
    objetivo: dados.objetivo ?? project.objetivo,
    justificativa: dados.justificativa ?? project.justificativa,
    metas: dados.metas ?? project.metas,
    indicadores: dados.indicadores ?? project.indicadores,
    comoComunidadeAjuda: dados.comoComunidadeAjuda ?? project.comoComunidadeAjuda,
    missaoImpacto: dados.missaoImpacto ?? project.missaoImpacto,
    cronograma: dados.cronograma ?? project.cronograma,
    cronogramaMensal: dados.cronogramaMensal ?? project.cronogramaMensal,
    formasArrecadacao: dados.formasArrecadacao ?? project.formasArrecadacao,
    orcamento: dados.orcamento ?? project.orcamento,
    equipe: dados.equipe ?? project.equipe,
    riscos: dados.riscos ?? project.riscos,
    posCompleto: dados.posCompleto ?? project.posCompleto,
    planoImplementacao: dados.planoImplementacao ?? project.planoImplementacao,
    espacoLogistica: dados.espacoLogistica ?? project.espacoLogistica,
    fonteReposicaoEquipamentos: dados.fonteReposicaoEquipamentos ?? project.fonteReposicaoEquipamentos,
  };
}

const MAX_HISTORICO_VERSOES = 8;

/**
 * Única porta de entrada para "aplicar de verdade" uma lapidação (individual
 * ou em massa) — incrementa a versão e guarda o estado anterior no histórico
 * (até MAX_HISTORICO_VERSOES, FIFO) para permitir reverter depois. Nunca
 * aninha o próprio histórico dentro do snapshot (evitaria crescimento
 * recursivo dos dados salvos).
 */
export function commitarVersaoLapidada(original: Project, projetoFinal: Project, changelog: string[]): Project {
  const versaoAnterior = original.versaoLapidacao ?? 0;
  const { historicoVersoes: _semHistorico, ...snapshotSemHistorico } = original;
  const novaEntrada: VersaoSnapshot = {
    versao: versaoAnterior,
    aplicadaEm: new Date().toISOString(),
    changelog,
    snapshot: snapshotSemHistorico,
  };
  const historico = [...(original.historicoVersoes ?? []), novaEntrada].slice(-MAX_HISTORICO_VERSOES);
  return { ...projetoFinal, versaoLapidacao: versaoAnterior + 1, historicoVersoes: historico };
}

/**
 * Reverte para uma versão anterior — nunca é destrutivo: o estado atual (de
 * onde se está revertendo) também vira uma entrada nova de histórico, então
 * sempre dá para voltar a onde se estava antes de reverter.
 */
export function reverterParaVersao(project: Project, versaoAlvo: number): Project | null {
  const historico = project.historicoVersoes ?? [];
  const alvo = historico.find((v) => v.versao === versaoAlvo);
  if (!alvo) return null;

  const versaoAtual = project.versaoLapidacao ?? 0;
  const { historicoVersoes: _semHistorico, ...snapshotAtual } = project;
  const entradaDoEstadoAtual: VersaoSnapshot = {
    versao: versaoAtual,
    aplicadaEm: new Date().toISOString(),
    changelog: [`Revertido para a versão v${versaoAlvo}.`],
    snapshot: snapshotAtual,
  };
  const novoHistorico = [...historico, entradaDoEstadoAtual].slice(-MAX_HISTORICO_VERSOES);
  return { ...alvo.snapshot, versaoLapidacao: versaoAtual + 1, historicoVersoes: novoHistorico };
}

// ---------------------------------------------------------------------------
// O ciclo
// ---------------------------------------------------------------------------

async function chamarPapel(prompt: string, configOverride?: ProviderConfig): Promise<{ ok: boolean; texto?: string; erro?: string }> {
  const config = configOverride ?? carregarConfigLLM();
  const diretrizes = montarBlocoDiretrizesGlobais();
  const conteudo = diretrizes ? `${prompt}\n\n${diretrizes}` : prompt;
  const resposta = await enviarMensagemLLM(config, [{ role: "user", content: conteudo }]);
  if (!resposta.ok) return { ok: false, erro: resposta.erro };
  return { ok: true, texto: resposta.conteudo ?? "" };
}

export interface OpcoesLapidacao {
  voltas: number; // 1-3
  onProgresso?: (volta: number, etapa: EtapaLapidacao) => void;
  cancelado?: () => boolean;
  /** Provedor alternativo (Fase 11b): se informado, roda Crítico+Compilador também com ele, só para comparação lado a lado — nunca decide a progressão do ciclo. */
  compararConfig?: ProviderConfig;
  onProgressoComparacao?: (volta: number, etapa: "critico" | "compilador") => void;
  /** Diretriz/documento citado só nesta chamada (Fase 14c, chat-agente) — vale só para esta lapidação, nunca vira diretriz global permanente. */
  diretrizExtra?: string;
}

/**
 * Ciclo de Lapidação: 6 papéis em sequência por volta; a saída do compilador
 * vira a entrada da próxima volta. NADA é persistido aqui — o chamador decide
 * aplicar ou descartar (gate humano).
 */
export async function lapidarProjeto(original: Project, opcoes: OpcoesLapidacao): Promise<ResultadoLapidacao> {
  const voltas: ResultadoVolta[] = [];
  let atual = original;
  const totalVoltas = Math.max(1, Math.min(3, opcoes.voltas));

  const sufixoDiretrizExtra = opcoes.diretrizExtra?.trim()
    ? `\n\nDIRETRIZ EXTRA PARA ESTA CHAMADA (citada pelo usuário no chat-agente, vale só desta vez — nunca vira diretriz global permanente): ${opcoes.diretrizExtra.trim()}`
    : "";

  for (let volta = 1; volta <= totalVoltas; volta++) {
    const scoreAntes = calcularScore(atual);

    const etapas: { etapa: EtapaLapidacao; prompt: string }[] = [
      { etapa: "escritor", prompt: promptEscritor(atual) + sufixoDiretrizExtra },
      { etapa: "orcamentista", prompt: promptOrcamentista(atual) + sufixoDiretrizExtra },
      { etapa: "critico", prompt: promptCritico(atual) + sufixoDiretrizExtra },
      { etapa: "riscos", prompt: promptRiscos(atual) + sufixoDiretrizExtra },
      { etapa: "sugestor", prompt: promptSugestor(atual) + sufixoDiretrizExtra },
    ];

    const saidas: Record<string, unknown> = {};
    for (const { etapa, prompt } of etapas) {
      if (opcoes.cancelado?.()) return { ok: false, erro: "Cancelado pelo usuário.", voltas, convergiu: false };
      opcoes.onProgresso?.(volta, etapa);
      const resposta = await chamarPapel(prompt);
      if (!resposta.ok) return { ok: false, erro: `${ETAPAS_ROTULO[etapa]}: ${resposta.erro}`, voltas, convergiu: false };
      saidas[etapa] = parseJsonDeResposta<Record<string, unknown>>(resposta.texto ?? "") ?? {};
    }

    const problemas = listaDeStrings((saidas.critico as Record<string, unknown>)?.problemas) ?? [];
    const notas = sanitizarNotas((saidas.critico as Record<string, unknown>)?.notas);
    const consideracoes = sanitizarConsideracoes((saidas.critico as Record<string, unknown>)?.consideracoes);
    const sugestoes = listaDeStrings((saidas.sugestor as Record<string, unknown>)?.sugestoes) ?? [];

    if (opcoes.cancelado?.()) return { ok: false, erro: "Cancelado pelo usuário.", voltas, convergiu: false };
    opcoes.onProgresso?.(volta, "compilador");
    const respostaCompilador = await chamarPapel(
      promptCompilador(atual, {
        escritor: saidas.escritor,
        orcamentista: saidas.orcamentista,
        critico: problemas,
        notas,
        consideracoes,
        riscos: saidas.riscos,
        sugestor: sugestoes,
      }) + sufixoDiretrizExtra,
    );
    if (!respostaCompilador.ok) return { ok: false, erro: `Compilador: ${respostaCompilador.erro}`, voltas, convergiu: false };

    const brutoCompilado = parseJsonDeResposta<Record<string, unknown>>(respostaCompilador.texto ?? "");
    if (!brutoCompilado) return { ok: false, erro: "Não foi possível interpretar a resposta do Compilador.", voltas, convergiu: false };

    const compilado = sanitizarCompilado(brutoCompilado, atual);
    const candidato = aplicarLapidacao(atual, compilado);
    const scoreDepois = calcularScore(candidato);

    // Comparação com um segundo provedor (Fase 11b) — só nos papéis de maior
    // impacto (Crítico + Compilador), reaproveitando as saídas do Escritor/
    // Orçamentista/Riscos/Sugestor já computadas acima. Nunca decide a
    // progressão do ciclo (`atual` sempre segue o provedor principal).
    let comparacao: ComparacaoModelo | undefined;
    if (opcoes.compararConfig && !opcoes.cancelado?.()) {
      opcoes.onProgressoComparacao?.(volta, "critico");
      const respostaCriticoB = await chamarPapel(promptCritico(atual), opcoes.compararConfig);
      if (respostaCriticoB.ok) {
        const criticoB = parseJsonDeResposta<Record<string, unknown>>(respostaCriticoB.texto ?? "") ?? {};
        const problemasB = listaDeStrings(criticoB.problemas) ?? [];
        const notasB = sanitizarNotas(criticoB.notas);
        const consideracoesB = sanitizarConsideracoes(criticoB.consideracoes);

        opcoes.onProgressoComparacao?.(volta, "compilador");
        const respostaCompiladorB = await chamarPapel(
          promptCompilador(atual, {
            escritor: saidas.escritor,
            orcamentista: saidas.orcamentista,
            critico: problemasB,
            notas: notasB,
            consideracoes: consideracoesB,
            riscos: saidas.riscos,
            sugestor: sugestoes,
          }),
          opcoes.compararConfig,
        );
        const brutoCompiladoB = respostaCompiladorB.ok ? parseJsonDeResposta<Record<string, unknown>>(respostaCompiladorB.texto ?? "") : null;
        if (brutoCompiladoB) {
          const compiladoB = sanitizarCompilado(brutoCompiladoB, atual);
          const candidatoB = aplicarLapidacao(atual, compiladoB);
          comparacao = {
            providerNome: nomeProvedor(opcoes.compararConfig),
            problemas: problemasB,
            notas: notasB,
            consideracoes: consideracoesB,
            changelog: compiladoB.changelog,
            avaliacaoResumo: compiladoB.avaliacaoResumo,
            scoreDepois: calcularScore(candidatoB),
            projetoResultante: candidatoB,
          };
        }
      }
    }

    const voltaResultado: ResultadoVolta = {
      dados: compilado,
      changelog: compilado.changelog,
      problemasApontados: problemas,
      sugestoes,
      scoreAntes,
      scoreDepois,
      introduziuBloqueio: scoreDepois.bloqueios > scoreAntes.bloqueios,
      resolveuAlgo: totalScore(scoreDepois) < totalScore(scoreAntes),
      notas,
      consideracoes,
      avaliacaoResumo: compilado.avaliacaoResumo,
      recomendaNovaVolta: compilado.recomendaNovaVolta,
      comparacao,
    };
    voltas.push(voltaResultado);
    atual = candidato;

    // Convergência: para antes do teto se a volta não teve ganho medido pelo motor
    // determinístico OU se o Compilador avaliou que não há mais ganho a extrair.
    // O motor continua mandando: se a volta resolveu itens, a recomendação sozinha
    // não força volta extra além do que o usuário pediu.
    const compiladorDisseParar = compilado.recomendaNovaVolta === false;
    if ((!voltaResultado.resolveuAlgo || compiladorDisseParar) && volta < totalVoltas) {
      return { ok: true, voltas, projetoFinal: atual, convergiu: true };
    }
  }

  return { ok: true, voltas, projetoFinal: atual, convergiu: false };
}

// ---------------------------------------------------------------------------
// Estatísticas aplicar × descartar (métrica de utilidade, local)
// ---------------------------------------------------------------------------

const STATS_KEY = "sementeira-lapidacao-stats-v1";

export interface LapidacaoStats {
  aplicadas: number;
  descartadas: number;
}

export function carregarStatsLapidacao(): LapidacaoStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw) as LapidacaoStats;
  } catch {
    /* ignora */
  }
  return { aplicadas: 0, descartadas: 0 };
}

const HISTORICO_KEY = "sementeira-lapidacao-historico-v1";

/** Uma execução do ciclo, registrada localmente — base de dados para analisar a qualidade do loop ao longo do tempo (notas por dimensão × aplicar/descartar × Δ conformidade). */
export interface RegistroLapidacao {
  data: string;
  aplicada: boolean;
  voltas: number;
  notasFinais?: NotasCritico;
  scoreAntes?: ScoreConformidade;
  scoreDepois?: ScoreConformidade;
  recomendouNovaVolta?: boolean;
  /** Por que o usuário descartou a versão lapidada (opcional, só quando aplicada=false) — realimenta os prompts dos papéis nas próximas execuções. */
  motivoDescarte?: string;
}

export function carregarHistoricoLapidacao(): RegistroLapidacao[] {
  try {
    const raw = localStorage.getItem(HISTORICO_KEY);
    if (raw) return JSON.parse(raw) as RegistroLapidacao[];
  } catch {
    /* ignora */
  }
  return [];
}

export function registrarLapidacao(aplicada: boolean, resultado?: ResultadoLapidacao, motivoDescarte?: string): void {
  const stats = carregarStatsLapidacao();
  if (aplicada) stats.aplicadas += 1;
  else stats.descartadas += 1;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));

  const ultima = resultado?.voltas[resultado.voltas.length - 1];
  const historico = carregarHistoricoLapidacao();
  historico.push({
    data: new Date().toISOString(),
    aplicada,
    voltas: resultado?.voltas.length ?? 0,
    notasFinais: ultima?.notas,
    scoreAntes: resultado?.voltas[0]?.scoreAntes,
    scoreDepois: ultima?.scoreDepois,
    recomendouNovaVolta: ultima?.recomendaNovaVolta,
    motivoDescarte: !aplicada && motivoDescarte?.trim() ? motivoDescarte.trim() : undefined,
  });
  localStorage.setItem(HISTORICO_KEY, JSON.stringify(historico.slice(-200)));
}

const MAX_MOTIVOS_APRENDIZADO = 8;

/**
 * Contexto de aprendizado local (padrão Vaire) — motivos de descarte recentes,
 * injetados no prompt dos papéis para que o ciclo aprenda com rejeições
 * passadas ("nas últimas lapidações o usuário rejeitou X, seja mais cauteloso
 * nesse ponto"). Vazio se não houver nenhum motivo registrado ainda.
 */
export function montarContextoAprendizado(): string {
  const motivos = carregarHistoricoLapidacao()
    .filter((r) => !r.aplicada && r.motivoDescarte)
    .slice(-MAX_MOTIVOS_APRENDIZADO)
    .map((r) => `- ${r.motivoDescarte}`);
  if (motivos.length === 0) return "";
  return [
    "Aprendizado de execuções anteriores: nas últimas vezes que o usuário descartou uma versão lapidada, os motivos informados foram:",
    ...motivos,
    "Leve isso em conta — evite repetir os mesmos problemas apontados acima.",
  ].join("\n");
}
