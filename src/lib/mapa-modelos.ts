/**
 * Modelos low-poly do mapa do Ecossistema.
 *
 * Cada estágio (semente → broto → muda → árvore) tem 3 variantes, escolhidas
 * pelo hash do id do projeto: o mesmo projeto sempre ganha o mesmo modelo, em
 * qualquer máquina, em qualquer sessão.
 *
 * ── Trocar por um kit glTF ────────────────────────────────────────────────
 * A geometria abaixo é procedural para o app não depender de asset externo.
 * Para usar modelos de verdade (ex.: Kenney Nature Kit, CC0):
 *   1. crie `src/assets/mapa/` e coloque os .glb com estes nomes:
 *      semente-1.glb  semente-2.glb  semente-3.glb
 *      broto-1.glb    broto-2.glb    broto-3.glb
 *      muda-1.glb     muda-2.glb     muda-3.glb
 *      arvore-1.glb   arvore-2.glb   arvore-3.glb
 *   2. registre a licença em `src/assets/mapa/LICENSE.md` ANTES de commitar;
 *   3. nada mais — `carregarKit()` acha sozinho via import.meta.glob e o
 *      procedural vira fallback automático. Sem rede em runtime: o Vite
 *      empacota os .glb no bundle.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { EstagioCrescimento } from "./mapa-estagios";
import type { PaletaMapa } from "./mapa-tema";
import { ajustarBrilho } from "./mapa-tema";
import { hashTexto } from "./mapa-terreno";

export const VARIANTES_POR_ESTAGIO = 3;

export interface ModeloConstruido {
  grupo: THREE.Group;
  /** Materiais do modelo — o realce de seleção mexe na opacidade deles. */
  materiais: THREE.Material[];
  /** Altura do topo, para ancorar o rótulo sem chute. */
  altura: number;
}

/** Variante estável do projeto: mesmo id = mesma variante, sempre. */
export function varianteDoProjeto(projectId: string): number {
  return hashTexto(`${projectId}#variante`) % VARIANTES_POR_ESTAGIO;
}

/** Giro estável do modelo no tile — quebra a repetição sem virar bagunça. */
export function giroDoProjeto(projectId: string): number {
  return ((hashTexto(`${projectId}#giro`) % 360) / 360) * Math.PI * 2;
}

/** Cor de severidade do estágio — a mesma regra cor+forma+texto do design system. */
export function corDoEstagio(estagio: EstagioCrescimento, paleta: PaletaMapa): number {
  switch (estagio) {
    case "semente":
      return paleta.red;
    case "broto":
      return paleta.yellow;
    case "muda":
      return paleta.green;
    case "arvore":
      return paleta.accent;
  }
}

function material(cor: number, opcoes: { plano?: boolean; emissivo?: number; intensidade?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: cor,
    roughness: 0.92,
    metalness: 0,
    flatShading: opcoes.plano ?? true,
    emissive: opcoes.emissivo ?? 0x000000,
    emissiveIntensity: opcoes.intensidade ?? 0,
  });
}

