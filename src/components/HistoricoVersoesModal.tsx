import { useState } from "react";
import type { Project } from "../lib/types";
import { reverterParaVersao } from "../lib/refinement-loop";
import { diffProjetos } from "../lib/project-diff";
import { ChevronDown, ChevronRight } from "lucide-react";

/** Histórico de versões lapidadas de um projeto — reverter nunca é destrutivo, sempre dá para voltar depois. */
export function HistoricoVersoesModal({ project, onReverter, onClose }: { project: Project; onReverter: (p: Project) => void; onClose: () => void }) {
  // Ordem cronológica (ascendente) pra achar, de cada versão guardada, o estado
  // seguinte — ou a entrada de versão+1, ou o próprio projeto atual quando não
  // há entrada mais nova. É o que permite comparar antes/depois de cada volta.
  const historicoAsc = [...(project.historicoVersoes ?? [])].sort((a, b) => a.versao - b.versao);
  const historico = historicoAsc.map((entrada, indiceAsc) => ({ entrada, indiceAsc })).reverse();
  const versaoAtual = project.versaoLapidacao ?? 0;
  const [expandido, setExpandido] = useState<number | null>(historico[0]?.entrada.versao ?? null);

  function estadoDepoisDe(indiceAsc: number): Project {
    const proximo = historicoAsc[indiceAsc + 1];
    return (proximo?.snapshot as Project) ?? project;
  }

  function reverter(versaoAlvo: number) {
    const revertido = reverterParaVersao(project, versaoAlvo);
    if (!revertido) return;
    onReverter(revertido);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[80vh] w-full max-w-md space-y-3 overflow-y-auto rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Histórico de versões — v{versaoAtual} atual</h2>
          <button onClick={onClose} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            fechar
          </button>
        </div>
        {historico.length === 0 ? (
          <p className="text-sm text-[color:var(--sm-text-dim)]">Nenhuma versão anterior registrada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {historico.map(({ entrada: v, indiceAsc }) => {
              const depois = estadoDepoisDe(indiceAsc);
              const mudancas = diffProjetos(v.snapshot as Project, depois);
              const aberto = expandido === v.versao;
              return (
                <li key={v.versao} className="rounded border border-[color:var(--sm-border)] p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      v{v.versao} → v{v.versao + 1}
                    </p>
                    <p className="text-xs text-[color:var(--sm-text-dim)]">{new Date(v.aplicadaEm).toLocaleString("pt-BR")}</p>
                  </div>
                  {v.changelog.length > 0 ? (
                    <ul className="list-disc pl-4 text-xs text-[color:var(--sm-text-dim)]">
                      {v.changelog.slice(0, 5).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[color:var(--sm-text-dim)]">Sem lista de mudanças registrada.</p>
                  )}

                  <button
                    onClick={() => setExpandido(aberto ? null : v.versao)}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-[color:var(--sm-accent)] hover:underline"
                  >
                    {aberto ? <ChevronDown size={12} strokeWidth={2} /> : <ChevronRight size={12} strokeWidth={2} />}
                    {mudancas.length > 0 ? `Ver o que mudou (${mudancas.length} campo${mudancas.length === 1 ? "" : "s"})` : "Nenhum campo comparável mudou"}
                  </button>
                  {aberto && mudancas.length > 0 && (
                    <div className="mt-1.5 space-y-1.5 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-bg)] p-2">
                      {mudancas.map((m) => (
                        <div key={m.rotulo} className="text-xs">
                          <p className="font-medium text-[color:var(--sm-text)]">{m.rotulo}</p>
                          <p className="text-[color:var(--sm-red)] line-through decoration-1 opacity-80">{m.antes}</p>
                          <p className="text-[color:var(--sm-green)]">{m.depois}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => reverter(v.versao)}
                    className="mt-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-2 py-1 text-xs hover:bg-[color:var(--sm-accent)]/25"
                  >
                    ↩ Voltar para esta versão
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
