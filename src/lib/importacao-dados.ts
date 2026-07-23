import type {
  Abrangencia,
  BudgetLine,
  CategoriaLinha,
  Contato,
  CustoNaoCobertoItem,
  EquipeMembro,
  EspacoLogistica,
  Indicador,
  ItemNecessario,
  NivelRisco,
  PosCompleto,
  ProducaoItem,
  Project,
  RiskItem,
} from "./types";
import { PORTE_POR_ABRANGENCIA } from "./types";
import { MUNICIPIOS_PARAOPEBA } from "./geografia";
import { normalizarTexto } from "./texto";
import danos from "../data/danos.json";
import arquetipos from "../data/arquetipos.json";
import setores from "../data/setores.json";

/**
 * Contrato de extração usado pela importação. É um superset do `RascunhoDados`
 * de draft-generation.ts: a geração assistida rascunha só o miolo textual, mas
 * quem importa um documento pronto tem dinheiro, local, riscos e cronograma no
 * papel — descartar isso (como acontecia antes) esvazia a importação.
 *
 * Todo campo é opcional e passa por sanitizador: nada entra no projeto sem ser
 * validado contra os dados estáticos do app. O motor de conformidade continua
 * sendo a palavra final depois disso.
 */
export interface DadosImportacao {
  titulo?: string;
  danoId?: string;
  arquetipoId?: string;
  setorId?: string;
  objetivo?: string;
  objetivosEspecificos?: string[];
  justificativa?: string;
  metas?: string[];
  indicadores?: Indicador[];
  boasPraticas?: string[];
  comoComunidadeAjuda?: string;
  missaoImpacto?: string;
  equipe?: EquipeMembro[];
  local?: string;
  municipioId?: string;
  abrangencia?: Abrangencia;
  publicoAlvo?: string;
  pessoasAtendidasDiretas?: number;
  pessoasAtendidasIndiretas?: number;
  orcamento?: BudgetLine[];
  producaoEstimada?: ProducaoItem[];
  itensNecessarios?: ItemNecessario[];
  cronograma?: string;
  formasArrecadacao?: string[];
  custosNaoCobertos?: CustoNaoCobertoItem[];
  riscos?: RiskItem[];
  espacoLogistica?: EspacoLogistica;
  contato?: Contato;
  posCompleto?: PosCompleto;
  coordenacaoFeminina?: boolean;
}

/** Cada sanitizador registra aqui o que não deu para aproveitar — a prévia mostra isso ao usuário. */
export interface ContextoSanitizacao {
  avisos: string[];
}

export function novoContexto(): ContextoSanitizacao {
  return { avisos: [] };
}

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

/** Remove chaves com valor `undefined` — sem isso, um spread apaga o que já existia no projeto. */
function semUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function texto(valor: unknown): string | undefined {
  if (typeof valor === "number") return String(valor);
  if (typeof valor !== "string") return undefined;
  const t = valor.trim();
  return t.length > 0 ? t : undefined;
}

function listaDeTextos(valor: unknown): string[] | undefined {
  // Aceita array JSON e também texto com itens separados por quebra de linha,
  // ponto-e-vírgula ou bullet — comum quando vem de célula de planilha.
  if (Array.isArray(valor)) {
    const itens = valor.map((v) => texto(v)).filter((v): v is string => !!v);
    return itens.length > 0 ? itens : undefined;
  }
  const t = texto(valor);
  if (!t) return undefined;
  const itens = t
    .split(/\r?\n|;|•|(?:^|\s)[-–]\s/)
    .map((i) => i.trim().replace(/^\d+[.)]\s*/, ""))
    .filter((i) => i.length > 1);
  return itens.length > 0 ? itens : [t];
}

/**
 * Converte valor monetário/numérico em número, cobrindo os formatos que
 * realmente aparecem: "R$ 12.500,00", "12500", "12,5 mil", "1.2 milhão".
 * Devolve `undefined` (com aviso) quando não dá para ter certeza — chutar um
 * número errado em orçamento é pior do que deixar o campo vazio.
 */
