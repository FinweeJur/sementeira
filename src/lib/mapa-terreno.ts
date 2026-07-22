/**
 * Geometria e layout do mapa isométrico do Ecossistema.
 *
 * Módulo puro (sem three.js, sem DOM) para ser testável e para deixar claro
 * que a posição de cada projeto no mapa é DERIVADA dos dados — não decorativa:
 *
 *  1. os projetos são agrupados em "bairros" (município quando existe, senão
 *     componente conectado do grafo de conexões);
 *  2. dentro do bairro, força dirigida aproxima quem tem conexão;
 *  3. cada projeto é encaixado (snap) em UM tile hexagonal livre;
 *  4. as conexões viram caminhos de tiles (estradas), não tubos pelo ar.
 *
 * TUDO é determinístico: mesma entrada = mesmo mapa, hoje e amanhã. Nenhuma
 * chamada a Math.random em runtime — o ruído do terreno vem de hash com
 * semente fixa.
 */

/** Raio do hexágono (pointy-top) em unidades de mundo. */
export const TILE_RAIO = 0.62;

/** Semente fixa do relevo. Mudar isto muda o desenho do terreno para todo mundo. */
const SEMENTE_RELEVO = 0x5e3e17;

/**
 * Faixa de altura do relevo. Estreita de propósito: com variação grande, a
 * parede lateral de cada prisma aparece entre um tile e o vizinho e o terreno
 * lê como um tabuleiro de peças soltas, não como chão contínuo.
 */
export const ALTURA_TILE_MIN = 0.26;
export const ALTURA_TILE_MAX = 0.35;
/** Nível da água — abaixo do tile mais baixo, para a costa aparecer. */
export const NIVEL_AGUA = 0.1;
/** Leito do rio: abaixo do nível da água, então o plano de água o cobre. */
export const ALTURA_RIO = 0.04;

export interface Coord {
  q: number;
  r: number;
}

export function chaveTile(c: Coord): string {
  return `${c.q},${c.r}`;
}

/** Axial pointy-top → mundo (plano XZ). */
export function hexParaMundo(q: number, r: number, raio: number = TILE_RAIO): { x: number; z: number } {
  return { x: raio * Math.sqrt(3) * (q + r / 2), z: raio * 1.5 * r };
}

/** Mundo (plano XZ) → axial pointy-top arredondado. */
export function mundoParaHex(x: number, z: number, raio: number = TILE_RAIO): Coord {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * z) / raio;
  const r = ((2 / 3) * z) / raio;
  return arredondarAxial(q, r);
}

