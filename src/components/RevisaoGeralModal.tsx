import { useRef, useState } from "react";
import type { Project } from "../lib/types";
import arquetipos from "../data/arquetipos.json";
import { lapidarProjeto, commitarVersaoLapidada, calcularScore, type ScoreConformidade } from "../lib/refinement-loop";
import { lapidarEcossistema, lapidarClube, ETAPAS_PORTFOLIO_ROTULO, type EtapaPortfolio } from "../lib/refinement-ecosystem";
import { carregarAnaliseEcossistema, salvarAnaliseEcossistema } from "../lib/ecosystem";
import { carregarClube, salvarClube } from "../lib/clube-beneficios";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useTasks } from "../lib/task-context";

interface ResultadoProjeto {
  projectId: string;
  titulo: string;
  status: "ok" | "erro" | "pulado";
  scoreAntes?: ScoreConformidade;
  scoreDepois?: ScoreConformidade;
  erro?: string;
}

type Etapa = "selecao" | "executando" | "resultado";

/**
 * Revisão em massa: lapida vários projetos de uma vez (1 volta cada, aplicação
 * automática — reversível via histórico de versões), e depois roda de novo o
 * ecossistema e o clube de benefícios com a lista já atualizada.
 */
export function RevisaoGeralModal({
  projects,
  onAtualizarProjeto,
  onClose,
  onAbrirEcossistema,
  onAbrirClube,
}: {
  projects: Project[];
  onAtualizarProjeto: (p: Project) => void;
  onClose: () => void;
  onAbrirEcossistema: () => void;
  onAbrirClube: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>("selecao");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [progressoAtual, setProgressoAtual] = useState<{ indice: number; total: number; titulo: string; etapaAtual?: string } | null>(null);
  const [resultados, setResultados] = useState<ResultadoProjeto[]>([]);
  const [progressoEcossistema, setProgressoEcossistema] = useState<"ok" | "erro" | "pendente" | "pulado">("pendente");
  const [progressoClube, setProgressoClube] = useState<"ok" | "erro" | "pendente" | "pulado">("pendente");
  const canceladoRef = useRef(false);
  const { registrar, atualizar, concluir, falhar, isCancelada } = useTasks();

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function selecionarTodos() {
    setSelecionados(new Set(projects.map((p) => p.id)));
  }
  function limparSelecao() {
    setSelecionados(new Set());
  }

  async function iniciar() {
    canceladoRef.current = false;
    setEtapa("executando");
    const idsSelecionados = projects.filter((p) => selecionados.has(p.id)).map((p) => p.id);
    const resultadosAcumulados: ResultadoProjeto[] = [];
    // Lista local, mantida em paralelo ao localStorage, para não depender de
    // props ficarem defasadas entre uma commitagem e a próxima neste mesmo lote.
    const projetosAtualizados = [...projects];

    const taskId = registrar("revisao-geral", `Revisão geral (${idsSelecionados.length} projeto${idsSelecionados.length > 1 ? "s" : ""})`);

    for (let i = 0; i < idsSelecionados.length; i++) {
      if (canceladoRef.current || isCancelada(taskId)) break;
      const id = idsSelecionados[i];
      const indiceLocal = projetosAtualizados.findIndex((p) => p.id === id);
      const projetoAtual = projetosAtualizados[indiceLocal];
      setProgressoAtual({ indice: i + 1, total: idsSelecionados.length, titulo: projetoAtual.titulo || "(sem título)" });
      atualizar(taskId, { progresso: { indice: i + 1, total: idsSelecionados.length, etapaAtual: projetoAtual.titulo || "(sem título)" } });

      const scoreAntes = calcularScore(projetoAtual);
      const resultado = await lapidarProjeto(projetoAtual, {
        voltas: 1,
        onProgresso: (_v, etapaLapidacao) => {
          setProgressoAtual((atual) => (atual ? { ...atual, etapaAtual: etapaLapidacao } : atual));
          atualizar(taskId, { progresso: { indice: i + 1, total: idsSelecionados.length, etapaAtual: etapaLapidacao } });
        },
        cancelado: () => canceladoRef.current || isCancelada(taskId),
      });

      if (!resultado.ok || !resultado.projetoFinal) {
        resultadosAcumulados.push({ projectId: id, titulo: projetoAtual.titulo || "(sem título)", status: "pulado", erro: resultado.erro });
        continue;
      }

      const ultimaVolta = resultado.voltas[resultado.voltas.length - 1];
      const projetoComVersao = commitarVersaoLapidada(projetoAtual, resultado.projetoFinal, ultimaVolta?.changelog ?? []);
      projetosAtualizados[indiceLocal] = projetoComVersao;
      onAtualizarProjeto(projetoComVersao);
      resultadosAcumulados.push({
        projectId: id,
        titulo: projetoComVersao.titulo || "(sem título)",
        status: "ok",
        scoreAntes,
        scoreDepois: ultimaVolta?.scoreDepois,
      });
    }

    setResultados(resultadosAcumulados);
    setProgressoAtual(null);

    const houveSucesso = resultadosAcumulados.some((r) => r.status === "ok");
    if (houveSucesso && !canceladoRef.current) {
      setProgressoAtual({ indice: idsSelecionados.length, total: idsSelecionados.length, titulo: "Ecossistema", etapaAtual: undefined });
      const onProgressoPortfolio = (etapaAtual: EtapaPortfolio) =>
        setProgressoAtual((atual) => (atual ? { ...atual, etapaAtual: ETAPAS_PORTFOLIO_ROTULO[etapaAtual] } : atual));

      const resultadoEco = await lapidarEcossistema(projetosAtualizados, carregarAnaliseEcossistema(), onProgressoPortfolio);
      if (resultadoEco.ok && resultadoEco.analise) {
        salvarAnaliseEcossistema(resultadoEco.analise);
        setProgressoEcossistema("ok");
      } else {
        setProgressoEcossistema(projetosAtualizados.length < 2 ? "pulado" : "erro");
      }

      setProgressoAtual({ indice: idsSelecionados.length, total: idsSelecionados.length, titulo: "Clube de benefícios", etapaAtual: undefined });
      const resultadoClube = await lapidarClube(carregarClube(), projetosAtualizados, onProgressoPortfolio);
      if (resultadoClube.ok && resultadoClube.clube) {
        salvarClube(resultadoClube.clube);
        setProgressoClube("ok");
      } else {
        setProgressoClube("erro");
      }
    } else {
      setProgressoEcossistema("pulado");
      setProgressoClube("pulado");
    }

    setProgressoAtual(null);
    setEtapa("resultado");

    // Conclui a tarefa no TaskContext com um diff resumido.
    const okCount = resultadosAcumulados.filter((r) => r.status === "ok").length;
    if (okCount > 0) {
      const totalBloqueiosAntes = resultadosAcumulados.reduce((s, r) => s + (r.scoreAntes?.bloqueios ?? 0), 0);
      const totalBloqueiosDepois = resultadosAcumulados.reduce((s, r) => s + (r.scoreDepois?.bloqueios ?? 0), 0);
      const totalAtencoesAntes = resultadosAcumulados.reduce((s, r) => s + (r.scoreAntes?.atencoes ?? 0), 0);
      const totalAtencoesDepois = resultadosAcumulados.reduce((s, r) => s + (r.scoreDepois?.atencoes ?? 0), 0);
      concluir(taskId, undefined, `${okCount} projeto(s) · 🔴 ${totalBloqueiosAntes}→${totalBloqueiosDepois} · 🟡 ${totalAtencoesAntes}→${totalAtencoesDepois}`);
    } else {
      falhar(taskId, "Nenhum projeto pôde ser lapidado.");
    }
  }

  function cancelar() {
    canceladoRef.current = true;
  }

  const rotuloStatus: Record<"ok" | "erro" | "pendente" | "pulado", string> = {
    ok: "✅ atualizado",
    erro: "⚠ falhou (verifique o modelo de IA configurado)",
    pulado: "— não rodado",
    pendente: "…",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="max-h-[85vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">🔁 Revisão geral dos projetos</h2>
          <button onClick={onClose} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            fechar
          </button>
        </div>

        {etapa === "selecao" && (
          <div className="space-y-3">
            <p className="text-xs text-[color:var(--sm-text-dim)]">
              Roda 1 volta de lapidação em cada projeto selecionado (aplica automaticamente — reversível pelo histórico de versões), e depois atualiza o ecossistema e o clube de benefícios com a lista mais recente.
            </p>
            <div className="flex gap-2">
              <button onClick={selecionarTodos} className="rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]">
                ☑ Selecionar todos
              </button>
              <button onClick={limparSelecao} className="rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]">
                ☐ Limpar seleção
              </button>
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {projects.map((p) => {
                const arquetipo = arquetipos.find((a) => a.id === p.arquetipoId);
                return (
                  <li key={p.id}>
                    <label className="flex items-center gap-2 rounded border border-[color:var(--sm-border)] p-2 text-sm hover:border-[color:var(--sm-accent)]/50">
                      <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => alternarSelecao(p.id)} />
                      <span className="flex-1">
                        {p.titulo || "(sem título)"} <span className="text-xs text-[color:var(--sm-text-dim)]">— {arquetipo?.nome ?? "arquétipo não definido"}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
              {projects.length === 0 && <li className="text-sm text-[color:var(--sm-text-dim)]">Nenhum projeto cadastrado ainda.</li>}
            </ul>
            <button
              onClick={iniciar}
              disabled={selecionados.size === 0}
              className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-4 py-2 text-sm hover:bg-[color:var(--sm-accent)]/25 disabled:opacity-40"
            >
              Iniciar revisão ({selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"})
            </button>
          </div>
        )}

        {etapa === "executando" && (
          <div className="space-y-2 rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/5 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {progressoAtual ? `${progressoAtual.titulo}${progressoAtual.total ? ` (${progressoAtual.indice}/${progressoAtual.total})` : ""}` : "Finalizando..."}
              </p>
              <button onClick={cancelar} className="rounded border border-[color:var(--sm-red)] bg-[color:var(--sm-red)]/10 px-2 py-1 text-xs text-[color:var(--sm-red)] hover:bg-[color:var(--sm-red)]/20">
                ⏹ Parar
              </button>
            </div>
            {progressoAtual?.etapaAtual && <p className="text-xs text-[color:var(--sm-text-dim)]">{progressoAtual.etapaAtual}</p>}
            <ThinkingIndicator />
            <p className="text-xs text-[color:var(--sm-text-dim)]">A parada acontece assim que o passo atual terminar.</p>
          </div>
        )}

        {etapa === "resultado" && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Projetos ({resultados.filter((r) => r.status === "ok").length} de {resultados.length} aplicados)</p>
              <ul className="mt-1 space-y-1">
                {resultados.map((r) => (
                  <li key={r.projectId} className="rounded border border-[color:var(--sm-border)] p-2 text-xs">
                    <p>
                      {r.status === "ok" ? "✅" : "⚠"} <strong>{r.titulo}</strong>
                      {r.status === "ok" && r.scoreAntes && r.scoreDepois && (
                        <span className="text-[color:var(--sm-text-dim)]">
                          {" "}
                          — 🔴 {r.scoreAntes.bloqueios}→{r.scoreDepois.bloqueios} · 🟡 {r.scoreAntes.atencoes}→{r.scoreDepois.atencoes}
                        </span>
                      )}
                      {r.status !== "ok" && <span className="text-[color:var(--sm-red)]"> — pulado{r.erro ? `: ${r.erro}` : ""}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-sm">
              Ecossistema: {rotuloStatus[progressoEcossistema]} · Clube de benefícios: {rotuloStatus[progressoClube]}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={onAbrirEcossistema} className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-accent)]">
                Ver ecossistema
              </button>
              <button onClick={onAbrirClube} className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-accent)]">
                Ver clube
              </button>
              <button onClick={onClose} className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-xs hover:bg-[color:var(--sm-accent)]/25">
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
