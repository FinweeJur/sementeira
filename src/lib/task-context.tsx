import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type StatusTarefa = "rodando" | "concluida" | "erro" | "cancelada";

export type TipoTarefa =
  | "copiloto-chat"
  | "agente-portfolio"
  | "lapidacao-projeto"
  | "lapidacao-ecossistema"
  | "revisao-geral"
  | "revisao-ia"
  | "analise-ecossistema"
  | "geracao-rascunho"
  | "importar-projeto"
  | "pesquisa-web";

export interface ProgressoTarefa {
  volta?: number;
  totalVoltas?: number;
  etapaAtual?: string;
  indice?: number;
  total?: number;
}

export interface Tarefa {
  id: string;
  tipo: TipoTarefa;
  titulo: string;
  status: StatusTarefa;
  progresso?: ProgressoTarefa;
  resultado?: unknown;
  erro?: string;
  /** Diff resumido para tarefas de lapidação/revisão — ex.: "🔴 3→1 · 🟡 5→2". */
  diff?: string;
  /** Se a tarefa terminou mas o usuário ainda não viu o resultado. */
  naoVista?: boolean;
  criadaEm: number;
  concluidaEm?: number;
  projectId?: string;
  /** Referência de cancelamento — lapidarProjeto() consulta esta função. */
  canceladaRef: { current: boolean };
}

interface TaskContextValue {
  tarefas: Tarefa[];
  registrar: (tipo: TipoTarefa, titulo: string, projectId?: string) => string;
  atualizar: (id: string, partial: Partial<Omit<Tarefa, "id" | "tipo">>) => void;
  concluir: (id: string, resultado?: unknown, diff?: string) => void;
  falhar: (id: string, erro: string) => void;
  cancelar: (id: string) => void;
  marcarVista: (id: string) => void;
  remover: (id: string) => void;
  isCancelada: (id: string) => boolean;
}

const TaskContext = createContext<TaskContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Store global de tarefas — vive ACIMA da navegação (em App.tsx), então
 * operações assíncronas iniciadas numa página continuam rodando mesmo quando
 * o componente que as iniciou desmonta (usuário navegou para outra tela).
 *
 * O `canceladaRef` de cada tarefa sobrevive aqui — lapidarProjeto() consulta
 * via `isCancelada(id)` para parar graciosamente.
 */
export function TaskProvider({ children }: { children: ReactNode }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  // Map paralelo para lookup rápido por id (não dispara re-render).
  const tarefasRef = useRef<Map<string, Tarefa>>(new Map());

  function commit(nova: Tarefa[]) {
    tarefasRef.current = new Map(nova.map((t) => [t.id, t]));
    setTarefas(nova);
  }

  const registrar = useCallback((tipo: TipoTarefa, titulo: string, projectId?: string) => {
    const id = crypto.randomUUID();
    const tarefa: Tarefa = {
      id,
      tipo,
      titulo,
      status: "rodando",
      naoVista: false,
      criadaEm: Date.now(),
      projectId,
      canceladaRef: { current: false },
    };
    commit([tarefa, ...tarefasRef.current.values()]);
    return id;
  }, []);

  const atualizar = useCallback((id: string, partial: Partial<Omit<Tarefa, "id" | "tipo">>) => {
    const atual = tarefasRef.current.get(id);
    if (!atual) return;
    commit([...tarefasRef.current.values()].map((t) => (t.id === id ? { ...t, ...partial } : t)));
  }, []);

  const concluir = useCallback((id: string, resultado?: unknown, diff?: string) => {
    const atual = tarefasRef.current.get(id);
    if (!atual) return;
    const concluida: Tarefa = {
      ...atual,
      status: "concluida",
      resultado,
      diff,
      naoVista: true,
      concluidaEm: Date.now(),
      progresso: undefined,
    };
    commit([...tarefasRef.current.values()].map((t) => (t.id === id ? concluida : t)));
  }, []);

  const falhar = useCallback((id: string, erro: string) => {
    const atual = tarefasRef.current.get(id);
    if (!atual) return;
    const falhou: Tarefa = {
      ...atual,
      status: "erro",
      erro,
      naoVista: true,
      concluidaEm: Date.now(),
      progresso: undefined,
    };
    commit([...tarefasRef.current.values()].map((t) => (t.id === id ? falhou : t)));
  }, []);

  const cancelar = useCallback((id: string) => {
    const atual = tarefasRef.current.get(id);
    if (!atual) return;
    atual.canceladaRef.current = true; // lapidarProjeto() vê isto e para
    const cancelada: Tarefa = {
      ...atual,
      status: "cancelada",
      naoVista: true,
      concluidaEm: Date.now(),
      progresso: undefined,
    };
    commit([...tarefasRef.current.values()].map((t) => (t.id === id ? cancelada : t)));
  }, []);

  const marcarVista = useCallback((id: string) => {
    const atual = tarefasRef.current.get(id);
    if (!atual || !atual.naoVista) return;
    commit([...tarefasRef.current.values()].map((t) => (t.id === id ? { ...t, naoVista: false } : t)));
  }, []);

  const remover = useCallback((id: string) => {
    commit([...tarefasRef.current.values()].filter((t) => t.id !== id));
  }, []);

  const isCancelada = useCallback((id: string) => {
    return tarefasRef.current.get(id)?.canceladaRef.current ?? false;
  }, []);

  const value: TaskContextValue = {
    tarefas,
    registrar,
    atualizar,
    concluir,
    falhar,
    cancelar,
    marcarVista,
    remover,
    isCancelada,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTasks deve ser usado dentro de <TaskProvider>");
  return ctx;
}

/** Conta tarefas ativas — para o badge no indicador flutuante. */
export function useTarefasAtivas(): Tarefa[] {
  const { tarefas } = useTasks();
  return tarefas.filter((t) => t.status === "rodando");
}

/** Conta tarefas concluídas não vistas — para o pulso de "tem novidade". */
export function useNovidades(): Tarefa[] {
  const { tarefas } = useTasks();
  return tarefas.filter((t) => t.naoVista && (t.status === "concluida" || t.status === "erro" || t.status === "cancelada"));
}
