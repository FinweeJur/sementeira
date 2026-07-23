export type ProviderKind = "openai-compatible" | "ollama";

export interface ProviderDef {
  id: string;
  nome: string;
  kind: ProviderKind;
  baseUrlDefault: string;
  modeloDefault: string;
  modelosSugeridos: string[];
  precisaApiKey: boolean;
  docsUrl?: string;
}

export const PROVEDORES: ProviderDef[] = [
  {
    id: "deepseek",
    nome: "DeepSeek",
    kind: "openai-compatible",
    baseUrlDefault: "https://api.deepseek.com",
    modeloDefault: "deepseek-chat",
    modelosSugeridos: ["deepseek-chat", "deepseek-reasoner"],
    precisaApiKey: true,
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "maritaca",
    nome: "Maritaca / Sabiá",
    kind: "openai-compatible",
    baseUrlDefault: "https://chat.maritaca.ai/api",
    modeloDefault: "sabia-4",
    modelosSugeridos: ["sabia-4", "sabiazinho-4"],
    precisaApiKey: true,
    docsUrl: "https://plataforma.maritaca.ai/",
  },
  {
    id: "ollama",
    nome: "Ollama (local)",
    kind: "ollama",
    baseUrlDefault: "http://127.0.0.1:11434",
    modeloDefault: "",
    modelosSugeridos: [],
    precisaApiKey: false,
  },
];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  kind: ProviderKind;
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: ChatMessage[];
  /** Restringe a geração a JSON válido no provedor — ver `OpcoesEnvio`. */
  esperaJson?: boolean;
}

export interface LLMResponse {
  ok: boolean;
  conteudo?: string;
  erro?: string;
}

export interface ListarModelosResposta {
  ok: boolean;
  modelos?: string[];
  erro?: string;
}

export interface WebSearchRequest {
  apiKey: string;
  query: string;
}

export interface WebSearchResultado {
  titulo: string;
  url: string;
  conteudo: string;
}

export interface WebSearchResposta {
  ok: boolean;
  resultados?: WebSearchResultado[];
  erro?: string;
}

export interface ExportarPdfResposta {
  ok: boolean;
  caminho?: string;
  erro?: string;
}

export interface SalvarDocumentoResposta {
  ok: boolean;
  caminho?: string;
  erro?: string;
}

export interface AbrirDocumentoResposta {
  ok: boolean;
  erro?: string;
}

/** Superfície IPC completa exposta pelo preload — centralizada aqui para evitar declarações `Window` conflitantes entre módulos. */
  declare global {
  interface Window {
    sementeira?: {
      ping: () => Promise<unknown>;
      llmChat: (request: LLMRequest) => Promise<LLMResponse>;
      listarModelosOllama: (baseUrl: string) => Promise<ListarModelosResposta>;
      webSearch: (request: WebSearchRequest) => Promise<WebSearchResposta>;
      exportarPdf: (sugestaoNomeArquivo?: string) => Promise<ExportarPdfResposta>;
      salvarDocumento: (dados: { projectId: string; nomeArquivo: string; conteudoBase64: string }) => Promise<SalvarDocumentoResposta>;
      abrirDocumento: (caminho: string) => Promise<AbrirDocumentoResposta>;
      salvarArquivoBiblioteca: (dados: { recursoId: string; nomeArquivo: string; conteudoBase64: string }) => Promise<SalvarDocumentoResposta>;
      abrirArquivoBiblioteca: (caminho: string) => Promise<AbrirDocumentoResposta>;
      caminhoDocumentoEmbutido: (nomeArquivo: string) => Promise<SalvarDocumentoResposta>;
    };
  }
}

/** Detecta automaticamente os modelos já baixados no Ollama local (GET /api/tags) — evita depender de uma lista fixa de nomes/tags que o usuário pode não ter instalado. */
export async function listarModelosOllamaLocal(baseUrl: string): Promise<ListarModelosResposta> {
  if (!window.sementeira?.listarModelosOllama) {
    return { ok: false, erro: "IPC do Electron não disponível (rodando fora do app desktop?)." };
  }
  return window.sementeira.listarModelosOllama(baseUrl);
}

export interface OpcoesEnvio {
  /**
   * Pede ao provedor que restrinja a geração a JSON sintaticamente válido.
   * Use APENAS onde a resposta é consumida por parser — nunca no chat, que
   * precisa responder em português corrido.
   *
   * Ataca a raiz das malformações (JSON truncado, vírgula sobrando, quebra
   * de linha crua dentro de string) em vez de remendá-las depois. Não
   * substitui o parser tolerante nem o plano B: medido com gemma2:2b, some
   * com o erro de sintaxe, mas o modelo ainda pode responder pouco.
   */
  esperaJson?: boolean;
}

export async function enviarMensagemLLM(config: ProviderConfig, messages: ChatMessage[], opcoes: OpcoesEnvio = {}): Promise<LLMResponse> {
  const def = PROVEDORES.find((p) => p.id === config.providerId);
  if (!def) return { ok: false, erro: "Provedor não configurado." };
  if (!window.sementeira?.llmChat) return { ok: false, erro: "IPC do Electron não disponível (rodando fora do app desktop?)." };

  return window.sementeira.llmChat({
    kind: def.kind,
    baseUrl: config.baseUrl || def.baseUrlDefault,
    apiKey: config.apiKey,
    model: config.model || def.modeloDefault,
    messages,
    esperaJson: opcoes.esperaJson === true,
  });
}

export interface ProviderConfig {
  providerId: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

/** Guarda amigável: verifica ANTES de qualquer ação de IA se a config atual tem chance de funcionar, para não deixar o leigo esperar por um erro técnico. */
export function configuracaoLLMPronta(config: ProviderConfig): { pronta: boolean; motivo?: string } {
  const def = PROVEDORES.find((p) => p.id === config.providerId);
  if (!def) return { pronta: false, motivo: "Nenhum provedor de IA selecionado." };
  if (def.precisaApiKey && !config.apiKey?.trim()) {
    return { pronta: false, motivo: `O provedor ${def.nome} precisa de uma chave de API.` };
  }
  if (def.kind === "ollama" && !config.model?.trim()) {
    return { pronta: false, motivo: "Nenhum modelo do Ollama selecionado — clique em 'atualizar lista' para detectar os instalados." };
  }
  return { pronta: true };
}

const CONFIG_KEY = "sementeira-llm-config-v1";

export function carregarConfigLLM(): ProviderConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw) as ProviderConfig;
  } catch {
    /* ignora config corrompida */
  }
  return { providerId: "ollama" };
}

export function salvarConfigLLM(config: ProviderConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

const CONFIG_COMPARACAO_KEY = "sementeira-llm-config-comparacao-v1";

/**
 * Configuração opcional de um SEGUNDO provedor, usada só para comparar as
 * respostas do Crítico/Compilador entre dois modelos (Fase 11b) — nunca é o
 * provedor padrão do app. `null` = comparação desativada/não configurada.
 */
export function carregarConfigComparacao(): ProviderConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_COMPARACAO_KEY);
    if (raw) return JSON.parse(raw) as ProviderConfig;
  } catch {
    /* ignora config corrompida */
  }
  return null;
}

export function salvarConfigComparacao(config: ProviderConfig | null): void {
  if (config) localStorage.setItem(CONFIG_COMPARACAO_KEY, JSON.stringify(config));
  else localStorage.removeItem(CONFIG_COMPARACAO_KEY);
}

export function nomeProvedor(config: ProviderConfig): string {
  return PROVEDORES.find((p) => p.id === config.providerId)?.nome ?? config.providerId;
}
