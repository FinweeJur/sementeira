/**
 * Em que ambiente o renderer está rodando.
 *
 * O mesmo código serve o app instalado (Electron, com IPC) e a versão web
 * (navegador, sem IPC). As duas têm capacidades diferentes, e quem usa precisa
 * entender a diferença em português — não numa mensagem sobre "IPC do Electron",
 * que é o que o app dizia ao usuário final antes disto existir.
 */
export type Ambiente = "desktop" | "web";

export function ambienteAtual(): Ambiente {
  return typeof window !== "undefined" && window.sementeira?.ping ? "desktop" : "web";
}

export function ehAppDesktop(): boolean {
  return ambienteAtual() === "desktop";
}

export function ehWeb(): boolean {
  return ambienteAtual() === "web";
}

/** Recursos que dependem do processo principal do Electron e, portanto, só existem no app instalado. */
export type RecursoDesktop = "salvar-documento" | "abrir-documento" | "biblioteca-arquivo" | "pdf-nativo";

const EXPLICACOES: Record<RecursoDesktop, string> = {
  "salvar-documento":
    "Guardar o arquivo original junto do projeto só funciona no programa instalado. Aqui no navegador o texto lido do documento é preservado, mas o arquivo em si continua só com você.",
  "abrir-documento": "Abrir o arquivo original só funciona no programa instalado.",
  "biblioteca-arquivo": "Guardar e abrir arquivos da Biblioteca só funciona no programa instalado.",
  "pdf-nativo":
    'Aqui no navegador o PDF sai pela janela de impressão — escolha "Salvar como PDF". No programa instalado ele é gerado direto.',
};

/**
 * Mensagem pronta para exibir quando um recurso exclusivo do programa instalado
 * é pedido na web. Sempre diz o que dá para fazer no lugar — nunca só
 * "indisponível".
 */
export function motivoIndisponivel(recurso: RecursoDesktop): string {
  return EXPLICACOES[recurso];
}
