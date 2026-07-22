import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Project } from "../../lib/types";
import { calcularSaldosRealistas } from "../../lib/ecosystem";
import { estagioDoProjeto, derivarConexoes, ESTAGIOS, ESTAGIO_NOME, ESTAGIO_EXPLICACAO, type EstagioCrescimento } from "../../lib/mapa-estagios";
import { calcularLayout, hexParaMundo, alturaDoTile, tomDoTile, chaveTile, distanciaHex, TILE_RAIO, NIVEL_AGUA, type Coord } from "../../lib/mapa-terreno";
import { lerPaleta, observarTema, misturar, ajustarBrilho, type PaletaMapa } from "../../lib/mapa-tema";
import {
  construirModelo,
  construirSilo,
  construirFitaGeometria,
  texturaSombraContato,
  corDoEstagio,
  giroDoProjeto,
  carregarKit,
  existeKitGlTF,
} from "../../lib/mapa-modelos";

/**
 * Mapa do ecossistema como mundo de jogo de construção (Tropico / SimCity /
 * Civilization), em three.js.
 *
 * Decisões que valem por muitas linhas:
 *
 * — A POSIÇÃO SIGNIFICA. O layout hexagonal vem de `mapa-terreno.ts`: bairro
 *   por município (ou por componente do grafo, quando não há município),
 *   força dirigida dentro do bairro, snap em tile. Quem se conecta fica perto,
 *   e a conexão vira ESTRADA assentada nos tiles — não tubo pelo ar.
 *
 * — CÂMERA TRAVADA no ângulo isométrico clássico (35.264°, direção 1,1,1).
 *   Só zoom e pan. Sem órbita livre: o mapa tem que ser comparável entre
 *   sessões.
 *
 * — RENDER SOB DEMANDA. Com `prefers-reduced-motion` o loop contínuo não
 *   existe: renderiza só quando algo muda (interação, dado, tema). O código
 *   anterior rodava rAF a 60fps para sempre, mesmo parado.
 *
 * — CORES DO TEMA. Nada de hex hardcoded: `mapa-tema.ts` lê os tokens do
 *   `:root` e observa a troca de `data-tema`.
 */

const ZOOM_MIN = 0.55;
const ZOOM_MAX = 4;
/** Acima deste zoom todos os rótulos entram na disputa por espaço. */
const ZOOM_ROTULOS = 1.2;
const ELEVACAO_HOVER = 0.14;

interface EntradaProjeto {
  id: string;
  grupo: THREE.Group;
  hitbox: THREE.Mesh;
  anelSeveridade: THREE.Mesh;
  anelDestaque: THREE.Mesh;
  sombra: THREE.Mesh;
  materiais: THREE.Material[];
  /** Topo do tile onde o modelo assenta. */
  base: THREE.Vector3;
  altura: number;
  elevacao: number;
  elevacaoAlvo: number;
  estagio: EstagioCrescimento;
}

interface EntradaEstrada {
  deId: string;
  paraId: string;
  malha: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
}

interface EntradaGota {
  projectId: string;
  curva: THREE.CatmullRomCurve3;
  trilha: THREE.Mesh;
  gota: THREE.Mesh;
  matTrilha: THREE.MeshBasicMaterial;
  matGota: THREE.MeshStandardMaterial;
  fase: number;
}

interface EntradaRotulo {
  el: HTMLDivElement;
  largura: number;
  altura: number;
}

function useReducedMotion(): boolean {
  const [reduzido, setReduzido] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = () => setReduzido(mq.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return reduzido;
}

function useDocumentoVisivel(): boolean {
  const [visivel, setVisivel] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const listener = () => setVisivel(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, []);
  return visivel;
}

/** Nome curto para o cartucho: 18 caracteres, quebrando em palavra quando dá. */
function nomeCurto(titulo: string): string {
  const t = (titulo ?? "").trim() || "(sem título)";
  if (t.length <= 18) return t;
  const corte = t.slice(0, 18);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > 8 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}

function hexCss(cor: number): string {
  return `#${cor.toString(16).padStart(6, "0")}`;
}

function descartar(obj: THREE.Object3D) {
  obj.traverse((filho) => {
    if (!(filho instanceof THREE.Mesh)) return;
    filho.geometry.dispose();
    const mat = filho.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
  });
}

/**
 * Miniaturas da legenda: renderiza os modelos de verdade num renderer
 * descartável. Emoji não servia — 🌰🌱🌿🌳 não se parecem com o que está na
 * cena, então a legenda explicava outra coisa.
 */
function gerarMiniaturas(paleta: PaletaMapa): Record<EstagioCrescimento, string> | null {
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(96, 96);
    renderer.setPixelRatio(2);

    const saida = {} as Record<EstagioCrescimento, string>;
    for (const estagio of ESTAGIOS) {
      const cena = new THREE.Scene();
      cena.add(new THREE.AmbientLight(0xffffff, 0.8));
      const luz = new THREE.DirectionalLight(paleta.luzSol, 1.5);
      luz.position.set(3, 5, 2);
      cena.add(luz);

      const { grupo, altura } = construirModelo(estagio, `miniatura-${estagio}`, paleta);
      cena.add(grupo);

      const lado = altura * 0.78;
      const camera = new THREE.OrthographicCamera(-lado, lado, lado, -lado, 0.1, 50);
      camera.position.set(2, 2, 2);
      camera.lookAt(0, altura * 0.45, 0);

      renderer.render(cena, camera);
      saida[estagio] = renderer.domElement.toDataURL("image/png");
      descartar(grupo);
    }
    return saida;
  } catch {
    // Sem WebGL para o renderer extra: a legenda cai no chip de cor.
    return null;
  } finally {
    renderer?.dispose();
  }
}

