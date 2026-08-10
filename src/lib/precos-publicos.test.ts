import { describe, it, expect } from "vitest";
import { montarCesta, separarAtipicos, agruparPorUnidade, escolherAbrangencia, ehDoParaopeba, mediana, removerDuplicados, type PrecoObservado } from "./precos-publicos";

function preco(parcial: Partial<PrecoObservado> & { precoUnitario: number }): PrecoObservado {
  return {
    fonte: "compras-gov-homologado",
    descricao: "item de teste",
    unidade: "UN",
    quantidade: 1,
    data: "2026-06-01",
    orgao: "ORGAO A",
    esfera: "F",
    uf: "MG",
    municipio: "Belo Horizonte",
    ...parcial,
  };
}

const REFERENCIA = new Date("2026-08-09T00:00:00Z");

describe("ehDoParaopeba", () => {
  it("reconhece município da bacia em MG", () => {
    expect(ehDoParaopeba({ uf: "MG", municipio: "Brumadinho" })).toBe(true);
    expect(ehDoParaopeba({ uf: "MG", municipio: "BETIM" })).toBe(true);
    expect(ehDoParaopeba({ uf: "MG", municipio: "Mário Campos" })).toBe(true);
  });

  it("não aceita município de mesmo nome fora de MG — a UF é checada antes", () => {
    expect(ehDoParaopeba({ uf: "SP", municipio: "Brumadinho" })).toBe(false);
  });

  it("recusa município de MG fora da bacia", () => {
    expect(ehDoParaopeba({ uf: "MG", municipio: "Uberlândia" })).toBe(false);
  });
});

describe("mediana", () => {
  it("interpola em amostra par", () => {
    expect(mediana([10, 20, 30, 40])).toBe(25);
  });
  it("devolve o do meio em amostra ímpar, sem depender da ordem de entrada", () => {
    expect(mediana([30, 10, 20])).toBe(20);
  });
});

describe("agruparPorUnidade", () => {
  it("fica com a unidade dominante e descarta as outras com motivo", () => {
    const r = agruparPorUnidade([
      preco({ precoUnitario: 10, unidade: "UN" }),
      preco({ precoUnitario: 12, unidade: "UN" }),
      preco({ precoUnitario: 300, unidade: "CX" }),
    ]);
    expect(r.unidade).toBe("UN");
    expect(r.observacoes).toHaveLength(2);
    expect(r.outrasUnidades).toHaveLength(1);
    expect(r.outrasUnidades[0].motivo).toContain("CX");
  });

  it("impede que preço de caixa contamine a mediana de unidade", () => {
    const cesta = montarCesta("arroz", [
      preco({ precoUnitario: 5, unidade: "KG" }),
      preco({ precoUnitario: 6, unidade: "KG" }),
      preco({ precoUnitario: 7, unidade: "KG" }),
      preco({ precoUnitario: 180, unidade: "FD" }),
    ], { referenciaTemporal: REFERENCIA });
    expect(cesta.unidade).toBe("KG");
    expect(cesta.valorSugerido).toBe(6);
    expect(cesta.usadas.every((o) => o.unidade === "KG")).toBe(true);
  });
});

describe("separarAtipicos", () => {
  it("não filtra com amostra pequena — a cerca seria instável", () => {
    // 4 valores escolhidos de propósito: por Tukey, 500 CAI fora da cerca (teto ≈ 318,9).
    // Se o limiar de amostra mínima baixar, este teste quebra — é ele que prende a regra.
    const obs = [10, 11, 12, 500].map((v) => preco({ precoUnitario: v }));
    const r = separarAtipicos(obs);
    expect(r.descartadas).toHaveLength(0);
    expect(r.mantidas).toHaveLength(4);
  });

  it("corta o preço absurdo quando há amostra suficiente", () => {
    const obs = [10, 11, 12, 13, 14, 5000].map((v) => preco({ precoUnitario: v }));
    const r = separarAtipicos(obs);
    expect(r.descartadas).toHaveLength(1);
    expect(r.descartadas[0].observacao.precoUnitario).toBe(5000);
    expect(r.descartadas[0].motivo).toContain("acima");
  });

  it("corta também o inexequível, pelo lado de baixo", () => {
    const obs = [0.01, 100, 105, 110, 115, 120].map((v) => preco({ precoUnitario: v }));
    const r = separarAtipicos(obs);
    expect(r.descartadas.map((d) => d.observacao.precoUnitario)).toContain(0.01);
  });
});