export function parsearNumero(valor: unknown, rotulo: string, ctx: ContextoSanitizacao): number | undefined {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  const t = texto(valor);
  if (!t) return undefined;

  const semMoeda = t.replace(/r\$|reais?/gi, "").trim();
  const multiplicador = /\bmilh(ão|ões|ao|oes)\b/i.test(semMoeda) ? 1_000_000 : /\bmil\b/i.test(semMoeda) ? 1_000 : 1;
  let numerico = semMoeda.replace(/\bmilh(ão|ões|ao|oes)\b|\bmil\b/gi, "").trim();

  // Formato pt-BR ("12.500,00") vs. en-US ("12,500.00"): manda quem vem por último.
  const ultimaVirgula = numerico.lastIndexOf(",");
  const ultimoPonto = numerico.lastIndexOf(".");
  if (ultimaVirgula > ultimoPonto) {
    numerico = numerico.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPonto > ultimaVirgula) {
    numerico = numerico.replace(/,/g, "");
  } else {
    numerico = numerico.replace(/,/g, ".");
  }
  numerico = numerico.replace(/[^\d.\-]/g, "");

  const n = Number.parseFloat(numerico);
  if (!Number.isFinite(n)) {
    ctx.avisos.push(`"${rotulo}": não foi possível ler "${t}" como número — campo deixado em branco.`);
    return undefined;
  }
  return n * multiplicador;
}

function parsearBooleano(valor: unknown): boolean | undefined {
  if (typeof valor === "boolean") return valor;
  const t = texto(valor);
  if (!t) return undefined;
  const n = normalizarTexto(t);
  if (["sim", "s", "true", "verdadeiro", "x", "1"].includes(n)) return true;
  if (["nao", "n", "false", "falso", "0"].includes(n)) return false;
  return undefined;
}

// ---------------------------------------------------------------------------
// Resolução contra os dados estáticos do app
// ---------------------------------------------------------------------------

/** Casa um valor livre com uma lista {id, nome}: id exato, nome exato, depois nome contido. */
function resolverPorIdOuNome(valor: unknown, lista: { id: string; nome: string }[]): string | undefined {
  const t = texto(valor);
  if (!t) return undefined;
  const n = normalizarTexto(t);
  const porId = lista.find((i) => normalizarTexto(i.id) === n);
  if (porId) return porId.id;
  const porNome = lista.find((i) => normalizarTexto(i.nome) === n);
  if (porNome) return porNome.id;
  const contido = lista.find((i) => n.includes(normalizarTexto(i.nome)) || normalizarTexto(i.nome).includes(n));
  return contido?.id;
}

export function resolverDanoId(valor: unknown, ctx: ContextoSanitizacao): string | undefined {
  const id = resolverPorIdOuNome(valor, danos as { id: string; nome: string }[]);
  const t = texto(valor);
  if (!id && t) ctx.avisos.push(`Dano "${t}" não corresponde a nenhum dano do Anexo I.1 — escolha manualmente no passo "Dano e tipo de projeto".`);
  return id;
}

export function resolverArquetipoId(valor: unknown, ctx: ContextoSanitizacao): string | undefined {
  const id = resolverPorIdOuNome(valor, arquetipos as { id: string; nome: string }[]);
  const t = texto(valor);
  if (!id && t) ctx.avisos.push(`Categoria/tipo "${t}" não corresponde a nenhum arquétipo — escolha manualmente.`);
  return id;
}

export function resolverSetorId(valor: unknown, ctx: ContextoSanitizacao): string | undefined {
  const id = resolverPorIdOuNome(valor, setores as { id: string; nome: string }[]);
  const t = texto(valor);
  if (!id && t) ctx.avisos.push(`Setor/público "${t}" não corresponde a nenhum setor com cota — mantido o setor padrão.`);
  return id;
}

export function resolverMunicipioId(valor: unknown, ctx: ContextoSanitizacao): string | undefined {
  const id = resolverPorIdOuNome(valor, MUNICIPIOS_PARAOPEBA);
  const t = texto(valor);
  if (!id && t) ctx.avisos.push(`Município "${t}" não está na lista da bacia do Paraopeba — o local ficou como texto livre.`);
  return id;
}

const ABRANGENCIAS: Abrangencia[] = ["local", "regional", "inter-regional"];

export function resolverAbrangencia(valor: unknown, ctx: ContextoSanitizacao): Abrangencia | undefined {
  const t = texto(valor);
  if (!t) return undefined;
  const n = normalizarTexto(t);
  const direta = ABRANGENCIAS.find((a) => normalizarTexto(a) === n);
  if (direta) return direta;
  // Aceita também o porte, que é derivado da abrangência.
  if (n.includes("inter")) return "inter-regional";
  if (n.includes("regional") || n.includes("medio") || n.includes("médio")) return "regional";
  if (n.includes("local") || n.includes("pequeno")) return "local";
  if (n.includes("grande")) return "inter-regional";
  ctx.avisos.push(`Abrangência "${t}" não reconhecida — mantida "local". Confira o porte e o teto.`);
  return undefined;
}

