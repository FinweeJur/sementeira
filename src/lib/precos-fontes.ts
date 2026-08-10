/**
 * Adaptadores das fontes públicas de preço → `PrecoObservado`.
 *
 * Transporte: o Compras.gov.br **não manda cabeçalho CORS** (verificado), então o navegador
 * não consegue chamá-lo direto. No app instalado a chamada sai do processo main via IPC; na
 * versão web ela passa pelo gateway `servidor/`. O PNCP manda `access-control-allow-origin: *`
 * e poderia ir direto do navegador, mas segue o mesmo caminho para ter um lugar só onde a
 * allowlist é aplicada.
 */

import type { FontePreco, PrecoObservado } from "./precos-publicos";

/**
 * Hosts que o app aceita consultar. Existe para o handler IPC não virar proxy aberto:
 * sem isso o renderer poderia mandar o processo main buscar `http://localhost:...` ou
 * endereço de rede interna, que é justamente o buraco que se abre quando o transporte
 * aceita URL arbitrária. Está repetida em `electron/main.cjs` e em `servidor/` de propósito —
 * cada processo precisa validar por conta, não confiar em quem chamou.
 */
export const HOSTS_PERMITIDOS = ["dadosabertos.compras.gov.br", "pncp.gov.br"] as const;

export function hostPermitido(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (HOSTS_PERMITIDOS as readonly string[]).includes(u.hostname);
  } catch {
    return false;
  }
}

export interface RespostaJsonPublico {
  ok: boolean;
  dados?: unknown;
  erro?: string;
}

const TIMEOUT_MS = 25_000;

async function obterJson(url: string): Promise<RespostaJsonPublico> {
  if (!hostPermitido(url)) return { ok: false, erro: "Endereço não permitido." };

  if (window.sementeira?.buscarJsonPublico) {
    return window.sementeira.buscarJsonPublico(url);
  }

  // Versão web: passa pelo gateway, que repete a checagem de allowlist do seu lado.
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`/api/precos?url=${encodeURIComponent(url)}`, { signal: controle.signal });
    if (!resp.ok) return { ok: false, erro: `A consulta de preços falhou (HTTP ${resp.status}).` };
    return { ok: true, dados: await resp.json() };
  } catch (erro) {
    const msg = erro instanceof Error && erro.name === "AbortError" ? "A consulta de preços demorou demais e foi cancelada." : "Não foi possível consultar os preços públicos. Verifique a conexão.";
    return { ok: false, erro: msg };
  } finally {
    clearTimeout(relogio);
  }
}

export interface OpcoesConsultaPreco {
  /** Sigla da UF. Sem isso a busca é nacional. */
  uf?: string;
  /** `YYYY-MM-DD`. */
  dataInicio?: string;
  dataFim?: string;
  maxRegistros?: number;
}

interface ItemPrecoComprasGov {
  precoUnitario: number | string;
  descricaoItem?: string;
  siglaUnidadeFornecimento?: string;
  quantidade?: number | string;
  dataCompra?: string;
  dataResultado?: string;
  nomeOrgao?: string;
  nomeUasg?: string;
  esfera?: string;
  estado?: string;
  municipio?: string;
  nomeFornecedor?: string;
  niFornecedor?: string;
  marca?: string;
  idCompra?: number | string;
}

