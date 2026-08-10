/**
 * Cotação de preços a partir dos sistemas públicos de compras.
 *
 * Princípio (o mesmo do `compliance-engine`): a cesta de preços é **determinística**.
 * Quem calcula o valor sugerido é este módulo, a partir de preços que órgãos públicos
 * realmente pagaram — a IA não entra na conta. IA, se usada, só ajuda a escolher o
 * termo de busca; o número vem do dado.
 *
 * Duas fontes, com papéis diferentes (ambas verificadas contra a API real):
 *
 * | Fonte | O que traz | Cobertura | CORS |
 * |---|---|---|---|
 * | Compras.gov.br (`modulo-pesquisa-preco`) | preço **homologado** (o que foi de fato pago) | federal + municípios que usam o sistema federal — **não tem o governo de MG** | não |
 * | PNCP (Lei 14.133/2021) | preço **estimado** do edital; o homologado exige uma 2ª chamada | tudo, inclusive governo de MG e municípios | sim (`*`) |
 *
 * Por isso as duas coexistem: o Compras.gov.br dá o dado de melhor qualidade, mas é cego
 * para o estado de Minas; o PNCP cobre Minas mas o valor de primeira mão é estimativa.
 */

import { MUNICIPIOS_PARAOPEBA } from "./geografia";

/** Origem de um preço observado — vira rastro de auditoria na cesta. */
export type FontePreco = "compras-gov-homologado" | "pncp-homologado" | "pncp-estimado";

/** Fontes cujo preço é o que foi de fato pago. `pncp-estimado` é só a previsão do edital. */
export const FONTES_HOMOLOGADAS: readonly FontePreco[] = ["compras-gov-homologado", "pncp-homologado"];

export interface PrecoObservado {
  fonte: FontePreco;
  precoUnitario: number;
  descricao: string;
  /** Sigla da unidade de fornecimento (UN, CX, KG…). Misturar unidades é o erro mais caro aqui — ver `agruparPorUnidade`. */
  unidade: string;
  quantidade: number;
  /** ISO `YYYY-MM-DD`. */
  data: string;
  orgao: string;
  /** F = federal, E = estadual, M = municipal. */
  esfera: string;
  uf: string;
  municipio: string;
  fornecedor?: string;
  cnpjFornecedor?: string;
  marca?: string;
  /** Link para a compra no portal público, quando reconstruível. */
  url?: string;
}

export type CriterioValor = "mediana" | "media" | "menor-preco";

/** Quão perto do território atingido veio o preço — governa a preferência regional. */
export type Abrangencia = "paraopeba" | "mg" | "brasil";

export interface EstatisticaCesta {
  n: number;
  minimo: number;
  mediana: number;
  media: number;
  maximo: number;
  desvioPadrao: number;
  /** Desvio padrão / média. Acima de 0,25 o TCU costuma exigir justificativa. */
  coeficienteVariacao: number;
}

export interface Descarte {
  observacao: PrecoObservado;
  motivo: string;
}

export interface CestaPrecos {
  termoConsultado: string;
  unidade: string;
  usadas: PrecoObservado[];
  /**
   * Preços tirados da cesta por **problema de qualidade** (sem preço, unidade incompatível, atípico).
   * Estreitamento regional não entra aqui — ver `foraDoRecorte`.
   */
  descartadas: Descarte[];
  /**
   * Preços válidos que ficaram de fora só por serem de outra região.
   *
   * Separado de `descartadas` de propósito: numa consulta nacional é comum 300 preços virarem
   * 12 ao focar na bacia, e apresentar isso como "288 descartados" faz parecer que o dado é
   * ruim, quando o que houve foi aproximação do território do projeto.
   */
  foraDoRecorte: PrecoObservado[];
  estatistica: EstatisticaCesta;
  valorSugerido: number;
  criterio: CriterioValor;
  abrangencia: Abrangencia;
  /** IN SEGES 65/2021 pede no mínimo 3 preços para a cesta ser defensável. */
  suficiente: boolean;
  alertas: string[];
}

const MINIMO_DEFENSAVEL = 3;
/** Abaixo disso a cerca de Tukey é instável e descartaria preço legítimo. */
const MINIMO_PARA_FILTRAR_ATIPICOS = 5;
const CV_ACEITAVEL = 0.25;
const MESES_ATE_ENVELHECER = 12;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const NOMES_PARAOPEBA = new Set(MUNICIPIOS_PARAOPEBA.map((m) => normalizar(m.nome)));

