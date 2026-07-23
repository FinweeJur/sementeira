import { useState } from "react";
import { ProviderSettings } from "./ProviderSettings";
import { ComparacaoModeloSettings } from "./ComparacaoModeloSettings";
import { TavilySettings } from "./TavilySettings";
import { DiretrizesGlobais } from "./DiretrizesGlobais";
import type { ProviderConfig } from "../lib/providers";
import { exportarConfiguracoes, importarConfiguracoes } from "../lib/settings-export";
import { carregarConfigLLM } from "../lib/providers";
import { Download, Upload } from "lucide-react";

export function SettingsModal({
  config,
  onChange,
  onFechar,
  focarModelo = false,
}: {
  config: ProviderConfig;
  onChange: (c: ProviderConfig) => void;
  onFechar: () => void;
  /** Chegou aqui por um atalho de "configure o modelo" — destaca a seção. */
  focarModelo?: boolean;
}) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
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
        {/* ProviderSettings já é o primeiro bloco do modal, então "focar o
            modelo" é só destacar — não precisa de rolagem nem de abas. */}
        <div className={focarModelo ? "rounded ring-2 ring-[color:var(--sm-accent)] ring-offset-2 ring-offset-[color:var(--sm-panel)]" : undefined}>
          <ProviderSettings key={`provider-${versaoImportacao}`} config={config} onChange={onChange} />
        </div>
        <ComparacaoModeloSettings key={`comparacao-${versaoImportacao}`} />
        <TavilySettings key={`tavily-${versaoImportacao}`} />
        <DiretrizesGlobais key={`diretrizes-${versaoImportacao}`} />

        <div className="space-y-2 rounded border border-[color:var(--sm-border)] p-3">
          <p className="text-sm font-medium">Exportar / Importar configurações</p>
          <p className="text-xs text-[color:var(--sm-text-dim)]">
            Baixa um arquivo com as chaves de acesso da IA (e da busca Tavily) e as diretrizes que você anexou — útil pra levar tudo de uma vez pra outro computador, sem digitar tudo de novo.
          </p>
          <div className="flex gap-2">
            <button
              onClick={exportarConfiguracoes}
              className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-accent)]"
            >
              <Download size={12} strokeWidth={2} />
              Exportar configurações
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-accent)]">
              <Upload size={12} strokeWidth={2} />
              Importar configurações
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
