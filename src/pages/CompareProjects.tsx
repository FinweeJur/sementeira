import { useState } from "react";
import type { Project } from "../lib/types";
import { avaliarConformidade } from "../lib/compliance-engine";
import { simularTodos, exigenciaPOS } from "../lib/simulator";
import { montarChecklistFinal } from "../lib/checklist";
import { Badge } from "../components/Badge";
import danos from "../data/danos.json";
import setores from "../data/setores.json";
import arquetipos from "../data/arquetipos.json";
import { X, Check } from "lucide-react";

function nomeArquetipo(id: string) {
  return arquetipos.find((a) => a.id === id)?.nome ?? id;
}
function nomeDano(id: string) {
  return danos.find((d) => d.id === id)?.nome ?? id;
}
function nomeSetor(id: string) {
  return setores.find((s) => s.id === id)?.nome ?? id;
}

export function CompareProjects({
  projects,
  onFechar,
}: {
  projects: Project[];
  onFechar: () => void;
}) {
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const adicionarProjeto = (id: string) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter((s) => s !== id));
    } else if (selecionados.length < 3) {
      setSelecionados([...selecionados, id]);
    }
  };

  const projetosParaComparar = projects.filter((p) => selecionados.includes(p.id));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center overflow-auto">
      <div
        className="rounded-lg shadow-xl max-w-7xl w-full mx-4 my-4 flex flex-col max-h-[90vh]"
        style={{ color: "var(--sm-text)", backgroundColor: "var(--sm-panel)" }}
      >
        <div className="flex justify-between items-center p-6 border-b" style={{ borderColor: "var(--sm-border)" }}>
          <h2 className="text-2xl font-bold">Comparação de Projetos</h2>
          <button
            onClick={onFechar}
            className="text-sm px-3 py-1 rounded hover:opacity-70"
            style={{ backgroundColor: "var(--sm-border)" }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {selecionados.length === 0 ? (
            <div className="text-center py-12">
              <p style={{ color: "var(--sm-text-dim)" }} className="mb-6">
                Selecione até 3 projetos abaixo para comparar lado a lado
              </p>
            </div>
          ) : null}

          {/* Seletor de projetos */}
          {selecionados.length < 3 && (
            <div className="mb-8">
              <h3 className="font-semibold mb-4">Adicionar projeto à comparação:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {projects
                  .filter((p) => !selecionados.includes(p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => adicionarProjeto(p.id)}
                      className="p-3 rounded border text-left hover:opacity-80 transition-opacity"
                      style={{
                        borderColor: "var(--sm-border)",
                        backgroundColor: "var(--sm-panel)",
                      }}
                    >
                      <div className="font-semibold text-sm">{p.titulo || "Sem título"}</div>
                      <div style={{ color: "var(--sm-text-dim)" }} className="text-xs">
                        {nomeArquetipo(p.arquetipoId)}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Tabela de comparação */}
          {projetosParaComparar.length > 0 && (
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse text-sm"
                style={{ borderColor: "var(--sm-border)" }}
              >
                <thead>
                  <tr style={{ backgroundColor: "var(--sm-panel)", borderBottom: "2px solid var(--sm-border)" }}>
                    <th className="p-3 text-left font-semibold">Aspecto</th>
                    {projetosParaComparar.map((p) => (
                      <th key={p.id} className="p-3 text-left font-semibold min-w-64">
                        <div className="flex items-center justify-between">
                          <div>
                            <div>{p.titulo || "Sem título"}</div>
                            <div style={{ color: "var(--sm-text-dim)" }} className="text-xs">
                              {nomeArquetipo(p.arquetipoId)}
                            </div>
                          </div>
                          <button
                            onClick={() => setSelecionados(selecionados.filter((s) => s !== p.id))}
                            className="ml-2 hover:opacity-70"
                          >
                            <X size={16} strokeWidth={2} />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Linha: Dano */}
                  <tr style={{ borderBottom: "1px solid var(--sm-border)" }}>
                    <td className="p-3 font-semibold">Dano</td>
                    {projetosParaComparar.map((p) => (
                      <td key={p.id} className="p-3">
                        {nomeDano(p.danoId)}
                      </td>
                    ))}
                  </tr>

                  {/* Linha: Local */}
                  <tr style={{ borderBottom: "1px solid var(--sm-border)" }}>
                    <td className="p-3 font-semibold">Local</td>
                    {projetosParaComparar.map((p) => (
                      <td key={p.id} className="p-3">
                        {p.local} ({p.abrangencia})
                      </td>
                    ))}
                  </tr>

                  {/* Linha: Público */}
                  <tr style={{ borderBottom: "1px solid var(--sm-border)" }}>
                    <td className="p-3 font-semibold">Público/Setor</td>
                    {projetosParaComparar.map((p) => (
                      <td key={p.id} className="p-3">
                        {nomeSetor(p.setorId)}
                      </td>
                    ))}
                  </tr>

                  {/* Linha: Orçamento total */}
                  <tr style={{ borderBottom: "1px solid var(--sm-border)" }}>
                    <td className="p-3 font-semibold">Orçamento total</td>
                    {projetosParaComparar.map((p) => (
                      <td key={p.id} className="p-3 font-mono">
                        R$ {p.orcamento.reduce((s, l) => s + l.valor, 0).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    ))}
                  </tr>

                  {/* Linha: Exigência de POS */}
                  <tr style={{ borderBottom: "1px solid var(--sm-border)" }}>
                    <td className="p-3 font-semibold">POS exigido</td>
                    {projetosParaComparar.map((p) => (
                      <td key={p.id} className="p-3">
                        {exigenciaPOS(p)}
                      </td>
                    ))}
                  </tr>

                  {/* Linha: Equipe */}
                  <tr style={{ borderBottom: "1px solid var(--sm-border)" }}>
                    <td className="p-3 font-semibold">Equipe</td>
                    {projetosParaComparar.map((p) => (
                      <td key={p.id} className="p-3">
                        <div className="text-sm">
                          {p.equipe.length} {p.equipe.length === 1 ? "pessoa" : "pessoas"}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Linha: Conformidade 🟢🟡🔴 */}
                  <tr style={{ borderBottom: "1px solid var(--sm-border)" }}>
                    <td className="p-3 font-semibold">Conformidade</td>
                    {projetosParaComparar.map((p) => {
                      const conf = avaliarConformidade(p);
                      const bloqueios = conf.filter((c) => c.severidade === "bloqueio").length;
                      return (
                        <td key={p.id} className="p-3">
                          {bloqueios > 0 ? (
                            <div
                              style={{
                                backgroundColor: "var(--sm-red)/20",
                                borderColor: "var(--sm-red)/40",
                                color: "var(--sm-red)",
                              }}
                              className="inline-block rounded border px-2 py-0.5 text-xs font-medium"
                            >
                              🔴 {bloqueios} {bloqueios === 1 ? "bloqueio" : "bloqueios"}
                            </div>
                          ) : (
                            <Badge severidade="ok" />
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Linha: Cenários (Realista) */}
                  <tr style={{ borderBottom: "1px solid var(--sm-border)" }}>
                    <td className="p-3 font-semibold">Cenário realista (mensal)</td>
                    {projetosParaComparar.map((p) => {
                      const sims = simularTodos(p);
                      const realista = sims.find((s) => s.cenario === "realista");
                      const saldo = realista?.saldoMensal ?? 0;
                      return (
                        <td key={p.id} className="p-3">
                          <div className="font-mono">
                            R$ {saldo.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div
                            style={{
                              color: saldo >= 0 ? "var(--sm-green)" : "var(--sm-red)",
                            }}
                            className="flex items-center gap-1 text-xs font-semibold"
                          >
                            {saldo >= 0 ? <Check size={12} strokeWidth={2} /> : <X size={12} strokeWidth={2} />}
                            {saldo >= 0 ? "Sustentável" : "Deficitário"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Linha: Pendências */}
                  <tr style={{ borderBottom: "1px solid var(--sm-border)" }}>
                    <td className="p-3 font-semibold">Pendências</td>
                    {projetosParaComparar.map((p) => {
                      const checklist = montarChecklistFinal(p, null);
                      const totalPendencias = checklist.pendencias.length;
                      return (
                        <td key={p.id} className="p-3">
                          <div className="flex items-center gap-1 text-sm">
                            {totalPendencias === 0 && <Check size={12} strokeWidth={2} />}
                            {totalPendencias === 0 ? "Nenhuma" : `${totalPendencias} itens`}
                          </div>
                          {totalPendencias > 0 && (
                            <div style={{ color: "var(--sm-text-dim)" }} className="text-xs mt-1">
                              {checklist.pendencias.slice(0, 2).map((p, i) => (
                                <div key={i}>• {p}</div>
                              ))}
                              {totalPendencias > 2 && <div>+ {totalPendencias - 2} mais</div>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
