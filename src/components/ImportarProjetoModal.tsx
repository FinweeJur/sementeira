import { useState } from "react";
import { novoProjetoVazio, type Project } from "../lib/types";
import { importarProjetoDeArquivo } from "../lib/importar-projeto";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useTasks } from "../lib/task-context";
import { Upload, FileText, Settings } from "lucide-react";

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
  onFechar,
  onAbrirConfigModelo,
}: {
  onCreate: (p: Project) => void;
  onFechar: () => void;
  onAbrirConfigModelo: () => void;
}) {
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarAcaoModelo, setMostrarAcaoModelo] = useState(false);
  const [semIa, setSemIa] = useState<{ projeto: Project; campos: string[]; motivo: string } | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const { registrar, concluir, falhar } = useTasks();

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;

    const extensao = arquivo.name.toLowerCase().split(".").pop();
    if (extensao !== "pdf" && extensao !== "docx") {
      setErro("Formato não suportado. Use PDF (.pdf) ou Word (.docx).");
      return;
    }

    setProcessando(true);
    setErro(null);
    setMostrarAcaoModelo(false);
    setNomeArquivo(arquivo.name);

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

    // Sem IA o projeto foi montado pela heurística: não fecha calado, mostra
    // o que ficou preenchido para a pessoa saber o que ainda falta.
    if (resultado.semIa) {
      setSemIa({ projeto: resultado.projeto, campos: resultado.semIa.camposPreenchidos, motivo: resultado.semIa.motivo });
      return;
    }

    onCreate(resultado.projeto);
    onFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            <Upload size={16} strokeWidth={2} />
            Importar projeto de PDF/DOCX
          </h2>
          <button onClick={onFechar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            fechar
          </button>
        </div>

        <p className="text-sm text-[color:var(--sm-text-dim)]">
          Anexe um documento (PDF ou DOCX) que descreve o projeto. A IA vai ler o conteúdo e preencher os campos automaticamente — objetivo, justificativa, metas, equipe, etc. O documento original fica guardado para você consultar depois.
        </p>

        {semIa ? (
          <div className="space-y-3">
            <div className="rounded border border-[color:var(--sm-atencao-border)] bg-[color:var(--sm-atencao-bg)] p-3 text-xs">
              <p className="font-medium text-[color:var(--sm-atencao-text)]">Importado sem a ajuda da IA</p>
              <p className="mt-1 text-[color:var(--sm-text-dim)]">{semIa.motivo}</p>
              <p className="mt-2 text-[color:var(--sm-text-dim)]">
                O documento foi lido e fica anexado ao projeto. Preenchi automaticamente o que consegui reconhecer pelos títulos
                {semIa.campos.length > 0 ? ": " : "."}
                {semIa.campos.length > 0 && <span className="text-[color:var(--sm-text)]">{semIa.campos.map((c) => NOMES_CAMPOS[c] ?? c).join(", ")}</span>}
                {semIa.campos.length > 0 && ". "}
                O resto você completa à mão, com o texto do documento à vista.
              </p>
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
              <button
                onClick={onAbrirConfigModelo}
                className="rounded border border-[color:var(--sm-border)] px-3 py-2 text-sm hover:border-[color:var(--sm-accent)]"
              >
                Configurar a IA
              </button>
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
            <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleArquivo} />
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