/**
 * Um preço é "do Paraopeba" só se for de MG **e** de um dos 26 municípios da bacia.
 * A checagem de UF vem primeiro de propósito: casar município só pelo nome pega
 * cidade homônima de outro estado (há Betim/Brumadinho fora de Minas em bases públicas).
 */
export function ehDoParaopeba(obs: { uf: string; municipio: string }): boolean {
  return obs.uf?.toUpperCase() === "MG" && NOMES_PARAOPEBA.has(normalizar(obs.municipio ?? ""));
}

/** Quantil por interpolação linear, sobre um vetor já ordenado. */
function quantil(ordenados: number[], p: number): number {
  if (ordenados.length === 0) return 0;
  if (ordenados.length === 1) return ordenados[0];
  const pos = (ordenados.length - 1) * p;
  const base = Math.floor(pos);
  const resto = pos - base;
  const proximo = ordenados[base + 1];
  return proximo === undefined ? ordenados[base] : ordenados[base] + resto * (proximo - ordenados[base]);
}

export function mediana(valores: number[]): number {
  return quantil([...valores].sort((a, b) => a - b), 0.5);
}

/**
 * Separa preços atípicos pela cerca de Tukey (1,5 × IQR).
 *
 * É o equivalente operacional do que a IN SEGES 65/2021 (art. 6º) chama de excluir
 * preços "inexequíveis ou excessivamente elevados": a regra é fixa e o descarte fica
 * registrado com motivo, então a exclusão é auditável em vez de discricionária.
 */
export function separarAtipicos(observacoes: PrecoObservado[]): { mantidas: PrecoObservado[]; descartadas: Descarte[] } {
  if (observacoes.length < MINIMO_PARA_FILTRAR_ATIPICOS) {
    return { mantidas: [...observacoes], descartadas: [] };
  }
  const ordenados = observacoes.map((o) => o.precoUnitario).sort((a, b) => a - b);
  const q1 = quantil(ordenados, 0.25);
  const q3 = quantil(ordenados, 0.75);
  const iqr = q3 - q1;
  const piso = q1 - 1.5 * iqr;
  const teto = q3 + 1.5 * iqr;

  const mantidas: PrecoObservado[] = [];
  const descartadas: Descarte[] = [];
  for (const obs of observacoes) {
    if (obs.precoUnitario < piso) {
      descartadas.push({ observacao: obs, motivo: `preço muito abaixo dos demais (abaixo de ${formatarReal(piso)}) — possível item diferente ou lote atípico` });
    } else if (obs.precoUnitario > teto) {
      descartadas.push({ observacao: obs, motivo: `preço muito acima dos demais (acima de ${formatarReal(teto)}) — possível item diferente ou compra atípica` });
    } else {
      mantidas.push(obs);
    }
  }
  return { mantidas, descartadas };
}

export function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Agrupa por unidade de fornecimento e devolve o maior grupo.
 *
 * Sem isso a cesta soma laranja com caixa de laranja: a API devolve `UN`, `CX`, `KG`,
 * `FD` para o mesmo item de catálogo, e a mediana de unidades misturadas não significa nada.
 */
export function agruparPorUnidade(observacoes: PrecoObservado[]): { unidade: string; observacoes: PrecoObservado[]; outrasUnidades: Descarte[] } {
  const grupos = new Map<string, PrecoObservado[]>();
  for (const obs of observacoes) {
    const chave = (obs.unidade || "?").toUpperCase();
    const atual = grupos.get(chave);
    if (atual) atual.push(obs);
    else grupos.set(chave, [obs]);
  }
  let melhorUnidade = "";
  let melhor: PrecoObservado[] = [];
  for (const [unidade, lista] of grupos) {
    if (lista.length > melhor.length) {
      melhor = lista;
      melhorUnidade = unidade;
    }
  }
  const outrasUnidades: Descarte[] = [];
  for (const [unidade, lista] of grupos) {
    if (unidade === melhorUnidade) continue;
    for (const obs of lista) {
      outrasUnidades.push({ observacao: obs, motivo: `unidade de fornecimento diferente (${unidade}, a cesta é em ${melhorUnidade})` });
    }
  }
  return { unidade: melhorUnidade, observacoes: melhor, outrasUnidades };
}