describe("escolherAbrangencia", () => {
  it("prefere a bacia quando ela sozinha já é defensável", () => {
    const obs = [
      preco({ precoUnitario: 10, municipio: "Brumadinho" }),
      preco({ precoUnitario: 11, municipio: "Betim" }),
      preco({ precoUnitario: 12, municipio: "Ibirité" }),
      preco({ precoUnitario: 99, municipio: "Manaus", uf: "AM" }),
    ];
    const r = escolherAbrangencia(obs);
    expect(r.abrangencia).toBe("paraopeba");
    expect(r.selecionadas).toHaveLength(3);
  });

  it("desce para MG quando a bacia tem menos que o mínimo", () => {
    const obs = [
      preco({ precoUnitario: 10, municipio: "Brumadinho" }),
      preco({ precoUnitario: 11, municipio: "Uberlândia" }),
      preco({ precoUnitario: 12, municipio: "Juiz de Fora" }),
    ];
    expect(escolherAbrangencia(obs).abrangencia).toBe("mg");
  });

  it("cai para o Brasil só quando MG também não alcança", () => {
    const obs = [
      preco({ precoUnitario: 10, uf: "SP", municipio: "Santos" }),
      preco({ precoUnitario: 11, uf: "BA", municipio: "Salvador" }),
      preco({ precoUnitario: 12, uf: "RS", municipio: "Pelotas" }),
    ];
    expect(escolherAbrangencia(obs).abrangencia).toBe("brasil");
  });
});

describe("removerDuplicados", () => {
  it("a mesma compra contada duas vezes não vira dois preços", () => {
    const repetido = preco({ precoUnitario: 9348, municipio: "Brumadinho", orgao: "CODEVASF" });
    const r = removerDuplicados([repetido, { ...repetido }, preco({ precoUnitario: 2500, municipio: "Betim", orgao: "PREF BETIM" })]);
    expect(r.mantidas).toHaveLength(2);
    expect(r.descartadas[0].motivo).toContain("repetido");
  });

  it("preço igual de órgãos diferentes é confirmação legítima, não duplicata", () => {
    const r = removerDuplicados([
      preco({ precoUnitario: 100, orgao: "PREF A" }),
      preco({ precoUnitario: 100, orgao: "PREF B" }),
    ]);
    expect(r.mantidas).toHaveLength(2);
  });

  it("duplicata não desloca a mediana", () => {
    const caro = { precoUnitario: 9000, municipio: "Brumadinho", orgao: "CARO" } as const;
    const brutas = [
      preco({ ...caro }),
      preco({ ...caro }),
      preco({ ...caro }),
      preco({ precoUnitario: 100, municipio: "Betim", orgao: "A" }),
      preco({ precoUnitario: 200, municipio: "Ibirité", orgao: "B" }),
    ];
    const cesta = montarCesta("x", brutas, { referenciaTemporal: REFERENCIA });
    // Com as 3 cópias contando, a mediana seria 9000. Com a desduplicação, é 200.
    expect(cesta.estatistica.n).toBe(3);
    expect(cesta.valorSugerido).toBe(200);
  });
});

