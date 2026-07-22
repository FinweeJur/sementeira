/**
 * Ponte entre os tokens de cor do design system (`src/index.css`) e o three.js.
 *
 * O three não lê CSS custom properties, então antes as cores do mapa eram 9
 * constantes hex hardcoded — o mapa era o único pedaço do app que não
 * respondia aos temas claro/escuro/alto-contraste. Aqui as cores são lidas do
 * `:root` no mount e relidas quando `data-tema` muda.
 */

export interface PaletaMapa {
  /** Tokens crus do design system. */
  bg: number;
  panel: number;
  border: number;
  text: number;
  textDim: number;
  accent: number;
  green: number;
  yellow: number;
  red: number;
  /** Derivados do terreno. */
  soloTopo: number;
  soloLado: number;
  agua: number;
  costa: number;
  estrada: number;
  neblina: number;
  /** Derivados da vegetação e do fundo rotativo. */
  tronco: number;
  folhaEscura: number;
  folhaMedia: number;
  folhaClara: number;
  ouro: number;
  flor: number;
  madeira: number;
  /** Luz. */
  luzSol: number;
  luzContra: number;
  /** Verdadeiro no tema alto-contraste — desliga sutilezas que sumiriam. */
  altoContraste: boolean;
}

function lerToken(estilos: CSSStyleDeclaration, nome: string, alternativa: string): string {
  const valor = estilos.getPropertyValue(nome).trim();
  return valor || alternativa;
}

/** "#rrggbb" (ou "#rgb") → inteiro 0xrrggbb. Devolve `alternativa` se não parsear. */
function hexParaInt(hex: string, alternativa: number): number {
  const limpo = hex.replace("#", "").trim();
  if (limpo.length === 3) {
    const r = limpo[0];
    const g = limpo[1];
    const b = limpo[2];
    const n = Number.parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
    return Number.isNaN(n) ? alternativa : n;
  }
  if (limpo.length === 6) {
    const n = Number.parseInt(limpo, 16);
    return Number.isNaN(n) ? alternativa : n;
  }
  return alternativa;
}

function componentes(cor: number): [number, number, number] {
  return [(cor >> 16) & 0xff, (cor >> 8) & 0xff, cor & 0xff];
}

function juntar(r: number, g: number, b: number): number {
  const lim = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (lim(r) << 16) | (lim(g) << 8) | lim(b);
}

/** Mistura linear entre duas cores. t=0 devolve `a`, t=1 devolve `b`. */
export function misturar(a: number, b: number, t: number): number {
  const [ar, ag, ab] = componentes(a);
  const [br, bg, bb] = componentes(b);
  return juntar(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Clareia (fator > 0) ou escurece (fator < 0) uma cor. */
export function ajustarBrilho(cor: number, fator: number): number {
  return fator >= 0 ? misturar(cor, 0xffffff, fator) : misturar(cor, 0x000000, -fator);
}

const PADRAO = {
  bg: 0x0f1410,
  panel: 0x171d17,
  border: 0x2a332a,
  text: 0xe9efe6,
  textDim: 0x9fae9b,
  accent: 0x6fae55,
  green: 0x4caf50,
  yellow: 0xd4a017,
  red: 0xd1453b,
};

export function lerPaleta(): PaletaMapa {
  const raiz = document.documentElement;
  const estilos = getComputedStyle(raiz);
  const tema = raiz.getAttribute("data-tema") ?? "escuro";
  const altoContraste = tema === "alto-contraste";
  const claro = tema === "claro";

  const bg = hexParaInt(lerToken(estilos, "--sm-bg", ""), PADRAO.bg);
  const panel = hexParaInt(lerToken(estilos, "--sm-panel", ""), PADRAO.panel);
  const border = hexParaInt(lerToken(estilos, "--sm-border", ""), PADRAO.border);
  const text = hexParaInt(lerToken(estilos, "--sm-text", ""), PADRAO.text);
  const textDim = hexParaInt(lerToken(estilos, "--sm-text-dim", ""), PADRAO.textDim);
  const accent = hexParaInt(lerToken(estilos, "--sm-accent", ""), PADRAO.accent);
  const green = hexParaInt(lerToken(estilos, "--sm-green", ""), PADRAO.green);
  const yellow = hexParaInt(lerToken(estilos, "--sm-yellow", ""), PADRAO.yellow);
  const red = hexParaInt(lerToken(estilos, "--sm-red", ""), PADRAO.red);

  // Terreno derivado do acento + fundo: no escuro é um verde de terra abafado,
  // no claro fica pastel, no alto-contraste vira quase preto com borda viva.
  const soloTopo = altoContraste ? 0x121212 : misturar(accent, bg, claro ? 0.55 : 0.72);
  const soloLado = altoContraste ? 0x000000 : ajustarBrilho(soloTopo, -0.35);
  const agua = altoContraste ? 0x001018 : misturar(bg, 0x1b3a4b, claro ? 0.28 : 0.55);
  const costa = altoContraste ? 0xffffff : misturar(soloTopo, bg, 0.5);
  const estrada = altoContraste ? 0xffffff : misturar(soloTopo, 0xc8b48a, claro ? 0.5 : 0.42);
  const neblina = altoContraste ? 0x000000 : bg;

  return {
    bg,
    panel,
    border,
    text,
    textDim,
    accent,
    green,
    yellow,
    red,
    soloTopo,
    soloLado,
    agua,
    costa,
    estrada,
    neblina,
    tronco: altoContraste ? 0xffffff : misturar(0x6b4f32, bg, claro ? 0.05 : 0.15),
    folhaEscura: ajustarBrilho(accent, altoContraste ? 0 : -0.4),
    folhaMedia: accent,
    folhaClara: ajustarBrilho(accent, altoContraste ? 0.25 : 0.3),
    ouro: altoContraste ? yellow : misturar(yellow, 0xffe9a8, 0.35),
    // Flor da árvore madura. No alto contraste vira branco puro: um rosa
    // pálido sobre fundo preto não passaria como marca distinta.
    flor: altoContraste ? 0xffffff : misturar(0xf5d9e8, claro ? 0xe08ab4 : 0xffffff, claro ? 0.45 : 0.15),
    madeira: altoContraste ? 0xffffff : misturar(0x8a6a44, bg, claro ? 0.05 : 0.2),
    luzSol: claro ? 0xffffff : 0xfff2d8,
    luzContra: claro ? 0xdfe9ff : 0x8fb6d6,
    altoContraste,
  };
}

/**
 * Observa a troca de tema (`preferences.ts` escreve/remove `data-tema` no
 * `<html>`) e chama o callback com a paleta nova. Devolve a função de limpeza.
 */
export function observarTema(aoMudar: (paleta: PaletaMapa) => void): () => void {
  const observador = new MutationObserver((mutacoes) => {
    if (mutacoes.some((m) => m.attributeName === "data-tema")) aoMudar(lerPaleta());
  });
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
  return () => observador.disconnect();
}
