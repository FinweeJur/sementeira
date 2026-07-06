import { carregarConfigLLM, salvarConfigLLM, carregarConfigComparacao, salvarConfigComparacao, type ProviderConfig } from "./providers";
import { carregarConfigTavily, salvarConfigTavily, type TavilyConfig } from "./websearch";
import { carregarDiretrizesGlobais, salvarDiretrizesGlobais, type DiretrizGlobal } from "./diretrizes-globais";

interface ConfiguracoesExportadas {
  versao: 1;
  exportadoEm: string;
  llmConfig: ProviderConfig;
  llmConfigComparacao?: ProviderConfig | null;
  tavilyConfig: TavilyConfig;
  diretrizesGlobais: DiretrizGlobal[];
}

/** Baixa um .json com a config de LLM (principal + comparação), a chave Tavily e as diretrizes gerais — para levar ao trocar de instalação (dev↔instalado, reinstalação, outra máquina). */
export function exportarConfiguracoes(): void {
  const dado: ConfiguracoesExportadas = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    llmConfig: carregarConfigLLM(),
    llmConfigComparacao: carregarConfigComparacao(),
    tavilyConfig: carregarConfigTavily(),
    diretrizesGlobais: carregarDiretrizesGlobais(),
  };

  const blob = new Blob([JSON.stringify(dado, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sementeira-configuracoes-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportarResultado {
  ok: boolean;
  erro?: string;
}

/** Lê um .json gerado por `exportarConfiguracoes` e restaura tudo — chaves de API nunca aparecem em texto, só são gravadas de volta no localStorage local. */
export async function importarConfiguracoes(arquivo: File): Promise<ImportarResultado> {
  let texto: string;
  try {
    texto = await arquivo.text();
  } catch {
    return { ok: false, erro: "Não foi possível ler o arquivo." };
  }

  let dado: Partial<ConfiguracoesExportadas>;
  try {
    dado = JSON.parse(texto);
  } catch {
    return { ok: false, erro: "Arquivo não é um .json válido." };
  }

  if (!dado || typeof dado !== "object") {
    return { ok: false, erro: "Formato de arquivo inesperado." };
  }

  if (dado.llmConfig && typeof dado.llmConfig === "object") {
    salvarConfigLLM(dado.llmConfig as ProviderConfig);
  }
  if (dado.llmConfigComparacao && typeof dado.llmConfigComparacao === "object") {
    salvarConfigComparacao(dado.llmConfigComparacao as ProviderConfig);
  }
  if (dado.tavilyConfig && typeof dado.tavilyConfig === "object") {
    salvarConfigTavily(dado.tavilyConfig as TavilyConfig);
  }
  if (Array.isArray(dado.diretrizesGlobais)) {
    salvarDiretrizesGlobais(dado.diretrizesGlobais as DiretrizGlobal[]);
  }

  return { ok: true };
}
