import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Project } from "../../lib/types";
import { calcularSaldosRealistas } from "../../lib/ecosystem";
import { estagioDoProjeto, derivarConexoes, ESTAGIO_ROTULO, type EstagioCrescimento, type ConexaoMapa } from "../../lib/mapa-estagios";
import { X } from "lucide-react";

/**
 * Mapa vivo do ecossistema — estilo isométrico de jogo (Sims/WoW visto de
 * cima), renderizado em three.js. Decisão registrada no plano: reverte a
 * escolha original de "só SVG/CSS, sem motor 3D" a pedido explícito do
 * usuário (câmera de jogo fixa + feixes de energia com profundidade real),
 * aceitando o custo de bundle/GPU de um motor 3D.
 *
 * Câmera isométrica FIXA (sem rotação livre) — só zoom e pan, como um
 * simulador de construção clássico. Cores espelham os tokens de
 * `src/index.css` (Three.js não lê CSS custom properties).
 */

const COR_SOLO_CENTRO = 0x243024;
const COR_SOLO_BORDA = 0x0f1410;
const COR_ACCENT = 0x6fae55;
const COR_ACCENT_CLARO = 0x8ccb6f;
const COR_ACCENT_ESCURO = 0x3e6b32;
const COR_TRONCO = 0x6b4f32;
const COR_OURO = 0xdcb464;
const COR_SEMENTE = 0x4a3826;
const COR_FLOR = 0xf5d9e8;

const RAIO_X = 6.4;
const RAIO_Z = 3.9;
const ALTURA_CAMERA_MIN = 6;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.6;

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

function posicoesEmElipse(n: number): { x: number; z: number }[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => {
    const angulo = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: RAIO_X * Math.cos(angulo), z: RAIO_Z * Math.sin(angulo) };
  });
}

/** Planta de baixo-poli (estilo game) por estágio de crescimento — mesma metáfora semente→árvore do resto do app, agora em volume real. */
function construirPlanta(estagio: EstagioCrescimento): THREE.Group {
  const grupo = new THREE.Group();

  const soloMat = new THREE.MeshStandardMaterial({ color: COR_SEMENTE, roughness: 0.9 });
  const solo = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.08, 10), soloMat);
  solo.position.y = 0.04;
  solo.receiveShadow = true;
  grupo.add(solo);

  if (estagio === "semente") {
    const semente = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshStandardMaterial({ color: COR_SEMENTE, roughness: 0.8 }));
    semente.position.y = 0.16;
    semente.castShadow = true;
    grupo.add(semente);
    return grupo;
  }

  const caule = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, estagio === "broto" ? 0.3 : 0.5, 6), new THREE.MeshStandardMaterial({ color: COR_ACCENT_ESCURO }));
  caule.position.y = (estagio === "broto" ? 0.3 : 0.5) / 2 + 0.08;
  caule.castShadow = true;
  grupo.add(caule);

  if (estagio === "broto") {
    const folha = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: COR_ACCENT_CLARO, flatShading: true }));
    folha.position.y = 0.42;
    folha.castShadow = true;
    grupo.add(folha);
    return grupo;
  }

  if (estagio === "muda") {
    const folha1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: COR_ACCENT, flatShading: true }));
    folha1.position.y = 0.58;
    folha1.castShadow = true;
    const folha2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: COR_ACCENT_CLARO, flatShading: true }));
    folha2.position.set(0.1, 0.75, 0.05);
    folha2.castShadow = true;
    grupo.add(folha1, folha2);
    return grupo;
  }

  // árvore: tronco mais grosso + copa em 3 blocos low-poly, estilo mundo de jogo.
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.55, 7), new THREE.MeshStandardMaterial({ color: COR_TRONCO }));
  tronco.position.y = 0.36;
  tronco.castShadow = true;
  grupo.add(tronco);

  const copaBase = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), new THREE.MeshStandardMaterial({ color: COR_ACCENT_ESCURO, flatShading: true }));
  copaBase.position.y = 0.78;
  copaBase.castShadow = true;
  const copaMeio = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: COR_ACCENT, flatShading: true }));
  copaMeio.position.set(-0.14, 0.92, 0.08);
  copaMeio.castShadow = true;
  const copaTopo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: COR_ACCENT_CLARO, flatShading: true }));
  copaTopo.position.set(0.12, 1.05, -0.05);
  copaTopo.castShadow = true;
  grupo.add(copaBase, copaMeio, copaTopo);

  for (const [dx, dy, dz, cor] of [
    [-0.1, 1.02, 0.2, COR_FLOR],
    [0.16, 0.9, 0.18, COR_FLOR],
    [0, 0.82, -0.05, COR_OURO],
  ] as const) {
    const flor = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.4 }));
    flor.position.set(dx, dy, dz);
    grupo.add(flor);
  }

  return grupo;
}

