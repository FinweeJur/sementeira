import { useEffect, useState } from "react";
import { PROVEDORES, listarModelosOllamaLocal, type ProviderConfig } from "../lib/providers";
import { Field, inputClass } from "./Field";

const OUTRO = "__outro__";

export function ProviderSettings({ config, onChange }: { config: ProviderConfig; onChange: (c: ProviderConfig) => void }) {
  const def = PROVEDORES.find((p) => p.id === config.providerId);
  const ehOllama = def?.kind === "ollama";
  const baseUrlEfetiva = config.baseUrl || def?.baseUrlDefault || "";

  const [modelosOllama, setModelosOllama] = useState<string[]>([]);
  const [detectando, setDetectando] = useState(false);
  const [erroDeteccao, setErroDeteccao] = useState<string | null>(null);

  const modelosDisponiveis = ehOllama ? modelosOllama : def?.modelosSugeridos ?? [];
  const modeloAtual = config.model || def?.modeloDefault || "";
  const ehSugerido = modelosDisponiveis.includes(modeloAtual);
  const [modoLivre, setModoLivre] = useState(!ehSugerido);

  async function detectarModelosOllama() {
    setDetectando(true);
    setErroDeteccao(null);
    const resposta = await listarModelosOllamaLocal(baseUrlEfetiva);
    setDetectando(false);
    if (!resposta.ok) {
      setErroDeteccao(resposta.erro ?? "Não foi possível detectar os modelos do Ollama.");
      setModelosOllama([]);
      setModoLivre(true);
      return;
    }
    setModelosOllama(resposta.modelos ?? []);
    setModoLivre(false);
    // Se não há modelo selecionado ainda, já escolhe o primeiro detectado.
    if (!config.model && resposta.modelos && resposta.modelos.length > 0) {
      onChange({ ...config, model: resposta.modelos[0] });
    }
  }

  useEffect(() => {
    if (ehOllama) detectarModelosOllama();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.providerId, config.baseUrl]);

  return (
    <div className="space-y-3 rounded border border-[color:var(--sm-border)] p-3">
      <Field label="Provedor de IA" hint="Ollama roda local e funciona offline. DeepSeek e Maritaca exigem chave de API e internet.">
        <select
          className={inputClass}
          value={config.providerId}
          onChange={(e) => {
            onChange({ providerId: e.target.value });
            setModoLivre(false);
          }}
        >
          {PROVEDORES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </Field>
      {def?.precisaApiKey && (
        <Field label="Chave de API" hint={def.docsUrl ? `Obtenha em ${def.docsUrl}` : undefined}>
          <input
            type="password"
            className={inputClass}
            value={config.apiKey ?? ""}
            onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
          />
        </Field>
      )}

      {ehOllama && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-[color:var(--sm-text-dim)]">
            {detectando
              ? "Detectando modelos instalados no Ollama..."
              : modelosOllama.length > 0
                ? `${modelosOllama.length} modelo(s) detectado(s) automaticamente.`
                : erroDeteccao
                  ? erroDeteccao
                  : "Nenhum modelo detectado ainda."}
          </span>
          <button type="button" onClick={detectarModelosOllama} disabled={detectando} className="text-[color:var(--sm-accent)] hover:underline disabled:opacity-40">
            🔄 atualizar lista
          </button>
        </div>
      )}

      <Field label="Modelo" hint={ehOllama ? "Detectado a partir dos modelos que você já baixou (equivalente a `ollama list`)." : `Padrão: ${def?.modeloDefault}`}>
        {modoLivre || modelosDisponiveis.length === 0 ? (
          <div className="flex gap-2">
            <input className={inputClass} placeholder={def?.modeloDefault} value={config.model ?? ""} onChange={(e) => onChange({ ...config, model: e.target.value })} />
            {modelosDisponiveis.length > 0 && (
              <button type="button" className="shrink-0 text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]" onClick={() => setModoLivre(false)}>
                usar lista
              </button>
            )}
          </div>
        ) : (
          <select
            className={inputClass}
            value={modelosDisponiveis.includes(modeloAtual) ? modeloAtual : OUTRO}
            onChange={(e) => {
              if (e.target.value === OUTRO) {
                setModoLivre(true);
              } else {
                onChange({ ...config, model: e.target.value });
              }
            }}
          >
            {modelosDisponiveis.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={OUTRO}>Outro (digitar)...</option>
          </select>
        )}
      </Field>
      <Field label="Endereço do servidor (avançado)" hint={`Padrão: ${def?.baseUrlDefault}`}>
        <input className={inputClass} placeholder={def?.baseUrlDefault} value={config.baseUrl ?? ""} onChange={(e) => onChange({ ...config, baseUrl: e.target.value })} />
      </Field>
    </div>
  );
}
