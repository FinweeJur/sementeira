import type { Project } from "./types";

/**
 * Mês corrido de implantação, contado a partir de `dataInicioReal` (Fase 14b).
 * `dataInicioReal` é SEMPRE marcado manualmente pelo usuário — nunca estimado
 * — então sem ele a função retorna null em vez de adivinhar.
 */
export function mesAtualDoProjeto(project: Project): number | null {
  if (!project.dataInicioReal) return null;
  const inicio = new Date(project.dataInicioReal);
  if (Number.isNaN(inicio.getTime())) return null;
  const agora = new Date();
  const meses = (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth()) + 1;
  return Math.max(1, meses);
}

/** Atividades do mês — usa `cronogramaMensal` (Fase 13d) quando existe; senão cai para o passo correspondente de `planoImplementacao` (Fase 7), por ordem. */
export function orientacaoDoMes(project: Project, mes: number): string[] {
  const doCronograma = project.cronogramaMensal?.find((m) => m.mes === mes);
  if (doCronograma) return doCronograma.atividades;

  const plano = project.planoImplementacao;
  if (plano && plano.length > 0) {
    const passo = plano[mes - 1];
    return passo ? [passo] : [];
  }
  return [];
}

const CHAVE_CHECAGEM = "sementeira-agente-ultima-checagem-v1";

/**
 * Mensagens proativas de orientação mensal (Fase 14d) — no máx. 1 por projeto
 * por mês corrido (controle em localStorage), para não repetir a cada
 * abertura do chat.
 */
export function gerarMensagensProativas(projects: Project[]): string[] {
  let registro: Record<string, number> = {};
  try {
    registro = JSON.parse(localStorage.getItem(CHAVE_CHECAGEM) ?? "{}");
  } catch {
    /* ignora registro corrompido */
  }

  const mensagens: string[] = [];
  for (const p of projects) {
    const mes = mesAtualDoProjeto(p);
    if (mes == null || registro[p.id] === mes) continue;
    const atividades = orientacaoDoMes(p, mes);
    if (atividades.length === 0) continue;
    mensagens.push(
      `📅 "${p.titulo || "(sem título)"}" está no mês ${mes} de implantação: ${atividades.join("; ")}. Já providenciou isso? Posso rodar uma lapidação considerando um atraso, se for o caso.`,
    );
    registro[p.id] = mes;
  }
  localStorage.setItem(CHAVE_CHECAGEM, JSON.stringify(registro));
  return mensagens;
}
