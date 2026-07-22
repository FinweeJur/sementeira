import { describe, it, expect } from "vitest";
import { fatorCoordenacao, eficienciaEfetiva } from "./capacidade-equipe";

describe("fatorCoordenacao", () => {
  it("é 1 pra uma única pessoa (sem overhead de coordenação)", () => {
    expect(fatorCoordenacao(1)).toBe(1);
  });

  it("cai conforme o time cresce", () => {
    const fator3 = fatorCoordenacao(3);
    const fator6 = fatorCoordenacao(6);
    expect(fator3).toBeLessThan(1);
    expect(fator6).toBeLessThan(fator3);
  });
});

describe("eficienciaEfetiva", () => {
  it("pra 1 pessoa é igual à eficiência base (70%)", () => {
    expect(eficienciaEfetiva(1)).toBeCloseTo(0.7, 5);
  });

  it("pra 3 pessoas é 60% (0.7 * 1/(1+0.08*2))", () => {
    expect(eficienciaEfetiva(3)).toBeCloseTo(0.603448, 5);
  });

  it("nunca aumenta com mais gente", () => {
    for (let n = 1; n < 10; n++) {
      expect(eficienciaEfetiva(n + 1)).toBeLessThanOrEqual(eficienciaEfetiva(n));
    }
  });
});
