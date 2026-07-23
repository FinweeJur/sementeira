export function ConfirmDialog({
  titulo,
  mensagem,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  mensagem: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm-fade"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancelar();
      }}
    >
      <div className="w-full max-w-sm rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-4 space-y-3">
        <h2 className="text-base font-semibold">{titulo}</h2>
        <p className="text-sm text-[color:var(--sm-text-dim)]">{mensagem}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancelar} className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)]">
            Cancelar
          </button>
          <button onClick={onConfirmar} className="rounded border border-[color:var(--sm-red)] bg-[color:var(--sm-red)]/20 px-3 py-1.5 text-sm text-[color:var(--sm-red)] hover:bg-[color:var(--sm-red)]/30">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