function malha(geometria: THREE.BufferGeometry, mat: THREE.Material, registro: THREE.Material[]): THREE.Mesh {
  const m = new THREE.Mesh(geometria, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  registro.push(mat);
  return m;
}

// ---------------------------------------------------------------------------
// Peças reaproveitadas
// ---------------------------------------------------------------------------

/** Caixote de horta hexagonal — assenta o modelo no tile e dá escala de "construção". */
function canteiro(paleta: PaletaMapa, raio: number, mats: THREE.Material[]): THREE.Group {
  const g = new THREE.Group();
  const parede = malha(new THREE.CylinderGeometry(raio, raio * 1.02, 0.12, 6), material(paleta.madeira), mats);
  parede.position.y = 0.06;
  const terra = malha(new THREE.CylinderGeometry(raio * 0.88, raio * 0.88, 0.13, 6), material(ajustarBrilho(paleta.soloLado, 0.08)), mats);
  terra.position.y = 0.07;
  g.add(parede, terra);
  return g;
}

/** Estaca com plaquinha na cor da severidade — é o "cor + forma" ficando legível de longe. */
function placa(cor: number, altura: number, mats: THREE.Material[]): THREE.Group {
  const g = new THREE.Group();
  const haste = malha(new THREE.CylinderGeometry(0.018, 0.018, altura, 4), material(0x6b5537), mats);
  haste.position.y = altura / 2;
  const bandeira = malha(new THREE.BoxGeometry(0.17, 0.11, 0.02), material(cor, { emissivo: cor, intensidade: 0.35 }), mats);
  bandeira.position.set(0.09, altura - 0.06, 0);
  g.add(haste, bandeira);
  return g;
}

function folhagem(raio: number, cor: number, mats: THREE.Material[]): THREE.Mesh {
  const m = malha(new THREE.IcosahedronGeometry(raio, 0), material(cor), mats);
  // Achata de leve: esfera perfeita lê como bola, copa de árvore não é bola.
  m.scale.set(1, 0.82, 1);
  return m;
}

// ---------------------------------------------------------------------------
// Estágios
// ---------------------------------------------------------------------------

function construirSemente(variante: number, paleta: PaletaMapa, mats: THREE.Material[]): THREE.Group {
  const g = new THREE.Group();
  g.add(canteiro(paleta, 0.34, mats));

  // Leiras de terra revolvida — canteiro preparado, ainda sem planta.
  const leiras = 2 + (variante % 2);
  for (let i = 0; i < leiras; i++) {
    const leira = malha(new THREE.CylinderGeometry(0.045, 0.06, 0.42, 5), material(ajustarBrilho(paleta.soloLado, 0.18)), mats);
    leira.rotation.z = Math.PI / 2;
    leira.rotation.y = (variante * 0.4) + i * 0.25;
    leira.position.set(0, 0.15, -0.1 + i * 0.13);
    g.add(leira);
  }

  const semente = malha(new THREE.DodecahedronGeometry(0.075, 0), material(ajustarBrilho(paleta.tronco, 0.1)), mats);
  semente.position.set(variante === 1 ? 0.07 : -0.05, 0.2, 0.04);
  g.add(semente);

  const p = placa(paleta.red, 0.44, mats);
  p.position.set(-0.2, 0.12, 0.16);
  g.add(p);

  return g;
}

function construirBroto(variante: number, paleta: PaletaMapa, mats: THREE.Material[]): THREE.Group {
  const g = new THREE.Group();
  g.add(canteiro(paleta, 0.34, mats));

  const caule = malha(new THREE.CylinderGeometry(0.022, 0.034, 0.3, 5), material(paleta.folhaEscura), mats);
  caule.position.y = 0.27;
  g.add(caule);

  const folhas = 2 + (variante % 2);
  for (let i = 0; i < folhas; i++) {
    const f = folhagem(0.11, i % 2 === 0 ? paleta.folhaClara : paleta.folhaMedia, mats);
    const a = (i / folhas) * Math.PI * 2 + variante;
    f.position.set(Math.cos(a) * 0.09, 0.4 + i * 0.04, Math.sin(a) * 0.09);
    g.add(f);
  }

  // Tutor de bambu — sinal visual de "ainda precisa de apoio".
  const tutor = malha(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 4), material(paleta.madeira), mats);
  tutor.position.set(0.1, 0.32, 0.06);
  tutor.rotation.z = -0.16;
  g.add(tutor);

  const p = placa(paleta.yellow, 0.5, mats);
  p.position.set(-0.21, 0.12, 0.15);
  g.add(p);

  return g;
}

function construirMuda(variante: number, paleta: PaletaMapa, mats: THREE.Material[]): THREE.Group {
  const g = new THREE.Group();
  g.add(canteiro(paleta, 0.36, mats));

  const tronco = malha(new THREE.CylinderGeometry(0.042, 0.062, 0.5, 6), material(paleta.tronco), mats);
  tronco.position.y = 0.37;
  g.add(tronco);

  const copas: [number, number, number, number][] = [
    [0, 0.72, 0, 0.24],
    [variante === 0 ? -0.13 : 0.13, 0.62, 0.08, 0.16],
    [0.05, 0.86, variante === 2 ? -0.1 : 0.06, 0.14],
  ];
  copas.forEach(([x, y, z, raio], i) => {
    const f = folhagem(raio, i === 0 ? paleta.folhaMedia : i === 1 ? paleta.folhaEscura : paleta.folhaClara, mats);
    f.position.set(x, y, z);
    g.add(f);
  });

  const p = placa(paleta.green, 0.52, mats);
  p.position.set(-0.23, 0.12, 0.16);
  g.add(p);

  return g;
}