const CATEGORIAS: CategoriaLinha[] = [
  "infraestrutura",
  "equipamento",
  "regularizacao",
  "capacitacao",
  "capital-giro-inicial",
  "insumos-iniciais",
  "equipe-implantacao",
  "operacao-assistida",
  "folha-permanente",
  "outro",
];

const APELIDOS_CATEGORIA: Record<string, CategoriaLinha> = {
  obra: "infraestrutura",
  obras: "infraestrutura",
  reforma: "infraestrutura",
  construcao: "infraestrutura",
  maquina: "equipamento",
  maquinas: "equipamento",
  equipamentos: "equipamento",
  movel: "equipamento",
  moveis: "equipamento",
  documentacao: "regularizacao",
  licenca: "regularizacao",
  licencas: "regularizacao",
  curso: "capacitacao",
  cursos: "capacitacao",
  formacao: "capacitacao",
  treinamento: "capacitacao",
  "capital de giro": "capital-giro-inicial",
  insumo: "insumos-iniciais",
  insumos: "insumos-iniciais",
  materia_prima: "insumos-iniciais",
  "materia prima": "insumos-iniciais",
  "mao de obra": "equipe-implantacao",
  pessoal: "equipe-implantacao",
  salario: "folha-permanente",
  salarios: "folha-permanente",
  folha: "folha-permanente",
};

export function resolverCategoria(valor: unknown, ctx: ContextoSanitizacao): CategoriaLinha {
  const t = texto(valor);
  if (!t) return "outro";
  const n = normalizarTexto(t);
  const direta = CATEGORIAS.find((c) => c === n || normalizarTexto(c.replace(/-/g, " ")) === n);
  if (direta) return direta;
  const apelido = APELIDOS_CATEGORIA[n] ?? Object.entries(APELIDOS_CATEGORIA).find(([k]) => n.includes(k))?.[1];
  if (apelido) return apelido;
  ctx.avisos.push(`Categoria de orçamento "${t}" não reconhecida — classificada como "outro". Reveja no passo Orçamento.`);
  return "outro";
}

function resolverNivelRisco(valor: unknown): NivelRisco {
  const n = normalizarTexto(texto(valor) ?? "");
  if (n.startsWith("alt")) return "alto";
  if (n.startsWith("baix")) return "baixo";
  return "medio";
}

// ---------------------------------------------------------------------------
// Sanitizadores de coleções
// ---------------------------------------------------------------------------

function comoObjetos(bruto: unknown): Record<string, unknown>[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.filter((i): i is Record<string, unknown> => !!i && typeof i === "object");
}

export function sanitizarIndicadores(bruto: unknown): Indicador[] | undefined {
  const itens = comoObjetos(bruto)
    .map((o) => ({
      id: crypto.randomUUID(),
      nome: texto(o.nome) ?? "",
      meta: texto(o.meta) ?? "",
      meioVerificacao: texto(o.meioVerificacao),
      frequencia: texto(o.frequencia),
    }))
    .filter((i) => i.nome && i.meta);
  return itens.length > 0 ? itens : undefined;
}

export function sanitizarEquipe(bruto: unknown): EquipeMembro[] | undefined {
  const ctx = novoContexto();
  const itens = comoObjetos(bruto)
    .map((o) => ({
      id: crypto.randomUUID(),
      nome: texto(o.nome) ?? "",
      formacaoNecessaria: texto(o.formacaoNecessaria),
      horasSemanais: parsearNumero(o.horasSemanais, "horas semanais", ctx),
      duracaoMeses: parsearNumero(o.duracaoMeses, "duração (meses)", ctx),
      planoTrabalho: texto(o.planoTrabalho),
    }))
    .filter((m) => m.nome);
  return itens.length > 0 ? itens : undefined;
}

