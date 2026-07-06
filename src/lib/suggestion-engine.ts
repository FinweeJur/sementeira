import danos from "../data/danos.json";
import arquetipos from "../data/arquetipos.json";

export interface SugestaoResultado {
  danoId?: string;
  danoScore: number;
  arquetipoId?: string;
  arquetipoScore: number;
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Casa a palavra-chave respeitando fronteira de palavra — evita falsos
 * positivos como "pão" batendo dentro de "galpão" via substring simples.
 */
function contemPalavra(alvo: string, palavraNormalizada: string): boolean {
  const regex = new RegExp(`(^|[^a-z0-9])${escapeRegExp(palavraNormalizada)}([^a-z0-9]|$)`, "i");
  return regex.test(alvo);
}

function pontuar(texto: string, palavrasChave: string[]): number {
  const alvo = normalizar(texto);
  let score = 0;
  for (const palavra of palavrasChave) {
    if (contemPalavra(alvo, normalizar(palavra))) score += 1;
  }
  return score;
}

/**
 * Sugestão por palavras-chave (sem LLM) — heurística leve para pré-preencher
 * dano e arquétipo a partir da ideia em linguagem livre. O copiloto de LLM
 * (Fase 2) substitui/reforça isso quando um provedor estiver configurado.
 */
export function sugerirDeIdeia(ideiaTexto: string): SugestaoResultado {
  if (!ideiaTexto.trim()) {
    return { danoScore: 0, arquetipoScore: 0 };
  }

  let melhorDano: { id: string; score: number } | null = null;
  for (const d of danos) {
    const score = pontuar(ideiaTexto, d.palavrasChave ?? []);
    if (!melhorDano || score > melhorDano.score) melhorDano = { id: d.id, score };
  }

  let melhorArquetipo: { id: string; score: number } | null = null;
  for (const a of arquetipos) {
    const score = pontuar(ideiaTexto, a.palavrasChave ?? []);
    if (!melhorArquetipo || score > melhorArquetipo.score) melhorArquetipo = { id: a.id, score };
  }

  return {
    danoId: melhorDano && melhorDano.score > 0 ? melhorDano.id : undefined,
    danoScore: melhorDano?.score ?? 0,
    arquetipoId: melhorArquetipo && melhorArquetipo.score > 0 ? melhorArquetipo.id : undefined,
    arquetipoScore: melhorArquetipo?.score ?? 0,
  };
}

const LIMITE_TITULO = 60;

/** Deriva um título curto a partir da ideia livre — usado para preencher o título automaticamente até a pessoa editá-lo na mão. */
export function derivarTituloDeIdeia(ideiaTexto: string): string {
  const texto = ideiaTexto.trim().replace(/\s+/g, " ");
  if (!texto) return "";
  const primeiraFrase = texto.split(/[.!?\n]/)[0].trim();
  const base = primeiraFrase || texto;
  const cortado = base.length > LIMITE_TITULO ? `${base.slice(0, LIMITE_TITULO).trim()}...` : base;
  return cortado.charAt(0).toUpperCase() + cortado.slice(1);
}