/**
 * Árvore florida — o estágio "pronto para exportar".
 *
 * É de propósito o modelo mais pesado do conjunto: quase o dobro da altura da
 * muda, tronco com raiz aparente, quatro galhos, copa em domo de sete volumes,
 * flores e frutas. A diferença entre muda e árvore precisa ser lida de relance,
 * no mapa e na legenda — se as duas parecerem a mesma planta com tamanhos
 * parecidos, o estágio deixa de informar.
 *
 * As frutas são DOURADAS, não vermelhas: vermelho já é a cor de bloqueio no
 * trio de severidade, e fruta vermelha na copa competiria com esse sinal.
 */
function construirArvore(variante: number, paleta: PaletaMapa, mats: THREE.Material[]): THREE.Group {
  const g = new THREE.Group();
  g.add(canteiro(paleta, 0.42, mats));

  // Raiz aparente: alarga a base e assenta a árvore no chão com peso.
  const raiz = malha(new THREE.CylinderGeometry(0.15, 0.24, 0.16, 8), material(paleta.tronco), mats);
  raiz.position.y = 0.16;
  g.add(raiz);

  const tronco = malha(new THREE.CylinderGeometry(0.085, 0.15, 0.95, 8), material(paleta.tronco), mats);
  tronco.position.y = 0.6;
  g.add(tronco);

  // Quatro galhos em alturas e ângulos diferentes — silhueta de árvore
  // adulta, não de pirulito.
  const galhos: [number, number, number, number][] = [
    [-1, 0.86, 0.62, 0.05],
    [1, 0.98, 0.72, -0.05],
    [-1, 1.06, 0.5, -0.5],
    [1, 0.78, 0.58, 0.55],
  ];
  galhos.forEach(([lado, altura, comprimento, giro], i) => {
    const galho = malha(new THREE.CylinderGeometry(0.028, 0.045, comprimento, 5), material(paleta.tronco), mats);
    galho.position.set(lado * 0.16, altura, giro * 0.4);
    galho.rotation.z = lado * (0.62 + ((i + variante) % 3) * 0.09);
    galho.rotation.x = giro;
    g.add(galho);
  });

  // Copa larga em sete volumes: domo, não bola.
  const copas: [number, number, number, number, number][] = [
    [0, 1.46, 0, 0.46, paleta.folhaMedia],
    [-0.36, 1.3, 0.14, 0.33, paleta.folhaEscura],
    [0.38, 1.34, variante === 2 ? -0.16 : 0.1, 0.31, paleta.folhaEscura],
    [0.06, 1.26, -0.34, 0.29, paleta.folhaMedia],
    [-0.1, 1.24, 0.34, 0.27, paleta.folhaClara],
    [0.16, 1.76, 0.04, 0.28, paleta.folhaClara],
    [-0.2, 1.68, -0.1, 0.22, paleta.folhaMedia],
  ];
  copas.forEach(([x, y, z, raio, cor]) => {
    const f = folhagem(raio, cor, mats);
    f.position.set(x + (variante - 1) * 0.03, y, z);
    g.add(f);
  });

  // Flores: é "árvore FLORIDA". Espalhadas na superfície da copa.
  const flores: [number, number, number][] = [
    [0.3, 1.62, 0.22],
    [-0.34, 1.5, -0.2],
    [0.12, 1.94, -0.14],
    [-0.14, 1.86, 0.26],
    [0.44, 1.36, -0.12],
    [-0.44, 1.3, 0.12],
    [0.02, 1.08, 0.4],
    [-0.06, 1.12, -0.42],
  ];
  for (const [x, y, z] of flores) {
    const flor = malha(new THREE.IcosahedronGeometry(0.055, 0), material(paleta.flor, { emissivo: paleta.flor, intensidade: 0.22 }), mats);
    flor.position.set(x, y, z);
    flor.scale.set(1, 0.7, 1);
    g.add(flor);
  }

  // Frutas douradas, penduradas na borda de baixo da copa.
  const frutas: [number, number, number][] = [
    [0.34, 1.14, 0.2],
    [-0.3, 1.06, 0.26],
    [0.2, 1.02, -0.3],
    [-0.38, 1.16, -0.16],
    [0.46, 1.2, -0.02],
    [0.0, 1.6, 0.36],
  ];
  for (const [x, y, z] of frutas) {
    const fruta = malha(new THREE.OctahedronGeometry(0.075, 0), material(paleta.ouro, { emissivo: paleta.ouro, intensidade: 0.6 }), mats);
    fruta.position.set(x + (variante - 1) * 0.02, y, z);
    g.add(fruta);
  }

  const p = placa(paleta.accent, 0.6, mats);
  p.position.set(-0.3, 0.12, 0.22);
  g.add(p);

  return g;
}

