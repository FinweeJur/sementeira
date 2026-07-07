const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sementeira", {
  ping: () => ipcRenderer.invoke("sementeira:ping"),
  llmChat: (request) => ipcRenderer.invoke("sementeira:llm:chat", request),
  listarModelosOllama: (baseUrl) => ipcRenderer.invoke("sementeira:ollama:listarModelos", baseUrl),
  webSearch: (request) => ipcRenderer.invoke("sementeira:websearch", request),
  exportarPdf: (sugestaoNomeArquivo) => ipcRenderer.invoke("sementeira:pdf:exportar", sugestaoNomeArquivo),
});
