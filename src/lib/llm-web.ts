import type { ChatMessage, LLMResponse, ListarModelosResposta, ProviderConfig, ProviderDef, WebSearchResposta } from "./providers";

/**
 * Transporte de IA para a versão web. No app instalado quem faz a chamada é o
 * processo main do Electron (via IPC); aqui é o próprio navegador.
 *
 * Três caminhos, porque nem todo provedor pode ser chamado direto do navegador
 * (verificado por preflight CORS real em 2026-07-23):
 *
 *  - DeepSeek e Tavily respondem ao preflight ecoando a origem → chamada direta;
 *  - Maritaca responde `400 Disallowed CORS origin` → só pelo gateway;
 *  - Ollama roda na máquina de quem acessa → chamada direta a 127.0.0.1, com as
 *    ressalvas descritas em `MENSAGEM_OLLAMA`.
 */

/** URL base do servidor. Vazia = mesma origem (o caso normal, servido pelo próprio gateway). */
function urlServidor(config: ProviderConfig): string {
  return (config.baseUrl ?? "").trim().replace(/\/+$/, "");
}

/**
 * Falha de rede ao chamar o Ollama tem três causas possíveis e o navegador
 * entrega exatamente o mesmo `TypeError` nas três — não há como distinguir por
 * código. Em vez de adivinhar, a mensagem lista as três com o que fazer em cada
 * uma, na ordem em que costumam acontecer.
 */
const MENSAGEM_OLLAMA = [
  "Não foi possível falar com o Ollama nesta máquina. São três as causas possíveis:",
  "",
  "1. O Ollama não está aberto — abra o programa, ou rode `ollama serve`.",
  "2. O navegador pediu permissão para acessar a rede local e ela foi negada — recarregue a página e aceite o pedido.",
  '3. O Ollama ainda não autoriza este site. Feche o Ollama e abra de novo com a variável `OLLAMA_ORIGINS` valendo o endereço deste site.',
].join("\n");

/** Erro de rede vindo de um provedor na internet: distinguir "sem internet" de "provedor recusou" ajuda de verdade. */
function mensagemDeFalhaDeRede(nomeProvedor: string): string {
  return `Não foi possível falar com ${nomeProvedor}. Verifique sua conexão com a internet; se ela estiver boa, o provedor pode estar fora do ar ou recusando pedidos vindos do navegador.`;
}

async function chamarOpenAiCompativel(
  def: ProviderDef,
  config: ProviderConfig,
  messages: ChatMessage[],
  esperaJson: boolean,
): Promise<LLMResponse> {
  const base = (config.baseUrl || def.baseUrlDefault).replace(/\/+$/, "");
  const corpo: Record<string, unknown> = { model: config.model || def.modeloDefault, messages };
  if (esperaJson) corpo.response_format = { type: "json_object" };

  let resp: Response;
  try {
    resp = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey ?? ""}` },
      body: JSON.stringify(corpo),
    });
  } catch {
    return { ok: false, erro: mensagemDeFalhaDeRede(def.nome) };
  }
  if (resp.status === 401 || resp.status === 403) {
    return { ok: false, erro: `A chave de acesso do ${def.nome} foi recusada. Confira a chave nas Configurações.` };
  }
  if (!resp.ok) return { ok: false, erro: `${def.nome} respondeu ${resp.status}: ${await resp.text()}` };

  const data = await resp.json();
  return { ok: true, conteudo: data.choices?.[0]?.message?.content ?? "" };
}

async function chamarOllama(config: ProviderConfig, def: ProviderDef, messages: ChatMessage[], esperaJson: boolean): Promise<LLMResponse> {
  const base = (config.baseUrl || def.baseUrlDefault).replace(/\/+$/, "");
  const corpo: Record<string, unknown> = { model: config.model || def.modeloDefault, messages, stream: false };
  if (esperaJson) {
    corpo.format = "json";
    corpo.options = { num_ctx: 8192, num_predict: 2048 };
  }

  let resp: Response;
  try {
    resp = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    return { ok: false, erro: MENSAGEM_OLLAMA };
  }
  if (resp.status === 404) {
    return {
      ok: false,
      erro: `O modelo "${config.model}" não está baixado neste computador. Rode \`ollama pull ${config.model}\` no terminal, ou escolha outro modelo nas Configurações.`,
    };
  }
  if (!resp.ok) return { ok: false, erro: `Ollama respondeu ${resp.status}: ${await resp.text()}` };

  const data = await resp.json();
  return { ok: true, conteudo: data.message?.content ?? "" };
}

