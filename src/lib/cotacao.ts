import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun } from "docx";
import type { BudgetLine, Project } from "./types";
import { derivarConexoes } from "./mapa-estagios";

/** Projetos da própria rede que já fornecem para este (via `derivarConexoes`) — aparecem primeiro nas sugestões de fornecedor, por decisão do plano (economia circular). */
export function sugerirFornecedoresRede(todosProjetos: Project[], project: Project): { id: string; titulo: string; rotulo: string }[] {
  const conexoes = derivarConexoes(todosProjetos);
  const porId = new Map(todosProjetos.map((p) => [p.id, p]));
  return conexoes
    .filter((c) => c.paraId === project.id)
    .map((c) => ({ id: c.deId, titulo: porId.get(c.deId)?.titulo || "(sem título)", rotulo: c.rotulo }))
    .filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i);
}

function baixarArquivo(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** Gera um .docx de solicitação de cotação para uma linha de orçamento, pronto para enviar a fornecedores. */
export async function exportarSolicitacaoCotacaoDocx(project: Project, linha: BudgetLine, fornecedoresRede: { titulo: string; rotulo: string }[]): Promise<void> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Solicitação de cotação de preço", heading: HeadingLevel.TITLE }),
          new Paragraph({ text: `Projeto: ${project.titulo || "(sem título)"}` }),
          new Paragraph({ text: `Local: ${project.local || "-"}` }),
          new Paragraph({ text: `Contato: ${project.contato?.coordenador || "-"}${project.contato?.telefone ? ` · ${project.contato.telefone}` : ""}${project.contato?.email ? ` · ${project.contato.email}` : ""}` }),

          new Paragraph({ text: "Item a cotar", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `Categoria: ${linha.categoria}` }),
          new Paragraph({ text: `Descrição: ${linha.descricao.replace(/\s*\(pesquisar preço\)\s*$/i, "").trim() || "-"}` }),
          new Paragraph({ text: `Prazo desejado: ${linha.prazoMeses ? `${linha.prazoMeses} mês(es)` : "a combinar"}` }),

          ...(fornecedoresRede.length > 0
            ? [
                new Paragraph({ text: "Fornecedores da rede (economia circular) — considerar antes de buscar fora", heading: HeadingLevel.HEADING_1 }),
                ...fornecedoresRede.map((f) => new Paragraph({ text: `• ${f.titulo} — ${f.rotulo}` })),
              ]
            : []),

          new Paragraph({ text: "Solicitamos preencher e retornar", heading: HeadingLevel.HEADING_1 }),
          new Table({
            rows: [
              new TableRow({
                children: ["Campo", "Preenchimento do fornecedor"].map((t) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })] })),
              }),
              ...["Nome / razão social", "CNPJ ou CPF", "Valor proposto (R$)", "Prazo de entrega (dias)", "Validade da proposta", "Observações"].map(
                (campo) => new TableRow({ children: [new TableCell({ children: [new Paragraph(campo)] }), new TableCell({ children: [new Paragraph(" ")] })] }),
              ),
            ],
          }),

          new Paragraph({ text: " " }),
          new Paragraph({ text: "Este documento é uma solicitação informal de cotação, sem compromisso de compra. As propostas recebidas serão comparadas antes da decisão final." }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  baixarArquivo(blob, `cotacao-${(project.titulo || "projeto").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${linha.categoria}.docx`);
}