interface EntradaProjeto {
  group: THREE.Group;
  hitbox: THREE.Mesh;
  anel: THREE.Mesh;
  materiais: THREE.MeshStandardMaterial[];
  pos: THREE.Vector3;
}

interface EntradaAresta {
  deId: string;
  paraId: string;
  rotulo: string;
  tubo: THREE.Mesh;
  particula: THREE.Mesh;
  curva: THREE.CatmullRomCurve3;
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

  const containerRef = useRef<HTMLDivElement>(null);
  const legendaRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  const projetosRef = useRef(new Map<string, EntradaProjeto>());
  const arestasRef = useRef<EntradaAresta[]>([]);
  const labelsRef = useRef(new Map<string, HTMLDivElement>());
  const rafRef = useRef<number | null>(null);
  const animarRef = useRef(animar);
  animarRef.current = animar;

  const arrastando = useRef<{ x: number; y: number } | null>(null);
  const moveu = useRef(false);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const selecionadoRef = useRef<string | null>(null);
  selecionadoRef.current = selecionadoId;
  const [hoverId, setHoverId] = useState<string | null>(null);

  const conexoes = useMemo(() => derivarConexoes(projects), [projects]);
  const saldos = useMemo(() => calcularSaldosRealistas(projects), [projects]);
  const saldoPorId = useMemo(() => new Map(saldos.map((s) => [s.projectId, s.saldoMensalRealista])), [saldos]);
  const projetoPorId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const relacoesDoSelecionado = useMemo(() => {
    if (!selecionadoId) return [];
    return conexoes
      .filter((c) => c.deId === selecionadoId || c.paraId === selecionadoId)
      .map((c) => {
        const souOrigem = c.deId === selecionadoId;
        const outroId = souOrigem ? c.paraId : c.deId;
        const outro = projetoPorId.get(outroId);
        return { direcao: souOrigem ? ("fornece" as const) : ("recebe" as const), outroTitulo: outro?.titulo ?? "(projeto removido)", rotulo: c.rotulo };
      });
  }, [selecionadoId, conexoes, projetoPorId]);

  // ---------------------------------------------------------------------
  // Setup único da cena (câmera, luzes, terreno, controles) — não recria
  // a cada mudança de projetos, só ao montar/desmontar o componente.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const largura = container.clientWidth || 800;
    const altura = container.clientHeight || 520;
    const aspecto = largura / altura;
    const frustSize = 9;
    const camera = new THREE.OrthographicCamera(
      (-frustSize * aspecto) / 2,
      (frustSize * aspecto) / 2,
      frustSize / 2,
      -frustSize / 2,
      0.1,
      100,
    );
    // Ângulo isométrico clássico (~35.264°), travado — só zoom/pan, sem órbita livre.
    camera.position.set(ALTURA_CAMERA_MIN, ALTURA_CAMERA_MIN * 0.82, ALTURA_CAMERA_MIN);
    camera.lookAt(targetRef.current);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(largura, altura);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sol = new THREE.DirectionalLight(0xfff2d8, 1.1);
    sol.position.set(6, 10, 4);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    sol.shadow.camera.left = -10;
    sol.shadow.camera.right = 10;
    sol.shadow.camera.top = 10;
    sol.shadow.camera.bottom = -10;
    scene.add(sol);