/** Arredondamento em coordenadas cúbicas — o ingênuo (Math.round nos dois eixos) erra o tile. */
export function arredondarAxial(qf: number, rf: number): Coord {
  const x = qf;
  const z = rf;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

const DIRECOES: Coord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function vizinhos(c: Coord): Coord[] {
  return DIRECOES.map((d) => ({ q: c.q + d.q, r: c.r + d.r }));
}

export function distanciaHex(a: Coord, b: Coord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** Linha de tiles entre dois hexes (interpolação cúbica) — o traçado da estrada. */
export function linhaHex(a: Coord, b: Coord): Coord[] {
  const n = distanciaHex(a, b);
  if (n === 0) return [a];
  const saida: Coord[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    saida.push(arredondarAxial(a.q + (b.q - a.q) * t, a.r + (b.r - a.r) * t));
  }
  return saida;
}

// ---------------------------------------------------------------------------
// Hash e ruído determinísticos
// ---------------------------------------------------------------------------

function hashInteiros(a: number, b: number, semente: number): number {
  let h = semente ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Hash estável de string → inteiro sem sinal. Usado para escolher variante de modelo. */
export function hashTexto(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Ruído de valor com interpolação suave (smoothstep). */
function ruidoSuave(q: number, r: number, escala: number, semente: number): number {
  const x = q / escala;
  const y = r / escala;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hashInteiros(x0, y0, semente);
  const n10 = hashInteiros(x0 + 1, y0, semente);
  const n01 = hashInteiros(x0, y0 + 1, semente);
  const n11 = hashInteiros(x0 + 1, y0 + 1, semente);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

/** Altura do topo do tile. Variação sutil — o modelo tem que assentar reto. */
export function alturaDoTile(c: Coord): number {
  const n = 0.68 * ruidoSuave(c.q, c.r, 4.2, SEMENTE_RELEVO) + 0.32 * ruidoSuave(c.q, c.r, 1.8, SEMENTE_RELEVO ^ 0x9e37);
  return ALTURA_TILE_MIN + (ALTURA_TILE_MAX - ALTURA_TILE_MIN) * n;
}

/** Tom do tile (0..1) — variação sutil de cor, descorrelacionada da altura. */
export function tomDoTile(c: Coord): number {
  return ruidoSuave(c.q, c.r, 2.6, SEMENTE_RELEVO ^ 0x51ed);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface NoLayout {
  id: string;
  /** Chave do bairro preferida (município). Vazio/ausente = agrupar pelo grafo. */
  grupo?: string;
}

export interface ArestaLayout {
  deId: string;
  paraId: string;
}

export interface CaminhoLayout {
  deId: string;
  paraId: string;
  tiles: Coord[];
}

export interface ResultadoLayout {
  /** projeto → tile ocupado */
  posicoes: Map<string, Coord>;
  /** conexão → tiles atravessados (estrada) */
  caminhos: CaminhoLayout[];
  /** todos os tiles de terra (ocupados + estrada + margem) */
  terreno: Coord[];
  /** tiles de terra que fazem fronteira com água (mar ou rio) — recebem a borda de costa */
  costa: Set<string>;
  /** leito do rio: renderiza afundado, abaixo do nível da água */
  rio: Set<string>;
  /** bairro → id dos projetos, para rótulo de região */
  bairros: Map<string, string[]>;
}

/** Componentes conectados do grafo não direcionado. */
function componentesConectados(ids: string[], adjacencia: Map<string, Set<string>>): Map<string, string> {
  const componentePorId = new Map<string, string>();
  for (const id of ids) {
    if (componentePorId.has(id)) continue;
    const fila = [id];
    componentePorId.set(id, id);
    while (fila.length > 0) {
      const atual = fila.pop() as string;
      for (const vizinho of adjacencia.get(atual) ?? []) {
        if (componentePorId.has(vizinho)) continue;
        componentePorId.set(vizinho, id);
        fila.push(vizinho);
      }
    }
  }
  return componentePorId;
}

/**
 * Fruchterman-Reingold enxuto. Determinístico: posições iniciais vêm do hash
 * do id, não de Math.random. Poucas iterações e congelado — roda uma vez por
 * mudança de dados, nunca por frame.
 */
function forcaDirigida(ids: string[], adjacencia: Map<string, Set<string>>, iteracoes = 180): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const raioInicial = 1.1 * Math.sqrt(Math.max(ids.length, 1));
  ids.forEach((id, i) => {
    // Ângulo pelo índice (espalha) + desvio pelo hash (quebra a simetria de relógio).
    const angulo = (i / ids.length) * Math.PI * 2 + (hashTexto(id) % 1000) / 1000 - 0.5;
    const raio = raioInicial * (0.72 + ((hashTexto(`${id}#r`) % 1000) / 1000) * 0.4);
    pos.set(id, { x: Math.cos(angulo) * raio, y: Math.sin(angulo) * raio });
  });
  if (ids.length < 2) return pos;

  // Distância ideal entre vizinhos, em tiles. Enxuta: o mapa espalhado fazia a
  // câmera se afastar tanto que um tile virava 14px e um broto 8px na tela.
  const k = 1.75;
  let temperatura = raioInicial * 0.6;
  const resfriamento = temperatura / (iteracoes + 1);

  for (let passo = 0; passo < iteracoes; passo++) {
    const desloc = new Map<string, { x: number; y: number }>(ids.map((id) => [id, { x: 0, y: 0 }]));

    // Repulsão entre todos os pares.
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i])!;
        const b = pos.get(ids[j])!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.001) {
          // Sobrepostos: separa numa direção estável derivada dos ids.
          dx = ((hashTexto(ids[i] + ids[j]) % 1000) / 1000 - 0.5) * 0.01;
          dy = ((hashTexto(ids[j] + ids[i]) % 1000) / 1000 - 0.5) * 0.01;
          d = Math.hypot(dx, dy) || 0.001;
        }
        const forca = (k * k) / d;
        const ux = (dx / d) * forca;
        const uy = (dy / d) * forca;
        const da = desloc.get(ids[i])!;
        const db = desloc.get(ids[j])!;
        da.x += ux;
        da.y += uy;
        db.x -= ux;
        db.y -= uy;
      }
    }

    // Atração ao longo das arestas.
    for (const id of ids) {
      for (const vizinho of adjacencia.get(id) ?? []) {
        if (id >= vizinho) continue; // cada aresta uma vez
        if (!pos.has(vizinho)) continue;
        const a = pos.get(id)!;
        const b = pos.get(vizinho)!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const forca = (d * d) / k;
        const ux = (dx / d) * forca;
        const uy = (dy / d) * forca;
        const da = desloc.get(id)!;
        const db = desloc.get(vizinho)!;
        da.x -= ux;
        da.y -= uy;
        db.x += ux;
        db.y += uy;
      }
    }

    for (const id of ids) {
      const d = desloc.get(id)!;
      const p = pos.get(id)!;
      const mag = Math.hypot(d.x, d.y) || 0.001;
      const limite = Math.min(mag, temperatura);
      p.x += (d.x / mag) * limite;
      p.y += (d.y / mag) * limite;
    }
    temperatura -= resfriamento;
  }

  return pos;
}

