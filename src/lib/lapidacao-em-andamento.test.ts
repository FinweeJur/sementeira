import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assinarLapidacao,
  atualizarLapidacao,
  lapidacaoRodando,
  limparLapidacao,
  obterLapidacao,
  reiniciarLapidacao,
} from "./lapidacao-em-andamento";
import type { ResultadoLapidacao } from "./refinement-loop";

const P1 = "projeto-1";
const P2 = "projeto-2";

const RESULTADO = { ok: true, voltas: [], convergiu: true } as ResultadoLapidacao;

beforeEach(() => {
  limparLapidacao(P1);
  limparLapidacao(P2);
});

/**
 * O ponto destes testes é a promessa que a tela faz: "pode fechar, a
 * lapidação continua e o resultado fica guardado". Fechar o painel desmonta
 * o componente, então o estado precisa sobreviver fora dele.
 */
describe("lapidação em andamento", () => {
  it("começa zerada para um projeto desconhecido", () => {
    const e = obterLapidacao("nunca-visto");
    expect(e.rodando).toBe(false);
    expect(e.resultado).toBeNull();
  });

  it("guarda o resultado mesmo depois de o painel fechar", () => {
    reiniciarLapidacao(P1, 2);
    expect(lapidacaoRodando(P1)).toBe(true);

    // painel fechado aqui — o laço continua e termina depois
    atualizarLapidacao(P1, { rodando: false, resultado: RESULTADO, duracaoSeg: 42 });

    const e = obterLapidacao(P1);
    expect(e.resultado).toBe(RESULTADO);
    expect(e.duracaoSeg).toBe(42);
    expect(e.rodando).toBe(false);
  });

  it("mantém o início para o cronômetro continuar certo ao reabrir", () => {
    reiniciarLapidacao(P1, 1);
    expect(obterLapidacao(P1).inicioEm).toBeTypeOf("number");
  });

  it("reiniciar limpa o resultado da rodada anterior", () => {
    atualizarLapidacao(P1, { resultado: RESULTADO, erro: "falhou antes" });
    reiniciarLapidacao(P1, 3);
    const e = obterLapidacao(P1);
    expect(e.resultado).toBeNull();
    expect(e.erro).toBeNull();
    expect(e.totalVoltas).toBe(3);
  });

  it("não mistura projetos diferentes", () => {
    reiniciarLapidacao(P1, 1);
    atualizarLapidacao(P1, { volta: 5 });
    expect(obterLapidacao(P2).volta).toBe(1);
    expect(lapidacaoRodando(P2)).toBe(false);
  });

  it("avisa os assinantes a cada mudança", () => {
    const avisar = vi.fn();
    const desassinar = assinarLapidacao(P1, avisar);
    reiniciarLapidacao(P1, 1);
    atualizarLapidacao(P1, { volta: 2 });
    expect(avisar).toHaveBeenCalledTimes(2);

    desassinar();
    atualizarLapidacao(P1, { volta: 3 });
    expect(avisar).toHaveBeenCalledTimes(2); // não avisa mais depois de sair
  });

  it("assinante de um projeto não é avisado por outro", () => {
    const avisar = vi.fn();
    assinarLapidacao(P1, avisar);
    atualizarLapidacao(P2, { volta: 9 });
    expect(avisar).not.toHaveBeenCalled();
  });

  it("cancelar fica registrado para o laço consultar", () => {
    reiniciarLapidacao(P1, 1);
    expect(obterLapidacao(P1).cancelado).toBe(false);
    atualizarLapidacao(P1, { cancelado: true });
    expect(obterLapidacao(P1).cancelado).toBe(true);
  });

  it("limpar esquece tudo — usado ao aplicar ou descartar", () => {
    reiniciarLapidacao(P1, 1);
    atualizarLapidacao(P1, { resultado: RESULTADO });
    limparLapidacao(P1);
    expect(obterLapidacao(P1).resultado).toBeNull();
    expect(lapidacaoRodando(P1)).toBe(false);
  });
});