function numero(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Preços homologados do Compras.gov.br para um PDM (família de item do CATMAT).
 *
 * A consulta é por **PDM**, não por código de item, de propósito: medido contra a API real,
 * consultar um `codigoItemCatalogo` específico quase sempre devolve lista vazia (aquele item
 * exato pode não ter sido comprado no período), enquanto o PDM agrega todas as variações do
 * mesmo produto e devolve cesta cheia. Buscar por item faz a função parecer quebrada.
 */
export async function buscarPrecosComprasGov(codigoPdm: number, opcoes: OpcoesConsultaPreco = {}): Promise<{ ok: boolean; observacoes: PrecoObservado[]; erro?: string }> {
  const max = opcoes.maxRegistros ?? 200;
  const params = new URLSearchParams({
    pagina: "1",
    tamanhoPagina: String(Math.min(500, Math.max(10, max))),
    tipo: "codigoPdm",
    codigo: String(codigoPdm),
  });
  if (opcoes.uf) params.set("estado", opcoes.uf.toUpperCase());
  if (opcoes.dataInicio) params.set("dataCompraInicio", opcoes.dataInicio);
  if (opcoes.dataFim) params.set("dataCompraFim", opcoes.dataFim);

  const resposta = await obterJson(`https://dadosabertos.compras.gov.br/modulo-pesquisa-preco/1_consultarMaterial?${params}`);
  if (!resposta.ok) return { ok: false, observacoes: [], erro: resposta.erro };

  const corpo = resposta.dados as { resultado?: ItemPrecoComprasGov[] } | undefined;
  const lista = Array.isArray(corpo?.resultado) ? corpo.resultado : [];
  const observacoes = lista.map((r): PrecoObservado => ({
    fonte: "compras-gov-homologado" as FontePreco,
    precoUnitario: numero(r.precoUnitario),
    descricao: (r.descricaoItem ?? "").trim(),
    unidade: (r.siglaUnidadeFornecimento ?? "UN").trim(),
    quantidade: numero(r.quantidade),
    data: (r.dataResultado || r.dataCompra || "").slice(0, 10),
    orgao: (r.nomeOrgao || r.nomeUasg || "").trim(),
    esfera: (r.esfera ?? "").trim(),
    uf: (r.estado ?? "").trim(),
    municipio: (r.municipio ?? "").trim(),
    fornecedor: (r.nomeFornecedor ?? "").trim() || undefined,
    cnpjFornecedor: (r.niFornecedor ?? "").trim() || undefined,
    marca: (r.marca ?? "").trim() || undefined,
    url: r.idCompra ? `https://compras.dados.gov.br/licitacoes/id/licitacao/${r.idCompra}` : undefined,
  }));

  return { ok: true, observacoes };
}

interface ItemPncp {
  numeroItem?: number;
  descricao?: string;
  valorUnitarioEstimado?: number | string;
  quantidade?: number | string;
  unidadeMedida?: string;
  materialOuServico?: string;
  /** Indica que já houve homologação — sem isso, só existe o valor estimado do edital. */
  temResultado?: boolean;
}

/**
 * Itens de uma contratação publicada no PNCP.
 *
 * O PNCP é o **único caminho para o governo de Minas**: medido, o Compras.gov.br só tem
 * compras federais e municipais — a esfera estadual não aparece lá. Em troca, o valor que
 * vem aqui de primeira mão é o **estimado do edital**, não o homologado; serve de referência
 * de ordem de grandeza, e por isso entra na cesta marcado como `pncp-estimado`.
 */
export async function buscarItensPncp(
  cnpjOrgao: string,
  ano: number,
  sequencial: number,
  contexto: ContextoCompraPncp,
): Promise<{ ok: boolean; itens: ItemPncp[]; erro?: string }> {
  const resposta = await obterJson(`https://pncp.gov.br/api/pncp/v1/orgaos/${encodeURIComponent(cnpjOrgao)}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=100`);
  if (!resposta.ok) return { ok: false, itens: [], erro: resposta.erro };
  void contexto;
  return { ok: true, itens: Array.isArray(resposta.dados) ? (resposta.dados as ItemPncp[]) : [] };
}

export interface ContextoCompraPncp {
  cnpj: string;
  ano: number;
  sequencial: number;
  orgao: string;
  uf: string;
  municipio: string;
  /** F / E / M — a esfera E (estadual) é o motivo de o PNCP existir aqui. */
  esfera: string;
  data: string;
}

interface ItemBuscaPncp {
  item_url?: string;
  orgao_cnpj?: string;
  orgao_nome?: string;
  uf?: string;
  municipio_nome?: string;
  esfera_id?: string;
  ano?: string;
  numero_sequencial?: string;
  data_publicacao_pncp?: string;
}

interface ResultadoItemPncp {
  valorUnitarioHomologado?: number | string;
  quantidadeHomologada?: number | string;
  nomeRazaoSocialFornecedor?: string;
  niFornecedor?: string;
  dataResultado?: string;
  dataCancelamento?: string | null;
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** O item da compra só interessa se casar com o que se procura — o edital inteiro fala de dezenas de coisas. */
function itemCasaComTermo(descricaoItem: string, termos: string[]): boolean {
  const palavras = normalizarTexto(descricaoItem).split(" ");
  return termos.every((termo) => palavras.some((p) => p === termo || p.startsWith(termo)));
}

/** Executa em lotes para não disparar dezenas de requisições de uma vez contra o PNCP. */
async function emLotes<T, R>(itens: T[], tamanhoLote: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += tamanhoLote) {
    saida.push(...(await Promise.all(itens.slice(i, i + tamanhoLote).map(fn))));
  }
  return saida;
}

/**
 * Busca textual de contratações no PNCP.
 *
 * Usa `/api/search/`, que é o endpoint do próprio portal e **não aparece no swagger de consulta**
 * (`/api/consulta/v3/api-docs` lista só 12 rotas, nenhuma com busca por texto). Foi o que destravou
 * o PNCP: sem ele não há como sair de "despolpadeira" para uma compra concreta, porque as rotas
 * documentadas só filtram por data, modalidade e órgão.
 */
export async function buscarContratacoesPncp(termo: string, opcoes: { uf?: string; max?: number } = {}): Promise<{ ok: boolean; compras: ContextoCompraPncp[]; erro?: string }> {
  const params = new URLSearchParams({ q: termo, tipos_documento: "edital", pagina: "1", tam_pagina: String(opcoes.max ?? 10) });
  if (opcoes.uf) params.set("ufs", opcoes.uf.toUpperCase());

  const resposta = await obterJson(`https://pncp.gov.br/api/search/?${params}`);
  if (!resposta.ok) return { ok: false, compras: [], erro: resposta.erro };

  const corpo = resposta.dados as { items?: ItemBuscaPncp[] } | undefined;
  const compras: ContextoCompraPncp[] = [];
  // A busca devolve a mesma compra mais de uma vez (documentos distintos apontando para ela).
  // Sem isto, os itens dela seriam lidos duas vezes e o mesmo preço entraria duplicado na cesta,
  // dando peso dobrado a uma compra só — medido com "despolpadeira" em MG.
  const jaVistas = new Set<string>();
  for (const i of corpo?.items ?? []) {
    // item_url vem como "/compras/{cnpj}/{ano}/{sequencial}".
    const partes = (i.item_url ?? "").split("/").filter(Boolean);
    const cnpj = i.orgao_cnpj ?? partes[1];
    const ano = Number(i.ano ?? partes[2]);
    const sequencial = Number(i.numero_sequencial ?? partes[3]);
    if (!cnpj || !Number.isFinite(ano) || !Number.isFinite(sequencial)) continue;
    const chave = `${cnpj}/${ano}/${sequencial}`;
    if (jaVistas.has(chave)) continue;
    jaVistas.add(chave);
    compras.push({
      cnpj,
      ano,
      sequencial,
      orgao: (i.orgao_nome ?? "").trim(),
      uf: (i.uf ?? "").trim(),
      municipio: (i.municipio_nome ?? "").trim(),
      esfera: (i.esfera_id ?? "").trim(),
      data: (i.data_publicacao_pncp ?? "").slice(0, 10),
    });
  }
  return { ok: true, compras };
}

/**
 * Preços do PNCP para um termo — o **único caminho até o governo de Minas**.
 *
 * Medido: no Compras.gov.br a esfera estadual simplesmente não existe; no PNCP, "ESTADO DE MINAS
 * GERAIS" aparece como comprador. O custo é que aqui o preço não vem de uma chamada só: é preciso
 * buscar a contratação, abrir seus itens e, para o item que casa com o termo, pedir o resultado.
 *
 * Prefere sempre o **homologado** (`valorUnitarioHomologado`, o que foi de fato pago) e só cai no
 * estimado do edital quando a compra ainda não teve resultado — a diferença fica registrada na
 * `fonte` de cada observação, para a cesta não misturar as duas qualidades sem avisar.
 */
export async function buscarPrecosPncp(
  termo: string,
  opcoes: { uf?: string; maxContratacoes?: number; maxItens?: number } = {},
): Promise<{ ok: boolean; observacoes: PrecoObservado[]; erro?: string }> {
  const termos = normalizarTexto(termo).split(" ").filter((t) => t.length >= 3);
  if (termos.length === 0) return { ok: true, observacoes: [] };

  const busca = await buscarContratacoesPncp(termo, { uf: opcoes.uf, max: opcoes.maxContratacoes ?? 10 });
  if (!busca.ok) return { ok: false, observacoes: [], erro: busca.erro };
  if (busca.compras.length === 0) return { ok: true, observacoes: [] };

  const porCompra = await emLotes(busca.compras, 4, async (compra) => {
    const { itens } = await buscarItensPncp(compra.cnpj, compra.ano, compra.sequencial, compra);
    return itens.filter((i) => itemCasaComTermo(i.descricao ?? "", termos)).map((item) => ({ compra, item }));
  });

  const candidatos = porCompra.flat().slice(0, opcoes.maxItens ?? 25);

  const observacoes = await emLotes(candidatos, 4, async ({ compra, item }): Promise<PrecoObservado | null> => {
    const base = {
      descricao: (item.descricao ?? "").trim(),
      unidade: (item.unidadeMedida ?? "UN").trim().toUpperCase(),
      orgao: compra.orgao,
      esfera: compra.esfera,
      uf: compra.uf,
      municipio: compra.municipio,
      url: `https://pncp.gov.br/app/editais/${compra.cnpj}/${compra.ano}/${compra.sequencial}`,
    };

    if (item.temResultado) {
      const resp = await obterJson(`https://pncp.gov.br/api/pncp/v1/orgaos/${encodeURIComponent(compra.cnpj)}/compras/${compra.ano}/${compra.sequencial}/itens/${item.numeroItem}/resultados`);
      const lista = Array.isArray(resp.dados) ? (resp.dados as ResultadoItemPncp[]) : [];
      // Resultado cancelado não é preço praticado — entraria na cesta como compra que nunca houve.
      const valido = lista.find((r) => !r.dataCancelamento && numero(r.valorUnitarioHomologado) > 0);
      if (valido) {
        return {
          ...base,
          fonte: "pncp-homologado" as FontePreco,
          precoUnitario: numero(valido.valorUnitarioHomologado),
          quantidade: numero(valido.quantidadeHomologada),
          data: (valido.dataResultado ?? compra.data).slice(0, 10),
          fornecedor: (valido.nomeRazaoSocialFornecedor ?? "").trim() || undefined,
          cnpjFornecedor: (valido.niFornecedor ?? "").trim() || undefined,
        };
      }
    }

    const estimado = numero(item.valorUnitarioEstimado);
    if (estimado <= 0) return null;
    return { ...base, fonte: "pncp-estimado" as FontePreco, precoUnitario: estimado, quantidade: numero(item.quantidade), data: compra.data };
  });

  return { ok: true, observacoes: observacoes.filter((o): o is PrecoObservado => o !== null) };
}
