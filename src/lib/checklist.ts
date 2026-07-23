import type { Project } from "./types";
import type { RevisaoResultado } from "./revisao-agente";
import { avaliarConformidade } from "./compliance-engine";
import { exigenciaPOS } from "./simulator";

export interface ChecklistFinal {
  proximosPassos: string[];
  pendencias: string[];
  recomendacoes: string[];
  perguntas: string[];
}

/** Síntese não-bloqueante do estado do projeto — combina o motor determinístico com a revisão do segundo agente (se já rodou). */
export function montarChecklistFinal(project: Project, revisao: RevisaoResultado | null): ChecklistFinal {
  const findings = avaliarConformidade(project);
  const bloqueios = findings.filter((f) => f.severidade === "bloqueio");

  const pendencias: string[] = [];
  if (!project.danoId) pendencias.push("Selecionar o dano coletivo vinculado.");
  if (!project.arquetipoId) pendencias.push("Selecionar o tipo/arquétipo do projeto.");
  if (!project.objetivo.trim()) pendencias.push("Preencher o objetivo.");
  if (!project.justificativa.trim()) pendencias.push("Preencher a justificativa.");
  if (project.metas.length === 0) pendencias.push("Adicionar ao menos uma meta/indicador de resultado.");
  if (project.orcamento.length === 0) pendencias.push("Preencher o orçamento por item.");
  if (project.cenarios.every((c) => c.receitaMensalEstimada === 0 && c.custoOperacionalMensal === 0)) {
    pendencias.push("Simular ao menos um cenário no simulador 'o dia seguinte' (POS).");
  }
  for (const f of bloqueios) pendencias.push(`Resolver bloqueio: ${f.mensagem}`);

  const proximosPassos: string[] = [];
  if (pendencias.length === 0) {
    proximosPassos.push("Projeto sem pendências óbvias — revisar uma última vez e exportar para levar à Governança.");
  } else {
    proximosPassos.push("Completar as pendências listadas antes de exportar.");
  }
  proximosPassos.push(`Exigência de Plano Obrigatório de Sustentabilidade (POS) para este porte: ${exigenciaPOS(project)}.`);
  if (revisao?.adequado === "inadequado") {
    proximosPassos.push("Revisar as mudanças sugeridas pelo agente de revisão (Ofícios 45/46 + Proposta) antes de finalizar.");
  }
  if (revisao?.adequado === "indefinido") {
    proximosPassos.push("O agente de revisão não devolveu um veredito legível — rode a revisão de novo. O motor de conformidade continua valendo como palavra final.");
  }

  return {
    proximosPassos,
    pendencias,
    recomendacoes: revisao?.recomendacoes ?? [],
    perguntas: revisao?.perguntas ?? [],
  };
}
