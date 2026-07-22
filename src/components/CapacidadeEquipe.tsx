import { Users } from "lucide-react";
import type { EquipeMembro } from "../lib/types";
import { eficienciaEfetiva } from "../lib/capacidade-equipe";

export function CapacidadeEquipe({ equipe }: { equipe: EquipeMembro[] }) {
  const pessoasComHoras = equipe.filter((m) => (m.horasSemanais ?? 0) > 0);
  const n = pessoasComHoras.length;

  if (n === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[color:var(--sm-border)] p-3 text-xs text-[color:var(--sm-text-dim)]">
        Preencha "Horas/semana" nas pessoas da equipe acima pra ver uma estimativa de capacidade real de produção.
      </div>
    );
  }

  const horasNominais = pessoasComHoras.reduce((s, m) => s + (m.horasSemanais ?? 0), 0);
  const eficiencia = eficienciaEfetiva(n);
  const horasUteis = horasNominais * eficiencia;
  const maxBarra = Math.max(10, n + 2);

  return (
    <div className="sm-card space-y-3 rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-4">
      <div className="flex items-center gap-2">
        <Users size={18} strokeWidth={2} className="text-[color:var(--sm-accent)]" />
        <p className="font-medium">Capacidade real de produção (estimativa)</p>
      </div>
      <p className="text-xs text-[color:var(--sm-text-dim)]">
        Mais gente não produz proporcionalmente mais — parte do tempo vira coordenação, reunião e ajuste. É uma estimativa pra te ajudar a planejar, não é regra do acordo nem parte do motor de conformidade.
      </p>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold">{n}</p>
          <p className="text-xs text-[color:var(--sm-text-dim)]">{n === 1 ? "pessoa" : "pessoas"}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{horasNominais}h</p>
          <p className="text-xs text-[color:var(--sm-text-dim)]">nominal/semana</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-[color:var(--sm-accent)]">{horasUteis.toFixed(0)}h</p>
          <p className="text-xs text-[color:var(--sm-text-dim)]">útil real/semana</p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-[color:var(--sm-text-dim)]">
          <span>Eficiência por pessoa nesta equipe</span>
          <span>{(eficiencia * 100).toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[color:var(--sm-border)]">
          <div className="h-full rounded-full bg-[color:var(--sm-accent)]" style={{ width: `${eficiencia * 100}%` }} />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-[color:var(--sm-text-dim)]">Como a eficiência cai conforme o time cresce (mesmas horas/pessoa, mais gente)</p>
        <div className="flex h-16 items-end gap-1">
          {Array.from({ length: maxBarra }, (_, i) => i + 1).map((tamanho) => {
            const ef = eficienciaEfetiva(tamanho);
            const atual = tamanho === n;
            return (
              <div key={tamanho} className="flex flex-1 flex-col items-center gap-0.5" title={`${tamanho} pessoa(s): ${(ef * 100).toFixed(0)}% de eficiência`}>
                <div
                  className="w-full rounded-t transition-[height]"
                  style={{ height: `${ef * 56}px`, background: atual ? "var(--sm-accent)" : "var(--sm-border)" }}
                />
                <span className={`text-[10px] ${atual ? "font-bold text-[color:var(--sm-accent)]" : "text-[color:var(--sm-text-dim)]"}`}>{tamanho}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
