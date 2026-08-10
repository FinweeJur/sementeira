import { describe, it, expect } from "vitest";
import { buscarNoCatalogo, catalogoGeradoEm } from "./catmat";

describe("buscarNoCatalogo", () => {
  it("o catálogo embarcado carrega e tem data de geração", async () => {
    expect(await catalogoGeradoEm()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("acha item de produção de alimento pelo nome corrente", async () => {
    const r = await buscarNoCatalogo("despolpadeira");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].nome).toContain("DESPOLPADEIRA");
    expect(r[0].codigoPdm).toBeGreaterThan(0);
  });

  it("palavra inteira ganha de palavra que só contém o termo — 'trator' não pode ser vencido por 'extrator'", async () => {
    const r = await buscarNoCatalogo("trator", { limite: 5 });
    const primeiro = r[0].nome.toUpperCase();
    expect(primeiro).toContain("TRATOR");
    expect(primeiro.includes("EXTRATOR") && !primeiro.includes(" TRATOR")).toBe(false);
  });

  it("ignora acento e caixa", async () => {
    const comAcento = await buscarNoCatalogo("costura", { limite: 3 });
    const semAcento = await buscarNoCatalogo("COSTURA", { limite: 3 });
    expect(semAcento.map((x) => x.codigoPdm)).toEqual(comAcento.map((x) => x.codigoPdm));
  });

  it("exige que todos os termos apareçam — busca de duas palavras não vira busca de uma", async () => {
    const r = await buscarNoCatalogo("maquina costura", { limite: 10 });
    for (const item of r) {
      const n = item.nome.toUpperCase();
      expect(n.includes("COSTURA")).toBe(true);
      expect(/M[AÁ]QUINA/.test(n)).toBe(true);
    }
  });

  it("devolve vazio para consulta sem sentido, em vez de devolver o catálogo todo", async () => {
    expect(await buscarNoCatalogo("zzzzqqqxyw")).toHaveLength(0);
  });

  it("consulta vazia não devolve nada", async () => {
    expect(await buscarNoCatalogo("   ")).toHaveLength(0);
    expect(await buscarNoCatalogo("")).toHaveLength(0);
  });

  it("respeita o limite pedido", async () => {
    expect((await buscarNoCatalogo("material", { limite: 3 })).length).toBeLessThanOrEqual(3);
  });

  it("traz a classe junto — é o que dá contexto para escolher entre itens de nome parecido", async () => {
    const r = await buscarNoCatalogo("forno", { limite: 1 });
    expect(r[0].nomeClasse.length).toBeGreaterThan(0);
  });
});
