import { describe, it, expect, vi, beforeEach } from "vitest";

// O leitor de arquivo é mockado: aqui interessa o MAPEAMENTO de colunas e a
// sanitização, não o parser de xlsx (que é do exceljs e roda no navegador).
const mocks = vi.hoisted(() => ({ extrairPlanilha: vi.fn() }));
vi.mock("./file-extraction", () => ({ extrairPlanilha: mocks.extrairPlanilha }));

import { importarPlanilhaEmLote } from "./importar-planilha";

function arquivo(nome = "projetos.xlsx"): File {
  return new File(["x"], nome);
}

function comLinhas(linhas: string[][], nomeAba = "Projetos") {
  mocks.extrairPlanilha.mockResolvedValue({ ok: true, abas: [{ nome: nomeAba, linhas }] });
}

const CABECALHO = ["Título", "Local", "Município", "Valor total (R$)", "Pessoas atendidas (diretas)"];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("importarPlanilhaEmLote — reconhecimento de cabeçalho", () => {
  it("uma linha vira um projeto", async () => {
    comLinhas([CABECALHO, ["Padaria Comunitária", "Parque da Cachoeira", "Brumadinho", "R$ 180.000,00", "24"]]);
    const r = await importarPlanilhaEmLote(arquivo());
    expect(r.reconhecida).toBe(true);
    expect(r.projetos).toHaveLength(1);
    expect(r.projetos![0].projeto.titulo).toBe("Padaria Comunitária");
  });

  it("cada linha de dados vira um projeto separado", async () => {
    comLinhas([CABECALHO, ["A", "x", "Betim", "1000", "1"], ["B", "y", "Betim", "2000", "2"], ["C", "z", "Betim", "3000", "3"]]);
    const r = await importarPlanilhaEmLote(arquivo());
    expect(r.projetos?.map((p) => p.projeto.titulo)).toEqual(["A", "B", "C"]);
  });

  // A regra que separa este caminho do de documento: com cabeçalho fraco, a
  // planilha NÃO é recusada — volta `reconhecida: false` para quem chamou
  // mandá-la ao pipeline de documento (IA + heurística).
  it("cabeçalho não reconhecido devolve reconhecida:false, sem erro", async () => {
    comLinhas([["Nome da iniciativa", "Onde fica", "Quanto custa"], ["Cozinha", "São Joaquim", "95 mil"]]);
    const r = await importarPlanilhaEmLote(arquivo());
    expect(r.reconhecida).toBe(false);
    expect(r.erro).toBeUndefined();
  });

  it("escolhe a aba com mais colunas reconhecidas", async () => {
    mocks.extrairPlanilha.mockResolvedValue({
      ok: true,
      abas: [
        { nome: "Instruções", linhas: [["Leia antes"], ["blá"]] },
        { nome: "Projetos", linhas: [CABECALHO, ["Certa", "x", "Betim", "1000", "5"]] },
      ],
    });
    const r = await importarPlanilhaEmLote(arquivo());
    expect(r.projetos?.[0].projeto.titulo).toBe("Certa");
    expect(r.avisos?.some((a) => a.includes("Projetos"))).toBe(true);
  });

  it("lista as colunas que não foram reconhecidas em vez de ignorá-las calado", async () => {
    comLinhas([[...CABECALHO, "Observações internas"], ["A", "x", "Betim", "1000", "1", "qualquer coisa"]]);
    const r = await importarPlanilhaEmLote(arquivo());
    expect(r.colunasNaoReconhecidas).toContain("Observações internas");
  });

  it("cabeçalho reconhecido mas sem linhas de dados é erro", async () => {
    comLinhas([CABECALHO]);
    const r = await importarPlanilhaEmLote(arquivo());
    // Sem segunda linha a aba nem é candidata, então cai no caminho de documento.
    expect(r.ok).toBe(false);
  });
});

