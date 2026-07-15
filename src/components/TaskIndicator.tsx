import { useTarefasAtivas, useNovidades } from "../lib/task-context";

/**
 * Botão flutuante no canto inferior direito — só aparece quando há tarefas
 * rodando ou novidades (resultados não vistos). Clicando, abre a sidebar.
 * - Badge com nº de tarefas ativas.
 * - Pulsa (.sm-etapa-pulsando) quando há novidade não vista.
 */
export function TaskIndicator({ onAbrir }: { onAbrir: () => void }) {
  const ativas = useTarefasAtivas();
  const novidades = useNovidades();

  if (ativas.length === 0 && novidades.length === 0) return null;

  const temNovidade = novidades.length > 0;

  return (
    <button
      onClick={onAbrir}
      className={`no-print fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-[color:var(--sm-accent)] bg-[color:var(--sm-panel)] px-4 py-2.5 text-sm shadow-lg hover:bg-[color:var(--sm-accent)]/20 ${
        temNovidade ? "sm-etapa-pulsando" : ""
      }`}
      title="Tarefas de IA em andamento"
    >
      <span className="sm-spin" aria-hidden="true" style={{ display: ativas.length > 0 ? undefined : "none" }} />
      {ativas.length > 0 ? (
        <span>
          {ativas.length} tarefa{ativas.length > 1 ? "s" : ""} rodando
        </span>
      ) : (
        <span>{novidades.length} novidade{novidades.length > 1 ? "s" : ""}</span>
      )}
      {temNovidade && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--sm-accent)] px-1 text-xs font-bold text-[color:var(--sm-bg)]">
          {novidades.length}
        </span>
      )}
    </button>
  );
}
