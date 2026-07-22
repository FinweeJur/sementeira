import { describe, it, expect, beforeEach } from "vitest";
import { contemPalavra, montarBlocoBiblioteca, salvarBiblioteca } from "./biblioteca";
import type { Project, RecursoBiblioteca } from "./types";
import { novoProjetoVazio } from "./types";

describe("contemPalavra", () => {
  it("acha a palavra inteira, sem depender de maiúsculas", () => {
    expect(contemPalavra("Insegurança alimentar e nutricional", "alimentar")).toBe(true);
  });

  it("não confunde substring solta (ex.: 'pão' dentro de 'galpão')", () => {
    expect(contemPalavra("Galpão de Reciclagem", "pão")).toBe(false);
  });

  it("retorna false pra palavra vazia", () => {
    expect(contemPalavra("qualquer texto", "")).toBe(false);
  });
});

describe("montarBlocoBiblioteca", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retorna string vazia quando a Biblioteca está vazia", () => {
    salvarBiblioteca([]);
    expect(montarBlocoBiblioteca()).toBe("");
  });

  it("sempre lista os títulos, mesmo sem projeto", () => {
    const itens: RecursoBiblioteca[] = [{ id: "1", categoria: "referencia", titulo: "Ofício 46/2026", fixo: true }];
    salvarBiblioteca(itens);
    const bloco = montarBlocoBiblioteca();
    expect(bloco).toContain("Ofício 46/2026");
  });

  it("inclui um trecho do item cujo título bate com uma palavra-chave do dano do projeto", () => {
    // "horta" é uma das palavrasChave de danos.json para "seguranca-alimentar".
    const itens: RecursoBiblioteca[] = [
      {
        id: "1",
        categoria: "leitura",
        titulo: "Guia prático de horta comunitária",
        textoExtraido: "Conteúdo detalhado sobre como montar e manter uma horta comunitária.",
      },
      { id: "2", categoria: "leitura", titulo: "Artigo sobre outro assunto qualquer, sem relação", textoExtraido: "Texto totalmente não relacionado." },
    ];
    salvarBiblioteca(itens);

    const project: Project = { ...novoProjetoVazio(), danoId: "seguranca-alimentar" };
    const bloco = montarBlocoBiblioteca(project);

    expect(bloco).toContain("Conteúdo detalhado sobre como montar e manter uma horta");
    expect(bloco).not.toContain("Texto totalmente não relacionado");
  });
});
