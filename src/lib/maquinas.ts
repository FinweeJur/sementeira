/**
 * Pesquisa de máquinas e equipamentos que automatizam ou aumentam a produtividade do projeto.
 *
 * Complementa a cotação em compras públicas (`precos-publicos.ts`): o preço homologado serve
 * para o que o poder público costuma comprar, mas máquina de produção — despolpadeira, forno
 * rotativo, seladora, máquina de costura reta industrial — muitas vezes não está lá, ou está
 * numa configuração que não é a do projeto. Aí a referência tem que vir do mercado.
 *
 * O módulo faz duas coisas que uma busca solta não faz:
 *
 * 1. **Separa mercado interno de importação.** Preço de Alibaba não é preço de compra: chega
 *    no Brasil com imposto, frete e despacho, e o multiplicador não é pequeno (ver
 *    `estimarCustoImportacao`). Comparar FOB chinês com preço brasileiro lado a lado, sem
 *    conta, é o erro clássico — e num projeto de reparação ele vira orçamento furado.
 *
 * 2. **Levanta as barreiras não financeiras.** Numa associação comunitária a máquina mais
 *    barata frequentemente é a que não pode ser usada: sem NR-12 não se coloca trabalhador
 *    junto, sem representante no Brasil não há peça de reposição, e importar exige habilitação
 *    que a associação normalmente não tem. Isso entra como alerta junto do preço.
 */

import type { ResultadoBusca } from "./websearch";

/** Onde procurar. Cada origem tem um significado diferente para o orçamento. */
export type OrigemMercado = "brasil" | "china" | "aberta";

export interface ConsultaMaquina {
  /** O que a máquina precisa fazer, na língua do projeto: "despolpar fruta", "costurar uniforme". */
  necessidade: string;
  /** Capacidade desejada, quando o projeto já sabe (ex.: "100 kg/h"). */
  capacidade?: string;
  origens?: OrigemMercado[];
}

/**
 * Sites por origem. Não são URLs consultadas direto — entram como `site:` na busca, para o
 * resultado cair em vitrine real de fornecedor em vez de blog e marketplace de afiliado.
 */
const SITES: Record<OrigemMercado, string[]> = {
  brasil: ["mercadolivre.com.br", "olx.com.br", "amazon.com.br", "magazineluiza.com.br", "americanas.com.br", "agrolink.com.br"],
  china: ["alibaba.com", "made-in-china.com", "aliexpress.com", "globalsources.com", "1688.com"],
  aberta: [],
};

/**
 * Monta as buscas que vão para a Tavily.
 *
 * Uma consulta por origem, em vez de uma só: a busca em português com `site:alibaba.com`
 * devolve quase nada, porque o catálogo chinês é indexado em inglês. Então a consulta de
 * importação vai em inglês e as demais em português.
 */
export function montarConsultasMaquina(consulta: ConsultaMaquina): { origem: OrigemMercado; query: string }[] {
  const origens = consulta.origens?.length ? consulta.origens : (["brasil", "china", "aberta"] as OrigemMercado[]);
  const capacidade = consulta.capacidade ? ` ${consulta.capacidade}` : "";

  return origens.map((origem) => {
    const sites = SITES[origem];
    const filtro = sites.length > 0 ? ` (${sites.map((s) => `site:${s}`).join(" OR ")})` : "";
    const base =
      origem === "china"
        ? `${consulta.necessidade}${capacidade} machine price FOB`
        : origem === "brasil"
          ? `máquina ${consulta.necessidade}${capacidade} preço comprar industrial`
          : `máquina ${consulta.necessidade}${capacidade} preço fabricante brasil assistência técnica`;
    return { origem, query: `${base}${filtro}` };
  });
}

export interface FaixaCusto {
  minimo: number;
  maximo: number;
}

/** Alíquotas usadas na estimativa. Todas ajustáveis: variam por NCM e por estado. */
export interface ParametrosImportacao {
  /** Imposto de Importação. Máquinas (capítulo 84) ficam em geral entre 12,6% e 14%. */
  ii?: number;
  /** IPI — muita máquina industrial é 0%, algumas chegam a ~10%. */
  ipi?: number;
  pis?: number;
  cofins?: number;
  /** ICMS do estado de destino. Minas Gerais: 18%. */
  icms?: number;
  /** Frete + seguro internacional, como fração do FOB. */
  freteSeguro?: number;
  /** Despachante, armazenagem, taxa Siscomex, frete interno — como fração do valor aduaneiro. */
  despesasOperacionais?: number;
}

const PADRAO: Required<ParametrosImportacao> = {
  ii: 0.126,
  ipi: 0.0,
  pis: 0.021,
  cofins: 0.1065,
  icms: 0.18,
  freteSeguro: 0.25,
  despesasOperacionais: 0.08,
};

export interface CustoImportacao {
  fobBrl: number;
  valorAduaneiro: number;
  ii: number;
  ipi: number;
  pis: number;
  cofins: number;
  icms: number;
  despesasOperacionais: number;
  total: number;
  /** Quantas vezes o preço de vitrine. É o número que interessa na hora de comparar. */
  multiplicador: number;
}

