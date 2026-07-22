/**
 * Estimativa de capacidade real de produção da equipe — não é regra do acordo
 * nem parte do motor de conformidade determinístico, é uma calculadora pra
 * ajudar a planejar. Mais gente não produz proporcionalmente mais: parte do
 * tempo nominal vira coordenação, reunião e ajuste — modelo simplificado
 * inspirado na Lei de Brooks (overhead de comunicação cresce com o tamanho do
 * time), documentado e ajustável, não uma medição exata.
 */
export const EFICIENCIA_BASE = 0.7; // ~30% do tempo nominal vira coordenação/administração mesmo com 1 pessoa só — regra prática comum de gestão de projetos.
export const PENALIDADE_COORDENACAO_POR_PESSOA = 0.08; // cada pessoa além da primeira soma custo de comunicação/coordenação.

export function fatorCoordenacao(n: number): number {
  if (n <= 1) return 1;
  return 1 / (1 + PENALIDADE_COORDENACAO_POR_PESSOA * (n - 1));
}

export function eficienciaEfetiva(n: number): number {
  return EFICIENCIA_BASE * fatorCoordenacao(n);
}