describe("preferirHomologados", () => {
  it("estimado de edital sai quando há homologado — é teto do órgão, não preço pago", () => {
    const brutas = [
      preco({ precoUnitario: 7958, municipio: "Brumadinho", fonte: "pncp-estimado", orgao: "A" }),
      preco({ precoUnitario: 2530, municipio: "Betim", fonte: "pncp-homologado", orgao: "B" }),
      preco({ precoUnitario: 2600, municipio: "Ibirité", fonte: "compras-gov-homologado", orgao: "C" }),
      preco({ precoUnitario: 2700, municipio: "Sarzedo", fonte: "pncp-homologado", orgao: "D" }),
    ];
    const cesta = montarCesta("despolpadeira", brutas, { referenciaTemporal: REFERENCIA });
    expect(cesta.usadas.every((o) => o.fonte !== "pncp-estimado")).toBe(true);
    expect(cesta.valorSugerido).toBe(2600);
    expect(cesta.descartadas.some((d) => d.motivo.includes("estimado"))).toBe(true);
  });

  it("sem nenhum homologado o estimado serve, mas a cesta avisa que é teto", () => {
    const brutas = ["Brumadinho", "Betim", "Ibirité"].map((m, i) =>
      preco({ precoUnitario: 1000 + i * 100, municipio: m, fonte: "pncp-estimado", orgao: `O${i}` }),
    );
    const cesta = montarCesta("x", brutas, { referenciaTemporal: REFERENCIA });
    expect(cesta.estatistica.n).toBe(3);
    expect(cesta.alertas.join(" ")).toContain("estimados em edital");
  });
});

