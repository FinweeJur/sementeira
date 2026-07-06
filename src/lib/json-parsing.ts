/** Extrai o primeiro bloco ```json ...``` (ou o primeiro objeto {...}) de uma resposta de LLM — helper compartilhado por todos os módulos de IA. */
export function extrairBlocoJson(texto: string): string | null {
  const match = texto.match(/```json\s*([\s\S]*?)```/i) ?? texto.match(/\{[\s\S]*\}/);
  return match ? (match[1] ?? match[0]) : null;
}

/** Faz parse do bloco JSON de uma resposta de LLM; retorna null em vez de lançar. */
export function parseJsonDeResposta<T>(texto: string): T | null {
  const bloco = extrairBlocoJson(texto);
  if (!bloco) return null;
  try {
    return JSON.parse(bloco.trim()) as T;
  } catch {
    return null;
  }
}