/** Primeiro tile livre a partir de um alvo, varrendo anéis concêntricos. */
function tileLivreProximo(alvo: Coord, ocupados: Set<string>): Coord {
  if (!ocupados.has(chaveTile(alvo))) return alvo;
  for (let raio = 1; raio < 40; raio++) {
    // Caminha o anel: começa no vizinho na direção 4 e percorre os 6 lados.
    let atual: Coord = { q: alvo.q + DIRECOES[4].q * raio, r: alvo.r + DIRECOES[4].r * raio };
    for (let lado = 0; lado < 6; lado++) {
      for (let passo = 0; passo < raio; passo++) {
        if (!ocupados.has(chaveTile(atual))) return atual;
        atual = { q: atual.q + DIRECOES[lado].q, r: atual.r + DIRECOES[lado].r };
      }
    }
  }
  return alvo;
}

/**
 * Coloca cada bairro numa espiral de ângulo áureo e cada projeto num tile
 * livre. `bloqueados` são tiles proibidos (o leito do rio) — é o que permite
 * rodar a colocação duas vezes: uma para descobrir a extensão do mapa, outra
 * já desviando do rio.
 */
function colocarProjetos(
  chavesOrdenadas: string[],
  bairros: Map<string, string[]>,
  adjacencia: Map<string, Set<string>>,
  bloqueados: Set<string>,
): Map<string, Coord> {
  const posicoes = new Map<string, Coord>();
  const centrosColocados: { x: number; y: number; raio: number }[] = [];
  const ocupados = new Set<string>(bloqueados);

  for (const chave of chavesOrdenadas) {
    const membros = bairros.get(chave)!;
    const local = forcaDirigida(membros, adjacencia);

    // Centraliza e mede o raio do bairro.
    let cx = 0;
    let cy = 0;
    for (const id of membros) {
      const p = local.get(id)!;
      cx += p.x;
      cy += p.y;
    }
    cx /= membros.length;
    cy /= membros.length;
    let raioBairro = 0;
    for (const id of membros) {
      const p = local.get(id)!;
      p.x -= cx;
      p.y -= cy;
      raioBairro = Math.max(raioBairro, Math.hypot(p.x, p.y));
    }
    raioBairro = Math.max(raioBairro, 1);

    const AUREO = 2.39996323;
    let centro = { x: 0, y: 0 };
    for (let i = 0; i < 400; i++) {
      // Passo curto e margem mínima: bairros vizinhos precisam encostar. Com
      // passo largo o mapa virava ilhotas num oceano e a câmera se afastava
      // tanto que um tile dava 14px na tela.
      const raio = 1.55 * Math.sqrt(i);
      const candidato = { x: Math.cos(i * AUREO) * raio, y: Math.sin(i * AUREO) * raio };
      const colide = centrosColocados.some((c) => Math.hypot(c.x - candidato.x, c.y - candidato.y) < c.raio + raioBairro + 0.7);
      if (!colide) {
        centro = candidato;
        break;
      }
    }
    centrosColocados.push({ ...centro, raio: raioBairro });

    for (const id of membros) {
      const p = local.get(id)!;
      const alvo = arredondarAxial(centro.x + p.x, centro.y + p.y);
      const tile = tileLivreProximo(alvo, ocupados);
      ocupados.add(chaveTile(tile));
      posicoes.set(id, tile);
    }
  }

  return posicoes;
}

