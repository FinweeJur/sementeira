import { describe, it, expect } from "vitest";
import { montarConsultasMaquina, estimarCustoImportacao, alertasDeAquisicao, pesquisarMaquinas, referenciaDeMercado } from "./maquinas";
import { resumirReferenciaPreco } from "./export";

describe("montarConsultasMaquina", () => {
  it("consulta as três origens por padrão", () => {
    const c = montarConsultasMaquina({ necessidade: "despolpar fruta" });
    expect(c.map((x) => x.origem)).toEqual(["brasil", "china", "aberta"]);
  });

  it("manda a busca chinesa em inglês — o catálogo de lá não é indexado em português", () => {
    const china = montarConsultasMaquina({ necessidade: "despolpar fruta", origens: ["china"] })[0];
    expect(china.query).toContain("machine price FOB");
    expect(china.query).toContain("site:alibaba.com");
    expect(china.query).not.toContain("máquina");
  });

  it("restringe a busca brasileira a vitrines de fornecedor", () => {
    const br = montarConsultasMaquina({ necessidade: "costurar uniforme", origens: ["brasil"] })[0];
    expect(br.query).toContain("site:mercadolivre.com.br");
    expect(br.query).toContain("máquina costurar uniforme");
  });

  it("inclui a capacidade quando o projeto já sabe", () => {
    const c = montarConsultasMaquina({ necessidade: "despolpar fruta", capacidade: "100 kg/h", origens: ["brasil"] })[0];
    expect(c.query).toContain("100 kg/h");
  });
});

describe("estimarCustoImportacao", () => {
  it("o efeito real passa de 60% porque cada tributo entra na base do seguinte", () => {
    const custo = estimarCustoImportacao(1000, 5);
    // Soma ingênua das alíquotas daria ~43%; o multiplicador sobre o FOB tem de ser bem maior.
    expect(custo.multiplicador).toBeGreaterThan(1.6);
    expect(custo.fobBrl).toBe(5000);
  });

  it("calcula o ICMS por dentro — a base inclui o próprio imposto", () => {
    const custo = estimarCustoImportacao(1000, 5, { ii: 0, ipi: 0, pis: 0, cofins: 0, freteSeguro: 0, despesasOperacionais: 0, icms: 0.18 });
    // Base 5000 sem ICMS: por dentro vira 5000/0,82 = 6097,56, com ICMS de 1097,56.
    expect(custo.icms).toBeCloseTo(1097.56, 1);
    expect(custo.total).toBeCloseTo(6097.56, 1);
  });

  it("zera tributo quando a alíquota é zero, sem virar NaN", () => {
    const custo = estimarCustoImportacao(1000, 5, { ii: 0, ipi: 0, pis: 0, cofins: 0, icms: 0, freteSeguro: 0, despesasOperacionais: 0 });
    expect(custo.total).toBe(5000);
    expect(custo.multiplicador).toBe(1);
  });

  it("não divide por zero quando o preço é zero", () => {
    const custo = estimarCustoImportacao(0, 5);
    expect(Number.isFinite(custo.multiplicador)).toBe(true);
    expect(custo.multiplicador).toBe(0);
  });

  it("o frete internacional entra na base tributável, não só no total", () => {
    const semFrete = estimarCustoImportacao(1000, 5, { freteSeguro: 0 });
    const comFrete = estimarCustoImportacao(1000, 5, { freteSeguro: 0.25 });
    expect(comFrete.ii).toBeGreaterThan(semFrete.ii);
  });
});

describe("alertasDeAquisicao", () => {
  it("sempre lembra da NR-12, em qualquer origem", () => {
    for (const origem of ["brasil", "china", "aberta"] as const) {
      expect(alertasDeAquisicao(origem).join(" ")).toContain("NR-12");
    }
  });

  it("avisa que o preço chinês é FOB e que falta habilitação para importar", () => {
    const alertas = alertasDeAquisicao("china").join(" ");
    expect(alertas).toContain("FOB");
    expect(alertas).toContain("Radar/Siscomex");
  });
});

describe("referenciaDeMercado", () => {
  const CONSULTA = new Date("2026-08-11T12:00:00Z");
  const ANUNCIO = { titulo: "Despolpadeira 100 kg/h", url: "https://exemplo.com.br/anuncio", consultadoEm: CONSULTA };

  it("marca a origem como pesquisa de mercado — anúncio não é compra pública", () => {
    const r = referenciaDeMercado({ ...ANUNCIO, origem: "brasil", valor: 4200 });
    expect(r.origem).toBe("pesquisa-mercado");
    expect(r.quantidadePrecos).toBe(1);
    expect(r.minimo).toBe(4200);
    expect(r.maximo).toBe(4200);
    expect(r.alertas.join(" ")).toContain("não compra pública homologada");
  });

  it("guarda o anúncio de onde saiu o valor, para conferir depois", () => {
    const r = referenciaDeMercado({ ...ANUNCIO, origem: "brasil", valor: 4200 });
    expect(r.fonte).toBe("Despolpadeira 100 kg/h");
    expect(r.url).toBe("https://exemplo.com.br/anuncio");
    expect(r.consultadoEm).toBe("2026-08-11");
  });

  it("distingue preço FOB de custo posto no Brasil — são números diferentes na mesma tela", () => {
    const fob = referenciaDeMercado({ ...ANUNCIO, origem: "china", valor: 6000 });
    const posto = referenciaDeMercado({ ...ANUNCIO, origem: "china", valor: 10500, postoNoBrasil: true });
    expect(fob.criterio).toBe("preco-anunciado");
    expect(fob.alertas.join(" ")).toContain("FOB");
    expect(posto.criterio).toBe("custo-posto-no-brasil");
    expect(posto.alertas.join(" ")).toContain("Radar/Siscomex");
  });

  it("no documento exportado a linha não se apresenta como compra pública", () => {
    const texto = resumirReferenciaPreco(referenciaDeMercado({ ...ANUNCIO, origem: "china", valor: 10500, postoNoBrasil: true }));
    expect(texto).toContain("pesquisa de mercado");
    expect(texto).toContain("custo estimado posto no Brasil");
    expect(texto).not.toContain("compra(s) pública(s)");
  });

  it("sobrevive a ida e volta por JSON — é assim que fica guardado", () => {
    const r = referenciaDeMercado({ ...ANUNCIO, origem: "aberta", valor: 999 });
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});

describe("pesquisarMaquinas", () => {
  it("junta os resultados por origem e não repete alerta comum entre origens", async () => {
    const buscar = async (query: string) => ({ ok: true, resultados: [{ titulo: `r:${query.slice(0, 12)}`, url: "https://exemplo", conteudo: "" }] });
    const r = await pesquisarMaquinas({ necessidade: "moer milho" }, buscar);
    expect(r.porOrigem).toHaveLength(3);
    expect(r.porOrigem.every((o) => o.resultados.length === 1)).toBe(true);
    const nr12 = r.alertas.filter((a) => a.includes("NR-12"));
    expect(nr12).toHaveLength(1);
  });

  it("uma origem que falha não derruba as outras", async () => {
    const buscar = async (query: string) => (query.includes("alibaba") ? { ok: false, erro: "sem chave" } : { ok: true, resultados: [{ titulo: "ok", url: "https://exemplo", conteudo: "" }] });
    const r = await pesquisarMaquinas({ necessidade: "moer milho" }, buscar);
    const china = r.porOrigem.find((o) => o.origem === "china");
    expect(china?.erro).toBe("sem chave");
    expect(r.porOrigem.find((o) => o.origem === "brasil")?.resultados).toHaveLength(1);
  });
});
