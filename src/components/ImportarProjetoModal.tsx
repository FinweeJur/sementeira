import { useState } from "react";
import { novoProjetoVazio, type Project } from "../lib/types";
import { importarProjetoDeArquivo, EXTENSOES_IMPORTAVEIS, type CausaSemIa, type ImportarResultado } from "../lib/importar-projeto";
import { importarPlanilhaEmLote, CABECALHOS_EXEMPLO, type ProjetoDaPlanilha } from "../lib/importar-planilha";
import { ehPlanilha } from "../lib/file-extraction";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useTasks } from "../lib/task-context";
import { Upload, FileText, Settings, AlertTriangle } from "lucide-react";

/** Título do aviso por causa — a pessoa precisa saber QUE tipo de tropeço foi. */
const TITULO_POR_CAUSA: Record<CausaSemIa, string> = {
  "ia-nao-configurada": "Importado sem a ajuda da IA",
  "ia-indisponivel": "A IA não respondeu — importei sem ela",
  "resposta-ininteligivel": "Não entendi a resposta da IA — importei sem ela",
  "resposta-vazia": "A IA não preencheu nada — importei sem ela",
  "ia-pediu-informacoes": "A IA pediu mais informações — importei o que deu",
};

/** Nome do campo como a pessoa vê na tela, não como o código chama. */
const NOMES_CAMPOS: Record<string, string> = {
  objetivo: "objetivo",
  objetivosEspecificos: "objetivos específicos",
  justificativa: "justificativa",
  metas: "metas",
  boasPraticas: "boas práticas",
  comoComunidadeAjuda: "participação da comunidade",
  missaoImpacto: "missão e impacto",
};

/**
 * Modal de importação de projeto: o usuário anexa um PDF/DOCX, o app extrai o
 * texto, a IA preenche os campos automaticamente, e o documento original é
 * guardado no disco para consulta posterior.
 */
