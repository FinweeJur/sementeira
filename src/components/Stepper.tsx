export interface PassoInfo {
  id: string;
  titulo: string;
  temBloqueio?: boolean;
}

export function Stepper({
  passos,
  atual,
  onIr,
}: {
  passos: PassoInfo[];
  atual: number;
  onIr: (indice: number) => void;
}) {
  const progresso = (atual + 1) / passos.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Broto progresso={progresso} />
        <span className="text-sm text-[color:var(--sm-text-dim)]">
          Passo {atual + 1} de {passos.length} · {passos[atual]?.titulo}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {passos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => onIr(i)}
            className={`rounded border px-2 py-1 text-xs sm-fade ${
              i === atual
                ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20"
                : "border-[color:var(--sm-border)] hover:border-[color:var(--sm-accent)]"
            }`}
          >
            {p.temBloqueio && <span className="mr-1">🔴</span>}
            {p.titulo}
          </button>
        ))}
      </div>
    </div>
  );
}

function Broto({ progresso }: { progresso: number }) {
  const escala = 0.6 + progresso * 0.5;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="sm-sprout shrink-0" style={{ transform: `scale(${escala})` }}>
      <path d="M10 18 V10" stroke="var(--sm-accent)" strokeWidth="1.5" />
      <path d="M10 10 C6 10 5 6 5 4 C8 4 10 6 10 10Z" fill="var(--sm-accent)" opacity={Math.min(1, progresso + 0.3)} />
      <path d="M10 10 C14 10 15 6 15 4 C12 4 10 6 10 10Z" fill="var(--sm-accent)" opacity={Math.min(1, progresso + 0.5)} />
    </svg>
  );
}
