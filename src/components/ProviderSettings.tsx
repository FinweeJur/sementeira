import { useEffect, useState } from "react";
import { PROVEDORES, configuracaoLLMPronta, provedoresDisponiveis, listarModelosOllamaLocal, type ProviderConfig } from "../lib/providers";
import { consultarSaudeServidor, type SaudeServidor } from "../lib/llm-web";
import { ehWeb } from "../lib/ambiente";
import { Field, inputClass } from "./Field";
import { RefreshCw, Check, X } from "lucide-react";

const OUTRO = "__outro__";

/** Provedores que o SERVIDOR pode usar — o navegador manda só o id, nunca endereço nem chave. */
const PROVEDORES_NO_SERVIDOR = [
  { id: "deepseek", nome: "DeepSeek" },
  { id: "maritaca", nome: "Maritaca / Sabiá" },
  { id: "ollama", nome: "Ollama (no servidor)" },
];

export function ProviderSettings({ config, onChange }: { config: ProviderConfig; onChange: (c: ProviderConfig) => void }) {
  const def = PROVEDORES.find((p) => p.id === config.providerId);
  const ehOllama = def?.kind === "ollama";
  const ehGateway = def?.kind === "gateway";
  const baseUrlEfetiva = config.baseUrl || def?.baseUrlDefault || "";
  const opcoes = provedoresDisponiveis();
  const situacao = configuracaoLLMPronta(config);

  const [saude, setSaude] = useState<SaudeServidor | null>(null);
  const [testando, setTestando] = useState(false);

  async function testarServidor() {
    setTestando(true);
    setSaude(await consultarSaudeServidor(config.baseUrl ?? ""));
    setTestando(false);
  }

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
      <Field
        label="Provedor de IA"
        hint={
          ehWeb()
            ? "Ollama roda no seu computador. DeepSeek precisa de chave e internet. O Servidor da Sementeira usa a chave de quem hospeda — só precisa do token."
            : "Ollama roda no seu computador e funciona sem internet. DeepSeek e Maritaca exigem chave de acesso e internet."
        }
      >
        <select
          className={inputClass}
          value={config.providerId}
          onChange={(e) => {
            onChange({ providerId: e.target.value });
            setModoLivre(false);
            setSaude(null);
          }}
        >
          {opcoes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
              {/* A Maritaca aparece na lista, mas com o motivo à vista — esconder
                  faria a pessoa procurar por uma opção que ela sabe que existe. */}
              {ehWeb() && p.corsNavegador === "bloqueado" ? " — só no programa instalado" : ""}
            </option>
          ))}
        </select>
      </Field>

      {!situacao.pronta && situacao.motivo && (
        <p className="rounded border border-[color:var(--sm-yellow)]/50 bg-[color:var(--sm-yellow)]/10 p-2 text-xs">{situacao.motivo}</p>
      )}

      {def?.precisaApiKey && (
        <Field
          label={ehGateway ? "Token de acesso ao servidor" : "Chave de acesso"}
          hint={ehGateway ? "Fornecido por quem hospeda o servidor. As chaves dos provedores ficam lá, nunca no seu navegador." : def.docsUrl ? `Obtenha em ${def.docsUrl}` : undefined}
        >
          <input
            type="password"
            className={inputClass}
            value={config.apiKey ?? ""}
            onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
          />
        </Field>
      )}

      {ehGateway && (
        <>
          <Field label="Qual IA o servidor deve usar" hint="Escolha entre os provedores configurados por quem hospeda.">
            <select
              className={inputClass}
              value={config.provedorNoServidor ?? "deepseek"}
              onChange={(e) => onChange({ ...config, provedorNoServidor: e.target.value })}
            >
              {PROVEDORES_NO_SERVIDOR.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {saude?.provedores && saude.provedores[p.id] === false ? " — sem chave no servidor" : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={testarServidor}
              disabled={testando}
              className="rounded border border-[color:var(--sm-border)] px-2 py-1 hover:border-[color:var(--sm-accent)] disabled:opacity-40"
            >
              {testando ? "testando..." : "testar conexão"}
            </button>
            {saude && (
              <span className={`inline-flex items-center gap-1 ${saude.ok ? "text-[color:var(--sm-green)]" : "text-[color:var(--sm-red)]"}`}>
                {saude.ok ? <Check size={13} strokeWidth={2.5} /> : <X size={13} strokeWidth={2.5} />}
                {saude.ok
                  ? `servidor no ar — ${Object.entries(saude.provedores ?? {}).filter(([, tem]) => tem).map(([id]) => id).join(", ") || "nenhum provedor configurado"}`
                  : saude.erro}
              </span>
            )}
          </div>
        </>
      )}

      {ehOllama && ehWeb() && (
        <div className="rounded border border-[color:var(--sm-border)] p-2 text-xs text-[color:var(--sm-text-dim)]">
          <p className="font-medium text-[color:var(--sm-text)]">Para o Ollama funcionar pelo navegador</p>
          <p className="mt-1">
            O navegador vai pedir permissão para acessar programas do seu computador — aceite. E o Ollama precisa autorizar este site: feche-o e abra de
            novo com a variável abaixo.
          </p>
          <code className="mt-1 block overflow-x-auto rounded bg-[color:var(--sm-bg)] p-1.5">OLLAMA_ORIGINS={window.location.origin}</code>
        </div>
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
          <button
            type="button"
            onClick={detectarModelosOllama}
            disabled={detectando}
            className="inline-flex items-center gap-1 text-[color:var(--sm-accent)] hover:underline disabled:opacity-40"
          >
            <RefreshCw size={12} strokeWidth={2} />
            atualizar lista
          </button>
        </div>
      )}

      <Field
        label="Modelo"
        hint={
          ehGateway
            ? "Deixe em branco para usar o modelo padrão do servidor."
            : ehOllama
              ? "Detectado a partir dos modelos que você já baixou no Ollama."
              : `Padrão: ${def?.modeloDefault}`
        }
      >
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
      <Field
        label={ehGateway ? "Endereço do servidor" : "Endereço do servidor (avançado)"}
        hint={ehGateway ? "Deixe em branco se você abriu o app pelo endereço do próprio servidor — que é o caso normal." : `Padrão: ${def?.baseUrlDefault}`}
      >
        <input
          className={inputClass}
          placeholder={ehGateway ? "mesmo endereço desta página" : def?.baseUrlDefault}
          value={config.baseUrl ?? ""}
          onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
        />
      </Field>
    </div>
  );
}
