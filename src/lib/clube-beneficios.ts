export interface OfertaBeneficio {
  id: string;
  projectId: string;
  titulo: string;
  descricao: string;
}

export interface RegraPontos {
  id: string;
  descricao: string;
  pontosGanhos: number;
}

export interface Premio {
  id: string;
  nome: string;
  custoPontos: number;
}

export interface ClubeBeneficios {
  ofertas: OfertaBeneficio[];
  regrasPontos: RegraPontos[];
  premios: Premio[];
}

const CHAVE = "sementeira-clube-beneficios-v1";

export function carregarClube(): ClubeBeneficios {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (raw) return JSON.parse(raw) as ClubeBeneficios;
  } catch {
    /* ignora dado corrompido */
  }
  return { ofertas: [], regrasPontos: [], premios: [] };
}

export function salvarClube(clube: ClubeBeneficios): void {
  localStorage.setItem(CHAVE, JSON.stringify(clube));
}
