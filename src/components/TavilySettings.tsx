import { useState } from "react";
import { carregarConfigTavily, salvarConfigTavily } from "../lib/websearch";
import { Field, inputClass } from "./Field";

export function TavilySettings() {
  const [config, setConfig] = useState(carregarConfigTavily());

  function atualizar(apiKey: string) {
    const novo = { apiKey };
    setConfig(novo);
    salvarConfigTavily(novo);
  }

  return (
    <div className="space-y-2 rounded border border-[color:var(--sm-border)] p-3">
      <p className="text-sm font-medium">Busca web (Deep Research)</p>
      <p className="text-xs text-[color:var(--sm-text-dim)]">
        Usada para pesquisar dados públicos (justificativa), preços de mercado (orçamento) e políticas de fomento (arrecadação). Exige internet — sem chave, esses campos ficam manuais.
      </p>
      <Field label="Chave da API Tavily" hint="Obtenha em tavily.com — tem plano gratuito.">
        <input type="password" className={inputClass} value={config.apiKey ?? ""} onChange={(e) => atualizar(e.target.value)} />
      </Field>
    </div>
  );
}
