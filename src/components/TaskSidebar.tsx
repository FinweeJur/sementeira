import { useTasks, type Tarefa } from "../lib/task-context";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { MessageCircle, Bot, RefreshCw, ShieldCheck, Search, Wand2, Upload, Square, X, Zap, type LucideIcon } from "lucide-react";

const ICONE_TIPO: Record<string, LucideIcon> = {
  "copiloto-chat": MessageCircle,
  "agente-portfolio": Bot,
  "lapidacao-projeto": RefreshCw,
  "lapidacao-ecossistema": RefreshCw,
  "revisao-geral": RefreshCw,
  "revisao-ia": ShieldCheck,
  "analise-ecossistema": Search,
  "geracao-rascunho": Wand2,
  "importar-projeto": Upload,
  "pesquisa-web": Search,
};

const ROTULO_TIPO: Record<string, string> = {
  "copiloto-chat": "Copiloto",
  "agente-portfolio": "Copiloto de projetos",
  "lapidacao-projeto": "Lapidação",
  "lapidacao-ecossistema": "Lapidação do ecossistema",
  "revisao-geral": "Revisão geral",
  "revisao-ia": "Revisão por IA",
  "analise-ecossistema": "Análise do ecossistema",
  "geracao-rascunho": "Geração de rascunho",
  "importar-projeto": "Importação de projeto",
  "pesquisa-web": "Pesquisa web",
};

function ItemTarefa({
  tarefa,
  onMarcarVista,
  onCancelar,
  onRemover,
  onAbrirProjeto,
}: {
  tarefa: Tarefa;
  onMarcarVista: (id: string) => void;
  onCancelar: (id: string) => void;
  onRemover: (id: string) => void;
  onAbrirProjeto?: (id: string) => void;
}) {
  const rotulo = ROTULO_TIPO[tarefa.tipo] ?? tarefa.tipo;
  const Icone = ICONE_TIPO[tarefa.tipo];

  return (
    <div
      className={`rounded border p-2 text-sm ${
        tarefa.status === "rodando"
          ? "border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/5"
          : tarefa.status === "erro"
            ? "border-[color:var(--sm-red)]/40 bg-[color:var(--sm-red)]/5"
            : "border-[color:var(--sm-border)]"
      }`}
      onClick={() => onMarcarVista(tarefa.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--sm-text-dim)]">
          {Icone && <Icone size={12} strokeWidth={2} />}
          {rotulo}
        </span>
        <div className="flex items-center gap-1">
          {tarefa.status === "rodando" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancelar(tarefa.id);
              }}
              className="inline-flex items-center gap-1 rounded border border-[color:var(--sm-red)] px-1.5 py-0.5 text-xs text-[color:var(--sm-red)] hover:bg-[color:var(--sm-red)]/10"
            >
              <Square size={10} strokeWidth={2} fill="currentColor" />
              Parar
            </button>
          )}
          {(tarefa.status === "concluida" || tarefa.status === "erro" || tarefa.status === "cancelada") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemover(tarefa.id);
              }}
              className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <p className="mt-0.5 font-medium">{tarefa.titulo}</p>

      {tarefa.status === "rodando" && (
        <div className="mt-1.5">
          <ThinkingIndicator />
          {(tarefa.progresso?.etapaAtual || tarefa.progresso?.volta) && (
            <p className="mt-1 text-xs text-[color:var(--sm-text-dim)]">
              {tarefa.progresso?.volta && tarefa.progresso?.totalVoltas && `Volta ${tarefa.progresso.volta}/${tarefa.progresso.totalVoltas}`}
              {tarefa.progresso?.etapaAtual ? ` — ${tarefa.progresso.etapaAtual}` : ""}
              {tarefa.progresso?.indice != null && tarefa.progresso?.total != null && ` (${tarefa.progresso.indice}/${tarefa.progresso.total})`}
            </p>
          )}
        </div>
      )}

      {tarefa.status === "concluida" && (
        <div className="mt-1 space-y-1">
          {tarefa.diff && <p className="text-xs font-medium text-[color:var(--sm-green)]">{tarefa.diff}</p>}
          {onAbrirProjeto && tarefa.projectId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAbrirProjeto(tarefa.projectId!);
              }}
              className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-2 py-0.5 text-xs hover:bg-[color:var(--sm-accent)]/25"
            >
              Abrir projeto →
            </button>
          )}
        </div>
      )}

      {tarefa.status === "erro" && tarefa.erro && (
        <p className="mt-1 text-xs text-[color:var(--sm-red)]">{tarefa.erro}</p>
      )}
      {tarefa.status === "cancelada" && <p className="mt-1 text-xs text-[color:var(--sm-text-dim)]">Cancelada.</p>}
    </div>
  );
}

/**
 * Painel lateral de tarefas — lista tudo que está rodando (com progresso em
 * tempo real) e tudo que terminou (com diff e botão de abrir projeto).
 */
export function TaskSidebar({
  onFechar,
  onAbrirProjeto,
}: {
  onFechar: () => void;
  onAbrirProjeto?: (id: string) => void;
}) {
  const { tarefas, marcarVista, cancelar, remover } = useTasks();

  const rodando = tarefas.filter((t) => t.status === "rodando");
  const terminadas = tarefas.filter((t) => t.status !== "rodando").slice(0, 20);

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onFechar();
      }}
    >
      <div className="flex items-center justify-between pb-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Zap size={16} strokeWidth={2} />
          Tarefas de IA — Esc para fechar
        </h2>
        <button onClick={onFechar} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
          fechar
        </button>
      </div>

      <p className="text-xs text-[color:var(--sm-text-dim)]">
        As tarefas continuam rodando mesmo se você navegar para outra tela. Resultados aparecem aqui quando terminam.
      </p>

      <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
        {rodando.length > 0 && (
          <>
            <p className="text-xs font-medium text-[color:var(--sm-text-dim)]">Rodando agora ({rodando.length})</p>
            {rodando.map((t) => (
              <ItemTarefa key={t.id} tarefa={t} onMarcarVista={marcarVista} onCancelar={cancelar} onRemover={remover} onAbrirProjeto={onAbrirProjeto} />
            ))}
          </>
        )}

        {terminadas.length > 0 && (
          <>
            <p className="pt-2 text-xs font-medium text-[color:var(--sm-text-dim)]">Concluídas / paradas</p>
            {terminadas.map((t) => (
              <ItemTarefa key={t.id} tarefa={t} onMarcarVista={marcarVista} onCancelar={cancelar} onRemover={remover} onAbrirProjeto={onAbrirProjeto} />
            ))}
          </>
        )}

        {tarefas.length === 0 && <p className="text-xs text-[color:var(--sm-text-dim)]">Nenhuma tarefa ainda.</p>}
      </div>
    </div>
  );
}
