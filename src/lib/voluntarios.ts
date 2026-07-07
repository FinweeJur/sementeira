import type { Project, Voluntario } from "./types";

const CHAVE = "sementeira-voluntarios-v1";

export function carregarVoluntarios(): Voluntario[] {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (raw) return JSON.parse(raw) as Voluntario[];
  } catch {
    /* ignora dado corrompido */
  }
  return [];
}

export function salvarVoluntarios(voluntarios: Voluntario[]): void {
  localStorage.setItem(CHAVE, JSON.stringify(voluntarios));
}

/**
 * Sugestão local (sem IA) de voluntários para um projeto — casa `habilidades`
 * por palavra-chave contra a descrição das linhas de orçamento de categoria
 * "equipe-implantacao" e contra o próprio arquétipo. Fronteira de palavra
 * (mesma correção já aplicada em suggestion-engine.ts) para não bater
 * substring solta (ex.: "pão" dentro de "galpão").
 */
export function sugerirVoluntariosParaProjeto(voluntarios: Voluntario[], project: Project): Voluntario[] {
  const textoAlvo = [project.arquetipoId, ...project.orcamento.filter((l) => l.categoria === "equipe-implantacao").map((l) => l.descricao)].join(" ").toLowerCase();

  return voluntarios.filter((v) => (v.habilidades ?? []).some((h) => contemPalavra(textoAlvo, h)));
}

function contemPalavra(texto: string, palavra: string): boolean {
  const p = palavra.trim().toLowerCase();
  if (!p) return false;
  const escapada = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapada}\\b`, "i").test(texto);
}
