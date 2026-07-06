import municipios from "../data/municipios-paraopeba.json";

export interface Municipio {
  id: string;
  nome: string;
  lat: number;
  lon: number;
}

export const MUNICIPIOS_PARAOPEBA: Municipio[] = municipios;

export function municipioPorId(id: string | undefined): Municipio | undefined {
  return id ? MUNICIPIOS_PARAOPEBA.find((m) => m.id === id) : undefined;
}

/** Distância em linha reta (km) entre dois pontos — fórmula de Haversine. */
export function distanciaHaversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Fator de correção padrão para converter distância em linha reta em estimativa de rota por carro, quando não há rota real disponível. */
const FATOR_ROTA_OFFLINE = 1.4;
const TIMEOUT_OSRM_MS = 3500;

export interface EstimativaRota {
  km: number;
  fonte: "osrm" | "offline";
}

/**
 * Distância estimada por carro entre dois municípios. Tenta o servidor público
 * demo do OSRM (só funciona com internet); se falhar/expirar, cai no fallback
 * offline (linha reta × 1.4), sempre identificando a fonte usada — nunca finge
 * precisão que não tem.
 */
export async function estimarDistanciaRota(deId: string, paraId: string): Promise<EstimativaRota | null> {
  const de = municipioPorId(deId);
  const para = municipioPorId(paraId);
  if (!de || !para) return null;
  if (de.id === para.id) return { km: 0, fonte: "offline" };

  const retaKm = distanciaHaversineKm(de, para);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_OSRM_MS);
    const url = `https://router.project-osrm.org/route/v1/driving/${de.lon},${de.lat};${para.lon},${para.lat}?overview=false`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error("OSRM indisponível");
    const dado = await resp.json();
    const metros = dado?.routes?.[0]?.distance;
    if (typeof metros !== "number") throw new Error("Resposta OSRM inesperada");
    return { km: metros / 1000, fonte: "osrm" };
  } catch {
    return { km: retaKm * FATOR_ROTA_OFFLINE, fonte: "offline" };
  }
}

/** Custo logístico mensal estimado (R$) — base para virar linha sugerida de orçamento nos projetos integrados. */
export function custoLogisticoMensalEstimado(distanciaKm: number, freqViagensPorMes: number, custoPorKm: number): number {
  return distanciaKm * 2 * freqViagensPorMes * custoPorKm;
}
