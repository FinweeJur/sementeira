import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Project } from "../../lib/types";
import { MUNICIPIOS_PARAOPEBA, distanciaHaversineKm } from "../../lib/geografia";
import { derivarConexoes } from "../../lib/mapa-estagios";

const COR_ACCENT = "#6fae55";
const COR_DIM = "#6b7a67";

/**
 * Mapa geográfico real dos ~26 municípios da bacia do Paraopeba — tiles reais
 * do OpenStreetMap (via Leaflet) como base, com marcadores de município e de
 * projeto por cima. Exige internet para o mapa de fundo carregar; sem
 * internet, os pontos continuam funcionando sobre um fundo em branco (nunca
 * quebra a tela, só perde a imagem do mapa).
 */
export function MapaGeografico({ projects, onAbrirProjeto }: { projects: Project[]; onAbrirProjeto: (id: string) => void }) {
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const [semInternet] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);

  const projetosPorMunicipio = useMemo(() => {
    const mapa = new Map<string, Project[]>();
    for (const p of projects) {
      if (!p.municipioId) continue;
      const lista = mapa.get(p.municipioId) ?? [];
      lista.push(p);
      mapa.set(p.municipioId, lista);
    }
    return mapa;
  }, [projects]);

  const conexoes = useMemo(() => derivarConexoes(projects), [projects]);
  const projetoPorId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const semMunicipio = projects.filter((p) => !p.municipioId).length;

  const relacoesDoSelecionado = useMemo(() => {
    if (!selecionadoId) return [];
    return conexoes
      .filter((c) => c.deId === selecionadoId || c.paraId === selecionadoId)
      .map((c) => {
        const outroId = c.deId === selecionadoId ? c.paraId : c.deId;
        const outro = projetoPorId.get(outroId);
        const mA = MUNICIPIOS_PARAOPEBA.find((m) => m.id === projetoPorId.get(selecionadoId)?.municipioId);
        const mB = MUNICIPIOS_PARAOPEBA.find((m) => m.id === outro?.municipioId);
        const distancia = mA && mB ? distanciaHaversineKm(mA, mB) * 1.4 : null;
        return { direcao: c.deId === selecionadoId ? ("de" as const) : ("para" as const), rotulo: c.rotulo, outroTitulo: outro?.titulo ?? "(removido)", distancia };
      });
  }, [selecionadoId, conexoes, projetoPorId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const lats = MUNICIPIOS_PARAOPEBA.map((m) => m.lat);
    const lons = MUNICIPIOS_PARAOPEBA.map((m) => m.lon);
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    );

    const mapa = L.map(container, { attributionControl: true, zoomControl: true }).fitBounds(bounds, { padding: [24, 24] });
    mapaRef.current = mapa;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(mapa);

    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // (Re)desenha marcadores/linhas sempre que os dados mudam — sem recriar o mapa/tiles.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    const camada = L.layerGroup().addTo(mapa);

    for (const m of MUNICIPIOS_PARAOPEBA) {
      const temProjeto = (projetosPorMunicipio.get(m.id)?.length ?? 0) > 0;
      L.circleMarker([m.lat, m.lon], {
        radius: temProjeto ? 9 : 6,
        color: temProjeto ? COR_ACCENT : COR_DIM,
        fillColor: temProjeto ? COR_ACCENT : COR_DIM,
        fillOpacity: temProjeto ? 0.9 : 0.5,
        weight: 1,
      })
        .bindTooltip(m.nome, { direction: "top" })
        .addTo(camada);
    }

    for (const c of conexoes) {
      const de = projetoPorId.get(c.deId);
      const para = projetoPorId.get(c.paraId);
      if (!de?.municipioId || !para?.municipioId) continue;
      const mDe = MUNICIPIOS_PARAOPEBA.find((m) => m.id === de.municipioId);
      const mPara = MUNICIPIOS_PARAOPEBA.find((m) => m.id === para.municipioId);
      if (!mDe || !mPara) continue;
      const destacada = selecionadoId != null && (de.id === selecionadoId || para.id === selecionadoId);
      L.polyline(
        [
          [mDe.lat, mDe.lon],
          [mPara.lat, mPara.lon],
        ],
        { color: COR_ACCENT, weight: destacada ? 3 : 1.5, opacity: destacada ? 0.9 : 0.4, dashArray: "4 4" },
      ).addTo(camada);
    }

    for (const p of projects) {
      if (!p.municipioId) continue;
      const m = MUNICIPIOS_PARAOPEBA.find((mm) => mm.id === p.municipioId);
      if (!m) continue;
      const irmaos = projetosPorMunicipio.get(m.id) ?? [];
      const indice = irmaos.findIndex((ir) => ir.id === p.id);
      const angulo = (indice / Math.max(1, irmaos.length)) * Math.PI * 2;
      const offset = irmaos.length > 1 ? 0.01 : 0;
      const lat = m.lat + Math.sin(angulo) * offset;
      const lon = m.lon + Math.cos(angulo) * offset;
      const marcador = L.circleMarker([lat, lon], {
        radius: 13,
        color: COR_ACCENT,
        weight: selecionadoId === p.id ? 4 : 2,
        fillColor: "#171d17",
        fillOpacity: 0.95,
      })
        .bindTooltip(p.titulo || "(sem título)")
        .on("click", () => setSelecionadoId((atual) => (atual === p.id ? null : p.id)));
      marcador.addTo(camada);

      // Anel pulsante no projeto selecionado — destaque visual
      if (selecionadoId === p.id) {
        L.circleMarker([lat, lon], {
          radius: 20,
          color: COR_ACCENT,
          weight: 2,
          fillColor: COR_ACCENT,
          fillOpacity: 0.15,
          className: "sm-marcador-pulso",
        }).addTo(camada);
      }
    }

    return () => {
      camada.remove();
    };
  }, [projects, conexoes, projetosPorMunicipio, projetoPorId, selecionadoId]);

  return (
    <div className="space-y-2 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-3">
      {semInternet && (
        <p className="rounded border border-[color:var(--sm-yellow)]/40 bg-[color:var(--sm-yellow)]/10 p-2 text-xs">
          Sem internet detectada — o mapa de fundo (OpenStreetMap) pode não carregar; os pontos dos municípios/projetos continuam funcionando.
        </p>
      )}
      <div ref={containerRef} className="h-[480px] w-full overflow-hidden rounded" />

      {semMunicipio > 0 && (
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          {semMunicipio} projeto(s) sem município definido (passo "Espaço e logística") — não aparecem no mapa.
        </p>
      )}

      {selecionadoId && projetoPorId.get(selecionadoId) && (
        <div className="space-y-1 rounded border border-[color:var(--sm-accent)]/50 p-2 text-xs">
          <p className="font-medium">{projetoPorId.get(selecionadoId)!.titulo || "(sem título)"}</p>
          <ul className="space-y-0.5">
            {relacoesDoSelecionado.map((r, i) => (
              <li key={i}>
                {r.direcao === "de" ? "→" : "←"} <strong>{r.outroTitulo}</strong>: {r.rotulo}
                {r.distancia != null && ` · ~${r.distancia.toFixed(0)} km (estimativa offline)`}
              </li>
            ))}
            {relacoesDoSelecionado.length === 0 && <li className="text-[color:var(--sm-text-dim)]">Sem conexões diretas.</li>}
          </ul>
          <button onClick={() => onAbrirProjeto(selecionadoId)} className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-2 py-1 hover:bg-[color:var(--sm-accent)]/30">
            Abrir projeto →
          </button>
        </div>
      )}

      <p className="text-[10px] text-[color:var(--sm-text-dim)]">
        Coordenadas aproximadas (geocodificação offline por município, não por endereço exato) — distâncias mostradas aqui são estimativa em linha reta × 1,4, não rota real. Mapa de fundo: ©
        OpenStreetMap.
      </p>
    </div>
  );
}