    // Terreno: disco escuro com borda, mesma leitura do "canteiro coletivo" anterior.
    const terreno = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(RAIO_X, RAIO_Z) + 2.4, 48),
      new THREE.MeshStandardMaterial({ color: COR_SOLO_CENTRO, roughness: 1 }),
    );
    terreno.rotation.x = -Math.PI / 2;
    terreno.receiveShadow = true;
    scene.add(terreno);
    const bordaTerreno = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(RAIO_X, RAIO_Z) + 2.35, Math.max(RAIO_X, RAIO_Z) + 2.45, 48),
      new THREE.MeshBasicMaterial({ color: COR_SOLO_BORDA, side: THREE.DoubleSide }),
    );
    bordaTerreno.rotation.x = -Math.PI / 2;
    bordaTerreno.position.y = 0.001;
    scene.add(bordaTerreno);

    // Fundo Rotativo — anel central de energia dourada.
    const anelFundo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 10, 32), new THREE.MeshStandardMaterial({ color: COR_OURO, emissive: COR_OURO, emissiveIntensity: 0.5 }));
    anelFundo.rotation.x = Math.PI / 2;
    anelFundo.position.y = 0.4;
    anelFundo.name = "anel-fundo";
    scene.add(anelFundo);

    function aoRedimensionar() {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      const asp = w / h;
      const cam = cameraRef.current;
      cam.left = (-frustSize * asp) / 2;
      cam.right = (frustSize * asp) / 2;
      cam.top = frustSize / 2;
      cam.bottom = -frustSize / 2;
      cam.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    }
    const observer = new ResizeObserver(aoRedimensionar);
    observer.observe(container);

    function animarFrame() {
      rafRef.current = requestAnimationFrame(animarFrame);
      const cam = cameraRef.current;
      const scn = sceneRef.current;
      const rend = rendererRef.current;
      if (!cam || !scn || !rend) return;

      if (animarRef.current) {
        anelFundo.rotation.z += 0.005;
        const t = performance.now() / 1000;
        for (const aresta of arestasRef.current) {
          const progresso = (t / 2.5 + (aresta.deId.charCodeAt(0) % 10) / 10) % 1;
          const p = aresta.curva.getPointAt(progresso);
          aresta.particula.position.copy(p);
        }
      }

      // Atualiza posição das etiquetas HTML (projeção 3D → tela).
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        for (const [pid, entrada] of projetosRef.current) {
          const label = labelsRef.current.get(pid);
          if (!label) continue;
          const posTopo = entrada.pos.clone();
          posTopo.y += 1.3;
          posTopo.project(cam);
          if (Number.isFinite(posTopo.x) && Number.isFinite(posTopo.y)) {
            const x = ((posTopo.x + 1) / 2) * rect.width;
            const y = ((1 - posTopo.y) / 2) * rect.height;
            label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
            label.style.display = posTopo.z < 1 ? "block" : "none";
          }
        }
      }

      rend.render(scn, cam);
    }
    animarFrame();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      renderer.dispose();
      container.innerHTML = "";
      rendererRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------
  // (Re)constrói canteiros + trilhas de energia sempre que os dados mudam.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    const container = containerRef.current;
    if (!scene || !container) return;

    // Limpa geração anterior.
    for (const entrada of projetosRef.current.values()) {
      scene.remove(entrada.group, entrada.hitbox, entrada.anel);
    }
    for (const aresta of arestasRef.current) {
      scene.remove(aresta.tubo, aresta.particula);
    }
    projetosRef.current.clear();
    arestasRef.current = [];
    if (legendaRef.current) legendaRef.current.innerHTML = "";
    for (const el of labelsRef.current.values()) el.remove();
    labelsRef.current.clear();

    const posicoes = posicoesEmElipse(projects.length);
    const posPorId = new Map<string, THREE.Vector3>();

    projects.forEach((p, i) => {
      const pos2d = posicoes[i];
      if (!pos2d) return;
      const posicao = new THREE.Vector3(pos2d.x, 0, pos2d.z);
      posPorId.set(p.id, posicao);

      const estagio = estagioDoProjeto(p);
      const grupo = construirPlanta(estagio);
      grupo.position.copy(posicao);
      grupo.userData.projectId = p.id;
      scene.add(grupo);

      const hitbox = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.4, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hitbox.position.copy(posicao);
      hitbox.position.y += 0.7;
      hitbox.userData.projectId = p.id;
      scene.add(hitbox);

      const anel = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 24), new THREE.MeshBasicMaterial({ color: COR_ACCENT, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
      anel.rotation.x = -Math.PI / 2;
      anel.position.copy(posicao);
      anel.position.y = 0.02;
      anel.visible = false;
      scene.add(anel);

      const materiais: THREE.MeshStandardMaterial[] = [];
      grupo.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
          obj.material = obj.material.clone();
          obj.material.transparent = true;
          materiais.push(obj.material);
        }
      });

      projetosRef.current.set(p.id, { group: grupo, hitbox, anel, materiais, pos: posicao });

      // Etiqueta HTML flutuante (nome + abelhas do clube, se houver ofertas).
      const label = document.createElement("div");
      label.style.position = "absolute";
      label.style.left = "0";
      label.style.top = "0";
      label.style.pointerEvents = "none";
      label.style.transform = "translate(-9999px,-9999px)";
      label.style.whiteSpace = "nowrap";
      label.style.fontSize = "11px";
      label.style.color = "var(--sm-text)";
      label.style.textShadow = "0 1px 3px rgba(0,0,0,0.9)";
      label.style.transformOrigin = "50% 100%";
      const ofertas = ofertasPorProjeto.get(p.id) ?? 0;
      label.textContent = `${p.titulo.length > 24 ? `${p.titulo.slice(0, 24)}…` : p.titulo || "(sem título)"}${ofertas > 0 ? ` 🐝×${Math.min(ofertas, 9)}` : ""}`;
      container.appendChild(label);
      labelsRef.current.set(p.id, label);
    });

    // Trilhas de energia entre projetos.
    conexoes.forEach((c: ConexaoMapa, i) => {
      const a = posPorId.get(c.deId);
      const b = posPorId.get(c.paraId);
      if (!a || !b) return;
      const meio = a.clone().lerp(b, 0.5);
      meio.y = 0.9 + (i % 3) * 0.15;
      const curva = new THREE.CatmullRomCurve3([a.clone().setY(0.15), meio, b.clone().setY(0.15)]);
      const tuboGeo = new THREE.TubeGeometry(curva, 24, 0.02, 6, false);
      const tuboMat = new THREE.MeshBasicMaterial({ color: COR_ACCENT, transparent: true, opacity: 0.45 });
      const tubo = new THREE.Mesh(tuboGeo, tuboMat);
      scene.add(tubo);

      const particulaMat = new THREE.MeshStandardMaterial({ color: COR_ACCENT_CLARO, emissive: COR_ACCENT_CLARO, emissiveIntensity: 0.9 });
      const particula = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), particulaMat);
      scene.add(particula);

      arestasRef.current.push({ deId: c.deId, paraId: c.paraId, rotulo: c.rotulo, tubo, particula, curva });
    });

    // Gotas do Fundo Rotativo Solidário — quantidade reflete o percentual configurado.
    const fundo = new THREE.Vector3(0, 0.4, 0);
    projects.forEach((p) => {
      const saldo = saldoPorId.get(p.id) ?? 0;
      const posicao = posPorId.get(p.id);
      if (!posicao || saldo === 0) return;
      const contribui = saldo > 0;
      const volume = contribui ? saldo * (percentualFundo / 100) : saldo;
      const gotas = Math.max(1, Math.min(3, Math.ceil(Math.abs(volume) / 400)));
      const origem = contribui ? posicao : fundo;
      const destino = contribui ? fundo : posicao;
      for (let g = 0; g < gotas; g++) {
        const curva = new THREE.CatmullRomCurve3([origem.clone().setY(0.3), destino.clone().setY(0.3)]);
        const gotaMat = new THREE.MeshStandardMaterial({ color: COR_OURO, emissive: COR_OURO, emissiveIntensity: 0.7, transparent: true });
        const gota = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), gotaMat);
        scene.add(gota);
        arestasRef.current.push({ deId: contribui ? p.id : `fundo-${g}`, paraId: contribui ? `fundo-${g}` : p.id, rotulo: "Fundo Rotativo", tubo: gota, particula: gota, curva });
      }
    });

    // Legenda (mesma leitura do mapa anterior).
    if (legendaRef.current) {
      legendaRef.current.textContent =
        "🌰 semente = com bloqueios · 🌱 broto = com pendências · 🌿 muda = quase pronto · 🌳 árvore = pronto p/ exportar — trilhas verdes = quem fornece p/ quem · gotas douradas = fundo rotativo · clique 1x seleciona, 2x abre";
    }
  }, [projects, conexoes, saldoPorId, ofertasPorProjeto]);

  // ---------------------------------------------------------------------
  // Realce de seleção/hover — só ajusta materiais, não reconstrói a cena.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const relacionadosIds = new Set(relacoesDoSelecionado.map((r) => r.outroTitulo));
    for (const [pid, entrada] of projetosRef.current.entries()) {
      const projeto = projetoPorId.get(pid);
      const estaSelecionado = pid === selecionadoId;
      const estaEmHover = pid === hoverId;
      const relacionado = !!projeto && relacionadosIds.has(projeto.titulo);
      const esmaecido = selecionadoId != null && !estaSelecionado && !relacionado;
      entrada.anel.visible = estaSelecionado || estaEmHover;
      const opacidade = esmaecido ? 0.35 : 1;
      for (const mat of entrada.materiais) mat.opacity = opacidade;
      const label = labelsRef.current.get(pid);
      if (label) label.style.opacity = esmaecido ? "0.35" : "1";
    }
    for (const aresta of arestasRef.current) {
      const destacada = selecionadoId != null && (aresta.deId === selecionadoId || aresta.paraId === selecionadoId);
      const esmaecida = selecionadoId != null && !destacada;
      const matTubo = aresta.tubo.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
      matTubo.transparent = true;
      matTubo.opacity = esmaecida ? 0.12 : destacada ? 0.9 : 0.45;
      if (aresta.particula !== aresta.tubo) {
        const matParticula = aresta.particula.material as THREE.MeshStandardMaterial;
        matParticula.visible = !esmaecida;
      }
    }
  }, [selecionadoId, hoverId, relacoesDoSelecionado, projetoPorId]);

  // ---------------------------------------------------------------------
  // Interação: zoom, pan (câmera travada em ângulo isométrico) e seleção.
  // ---------------------------------------------------------------------
  function aplicarZoom(fator: number) {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.zoom * fator));
    cam.updateProjectionMatrix();
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
      const PAN_SPEED = 0.012 / cam.zoom;
      const els = cam.matrixWorld.elements;
      const right = new THREE.Vector3(els[0], els[1], els[2]);
      const up = new THREE.Vector3(els[4], els[5], els[6]);
      const delta = right.multiplyScalar(-dx * PAN_SPEED).add(up.multiplyScalar(dy * PAN_SPEED));
      cam.position.add(delta);
      targetRef.current.add(delta);
      cam.lookAt(targetRef.current);
      arrastando.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Hover (só quando não está arrastando) via raycast simples pelas hitboxes.
    const container = containerRef.current;
    const scene = sceneRef.current;
    if (!container || !scene) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cam);
    const hitboxes = Array.from(projetosRef.current.values()).map((v) => v.hitbox);
    const hits = raycaster.intersectObjects(hitboxes, false);
    setHoverId(hits.length > 0 ? (hits[0].object.userData.projectId as string) : null);
  }
  function onPointerUp(e: React.PointerEvent) {
    arrastando.current = null;
    if (moveu.current) return;

    const container = containerRef.current;
    const cam = cameraRef.current;
    const scene = sceneRef.current;
    if (!container || !cam || !scene) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cam);
    const hitboxes = Array.from(projetosRef.current.values()).map((v) => v.hitbox);
    const hits = raycaster.intersectObjects(hitboxes, false);
    if (hits.length === 0) return;
    const id = hits[0].object.userData.projectId as string;
    setSelecionadoId((atual) => (atual === id ? null : id));
  }

  const selecionado = selecionadoId ? projetoPorId.get(selecionadoId) : undefined;

  return (
    <div className="relative rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)]">
      <div
        ref={containerRef}
        className="relative h-[520px] w-full cursor-grab select-none overflow-hidden rounded active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          arrastando.current = null;
          setHoverId(null);
        }}
      />

      <div ref={legendaRef} className="pointer-events-none absolute left-3 top-3 max-w-[80%] text-[11px] text-[color:var(--sm-text-dim)]" />

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
            const cam = cameraRef.current;
            if (cam) {
              cam.zoom = 1;
              cam.position.set(ALTURA_CAMERA_MIN, ALTURA_CAMERA_MIN * 0.82, ALTURA_CAMERA_MIN);
              targetRef.current.set(0, 0, 0);
              cam.lookAt(targetRef.current);
              cam.updateProjectionMatrix();
            }
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
            <button onClick={() => setSelecionadoId(null)} className="shrink-0 text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
              <X size={14} strokeWidth={2} />
            </button>
          </div>
          <p className="text-xs text-[color:var(--sm-text-dim)]">{ESTAGIO_ROTULO[estagioDoProjeto(selecionado)]}</p>
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
  );
}
