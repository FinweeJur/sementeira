import type { RascunhoDados } from "./draft-generation";

/**
 * Extração SEM IA: divide o texto do documento em seções pelos títulos e
 * casa cada seção com um campo do projeto.
 *
 * Serve de plano B quando não há modelo de IA configurado — é melhor abrir o
 * projeto com metade dos campos preenchidos e o documento anexado do que
 * recusar o arquivo. É deterministicamente burra de propósito: só reconhece
 * título seguido de conteúdo, nunca "interpreta" o texto.
 *
 * `equipe` e `indicadores` ficam de fora de propósito: são listas de objetos
 * com campos obrigatórios (horas semanais, meio de verificação…) que não dá
 * para inferir de um parágrafo sem chutar. Melhor vazio que errado.
 */

type TipoConteudo = "texto" | "lista";

interface PadraoCampo {
  campo: keyof RascunhoDados;
  tipo: TipoConteudo;
  termos: string[];
}

/**
 * Os termos são comparados já normalizados (sem acento, minúsculo). A ordem
 * não importa: a busca sempre tenta o termo mais LONGO primeiro, senão
 * "objetivo" roubaria o título "objetivos específicos".
 */
const PADROES: PadraoCampo[] = [
  {
    campo: "objetivosEspecificos",
    tipo: "lista",
    termos: ["objetivos especificos", "objetivo especifico", "objetivos secundarios"],
  },
  {
    campo: "objetivo",
    tipo: "texto",
    termos: ["objetivo geral", "objetivo", "objetivos", "finalidade", "proposito"],
  },
  {
    campo: "justificativa",
    tipo: "texto",
    termos: ["justificativa", "justificacao", "motivacao", "problema identificado"],
  },
  {
    campo: "metas",
    tipo: "lista",
    termos: ["metas", "meta", "resultados esperados", "resultado esperado"],
  },
  {
    campo: "boasPraticas",
    tipo: "lista",
    termos: ["boas praticas", "praticas sustentaveis", "sustentabilidade ambiental"],
  },
  {
    campo: "comoComunidadeAjuda",
    tipo: "texto",
    termos: [
      "participacao da comunidade",
      "envolvimento da comunidade",
      "como a comunidade ajuda",
      "mobilizacao comunitaria",
      "participacao comunitaria",
    ],
  },
  {
    campo: "missaoImpacto",
    tipo: "texto",
    termos: ["missao e impacto", "impacto esperado", "impacto social", "missao", "impacto"],
  },
];

/** Minúsculo, sem acento — para comparar título de seção sem depender de grafia. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Tira numeração, marcador e pontuação de um possível título:
 * "1.2 - OBJETIVO:" -> "objetivo". Repete até estabilizar, porque as marcas
 * se combinam em qualquer ordem ("1.2 -", "- 1.2", "II) 3.").
 */
function limparTitulo(linha: string): string {
  let atual = linha.trim();
  let anterior = "";
  while (atual !== anterior) {
    anterior = atual;
    atual = atual
      .replace(/^[>\s]+/, "")
      .replace(/^[-•*–—]\s*/, "")
      .replace(/^\d+(\.\d+)*[.)]?\s*/, "")
      .replace(/^[IVXLC]+\s*[-.)]\s*/, "");
  }
  return normalizar(atual.replace(/\s*[:.\-–—]\s*$/, ""));
}

interface TituloReconhecido {
  campo: keyof RascunhoDados;
  tipo: TipoConteudo;
  restante: string;
}

/** Título "forte": em caixa alta ou terminado em dois-pontos — formatos inequívocos. */
function ehTituloForte(titulo: string, temDoisPontos: boolean): boolean {
  if (temDoisPontos) return true;
  const temLetra = /[a-zà-ú]/i.test(titulo);
  return temLetra && titulo === titulo.toUpperCase();
}

/**
 * Decide se a linha abre uma seção conhecida.
 *
 * O casamento exato vale sempre. O casamento por PREFIXO ("Objetivo Geral"
 * casando com "objetivo") só vale em título forte — senão a frase comum
 * "Meta ampla do projeto." seria lida como título da seção Metas.
 */
