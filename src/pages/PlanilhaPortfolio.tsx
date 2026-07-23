import { useMemo, useState } from "react";
import type { Project } from "../lib/types";
import { formatarCelula, montarAbasPortfolio, type AbaTabela, type Celula, type LinhaTabela } from "../lib/portfolio-tabela";
import { exportarPortfolioXlsx } from "../lib/export";
import { normalizarTexto } from "../lib/texto";
import { Download, ArrowUp, ArrowDown, ArrowLeft } from "lucide-react";

type Ordenacao = { coluna: number; direcao: "asc" | "desc" } | null;

/** Compara para ordenação: número com número, texto com texto, vazio sempre por último. */
function compararCelulas(a: Celula, b: Celula): number {
  const aVazio = a === null || a === "";
  const bVazio = b === null || b === "";
  if (aVazio && bVazio) return 0;
  if (aVazio) return 1;
  if (bVazio) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR");
}

function linhaCorrespondeBusca(linha: LinhaTabela, termo: string): boolean {
  if (!termo) return true;
  return linha.celulas.some((c) => c !== null && normalizarTexto(String(c)).includes(termo));
}

/**
 * A planilha do portfólio dentro do app. Mostra exatamente o mesmo conteúdo do
 * .xlsx — as duas saídas vêm de `montarAbasPortfolio` — para que ninguém
 * precise baixar um arquivo e abrir o Excel só para conferir os números.
 */