export function MapaEcossistema({
  projects,
  percentualFundo,
  ofertasPorProjeto,
  onAbrirProjeto,
}: {
  projects: Project[];
  percentualFundo: number;
  ofertasPorProjeto: Map<string, number>;
  onAbrirProjeto: (id: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const visivel = useDocumentoVisivel();
  const animar = !reducedMotion && visivel;

  const [paleta, setPaleta] = useState<PaletaMapa>(() => lerPaleta());
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [legendaAberta, setLegendaAberta] = useState(false);
  const [miniaturas, setMiniaturas] = useState<Record<EstagioCrescimento, string> | null>(null);
  const [kit, setKit] = useState<Map<string, THREE.Group> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const alvoRef = useRef(new THREE.Vector3(0, 0, 0));
  /**
   * `extensao` é (largura + profundidade) do mapa em unidades de mundo. O
   * frustum sai daí, mas só na hora de aplicar, porque depende do aspecto do
   * container. Projeção isométrica com direção (1,1,1):
   *   extensão na horizontal da tela = (W+D)/√2  ≈ 0,7071·(W+D)
   *   extensão na vertical  da tela = (W+D)/√6  ≈ 0,4082·(W+D)
   * Guardar um `frustum` fixo (como estava) desperdiçava metade do canvas.
   */
  const enquadramentoRef = useRef({ extensao: 14, alvo: new THREE.Vector3(0, 0, 0) });
  const calcularFrustum = useCallback((aspecto: number) => {
    const { extensao } = enquadramentoRef.current;
    const precisaVertical = extensao * 0.4082;
    const precisaHorizontal = aspecto > 0 ? (extensao * 0.7071) / aspecto : precisaVertical;
    // Folga para a altura dos modelos e para o cartucho que fica acima deles.
    return Math.max(precisaVertical, precisaHorizontal, 6) * 1.06 + 2.4;
  }, []);

  const projetosRef = useRef(new Map<string, EntradaProjeto>());
  const estradasRef = useRef<EntradaEstrada[]>([]);
  const gotasRef = useRef<EntradaGota[]>([]);
  const rotulosRef = useRef(new Map<string, EntradaRotulo>());
  const cenarioRef = useRef<THREE.Object3D[]>([]);
  const nuvensRef = useRef<THREE.Mesh[]>([]);
  const terrenoRef = useRef<THREE.InstancedMesh | null>(null);
  const siloRef = useRef<{ grupo: THREE.Group; anel: THREE.Mesh; base: THREE.Vector3; altura: number } | null>(null);
  const placaSiloRef = useRef<HTMLDivElement | null>(null);
  const texturaSombraRef = useRef<THREE.Texture | null>(null);

  const pendenteRef = useRef<{ tipo: "raf" | "timeout"; id: number } | null>(null);
  const animarRef = useRef(animar);
  animarRef.current = animar;
  const selecionadoRef = useRef<string | null>(null);
  selecionadoRef.current = selecionadoId;
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hoverId;
  const relacionadosRef = useRef<Set<string>>(new Set());
  const raycasterRef = useRef(new THREE.Raycaster());
  const arrastando = useRef<{ x: number; y: number } | null>(null);
  const moveu = useRef(false);

  // -------------------------------------------------------------------------
  // Dados derivados
  // -------------------------------------------------------------------------
  const conexoes = useMemo(() => derivarConexoes(projects), [projects]);
  const saldos = useMemo(() => calcularSaldosRealistas(projects), [projects]);
  const saldoPorId = useMemo(() => new Map(saldos.map((s) => [s.projectId, s.saldoMensalRealista])), [saldos]);
  const projetoPorId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const estagioPorId = useMemo(() => new Map(projects.map((p) => [p.id, estagioDoProjeto(p)])), [projects]);

  const layout = useMemo(() => calcularLayout(projects.map((p) => ({ id: p.id, grupo: p.municipioId })), conexoes), [projects, conexoes]);

  /** Assinatura estável das ofertas — o pai monta um Map novo a cada render. */
  const ofertasChave = useMemo(
    () =>
      Array.from(ofertasPorProjeto.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([id, n]) => `${id}:${n}`)
        .join(","),
    [ofertasPorProjeto],
  );

  const relacoesDoSelecionado = useMemo(() => {
    if (!selecionadoId) return [];
    return conexoes
      .filter((c) => c.deId === selecionadoId || c.paraId === selecionadoId)
      .map((c) => {
        const souOrigem = c.deId === selecionadoId;
        const outroId = souOrigem ? c.paraId : c.deId;
        return {
          outroId,
          direcao: souOrigem ? ("fornece" as const) : ("recebe" as const),
          outroTitulo: projetoPorId.get(outroId)?.titulo || "(projeto removido)",
          rotulo: c.rotulo,
        };
      });
  }, [selecionadoId, conexoes, projetoPorId]);

  const resumo = useMemo(() => {
    let travados = 0;
    let prontos = 0;
    for (const estagio of estagioPorId.values()) {
      if (estagio === "semente") travados++;
      else if (estagio === "arvore") prontos++;
    }
    const poolMensal = saldos.reduce((soma, s) => (s.saldoMensalRealista > 0 ? soma + s.saldoMensalRealista * (percentualFundo / 100) : soma), 0);
    return { total: projects.length, travados, prontos, poolMensal };
  }, [estagioPorId, saldos, percentualFundo, projects.length]);

  // -------------------------------------------------------------------------
  // Render sob demanda: `agendar()` marca um frame; o loop só se repete
  // sozinho enquanto houver animação ativa.
  //
  // ARMADILHA JÁ PAGA TRÊS VEZES NESTE PROJETO: `requestAnimationFrame` NÃO
  // dispara quando `document.visibilityState === "hidden"` — que é como o
  // painel de preview roda. Um agendamento sob demanda em rAF simplesmente
  // nunca renderiza ali. Então: rAF só para o loop animado (que por definição
  // só existe com o documento visível), e `setTimeout` para o disparo avulso,
  // que chega em qualquer estado de visibilidade.
  // -------------------------------------------------------------------------
  const desenharFrameRef = useRef<() => void>(() => {});
  const agendar = useCallback(() => {
    if (pendenteRef.current != null) return;
    const executar = () => {
      pendenteRef.current = null;
      desenharFrameRef.current();
    };
    pendenteRef.current = animarRef.current
      ? { tipo: "raf", id: requestAnimationFrame(executar) }
      : { tipo: "timeout", id: window.setTimeout(executar, 0) };
  }, []);

  const cancelarPendente = useCallback(() => {
    const pendente = pendenteRef.current;
    if (!pendente) return;
    if (pendente.tipo === "raf") cancelAnimationFrame(pendente.id);
    else clearTimeout(pendente.id);
    pendenteRef.current = null;
  }, []);

  // -------------------------------------------------------------------------
  // Tema e kit opcional
  // -------------------------------------------------------------------------
  useEffect(() => observarTema(setPaleta), []);

  useEffect(() => {
    setMiniaturas(gerarMiniaturas(paleta));
  }, [paleta]);

  useEffect(() => {
    if (!existeKitGlTF()) return;
    let vivo = true;
    void carregarKit().then((carregado) => {
      if (vivo) setKit(carregado);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Cena: criada uma vez.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const largura = container.clientWidth || 800;
    const altura = container.clientHeight || 560;
    const aspecto = largura / altura;
    const frustum = calcularFrustum(aspecto);
    const camera = new THREE.OrthographicCamera((-frustum * aspecto) / 2, (frustum * aspecto) / 2, frustum / 2, -frustum / 2, 0.1, 400);
    camera.position.set(60, 60, 60);
    camera.lookAt(alvoRef.current);
    camera.updateProjectionMatrix();
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(largura, altura);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    texturaSombraRef.current = texturaSombraContato();

    function aoRedimensionar() {
      const cam = cameraRef.current;
      const rend = rendererRef.current;
      if (!container || !cam || !rend) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      const asp = w / h;
      const f = calcularFrustum(asp);
      cam.left = (-f * asp) / 2;
      cam.right = (f * asp) / 2;
      cam.top = f / 2;
      cam.bottom = -f / 2;
      cam.updateProjectionMatrix();
      rend.setSize(w, h);
      agendar();
    }
    const observador = new ResizeObserver(aoRedimensionar);
    observador.observe(container);

    agendar();

    return () => {
      cancelarPendente();
      observador.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      texturaSombraRef.current?.dispose();
      rendererRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
    };
  }, [agendar, cancelarPendente, calcularFrustum]);

  // -------------------------------------------------------------------------
  // Cenário do tema: luzes, névoa, água, nuvens.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    for (const obj of cenarioRef.current) {
      scene.remove(obj);
      descartar(obj);
    }
    cenarioRef.current = [];
    nuvensRef.current = [];

    scene.fog = paleta.altoContraste ? null : new THREE.FogExp2(paleta.neblina, 0.026);

    const ambiente = new THREE.AmbientLight(0xffffff, paleta.altoContraste ? 0.9 : 0.6);
    const sol = new THREE.DirectionalLight(paleta.luzSol, paleta.altoContraste ? 0.9 : 1.25);
    sol.position.set(14, 22, 9);
    sol.castShadow = !paleta.altoContraste;
    sol.shadow.mapSize.set(2048, 2048);
    sol.shadow.camera.left = -34;
    sol.shadow.camera.right = 34;
    sol.shadow.camera.top = 34;
    sol.shadow.camera.bottom = -34;
    sol.shadow.bias = -0.0012;
    // Contraluz fria: separa a silhueta do fundo sem clarear a cena.
    const contraluz = new THREE.DirectionalLight(paleta.luzContra, paleta.altoContraste ? 0.2 : 0.5);
    contraluz.position.set(-12, 8, -14);

    const agua = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: paleta.agua, roughness: 0.35, metalness: 0.1 }));
    agua.rotation.x = -Math.PI / 2;
    agua.position.y = NIVEL_AGUA;

    scene.add(ambiente, sol, contraluz, agua);
    cenarioRef.current.push(ambiente, sol, contraluz, agua);

    if (!paleta.altoContraste) {
      for (let i = 0; i < 3; i++) {
        const matNuvem = new THREE.MeshStandardMaterial({ color: ajustarBrilho(paleta.text, 0.2), transparent: true, opacity: 0.14, flatShading: true });
        const nuvem = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + i * 0.4, 0), matNuvem);
        nuvem.scale.set(2.2, 0.5, 1.4);
        nuvem.position.set(-24 + i * 17, 8 + i * 1.1, -8 + i * 9);
        scene.add(nuvem);
        cenarioRef.current.push(nuvem);
        nuvensRef.current.push(nuvem);
      }
    }

    agendar();
  }, [paleta, agendar]);

  // -------------------------------------------------------------------------
  // Terreno: tiles hexagonais instanciados.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (terrenoRef.current) {
      scene.remove(terrenoRef.current);
      terrenoRef.current.geometry.dispose();
      (terrenoRef.current.material as THREE.Material).dispose();
      terrenoRef.current = null;
    }
    if (layout.terreno.length === 0) {
      agendar();
      return;
    }

    // Prisma com o topo em y=0: a matriz de instância escala para baixo, então
    // o topo cai exatamente na altura do tile e o modelo assenta reto.
    const geometria = new THREE.CylinderGeometry(TILE_RAIO * 0.985, TILE_RAIO * 0.985, 1, 6);
    geometria.translate(0, -0.5, 0);
    const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });
    const malha = new THREE.InstancedMesh(geometria, material, layout.terreno.length);
    malha.castShadow = true;
    malha.receiveShadow = true;

    const matriz = new THREE.Matrix4();
    const cor = new THREE.Color();
    layout.terreno.forEach((tile, i) => {
      const { x, z } = hexParaMundo(tile.q, tile.r);
      const alturaTopo = alturaDoTile(tile);
      matriz.makeScale(1, alturaTopo + 0.9, 1);
      matriz.setPosition(x, alturaTopo, z);
      malha.setMatrixAt(i, matriz);

      const naCosta = layout.costa.has(chaveTile(tile));
      const base = naCosta ? misturar(paleta.soloTopo, paleta.costa, 0.55) : paleta.soloTopo;
      // Tom sutil: ±7% de brilho, descorrelacionado da altura.
      cor.setHex(ajustarBrilho(base, (tomDoTile(tile) - 0.5) * 0.14));
      malha.setColorAt(i, cor);
    });
    malha.instanceMatrix.needsUpdate = true;
    if (malha.instanceColor) malha.instanceColor.needsUpdate = true;

    scene.add(malha);
    terrenoRef.current = malha;
    agendar();
  }, [layout, paleta, agendar]);

  // -------------------------------------------------------------------------
  // Projetos, estradas, silo e gotas.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    const container = containerRef.current;
    if (!scene || !container) return;

    for (const entrada of projetosRef.current.values()) {
      scene.remove(entrada.grupo, entrada.hitbox, entrada.anelSeveridade, entrada.anelDestaque, entrada.sombra);
      descartar(entrada.grupo);
      descartar(entrada.hitbox);
      descartar(entrada.anelSeveridade);
      descartar(entrada.anelDestaque);
      entrada.sombra.geometry.dispose();
      (entrada.sombra.material as THREE.Material).dispose();
    }
    projetosRef.current.clear();
    for (const estrada of estradasRef.current) {
      scene.remove(estrada.malha);
      descartar(estrada.malha);
    }
    estradasRef.current = [];
    for (const gota of gotasRef.current) {
      scene.remove(gota.trilha, gota.gota);
      descartar(gota.trilha);
      descartar(gota.gota);
    }
    gotasRef.current = [];
    if (siloRef.current) {
      scene.remove(siloRef.current.grupo);
      descartar(siloRef.current.grupo);
      siloRef.current = null;
    }
    for (const rotulo of rotulosRef.current.values()) rotulo.el.remove();
    rotulosRef.current.clear();
    placaSiloRef.current?.remove();
    placaSiloRef.current = null;

    if (projects.length === 0) {
      agendar();
      return;
    }

    const topoDoTile = (tile: Coord) => {
      const { x, z } = hexParaMundo(tile.q, tile.r);
      return new THREE.Vector3(x, alturaDoTile(tile), z);
    };

    // ---- Projetos --------------------------------------------------------
    for (const p of projects) {
      const tile = layout.posicoes.get(p.id);
      if (!tile) continue;
      const base = topoDoTile(tile);
      const estagio = estagioPorId.get(p.id) ?? "broto";
      const corEstagio = corDoEstagio(estagio, paleta);

      const { grupo, materiais, altura } = construirModelo(estagio, p.id, paleta, kit);
      grupo.position.copy(base);
      grupo.rotation.y = giroDoProjeto(p.id);
      scene.add(grupo);

      // Sombra de contato (AO falso) — é o que dá peso ao modelo no tile.
      const sombra = new THREE.Mesh(
        new THREE.PlaneGeometry(TILE_RAIO * 2.1, TILE_RAIO * 2.1),
        new THREE.MeshBasicMaterial({ map: texturaSombraRef.current, transparent: true, depthWrite: false, opacity: paleta.altoContraste ? 0 : 0.9 }),
      );
      sombra.rotation.x = -Math.PI / 2;
      sombra.position.set(base.x, base.y + 0.008, base.z);
      scene.add(sombra);

      // Anel de severidade: cor + forma + texto, a regra do design system.
      const anelSeveridade = new THREE.Mesh(
        new THREE.RingGeometry(TILE_RAIO * 0.7, TILE_RAIO * 0.86, 6),
        new THREE.MeshBasicMaterial({ color: corEstagio, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
      );
      anelSeveridade.rotation.x = -Math.PI / 2;
      anelSeveridade.position.set(base.x, base.y + 0.016, base.z);
      scene.add(anelSeveridade);

      const anelDestaque = new THREE.Mesh(
        new THREE.RingGeometry(TILE_RAIO * 0.9, TILE_RAIO * 0.99, 6),
        new THREE.MeshBasicMaterial({ color: paleta.text, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
      );
      anelDestaque.rotation.x = -Math.PI / 2;
      anelDestaque.position.set(base.x, base.y + 0.02, base.z);
      anelDestaque.visible = false;
      scene.add(anelDestaque);

      const hitbox = new THREE.Mesh(new THREE.CylinderGeometry(TILE_RAIO * 0.95, TILE_RAIO * 0.95, altura + 0.3, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hitbox.position.set(base.x, base.y + (altura + 0.3) / 2, base.z);
      hitbox.userData.projectId = p.id;
      scene.add(hitbox);

      projetosRef.current.set(p.id, {
        id: p.id,
        grupo,
        hitbox,
        anelSeveridade,
        anelDestaque,
        sombra,
        materiais,
        base,
        altura,
        elevacao: 0,
        elevacaoAlvo: 0,
        estagio,
      });

      // ---- Rótulo em cartucho -------------------------------------------
      const el = document.createElement("div");
      el.style.cssText = [
        "position:absolute",
        "left:0",
        "top:0",
        "pointer-events:none",
        "white-space:nowrap",
        "display:flex",
        "align-items:center",
        "gap:5px",
        "padding:3px 7px",
        "border-radius:5px",
        "font-size:13px",
        "line-height:1.15",
        "visibility:hidden",
        "transform:translate(-9999px,-9999px)",
        "color:var(--sm-text)",
        "background:color-mix(in srgb, var(--sm-panel) 88%, transparent)",
        "border:1px solid var(--sm-border)",
        "box-shadow:0 2px 6px rgba(0,0,0,0.45)",
      ].join(";");

      const ponto = document.createElement("span");
      ponto.style.cssText = `width:7px;height:7px;border-radius:2px;flex:none;background:${hexCss(corEstagio)}`;
      el.appendChild(ponto);

      const texto = document.createElement("span");
      texto.textContent = nomeCurto(p.titulo);
      el.appendChild(texto);

      const ofertas = ofertasPorProjeto.get(p.id) ?? 0;
      if (ofertas > 0) {
        const pilula = document.createElement("span");
        pilula.textContent = `${ofertas} oferta${ofertas > 1 ? "s" : ""}`;
        pilula.style.cssText = ["font-size:11px", "padding:1px 5px", "border-radius:99px", `color:${hexCss(paleta.ouro)}`, `border:1px solid ${hexCss(paleta.ouro)}`].join(";");
        el.appendChild(pilula);
      }

      container.appendChild(el);
      // Uma medição por reconstrução — o declutter usa isto e nunca lê layout por frame.
      rotulosRef.current.set(p.id, { el, largura: el.offsetWidth, altura: el.offsetHeight });
    }

    // ---- Silo do Fundo Rotativo ------------------------------------------
    if (layout.terreno.length > 0) {
      const ocupados = new Set(Array.from(layout.posicoes.values()).map(chaveTile));
      let somaQ = 0;
      let somaR = 0;
      for (const t of layout.terreno) {
        somaQ += t.q;
        somaR += t.r;
      }
      const centro: Coord = { q: Math.round(somaQ / layout.terreno.length), r: Math.round(somaR / layout.terreno.length) };
      const livres = layout.terreno.filter((t) => !ocupados.has(chaveTile(t))).sort((a, b) => distanciaHex(a, centro) - distanciaHex(b, centro));
      const tileSilo = livres[0] ?? layout.terreno[0];
      const base = topoDoTile(tileSilo);
      const { grupo, anel, altura } = construirSilo(paleta);
      grupo.position.copy(base);
      scene.add(grupo);
      siloRef.current = { grupo, anel, base, altura };

      const placa = document.createElement("div");
      placa.style.cssText = [
        "position:absolute",
        "left:0",
        "top:0",
        "pointer-events:none",
        "white-space:nowrap",
        "padding:3px 8px",
        "border-radius:5px",
        "font-size:12px",
        "transform:translate(-9999px,-9999px)",
        `color:${hexCss(paleta.ouro)}`,
        "background:color-mix(in srgb, var(--sm-panel) 90%, transparent)",
        `border:1px solid ${hexCss(paleta.ouro)}`,
      ].join(";");
      placa.textContent = `Fundo Rotativo Solidário — ${percentualFundo}%`;
      container.appendChild(placa);
      placaSiloRef.current = placa;
    }

    // ---- Estradas: fita assentada no topo dos tiles -----------------------
    for (const caminho of layout.caminhos) {
      if (caminho.tiles.length < 2) continue;
      const pontos = caminho.tiles.map((t) => {
        const ponto = topoDoTile(t);
        ponto.y += 0.014;
        return ponto;
      });
      const material = new THREE.MeshStandardMaterial({
        color: paleta.estrada,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      });
      const malha = new THREE.Mesh(construirFitaGeometria(pontos, TILE_RAIO * 0.5), material);
      malha.receiveShadow = true;
      scene.add(malha);
      estradasRef.current.push({ deId: caminho.deId, paraId: caminho.paraId, malha, material });
    }

    // ---- Gotas do Fundo Rotativo -----------------------------------------
    // Arco baixo, de propósito distinto da estrada: estrada é troca de material
    // entre projetos, a gota é dinheiro indo/vindo do fundo.
    const silo = siloRef.current;
    if (silo) {
      projects.forEach((p, indice) => {
        const saldo = saldoPorId.get(p.id) ?? 0;
        const tile = layout.posicoes.get(p.id);
        if (!tile || saldo === 0) return;
        const contribui = saldo > 0;
        const volume = contribui ? saldo * (percentualFundo / 100) : saldo;
        const quantas = Math.max(1, Math.min(3, Math.ceil(Math.abs(volume) / 400)));
        const topoProjeto = topoDoTile(tile);
        const pontoProjeto = topoProjeto.clone().setY(topoProjeto.y + 0.5);
        const pontoSilo = silo.base.clone().setY(silo.base.y + 0.85);
        const origem = contribui ? pontoProjeto : pontoSilo;
        const destino = contribui ? pontoSilo : pontoProjeto;

        for (let g = 0; g < quantas; g++) {
          const meio = origem.clone().lerp(destino, 0.5);
          meio.y += 0.9 + g * 0.16;
          const curva = new THREE.CatmullRomCurve3([origem.clone(), meio, destino.clone()]);

          const matTrilha = new THREE.MeshBasicMaterial({ color: paleta.ouro, transparent: true, opacity: 0.5 });
          const trilha = new THREE.Mesh(new THREE.TubeGeometry(curva, 22, 0.016, 5, false), matTrilha);
          scene.add(trilha);

          const matGota = new THREE.MeshStandardMaterial({ color: paleta.ouro, emissive: paleta.ouro, emissiveIntensity: 0.85, transparent: true, opacity: 1 });
          const gota = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 8), matGota);
          gota.position.copy(curva.getPointAt(0.5));
          scene.add(gota);

          gotasRef.current.push({ projectId: p.id, curva, trilha, gota, matTrilha, matGota, fase: ((indice * 3 + g) % 7) / 7 });
        }
      });
    }

    // ---- Enquadramento ---------------------------------------------------
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const tile of layout.terreno) {
      const { x, z } = hexParaMundo(tile.q, tile.r);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    if (Number.isFinite(minX)) {
      const centroX = (minX + maxX) / 2;
      const centroZ = (minZ + maxZ) / 2;
      // Guarda só (W+D); o frustum sai disso em `calcularFrustum`, que conhece
      // o aspecto real do container.
      enquadramentoRef.current = { extensao: maxX - minX + (maxZ - minZ), alvo: new THREE.Vector3(centroX, 0, centroZ) };
    }

    agendar();
  }, [projects, layout, paleta, kit, estagioPorId, saldoPorId, percentualFundo, ofertasChave, ofertasPorProjeto, agendar]);

  /** Recoloca a câmera no enquadramento calculado. O ângulo nunca muda. */
  const recentralizar = useCallback(() => {
    const cam = cameraRef.current;
    const container = containerRef.current;
    if (!cam || !container) return;
    const { alvo } = enquadramentoRef.current;
    const asp = (container.clientWidth || 1) / (container.clientHeight || 1);
    const frustum = calcularFrustum(asp);
    cam.left = (-frustum * asp) / 2;
    cam.right = (frustum * asp) / 2;
    cam.top = frustum / 2;
    cam.bottom = -frustum / 2;
    cam.zoom = 1;
    alvoRef.current.copy(alvo);
    cam.position.set(alvo.x + 80, alvo.y + 80, alvo.z + 80);
    cam.lookAt(alvoRef.current);
    cam.updateProjectionMatrix();
    agendar();
  }, [agendar, calcularFrustum]);

  useEffect(() => {
    recentralizar();
  }, [layout, recentralizar]);

  // -------------------------------------------------------------------------
  // Realce de seleção / hover — comparação por ID (antes era por título, e
  // homônimos ou dois "(sem título)" acendiam juntos).
  // -------------------------------------------------------------------------
  useEffect(() => {
    relacionadosRef.current = new Set(relacoesDoSelecionado.map((r) => r.outroId));
    const relacionados = relacionadosRef.current;

    for (const [pid, entrada] of projetosRef.current) {
      const selecionado = pid === selecionadoId;
      const emHover = pid === hoverId;
      const esmaecido = selecionadoId != null && !selecionado && !relacionados.has(pid);
      entrada.anelDestaque.visible = selecionado || emHover;
      entrada.elevacaoAlvo = emHover || selecionado ? ELEVACAO_HOVER : 0;

      const opacidade = esmaecido ? 0.3 : 1;
      for (const mat of entrada.materiais) {
        mat.transparent = opacidade < 1;
        mat.opacity = opacidade;
      }
      (entrada.anelSeveridade.material as THREE.MeshBasicMaterial).opacity = esmaecido ? 0.25 : 0.9;
      (entrada.sombra.material as THREE.MeshBasicMaterial).opacity = paleta.altoContraste ? 0 : esmaecido ? 0.3 : 0.9;
    }

    for (const estrada of estradasRef.current) {
      const destacada = selecionadoId != null && (estrada.deId === selecionadoId || estrada.paraId === selecionadoId);
      const esmaecida = selecionadoId != null && !destacada;
      estrada.material.color.setHex(destacada ? paleta.accent : paleta.estrada);
      estrada.material.opacity = esmaecida ? 0.25 : 0.95;
    }

    for (const gota of gotasRef.current) {
      const esmaecida = selecionadoId != null && gota.projectId !== selecionadoId;
      gota.matTrilha.opacity = esmaecida ? 0.12 : 0.5;
      gota.matGota.opacity = esmaecida ? 0.2 : 1;
    }

    agendar();
  }, [selecionadoId, hoverId, relacoesDoSelecionado, paleta, agendar]);

  // Ao (re)entrar em modo animado, religa o loop; ao sair, um último frame.
  useEffect(() => {
    agendar();
  }, [animar, agendar]);

  // -------------------------------------------------------------------------
  // O frame
  // -------------------------------------------------------------------------
  desenharFrameRef.current = () => {
    const cam = cameraRef.current;
    const scene = sceneRef.current;
    const rend = rendererRef.current;
    const container = containerRef.current;
    if (!cam || !scene || !rend || !container) return;

    const animando = animarRef.current;
    let continuar = false;

    if (animando) {
      const t = performance.now() / 1000;
      if (siloRef.current) siloRef.current.anel.rotation.z = t * 0.35;
      for (const gota of gotasRef.current) {
        gota.gota.position.copy(gota.curva.getPointAt((t / 3.2 + gota.fase) % 1));
      }
      for (const nuvem of nuvensRef.current) {
        nuvem.position.x += 0.004;
        if (nuvem.position.x > 36) nuvem.position.x = -36;
      }
      continuar = true;
    }

    // Elevação no hover, com amortecimento. Sob reduced-motion, sem transição.
    for (const entrada of projetosRef.current.values()) {
      const alvo = entrada.elevacaoAlvo;
      if (Math.abs(entrada.elevacao - alvo) > 0.001) {
        if (animando) {
          entrada.elevacao += (alvo - entrada.elevacao) * 0.22;
          continuar = true;
        } else {
          entrada.elevacao = alvo;
        }
      } else {
        entrada.elevacao = alvo;
      }
      entrada.grupo.position.y = entrada.base.y + entrada.elevacao;
    }

    rend.render(scene, cam);
    posicionarRotulos(cam, container);

    if (continuar && animarRef.current) agendar();
  };

  /**
   * Projeta 3D → tela, ordena por prioridade e derruba quem colide. Sem isto o
   * mapa vira um borrão de texto sobre texto.
   */
  function posicionarRotulos(cam: THREE.OrthographicCamera, container: HTMLElement) {
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const selecionado = selecionadoRef.current;
    const hover = hoverRef.current;
    const relacionados = relacionadosRef.current;
    const mostrarTodos = cam.zoom >= ZOOM_ROTULOS;
    const vetor = new THREE.Vector3();

    const candidatos: { rotulo: EntradaRotulo; x: number; y: number; prioridade: number }[] = [];

    for (const [pid, entrada] of projetosRef.current) {
      const rotulo = rotulosRef.current.get(pid);
      if (!rotulo) continue;

      const prioridade =
        pid === selecionado ? 5 : pid === hover ? 4 : relacionados.has(pid) ? 3 : entrada.estagio === "arvore" ? 2 : entrada.estagio === "muda" ? 1 : 0;

      // Nada de filtro por estágio aqui: um portfólio inteiro em "broto"
      // (caso comum) deixaria o mapa sem UM rótulo sequer. Quem decide o que
      // cabe é o teste de colisão abaixo, na ordem de prioridade — ao dar
      // zoom os modelos se afastam e mais rótulos entram sozinhos.

      vetor.set(entrada.base.x, entrada.base.y + entrada.altura + entrada.elevacao + 0.22, entrada.base.z).project(cam);
      if (!Number.isFinite(vetor.x) || !Number.isFinite(vetor.y)) {
        rotulo.el.style.visibility = "hidden";
        continue;
      }
      const x = ((vetor.x + 1) / 2) * rect.width;
      const y = ((1 - vetor.y) / 2) * rect.height;
      if (x < -80 || x > rect.width + 80 || y < -40 || y > rect.height + 40) {
        rotulo.el.style.visibility = "hidden";
        continue;
      }
      candidatos.push({ rotulo, x, y, prioridade });
    }

    candidatos.sort((a, b) => b.prioridade - a.prioridade || a.y - b.y);

    // Respiro maior com o mapa afastado: menos rótulos e menos ruído de longe,
    // densidade cheia quando o usuário aproxima.
    const respiroX = mostrarTodos ? 4 : 12;
    const respiroY = mostrarTodos ? 3 : 9;

    const aceitos: { x1: number; y1: number; x2: number; y2: number }[] = [];

    // A placa do silo entra ANTES de todo mundo e reserva o espaço dela: ela é
    // fixa e sempre visível, então quem tem que sair da frente é o rótulo.
    const silo = siloRef.current;
    const placa = placaSiloRef.current;
    if (silo && placa) {
      vetor.set(silo.base.x, silo.base.y + silo.altura + 0.25, silo.base.z).project(cam);
      const x = ((vetor.x + 1) / 2) * rect.width;
      const y = ((1 - vetor.y) / 2) * rect.height;
      const larguraPlaca = placa.offsetWidth;
      const alturaPlaca = placa.offsetHeight;
      const x1 = Math.max(2, Math.min(x - larguraPlaca / 2, rect.width - larguraPlaca - 2));
      const y1 = Math.max(2, Math.min(y - alturaPlaca, rect.height - alturaPlaca - 2));
      placa.style.transform = `translate(${x1.toFixed(1)}px, ${y1.toFixed(1)}px)`;
      aceitos.push({ x1, y1, x2: x1 + larguraPlaca, y2: y1 + alturaPlaca });
    }

    for (const c of candidatos) {
      const { largura, altura } = c.rotulo;
      // Âncora centrada na base do cartucho, logo acima do modelo — e presa
      // dentro da moldura: o container é overflow:hidden, então um cartucho
      // que vaza a borda simplesmente some pela metade.
      const x1 = Math.max(2, Math.min(c.x - largura / 2, rect.width - largura - 2));
      const y1 = Math.max(2, Math.min(c.y - altura, rect.height - altura - 2));
      const caixa = { x1, y1, x2: x1 + largura, y2: y1 + altura };
      const colide = aceitos.some((a) => caixa.x1 < a.x2 + respiroX && caixa.x2 + respiroX > a.x1 && caixa.y1 < a.y2 + respiroY && caixa.y2 + respiroY > a.y1);
      if (colide) {
        c.rotulo.el.style.visibility = "hidden";
        continue;
      }
      aceitos.push(caixa);
      c.rotulo.el.style.transform = `translate(${x1.toFixed(1)}px, ${y1.toFixed(1)}px)`;
      c.rotulo.el.style.visibility = "visible";
      c.rotulo.el.style.opacity = selecionado != null && c.prioridade < 3 ? "0.4" : "1";
    }
  }

  // -------------------------------------------------------------------------
  // Interação: zoom, pan, hover, seleção. A câmera nunca gira.
  // -------------------------------------------------------------------------
  function aplicarZoom(fator: number) {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.zoom * fator));
    cam.updateProjectionMatrix();
    agendar();
  }

  function projetoSobPonteiro(clientX: number, clientY: number): string | null {
    const container = containerRef.current;
    const cam = cameraRef.current;
    if (!container || !cam) return null;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(ndc, cam);
    const hitboxes = Array.from(projetosRef.current.values()).map((v) => v.hitbox);
    const acertos = raycaster.intersectObjects(hitboxes, false);
    return acertos.length > 0 ? (acertos[0].object.userData.projectId as string) : null;
  }

  function onWheel(e: React.WheelEvent) {
    aplicarZoom(e.deltaY > 0 ? 0.9 : 1.1);
  }

  function onPointerDown(e: React.PointerEvent) {
    arrastando.current = { x: e.clientX, y: e.clientY };
    moveu.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    const cam = cameraRef.current;
    if (!cam) return;

    if (arrastando.current) {
      const dx = e.clientX - arrastando.current.x;
      const dy = e.clientY - arrastando.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moveu.current = true;
      // Velocidade de arrasto proporcional ao que a câmera enxerga agora.
      const velocidade = (cam.top - cam.bottom) / 700 / cam.zoom;
      const els = cam.matrixWorld.elements;
      const direita = new THREE.Vector3(els[0], els[1], els[2]);
      const cima = new THREE.Vector3(els[4], els[5], els[6]);
      const delta = direita.multiplyScalar(-dx * velocidade).add(cima.multiplyScalar(dy * velocidade));
      cam.position.add(delta);
      alvoRef.current.add(delta);
      cam.lookAt(alvoRef.current);
      arrastando.current = { x: e.clientX, y: e.clientY };
      agendar();
      return;
    }

    const id = projetoSobPonteiro(e.clientX, e.clientY);
    if (id !== hoverRef.current) setHoverId(id);
  }

  function onPointerUp(e: React.PointerEvent) {
    arrastando.current = null;
    if (moveu.current) return;
    const id = projetoSobPonteiro(e.clientX, e.clientY);
    if (id == null) return;
    setSelecionadoId((atual) => (atual === id ? null : id));
  }

  const selecionado = selecionadoId ? projetoPorId.get(selecionadoId) : undefined;
  const estagioSelecionado = selecionado ? estagioPorId.get(selecionado.id) : undefined;

  return (
    <div className="relative overflow-hidden rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)]">
      {/* HUD: responde "o que está travado?" sem nenhum clique. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color:var(--sm-border)] px-3 py-2 text-sm">
        <span>
          <strong>{resumo.total}</strong> <span className="text-[color:var(--sm-text-dim)]">{resumo.total === 1 ? "projeto" : "projetos"}</span>
        </span>
        <span aria-hidden className="text-[color:var(--sm-border)]">
          ·
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[color:var(--sm-red)]" />
          <strong>{resumo.travados}</strong> travados
        </span>
        <span aria-hidden className="text-[color:var(--sm-border)]">
          ·
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[color:var(--sm-accent)]" />
          <strong>{resumo.prontos}</strong> prontos p/ exportar
        </span>
        <span aria-hidden className="text-[color:var(--sm-border)]">
          ·
        </span>
        <span className="text-[color:var(--sm-text-dim)]">fundo R$ {resumo.poolMensal.toFixed(0)}/mês</span>
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="relative h-[clamp(420px,58vh,760px)] w-full cursor-grab select-none overflow-hidden active:cursor-grabbing"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            arrastando.current = null;
            setHoverId(null);
          }}
        />

        {/* Vinheta em CSS, não em pós-processamento: mais barato e não mexe no canvas. */}
        {!paleta.altoContraste && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 45%, color-mix(in srgb, var(--sm-bg) 65%, transparent) 100%)" }}
          />
        )}

        {/* Legenda recolhível, com miniatura do modelo real. */}
        <div className="absolute left-3 top-3 max-w-[min(330px,72%)]">
          <button
            onClick={() => setLegendaAberta((v) => !v)}
            aria-expanded={legendaAberta}
            className="rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)]/90 px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]"
          >
            {legendaAberta ? "Fechar legenda" : "Como ler o mapa"}
          </button>
          {legendaAberta && (
            <div className="mt-1 space-y-2 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)]/95 p-2.5 text-xs">
              <ul className="space-y-1.5">
                {ESTAGIOS.map((estagio) => (
                  <li key={estagio} className="flex items-center gap-2">
                    {miniaturas ? (
                      <img src={miniaturas[estagio]} alt="" aria-hidden width={28} height={28} className="shrink-0" />
                    ) : (
                      <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-[2px]" style={{ background: hexCss(corDoEstagio(estagio, paleta)) }} />
                    )}
                    <span>
                      <strong>{ESTAGIO_NOME[estagio]}</strong> — {ESTAGIO_EXPLICACAO[estagio]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-[color:var(--sm-border)] pt-2 text-[color:var(--sm-text-dim)]">
                Projetos ligados entre si ficam no mesmo bairro. <strong>Estradas</strong> ligam quem fornece a quem. <strong>Gotas douradas</strong> vão de/para o silo do Fundo
                Rotativo. Clique 1× seleciona, 2× abre.
              </p>
              <p className="text-[color:var(--sm-text-dim)]">
                Prefere ler em texto? A aba <strong>Lista</strong> traz os mesmos dados sem o mapa.
              </p>
            </div>
          )}
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-1">
          <button
            onClick={() => aplicarZoom(1.25)}
            title="Aproximar"
            aria-label="Aproximar"
            className="h-8 w-8 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] text-base leading-none hover:border-[color:var(--sm-accent)]"
          >
            +
          </button>
          <button
            onClick={() => aplicarZoom(0.8)}
            title="Afastar"
            aria-label="Afastar"
            className="h-8 w-8 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] text-base leading-none hover:border-[color:var(--sm-accent)]"
          >
            −
          </button>
          <button
            onClick={() => {
              recentralizar();
              setSelecionadoId(null);
            }}
            title="Recentralizar o mapa"
            aria-label="Recentralizar o mapa"
            className="h-8 w-8 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] text-sm leading-none hover:border-[color:var(--sm-accent)]"
          >
            ⌂
          </button>
        </div>

        {projects.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[color:var(--sm-text-dim)]">Nenhum projeto cadastrado ainda.</p>
        )}

        {selecionado && (
          <div className="absolute bottom-3 right-3 w-72 space-y-2 rounded border border-[color:var(--sm-accent)]/50 bg-[color:var(--sm-panel)] p-3 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{selecionado.titulo || "(sem título)"}</p>
              <button onClick={() => setSelecionadoId(null)} aria-label="Fechar" className="shrink-0 text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
                ✕
              </button>
            </div>
            {estagioSelecionado && (
              <p className="inline-flex items-center gap-1.5 text-xs text-[color:var(--sm-text-dim)]">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: hexCss(corDoEstagio(estagioSelecionado, paleta)) }} />
                {ESTAGIO_NOME[estagioSelecionado]} — {ESTAGIO_EXPLICACAO[estagioSelecionado]}
              </p>
            )}
            <p className="text-xs">Saldo realista: R$ {(saldoPorId.get(selecionado.id) ?? 0).toFixed(0)}/mês</p>
            {relacoesDoSelecionado.length > 0 ? (
              <ul className="space-y-1 text-xs">
                {relacoesDoSelecionado.map((r, i) => (
                  <li key={i}>
                    {r.direcao === "fornece" ? "→ Fornece a" : "← Recebe de"} <strong>{r.outroTitulo}</strong>: {r.rotulo}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[color:var(--sm-text-dim)]">Sem conexões diretas identificadas com outros projetos ainda.</p>
            )}
            <button
              onClick={() => onAbrirProjeto(selecionado.id)}
              className="w-full rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-3 py-1.5 text-xs hover:bg-[color:var(--sm-accent)]/30"
            >
              Abrir projeto →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