/**
 * Rio serpenteando pelo meio do mapa, de costa a costa.
 *
 * Traçado determinístico: duas senoides (uma longa que dá a curva grande, uma
 * curta que tira a regularidade) ao longo do eixo X do mapa, amostradas denso e
 * costuradas com `linhaHex` para o leito nunca ter buraco. Estende-se além da
 * borda da terra dos dois lados, senão o rio "começa" no meio do continente e
 * lê como lago.
 */
function gerarRio(tiles: Coord[]): Set<string> {
  const rio = new Set<string>();
  if (tiles.length === 0) return rio;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const t of tiles) {
    const { x, z } = hexParaMundo(t.q, t.r);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const centroZ = (minZ + maxZ) / 2;
  const larguraMundo = Math.max(maxX - minX, TILE_RAIO * 4);
  const profundidade = Math.max(maxZ - minZ, TILE_RAIO * 4);
  const amplitude = Math.max(profundidade * 0.2, TILE_RAIO * 1.6);
  const margem = TILE_RAIO * 7;

  const passos = Math.max(80, Math.round(larguraMundo / (TILE_RAIO * 0.35)));
  const traco: Coord[] = [];
  for (let i = 0; i <= passos; i++) {
    const t = i / passos;
    const x = minX - margem + (larguraMundo + margem * 2) * t;
    const z = centroZ + Math.sin(t * Math.PI * 2 * 1.15 + 0.6) * amplitude + Math.sin(t * Math.PI * 2 * 2.7 + 2.1) * amplitude * 0.26;
    traco.push(mundoParaHex(x, z));
  }

  for (let i = 0; i < traco.length; i++) {
    rio.add(chaveTile(traco[i]));
    if (i > 0) for (const c of linhaHex(traco[i - 1], traco[i])) rio.add(chaveTile(c));
  }

  // Alarga em parte do percurso, sempre na direção transversal ao fluxo (o rio
  // corre no eixo X, então o "através" são os vizinhos em r).
  for (const k of Array.from(rio)) {
    const [q, r] = k.split(",").map(Number);
    const sorte = hashInteiros(q, r, 0x21ab);
    if (sorte > 0.62) rio.add(chaveTile({ q, r: r + 1 }));
    else if (sorte > 0.34) rio.add(chaveTile({ q, r: r - 1 }));
  }

  return rio;
}

/**
 * Preenche buracos internos: qualquer tile que não seja terra mas também não
 * seja alcançável a partir de fora vira terra. É o que garante "sem espaços
 * vazios" — sem isto a massa fica furada onde os bairros não se encostam.
 */
function preencherFuros(terra: Set<string>, mapaTerra: Map<string, Coord>) {
  if (mapaTerra.size === 0) return;
  let minQ = Infinity;
  let maxQ = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  for (const c of mapaTerra.values()) {
    minQ = Math.min(minQ, c.q);
    maxQ = Math.max(maxQ, c.q);
    minR = Math.min(minR, c.r);
    maxR = Math.max(maxR, c.r);
  }
  minQ -= 1;
  maxQ += 1;
  minR -= 1;
  maxR += 1;

  const dentro = (c: Coord) => c.q >= minQ && c.q <= maxQ && c.r >= minR && c.r <= maxR;
  const exterior = new Set<string>();
  const fila: Coord[] = [];
  const semear = (c: Coord) => {
    const k = chaveTile(c);
    if (terra.has(k) || exterior.has(k)) return;
    exterior.add(k);
    fila.push(c);
  };
  for (let q = minQ; q <= maxQ; q++) {
    semear({ q, r: minR });
    semear({ q, r: maxR });
  }
  for (let r = minR; r <= maxR; r++) {
    semear({ q: minQ, r });
    semear({ q: maxQ, r });
  }
  while (fila.length > 0) {
    const atual = fila.pop() as Coord;
    for (const v of vizinhos(atual)) {
      if (!dentro(v)) continue;
      semear(v);
    }
  }

  for (let q = minQ; q <= maxQ; q++) {
    for (let r = minR; r <= maxR; r++) {
      const k = `${q},${r}`;
      if (terra.has(k) || exterior.has(k)) continue;
      terra.add(k);
      mapaTerra.set(k, { q, r });
    }
  }
}

