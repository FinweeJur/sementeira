import type { Project, BudgetLine } from "./types";
import { formatarReal } from "./precos-publicos";

/**
 * Bloco de contexto sobre preços para o copiloto (Dona Lúcia).
 *
 * Existe por um motivo que vai além de informar: **a IA não pode dar preço de cabeça.**
 * O app passou a sustentar cada valor de orçamento com compras públicas reais — órgão, data,
 * CNPJ do fornecedor —, e um chute do modelo dito com a mesma naturalidade destruiria a única
 * coisa que essa cotação comprou, que é poder responder "de onde veio esse número". É a mesma
 * regra que já vale para a conformidade: quem decide é o motor determinístico, a IA orienta.
 *
 * Segue a convenção dos outros blocos (`montarBlocoDiretrizesGlobais`, `montarBlocoDocumentosBase`):
 * texto puro, montado a partir do estado real do projeto, concatenado no prompt de sistema.
 */

const ROTULO_ABRANGENCIA: Record<string, string> = {
  paraopeba: "municípios da bacia do Paraopeba",
  mg: "Minas Gerais",
  brasil: "Brasil inteiro",
};

const ROTULO_CRITERIO: Record<string, string> = {
  mediana: "valor do meio",
  media: "média",
  "menor-preco": "menor preço",
};

function descreverLinha(linha: BudgetLine): string {
  const descricao = linha.descricao.trim() || "(sem descrição)";
  const r = linha.referenciaPreco;
  if (!r) return `- "${descricao}": ${formatarReal(linha.valor)} — SEM referência de compras públicas.`;

  const criterio = ROTULO_CRITERIO[r.criterio] ?? r.criterio;
  const onde = ROTULO_ABRANGENCIA[r.abrangenciaPreco] ?? r.abrangenciaPreco;
  const base = `- "${descricao}": ${formatarReal(linha.valor)} — ${criterio} de ${r.quantidadePrecos} compra(s) pública(s) de ${onde}, faixa ${formatarReal(r.minimo)} a ${formatarReal(r.maximo)} por ${r.unidade}, consultado em ${r.consultadoEm}.`;
  return r.alertas.length > 0 ? `${base} Ressalva: ${r.alertas.join(" ")}` : base;
}

/**
 * Monta o bloco. Devolve string vazia quando não há orçamento — bloco vazio é
 * filtrado pelo chamador e não gasta contexto do modelo à toa.
 */
export function montarBlocoPrecos(project: Project): string {
  const linhas = project.orcamento ?? [];

  const regras = [
    "COMO OS PREÇOS FUNCIONAM NESTE APP (importante):",
    'O app consulta preços que órgãos públicos realmente pagaram, em duas fontes oficiais: o Compras.gov.br (compras federais e de prefeituras) e o PNCP (que alcança também o governo de Minas). O botão fica na linha do orçamento, chamado "Buscar preço em compras públicas".',
    "O valor sugerido é o do meio de várias compras (não a mais barata nem a mais cara), preferindo preços de perto: primeiro os municípios da bacia do Paraopeba, depois Minas Gerais, e só então o Brasil inteiro. O app guarda junto o órgão que comprou, a data e o fornecedor, e isso sai no documento exportado, numa coluna chamada \"Referência do preço\".",
    "REGRA QUE VOCÊ NÃO PODE QUEBRAR: **nunca invente um valor em reais nem diga de memória quanto custa alguma coisa.** Se perguntarem preço de um item, oriente a usar o botão de buscar preço em compras públicas. Um número que você chuta parece tão certo quanto um número apurado, e é isso que o app existe para evitar — na hora de prestar contas, ninguém consegue defender um preço que veio de conversa.",
    "Você PODE, e deve: explicar o que a referência quer dizer, apontar quando ela tem ressalva, notar linha sem referência nenhuma, e comentar se o orçamento faz sentido no conjunto (proporção entre itens, item faltando, item que o acordo não cobre).",
    "Quando o app avisa que os preços 'variam muito entre si', quase sempre não são o mesmo produto — o caminho é descrever melhor o item, não escolher um número no meio do caminho.",
    "Se o item não aparecer nas compras públicas, isso é comum em máquina específica de produção. Nesse caso a saída é pedir cotação direta a pelo menos três fornecedores (o app gera esse pedido em .docx pelo botão de cotação) — e não estimar por conta própria.",
  ].join(" ");

  if (linhas.length === 0) {
    return [regras, "O orçamento deste projeto ainda está vazio."].join("\n\n");
  }

  const comReferencia = linhas.filter((l) => l.referenciaPreco);
  const semReferencia = linhas.filter((l) => !l.referenciaPreco);

  const situacao = [
    `ORÇAMENTO ATUAL DESTE PROJETO (${linhas.length} item(ns), total ${formatarReal(linhas.reduce((s, l) => s + l.valor, 0))}):`,
    linhas.map(descreverLinha).join("\n"),
  ].join("\n");

  const leitura =
    semReferencia.length === 0
      ? "Todas as linhas têm referência de compras públicas."
      : `${semReferencia.length} de ${linhas.length} linha(s) ainda não têm referência de compras públicas. Se a conversa passar por orçamento, vale sugerir buscar o preço dessas — valor sem procedência é o que costuma ser questionado depois.`;

  const dispersas = comReferencia.filter((l) => (l.referenciaPreco?.alertas.length ?? 0) > 0).length;
  const ressalvas = dispersas > 0 ? `${dispersas} linha(s) com referência têm ressalva registrada; vale olhar antes de fechar o orçamento.` : "";

  return [regras, situacao, leitura, ressalvas].filter(Boolean).join("\n\n");
}