/**
 * Altura do topo de cada estágio. A progressão é deliberadamente acelerada no
 * fim (muda → árvore quase dobra) para que "pronto para exportar" se destaque
 * de relance, no mapa e na legenda.
 */
export const ALTURA_POR_ESTAGIO: Record<EstagioCrescimento, number> = {
  semente: 0.46,
  broto: 0.72,
  muda: 1.04,
  arvore: 2.08,
};

/** Altura do estágio mais alto — referência de escala comum das miniaturas. */
export const ALTURA_MAXIMA_ESTAGIO = Math.max(...Object.values(ALTURA_POR_ESTAGIO));

const CONSTRUTORES: Record<EstagioCrescimento, (v: number, p: PaletaMapa, m: THREE.Material[]) => THREE.Group> = {
  semente: construirSemente,
  broto: construirBroto,
  muda: construirMuda,
  arvore: construirArvore,
};

// ---------------------------------------------------------------------------
// Kit glTF opcional (ver cabeçalho)
// ---------------------------------------------------------------------------

const ARQUIVOS_KIT = import.meta.glob("../assets/mapa/*.glb", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

let kitCarregado: Map<string, THREE.Group> | null = null;

export function existeKitGlTF(): boolean {
  return Object.keys(ARQUIVOS_KIT).length > 0;
}

/**
 * Carrega os .glb de `src/assets/mapa/` (se houver) uma única vez. Falha de um
 * arquivo não derruba o mapa: aquele estágio cai no procedural.
 */
export async function carregarKit(): Promise<Map<string, THREE.Group>> {
  if (kitCarregado) return kitCarregado;
  const mapa = new Map<string, THREE.Group>();
  const loader = new GLTFLoader();
  await Promise.all(
    Object.entries(ARQUIVOS_KIT).map(async ([caminho, url]) => {
      const nome = caminho.split("/").pop()?.replace(/\.glb$/i, "");
      if (!nome) return;
      try {
        const gltf = await loader.loadAsync(url);
        mapa.set(nome, gltf.scene);
      } catch {
        // Silencioso de propósito: o fallback procedural cobre.
      }
    }),
  );
  kitCarregado = mapa;
  return mapa;
}

function clonarDoKit(estagio: EstagioCrescimento, variante: number, kit: Map<string, THREE.Group> | null): ModeloConstruido | null {
  if (!kit) return null;
  const modelo = kit.get(`${estagio}-${variante + 1}`) ?? kit.get(`${estagio}-1`);
  if (!modelo) return null;
  const grupo = modelo.clone(true);
  const materiais: THREE.Material[] = [];
  grupo.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mat = Array.isArray(obj.material) ? obj.material.map((m) => m.clone()) : obj.material.clone();
    obj.material = mat;
    if (Array.isArray(mat)) materiais.push(...mat);
    else materiais.push(mat);
  });
  const caixa = new THREE.Box3().setFromObject(grupo);
  return { grupo, materiais, altura: Math.max(caixa.max.y, 0.4) };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export function construirModelo(
  estagio: EstagioCrescimento,
  projectId: string,
  paleta: PaletaMapa,
  kit: Map<string, THREE.Group> | null = null,
): ModeloConstruido {
  const variante = varianteDoProjeto(projectId);

  const doKit = clonarDoKit(estagio, variante, kit);
  if (doKit) return doKit;

  const materiais: THREE.Material[] = [];
  const grupo = CONSTRUTORES[estagio](variante, paleta, materiais);
  // Escala estável por projeto: ±6%, o bastante para não parecer carimbo.
  const escala = 0.94 + ((hashTexto(`${projectId}#escala`) % 1000) / 1000) * 0.12;
  grupo.scale.setScalar(escala);
  return { grupo, materiais, altura: ALTURA_POR_ESTAGIO[estagio] * escala };
}