export function PlanilhaPortfolio({
  projects,
  onVoltar,
  onAbrirProjeto,
}: {
  projects: Project[];
  onVoltar: () => void;
  onAbrirProjeto: (id: string) => void;
}) {
  const abas = useMemo(() => montarAbasPortfolio(projects), [projects]);
  const [abaAtivaId, setAbaAtivaId] = useState(abas[0]?.id ?? "projetos");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>(null);
  const [mostrarTextosLongos, setMostrarTextosLongos] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const aba: AbaTabela = abas.find((a) => a.id === abaAtivaId) ?? abas[0];

  // O Resumo tem linhas de seção e de espaçamento; buscar e ordenar ali
  // embaralharia a estrutura, então esses controles não se aplicam a ele.
  const tabular = aba.id !== "resumo";

  const colunasVisiveis = useMemo(
    () => aba.colunas.map((c, i) => ({ coluna: c, indice: i })).filter(({ coluna }) => mostrarTextosLongos || !coluna.textoLongo),
    [aba, mostrarTextosLongos],
  );

  const linhas = useMemo(() => {
    if (!tabular) return aba.linhas;
    const termo = normalizarTexto(busca);
    const filtradas = aba.linhas.filter((l) => l.tipo === "total" || linhaCorrespondeBusca(l, termo));
    if (!ordenacao) return filtradas;
    // A linha de total fica sempre no fim, independentemente da ordenação.
    const dados = filtradas.filter((l) => l.tipo !== "total");
    const totais = filtradas.filter((l) => l.tipo === "total");
    const sinal = ordenacao.direcao === "asc" ? 1 : -1;
    const ordenadas = [...dados].sort((a, b) => sinal * compararCelulas(a.celulas[ordenacao.coluna], b.celulas[ordenacao.coluna]));
    return [...ordenadas, ...totais];
  }, [aba, busca, ordenacao, tabular]);

  const linhasDeDados = linhas.filter((l) => l.tipo !== "total" && l.tipo !== "secao").length;
  const totalDeDados = aba.linhas.filter((l) => l.tipo !== "total" && l.tipo !== "secao").length;

  function alternarOrdenacao(indice: number) {
    setOrdenacao((atual) => {
      if (!atual || atual.coluna !== indice) return { coluna: indice, direcao: "asc" };
      if (atual.direcao === "asc") return { coluna: indice, direcao: "desc" };
      return null;
    });
  }

  async function baixar() {
    setBaixando(true);
    try {
      await exportarPortfolioXlsx(projects);
    } finally {
      setBaixando(false);
    }
  }

  const temTextosLongos = aba.colunas.some((c) => c.textoLongo);

  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] w-full max-w-[1600px] flex-col gap-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={onVoltar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            <><ArrowLeft size={13} strokeWidth={2} className="inline" /> Meus projetos</>
          </button>
          <h1 className="mt-1 text-2xl font-bold">Planilha do portfólio</h1>
          <p className="text-sm text-[color:var(--sm-text-dim)]">
            {projects.length} projeto(s). É o mesmo conteúdo do arquivo Excel — nada aqui é calculado de outro jeito.
          </p>
        </div>
        <button
          onClick={baixar}
          disabled={baixando}
          className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-4 py-2 text-sm font-medium hover:bg-[color:var(--sm-accent)]/30 disabled:opacity-50"
        >
          {baixando ? "Gerando..." : <><Download size={14} strokeWidth={2} /> Baixar .xlsx</>}
        </button>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-[color:var(--sm-border)]">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              setAbaAtivaId(a.id);
              setOrdenacao(null);
              setBusca("");
            }}
            className={`-mb-px rounded-t border border-b-0 px-3 py-2 text-xs ${
              a.id === abaAtivaId
                ? "border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] font-medium"
                : "border-transparent text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]"
            }`}
          >
            {a.nome}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[color:var(--sm-text-dim)]">{aba.descricao}</p>
        <div className="flex flex-wrap items-center gap-3">
          {temTextosLongos && (
            <label className="flex items-center gap-1.5 text-xs text-[color:var(--sm-text-dim)]">
              <input type="checkbox" checked={mostrarTextosLongos} onChange={(e) => setMostrarTextosLongos(e.target.checked)} />
              mostrar colunas de texto longo
            </label>
          )}
          {tabular && (
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar linhas..."
              className="rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-bg)] px-2 py-1 text-xs outline-none focus:border-[color:var(--sm-accent)]"
            />
          )}
          {tabular && (
            <span className="text-xs text-[color:var(--sm-text-dim)]">
              {linhasDeDados === totalDeDados ? `${totalDeDados} linha(s)` : `${linhasDeDados} de ${totalDeDados} linha(s)`}
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-[color:var(--sm-border)]">
        {linhas.length === 0 ? (
          <p className="p-6 text-center text-sm text-[color:var(--sm-text-dim)]">
            {totalDeDados === 0 ? "Nada para mostrar nesta aba ainda." : "Nenhuma linha corresponde ao filtro."}
          </p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[color:var(--sm-panel)]">
              <tr>
                {colunasVisiveis.map(({ coluna, indice }) => {
                  const ativa = ordenacao?.coluna === indice;
                  return (
                    <th
                      key={indice}
                      onClick={() => tabular && alternarOrdenacao(indice)}
                      style={{ minWidth: `${Math.min(coluna.largura, 40) * 7}px` }}
                      className={`border-b border-[color:var(--sm-border)] px-2 py-2 text-left align-bottom font-medium ${
                        tabular ? "cursor-pointer select-none hover:text-[color:var(--sm-accent)]" : ""
                      } ${coluna.formato !== "texto" ? "text-right" : ""}`}
                      title={tabular ? "Clique para ordenar" : undefined}
                    >
                      {coluna.titulo}
                      {ativa && <span className="ml-1 text-[color:var(--sm-accent)]">{ordenacao?.direcao === "asc" ? <ArrowUp size={11} strokeWidth={2.5} className="inline" /> : <ArrowDown size={11} strokeWidth={2.5} className="inline" />}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, i) => {
                const destaque = linha.tipo === "total" || linha.tipo === "secao";
                const vazia = linha.celulas.every((c) => c === null || c === "");
                return (
                  <tr
                    key={i}
                    onClick={() => linha.projectId && onAbrirProjeto(linha.projectId)}
                    className={`border-b border-[color:var(--sm-border)]/50 ${destaque ? "font-medium" : ""} ${
                      linha.projectId ? "cursor-pointer hover:bg-[color:var(--sm-accent)]/10" : ""
                    } ${vazia ? "h-3" : ""}`}
                    title={linha.projectId ? "Abrir este projeto" : undefined}
                  >
                    {colunasVisiveis.map(({ coluna, indice }) => {
                      const formato = linha.formatos?.[indice] ?? coluna.formato;
                      const bruto = linha.celulas[indice] ?? null;
                      const texto = formatarCelula(bruto, formato);
                      const numerico = formato !== "texto" && typeof bruto === "number";
                      // Coluna declarada larga é conteúdo principal (descrição do
                      // risco, mensagem de conformidade): quebra linha em vez de
                      // truncar, senão a linha perde o sentido.
                      const quebra = coluna.textoLongo || coluna.largura >= 35;
                      return (
                        <td
                          key={indice}
                          className={`px-2 py-1.5 align-top ${numerico ? "text-right tabular-nums whitespace-nowrap" : ""} ${
                            quebra ? "min-w-[16rem] max-w-[28rem] whitespace-pre-wrap" : ""
                          }`}
                          title={!quebra && texto.length > 40 ? texto : undefined}
                        >
                          {quebra || texto.length <= 60 ? texto : `${texto.slice(0, 60)}…`}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-[color:var(--sm-text-dim)]">
        Clique numa linha para abrir o projeto. Clique no título de uma coluna para ordenar. A aba <strong>Projetos</strong> é a que pode ser editada no
        Excel e reimportada em lote.
      </p>
    </div>
  );
}