/**
 * Tira preços repetidos.
 *
 * A mesma compra chega mais de uma vez (a busca do PNCP devolve documentos distintos apontando
 * para ela, e o mesmo item pode ser publicado em lotes). Duplicata não é preço a mais: dá peso
 * dobrado a uma compra só e desloca a mediana para o valor dela — pior ainda porque parece
 * confirmação independente, que é justamente o que a cesta deveria medir.
 */
export function removerDuplicados(observacoes: PrecoObservado[]): { mantidas: PrecoObservado[]; descartadas: Descarte[] } {
  const vistas = new Set<string>();
  const mantidas: PrecoObservado[] = [];
  const descartadas: Descarte[] = [];
  for (const obs of observacoes) {
    const chave = [obs.fonte, obs.orgao, obs.data, obs.precoUnitario, obs.unidade, obs.descricao].join("|").toLowerCase();
    if (vistas.has(chave)) {
      descartadas.push({ observacao: obs, motivo: "repetido — mesma compra já contada na cesta" });
      continue;
    }
    vistas.add(chave);
    mantidas.push(obs);
  }
  return { mantidas, descartadas };
}

/**
 * Preço homologado expulsa preço estimado da cesta.
 *
 * O estimado do edital é o teto que o órgão calculou antes do pregão, não o que se pagou —
 * costuma ficar acima do resultado. Misturar os dois puxa a mediana para cima em silêncio, e
 * a cesta passa a justificar um valor que ninguém pagou. Só quando não há nenhum homologado é
 * que o estimado serve, e aí o alerta diz isso na cara.
 */
export function preferirHomologados(observacoes: PrecoObservado[]): { mantidas: PrecoObservado[]; descartadas: Descarte[] } {
  const homologadas = observacoes.filter((o) => FONTES_HOMOLOGADAS.includes(o.fonte));
  if (homologadas.length === 0) return { mantidas: [...observacoes], descartadas: [] };
  return {
    mantidas: homologadas,
    descartadas: observacoes
      .filter((o) => !FONTES_HOMOLOGADAS.includes(o.fonte))
      .map((observacao) => ({ observacao, motivo: "valor estimado do edital, e a cesta já tem preço efetivamente homologado" })),
  };
}

