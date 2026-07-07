import { useMemo, useState } from "react";
import type { Project } from "../lib/types";
import { PORTE_POR_ABRANGENCIA } from "../lib/types";
import { avaliarConformidade } from "../lib/compliance-engine";
import { simularTodos, exigenciaPOS } from "../lib/simulator";
import { mesAtualDoProjeto } from "../lib/acompanhamento";
import arquetipos from "../data/arquetipos.json";

const CORES_CENARIO: Record<string, string> = { otimista: "var(--sm-green)", realista: "var(--sm-text)", pessimista: "var(--sm-red)" };

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <tr className="border-t border-[color:var(--sm-border)]">
      <td className="sticky left-0 bg-[color:var(--sm-panel)] py-2 pr-3 text-xs font-medium text-[color:var(--sm-text-dim)]">{rotulo}</td>
      {children}
    </tr>
  );
}

/** Comparação lado a lado de 2+ projetos — pendência antiga da Fase 2 (item 7). */
export function CompareProjects({ projects, onVoltar, onAbrirProjeto }: { projects: Project[]; onVoltar: () => void; onAbrirProjeto: (id: string) => void }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const comparados = useMemo(() => projects.filter((p) => selecionados.has(p.id)), [projects, selecionados]);

  const dados = useMemo(
    () =>
      comparados.map((p) => {
        const totalOrcamento = p.orcamento.reduce((s, l) => s + l.valor, 0);
        const conformidade = avaliarConformidade(p);
        const bloqueios = conformidade.filter((f) => f.severidade === "bloqueio").length;
        const atencoes = conformidade.filter((f) => f.severidade === "atencao").length;
        const simulacoes = simularTodos(p);
        const porte = PORTE_POR_ABRANGENCIA[p.abrangencia];
        const mes = mesAtualDoProjeto(p);
        const arquetipo = arquetipos.find((a) => a.id === p.arquetipoId);
        return { project: p, totalOrcamento, bloqueios, atencoes, simulacoes, porte, mes, arquetipo };
      }),
    [comparados],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <button onClick={onVoltar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
          ← Meus projetos
        </button>
        <h1 className="text-xl font-bold">⚖ Comparar projetos</h1>
      </div>

      <div className="flex flex-wrap gap-2 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-3">
        {projects.map((p) => (
          <label key={p.id} className="flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]/50">
            <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => alternar(p.id)} />
            {p.titulo || "(sem título)"}
          </label>
        ))}
        {projects.length === 0 && <p className="text-sm text-[color:var(--sm-text-dim)]">Nenhum projeto cadastrado ainda.</p>}
      </div>

      {dados.length < 2 && <p className="text-sm text-[color:var(--sm-text-dim)]">Selecione pelo menos 2 projetos para comparar.</p>}

      {dados.length >= 2 && (
        <div className="overflow-x-auto rounded border border-[color:var(--sm-border)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-[color:var(--sm-panel)] py-2 pr-3 text-left text-xs text-[color:var(--sm-text-dim)]"> </th>
                {dados.map((d) => (
                  <th key={d.project.id} className="min-w-[220px] px-3 py-2 text-left">
                    <button onClick={() => onAbrirProjeto(d.project.id)} className="font-semibold hover:text-[color:var(--sm-accent)]">
                      {d.project.titulo || "(sem título)"}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Linha rotulo="Arquétipo">
                {dados.map((d) => (
                  <td key={d.project.id} className="px-3 py-2">
                    {d.arquetipo?.nome ?? "-"}
                  </td>
                ))}
              </Linha>
              <Linha rotulo="Porte / abrangência">
                {dados.map((d) => (
                  <td key={d.project.id} className="px-3 py-2">
                    {d.porte} ({d.project.abrangencia})
                  </td>
                ))}
              </Linha>
              <Linha rotulo="Orçamento total">
                {dados.map((d) => (
                  <td key={d.project.id} className="px-3 py-2">
                    R$ {d.totalOrcamento.toFixed(2)}
                  </td>
                ))}
              </Linha>
              <Linha rotulo="Conformidade">
                {dados.map((d) => (
                  <td key={d.project.id} className="px-3 py-2">
                    <span className={d.bloqueios > 0 ? "text-[color:var(--sm-red)]" : "text-[color:var(--sm-green)]"}>🔴 {d.bloqueios}</span>{" "}
                    <span className="text-[color:var(--sm-yellow)]">🟡 {d.atencoes}</span>
                  </td>
                ))}
              </Linha>
              {(["otimista", "realista", "pessimista"] as const).map((nome) => (
                <Linha key={nome} rotulo={`Saldo mensal — ${nome}`}>
                  {dados.map((d) => {
                    const sim = d.simulacoes.find((s) => s.cenario === nome);
                    return (
                      <td key={d.project.id} className="px-3 py-2" style={{ color: sim && sim.saldoMensal < 0 ? "var(--sm-red)" : CORES_CENARIO[nome] }}>
                        {sim ? `R$ ${sim.saldoMensal.toFixed(2)}/mês${sim.autossustentavel ? " ✓" : ""}` : "-"}
                      </td>
                    );
                  })}
                </Linha>
              ))}
              <Linha rotulo="Exigência de POS">
                {dados.map((d) => (
                  <td key={d.project.id} className="px-3 py-2">
                    {exigenciaPOS(d.project)}
                  </td>
                ))}
              </Linha>
              <Linha rotulo="Equipe">
                {dados.map((d) => (
                  <td key={d.project.id} className="px-3 py-2">
                    {d.project.equipe.length} pessoa(s)
                  </td>
                ))}
              </Linha>
              <Linha rotulo="Indicadores (marco lógico)">
                {dados.map((d) => (
                  <td key={d.project.id} className="px-3 py-2">
                    {d.project.indicadores?.length ?? 0}
                  </td>
                ))}
              </Linha>
              <Linha rotulo="Versão / status">
                {dados.map((d) => (
                  <td key={d.project.id} className="px-3 py-2">
                    v{d.project.versaoLapidacao ?? 0}
                    {d.mes != null ? ` · mês ${d.mes} de implantação` : " · não iniciado"}
                  </td>
                ))}
              </Linha>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
