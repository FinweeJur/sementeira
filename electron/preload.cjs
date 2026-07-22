const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sementeira", {
  ping: () => ipcRenderer.invoke("sementeira:ping"),
  llmChat: (request) => ipcRenderer.invoke("sementeira:llm:chat", request),
  listarModelosOllama: (baseUrl) => ipcRenderer.invoke("sementeira:ollama:listarModelos", baseUrl),
  webSearch: (request) => ipcRenderer.invoke("sementeira:websearch", request),
  exportarPdf: (sugestaoNomeArquivo) => ipcRenderer.invoke("sementeira:pdf:exportar", sugestaoNomeArquivo),
  salvarDocumento: (dados) => ipcRenderer.invoke("sementeira:documento:salvar", dados),
  abrirDocumento: (caminho) => ipcRenderer.invoke("sementeira:documento:abrir", caminho),
  salvarArquivoBiblioteca: (dados) => ipcRenderer.invoke("sementeira:biblioteca:salvar", dados),
  abrirArquivoBiblioteca: (caminho) => ipcRenderer.invoke("sementeira:biblioteca:abrir", caminho),
  caminhoDocumentoEmbutido: (nomeArquivo) => ipcRenderer.invoke("sementeira:biblioteca:caminhoEmbutido", nomeArquivo),
});