export function sanitizarOrcamento(bruto: unknown, ctx: ContextoSanitizacao): BudgetLine[] | undefined {
  const itens: BudgetLine[] = [];
  for (const o of comoObjetos(bruto)) {
    const descricao = texto(o.descricao) ?? texto(o.item) ?? "";
    const valor = parsearNumero(o.valor ?? o.custo ?? o.total, `orçamento — ${descricao || "linha sem descrição"}`, ctx);
    if (!descricao && valor === undefined) continue;
    if (valor === undefined) {
      ctx.avisos.push(`Linha de orçamento "${descricao}" veio sem valor — entrou com R$ 0,00 para você preencher.`);
    }
    itens.push({
      id: crypto.randomUUID(),
      categoria: resolverCategoria(o.categoria, ctx),
      descricao: descricao || "(sem descrição)",
      valor: valor ?? 0,
      prazoMeses: parsearNumero(o.prazoMeses, "prazo (meses)", ctx),
      fonteCusteioFuturo: texto(o.fonteCusteioFuturo),
      justificativaCicloProdutivo: texto(o.justificativaCicloProdutivo),
      anuenciaEntePublico: parsearBooleano(o.anuenciaEntePublico),
      vidaUtilAnos: parsearNumero(o.vidaUtilAnos, "vida útil (anos)", ctx),
    });
  }
  return itens.length > 0 ? itens : undefined;
}

export function sanitizarRiscos(bruto: unknown): RiskItem[] | undefined {
  const itens = comoObjetos(bruto)
    .map((o) => ({
      id: crypto.randomUUID(),
      descricao: texto(o.descricao) ?? texto(o.risco) ?? "",
      probabilidade: resolverNivelRisco(o.probabilidade),
      impacto: resolverNivelRisco(o.impacto),
      mitigacao: texto(o.mitigacao) ?? "",
    }))
    .filter((r) => r.descricao);
  return itens.length > 0 ? itens : undefined;
}

export function sanitizarProducao(bruto: unknown, ctx: ContextoSanitizacao): ProducaoItem[] | undefined {
  const itens = comoObjetos(bruto)
    .map((o) => ({
      id: crypto.randomUUID(),
      item: texto(o.item) ?? texto(o.produto) ?? texto(o.descricao) ?? "",
      quantidade: parsearNumero(o.quantidade, "quantidade produzida", ctx),
      unidade: texto(o.unidade),
      periodicidade: texto(o.periodicidade),
      observacoes: texto(o.observacoes),
    }))
    .filter((p) => p.item);
  return itens.length > 0 ? itens : undefined;
}

export function sanitizarItensNecessarios(bruto: unknown, ctx: ContextoSanitizacao): ItemNecessario[] | undefined {
  const itens = comoObjetos(bruto)
    .map((o) => ({
      id: crypto.randomUUID(),
      descricao: texto(o.descricao) ?? texto(o.item) ?? "",
      quantidade: parsearNumero(o.quantidade, "quantidade de item necessário", ctx),
      unidade: texto(o.unidade),
      jaPossui: parsearBooleano(o.jaPossui),
      observacoes: texto(o.observacoes),
    }))
    .filter((i) => i.descricao);
  return itens.length > 0 ? itens : undefined;
}

export function sanitizarCustosNaoCobertos(bruto: unknown, ctx: ContextoSanitizacao): CustoNaoCobertoItem[] | undefined {
  const itens = comoObjetos(bruto)
    .map((o) => ({
      id: crypto.randomUUID(),
      nome: texto(o.nome) ?? texto(o.descricao) ?? "",
      valorMensalEstimado: parsearNumero(o.valorMensalEstimado ?? o.valor, "custo mensal não coberto", ctx) ?? 0,
      fonteCusteioFuturo: texto(o.fonteCusteioFuturo),
    }))
    .filter((c) => c.nome);
  return itens.length > 0 ? itens : undefined;
}

/**
 * Converte a resposta bruta (JSON da IA ou linha de planilha já mapeada) em
 * `DadosImportacao`. Tudo que não passa na validação vira aviso, nunca dado
 * inventado.
 */
