export interface DiretrizGlobal {
  id: string;
  nomeArquivo: string;
  texto: string;
  adicionadoEm: string;
}

const CHAVE = "sementeira-diretrizes-globais-v1";

export function carregarDiretrizesGlobais(): DiretrizGlobal[] {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (raw) return JSON.parse(raw) as DiretrizGlobal[];
  } catch {
    /* ignora dado corrompido */
  }
  return [];
}

export function salvarDiretrizesGlobais(diretrizes: DiretrizGlobal[]): void {
  localStorage.setItem(CHAVE, JSON.stringify(diretrizes));
}

export function adicionarDiretrizGlobal(nomeArquivo: string, texto: string): DiretrizGlobal[] {
  const atuais = carregarDiretrizesGlobais();
  const nova: DiretrizGlobal = { id: crypto.randomUUID(), nomeArquivo, texto, adicionadoEm: new Date().toISOString() };
  const atualizadas = [...atuais, nova];
  salvarDiretrizesGlobais(atualizadas);
  return atualizadas;
}

export function removerDiretrizGlobal(id: string): DiretrizGlobal[] {
  const atualizadas = carregarDiretrizesGlobais().filter((d) => d.id !== id);
  salvarDiretrizesGlobais(atualizadas);
  return atualizadas;
}

/**
 * Bloco de prompt a incluir em toda geração/revisão de IA — nunca pode
 * contradizer o Ofício 46, que sempre prevalece. Retorna string vazia se não
 * houver diretrizes anexadas (não polui o prompt à toa).
 */
export function montarBlocoDiretrizesGlobais(): string {
  const diretrizes = carregarDiretrizesGlobais();
  if (diretrizes.length === 0) return "";
  const corpo = diretrizes.map((d) => `--- ${d.nomeArquivo} ---\n${d.texto.slice(0, 4000)}`).join("\n\n");
  return [
    "Diretrizes gerais anexadas pelo usuário (edital regional, orientação da Entidade Gestora, etc.) — use como contexto adicional:",
    corpo,
    "IMPORTANTE: essas diretrizes NUNCA podem contradizer as vedações e regras do Ofício 46. Se houver conflito, o Ofício 46 sempre prevalece.",
  ].join("\n\n");
}
