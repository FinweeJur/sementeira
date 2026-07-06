import { useMemo, useState } from "react";
import type { Project } from "../../lib/types";
import { MUNICIPIOS_PARAOPEBA, distanciaHaversineKm, type Municipio } from "../../lib/geografia";
import { derivarConexoes } from "../../lib/mapa-estagios";

const LARGURA = 640;
const ALTURA = 420;
const MARGEM = 24;

function projetar(m: Municipio, bounds: { latMin: number; latMax: number; lonMin: number; lonMax: number }) {
  const x = MARGEM + ((m.lon - bounds.lonMin) / (bounds.lonMax - bounds.lonMin)) * (LARGURA - MARGEM * 2);
  const y = MARGEM + ((bounds.latMax - m.lat) / (bounds.latMax - bounds.latMin)) * (ALTURA - MARGEM * 2);
  return { x, y };
}

/**
 * Mapa geográfico real (offline) dos ~26 municípios da bacia do Paraopeba —
 * complementa o mapa simbólico isométrico. Projeção equirretangular simples
 * (sem lib de mapas), coordenadas aproximadas — ver `municipios-paraopeba.json`.
 */
export function MapaGeografico({ projects, onAbrirProjeto }: { projects: Project[]; onAbrirProjeto: (id: string) => void }) {
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const bounds = useMemo(() => {
    const lats = MUNICIPIOS_PARAOPEBA.map((m) => m.lat);
    const lons = MUNICIPIOS_PARAOPEBA.map((m) => m.lon);
    const pad = 0.08;
    return { latMin: Math.min(...lats) - pad, latMax: Math.max(...lats) + pad, lonMin: Math.min(...lons) - pad, lonMax: Math.max(...lons) + pad };
  }, []);

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

  return (
    <div className="space-y-2 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-3">
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full" role="img" aria-label="Mapa geográfico dos municípios da bacia do Paraopeba">
        {MUNICIPIOS_PARAOPEBA.map((m) => {
          const { x, y } = projetar(m, bounds);
          const temProjeto = (projetosPorMunicipio.get(m.id)?.length ?? 0) > 0;
          return (
            <g key={m.id}>
              <circle cx={x} cy={y} r={temProjeto ? 4 : 2.2} fill={temProjeto ? "var(--sm-accent)" : "var(--sm-text-dim)"} opacity={temProjeto ? 1 : 0.5} />
              <text x={x + 6} y={y + 3} fontSize={8} fill="var(--sm-text-dim)">
                {m.nome}
              </text>
            </g>
          );
        })}

        {conexoes.map((c, i) => {
          const de = projetoPorId.get(c.deId);
          const para = projetoPorId.get(c.paraId);
          if (!de?.municipioId || !para?.municipioId) return null;
          const mDe = MUNICIPIOS_PARAOPEBA.find((m) => m.id === de.municipioId);
          const mPara = MUNICIPIOS_PARAOPEBA.find((m) => m.id === para.municipioId);
          if (!mDe || !mPara) return null;
          const a = projetar(mDe, bounds);
          const b = projetar(mPara, bounds);
          const destacada = selecionadoId != null && (de.id === selecionadoId || para.id === selecionadoId);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--sm-accent)" strokeWidth={destacada ? 2 : 1} strokeDasharray="3 3" opacity={destacada ? 0.9 : 0.35} />;
        })}

        {projects
          .filter((p) => p.municipioId)
          .map((p) => {
            const m = MUNICIPIOS_PARAOPEBA.find((mm) => mm.id === p.municipioId)!;
            const irmaos = projetosPorMunicipio.get(m.id) ?? [];
            const indiceNoMunicipio = irmaos.findIndex((ir) => ir.id === p.id);
            const angulo = (indiceNoMunicipio / Math.max(1, irmaos.length)) * Math.PI * 2;
            const raio = irmaos.length > 1 ? 12 : 0;
            const { x, y } = projetar(m, bounds);
            const px = x + Math.cos(angulo) * raio;
            const py = y + Math.sin(angulo) * raio;
            return (
              <g key={p.id} className="cursor-pointer" onClick={() => setSelecionadoId((atual) => (atual === p.id ? null : p.id))}>
                <circle cx={px} cy={py} r={6} fill="var(--sm-panel)" stroke="var(--sm-accent)" strokeWidth={selecionadoId === p.id ? 2.5 : 1.5} />
                <title>{p.titulo || "(sem título)"}</title>
              </g>
            );
          })}
      </svg>

      {semMunicipio > 0 && (
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          {semMunicipio} projeto(s) sem município definido (passo "Espaço e logística") — não aparecem no mapa.
        </p>
      )}

      {selecionadoId && projetoPorId.get(selecionadoId) && (
        <div className="space-y-1 rounded border border-[color:var(--sm-accent)]/50 p-2 text-xs">
          <p className="font-medium">{projetoPorId.get(selecionadoId)!.titulo || "(sem título)"}</p>
          <ul className="space-y-0.5">
            {conexoes
              .filter((c) => c.deId === selecionadoId || c.paraId === selecionadoId)
              .map((c, i) => {
                const outroId = c.deId === selecionadoId ? c.paraId : c.deId;
                const outro = projetoPorId.get(outroId);
                const mA = MUNICIPIOS_PARAOPEBA.find((m) => m.id === projetoPorId.get(selecionadoId!)?.municipioId);
                const mB = MUNICIPIOS_PARAOPEBA.find((m) => m.id === outro?.municipioId);
                const distancia = mA && mB ? distanciaHaversineKm(mA, mB) * 1.4 : null;
                return (
                  <li key={i}>
                    {c.deId === selecionadoId ? "→" : "←"} <strong>{outro?.titulo ?? "(removido)"}</strong>: {c.rotulo}
                    {distancia != null && ` · ~${distancia.toFixed(0)} km (estimativa offline)`}
                  </li>
                );
              })}
            {conexoes.filter((c) => c.deId === selecionadoId || c.paraId === selecionadoId).length === 0 && <li className="text-[color:var(--sm-text-dim)]">Sem conexões diretas.</li>}
          </ul>
          <button onClick={() => onAbrirProjeto(selecionadoId)} className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-2 py-1 hover:bg-[color:var(--sm-accent)]/30">
            Abrir projeto →
          </button>
        </div>
      )}

      <p className="text-[10px] text-[color:var(--sm-text-dim)]">
        Coordenadas aproximadas (geocodificação offline por município, não por endereço exato) — distâncias mostradas aqui são estimativa em linha reta × 1,4, não rota real.
      </p>
    </div>
  );
}
