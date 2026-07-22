import { useState } from "react";
import { novoProjetoVazio, type Project } from "../lib/types";
import { importarProjetoDeArquivo } from "../lib/importar-projeto";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useTasks } from "../lib/task-context";
import { Upload, FileText } from "lucide-react";

/**
 * Modal de importação de projeto: o usuário anexa um PDF/DOCX, o app extrai o
 * texto, a IA preenche os campos automaticamente, e o documento original é
 * guardado no disco para consulta posterior.
 */
export function ImportarProjetoModal({
  onCreate,
  onFechar,
}: {
  onCreate: (p: Project) => void;
  onFechar: () => void;
}) {
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
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
    setNomeArquivo(arquivo.name);

    const projetoBase = novoProjetoVazio();
    const taskId = registrar("importar-projeto", `Importando de "${arquivo.name}"...`, projetoBase.id);
    const resultado = await importarProjetoDeArquivo(arquivo, projetoBase);
    setProcessando(false);

    if (!resultado.ok || !resultado.projeto) {
      const erroMsg = resultado.erro ?? "Não foi possível importar o projeto.";
      setErro(erroMsg);
      falhar(taskId, erroMsg);
      return;
    }

    concluir(taskId, undefined, `📄 ${arquivo.name}`);
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

        {processando ? (
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
          </div>
        )}
      </div>
    </div>
  );
}
