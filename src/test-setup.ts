// pdfjs-dist toca em APIs de canvas do navegador (DOMMatrix) só na importação do módulo —
// mesmo sem usar extração de PDF no teste, o import transitivo (biblioteca.ts -> file-extraction.ts) passa por aqui.
// jsdom não implementa DOMMatrix; um stub mínimo é suficiente pra passar da fase de import.
if (typeof globalThis.DOMMatrix === "undefined") {
  // @ts-expect-error stub mínimo só pra satisfazer a checagem de existência do pdfjs-dist no import
  globalThis.DOMMatrix = class DOMMatrix {};
}
