import { describe, expect, it } from "vitest";
import { extrairBlocoJson, parseJsonDeResposta } from "./json-parsing";

const ALVO = '{"objetivo":"produzir alimentos","metas":["20 canteiros"]}';

function objetivoDe(resposta: string): string | undefined {
  return parseJsonDeResposta<{ objetivo?: string }>(resposta)?.objetivo;
}

describe("extrairBlocoJson", () => {
  it("lê o bloco cercado por ```json", () => {
    expect(objetivoDe("```json\n" + ALVO + "\n```")).toBe("produzir alimentos");
  });

  it("lê o bloco cercado por ``` sem a tag json", () => {
    expect(objetivoDe("```\n" + ALVO + "\n```")).toBe("produzir alimentos");
  });

  it("lê JSON solto, sem cerca", () => {
    expect(objetivoDe("Claro! Aqui está:\n\n" + ALVO + "\n\nEspero ter ajudado.")).toBe("produzir alimentos");
  });

  // Modelos de raciocínio (R1 e derivados)
  it("ignora chaves que aparecem dentro de <think>", () => {
    const r = "<think>\nO usuário quer {objetivo, metas}. Vou montar.\n</think>\n\n```json\n" + ALVO + "\n```";
    expect(objetivoDe(r)).toBe("produzir alimentos");
  });

  it("ignora <think> mesmo quando a resposta vem sem cerca", () => {
    expect(objetivoDe("<think>\nPreciso de {algo}\n</think>\n" + ALVO)).toBe("produzir alimentos");
  });

  it("aceita <thinking> além de <think>", () => {
    expect(objetivoDe("<thinking>{rascunho}</thinking>\n" + ALVO)).toBe("produzir alimentos");
  });

  // Prosa em volta
  it("não engole prosa com chaves depois do JSON", () => {
    expect(objetivoDe(ALVO + "\n\nObs: o campo {metas} pode ser ajustado.")).toBe("produzir alimentos");
  });

  it("ignora um {} vazio solto na prosa depois da resposta", () => {
    expect(objetivoDe(ALVO + "\n\nSe não houver dados, devolvo {}.")).toBe("produzir alimentos");
  });

  // O caso silenciosamente errado: o modelo ecoa o exemplo do prompt
  it("prefere a resposta final quando o modelo ecoa o exemplo antes", () => {
    const r = 'Formato:\n```json\n{"perguntas":["x"]}\n```\nResposta:\n```json\n' + ALVO + "\n```";
    expect(objetivoDe(r)).toBe("produzir alimentos");
  });

  // Continua reconhecendo a resposta legítima de perguntas
  it("reconhece a resposta de perguntas quando é a única", () => {
    const r = '```json\n{"perguntas":["qual o prazo?"]}\n```';
    expect(parseJsonDeResposta<{ perguntas: string[] }>(r)?.perguntas).toEqual(["qual o prazo?"]);
  });

  it("preserva chaves dentro de strings do próprio JSON", () => {
    const comChaves = '{"objetivo":"usar {chaves} no texto","metas":[]}';
    expect(objetivoDe(comChaves)).toBe("usar {chaves} no texto");
  });

  it("lida com objetos aninhados", () => {
    const aninhado = '{"objetivo":"x","indicadores":[{"nome":"a","meta":{"valor":20}}]}';
    expect(parseJsonDeResposta<{ indicadores: unknown[] }>(aninhado)?.indicadores).toHaveLength(1);
  });

  it("devolve null quando não há JSON nenhum", () => {
    expect(extrairBlocoJson("Desculpe, não consegui analisar o documento.")).toBeNull();
    expect(parseJsonDeResposta("texto sem json")).toBeNull();
  });

  it("devolve null quando o JSON está truncado", () => {
    expect(extrairBlocoJson('```json\n{"objetivo":"corta aqui')).toBeNull();
  });
});