export function sanitizarDadosImportacao(bruto: Record<string, unknown>, ctx: ContextoSanitizacao): DadosImportacao {
  const contatoBruto = (bruto.contato && typeof bruto.contato === "object" ? bruto.contato : {}) as Record<string, unknown>;
  const espacoBruto = (bruto.espacoLogistica && typeof bruto.espacoLogistica === "object" ? bruto.espacoLogistica : {}) as Record<string, unknown>;
  const posBruto = (bruto.posCompleto && typeof bruto.posCompleto === "object" ? bruto.posCompleto : {}) as Record<string, unknown>;

  const contato: Contato = {
    coordenador: texto(contatoBruto.coordenador),
    telefone: texto(contatoBruto.telefone),
    endereco: texto(contatoBruto.endereco),
    email: texto(contatoBruto.email),
  };
  const espacoLogistica: EspacoLogistica = {
    areaM2: parsearNumero(espacoBruto.areaM2, "área (m²)", ctx),
    tipoEspaco: texto(espacoBruto.tipoEspaco),
    distanciaFornecedoresKm: parsearNumero(espacoBruto.distanciaFornecedoresKm, "distância até fornecedores (km)", ctx),
    observacoes: texto(espacoBruto.observacoes),
  };
  const posCompleto: PosCompleto = {
    responsavelOperacao: texto(posBruto.responsavelOperacao),
    fonteCusteioFuturoGeral: texto(posBruto.fonteCusteioFuturoGeral),
    metodologiaTransicao: texto(posBruto.metodologiaTransicao),
    indicadoresAutonomia: texto(posBruto.indicadoresAutonomia),
  };

  const temAlgum = (o: object) => Object.values(o).some((v) => v !== undefined);

  return {
    titulo: texto(bruto.titulo),
    danoId: resolverDanoId(bruto.danoId, ctx),
    arquetipoId: resolverArquetipoId(bruto.arquetipoId, ctx),
    setorId: resolverSetorId(bruto.setorId, ctx),
    objetivo: texto(bruto.objetivo),
    objetivosEspecificos: listaDeTextos(bruto.objetivosEspecificos),
    justificativa: texto(bruto.justificativa),
    metas: listaDeTextos(bruto.metas),
    indicadores: sanitizarIndicadores(bruto.indicadores),
    boasPraticas: listaDeTextos(bruto.boasPraticas),
    comoComunidadeAjuda: texto(bruto.comoComunidadeAjuda),
    missaoImpacto: texto(bruto.missaoImpacto),
    equipe: sanitizarEquipe(bruto.equipe),
    local: texto(bruto.local),
    municipioId: resolverMunicipioId(bruto.municipioId ?? bruto.municipio, ctx),
    abrangencia: resolverAbrangencia(bruto.abrangencia, ctx),
    publicoAlvo: texto(bruto.publicoAlvo),
    pessoasAtendidasDiretas: parsearNumero(bruto.pessoasAtendidasDiretas, "pessoas atendidas (diretas)", ctx),
    pessoasAtendidasIndiretas: parsearNumero(bruto.pessoasAtendidasIndiretas, "pessoas atendidas (indiretas)", ctx),
    orcamento: sanitizarOrcamento(bruto.orcamento, ctx),
    producaoEstimada: sanitizarProducao(bruto.producaoEstimada, ctx),
    itensNecessarios: sanitizarItensNecessarios(bruto.itensNecessarios, ctx),
    cronograma: texto(bruto.cronograma),
    formasArrecadacao: listaDeTextos(bruto.formasArrecadacao),
    custosNaoCobertos: sanitizarCustosNaoCobertos(bruto.custosNaoCobertos, ctx),
    riscos: sanitizarRiscos(bruto.riscos),
    espacoLogistica: temAlgum(espacoLogistica) ? espacoLogistica : undefined,
    contato: temAlgum(contato) ? contato : undefined,
    posCompleto: temAlgum(posCompleto) ? posCompleto : undefined,
    coordenacaoFeminina: parsearBooleano(bruto.coordenacaoFeminina),
  };
}

/** Rótulos legíveis dos campos — usados na prévia da importação ("o que foi preenchido"). */
export const ROTULOS_CAMPO: Record<keyof DadosImportacao, string> = {
  titulo: "Título",
  danoId: "Dano vinculado",
  arquetipoId: "Categoria (arquétipo)",
  setorId: "Setor / público prioritário",
  objetivo: "Objetivo geral",
  objetivosEspecificos: "Objetivos específicos",
  justificativa: "Justificativa",
  metas: "Metas",
  indicadores: "Indicadores",
  boasPraticas: "Boas práticas",
  comoComunidadeAjuda: "Como a comunidade ajuda",
  missaoImpacto: "Missão e impacto",
  equipe: "Equipe",
  local: "Local",
  municipioId: "Município",
  abrangencia: "Abrangência",
  publicoAlvo: "Público-alvo",
  pessoasAtendidasDiretas: "Pessoas atendidas (diretas)",
  pessoasAtendidasIndiretas: "Pessoas atendidas (indiretas)",
  orcamento: "Orçamento",
  producaoEstimada: "Expectativa de produção",
  itensNecessarios: "Itens necessários",
  cronograma: "Cronograma",
  formasArrecadacao: "Formas de arrecadação",
  custosNaoCobertos: "Custos não cobertos",
  riscos: "Riscos",
  espacoLogistica: "Espaço e logística",
  contato: "Contato",
  posCompleto: "POS completo",
  coordenacaoFeminina: "Coordenação feminina",
};

