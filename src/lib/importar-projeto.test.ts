import { beforeEach, describe, expect, it, vi } from "vitest";
import { novoProjetoVazio } from "./types";

// Mocks precisam ser declarados antes do import do módulo sob teste.
const mocks = vi.hoisted(() => ({
  extrairTexto: vi.fn(),
  configPronta: vi.fn(),
  enviarLLM: vi.fn(),
}));

vi.mock("./file-extraction", () => ({ extrairTextoDeArquivo: mocks.extrairTexto }));
vi.mock("./providers", () => ({
  carregarConfigLLM: () => ({ providerId: "ollama", model: "qualquer" }),
  configuracaoLLMPronta: mocks.configPronta,
  enviarMensagemLLM: mocks.enviarLLM,
}));
vi.mock("./diretrizes-globais", () => ({ montarBlocoDiretrizesGlobais: () => "" }));

const { importarProjetoDeArquivo } = await import("./importar-projeto");

const DOCUMENTO = [
  "Projeto de Horta Comunitária",
  "Objetivo: produzir alimentos para as famílias atingidas pelo rompimento da barragem.",
  "Justificativa: a comunidade perdeu sua fonte de renda depois da contaminação do rio.",
  "Metas: implantar 20 canteiros e capacitar 30 famílias.",
].join("\n");

function arquivo(nome = "projeto.docx"): File {
  return { name: nome } as File;
}

describe("importarProjetoDeArquivo — invariante do plano B", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extrairTexto.mockResolvedValue({ ok: true, texto: DOCUMENTO });
    mocks.configPronta.mockReturnValue({ pronta: true });
  });

  /**
   * O contrato central: depois que o texto foi extraído, NENHUMA falha da IA
   * pode devolver ok:false. O documento já foi lido — descartá-lo obrigaria a
   * pessoa a recomeçar do zero.
   */
  const falhasDaIa: { nome: string; arranjo: () => void; causa: string }[] = [
    {
      nome: "IA não configurada",
      arranjo: () => mocks.configPronta.mockReturnValue({ pronta: false, motivo: "Nenhum modelo selecionado." }),
      causa: "ia-nao-configurada",
    },
    {
      nome: "provedor fora do ar (exceção)",
      arranjo: () => mocks.enviarLLM.mockRejectedValue(new Error("ECONNREFUSED")),
      causa: "ia-indisponivel",
    },
    {
      nome: "provedor devolve erro",
      arranjo: () => mocks.enviarLLM.mockResolvedValue({ ok: false, erro: "model not found" }),
      causa: "ia-indisponivel",
    },
    {
      nome: "resposta sem JSON nenhum",
      arranjo: () => mocks.enviarLLM.mockResolvedValue({ ok: true, conteudo: "Desculpe, não consegui." }),
      causa: "resposta-ininteligivel",
    },
    {
      nome: "JSON truncado no meio",
      arranjo: () => mocks.enviarLLM.mockResolvedValue({ ok: true, conteudo: '```json\n{"objetivo":"corta aqui' }),
      causa: "resposta-ininteligivel",
    },
    {
      nome: "IA devolve perguntas",
      arranjo: () => mocks.enviarLLM.mockResolvedValue({ ok: true, conteudo: '```json\n{"perguntas":["qual o prazo?"]}\n```' }),
      causa: "ia-pediu-informacoes",
    },
    {
      nome: "JSON válido mas todos os campos vazios",
      arranjo: () => mocks.enviarLLM.mockResolvedValue({ ok: true, conteudo: '```json\n{"objetivo":"","metas":[]}\n```' }),
      causa: "resposta-vazia",
    },
  ];

  for (const caso of falhasDaIa) {
    it(`${caso.nome}: devolve projeto (nunca erro) com causa "${caso.causa}"`, async () => {
      caso.arranjo();
      const r = await importarProjetoDeArquivo(arquivo(), novoProjetoVazio());

      expect(r.ok).toBe(true);
      expect(r.erro).toBeUndefined();
      expect(r.projeto).toBeDefined();
      expect(r.semIa?.causa).toBe(caso.causa);
    });

    it(`${caso.nome}: a heurística salva os campos do documento`, async () => {
      caso.arranjo();
      const r = await importarProjetoDeArquivo(arquivo(), novoProjetoVazio());

      expect(r.projeto?.objetivo).toContain("produzir alimentos");
      expect(r.projeto?.justificativa).toContain("perdeu sua fonte de renda");
      expect(r.semIa?.camposPreenchidos).toContain("objetivo");
      // O documento original nunca se perde.
      expect(r.projeto?.documentoOrigem?.textoExtraido).toBe(DOCUMENTO);
    });
  }

  it("perguntas da IA são preservadas para a tela", async () => {
    mocks.enviarLLM.mockResolvedValue({ ok: true, conteudo: '```json\n{"perguntas":["qual o prazo?","quantas famílias?"]}\n```' });
    const r = await importarProjetoDeArquivo(arquivo(), novoProjetoVazio());
    expect(r.semIa?.perguntas).toEqual(["qual o prazo?", "quantas famílias?"]);
  });

  it("falha de transporte guarda o detalhe técnico e sugere configurar", async () => {
    mocks.enviarLLM.mockResolvedValue({ ok: false, erro: "model not found" });
    const r = await importarProjetoDeArquivo(arquivo(), novoProjetoVazio());
    expect(r.semIa?.detalheTecnico).toBe("model not found");
    expect(r.acao).toBe("configurar-modelo");
  });

  it("quando a IA responde bem, não marca semIa", async () => {
    mocks.enviarLLM.mockResolvedValue({
      ok: true,
      conteudo: '```json\n{"objetivo":"objetivo vindo da IA","metas":["meta da IA"]}\n```',
    });
    const r = await importarProjetoDeArquivo(arquivo(), novoProjetoVazio());
    expect(r.ok).toBe(true);
    expect(r.semIa).toBeUndefined();
    expect(r.projeto?.objetivo).toBe("objetivo vindo da IA");
  });

  it("a IA sobrepõe a heurística, mas o que ela omitiu não se perde", async () => {
    // A IA só devolve objetivo; justificativa tem que sobreviver da heurística.
    mocks.enviarLLM.mockResolvedValue({ ok: true, conteudo: '```json\n{"objetivo":"só o objetivo"}\n```' });
    const r = await importarProjetoDeArquivo(arquivo(), novoProjetoVazio());
    expect(r.projeto?.objetivo).toBe("só o objetivo");
    expect(r.projeto?.justificativa).toContain("perdeu sua fonte de renda");
  });

  // Erros REAIS de insumo continuam sendo erro — não há documento para salvar.
  it("extensão inválida continua erro", async () => {
    const r = await importarProjetoDeArquivo(arquivo("planilha.xlsx"), novoProjetoVazio());
    expect(r.ok).toBe(false);
    expect(r.erro).toContain("não é suportado");
  });

  it("falha de leitura do arquivo continua erro", async () => {
    mocks.extrairTexto.mockResolvedValue({ ok: false, erro: "arquivo corrompido" });
    const r = await importarProjetoDeArquivo(arquivo(), novoProjetoVazio());
    expect(r.ok).toBe(false);
    expect(r.erro).toContain("Não foi possível ler");
  });

  it("documento sem texto suficiente continua erro", async () => {
    mocks.extrairTexto.mockResolvedValue({ ok: true, texto: "oi" });
    const r = await importarProjetoDeArquivo(arquivo(), novoProjetoVazio());
    expect(r.ok).toBe(false);
    expect(r.erro).toContain("vazio");
  });
});
