import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import type { Project } from "./types";

const AVISO_JURIDICO =
  "Esta é uma minuta modelo, parametrizada com os dados do projeto — exige revisão por advogado(a) e/ou contador(a) antes de qualquer assinatura ou registro em cartório. Não substitui aconselhamento jurídico.";

function baixarArquivo(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function nomeSlug(project: Project) {
  return (project.titulo || "projeto").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

function fundadores(project: Project): string[] {
  const nomes = project.equipe.map((m) => m.nome).filter((n) => n.trim());
  return nomes.length > 0 ? nomes : ["(preencher nomes dos membros fundadores)"];
}

async function gerarDocx(paragrafos: Paragraph[], nomeArquivo: string) {
  const doc = new Document({ sections: [{ children: paragrafos }] });
  const blob = await Packer.toBlob(doc);
  baixarArquivo(blob, nomeArquivo);
}

/** Minuta de estatuto de associação, parametrizada com os dados do projeto (nome, sede, finalidade, membros fundadores). */
export async function exportarEstatutoAssociacaoDocx(project: Project): Promise<void> {
  const nome = project.titulo || "(nome da associação)";
  const membros = fundadores(project);
  await gerarDocx(
    [
      new Paragraph({ text: "Minuta de Estatuto de Associação", heading: HeadingLevel.TITLE }),
      new Paragraph({ children: [new TextRun({ text: AVISO_JURIDICO, italics: true })] }),
      new Paragraph({ text: " " }),

      new Paragraph({ text: "Capítulo I — Da Denominação, Sede e Finalidade", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: `Art. 1º. A ${nome}, associação civil sem fins lucrativos, com sede em ${project.local || "(local)"}, rege-se por este Estatuto e pela legislação aplicável.` }),
      new Paragraph({ text: `Art. 2º. A associação tem por finalidade: ${project.objetivo || project.missaoImpacto || "(descrever a finalidade/objetivo do projeto)"}` }),
      new Paragraph({
        text: "Art. 3º. A associação não distribui, entre associados, conselheiros, diretores, empregados ou doadores, eventuais excedentes operacionais, brutos ou líquidos, dividendos, bonificações, participações ou parcelas do seu patrimônio.",
      }),

      new Paragraph({ text: "Capítulo II — Dos Associados", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: "Art. 4º. Podem se associar as pessoas que se identifiquem com a finalidade da associação e sejam admitidas conforme regimento interno." }),
      new Paragraph({ text: "Art. 5º. São membros fundadores:" }),
      ...membros.map((m) => new Paragraph({ text: `• ${m}` })),

      new Paragraph({ text: "Capítulo III — Da Gestão", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        text: `Art. 6º. A associação é administrada por Diretoria eleita em Assembleia Geral, com mandato a ser definido em regimento, respeitando a vedação de remuneração permanente de dirigentes fora dos limites legais.`,
      }),
      new Paragraph({
        text: `Art. 7º. Cabe à Assembleia Geral, órgão soberano, deliberar sobre as diretrizes da associação, aprovação de contas e alterações estatutárias.`,
      }),

      new Paragraph({ text: "Capítulo IV — Do Patrimônio e das Fontes de Recursos", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        text: "Art. 8º. O patrimônio da associação é constituído pelos bens e recursos adquiridos por meio do Anexo I.1 (reparação Brumadinho/bacia do Paraopeba) e outras fontes lícitas, observadas as vedações de custeio permanente sem fonte futura definida.",
      }),

      new Paragraph({ text: "Capítulo V — Da Dissolução", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        text: "Art. 9º. Em caso de dissolução, o patrimônio remanescente será destinado a entidade congênere, sem fins lucrativos, definida em Assembleia Geral, vedada a distribuição entre associados.",
      }),

      new Paragraph({ text: " " }),
      new Paragraph({ text: "Local e data: _______________________, ____/____/______" }),
      new Paragraph({ text: "Assinaturas dos membros fundadores:" }),
    ],
    `estatuto-${nomeSlug(project)}.docx`,
  );
}

/** Minuta de ata de assembleia de fundação, parametrizada com os dados do projeto. */
export async function exportarAtaFundacaoDocx(project: Project): Promise<void> {
  const nome = project.titulo || "(nome da associação)";
  const membros = fundadores(project);
  await gerarDocx(
    [
      new Paragraph({ text: "Minuta de Ata de Assembleia de Fundação", heading: HeadingLevel.TITLE }),
      new Paragraph({ children: [new TextRun({ text: AVISO_JURIDICO, italics: true })] }),
      new Paragraph({ text: " " }),

      new Paragraph({
        text: `Aos ____ dias do mês de __________ de ______, reuniram-se em ${project.local || "(local)"} as pessoas abaixo assinadas, com o objetivo de fundar a associação denominada "${nome}".`,
      }),
      new Paragraph({ text: "Membros fundadores presentes:" }),
      ...membros.map((m) => new Paragraph({ text: `• ${m}` })),

      new Paragraph({ text: "Deliberações", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: "1. Aprovação da fundação da associação e de seu Estatuto Social;" }),
      new Paragraph({ text: `2. Definição da finalidade: ${project.objetivo || "(descrever)"};` }),
      new Paragraph({ text: "3. Eleição da primeira Diretoria, com os seguintes nomes e cargos:" }),
      ...membros.map((m) => new Paragraph({ text: `• ${m} — cargo: _______________________` })),
      new Paragraph({ text: "4. Autorização para representantes legais praticarem os atos necessários ao registro em cartório." }),

      new Paragraph({ text: " " }),
      new Paragraph({ text: "Nada mais havendo a tratar, foi lavrada a presente ata, que segue assinada pelos presentes." }),
      new Paragraph({ text: "Local e data: _______________________, ____/____/______" }),
    ],
    `ata-fundacao-${nomeSlug(project)}.docx`,
  );
}

/** Minuta de regimento interno simples, parametrizada com os dados do projeto. */
export async function exportarRegimentoSimplesDocx(project: Project): Promise<void> {
  const nome = project.titulo || "(nome do projeto/associação)";
  await gerarDocx(
    [
      new Paragraph({ text: "Minuta de Regimento Interno Simples", heading: HeadingLevel.TITLE }),
      new Paragraph({ children: [new TextRun({ text: AVISO_JURIDICO, italics: true })] }),
      new Paragraph({ text: " " }),

      new Paragraph({ text: "1. Objetivo do Regimento", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: `Este regimento organiza o funcionamento cotidiano de "${nome}", complementando o Estatuto, sem contrariá-lo.` }),

      new Paragraph({ text: "2. Composição e papéis da equipe", heading: HeadingLevel.HEADING_1 }),
      ...(project.equipe.length > 0
        ? project.equipe.map(
            (m) =>
              new Paragraph({
                text: `${m.nome}${m.formacaoNecessaria ? ` (${m.formacaoNecessaria})` : ""}${m.horasSemanais ? ` — ${m.horasSemanais}h/semana` : ""}${m.duracaoMeses ? ` por ${m.duracaoMeses} meses` : ""}${m.planoTrabalho ? `: ${m.planoTrabalho}` : ""}`,
              }),
          )
        : [new Paragraph({ text: "(preencher composição da equipe no passo 'Equipe e cronograma')" })]),

      new Paragraph({ text: "3. Regras de participação da comunidade", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: project.comoComunidadeAjuda || "(descrever como a comunidade participa/ajuda)" }),

      new Paragraph({ text: "4. Uso e manutenção do espaço físico", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        text: `${project.espacoLogistica?.tipoEspaco ? `Espaço: ${project.espacoLogistica.tipoEspaco}. ` : ""}${project.espacoLogistica?.observacoes ?? "(descrever regras de uso e manutenção do espaço)"}`,
      }),

      new Paragraph({ text: "5. Prestação de contas", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        text: "A Diretoria presta contas periodicamente à Assembleia Geral e à Governança Popular/Cáritas MG (Entidade Gestora), conforme exigido pelo Anexo I.1 e pelos Ofícios Conjuntos 45 e 46/2026.",
      }),

      new Paragraph({ text: "6. Vedações (reforço do Ofício 46)", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        text: "É vedado: custeio permanente de despesas correntes sem fonte futura definida; folha de pessoal permanente sem fonte autônoma; contas individuais de consumo (água/energia/internet/telefone); substituição de renda individual.",
      }),

      new Paragraph({ text: " " }),
      new Paragraph({ text: "Aprovado em Assembleia Geral, em ____/____/______." }),
    ],
    `regimento-${nomeSlug(project)}.docx`,
  );
}
