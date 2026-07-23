import type { Project } from "../lib/types";
import { reverterParaVersao } from "../lib/refinement-loop";

/** Histórico de versões lapidadas de um projeto — reverter nunca é destrutivo, sempre dá para voltar depois. */
export function HistoricoVersoesModal({ project, onReverter, onClose }: { project: Project; onReverter: (p: Project) => void; onClose: () => void }) {
  const historico = [...(project.historicoVersoes ?? [])].sort((a, b) => b.versao - a.versao);
  const versaoAtual = project.versaoLapidacao ?? 0;

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
            {historico.map((v) => (
              <li key={v.versao} className="rounded border border-[color:var(--sm-border)] p-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">v{v.versao}</p>
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
                  onClick={() => reverter(v.versao)}
                  className="mt-1 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-2 py-1 text-xs hover:bg-[color:var(--sm-accent)]/25"
                >
                  ↩ Voltar para esta versão
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
