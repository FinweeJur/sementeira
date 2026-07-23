import arquetipos from "../data/arquetipos.json";
import danos from "../data/danos.json";
import setores from "../data/setores.json";

/**
 * Tradução de id → nome legível dos dados estáticos. Fica num módulo próprio
 * porque exportação, planilha na tela e comparação precisam exatamente do
 * mesmo texto — quando cada tela tinha a sua cópia, os nomes divergiam.
 */
export function nomeArquetipo(id: string): string {
  return arquetipos.find((a) => a.id === id)?.nome ?? id;
}

export function nomeDano(id: string): string {
  return danos.find((d) => d.id === id)?.nome ?? id;
}

export function nomeSetor(id: string): string {
  return setores.find((s) => s.id === id)?.nome ?? id;
}
