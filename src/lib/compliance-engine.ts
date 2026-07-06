import type { BudgetLine, ComplianceFinding, Project } from "./types";
import { exigenciaPOS, ondaEsperada, calcularDepreciacaoMensal } from "./simulator";
import arquetipos from "../data/arquetipos.json";
import custosCatalogo from "../data/custos-nao-cobertos.json";

/**
 * Motor de conformidade: aplica as vedações e regras de elegibilidade do
 * Ofício Conjunto n° 46/2026 sobre cada linha de orçamento.
 * Regras não são exaustivas — cobrem os pontos que mais derrubam projetos.
 */
export function avaliarConformidade(project: Project): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  const arquetipo = arquetipos.find((a) => a.id === project.arquetipoId);

  for (const linha of project.orcamento) {
    findings.push(...avaliarLinha(linha));
  }

  // Meta #1 do programa: 100% dos projetos alinhados à reparação de danos.
  if (!project.danoId) {
    findings.push({
      severidade: "bloqueio",
      regra: "Meta #1 (Proposta Definitiva)",
      mensagem: "Todo projeto deve estar vinculado a um dano coletivo priorizado. Selecione o dano antes de prosseguir.",
    });
  }

  // 4.4 Políticas públicas: exige anuência formal do ente público.
  if (arquetipo?.tipo === "4.4") {
    const semAnuencia = project.orcamento.some((l) => l.anuenciaEntePublico !== true);
    if (semAnuencia) {
      findings.push({
        severidade: "bloqueio",
        regra: "Ofício 46, item 4.4, §1º",
        mensagem: "Projetos de política pública/equipamento público exigem anuência formal prévia do ente público quanto a manutenção e custeio futuros. Sem isso, o Anexo I.1 não pode financiar a operação.",
      });
    }
  }

  // POS obrigatório conforme porte (dispensa só se <12m e não continuado — não modelado aqui, tratar como alerta).
  if (project.cenarios.every((c) => c.receitaMensalEstimada === 0 && c.custoOperacionalMensal === 0)) {
    findings.push({
      severidade: "atencao",
      regra: "Ofício 46, item 1 (Plano Obrigatório de Sustentabilidade)",
      mensagem: "Nenhum cenário de sustentabilidade foi simulado ainda. Preencha o simulador 'o dia seguinte' — é condição para iniciar a execução do projeto.",
    });
  }

  // POS completo (porte médio/grande): exige campos adicionais além do simplificado.
  if (exigenciaPOS(project) === "completo") {
    const faltando: string[] = [];
    if (!project.posCompleto.responsavelOperacao) faltando.push("responsável pela operação e manutenção");
    if (!project.posCompleto.fonteCusteioFuturoGeral) faltando.push("fonte de custeio futuro geral do projeto");
    if (!project.posCompleto.metodologiaTransicao) faltando.push("metodologia de transição");
    if (!project.posCompleto.indicadoresAutonomia) faltando.push("indicadores de autonomia");
    if (faltando.length > 0) {
      findings.push({
        severidade: "bloqueio",
        regra: "Ofício 46, item 1, incisos II-VI (POS completo)",
        mensagem: `Projetos de porte médio/grande exigem um Plano Obrigatório de Sustentabilidade completo. Falta preencher: ${faltando.join(", ")}.`,
      });
    }
  }

  // Estimador de custos não cobertos (Fase 4): todo custo marcado como não coberto pelo Anexo
  // precisa de fonte futura de custeio — sem isso, o POS não se sustenta de verdade.
  for (const custo of project.custosNaoCobertos) {
    if (custo.fonteCusteioFuturo) continue;
    const categoria = custosCatalogo.find((c) => c.id === custo.id)?.categoria;
    const severidade = categoria === "consumo-vedado" ? "bloqueio" : "atencao";
    findings.push({
      severidade,
      regra: severidade === "bloqueio" ? "Ofício 46, item 4.2, §1º" : "Ofício 46, item 1 (Plano Obrigatório de Sustentabilidade)",
      mensagem: `"${custo.nome}" (R$ ${custo.valorMensalEstimado.toFixed(2)}/mês) está marcado como não coberto pelo Anexo, mas ainda não tem fonte de custeio futuro indicada — sem isso, o projeto não se sustenta sozinho depois do repasse.`,
    });
  }

  // Diretriz local: porte mínimo de R$ 100 mil — projeto menor que isso tende a não
  // justificar a estrutura exigida (POS, governança); o orçamento deve corresponder a esse valor.
  const totalOrcamento = project.orcamento.reduce((soma, l) => soma + (Number.isFinite(l.valor) ? l.valor : 0), 0);
  if (project.orcamento.length > 0 && totalOrcamento < 100_000) {
    findings.push({
      severidade: "atencao",
      regra: "Diretriz de porte mínimo (configuração local)",
      mensagem: `O orçamento total soma R$ ${totalOrcamento.toFixed(2)} — abaixo do porte mínimo de R$ 100.000,00 definido como diretriz. Detalhe mais o projeto (equipamentos, implantação, capacitação, integração com outros projetos da rede) até o orçamento corresponder ao porte.`,
    });
  }

  // Diretriz local: todo projeto deve prever a liberação de pelo menos 2 pessoas por 6 meses
  // (equipe mínima para implantação e operação inicial).
  if (project.equipe.filter((m) => m?.nome?.trim()).length < 2) {
    findings.push({
      severidade: "atencao",
      regra: "Diretriz de equipe mínima (configuração local)",
      mensagem: "Todo projeto deve prever a liberação de pelo menos 2 pessoas por 6 meses. Liste no mínimo 2 pessoas na equipe, com a dedicação/período de cada uma.",
    });
  }

  // Depreciação de equipamentos: sem fonte futura de reposição, o POS ignora que
  // o maquinário se desgasta e superestima a sustentabilidade real do projeto.
  const depreciacaoMensal = calcularDepreciacaoMensal(project);
  if (depreciacaoMensal > 0 && !project.fonteReposicaoEquipamentos) {
    findings.push({
      severidade: "atencao",
      regra: "Ofício 46, item 1 (Plano Obrigatório de Sustentabilidade)",
      mensagem: `Os equipamentos do orçamento se desgastam e custam ~R$ ${depreciacaoMensal.toFixed(2)}/mês em depreciação — sem uma fonte futura de reposição, o projeto vai parar quando o equipamento quebrar. Indique a fonte de reposição.`,
    });
  }

  // Onda de execução: 1ª onda (local/regional) tem teto de 12 meses até a contratação.
  const onda = ondaEsperada(project);
  if (onda.tetoMeses && /(\d+)\s*(mes|mês|meses)/i.test(project.cronograma)) {
    const match = project.cronograma.match(/(\d+)\s*(mes|mês|meses)/i);
    const mesesMencionados = match ? Number(match[1]) : 0;
    if (mesesMencionados > onda.tetoMeses) {
      findings.push({
        severidade: "atencao",
        regra: "Proposta Definitiva pág. 25 (Ondas de projetos)",
        mensagem: `Este projeto está na 1ª onda (${project.abrangencia}), com teto de ${onda.tetoMeses} meses até a contratação. O cronograma menciona ${mesesMencionados} meses — confirme se isso é compatível ou revise o prazo.`,
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      severidade: "ok",
      regra: "Checagem geral",
      mensagem: "Nenhuma vedação identificada nas linhas de orçamento atuais.",
    });
  }

  return findings;
}

