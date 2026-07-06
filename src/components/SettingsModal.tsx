import { useState } from "react";
import { ProviderSettings } from "./ProviderSettings";
import { ComparacaoModeloSettings } from "./ComparacaoModeloSettings";
import { TavilySettings } from "./TavilySettings";
import { DiretrizesGlobais } from "./DiretrizesGlobais";
import type { ProviderConfig } from "../lib/providers";
import { exportarConfiguracoes, importarConfiguracoes } from "../lib/settings-export";
import { carregarConfigLLM } from "../lib/providers";

export function SettingsModal({ config, onChange, onFechar }: { config: ProviderConfig; onChange: (c: ProviderConfig) => void; onFechar: () => void }) {
  const [erroImportacao, setErroImportacao] = useState<string | null>(null);
  const [importado, setImportado] = useState(false);
  const [versaoImportacao, setVersaoImportacao] = useState(0);

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErroImportacao(null);
    setImportado(false);
    const resultado = await importarConfiguracoes(arquivo);
    if (!resultado.ok) {
      setErroImportacao(resultado.erro ?? "Falha ao importar.");
      return;
    }
    onChange(carregarConfigLLM()); // recarrega o llmConfig do App.tsx a partir do que acabou de ser importado
    setVersaoImportacao((v) => v + 1); // força ProviderSettings/TavilySettings/DiretrizesGlobais a remontar e reler do localStorage
    setImportado(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onKeyDown={(e) => {
        if (e.key === "Escape") onFechar();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Configurações — modelo de IA</h2>
          <button onClick={onFechar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            fechar
          </button>
        </div>
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          Escolha aqui qual provedor de inteligência artificial o Copiloto vai usar dentro dos projetos.
        </p>
        <ProviderSettings key={`provider-${versaoImportacao}`} config={config} onChange={onChange} />
        <ComparacaoModeloSettings key={`comparacao-${versaoImportacao}`} />
        <TavilySettings key={`tavily-${versaoImportacao}`} />
        <DiretrizesGlobais key={`diretrizes-${versaoImportacao}`} />

        <div className="space-y-2 rounded border border-[color:var(--sm-border)] p-3">
          <p className="text-sm font-medium">Exportar / Importar configurações</p>
          <p className="text-xs text-[color:var(--sm-text-dim)]">
            Baixa um .json com as chaves de API (LLM + Tavily) e as diretrizes gerais anexadas — útil para levar tudo de uma vez ao trocar de instalação (dev↔instalado, reinstalação, outra máquina), sem redigitar nada.
          </p>
          <div className="flex gap-2">
            <button onClick={exportarConfiguracoes} className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-accent)]">
              ⬇ Exportar configurações
            </button>
            <label className="cursor-pointer rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-accent)]">
              ⬆ Importar configurações
              <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportar} />
            </label>
          </div>
          {importado && <p className="text-xs text-[color:var(--sm-green)]">Configurações importadas com sucesso.</p>}
          {erroImportacao && <p className="text-xs text-[color:var(--sm-red)]">{erroImportacao}</p>}
        </div>
      </div>
    </div>
  );
}
