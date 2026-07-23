/**
 * Normalização de texto para comparação: sem acento, minúsculo, sem espaço nas
 * pontas. Usada para casar nome de município, cabeçalho de planilha e busca na
 * tabela — lugares onde "Mário Campos" e "mario campos" precisam ser a mesma
 * coisa.
 */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