function reconhecerTitulo(linha: string): TituloReconhecido | null {
  const posDoisPontos = linha.indexOf(":");
  const candidatos: { titulo: string; restante: string; temDoisPontos: boolean }[] = [];
  if (posDoisPontos !== -1) {
    candidatos.push({
      titulo: linha.slice(0, posDoisPontos),
      restante: linha.slice(posDoisPontos + 1).trim(),
      temDoisPontos: true,
    });
  }
  candidatos.push({ titulo: linha, restante: "", temDoisPontos: false });

  for (const { titulo, restante, temDoisPontos } of candidatos) {
    if (titulo.trim().length === 0 || titulo.length > 60) continue;
    const limpo = limparTitulo(titulo);
    if (!limpo) continue;
    const forte = ehTituloForte(titulo.trim(), temDoisPontos);

    let melhor: { padrao: PadraoCampo; tamanho: number } | null = null;
    for (const padrao of PADROES) {
      for (const termo of padrao.termos) {
        const exato = limpo === termo;
        const prefixo = forte && limpo.startsWith(termo + " ");
        if (!exato && !prefixo) continue;
        if (!melhor || termo.length > melhor.tamanho) melhor = { padrao, tamanho: termo.length };
      }
    }
    if (melhor) return { campo: melhor.padrao.campo, tipo: melhor.padrao.tipo, restante };
  }
  return null;
}

/** Quebra o conteúdo de uma seção em itens de lista. */
function dividirEmItens(conteudo: string): string[] {
  const linhas = conteudo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const marcador = /^([-•*–—]|\d+[.)]|[a-z][.)])\s+/i;
  const comMarcador = linhas.filter((l) => marcador.test(l));
  if (comMarcador.length > 0) {
    return comMarcador.map((l) => l.replace(marcador, "").trim()).filter(Boolean);
  }
  if (linhas.length > 1) return linhas;

  const porPontoEVirgula = conteudo
    .split(";")
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
  if (porPontoEVirgula.length > 1) return porPontoEVirgula;

  return linhas;
}

export interface ResultadoHeuristica {
  dados: RascunhoDados;
  /** Campos que a heurística conseguiu preencher — para avisar o usuário. */
  camposPreenchidos: (keyof RascunhoDados)[];
}

/** Lê o texto de um documento e devolve o que der para preencher sem IA. */
export function extrairRascunhoHeuristico(texto: string): ResultadoHeuristica {
  const linhas = texto.split(/\r?\n/);
  const secoes = new Map<keyof RascunhoDados, { tipo: TipoConteudo; partes: string[] }>();

  let atual: { campo: keyof RascunhoDados; tipo: TipoConteudo } | null = null;
  for (const linha of linhas) {
    const titulo = reconhecerTitulo(linha);
    if (titulo) {
      atual = { campo: titulo.campo, tipo: titulo.tipo };
      if (!secoes.has(titulo.campo)) secoes.set(titulo.campo, { tipo: titulo.tipo, partes: [] });
      if (titulo.restante) secoes.get(titulo.campo)!.partes.push(titulo.restante);
      continue;
    }
    if (atual && linha.trim()) secoes.get(atual.campo)!.partes.push(linha.trim());
  }

  const dados: RascunhoDados = {};
  const camposPreenchidos: (keyof RascunhoDados)[] = [];

  for (const [campo, { tipo, partes }] of secoes) {
    const conteudo = partes.join("\n").trim();
    if (!conteudo) continue;

    if (tipo === "lista") {
      const itens = dividirEmItens(conteudo);
      if (itens.length === 0) continue;
      // Só os campos de lista de string passam por aqui (ver PADROES).
      (dados as Record<string, unknown>)[campo] = itens;
    } else {
      (dados as Record<string, unknown>)[campo] = conteudo;
    }
    camposPreenchidos.push(campo);
  }

  return { dados, camposPreenchidos };
}
