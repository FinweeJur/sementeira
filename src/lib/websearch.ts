export interface ResultadoBusca {
  titulo: string;
  url: string;
  conteudo: string;
}

export interface BuscaResposta {
  ok: boolean;
  resultados?: ResultadoBusca[];
  erro?: string;
}

export interface TavilyConfig {
  apiKey?: string;
}

const CONFIG_KEY = "sementeira-tavily-config-v1";

export function carregarConfigTavily(): TavilyConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw) as TavilyConfig;
  } catch {
    /* ignora config corrompida */
  }
  return {};
}

export function salvarConfigTavily(config: TavilyConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/**
 * Deep Research — só funciona com internet + chave Tavily configurada.
 * Sem isso, retorna erro claro em vez de travar ou deixar a IA inventar dado.
 */
export async function buscarWeb(query: string): Promise<BuscaResposta> {
  const config = carregarConfigTavily();
  if (!config.apiKey) {
    return {
      ok: false,
      erro: "Chave da Tavily não configurada. Sem internet/chave, a pesquisa de dados públicos, preços e arrecadação fica indisponível — preencha manualmente.",
    };
  }
  if (!window.sementeira?.webSearch) {
    return { ok: false, erro: "IPC do Electron não disponível (rodando fora do app desktop?)." };
  }
  return window.sementeira.webSearch({ apiKey: config.apiKey, query });
}