describe("montarCesta", () => {
  it("usa a mediana por padrão e registra a abrangência", () => {
    const cesta = montarCesta("cadeira", [
      preco({ precoUnitario: 300, municipio: "Brumadinho" }),
      preco({ precoUnitario: 400, municipio: "Betim" }),
      preco({ precoUnitario: 500, municipio: "Ibirité" }),
    ], { referenciaTemporal: REFERENCIA });
    expect(cesta.valorSugerido).toBe(400);
    expect(cesta.criterio).toBe("mediana");
    expect(cesta.abrangencia).toBe("paraopeba");
    expect(cesta.suficiente).toBe(true);
  });

  it("honra os outros critérios permitidos", () => {
    const brutas = [
      preco({ precoUnitario: 300, municipio: "Brumadinho" }),
      preco({ precoUnitario: 400, municipio: "Betim" }),
      preco({ precoUnitario: 800, municipio: "Ibirité" }),
    ];
    expect(montarCesta("x", brutas, { criterio: "menor-preco", referenciaTemporal: REFERENCIA }).valorSugerido).toBe(300);
    expect(montarCesta("x", brutas, { criterio: "media", referenciaTemporal: REFERENCIA }).valorSugerido).toBe(500);
  });

  it("marca cesta insuficiente com menos de 3 preços", () => {
    const cesta = montarCesta("bomba", [preco({ precoUnitario: 100 }), preco({ precoUnitario: 120 })], { referenciaTemporal: REFERENCIA });
    expect(cesta.suficiente).toBe(false);
    expect(cesta.alertas.join(" ")).toContain("mínimo recomendado");
  });

  it("avisa quando não achou nada, em vez de devolver zero em silêncio", () => {
    const cesta = montarCesta("item inexistente", [], { referenciaTemporal: REFERENCIA });
    expect(cesta.estatistica.n).toBe(0);
    expect(cesta.valorSugerido).toBe(0);
    expect(cesta.alertas.join(" ")).toContain("Nenhum preço público");
  });

  it("avisa sobre dispersão alta — sinal de que não é o mesmo produto", () => {
    const cesta = montarCesta("forno", [
      preco({ precoUnitario: 100, municipio: "Brumadinho" }),
      preco({ precoUnitario: 500, municipio: "Betim" }),
      preco({ precoUnitario: 900, municipio: "Ibirité" }),
    ], { referenciaTemporal: REFERENCIA });
    expect(cesta.alertas.join(" ")).toContain("variam muito");
  });

  it("avisa quando a cesta inteira veio de um órgão só", () => {
    const cesta = montarCesta("mesa", [
      preco({ precoUnitario: 100, municipio: "Brumadinho", orgao: "PREFEITURA X" }),
      preco({ precoUnitario: 105, municipio: "Betim", orgao: "PREFEITURA X" }),
      preco({ precoUnitario: 110, municipio: "Ibirité", orgao: "PREFEITURA X" }),
    ], { referenciaTemporal: REFERENCIA });
    expect(cesta.alertas.join(" ")).toContain("mesmo órgão");
  });

  it("avisa quando todo preço está velho", () => {
    const cesta = montarCesta("trator", [
      preco({ precoUnitario: 100, municipio: "Brumadinho", data: "2024-01-10" }),
      preco({ precoUnitario: 105, municipio: "Betim", data: "2024-02-10" }),
      preco({ precoUnitario: 110, municipio: "Ibirité", data: "2024-03-10" }),
    ], { referenciaTemporal: REFERENCIA });
    expect(cesta.alertas.join(" ")).toContain("mais de 12 meses");
  });

  it("avisa que o frete pode não estar refletido quando precisou usar o Brasil todo", () => {
    const cesta = montarCesta("motor", [
      preco({ precoUnitario: 100, uf: "SP", municipio: "Santos" }),
      preco({ precoUnitario: 105, uf: "BA", municipio: "Salvador" }),
      preco({ precoUnitario: 110, uf: "RS", municipio: "Pelotas" }),
    ], { referenciaTemporal: REFERENCIA });
    expect(cesta.abrangencia).toBe("brasil");
    expect(cesta.alertas.join(" ")).toContain("frete");
  });

  it("descarta preço zerado com motivo, sem deixar virar mediana", () => {
    const cesta = montarCesta("kit", [
      preco({ precoUnitario: 0, municipio: "Brumadinho" }),
      preco({ precoUnitario: 100, municipio: "Betim" }),
      preco({ precoUnitario: 200, municipio: "Ibirité" }),
      preco({ precoUnitario: 300, municipio: "Sarzedo" }),
    ], { referenciaTemporal: REFERENCIA });
    expect(cesta.valorSugerido).toBe(200);
    expect(cesta.descartadas.some((d) => d.motivo.includes("zerado"))).toBe(true);
  });

  it("todo preço que entrou ou saiu fica rastreado — nada some da prestação de contas", () => {
    const brutas = [
      preco({ precoUnitario: 0, municipio: "Brumadinho" }),
      preco({ precoUnitario: 10, unidade: "CX", municipio: "Betim" }),
      preco({ precoUnitario: 90, uf: "SP", municipio: "Santos" }),
      ...[100, 105, 110, 115, 120, 9999].map((v) => preco({ precoUnitario: v, municipio: "Ibirité" })),
    ];
    const cesta = montarCesta("rastreio", brutas, { referenciaTemporal: REFERENCIA });
    expect(cesta.usadas.length + cesta.descartadas.length + cesta.foraDoRecorte.length).toBe(brutas.length);
  });

  it("estreitar para a região não conta como descarte por qualidade", () => {
    const daBacia = ["Brumadinho", "Betim", "Ibirité"].map((m, i) => preco({ precoUnitario: 100 + i, municipio: m }));
    const deFora = Array.from({ length: 20 }, (_, i) => preco({ precoUnitario: 200 + i, uf: "SP", municipio: "Santos" }));
    const cesta = montarCesta("costura", [...daBacia, ...deFora], { referenciaTemporal: REFERENCIA });
    expect(cesta.abrangencia).toBe("paraopeba");
    expect(cesta.usadas).toHaveLength(3);
    expect(cesta.foraDoRecorte).toHaveLength(20);
    // O ponto do teste: nenhum desses 20 pode aparecer como problema de qualidade.
    expect(cesta.descartadas).toHaveLength(0);
  });
});
