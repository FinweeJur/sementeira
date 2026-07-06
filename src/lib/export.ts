import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun } from "docx";
import ExcelJS from "exceljs";
import type { Project } from "./types";
import { avaliarConformidade } from "./compliance-engine";
import { simularTodos, exigenciaPOS, calcularDepreciacaoMensal } from "./simulator";
import { montarChecklistFinal } from "./checklist";
import { calcularSaldosRealistas, type AnaliseEcossistema, type FundoRotativoResultado } from "./ecosystem";
import type { ClubeBeneficios } from "./clube-beneficios";
import arquetipos from "../data/arquetipos.json";
import danos from "../data/danos.json";
import setores from "../data/setores.json";

function nomeArquetipo(id: string) {
  return arquetipos.find((a) => a.id === id)?.nome ?? id;
}
function nomeDano(id: string) {
  return danos.find((d) => d.id === id)?.nome ?? id;
}
function nomeSetor(id: string) {
  return setores.find((s) => s.id === id)?.nome ?? id;
}

function baixarArquivo(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportarProjetoDocx(project: Project): Promise<void> {
  const conformidade = avaliarConformidade(project);
  const simulacoes = simularTodos(project);
  // Revisão do segundo agente não é persistida no projeto (estado só de sessão) — o checklist aqui reflete só o motor determinístico.
  const checklistFinal = montarChecklistFinal(project, null);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: project.titulo || "Projeto sem título", heading: HeadingLevel.TITLE }),
          new Paragraph({ text: `Arquétipo: ${nomeArquetipo(project.arquetipoId)}` }),
          new Paragraph({ text: `Dano coletivo vinculado: ${nomeDano(project.danoId)}` }),
          new Paragraph({ text: `Local: ${project.local} | Abrangência: ${project.abrangencia}` }),
          new Paragraph({ text: `Público/setor: ${nomeSetor(project.setorId)}` }),
          new Paragraph({ text: `Exigência de POS: ${exigenciaPOS(project)}` }),

          new Paragraph({ text: "Objetivo", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: project.objetivo || "-" }),

          new Paragraph({ text: "Justificativa", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: project.justificativa || "-" }),

          new Paragraph({ text: "Metas", heading: HeadingLevel.HEADING_1 }),
          ...(project.metas.length ? project.metas.map((m) => new Paragraph({ text: `• ${m}` })) : [new Paragraph({ text: "-" })]),

          new Paragraph({ text: "Orçamento por item", heading: HeadingLevel.HEADING_1 }),
          new Table({
            rows: [
              new TableRow({
                children: ["Categoria", "Descrição", "Valor (R$)", "Prazo (meses)"].map(
                  (t) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })] }),
                ),
              }),
              ...project.orcamento.map(
                (l) =>
                  new TableRow({
                    children: [l.categoria, l.descricao, l.valor.toFixed(2), String(l.prazoMeses ?? "-")].map(
                      (t) => new TableCell({ children: [new Paragraph(t)] }),
                    ),
                  }),
              ),
            ],
          }),

          new Paragraph({ text: "Cronograma", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: project.cronograma || "-" }),
          ...((project.cronogramaMensal?.length ?? 0) > 0
            ? [
                new Paragraph({ children: [new TextRun({ text: "Detalhamento mês a mês:", bold: true })] }),
                ...project.cronogramaMensal!.map((c) => new Paragraph({ text: `Mês ${c.mes}: ${c.atividades.join("; ")}` })),
              ]
            : []),

          new Paragraph({ text: "Equipe", heading: HeadingLevel.HEADING_1 }),
          ...(project.equipe.length
            ? project.equipe.flatMap((m) => [
                new Paragraph({ children: [new TextRun({ text: m.nome || "(sem nome/papel)", bold: true })] }),
                new Paragraph({
                  text: [
                    m.formacaoNecessaria ? `Formação necessária: ${m.formacaoNecessaria}.` : "",
                    m.horasSemanais ? `${m.horasSemanais}h/semana` : "",
                    m.duracaoMeses ? ` por ${m.duracaoMeses} meses.` : "",
                  ]
                    .filter(Boolean)
                    .join(" "),
                }),
                new Paragraph({ text: m.planoTrabalho ? `Plano de trabalho: ${m.planoTrabalho}` : "" }),
              ])
            : [new Paragraph({ text: "-" })]),

          new Paragraph({ text: "Como a comunidade pode ajudar", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: project.comoComunidadeAjuda || "-" }),

          new Paragraph({ text: "Missão / impacto na vida das pessoas", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: project.missaoImpacto || "-" }),

          new Paragraph({ text: "Coordenado por mulher(es)?", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: project.coordenacaoFeminina ? "Sim" : "Não" }),

          new Paragraph({ text: "Formas de arrecadação / captação", heading: HeadingLevel.HEADING_1 }),
          ...(project.formasArrecadacao.length
            ? project.formasArrecadacao.map((f) => new Paragraph({ text: `• ${f}` }))
            : [new Paragraph({ text: "-" })]),

          new Paragraph({
            text: "Plano Obrigatório de Sustentabilidade (POS) — Simulação 'o dia seguinte'",
            heading: HeadingLevel.HEADING_1,
          }),
          ...simulacoes.map(
            (s) =>
              new Paragraph({
                text: `${s.cenario}: receita R$ ${s.receitaMensalEstimada.toFixed(2)}/mês, custo total R$ ${s.custoOperacionalTotalMensal.toFixed(2)}/mês, saldo R$ ${s.saldoMensal.toFixed(2)}/mês — ${s.autossustentavel ? "autossustentável" : "NÃO autossustentável"}.`,
              }),
          ),
          ...(exigenciaPOS(project) === "completo"
            ? [
                new Paragraph({ text: `Responsável pela operação: ${project.posCompleto.responsavelOperacao ?? "-"}` }),
                new Paragraph({ text: `Fonte de custeio futuro geral: ${project.posCompleto.fonteCusteioFuturoGeral ?? "-"}` }),
                new Paragraph({ text: `Metodologia de transição: ${project.posCompleto.metodologiaTransicao ?? "-"}` }),
                new Paragraph({ text: `Indicadores de autonomia: ${project.posCompleto.indicadoresAutonomia ?? "-"}` }),
              ]
            : []),

          ...(() => {
            const dep = calcularDepreciacaoMensal(project);
            return dep > 0
              ? [new Paragraph({ text: `Depreciação de equipamentos: R$ ${dep.toFixed(2)}/mês — fonte de reposição: ${project.fonteReposicaoEquipamentos || "não indicada"}` })]
              : [];
          })(),

          ...(project.espacoLogistica && (project.espacoLogistica.areaM2 || project.espacoLogistica.tipoEspaco || project.espacoLogistica.acesso || project.espacoLogistica.distanciaFornecedoresKm)
            ? [
                new Paragraph({ text: "Espaço e logística", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({
                  text: `${project.espacoLogistica.areaM2 ? `Área necessária: ${project.espacoLogistica.areaM2} m². ` : ""}${project.espacoLogistica.tipoEspaco ? `Tipo: ${project.espacoLogistica.tipoEspaco}. ` : ""}${project.espacoLogistica.acesso ? `Acesso: ${project.espacoLogistica.acesso}. ` : ""}${project.espacoLogistica.distanciaFornecedoresKm ? `Distância a fornecedores/parceiros: ${project.espacoLogistica.distanciaFornecedoresKm} km.` : ""}`,
                }),
                ...(project.espacoLogistica.observacoes ? [new Paragraph({ text: project.espacoLogistica.observacoes })] : []),
              ]
            : []),

          new Paragraph({ text: "Matriz de risco", heading: HeadingLevel.HEADING_1 }),
          ...(project.riscos.length
            ? project.riscos.map((r) => new Paragraph({ text: `• ${r.descricao} — probabilidade ${r.probabilidade}, impacto ${r.impacto}. Mitigação: ${r.mitigacao || "-"}` }))
            : [new Paragraph({ text: "-" })]),

          ...(project.planoImplementacao && project.planoImplementacao.length
            ? [
                new Paragraph({ text: "Plano de implementação (pré-produção → operação)", heading: HeadingLevel.HEADING_1 }),
                ...project.planoImplementacao.map((p, i) => new Paragraph({ text: `${i + 1}. ${p}` })),
              ]
            : []),

          ...(project.observacoesEcossistema && project.observacoesEcossistema.length
            ? [
                new Paragraph({ text: "Observações do ecossistema (integração com outros projetos)", heading: HeadingLevel.HEADING_1 }),
                ...project.observacoesEcossistema.map((o) => new Paragraph({ text: `• ${o}` })),
              ]
            : []),

          new Paragraph({ text: "Checagem de conformidade", heading: HeadingLevel.HEADING_1 }),
          ...conformidade.map(
            (f) =>
              new Paragraph({
                text: `[${f.severidade.toUpperCase()}] ${f.regra}: ${f.mensagem}`,
              }),
          ),

          new Paragraph({ text: "Contato", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `Coordenador(a): ${project.contato.coordenador ?? "-"}` }),
          new Paragraph({ text: `Telefone: ${project.contato.telefone ?? "-"}` }),
          new Paragraph({ text: `Endereço: ${project.contato.endereco ?? "-"}` }),
          new Paragraph({ text: `E-mail: ${project.contato.email ?? "-"}` }),

          new Paragraph({ text: "Checklist final", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "Próximos passos:", children: [new TextRun({ text: "Próximos passos:", bold: true })] }),
          ...checklistFinal.proximosPassos.map((p) => new Paragraph({ text: `• ${p}` })),
          ...(checklistFinal.pendencias.length
            ? [new Paragraph({ children: [new TextRun({ text: "Pendências:", bold: true })] }), ...checklistFinal.pendencias.map((p) => new Paragraph({ text: `• ${p}` }))]
            : []),
          ...(checklistFinal.recomendacoes.length
            ? [new Paragraph({ children: [new TextRun({ text: "Recomendações:", bold: true })] }), ...checklistFinal.recomendacoes.map((p) => new Paragraph({ text: `• ${p}` }))]
            : []),
          ...(checklistFinal.perguntas.length
            ? [new Paragraph({ children: [new TextRun({ text: "Perguntas em aberto:", bold: true })] }), ...checklistFinal.perguntas.map((p) => new Paragraph({ text: `• ${p}` }))]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  baixarArquivo(blob, `${project.titulo || "projeto"}.docx`);
}

export async function exportarProjetoXlsx(project: Project): Promise<void> {
  const wb = new ExcelJS.Workbook();

  const resumo = wb.addWorksheet("Resumo");
  resumo.addRows([
    ["Título", project.titulo],
    ["Arquétipo", nomeArquetipo(project.arquetipoId)],
    ["Dano vinculado", nomeDano(project.danoId)],
    ["Local", project.local],
    ["Abrangência", project.abrangencia],
    ["Setor/público", nomeSetor(project.setorId)],
    ["Exigência de POS", exigenciaPOS(project)],
    ["Objetivo", project.objetivo],
    ["Justificativa", project.justificativa],
  ]);

  const orc = wb.addWorksheet("Orçamento");
  orc.addRow(["Categoria", "Descrição", "Valor (R$)", "Prazo (meses)", "Fonte custeio futuro"]);
  for (const l of project.orcamento) {
    orc.addRow([l.categoria, l.descricao, l.valor, l.prazoMeses ?? "", l.fonteCusteioFuturo ?? ""]);
  }
  orc.addRow(["", "TOTAL", project.orcamento.reduce((s, l) => s + l.valor, 0), "", ""]);

  const sim = wb.addWorksheet("Simulação POS");
  sim.addRow(["Cenário", "Receita/mês", "Custo total/mês", "Saldo/mês", "Autossustentável?"]);
  for (const s of simularTodos(project)) {
    sim.addRow([s.cenario, s.receitaMensalEstimada, s.custoOperacionalTotalMensal, s.saldoMensal, s.autossustentavel ? "Sim" : "Não"]);
  }

  const riscos = wb.addWorksheet("Riscos");
  riscos.addRow(["Descrição", "Probabilidade", "Impacto", "Mitigação"]);
  for (const r of project.riscos) {
    riscos.addRow([r.descricao, r.probabilidade, r.impacto, r.mitigacao]);
  }

  const conf = wb.addWorksheet("Conformidade");
  conf.addRow(["Severidade", "Regra", "Mensagem"]);
  for (const f of avaliarConformidade(project)) {
    conf.addRow([f.severidade, f.regra, f.mensagem]);
  }

  const checklistFinal = montarChecklistFinal(project, null);
  const chk = wb.addWorksheet("Checklist final");
  chk.addRow(["Tipo", "Item"]);
  for (const p of checklistFinal.proximosPassos) chk.addRow(["Próximo passo", p]);
  for (const p of checklistFinal.pendencias) chk.addRow(["Pendência", p]);
  for (const p of checklistFinal.recomendacoes) chk.addRow(["Recomendação", p]);
  for (const p of checklistFinal.perguntas) chk.addRow(["Pergunta em aberto", p]);

  const buffer = await wb.xlsx.writeBuffer();
  baixarArquivo(new Blob([buffer]), `${project.titulo || "projeto"}.xlsx`);
}

export function exportarProjetoPdf(): void {
  // MVP: usa a impressão nativa do Chromium/Electron (Ctrl+P → Salvar como PDF)
  // sobre uma visão de impressão dedicada. Fase 2 troca por webContents.printToPDF via IPC.
  window.print();
}

export async function exportarEcossistemaDocx(projects: Project[], analise: AnaliseEcossistema | null, fundo: FundoRotativoResultado): Promise<void> {
  const saldos = calcularSaldosRealistas(projects);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Documento do Ecossistema de Projetos", heading: HeadingLevel.TITLE }),
          new Paragraph({ text: `${projects.length} projeto(s) cadastrado(s).` }),

          new Paragraph({ text: "Saldo mensal por projeto (cenário realista)", heading: HeadingLevel.HEADING_1 }),
          ...saldos.map((s) => new Paragraph({ text: `${s.titulo}: R$ ${s.saldoMensalRealista.toFixed(2)}/mês` })),

          new Paragraph({ text: "Análise de complementaridades, redundâncias e mercado comprador", heading: HeadingLevel.HEADING_1 }),
          ...(analise
            ? [
                new Paragraph({ children: [new TextRun({ text: "Complementaridades:", bold: true })] }),
                ...(analise.complementaridades.length ? analise.complementaridades.map((c) => new Paragraph({ text: `• ${c}` })) : [new Paragraph({ text: "-" })]),
                new Paragraph({ children: [new TextRun({ text: "Redundâncias:", bold: true })] }),
                ...(analise.redundancias.length ? analise.redundancias.map((c) => new Paragraph({ text: `• ${c}` })) : [new Paragraph({ text: "-" })]),
                new Paragraph({ children: [new TextRun({ text: "Mercado comprador entre projetos:", bold: true })] }),
                ...(analise.mercadosCompradores.length ? analise.mercadosCompradores.map((c) => new Paragraph({ text: `• ${c}` })) : [new Paragraph({ text: "-" })]),
              ]
            : [new Paragraph({ text: "Análise por IA ainda não executada." })]),

          new Paragraph({ text: "Simulação de Fundo Rotativo Solidário", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `Pool mensal formado: R$ ${fundo.poolMensal.toFixed(2)}` }),
          ...fundo.contribuintes.map((c) => new Paragraph({ text: `Contribuinte — ${c.titulo}: R$ ${c.contribuicaoMensal.toFixed(2)}/mês` })),
          ...fundo.beneficiarios.map(
            (b) => new Paragraph({ text: `Beneficiário — ${b.titulo}: déficit R$ ${b.deficitMensal.toFixed(2)}/mês, cobertura estimada R$ ${b.coberturaEstimada.toFixed(2)}/mês` }),
          ),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  baixarArquivo(blob, "ecossistema-projetos.docx");
}

export async function exportarClubeBeneficiosDocx(clube: ClubeBeneficios, projects: Project[]): Promise<void> {
  const nomeProjeto = (id: string) => projects.find((p) => p.id === id)?.titulo || "(projeto removido)";

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Clube de Benefícios", heading: HeadingLevel.TITLE }),
          new Paragraph({ text: "Cartão de associado, programa de pontos e vitrine dos produtos/serviços gerados pelos projetos do Anexo I.1." }),

          new Paragraph({ text: "Ofertas e descontos (vitrine)", heading: HeadingLevel.HEADING_1 }),
          ...(clube.ofertas.length
            ? clube.ofertas.map((o) => new Paragraph({ text: `• ${nomeProjeto(o.projectId)} — ${o.titulo}: ${o.descricao}` }))
            : [new Paragraph({ text: "-" })]),

          new Paragraph({ text: "Programa de pontos", heading: HeadingLevel.HEADING_1 }),
          ...(clube.regrasPontos.length ? clube.regrasPontos.map((r) => new Paragraph({ text: `• ${r.descricao} — ${r.pontosGanhos} pontos` })) : [new Paragraph({ text: "-" })]),

          new Paragraph({ text: "Prêmios resgatáveis", heading: HeadingLevel.HEADING_1 }),
          ...(clube.premios.length ? clube.premios.map((p) => new Paragraph({ text: `• ${p.nome} — ${p.custoPontos} pontos` })) : [new Paragraph({ text: "-" })]),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  baixarArquivo(blob, "clube-beneficios.docx");
}