/**
 * Estima quanto uma máquina anunciada em dólar custa **posta no Brasil**.
 *
 * O ICMS é calculado "por dentro" (entra na própria base), que é como a lei manda e é a parte
 * que mais surpreende quem soma as alíquotas na mão: somando 12,6 + 10,65 + 2,1 + 18 dá ~43%,
 * mas o efeito real passa de 60% porque cada tributo entra na base do seguinte.
 *
 * É estimativa de ordem de grandeza, não cálculo aduaneiro: a alíquota real depende do NCM
 * exato, e há regimes (ex-tarifário, Simples) que mudam o resultado.
 */
export function estimarCustoImportacao(precoFobUsd: number, cotacaoDolar: number, parametros: ParametrosImportacao = {}): CustoImportacao {
  const p = { ...PADRAO, ...parametros };
  const fobBrl = precoFobUsd * cotacaoDolar;
  const valorAduaneiro = fobBrl * (1 + p.freteSeguro);

  const ii = valorAduaneiro * p.ii;
  const ipi = (valorAduaneiro + ii) * p.ipi;
  const pis = valorAduaneiro * p.pis;
  const cofins = valorAduaneiro * p.cofins;
  const despesasOperacionais = valorAduaneiro * p.despesasOperacionais;

  // ICMS por dentro: a base inclui o próprio imposto, então divide-se por (1 - alíquota).
  const baseSemIcms = valorAduaneiro + ii + ipi + pis + cofins + despesasOperacionais;
  const icms = p.icms > 0 && p.icms < 1 ? (baseSemIcms / (1 - p.icms)) * p.icms : 0;

  const total = baseSemIcms + icms;
  return {
    fobBrl,
    valorAduaneiro,
    ii,
    ipi,
    pis,
    cofins,
    icms,
    despesasOperacionais,
    total,
    multiplicador: fobBrl > 0 ? total / fobBrl : 0,
  };
}

/**
 * Alertas que não são sobre preço, e que costumam decidir a compra num projeto comunitário.
 *
 * Vêm sempre, e não como conselho genérico: cada um corresponde a uma forma concreta de a
 * máquina comprada não poder ser usada, o que num projeto de reparação significa dinheiro
 * gasto que não vira atividade — e prestação de contas para explicar.
 */
export function alertasDeAquisicao(origem: OrigemMercado): string[] {
  const comuns = [
    "Máquina com trabalhador junto precisa atender a NR-12 (proteções, parada de emergência). Sem isso, a atividade não pode funcionar legalmente e o projeto pode ser embargado.",
    "Confirme a tensão disponível no local (110/220 V, monofásico ou trifásico). Máquina trifásica onde só há monofásico exige transformador ou troca de padrão de energia — custo que quase nunca está no anúncio.",
    "Pergunte por peça de reposição e assistência técnica mais próxima antes de fechar. Máquina parada esperando peça é a forma mais comum de a atividade morrer no primeiro ano.",
  ];
  if (origem === "china") {
    return [
      ...comuns,
      "O preço anunciado é FOB: não inclui imposto, frete nem despacho. Use a estimativa de custo posto no Brasil antes de comparar com fornecedor nacional.",
      "Importar direto exige habilitação no Radar/Siscomex, que associação comunitária normalmente não tem. Na prática, o caminho é comprar de importador ou representante no Brasil — o que muda o preço.",
      "Equipamento importado direto costuma vir sem certificação exigida aqui (INMETRO quando aplicável) e sem manual em português, o que atrapalha tanto a fiscalização quanto o treinamento de quem vai operar.",
    ];
  }
  if (origem === "brasil") {
    return [...comuns, "Preço de marketplace muda com frete e com o CEP de destino. Confirme o valor final para o município do projeto antes de lançar no orçamento."];
  }
  return comuns;
}

export interface PesquisaMaquinas {
  necessidade: string;
  porOrigem: { origem: OrigemMercado; query: string; resultados: ResultadoBusca[]; erro?: string }[];
  alertas: string[];
}

/**
 * Roda a pesquisa em todas as origens.
 *
 * `buscar` é injetado (em vez de importar `buscarWeb` direto) para o teste não depender de
 * rede nem de chave da Tavily, e para o chamador poder trocar a fonte de busca sem mexer aqui.
 */
export async function pesquisarMaquinas(consulta: ConsultaMaquina, buscar: (query: string) => Promise<{ ok: boolean; resultados?: ResultadoBusca[]; erro?: string }>): Promise<PesquisaMaquinas> {
  const consultas = montarConsultasMaquina(consulta);
  const porOrigem = await Promise.all(
    consultas.map(async ({ origem, query }) => {
      const resposta = await buscar(query);
      return { origem, query, resultados: resposta.resultados ?? [], erro: resposta.ok ? undefined : resposta.erro };
    }),
  );

  const origensConsultadas = new Set(porOrigem.map((o) => o.origem));
  const alertas = [...new Set(origensConsultadas.size > 0 ? [...origensConsultadas].flatMap(alertasDeAquisicao) : [])];

  return { necessidade: consulta.necessidade, porOrigem, alertas };
}
