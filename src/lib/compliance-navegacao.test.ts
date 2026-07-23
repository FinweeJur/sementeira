import { describe, expect, it } from "vitest";
import { avaliarConformidade } from "./compliance-engine";
import { novoProjetoVazio, type BudgetLine, type PassoWizard, type Project } from "./types";

/**
 * Todo achado precisa saber para onde mandar a pessoa. Sem isso o selo de
 * bloqueio informa que existe um problema mas não leva a lugar nenhum — e
 * uma regra nova entraria calada nesse estado.
 *
 * A lista abaixo espelha os `info.id` das seções do ProjectWizard.
 */
const PASSOS_DO_WIZARD: PassoWizard[] = [
  "ideia",
  "dano-arquetipo",
  "identificacao",
  "objetivo",
  "publico",
  "orcamento",
  "equipe",
  "espaco-logistica",
  "arrecadacao",
  "simulador",
  "riscos",
  "contato",
  "revisao",
];

function linha(over: Partial<BudgetLine>): BudgetLine {
  return { id: crypto.randomUUID(), descricao: "item", categoria: "outro", valor: 1000, ...over } as BudgetLine;
}

/** Projetos escolhidos para acionar o máximo de regras diferentes. */
const CENARIOS: { nome: string; projeto: Project }[] = [
  { nome: "projeto vazio", projeto: novoProjetoVazio() },
  {
    nome: "folha permanente sem fonte futura",
    projeto: { ...novoProjetoVazio(), orcamento: [linha({ categoria: "folha-permanente", descricao: "coordenador" })] },
  },
  {
    nome: "conta de consumo em categoria solta",
    projeto: { ...novoProjetoVazio(), orcamento: [linha({ categoria: "outro", descricao: "conta de energia da sede" })] },
  },
  {
    nome: "prazo acima de 6 meses sem justificativa",
    projeto: { ...novoProjetoVazio(), orcamento: [linha({ categoria: "capital-giro-inicial", prazoMeses: 12 })] },
  },
  {
    nome: "custo não coberto sem fonte futura",
    projeto: {
      ...novoProjetoVazio(),
      custosNaoCobertos: [{ id: "energia", nome: "Energia elétrica", valorMensalEstimado: 500 }],
    },
  },
  {
    nome: "equipe com uma pessoa só",
    projeto: { ...novoProjetoVazio(), equipe: [{ nome: "Coordenador" }] as Project["equipe"] },
  },
];

describe("todo achado sabe para onde levar a pessoa", () => {
  for (const { nome, projeto } of CENARIOS) {
    it(`${nome}: nenhum achado fica sem passoId`, () => {
      const achados = avaliarConformidade(projeto).filter((f) => f.severidade !== "ok");
      // O cenário só prova algo se de fato acionou alguma regra.
      expect(achados.length).toBeGreaterThan(0);
      const semDestino = achados.filter((f) => !f.passoId).map((f) => f.regra);
      expect(semDestino).toEqual([]);
    });

    it(`${nome}: todo passoId aponta para um passo que existe`, () => {
      for (const f of avaliarConformidade(projeto)) {
        if (!f.passoId) continue;
        expect(PASSOS_DO_WIZARD).toContain(f.passoId);
      }
    });
  }

  it("o bloqueio do projeto vazio leva ao passo do dano", () => {
    const bloqueio = avaliarConformidade(novoProjetoVazio()).find((f) => f.severidade === "bloqueio");
    expect(bloqueio?.passoId).toBe("dano-arquetipo");
  });

  it("bloqueio de linha de orçamento leva ao orçamento", () => {
    const p: Project = { ...novoProjetoVazio(), orcamento: [linha({ categoria: "folha-permanente" })] };
    const daLinha = avaliarConformidade(p).filter((f) => f.linhaId);
    expect(daLinha.length).toBeGreaterThan(0);
    for (const f of daLinha) expect(f.passoId).toBe("orcamento");
  });
});
