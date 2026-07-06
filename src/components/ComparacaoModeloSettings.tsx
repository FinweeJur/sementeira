import { useState } from "react";
import { carregarConfigComparacao, salvarConfigComparacao, type ProviderConfig } from "../lib/providers";
import { ProviderSettings } from "./ProviderSettings";

const CONFIG_VAZIA: ProviderConfig = { providerId: "deepseek" };

/**
 * Configura um SEGUNDO provedor de IA opcional (Fase 11b), usado só para
 * comparar as respostas do Crítico/Compilador entre dois modelos lado a lado
 * na lapidação — nunca substitui o provedor principal do Copiloto.
 */
export function ComparacaoModeloSettings() {
  const [config, setConfig] = useState<ProviderConfig | null>(() => carregarConfigComparacao());
  const ativo = config !== null;

  function alternar(ligar: boolean) {
    if (ligar) {
      const novo = CONFIG_VAZIA;
      setConfig(novo);
      salvarConfigComparacao(novo);
    } else {
      setConfig(null);
      salvarConfigComparacao(null);
    }
  }

  function atualizar(c: ProviderConfig) {
    setConfig(c);
    salvarConfigComparacao(c);
  }

  return (
    <div className="space-y-2 rounded border border-[color:var(--sm-border)] p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={ativo} onChange={(e) => alternar(e.target.checked)} />
        Comparar Crítico/Compilador com um 2º modelo (opcional)
      </label>
      <p className="text-xs text-[color:var(--sm-text-dim)]">
        Quando ativado, a lapidação roda o Crítico e o Compilador também com este segundo provedor, e mostra as duas versões lado a lado para você escolher/mesclar. Aumenta o tempo/custo da lapidação.
      </p>
      {ativo && config && <ProviderSettings config={config} onChange={atualizar} />}
    </div>
  );
}