describe("importarPlanilhaEmLote — leitura dos valores", () => {
  it("lê dinheiro em formato brasileiro e sem formatação", async () => {
    comLinhas([CABECALHO, ["A", "x", "Betim", "R$ 180.000,00", "1"], ["B", "y", "Betim", "120000", "2"]]);
    const r = await importarPlanilhaEmLote(arquivo());
    const total = (i: number) => r.projetos![i].projeto.orcamento.reduce((s, l) => s + l.valor, 0);
    expect(total(0)).toBe(180000);
    expect(total(1)).toBe(120000);
  });

  it("resolve município da bacia pelo nome", async () => {
    comLinhas([CABECALHO, ["A", "x", "Brumadinho", "1000", "1"]]);
    const r = await importarPlanilhaEmLote(arquivo());
    expect(r.projetos![0].projeto.municipioId).toBe("brumadinho");
  });

  // Inventar um id que não existe nas listas oficiais é pior que deixar vazio:
  // o projeto passaria a declarar vínculo com um dano que não foi escolhido.
  it("id fora da lista oficial não é inventado — vira aviso", async () => {
    comLinhas([["Título", "Local", "Dano vinculado", "Valor total (R$)"], ["A", "x", "dano que não existe", "1000"]]);
    const r = await importarPlanilhaEmLote(arquivo());
    expect(r.projetos![0].projeto.danoId).toBe("");
    expect(r.projetos![0].avisos.join(" ")).toContain("não corresponde");
  });

  it("valor ilegível não vira número inventado — vira aviso", async () => {
    comLinhas([CABECALHO, ["A", "x", "Betim", "a combinar", "1"]]);
    const r = await importarPlanilhaEmLote(arquivo());
    expect(r.projetos![0].avisos.join(" ")).toContain("não foi possível ler");
  });

  it("uma célula com vários itens vira lista estruturada", async () => {
    comLinhas([["Título", "Local", "Itens necessários", "Riscos"], ["A", "x", "Forno industrial; Batedeira", "Falta de energia; Estiagem"]]);
    const r = await importarPlanilhaEmLote(arquivo());
    const p = r.projetos![0].projeto;
    expect(p.itensNecessarios?.map((i) => i.descricao)).toEqual(["Forno industrial", "Batedeira"]);
    expect(p.riscos.map((i) => i.descricao)).toEqual(["Falta de energia", "Estiagem"]);
  });

  it("sinônimos de cabeçalho são aceitos", async () => {
    comLinhas([["Nome do projeto", "Cidade", "Orçamento", "Beneficiários diretos"], ["A", "Betim", "5000", "10"]]);
    const r = await importarPlanilhaEmLote(arquivo());
    expect(r.reconhecida).toBe(true);
    expect(r.projetos![0].projeto.titulo).toBe("A");
    expect(r.projetos![0].projeto.pessoasAtendidasDiretas).toBe(10);
  });
});

describe("importarPlanilhaEmLote — o motor continua sendo a palavra final", () => {
  it("roda a conformidade sobre o que veio da planilha", async () => {
    comLinhas([CABECALHO, ["A", "x", "Betim", "1000", "1"]]);
    const r = await importarPlanilhaEmLote(arquivo());
    // Projeto raso: o motor tem que apontar pendências, não aceitar calado.
    expect(r.projetos![0].conformidade.length).toBeGreaterThan(0);
  });

  it("guarda a procedência sem repetir o arquivo inteiro em cada projeto", async () => {
    comLinhas([CABECALHO, ["A", "x", "Betim", "1000", "1"], ["B", "y", "Betim", "2000", "2"]]);
    const r = await importarPlanilhaEmLote(arquivo("lote.xlsx"));
    for (const item of r.projetos!) {
      expect(item.projeto.documentoOrigem?.nomeArquivo).toBe("lote.xlsx");
      expect(item.projeto.documentoOrigem?.textoExtraido).toBe("");
    }
  });
});
