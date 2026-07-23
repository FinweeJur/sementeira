import { describe, expect, it } from "vitest";
import { lerVeredito } from "./revisao-agente";
import { validarComando, ACOES_VALIDAS } from "./agente-portfolio";

/**
 * Estes testes guardam decisões de HONESTIDADE, não de formatação: o app não
 * pode afirmar "adequado" nem "nenhum problema" quando na verdade não
 * conseguiu ler a resposta da IA.
 */
describe("lerVeredito", () => {
  it("aceita booleano de verdade", () => {
    expect(lerVeredito(true)).toBe("adequado");
    expect(lerVeredito(false)).toBe("inadequado");
  });

  // O caso que motivou tudo: Boolean("não") === true
  it("não transforma negativa em português em aprovação", () => {
    for (const negativa of ["não", "nao", "false", "inadequado", "NÃO", " False "]) {
      expect(lerVeredito(negativa)).toBe("inadequado");
    }
  });

  it("aceita afirmativa em português", () => {
    for (const positiva of ["sim", "true", "adequado", "SIM"]) {
      expect(lerVeredito(positiva)).toBe("adequado");
    }
  });

  it("não inventa veredito quando o valor é ilegível", () => {
    for (const lixo of [undefined, null, "", "talvez", 1, 0, {}, []]) {
      expect(lerVeredito(lixo)).toBe("indefinido");
    }
  });
});

describe("validarComando", () => {
  it("aceita comando bem formado", () => {
    const c = validarComando({ resposta: "Abrindo o projeto.", acao: "abrir_projeto", parametros: { id: "x" } });
    expect(c?.acao).toBe("abrir_projeto");
    expect(c?.parametros).toEqual({ id: "x" });
  });

  it("aceita conversa sem ação", () => {
    expect(validarComando({ resposta: "Oi!", acao: null })?.acao).toBeNull();
    expect(validarComando({ resposta: "Oi!" })?.acao).toBeNull();
  });

  it("recusa ação inventada — nada é executado", () => {
    expect(validarComando({ resposta: "ok", acao: "apagar_tudo" })).toBeNull();
    expect(validarComando({ resposta: "ok", acao: "excluir_projeto" })).toBeNull();
  });

  it("recusa objeto sem resposta utilizável", () => {
    expect(validarComando({ acao: "abrir_projeto" })).toBeNull();
    expect(validarComando({ resposta: "   ", acao: null })).toBeNull();
    expect(validarComando(null)).toBeNull();
    expect(validarComando("texto solto")).toBeNull();
  });

  it("normaliza parametros ausentes ou inválidos", () => {
    expect(validarComando({ resposta: "ok", acao: null, parametros: "nao é objeto" })?.parametros).toEqual({});
  });

  it("todas as ações declaradas passam na validação", () => {
    for (const acao of ACOES_VALIDAS) {
      expect(validarComando({ resposta: "ok", acao })?.acao).toBe(acao);
    }
  });
});