export function calcularLayout(nos: NoLayout[], arestas: ArestaLayout[]): ResultadoLayout {
  const caminhos: CaminhoLayout[] = [];
  const bairros = new Map<string, string[]>();

  if (nos.length === 0) {
    return { posicoes: new Map(), caminhos, terreno: [], costa: new Set(), rio: new Set(), bairros };
  }

  const ids = nos.map((n) => n.id);
  const idsValidos = new Set(ids);
  const adjacencia = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  for (const a of arestas) {
    if (!idsValidos.has(a.deId) || !idsValidos.has(a.paraId) || a.deId === a.paraId) continue;
    adjacencia.get(a.deId)!.add(a.paraId);
    adjacencia.get(a.paraId)!.add(a.deId);
  }

  // Bairro = município quando pelo menos dois municípios distintos estão
  // preenchidos; senão, componente conectado do grafo (que é o agrupamento
  // que realmente reduz cruzamento de estrada).
  const municipios = new Set(nos.map((n) => n.grupo).filter((g): g is string => !!g));
  const usarMunicipio = municipios.size >= 2;
  const componentePorId = componentesConectados(ids, adjacencia);
  for (const no of nos) {
    const chave = usarMunicipio ? (no.grupo ?? "sem-municipio") : componentePorId.get(no.id)!;
    const lista = bairros.get(chave) ?? [];
    lista.push(no.id);
    bairros.set(chave, lista);
  }

  // Bairros maiores primeiro, com desempate estável pela chave.
  const chavesOrdenadas = Array.from(bairros.keys()).sort((a, b) => {
    const d = (bairros.get(b)?.length ?? 0) - (bairros.get(a)?.length ?? 0);
    return d !== 0 ? d : a.localeCompare(b);
  });

  // Duas passadas: a primeira só para descobrir a extensão do mapa e traçar o
  // rio; a segunda coloca os projetos de verdade, já desviando do leito.
  const provisorias = colocarProjetos(chavesOrdenadas, bairros, adjacencia, new Set());
  const rio = gerarRio(Array.from(provisorias.values()));
  const posicoes = colocarProjetos(chavesOrdenadas, bairros, adjacencia, rio);

  // Estradas: linha de tiles entre os pares conectados, sem repetir o par.
  const paresVistos = new Set<string>();
  for (const a of arestas) {
    const de = posicoes.get(a.deId);
    const para = posicoes.get(a.paraId);
    if (!de || !para) continue;
    const par = [a.deId, a.paraId].sort().join("|");
    if (paresVistos.has(par)) continue;
    paresVistos.add(par);
    caminhos.push({ deId: a.deId, paraId: a.paraId, tiles: linhaHex(de, para) });
  }

  // Terra = projetos + estradas + 2 anéis de margem, e então os furos internos
  // preenchidos: o resultado é uma massa contínua, sem vão entre bairros.
  const terra = new Set<string>();
  const mapaTerra = new Map<string, Coord>();
  function marcar(c: Coord) {
    const k = chaveTile(c);
    if (terra.has(k)) return;
    terra.add(k);
    mapaTerra.set(k, c);
  }
  for (const tile of posicoes.values()) marcar(tile);
  for (const caminho of caminhos) for (const tile of caminho.tiles) marcar(tile);
  // 1 anel só: o preenchimento de furos faz o resto do trabalho de fechar a
  // massa. Mais anéis inflam o continente e obrigam a câmera a se afastar.
  for (const c of Array.from(mapaTerra.values())) for (const v of vizinhos(c)) marcar(v);
  preencherFuros(terra, mapaTerra);
  // O leito do rio faz parte do terreno (renderiza afundado); sem isto ele
  // abriria um rasgo de nada no meio do continente.
  for (const k of rio) {
    if (terra.has(k)) continue;
    const [q, r] = k.split(",").map(Number);
    // Só o trecho que corta a terra — o resto do traçado já é mar.
    if (vizinhos({ q, r }).some((v) => terra.has(chaveTile(v)))) marcar({ q, r });
  }

  // Costa = tile de terra na borda do mar OU na margem do rio.
  const costa = new Set<string>();
  for (const [k, c] of mapaTerra) {
    if (rio.has(k)) continue;
    if (vizinhos(c).some((v) => {
      const vk = chaveTile(v);
      return !terra.has(vk) || rio.has(vk);
    })) {
      costa.add(k);
    }
  }

  return { posicoes, caminhos, terreno: Array.from(mapaTerra.values()), costa, rio, bairros };
}