async function chamarGateway(config: ProviderConfig, messages: ChatMessage[], esperaJson: boolean): Promise<LLMResponse> {
  let resp: Response;
  try {
    resp = await fetch(`${urlServidor(config)}/api/llm/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sementeira-Token": config.apiKey ?? "" },
      body: JSON.stringify({
        // O servidor resolve o endereço e a chave a partir deste id — o
        // navegador nunca manda URL nem chave, senão o gateway viraria um
        // proxy aberto para qualquer host.
        providerId: config.provedorNoServidor || "deepseek",
        model: config.model || undefined,
        messages,
        esperaJson,
      }),
    });
  } catch {
    return { ok: false, erro: "O servidor da Sementeira não respondeu. Ele pode estar desligado no momento — tente de novo mais tarde, ou use uma chave própria nas Configurações." };
  }
  if (resp.status === 401) {
    return { ok: false, erro: "O token de acesso ao servidor foi recusado. Confira o token nas Configurações." };
  }
  const data = await resp.json().catch(() => null);
  if (!data) return { ok: false, erro: `O servidor respondeu ${resp.status} em formato inesperado.` };
  return data as LLMResponse;
}

/** Ponto de entrada: escolhe o caminho conforme o provedor configurado. */
export async function enviarMensagemLLMNoNavegador(
  def: ProviderDef,
  config: ProviderConfig,
  messages: ChatMessage[],
  esperaJson: boolean,
): Promise<LLMResponse> {
  if (def.id === "gateway") return chamarGateway(config, messages, esperaJson);
  if (def.kind === "ollama") return chamarOllama(config, def, messages, esperaJson);
  if (def.corsNavegador === "bloqueado") {
    return {
      ok: false,
      erro: `${def.nome} não aceita ser chamado direto do navegador. Para usar aqui, escolha "Servidor da Sementeira" nas Configurações; ou instale o programa no computador, onde ${def.nome} funciona normalmente.`,
    };
  }
  return chamarOpenAiCompativel(def, config, messages, esperaJson);
}

export async function listarModelosOllamaNoNavegador(baseUrl: string): Promise<ListarModelosResposta> {
  let resp: Response;
  try {
    resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/tags`);
  } catch {
    return { ok: false, erro: MENSAGEM_OLLAMA };
  }
  if (!resp.ok) return { ok: false, erro: `Ollama respondeu ${resp.status} ao listar os modelos.` };
  const data = await resp.json();
  return { ok: true, modelos: (data.models ?? []).map((m: { name: string }) => m.name) };
}

/** Tavily libera CORS (verificado por preflight), então a busca funciona direto do navegador com a chave de quem usa. */
export async function buscarWebNoNavegador(apiKey: string, query: string): Promise<WebSearchResposta> {
  let resp: Response;
  try {
    resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: "advanced", max_results: 5 }),
    });
  } catch {
    return { ok: false, erro: mensagemDeFalhaDeRede("a Tavily") };
  }
  if (resp.status === 401 || resp.status === 403) {
    return { ok: false, erro: "A chave da Tavily foi recusada. Confira a chave nas Configurações." };
  }
  if (!resp.ok) return { ok: false, erro: `A Tavily respondeu ${resp.status}.` };
  const data = await resp.json();
  return {
    ok: true,
    resultados: (data.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
      titulo: r.title ?? "",
      url: r.url ?? "",
      conteudo: r.content ?? "",
    })),
  };
}

/** Estado do servidor da Sementeira — usado pelo botão "testar conexão" e para avisar quando ele está fora do ar. */
export interface SaudeServidor {
  ok: boolean;
  exigeToken?: boolean;
  provedores?: Record<string, boolean>;
  erro?: string;
}

export async function consultarSaudeServidor(baseUrl: string): Promise<SaudeServidor> {
  try {
    const resp = await fetch(`${baseUrl.trim().replace(/\/+$/, "")}/api/saude`);
    if (!resp.ok) return { ok: false, erro: `O servidor respondeu ${resp.status}.` };
    const data = await resp.json();
    if (!data?.ok || data.servidor !== "sementeira") {
      return { ok: false, erro: "Esse endereço respondeu, mas não é um servidor da Sementeira." };
    }
    return { ok: true, exigeToken: data.exigeToken, provedores: data.provedores };
  } catch {
    return { ok: false, erro: "Não foi possível falar com o servidor. Confira o endereço e se ele está ligado." };
  }
}