export function ImportarProjetoModal({
  onCreate,
  onCreateMuitos,
  onFechar,
  onAbrirConfigModelo,
}: {
  onCreate: (p: Project) => void;
  /** Importação em lote: a planilha vira N projetos de uma vez. */
  onCreateMuitos: (projetos: Project[]) => void;
  onFechar: () => void;
  onAbrirConfigModelo: () => void;
}) {
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarAcaoModelo, setMostrarAcaoModelo] = useState(false);
  const [semIa, setSemIa] = useState<{ projeto: Project; info: NonNullable<ImportarResultado["semIa"]>; acao?: ImportarResultado["acao"] } | null>(null);
  const [lote, setLote] = useState<{ projetos: ProjetoDaPlanilha[]; avisos: string[]; colunasIgnoradas: string[] } | null>(null);
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set());
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const { registrar, concluir, falhar } = useTasks();

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;

    const extensao = arquivo.name.toLowerCase().split(".").pop() ?? "";
    if (!EXTENSOES_IMPORTAVEIS.includes(extensao)) {
      setErro("Formato não suportado. Use PDF (.pdf), Word (.docx), Excel (.xlsx) ou CSV (.csv).");
      return;
    }

    setProcessando(true);
    setErro(null);
    setMostrarAcaoModelo(false);
    setLote(null);
    setExcluidos(new Set());
    setNomeArquivo(arquivo.name);

    // Planilha com cabeçalho reconhecido não precisa de IA nenhuma: cada linha
    // já é um projeto. Se o cabeçalho não for reconhecido, `reconhecida` volta
    // false e o arquivo segue para o caminho de documento abaixo, onde a IA e
    // o plano B heurístico tentam entender — nada lido é descartado.
    if (ehPlanilha(arquivo.name)) {
      const tarefaLote = registrar("importar-projeto", `Lendo a planilha "${arquivo.name}"...`);
      const emLote = await importarPlanilhaEmLote(arquivo);
      if (emLote.reconhecida) {
        setProcessando(false);
        if (!emLote.ok || !emLote.projetos) {
          const msg = emLote.erro ?? "Não foi possível ler a planilha.";
          setErro(msg);
          falhar(tarefaLote, msg);
          return;
        }
        concluir(tarefaLote, undefined, `${arquivo.name} — ${emLote.projetos.length} projeto(s)`);
        setLote({ projetos: emLote.projetos, avisos: emLote.avisos ?? [], colunasIgnoradas: emLote.colunasNaoReconhecidas ?? [] });
        return;
      }
      concluir(tarefaLote, undefined, "cabeçalho não reconhecido — lendo como documento");
    }

    const projetoBase = novoProjetoVazio();
    const taskId = registrar("importar-projeto", `Importando de "${arquivo.name}"...`, projetoBase.id);
    const resultado = await importarProjetoDeArquivo(arquivo, projetoBase);
    setProcessando(false);

    if (!resultado.ok || !resultado.projeto) {
      const erroMsg = resultado.erro ?? "Não foi possível importar o projeto.";
      setErro(erroMsg);
      setMostrarAcaoModelo(resultado.acao === "configurar-modelo");
      falhar(taskId, erroMsg);
      return;
    }

    concluir(taskId, undefined, `📄 ${arquivo.name}`);

    // Plano B: o projeto veio da heurística, não da IA. Não fecha calado —
    // mostra por que e o que ficou preenchido, para a pessoa saber o que falta.
    if (resultado.semIa) {
      setSemIa({ projeto: resultado.projeto, info: resultado.semIa, acao: resultado.acao });
      return;
    }

    onCreate(resultado.projeto);
    onFechar();
  }

  const escolhidos = lote ? lote.projetos.filter((_, i) => !excluidos.has(i)) : [];

  function alternarLinha(indice: number) {
    const novo = new Set(excluidos);
    if (novo.has(indice)) novo.delete(indice);
    else novo.add(indice);
    setExcluidos(novo);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/60 p-4">
      <div className={`w-full space-y-4 rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-6 ${lote ? "my-4 max-h-[90vh] max-w-2xl overflow-auto" : "max-w-md"}`}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            <Upload size={16} strokeWidth={2} />
            Importar projeto de arquivo
          </h2>
          <button onClick={onFechar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            fechar
          </button>
        </div>

        {!lote && (
          <p className="text-sm text-[color:var(--sm-text-dim)]">
            Anexe um documento (PDF, Word) ou uma planilha (Excel, CSV) que descreve o projeto. A IA lê o conteúdo e preenche os campos — objetivo, justificativa, metas, equipe. O arquivo original fica guardado para você consultar depois.
            <br />
            <span className="text-xs">
              Planilha com uma linha por projeto e colunas nomeadas ({CABECALHOS_EXEMPLO.join(", ")}…) vira vários projetos de uma vez, sem usar IA.
            </span>
          </p>
        )}

        {lote && (
          <div className="space-y-3">
            <div className="rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-bg)]/40 p-3 text-xs">
              <p className="font-medium">
                {lote.projetos.length === 1 ? "1 projeto encontrado" : `${lote.projetos.length} projetos encontrados`} em "{nomeArquivo}"
              </p>
              {lote.avisos.map((aviso, i) => (
                <p key={i} className="mt-1 text-[color:var(--sm-text-dim)]">• {aviso}</p>
              ))}
              {lote.colunasIgnoradas.length > 0 && (
                <p className="mt-1 text-[color:var(--sm-text-dim)]">• Colunas ignoradas: {lote.colunasIgnoradas.join(", ")}</p>
              )}
            </div>

            <div className="space-y-2">
              {lote.projetos.map((item, i) => {
                const bloqueios = item.conformidade.filter((f) => f.severidade === "bloqueio").length;
                const atencoes = item.conformidade.filter((f) => f.severidade === "atencao").length;
                const total = item.projeto.orcamento.reduce((s, l) => s + l.valor, 0);
                const incluido = !excluidos.has(i);
                return (
                  <div key={i} className={`rounded border border-[color:var(--sm-border)] p-3 text-sm ${incluido ? "" : "opacity-50"}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={incluido} onChange={() => alternarLinha(i)} className="mt-1" aria-label="Incluir este projeto" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.projeto.titulo || "(sem título)"}</p>
                        <p className="mt-0.5 text-xs text-[color:var(--sm-text-dim)]">
                          {[
                            item.projeto.local || "local não informado",
                            total > 0 ? total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "sem orçamento",
                            item.projeto.pessoasAtendidasDiretas ? `${item.projeto.pessoasAtendidasDiretas} pessoas` : null,
                            `${item.camposPreenchidos.length} campos`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          {bloqueios > 0 && <span className="text-[color:var(--sm-bloqueio-text)]">{bloqueios} bloqueio(s)</span>}
                          {atencoes > 0 && <span className="text-[color:var(--sm-atencao-text)]">{atencoes} atenção(ões)</span>}
                        </div>
                        {item.avisos.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-[color:var(--sm-text-dim)]">
                            {item.avisos.map((a, j) => (
                              <li key={j} className="flex gap-1.5">
                                <AlertTriangle size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-[color:var(--sm-text-dim)]">
              As pendências acima vêm do motor de regras, não da planilha. Depois de importar, tudo continua editável no formulário guiado.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  onCreateMuitos(escolhidos.map((e) => e.projeto));
                  onFechar();
                }}
                disabled={escolhidos.length === 0}
                className="flex-1 rounded bg-[color:var(--sm-accent)] px-3 py-2 text-sm font-medium text-[color:var(--sm-bg)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Importar {escolhidos.length === 1 ? "1 projeto" : `${escolhidos.length} projetos`}
              </button>
              <button
                onClick={() => {
                  setLote(null);
                  setNomeArquivo(null);
                }}
                className="rounded border border-[color:var(--sm-border)] px-3 py-2 text-sm hover:border-[color:var(--sm-accent)]"
              >
                Escolher outro
              </button>
            </div>
          </div>
        )}

        {lote ? null : semIa ? (
          <div className="space-y-3">
            <div className="rounded border border-[color:var(--sm-atencao-border)] bg-[color:var(--sm-atencao-bg)] p-3 text-xs">
              <p className="font-medium text-[color:var(--sm-atencao-text)]">{TITULO_POR_CAUSA[semIa.info.causa]}</p>
              <p className="mt-1 text-[color:var(--sm-text-dim)]">{semIa.info.motivo}</p>
              {semIa.info.detalheTecnico && (
                <p className="mt-1 text-[color:var(--sm-text-dim)] opacity-70">Detalhe: {semIa.info.detalheTecnico}</p>
              )}
              <p className="mt-2 text-[color:var(--sm-text-dim)]">
                O documento foi lido e fica anexado ao projeto. Preenchi automaticamente o que consegui reconhecer pelos títulos
                {semIa.info.camposPreenchidos.length > 0 ? ": " : "."}
                {semIa.info.camposPreenchidos.length > 0 && (
                  <span className="text-[color:var(--sm-text)]">{semIa.info.camposPreenchidos.map((c) => NOMES_CAMPOS[c] ?? c).join(", ")}</span>
                )}
                {semIa.info.camposPreenchidos.length > 0 && ". "}
                O resto você completa à mão, com o texto do documento à vista.
              </p>
              {semIa.info.perguntas && semIa.info.perguntas.length > 0 && (
                <div className="mt-2">
                  <p className="text-[color:var(--sm-text-dim)]">A IA achou que faltava saber:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[color:var(--sm-text)]">
                    {semIa.info.perguntas.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onCreate(semIa.projeto);
                  onFechar();
                }}
                className="flex-1 rounded bg-[color:var(--sm-accent)] px-3 py-2 text-sm font-medium text-[color:var(--sm-bg)]"
              >
                Abrir o projeto assim
              </button>
              {semIa.acao === "configurar-modelo" && (
                <button
                  onClick={onAbrirConfigModelo}
                  className="rounded border border-[color:var(--sm-border)] px-3 py-2 text-sm hover:border-[color:var(--sm-accent)]"
                >
                  Configurar a IA
                </button>
              )}
              {semIa.acao === "tentar-ia-novamente" && (
                <button
                  onClick={() => {
                    setSemIa(null);
                    document.querySelector<HTMLInputElement>("#sm-importar-arquivo")?.click();
                  }}
                  className="rounded border border-[color:var(--sm-border)] px-3 py-2 text-sm hover:border-[color:var(--sm-accent)]"
                >
                  Tentar a IA de novo
                </button>
              )}
            </div>
          </div>
        ) : processando ? (
          <div className="space-y-3 rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/5 p-4">
            <ThinkingIndicator />
            {nomeArquivo && <p className="text-xs text-[color:var(--sm-text-dim)]">Lendo "{nomeArquivo}" e preenchendo o projeto com IA...</p>}
            <p className="text-xs text-[color:var(--sm-text-dim)]">Isso pode levar alguns segundos, especialmente com Ollama local.</p>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded border border-dashed border-[color:var(--sm-border)] p-6 text-center hover:border-[color:var(--sm-accent)]">
            <FileText size={32} strokeWidth={1.5} className="text-[color:var(--sm-accent)]" />
            <span className="text-sm font-medium">Clique para escolher um arquivo</span>
            <span className="text-xs text-[color:var(--sm-text-dim)]">PDF (.pdf) ou Word (.docx)</span>
            <input id="sm-importar-arquivo" type="file" accept=".pdf,.docx,.xlsx,.xlsm,.csv" className="hidden" onChange={handleArquivo} />
          </label>
        )}

        {erro && (
          <div className="rounded border border-[color:var(--sm-red)]/50 bg-[color:var(--sm-red)]/10 p-3 text-xs">
            <p className="font-medium text-[color:var(--sm-red)]">Não foi possível importar</p>
            <p className="mt-1 whitespace-pre-wrap text-[color:var(--sm-text-dim)]">{erro}</p>
            {mostrarAcaoModelo && (
              <button
                onClick={onAbrirConfigModelo}
                className="mt-2 inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]"
              >
                <Settings size={13} strokeWidth={2} />
                Abrir as configurações do modelo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
