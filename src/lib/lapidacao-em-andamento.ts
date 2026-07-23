import type { EtapaLapidacao, ResultadoLapidacao } from "./refinement-loop";

/**
 * Guarda a lapidação em andamento FORA do componente.
 *
 * O painel é montado como `{lapidacaoAberta && <LapidacaoPanel/>}`, então
 * fechar desmonta e leva junto todo o `useState`. O laço assíncrono continua
 * rodando (uma promise não morre com o unmount), mas o `setResultado` no fim
 * escrevia num componente morto — a pessoa esperava minutos de processamento
 * e reabria o painel vazio.
 *
 * Com o estado aqui, fechar passa a ser seguro de verdade: o laço continua,
 * o resultado é guardado e reaparece quando o painel voltar a abrir. É o que
 * permite dizer na tela "pode fechar" sem mentir.
 *
 * Vive em memória de propósito: uma lapidação interrompida por fechar o app
 * não teria como retomar as chamadas ao LLM mesmo se o estado persistisse.
 */
export interface EstadoLapidacao {
  projectId: string;
  rodando: boolean;
  volta: number;
  totalVoltas: number;
  etapaAtual: EtapaLapidacao | null;
  inicioEm: number | null;
  duracaoSeg: number | null;
  resultado: ResultadoLapidacao | null;
  erro: string | null;
  /** Marcado por "Parar" — o laço consulta a cada etapa. */
  cancelado: boolean;
}

function estadoInicial(projectId: string): EstadoLapidacao {
  return {
    projectId,
    rodando: false,
    volta: 1,
    totalVoltas: 1,
    etapaAtual: null,
    inicioEm: null,
    duracaoSeg: null,
    resultado: null,
    erro: null,
    cancelado: false,
  };
}

const porProjeto = new Map<string, EstadoLapidacao>();
const ouvintes = new Map<string, Set<() => void>>();

export function obterLapidacao(projectId: string): EstadoLapidacao {
  return porProjeto.get(projectId) ?? estadoInicial(projectId);
}

export function atualizarLapidacao(projectId: string, mudanca: Partial<EstadoLapidacao>): void {
  porProjeto.set(projectId, { ...obterLapidacao(projectId), ...mudanca });
  for (const avisar of ouvintes.get(projectId) ?? []) avisar();
}

/** Recomeça do zero — usado ao disparar uma nova lapidação. */
export function reiniciarLapidacao(projectId: string, totalVoltas: number): void {
  porProjeto.set(projectId, { ...estadoInicial(projectId), totalVoltas, rodando: true, inicioEm: Date.now() });
  for (const avisar of ouvintes.get(projectId) ?? []) avisar();
}

/** Esquece o que ficou guardado — depois de aplicar ou descartar o resultado. */
export function limparLapidacao(projectId: string): void {
  porProjeto.delete(projectId);
  for (const avisar of ouvintes.get(projectId) ?? []) avisar();
}

export function assinarLapidacao(projectId: string, avisar: () => void): () => void {
  const doProjeto = ouvintes.get(projectId) ?? new Set<() => void>();
  doProjeto.add(avisar);
  ouvintes.set(projectId, doProjeto);
  return () => {
    doProjeto.delete(avisar);
    if (doProjeto.size === 0) ouvintes.delete(projectId);
  };
}

/** Há lapidação rodando para este projeto? Usado para não disparar duas. */
export function lapidacaoRodando(projectId: string): boolean {
  return obterLapidacao(projectId).rodando;
}