/** Lista os campos efetivamente preenchidos, já com rótulo — alimenta a prévia. */
export function camposPreenchidos(dados: DadosImportacao): string[] {
  const preenchidos: string[] = [];
  for (const [chave, valor] of Object.entries(dados)) {
    if (valor === undefined || valor === null) continue;
    if (Array.isArray(valor) && valor.length === 0) continue;
    if (typeof valor === "string" && valor.trim() === "") continue;
    const rotulo = ROTULOS_CAMPO[chave as keyof DadosImportacao];
    if (rotulo) preenchidos.push(rotulo);
  }
  return preenchidos;
}

/**
 * Aplica os dados extraídos sobre um projeto. Só sobrescreve o que veio
 * preenchido — campos ausentes preservam o que já estava lá.
 */
export function aplicarImportacaoAoProjeto(project: Project, dados: DadosImportacao): Project {
  const abrangencia = dados.abrangencia ?? project.abrangencia;
  return {
    ...project,
    titulo: dados.titulo ?? project.titulo,
    tituloEditadoManualmente: dados.titulo ? true : project.tituloEditadoManualmente,
    danoId: dados.danoId ?? project.danoId,
    arquetipoId: dados.arquetipoId ?? project.arquetipoId,
    setorId: dados.setorId ?? project.setorId,
    objetivo: dados.objetivo ?? project.objetivo,
    objetivosEspecificos: dados.objetivosEspecificos ?? project.objetivosEspecificos,
    justificativa: dados.justificativa ?? project.justificativa,
    metas: dados.metas ?? project.metas,
    indicadores: dados.indicadores ?? project.indicadores,
    boasPraticas: dados.boasPraticas ?? project.boasPraticas,
    comoComunidadeAjuda: dados.comoComunidadeAjuda ?? project.comoComunidadeAjuda,
    missaoImpacto: dados.missaoImpacto ?? project.missaoImpacto,
    equipe: dados.equipe ?? project.equipe,
    local: dados.local ?? project.local,
    municipioId: dados.municipioId ?? project.municipioId,
    abrangencia,
    // O porte (e portanto o teto) é derivado da abrangência — nunca vem do documento.
    tetoPorte: project.tetoPorte,
    publicoAlvo: dados.publicoAlvo ?? project.publicoAlvo,
    pessoasAtendidasDiretas: dados.pessoasAtendidasDiretas ?? project.pessoasAtendidasDiretas,
    pessoasAtendidasIndiretas: dados.pessoasAtendidasIndiretas ?? project.pessoasAtendidasIndiretas,
    orcamento: dados.orcamento ?? project.orcamento,
    producaoEstimada: dados.producaoEstimada ?? project.producaoEstimada,
    itensNecessarios: dados.itensNecessarios ?? project.itensNecessarios,
    cronograma: dados.cronograma ?? project.cronograma,
    formasArrecadacao: dados.formasArrecadacao ?? project.formasArrecadacao,
    custosNaoCobertos: dados.custosNaoCobertos ?? project.custosNaoCobertos,
    riscos: dados.riscos ?? project.riscos,
    // `semUndefined` é obrigatório aqui: espalhar um objeto com chaves undefined
    // apagaria o que o projeto já tinha preenchido nesses campos.
    espacoLogistica: dados.espacoLogistica ? { ...project.espacoLogistica, ...semUndefined(dados.espacoLogistica) } : project.espacoLogistica,
    contato: dados.contato ? { ...project.contato, ...semUndefined(dados.contato) } : project.contato,
    posCompleto: dados.posCompleto ? { ...project.posCompleto, ...semUndefined(dados.posCompleto) } : project.posCompleto,
    coordenacaoFeminina: dados.coordenacaoFeminina ?? project.coordenacaoFeminina,
  };
}

/** Porte declarado a partir da abrangência — usado na prévia e na planilha. */
export function porteDe(project: Project) {
  return PORTE_POR_ABRANGENCIA[project.abrangencia];
}