function mesesDesde(dataIso: string, referencia: Date): number {
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return 0;
  return (referencia.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

/**
 * Escolhe a abrangência mais próxima do território atingido que ainda tenha preços suficientes.
 *
 * A ordem importa: preço de Brumadinho vale mais que preço de Manaus para um projeto de
 * Brumadinho (frete, disponibilidade e realidade de mercado local), mas cesta de 1 preço
 * local é pior que cesta de 12 preços de MG — por isso só desce de nível quando o nível
 * mais próximo não alcança o mínimo defensável.
 */
export function escolherAbrangencia(observacoes: PrecoObservado[]): { abrangencia: Abrangencia; selecionadas: PrecoObservado[] } {
  const paraopeba = observacoes.filter(ehDoParaopeba);
  if (paraopeba.length >= MINIMO_DEFENSAVEL) return { abrangencia: "paraopeba", selecionadas: paraopeba };
  const mg = observacoes.filter((o) => o.uf?.toUpperCase() === "MG");
  if (mg.length >= MINIMO_DEFENSAVEL) return { abrangencia: "mg", selecionadas: mg };
  return { abrangencia: "brasil", selecionadas: [...observacoes] };
}

export interface OpcoesCesta {
  criterio?: CriterioValor;
  /** Injetável para o teste não depender do relógio. */
  referenciaTemporal?: Date;
}

/**
 * Monta a cesta de preços a partir das observações brutas.
 *
 * Ordem das etapas — cada uma existe por um motivo, e trocar a ordem muda o número:
 * 1. unidade de fornecimento dominante (senão soma-se coisa incomparável);
 * 2. recorte regional mais próximo que ainda seja defensável;
 * 3. descarte de atípicos (só com amostra grande o bastante);
 * 4. estatística e valor sugerido.
 */
export function montarCesta(termoConsultado: string, brutas: PrecoObservado[], opcoes: OpcoesCesta = {}): CestaPrecos {
  const criterio = opcoes.criterio ?? "mediana";
  const referencia = opcoes.referenciaTemporal ?? new Date();
  const descartadas: Descarte[] = [];

  const semPrecoValido = brutas.filter((o) => !(o.precoUnitario > 0));
  for (const obs of semPrecoValido) descartadas.push({ observacao: obs, motivo: "preço unitário ausente ou zerado" });
  const validas = brutas.filter((o) => o.precoUnitario > 0);

  const unicas = removerDuplicados(validas);
  descartadas.push(...unicas.descartadas);

  const qualidade = preferirHomologados(unicas.mantidas);
  descartadas.push(...qualidade.descartadas);

  const porUnidade = agruparPorUnidade(qualidade.mantidas);
  descartadas.push(...porUnidade.outrasUnidades);

  const regional = escolherAbrangencia(porUnidade.observacoes);
  const selecionadas = new Set(regional.selecionadas);
  const foraDoRecorte = porUnidade.observacoes.filter((obs) => !selecionadas.has(obs));

  const atipicos = separarAtipicos(regional.selecionadas);
  descartadas.push(...atipicos.descartadas);

  const usadas = [...atipicos.mantidas].sort((a, b) => a.precoUnitario - b.precoUnitario);
  const valores = usadas.map((o) => o.precoUnitario);
  const n = valores.length;
  const media = n > 0 ? valores.reduce((s, v) => s + v, 0) / n : 0;
  const variancia = n > 0 ? valores.reduce((s, v) => s + (v - media) ** 2, 0) / n : 0;
  const desvioPadrao = Math.sqrt(variancia);
  const med = mediana(valores);

  const estatistica: EstatisticaCesta = {
    n,
    minimo: n > 0 ? valores[0] : 0,
    mediana: med,
    media,
    maximo: n > 0 ? valores[n - 1] : 0,
    desvioPadrao,
    coeficienteVariacao: media > 0 ? desvioPadrao / media : 0,
  };

  const valorSugerido = criterio === "media" ? media : criterio === "menor-preco" ? estatistica.minimo : med;

  const alertas: string[] = [];
  if (n === 0) {
    alertas.push("Nenhum preço público encontrado para este termo. Refine a descrição ou peça cotação direta a fornecedores.");
  } else if (n < MINIMO_DEFENSAVEL) {
    alertas.push(`Só ${n} preço(s) encontrado(s). O mínimo recomendado é ${MINIMO_DEFENSAVEL} — complete com cotação direta de fornecedor antes de fechar o orçamento.`);
  }
  if (n >= MINIMO_DEFENSAVEL && estatistica.coeficienteVariacao > CV_ACEITAVEL) {
    alertas.push(`Os preços variam muito entre si (${Math.round(estatistica.coeficienteVariacao * 100)}%). Provavelmente não são o mesmo produto — confira as descrições antes de usar o valor.`);
  }
  const orgaosDistintos = new Set(usadas.map((o) => o.orgao)).size;
  if (n >= MINIMO_DEFENSAVEL && orgaosDistintos === 1) {
    alertas.push("Todos os preços vieram do mesmo órgão. Uma cesta de fonte única é frágil — busque preço de outro comprador.");
  }
  const antigas = usadas.filter((o) => mesesDesde(o.data, referencia) > MESES_ATE_ENVELHECER).length;
  if (antigas > 0 && antigas === n) {
    alertas.push(`Todos os preços têm mais de ${MESES_ATE_ENVELHECER} meses. Preço velho subestima o custo de hoje — atualize antes de usar.`);
  }
  if (n > 0 && usadas.every((o) => o.fonte === "pncp-estimado")) {
    alertas.push("Esta cesta usa valores estimados em edital, não preços efetivamente pagos. O estimado costuma ser o teto do órgão — trate como limite superior, não como preço de mercado.");
  }
  if (regional.abrangencia === "brasil" && n > 0) {
    alertas.push("Não havia preços suficientes em Minas Gerais; a cesta usa o Brasil inteiro. O frete até a bacia do Paraopeba pode não estar refletido.");
  }

  return {
    termoConsultado,
    unidade: porUnidade.unidade,
    usadas,
    descartadas,
    foraDoRecorte,
    estatistica,
    valorSugerido,
    criterio,
    abrangencia: regional.abrangencia,
    suficiente: n >= MINIMO_DEFENSAVEL,
    alertas,
  };
}
