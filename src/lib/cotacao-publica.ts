/**
 * Cotação de uma linha de orçamento a partir dos sistemas públicos de compras.
 *
 * É a porta de entrada usada pelo wizard. A ordem é deliberada:
 *
 * 1. **Compras públicas primeiro.** É preço que órgão público de fato pagou, com data, órgão,
 *    fornecedor e CNPJ — dá para conferir. E funciona sem chave de IA e sem chave de busca.
 * 2. **IA só depois, e só se aquilo não existir no catálogo público.** Máquina específica de
 *    produção muitas vezes não está no CATMAT; aí a estimativa de mercado é o que há.
 *
 * A inversão importa para o tipo de projeto que a Sementeira atende: o valor vai para uma
 * prestação de contas que pode ser questionada, e "a IA estimou" é resposta muito pior do que
 * "a Prefeitura de Betim pagou isso em março, aqui está a compra".
 */

import { buscarNoCatalogo, type ItemCatalogo } from "./catmat";
import { buscarPrecosComprasGov, buscarPrecosPncp } from "./precos-fontes";
import { montarCesta, type CestaPrecos, type PrecoObservado } from "./precos-publicos";

export interface ResultadoCotacaoPublica {
  ok: boolean;
  /** Item do catálogo que foi usado — permite ao usuário corrigir a escolha. */
  itemEscolhido?: ItemCatalogo;
  /** Outras opções de catálogo para o mesmo termo, caso a primeira não seja a certa. */
  alternativas?: ItemCatalogo[];
  cesta?: CestaPrecos;
  erro?: string;
}

/** Tira da descrição o ruído que atrapalha o casamento com o catálogo. */
export function termoDeBusca(descricao: string): string {
  return descricao
    .replace(/\s*\(pesquisar preço\)\s*/gi, " ")
    .replace(/\b(\d+[.,]?\d*)\s*(un|und|unid|unidades?|pe(ç|c)as?|kg|g|l|ml|m|cm|mm)\b/gi, " ")
    .replace(/\b(para|de|do|da|dos|das|com|sem|e|ou|em|no|na)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface OpcoesCotacao {
  /** UF de preferência. O padrão é MG — é onde estão os projetos. */
  uf?: string;
  /** Meses de histórico a considerar. Preço velho subestima o custo de hoje. */
  janelaMeses?: number;
  /** Injetável no teste. */
  hoje?: Date;
  /** Força um item de catálogo, quando o usuário corrigiu a escolha automática. */
  codigoPdm?: number;
  /** Desliga o PNCP (útil em teste, ou quando só se quer o homologado federal). */
  incluirPncp?: boolean;
}

function dataMenosMeses(referencia: Date, meses: number): string {
  const d = new Date(referencia);
  d.setMonth(d.getMonth() - meses);
  return d.toISOString().slice(0, 10);
}

/**
 * Cota um item nas compras públicas.
 *
 * A busca de preço é feita **sem filtro de UF** e o recorte regional acontece depois, ao montar
 * a cesta. É de propósito: filtrar por MG na origem costuma devolver poucos registros e a cesta
 * já nasce insuficiente, enquanto trazer o país inteiro e afunilar depois deixa `montarCesta`
 * escolher o recorte mais próximo que ainda seja defensável — e mantém os preços de fora
 * disponíveis para mostrar como comparação.
 */
export async function cotarNasComprasPublicas(descricao: string, opcoes: OpcoesCotacao = {}): Promise<ResultadoCotacaoPublica> {
  const termo = termoDeBusca(descricao);
  if (!termo) return { ok: false, erro: "Descreva o item antes de cotar." };

  const hoje = opcoes.hoje ?? new Date();
  const janela = opcoes.janelaMeses ?? 24;
  const candidatos = await buscarNoCatalogo(termo, { limite: 8 });
  const escolhido = opcoes.codigoPdm ? candidatos.find((c) => c.codigoPdm === opcoes.codigoPdm) ?? candidatos[0] : candidatos[0];

  // As duas fontes vão juntas e em paralelo. O Compras.gov.br dá volume de preço homologado
  // mas é cego para o governo de MG; o PNCP cobre o estado. Quem só consulta a primeira nunca
  // vê o comprador estadual — que é justamente o mais próximo dos projetos daqui.
  const [federal, pncp] = await Promise.all([
    escolhido
      ? buscarPrecosComprasGov(escolhido.codigoPdm, {
          dataInicio: dataMenosMeses(hoje, janela),
          dataFim: hoje.toISOString().slice(0, 10),
          maxRegistros: 500,
        })
      : Promise.resolve({ ok: true as const, observacoes: [] as PrecoObservado[], erro: undefined }),
    opcoes.incluirPncp === false ? Promise.resolve({ ok: true as const, observacoes: [] as PrecoObservado[], erro: undefined }) : buscarPrecosPncp(termo, { uf: opcoes.uf ?? "MG" }),
  ]);

  const observacoes = [...federal.observacoes, ...pncp.observacoes];

  if (observacoes.length === 0) {
    const motivo = [federal.erro, pncp.erro].filter(Boolean).join(" ");
    return {
      ok: false,
      itemEscolhido: escolhido,
      alternativas: candidatos.slice(1),
      erro:
        motivo ||
        `"${descricao}" não foi encontrado nas compras públicas. Isso é comum em máquina específica de produção — use a pesquisa de mercado ou peça cotação direta ao fornecedor.`,
    };
  }

  const cesta = montarCesta(escolhido?.nome ?? termo, observacoes, { referenciaTemporal: hoje });
  return { ok: true, itemEscolhido: escolhido, alternativas: candidatos.slice(1), cesta };
}
