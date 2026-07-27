import type { Project } from "./types";

export interface CampoAlterado {
  rotulo: string;
  antes: string;
  depois: string;
}

const CAMPOS_TEXTO: { chave: keyof Project; rotulo: string }[] = [
  { chave: "objetivo", rotulo: "Objetivo" },
  { chave: "justificativa", rotulo: "Justificativa" },
  { chave: "cronograma", rotulo: "Cronograma" },
  { chave: "comoComunidadeAjuda", rotulo: "Como a comunidade ajuda" },
  { chave: "missaoImpacto", rotulo: "Missão/impacto" },
  { chave: "fonteReposicaoEquipamentos", rotulo: "Fonte de reposição de equipamentos" },
];

const CAMPOS_LISTA_TEXTO: { chave: keyof Project; rotulo: string }[] = [
  { chave: "metas", rotulo: "Metas" },
  { chave: "objetivosEspecificos", rotulo: "Objetivos específicos" },
  { chave: "boasPraticas", rotulo: "Boas práticas" },
  { chave: "formasArrecadacao", rotulo: "Formas de arrecadação" },
  { chave: "planoImplementacao", rotulo: "Plano de implementação" },
];

function truncar(s: string, tamanho = 160): string {
  return s.length > tamanho ? s.slice(0, tamanho) + "…" : s;
}

function comContagem(lista: unknown[] | undefined, valor: number): string {
  return `${lista?.length ?? 0} ${lista?.length === 1 ? "item" : "itens"}${valor ? ` · R$ ${valor.toFixed(2)}` : ""}`;
}

/**
 * Compara duas versões do mesmo projeto (antes/depois de uma volta de
 * lapidação) e devolve só os campos que de fato mudaram, prontos pra exibir
 * lado a lado — sem isso, o histórico só mostrava o changelog em prosa da IA,
 * que às vezes não deixa claro ONDE o texto mudou.
 */
export function diffProjetos(antes: Project, depois: Project): CampoAlterado[] {
  const mudancas: CampoAlterado[] = [];

  for (const { chave, rotulo } of CAMPOS_TEXTO) {
    const a = String(antes[chave] ?? "").trim();
    const d = String(depois[chave] ?? "").trim();
    if (a !== d) mudancas.push({ rotulo, antes: a ? truncar(a) : "(vazio)", depois: d ? truncar(d) : "(vazio)" });
  }

  for (const { chave, rotulo } of CAMPOS_LISTA_TEXTO) {
    const a = ((antes[chave] as string[] | undefined) ?? []).filter(Boolean);
    const d = ((depois[chave] as string[] | undefined) ?? []).filter(Boolean);
    const aSet = new Set(a);
    const dSet = new Set(d);
    const adicionados = d.filter((x) => !aSet.has(x));
    const removidos = a.filter((x) => !dSet.has(x));
    if (adicionados.length === 0 && removidos.length === 0) continue;
    const partes: string[] = [];
    if (adicionados.length) partes.push(`+${adicionados.length}`);
    if (removidos.length) partes.push(`-${removidos.length}`);
    mudancas.push({ rotulo, antes: `${a.length} ${a.length === 1 ? "item" : "itens"}`, depois: `${d.length} ${d.length === 1 ? "item" : "itens"} (${partes.join(" ")})` });
  }

  const totalOrcAntes = (antes.orcamento ?? []).reduce((s, l) => s + (l.valor || 0), 0);
  const totalOrcDepois = (depois.orcamento ?? []).reduce((s, l) => s + (l.valor || 0), 0);
  if (totalOrcAntes !== totalOrcDepois || (antes.orcamento?.length ?? 0) !== (depois.orcamento?.length ?? 0)) {
    mudancas.push({ rotulo: "Orçamento", antes: comContagem(antes.orcamento, totalOrcAntes), depois: comContagem(depois.orcamento, totalOrcDepois) });
  }

  if ((antes.equipe?.length ?? 0) !== (depois.equipe?.length ?? 0)) {
    mudancas.push({ rotulo: "Equipe", antes: comContagem(antes.equipe, 0), depois: comContagem(depois.equipe, 0) });
  }
  if ((antes.riscos?.length ?? 0) !== (depois.riscos?.length ?? 0)) {
    mudancas.push({ rotulo: "Riscos", antes: comContagem(antes.riscos, 0), depois: comContagem(depois.riscos, 0) });
  }
  if ((antes.indicadores?.length ?? 0) !== (depois.indicadores?.length ?? 0)) {
    mudancas.push({ rotulo: "Indicadores", antes: comContagem(antes.indicadores, 0), depois: comContagem(depois.indicadores, 0) });
  }

  return mudancas;
}