// ---------------------------------------------------------------------------
// Peças do cenário
// ---------------------------------------------------------------------------

/**
 * Fita plana assentada no chão — usada nas estradas. Um TubeGeometry fino
 * flutuaria e leria como fio; a fita acompanha o topo dos tiles.
 */
export function construirFitaGeometria(pontos: THREE.Vector3[], largura: number): THREE.BufferGeometry {
  const geometria = new THREE.BufferGeometry();
  if (pontos.length < 2) return geometria;

  const vertices: number[] = [];
  const indices: number[] = [];
  const meia = largura / 2;

  for (let i = 0; i < pontos.length; i++) {
    const anterior = pontos[Math.max(i - 1, 0)];
    const proximo = pontos[Math.min(i + 1, pontos.length - 1)];
    const tx = proximo.x - anterior.x;
    const tz = proximo.z - anterior.z;
    const comprimento = Math.hypot(tx, tz) || 1;
    // Normal no plano do chão: gira a tangente 90°.
    const nx = (-tz / comprimento) * meia;
    const nz = (tx / comprimento) * meia;
    const p = pontos[i];
    vertices.push(p.x + nx, p.y, p.z + nz, p.x - nx, p.y, p.z - nz);
  }

  for (let i = 0; i < pontos.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometria.setIndex(indices);
  geometria.computeVertexNormals();
  return geometria;
}

/** Textura de sombra de contato (AO falso) — gradiente radial gerado uma vez. */
export function texturaSombraContato(): THREE.Texture {
  const tamanho = 64;
  const canvas = document.createElement("canvas");
  canvas.width = tamanho;
  canvas.height = tamanho;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradiente = ctx.createRadialGradient(tamanho / 2, tamanho / 2, 0, tamanho / 2, tamanho / 2, tamanho / 2);
    gradiente.addColorStop(0, "rgba(0,0,0,0.55)");
    gradiente.addColorStop(0.55, "rgba(0,0,0,0.28)");
    gradiente.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, tamanho, tamanho);
  }
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/** Silo comunitário do Fundo Rotativo — o antigo anel dourado solto vira construção nomeada. */
export function construirSilo(paleta: PaletaMapa): { grupo: THREE.Group; anel: THREE.Mesh; altura: number } {
  const grupo = new THREE.Group();
  const mats: THREE.Material[] = [];

  const base = malha(new THREE.CylinderGeometry(0.62, 0.68, 0.14, 8), material(paleta.madeira), mats);
  base.position.y = 0.07;

  const corpo = malha(new THREE.CylinderGeometry(0.44, 0.5, 0.78, 8), material(ajustarBrilho(paleta.panel, 0.22)), mats);
  corpo.position.y = 0.53;

  const cinta = malha(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 8), material(paleta.ouro, { emissivo: paleta.ouro, intensidade: 0.25 }), mats);
  cinta.position.y = 0.62;

  const telhado = malha(new THREE.ConeGeometry(0.58, 0.34, 8), material(paleta.ouro, { emissivo: paleta.ouro, intensidade: 0.3 }), mats);
  telhado.position.y = 1.09;

  const anel = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.035, 8, 32),
    new THREE.MeshStandardMaterial({ color: paleta.ouro, emissive: paleta.ouro, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }),
  );
  anel.rotation.x = Math.PI / 2;
  anel.position.y = 0.3;

  grupo.add(base, corpo, cinta, telhado, anel);
  return { grupo, anel, altura: 1.3 };
}
