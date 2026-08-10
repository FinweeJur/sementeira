import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CestaPrecosPanel } from "./CestaPrecosPanel";
import { montarCesta, type PrecoObservado } from "../lib/precos-publicos";
import type { ResultadoCotacaoPublica } from "../lib/cotacao-publica";

function preco(valor: number, municipio: string, orgao: string): PrecoObservado {
  return {
    fonte: "compras-gov-homologado",
    precoUnitario: valor,
    descricao: "MÁQUINA COSTURA INDUSTRIAL",
    unidade: "UN",
    quantidade: 1,
    data: "2026-05-20",
    orgao,
    esfera: "M",
    uf: "MG",
    municipio,
    fornecedor: `FORNECEDOR ${orgao}`,
  };
}

function resultado(observacoes: PrecoObservado[]): ResultadoCotacaoPublica {
  return {
    ok: true,
    itemEscolhido: { codigoPdm: 1363, nome: "MÁQUINA COSTURA INDUSTRIAL", codigoClasse: 3530, nomeClasse: "MÁQUINAS DE COSTURA", ativo: true },
    alternativas: [],
    cesta: montarCesta("MÁQUINA COSTURA INDUSTRIAL", observacoes, { referenciaTemporal: new Date("2026-08-09") }),
  };
}

const TRES_PRECOS = [preco(1500, "Brumadinho", "PREF BRUMADINHO"), preco(1975, "Betim", "PREF BETIM"), preco(3016.18, "Ibirité", "PREF IBIRITE")];

describe("CestaPrecosPanel", () => {
  it("mostra o valor sugerido e de onde ele veio", () => {
    render(<CestaPrecosPanel resultado={resultado(TRES_PRECOS)} />);
    expect(screen.getByText(/1\.975,00/)).toBeTruthy();
    expect(screen.getByText(/municípios da bacia do Paraopeba/)).toBeTruthy();
  });

  it("as compras ficam escondidas até serem pedidas, e aí aparecem com órgão e fornecedor", () => {
    render(<CestaPrecosPanel resultado={resultado(TRES_PRECOS)} />);
    expect(screen.queryByText("PREF BETIM")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Ver as compras/ }));

    expect(screen.getByText("PREF BETIM")).toBeTruthy();
    expect(screen.getByText("FORNECEDOR PREF BETIM")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Esconder as compras/ })).toBeTruthy();
  });

  it("mostra o alerta quando os preços não parecem ser do mesmo produto", () => {
    const dispersos = [preco(100, "Brumadinho", "A"), preco(500, "Betim", "B"), preco(900, "Ibirité", "C")];
    render(<CestaPrecosPanel resultado={resultado(dispersos)} />);
    expect(screen.getByText(/variam muito entre si/)).toBeTruthy();
  });

  it("não renderiza nada quando não houve preço — não deixa caixa vazia na tela", () => {
    const { container } = render(<CestaPrecosPanel resultado={resultado([])} />);
    expect(container.firstChild).toBeNull();
  });
});
