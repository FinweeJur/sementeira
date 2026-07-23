import { describe, expect, it } from "vitest";
import { extrairRascunhoHeuristico } from "./extracao-heuristica";

describe("extrairRascunhoHeuristico", () => {
  it("lê o formato inline 'Campo: conteúdo'", () => {
    const { dados } = extrairRascunhoHeuristico(
      [
        "Projeto de Horta Comunitária",
        "Objetivo: produzir alimentos para as famílias atingidas.",
        "Justificativa: a comunidade perdeu sua fonte de renda.",
      ].join("\n"),
    );
    expect(dados.objetivo).toBe("produzir alimentos para as famílias atingidas.");
    expect(dados.justificativa).toBe("a comunidade perdeu sua fonte de renda.");
  });

  it("lê título em linha própria com o conteúdo abaixo", () => {
    const { dados } = extrairRascunhoHeuristico(["OBJETIVO", "Produzir alimentos.", "", "JUSTIFICATIVA", "Perda de renda."].join("\n"));
    expect(dados.objetivo).toBe("Produzir alimentos.");
    expect(dados.justificativa).toBe("Perda de renda.");
  });

  it("aceita título numerado e com acento", () => {
    const { dados } = extrairRascunhoHeuristico(["1.2 - Justificação:", "Texto da justificativa."].join("\n"));
    expect(dados.justificativa).toBe("Texto da justificativa.");
  });

  it("não deixa 'Objetivo' roubar 'Objetivos Específicos'", () => {
    const { dados } = extrairRascunhoHeuristico(
      ["Objetivo Geral", "Meta ampla do projeto.", "Objetivos Específicos", "- primeiro", "- segundo"].join("\n"),
    );
    expect(dados.objetivo).toBe("Meta ampla do projeto.");
    expect(dados.objetivosEspecificos).toEqual(["primeiro", "segundo"]);
  });

  it("quebra listas por marcador", () => {
    const { dados } = extrairRascunhoHeuristico(["Metas", "• implantar 20 canteiros", "• capacitar 30 famílias"].join("\n"));
    expect(dados.metas).toEqual(["implantar 20 canteiros", "capacitar 30 famílias"]);
  });

  it("quebra listas numeradas", () => {
    const { dados } = extrairRascunhoHeuristico(["Metas:", "1) primeira meta", "2) segunda meta"].join("\n"));
    expect(dados.metas).toEqual(["primeira meta", "segunda meta"]);
  });

  it("quebra lista de uma linha só por ponto-e-vírgula", () => {
    const { dados } = extrairRascunhoHeuristico("Metas: implantar canteiros; capacitar famílias.");
    expect(dados.metas).toEqual(["implantar canteiros", "capacitar famílias"]);
  });

  it("mantém meta única como um item só", () => {
    const { dados } = extrairRascunhoHeuristico("Metas: implantar 20 canteiros em 12 meses.");
    expect(dados.metas).toEqual(["implantar 20 canteiros em 12 meses."]);
  });

  it("não confunde parágrafo longo que começa com a palavra-chave", () => {
    const texto = "Objetivo geral deste documento é apresentar um panorama extenso da situação da bacia do Paraopeba depois do rompimento, com dados.";
    const { dados } = extrairRascunhoHeuristico(texto);
    expect(dados.objetivo).toBeUndefined();
  });

  it("preserva chaves e pontuação dentro do conteúdo", () => {
    const { dados } = extrairRascunhoHeuristico("Objetivo: produzir alimentos (hortaliças, legumes) para 30 famílias.");
    expect(dados.objetivo).toBe("produzir alimentos (hortaliças, legumes) para 30 famílias.");
  });

  it("junta várias linhas de um mesmo campo de texto", () => {
    const { dados } = extrairRascunhoHeuristico(["Justificativa", "Primeira linha.", "Segunda linha."].join("\n"));
    expect(dados.justificativa).toBe("Primeira linha.\nSegunda linha.");
  });

  it("relata quais campos preencheu", () => {
    const { camposPreenchidos } = extrairRascunhoHeuristico(["Objetivo: x", "Metas: y"].join("\n"));
    expect(camposPreenchidos.sort()).toEqual(["metas", "objetivo"]);
  });

  it("devolve vazio quando não reconhece nada", () => {
    const { dados, camposPreenchidos } = extrairRascunhoHeuristico("Um texto qualquer sem estrutura de projeto.");
    expect(camposPreenchidos).toEqual([]);
    expect(Object.keys(dados)).toEqual([]);
  });

  it("nunca inventa equipe nem indicadores", () => {
    const { dados } = extrairRascunhoHeuristico(["Equipe", "- coordenador", "Indicadores", "- número de canteiros"].join("\n"));
    expect(dados.equipe).toBeUndefined();
    expect(dados.indicadores).toBeUndefined();
  });
});
