import { describe, expect, it } from "vitest";
import { avaliarConformidade, exigeFonteCusteioFuturo } from "./compliance-engine";
import { novoProjetoVazio, type BudgetLine, type Project } from "./types";

function linha(over: Partial<BudgetLine>): BudgetLine {
  return {
    id: crypto.randomUUID(),
    descricao: "item genérico",
    categoria: "outro",
    valor: 1000,
    ...over,
  } as BudgetLine;
}

function projetoCom(linhas: BudgetLine[]): Project {
  return { ...novoProjetoVazio(), orcamento: linhas };
}

/**
 * O motor pode bloquear por falta de `fonteCusteioFuturo`. O wizard só mostra
 * esse campo quando `exigeFonteCusteioFuturo` diz que sim. Se as duas coisas
 * saírem de sincronia, existe bloqueio SEM campo na tela para resolver — o
 * beco sem saída. Estes testes prendem as duas pontas juntas.
 */
describe("exigeFonteCusteioFuturo acompanha o que o motor bloqueia", () => {
  const casosQueBloqueiam = [
    { nome: "folha permanente", l: linha({ categoria: "folha-permanente", descricao: "coordenador" }) },
    { nome: "conta de energia em categoria 'outro'", l: linha({ categoria: "outro", descricao: "conta de energia da sede" }) },
    { nome: "conta de água", l: linha({ categoria: "infraestrutura", descricao: "Conta de água mensal" }) },
    { nome: "conta de internet", l: linha({ categoria: "outro", descricao: "conta de internet do galpão" }) },
    { nome: "insumo alimentar permanente", l: linha({ categoria: "insumos-iniciais", descricao: "insumo alimentar permanente para as famílias" }) },
  ];

  for (const caso of casosQueBloqueiam) {
    it(`${caso.nome}: bloqueia sem fonte E o campo aparece`, () => {
      const achados = avaliarConformidade(projetoCom([caso.l]));
      const bloqueios = achados.filter((f) => f.severidade === "bloqueio" && f.linhaId === caso.l.id);
      expect(bloqueios.length).toBeGreaterThan(0);
      // A ponta que fechava o beco sem saída:
      expect(exigeFonteCusteioFuturo(caso.l)).toBe(true);
    });

    it(`${caso.nome}: preencher a fonte futura destrava`, () => {
      const comFonte = { ...caso.l, fonteCusteioFuturo: "convênio com a prefeitura" };
      const achados = avaliarConformidade(projetoCom([comFonte]));
      const bloqueios = achados.filter((f) => f.severidade === "bloqueio" && f.linhaId === comFonte.id);
      expect(bloqueios).toHaveLength(0);
    });
  }

  it("linha comum não exige fonte futura", () => {
    expect(exigeFonteCusteioFuturo(linha({ categoria: "equipamento", descricao: "trator" }))).toBe(false);
  });

  it("não confunde 'conta' em outro sentido sem serviço de consumo", () => {
    expect(exigeFonteCusteioFuturo(linha({ categoria: "outro", descricao: "contabilidade do primeiro ano" }))).toBe(false);
  });
});
