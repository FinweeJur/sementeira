import { describe, it, expect } from "vitest";
import { referenciaDaCesta } from "./cotacao-publica";
import { montarCesta, type PrecoObservado } from "./precos-publicos";
import { resumirReferenciaPreco } from "./export";
import type { ItemCatalogo } from "./catmat";

function preco(valor: number, municipio: string, orgao: string): PrecoObservado {
  return {
    fonte: "compras-gov-homologado",
    precoUnitario: valor,
    descricao: "DESPOLPADEIRA FRUTAS",
    unidade: "UN",
    quantidade: 1,
    data: "2026-06-15",
    orgao,
    esfera: "M",
    uf: "MG",
    municipio,
    fornecedor: `FORN ${orgao}`,
  };
}

const ITEM: ItemCatalogo = { codigoPdm: 4321, nome: "DESPOLPADEIRA FRUTAS", codigoClasse: 3510, nomeClasse: "MÁQUINAS DE ALIMENTOS", ativo: true };
const CONSULTA = new Date("2026-08-10T12:00:00Z");
const TRES = [preco(2500, "Brumadinho", "PREF BRUMADINHO"), preco(2758, "Betim", "PREF BETIM"), preco(3100, "Ibirité", "PREF IBIRITE")];

describe("referenciaDaCesta", () => {
  it("guarda o que responde 'de onde veio esse número'", () => {
    const cesta = montarCesta("despolpadeira", TRES, { referenciaTemporal: CONSULTA });
    const r = referenciaDaCesta(cesta, ITEM, CONSULTA);
    expect(r.origem).toBe("compras-publicas");
    expect(r.criterio).toBe("mediana");
    expect(r.quantidadePrecos).toBe(3);
    expect(r.minimo).toBe(2500);
    expect(r.maximo).toBe(3100);
    expect(r.abrangenciaPreco).toBe("paraopeba");
    expect(r.unidade).toBe("UN");
    expect(r.consultadoEm).toBe("2026-08-10");
    expect(r.itemCatalogo).toBe("DESPOLPADEIRA FRUTAS");
    expect(r.codigoPdm).toBe(4321);
  });

  it("grava compras nominais — é o que se mostra quando alguém questiona", () => {
    const cesta = montarCesta("despolpadeira", TRES, { referenciaTemporal: CONSULTA });
    const r = referenciaDaCesta(cesta, ITEM, CONSULTA);
    expect(r.compras).toHaveLength(3);
    expect(r.compras[0]).toMatchObject({ orgao: "PREF BRUMADINHO", municipio: "Brumadinho", uf: "MG", data: "2026-06-15" });
    expect(r.compras[0].fornecedor).toBe("FORN PREF BRUMADINHO");
  });

  it("limita as compras gravadas — o projeto inteiro vive no armazenamento local", () => {
    const muitas = Array.from({ length: 40 }, (_, i) => preco(1000 + i, "Betim", `ORGAO ${i}`));
    const cesta = montarCesta("x", muitas, { referenciaTemporal: CONSULTA });
    const r = referenciaDaCesta(cesta, ITEM, CONSULTA);
    expect(r.quantidadePrecos).toBeGreaterThan(5);
    expect(r.compras.length).toBeLessThanOrEqual(5);
  });

  it("leva as ressalvas junto — referência sem ressalva esconde o problema", () => {
    const dispersos = [preco(100, "Brumadinho", "A"), preco(500, "Betim", "B"), preco(900, "Ibirité", "C")];
    const cesta = montarCesta("x", dispersos, { referenciaTemporal: CONSULTA });
    const r = referenciaDaCesta(cesta, ITEM, CONSULTA);
    expect(r.alertas.join(" ")).toContain("variam muito");
  });

  it("sobrevive a ida e volta por JSON — é assim que fica guardado", () => {
    const cesta = montarCesta("despolpadeira", TRES, { referenciaTemporal: CONSULTA });
    const r = referenciaDaCesta(cesta, ITEM, CONSULTA);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});

describe("resumirReferenciaPreco", () => {
  it("descreve a procedência em uma frase, com compra nominal", () => {
    const cesta = montarCesta("despolpadeira", TRES, { referenciaTemporal: CONSULTA });
    const texto = resumirReferenciaPreco(referenciaDaCesta(cesta, ITEM, CONSULTA));
    expect(texto).toContain("valor do meio de 3 compra(s) pública(s)");
    expect(texto).toContain("bacia do Paraopeba");
    expect(texto).toContain("PREF BRUMADINHO");
    expect(texto).toContain("consultado em 2026-08-10");
  });

  it("linha sem referência não finge ter uma", () => {
    expect(resumirReferenciaPreco(undefined)).toBe("estimado fora das compras públicas");
  });

  it("a ressalva aparece no documento exportado, não só na tela", () => {
    const dispersos = [preco(100, "Brumadinho", "A"), preco(500, "Betim", "B"), preco(900, "Ibirité", "C")];
    const cesta = montarCesta("x", dispersos, { referenciaTemporal: CONSULTA });
    expect(resumirReferenciaPreco(referenciaDaCesta(cesta, ITEM, CONSULTA))).toContain("ressalva:");
  });
});