function avaliarLinha(linha: BudgetLine): ComplianceFinding[] {
  const out: ComplianceFinding[] = [];

  // Vedação Geral III: folha de pessoal permanente sem fonte futura de custeio.
  if (linha.categoria === "folha-permanente" && !linha.fonteCusteioFuturo) {
    out.push({
      severidade: "bloqueio",
      linhaId: linha.id,
      regra: "Ofício 46, Vedação Geral III",
      mensagem: `"${linha.descricao}": pagamento permanente de folha é vedado sem fonte autônoma, coletiva ou pública formalmente assumida de custeio futuro. Indique a fonte futura.`,
    });
  }

  // Capital de giro / insumos iniciais / operação assistida > 6 meses sem justificativa de ciclo produtivo.
  const categoriasComTeto6m: string[] = ["capital-giro-inicial", "insumos-iniciais", "equipe-implantacao", "operacao-assistida"];
  if (categoriasComTeto6m.includes(linha.categoria) && (linha.prazoMeses ?? 0) > 6 && !linha.justificativaCicloProdutivo) {
    out.push({
      severidade: "atencao",
      linhaId: linha.id,
      regra: "Ofício 46, item 4.1 §1º/§3º",
      mensagem: `"${linha.descricao}": prazo de ${linha.prazoMeses} meses excede os 6 meses preferenciais. Só é admitido com justificativa técnica ligada ao ciclo produtivo — preencha essa justificativa.`,
    });
  }

  // 4.2 §1º: contas individuais de consumo (água/energia/telefonia/internet) — vedação permanente.
  const consumoIndividualPattern = /(conta.*(água|agua|energia|telefon|internet))|(insumo alimentar.*permanente)/i;
  if (consumoIndividualPattern.test(linha.descricao) && !linha.fonteCusteioFuturo) {
    out.push({
      severidade: "bloqueio",
      linhaId: linha.id,
      regra: "Ofício 46, item 4.2, §1º/§3º",
      mensagem: `"${linha.descricao}": financiamento permanente de contas individuais de consumo ou insumo alimentar diário é vedado, salvo arranjo institucional formal e sustentável de continuidade. Indique o arranjo.`,
    });
  }

  return out;
}
