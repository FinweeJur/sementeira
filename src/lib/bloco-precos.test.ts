import { describe, it, expect } from "vitest";
import { montarBlocoPrecos } from "./bloco-precos";
import { preservarReferenciasPreco } from "./cotacao-publica";
import { referenciaDeMercado } from "./maquinas";
import type { BudgetLine, Project, ReferenciaPreco } from "./types";

function referencia(parcial: Partial<ReferenciaPreco> = {}): ReferenciaPreco {
  return {
    origem: "compras-publicas",
    itemCatalogo: "DESPOLPADEIRA FRUTAS",
    codigoPdm: 4321,
    criterio: "mediana",
    unidade: "UN",
    quantidadePrecos: 12,
    minimo: 2500,
    maximo: 3100,
    abrangenciaPreco: "paraopeba",
    consultadoEm: "2026-08-10",
    compras: [{ valor: 2758, orgao: "PREF BETIM", municipio: "Betim", uf: "MG", data: "2026-06-15" }],
    alertas: [],
    ...parcial,
  };
}

function linha(parcial: Partial<BudgetLine> & { id: string; valor: number }): BudgetLine {
  return { categoria: "equipamento", descricao: "Despolpadeira", ...parcial };
}

function projeto(orcamento: BudgetLine[]): Project {
  return { orcamento } as unknown as Project;
}

describe("montarBlocoPrecos", () => {
  it("proíbe a IA de dar preço de cabeça — é a razão do bloco existir", () => {
    const bloco = montarBlocoPrecos(projeto([]));
    expect(bloco).toContain("nunca invente um valor em reais");
    expect(bloco).toContain("compras públicas");
  });

  it("diz o que a IA PODE fazer, para não virar um bloco só de proibição", () => {
    const bloco = montarBlocoPrecos(projeto([]));
    expect(bloco).toContain("Você PODE");
    expect(bloco).toContain("ressalva");
  });

  it("descreve a procedência de cada linha que tem referência", () => {
    const bloco = montarBlocoPrecos(projeto([linha({ id: "a", valor: 2758, referenciaPreco: referencia() })]));
    expect(bloco).toContain("12 compra(s) pública(s)");
    expect(bloco).toContain("municípios da bacia do Paraopeba");
    expect(bloco).toContain("2026-08-10");
  });

  it("marca linha sem referência, para a IA poder sugerir cotar", () => {
    const bloco = montarBlocoPrecos(projeto([linha({ id: "a", valor: 500, descricao: "Mesa" })]));
    expect(bloco).toContain("SEM referência de compras públicas");
    expect(bloco).toContain("1 de 1 linha(s) ainda não têm referência");
  });

  it("não cobra cotação quando todas as linhas já têm referência", () => {
    const bloco = montarBlocoPrecos(projeto([linha({ id: "a", valor: 2758, referenciaPreco: referencia() })]));
    expect(bloco).toContain("Todas as linhas têm referência");
  });

  it("leva as ressalvas para o prompt — senão a IA comenta um número problemático como se fosse firme", () => {
    const comAlerta = referencia({ alertas: ["Os preços variam muito entre si (90%)."] });
    const bloco = montarBlocoPrecos(projeto([linha({ id: "a", valor: 2758, referenciaPreco: comAlerta })]));
    expect(bloco).toContain("variam muito entre si");
    expect(bloco).toContain("ressalva registrada");
  });

  it("preço de anúncio não é descrito como compra pública — senão a IA defende como apurado um número de vitrine", () => {
    const mercado = referenciaDeMercado({ origem: "brasil", titulo: "Despolpadeira 100 kg/h", url: "https://exemplo/anuncio", valor: 4200, consultadoEm: new Date("2026-08-11T12:00:00Z") });
    const bloco = montarBlocoPrecos(projeto([linha({ id: "a", valor: 4200, referenciaPreco: mercado })]));
    expect(bloco).toContain("pesquisa de mercado");
    expect(bloco).toContain("NÃO é compra pública");
    expect(bloco).not.toContain("compra(s) pública(s) de");
  });

  it("linha com preço de anúncio continua contando como pendente de cotação pública", () => {
    const mercado = referenciaDeMercado({ origem: "brasil", titulo: "Despolpadeira", url: "https://exemplo/anuncio", valor: 4200, consultadoEm: new Date("2026-08-11T12:00:00Z") });
    const bloco = montarBlocoPrecos(projeto([linha({ id: "a", valor: 4200, referenciaPreco: mercado })]));
    expect(bloco).not.toContain("Todas as linhas têm referência");
    expect(bloco).toContain("1 de 1 linha(s) ainda não têm referência");
  });

  it("orçamento vazio não inventa situação", () => {
    expect(montarBlocoPrecos(projeto([]))).toContain("ainda está vazio");
  });
});

describe("preservarReferenciasPreco", () => {
  it("a lapidação não pode apagar a procedência — a IA não devolve o campo", () => {
    const antes = [linha({ id: "a", valor: 2758, referenciaPreco: referencia() })];
    const daIa = [linha({ id: "a", valor: 2758, descricao: "Despolpadeira de frutas (melhorada)" })];
    const saida = preservarReferenciasPreco(antes, daIa);
    expect(saida[0].referenciaPreco).toBeDefined();
    expect(saida[0].descricao).toContain("melhorada");
  });

  it("valor alterado PERDE a referência — procedência falsa é pior que nenhuma", () => {
    const antes = [linha({ id: "a", valor: 2758, referenciaPreco: referencia() })];
    const daIa = [linha({ id: "a", valor: 4000 })];
    expect(preservarReferenciasPreco(antes, daIa)[0].referenciaPreco).toBeUndefined();
  });

  it("centavos iguais depois de ida e volta por JSON contam como mesmo valor", () => {
    const antes = [linha({ id: "a", valor: 2758.5, referenciaPreco: referencia() })];
    const daIa = [linha({ id: "a", valor: 2758.5000000001 })];
    expect(preservarReferenciasPreco(antes, daIa)[0].referenciaPreco).toBeDefined();
  });

  it("linha nova não ganha referência de ninguém", () => {
    const antes = [linha({ id: "a", valor: 2758, referenciaPreco: referencia() })];
    const daIa = [linha({ id: "a", valor: 2758 }), linha({ id: "nova", valor: 0 })];
    const saida = preservarReferenciasPreco(antes, daIa);
    expect(saida[0].referenciaPreco).toBeDefined();
    expect(saida[1].referenciaPreco).toBeUndefined();
  });

  it("linha removida não ressuscita", () => {
    const antes = [linha({ id: "a", valor: 2758, referenciaPreco: referencia() }), linha({ id: "b", valor: 100 })];
    expect(preservarReferenciasPreco(antes, [linha({ id: "b", valor: 100 })])).toHaveLength(1);
  });
});
