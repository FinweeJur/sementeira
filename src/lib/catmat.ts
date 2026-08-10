/**
 * Busca local no catálogo CATMAT (PDMs do Compras.gov.br), embarcado em `src/data/catmat-pdm.json`.
 *
 * Existe porque a API pública **não tem busca por texto**: `descricaoItem` é igualdade exata e
 * o endpoint de PDM ignora em silêncio qualquer filtro por nome (devolve 200 com a lista toda).
 * Sem o código do PDM não se chega ao preço — então a busca textual mora aqui, e de graça
 * o app continua achando item sem internet.
 *
 * Regenerar com `node scripts/baixar-catalogo-catmat.mjs`.
 */

export interface ItemCatalogo {
  codigoPdm: number;
  nome: string;
  codigoClasse: number;
  nomeClasse: string;
  ativo: boolean;
}

interface CatalogoBruto {
  geradoEm: string;
  fonte: string;
  classes: Record<string, string>;
  pdms: [number, string, number, number][];
}

/**
 * O catálogo (≈850 KB) entra por `import()` dinâmico, não por import estático.
 *
 * Com import estático o Vite o funde no chunk principal, e todo mundo que abre o app baixa
 * 850 KB por causa de um recurso que só é usado quando alguém vai cotar um item. Na versão web
 * isso pesa em quem acessa de conexão ruim — que é boa parte do público desta ferramenta.
 */
let catalogoCarregado: CatalogoBruto | null = null;
let carregando: Promise<CatalogoBruto> | null = null;

async function carregarCatalogo(): Promise<CatalogoBruto> {
  if (catalogoCarregado) return catalogoCarregado;
  // Uma promessa só, mesmo com várias chamadas simultâneas — senão o arquivo é baixado em duplicata.
  if (!carregando) {
    carregando = import("../data/catmat-pdm.json").then((m) => {
      catalogoCarregado = (m.default ?? m) as unknown as CatalogoBruto;
      return catalogoCarregado;
    });
  }
  return carregando;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Indexado extends ItemCatalogo {
  nomeNormalizado: string;
  palavras: string[];
}

let indice: Indexado[] | null = null;

async function obterIndice(): Promise<Indexado[]> {
  if (indice) return indice;
  const bruto = await carregarCatalogo();
  indice = bruto.pdms.map(([codigoPdm, nome, codigoClasse, ativo]) => {
    const nomeNormalizado = normalizar(nome);
    return {
      codigoPdm,
      nome,
      codigoClasse,
      nomeClasse: bruto.classes[String(codigoClasse)] ?? "",
      ativo: ativo === 1,
      nomeNormalizado,
      palavras: nomeNormalizado.split(" ").filter(Boolean),
    };
  });
  return indice;
}

/**
 * Pontua um item contra os termos buscados.
 *
 * A fronteira de palavra é o que importa aqui: busca crua por substring faz "trator" casar
 * com "exTRATOR de laboratório" e "bomba" com "bomBOMBA". Palavra inteira pontua muito mais
 * que prefixo, e prefixo mais que pedaço no meio — então o item certo sobe mesmo quando o
 * termo aparece por acidente em dezenas de outros.
 */
function pontuar(item: Indexado, termos: string[]): number {
  let total = 0;
  for (const termo of termos) {
    let melhorDoTermo = 0;
    for (const palavra of item.palavras) {
      if (palavra === termo) melhorDoTermo = Math.max(melhorDoTermo, 10);
      else if (palavra.startsWith(termo)) melhorDoTermo = Math.max(melhorDoTermo, 6);
      else if (termo.length >= 4 && palavra.includes(termo)) melhorDoTermo = Math.max(melhorDoTermo, 2);
    }
    if (melhorDoTermo === 0) return 0; // todo termo precisa aparecer de alguma forma
    total += melhorDoTermo;
  }
  // Nome curto e específico ganha do nome comprido que só contém os termos de passagem.
  return total * 100 - item.palavras.length;
}

/** Data de geração do catálogo embarcado. Carrega o arquivo — use só quando for exibir. */
export async function catalogoGeradoEm(): Promise<string> {
  return (await carregarCatalogo()).geradoEm;
}

export interface OpcoesBuscaCatalogo {
  limite?: number;
  /** Itens inativos ainda têm preço histórico; ficam por último em vez de sumir. */
  incluirInativos?: boolean;
}

export async function buscarNoCatalogo(consulta: string, opcoes: OpcoesBuscaCatalogo = {}): Promise<ItemCatalogo[]> {
  const limite = opcoes.limite ?? 20;
  const termos = normalizar(consulta).split(" ").filter((t) => t.length >= 2);
  if (termos.length === 0) return [];

  const pontuados: { item: Indexado; pontos: number }[] = [];
  for (const item of await obterIndice()) {
    if (!item.ativo && !opcoes.incluirInativos) continue;
    const pontos = pontuar(item, termos);
    if (pontos > 0) pontuados.push({ item, pontos });
  }

  pontuados.sort((a, b) => b.pontos - a.pontos || a.item.nome.localeCompare(b.item.nome, "pt-BR"));
  return pontuados.slice(0, limite).map(({ item }) => ({
    codigoPdm: item.codigoPdm,
    nome: item.nome,
    codigoClasse: item.codigoClasse,
    nomeClasse: item.nomeClasse,
    ativo: item.ativo,
  }));
}
