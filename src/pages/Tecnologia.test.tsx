import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tecnologia } from "./Tecnologia";
import type { Project } from "../lib/types";

function projeto(parcial: Partial<Project> = {}): Project {
  return { id: "p1", titulo: "Polpa de fruta em Brumadinho", orcamento: [], ...parcial } as unknown as Project;
}

describe("Tecnologia", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sem chave da Tavily a tela não fica em branco: sobram a conta de importação e os alertas", () => {
    render(<Tecnologia projects={[projeto()]} onVoltar={() => {}} onAtualizarProjeto={() => {}} onAbrirConfig={() => {}} />);

    expect(screen.getByText(/precisa da chave da Tavily/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Procurar máquina/ })).toHaveProperty("disabled", true);
    // As duas partes que não dependem de rede continuam de pé.
    expect(screen.getByText(/Quanto custa posto no Brasil/)).toBeTruthy();
    expect(screen.getByText(/NR-12/)).toBeTruthy();
  });

  it("os alertas acompanham a origem escolhida — importar tem barreira que comprar aqui não tem", () => {
    render(<Tecnologia projects={[projeto()]} onVoltar={() => {}} onAtualizarProjeto={() => {}} onAbrirConfig={() => {}} />);

    expect(screen.queryByText(/Radar\/Siscomex/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /China \(importação\)/ }));
    expect(screen.getByText(/Radar\/Siscomex/)).toBeTruthy();
  });

  it("mostra o multiplicador da importação, que é o número que decide a comparação", () => {
    render(<Tecnologia projects={[projeto()]} onVoltar={() => {}} onAtualizarProjeto={() => {}} onAbrirConfig={() => {}} />);

    fireEvent.change(screen.getByLabelText(/Preço anunciado/), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText(/Dólar/), { target: { value: "5" } });

    // 1000 FOB a R$ 5 = R$ 5.000 de vitrine; posto no Brasil passa de 1,6× (tributo entra na base do seguinte).
    const multiplicador = screen.getByText(/×$/);
    expect(Number(multiplicador.textContent!.replace("×", "").replace(",", "."))).toBeGreaterThan(1.6);
    expect(screen.getByText(/o preço de vitrine/)).toBeTruthy();
  });

  it("lança a máquina no orçamento com a procedência de anúncio, não de compra pública", async () => {
    // A busca é injetada no módulo por `buscarWeb`; aqui a chave existe e a Tavily é simulada.
    localStorage.setItem("sementeira-tavily-config-v1", JSON.stringify({ apiKey: "chave-de-teste" }));
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ results: [{ title: "Despolpadeira industrial 100 kg/h", url: "https://exemplo.com.br/anuncio", content: "Máquina para polpa" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const alterado = vi.fn();
    render(<Tecnologia projects={[projeto()]} onVoltar={() => {}} onAtualizarProjeto={alterado} onAbrirConfig={() => {}} />);

    fireEvent.change(screen.getByLabelText(/Necessidade/), { target: { value: "despolpar fruta" } });
    fireEvent.click(screen.getByRole("button", { name: /Procurar máquina/ }));

    const anuncio = await screen.findByText("Despolpadeira industrial 100 kg/h");
    expect(anuncio).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: /Lançar no orçamento/ })[0]);
    fireEvent.change(screen.getByLabelText(/Valor \(R\$\)/), { target: { value: "4200" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Lançar no orçamento/ }).at(-1)!);

    expect(alterado).toHaveBeenCalledTimes(1);
    const salvo = alterado.mock.calls[0][0] as Project;
    expect(salvo.orcamento).toHaveLength(1);
    expect(salvo.orcamento[0].categoria).toBe("equipamento");
    expect(salvo.orcamento[0].valor).toBe(4200);
    expect(salvo.orcamento[0].referenciaPreco?.origem).toBe("pesquisa-mercado");
    expect(salvo.orcamento[0].referenciaPreco?.url).toBe("https://exemplo.com.br/anuncio");
  });
});
