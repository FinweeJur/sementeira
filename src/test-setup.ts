// pdfjs-dist toca em APIs de canvas do navegador (DOMMatrix) só na importação do módulo —
// mesmo sem usar extração de PDF no teste, o import transitivo (biblioteca.ts -> file-extraction.ts) passa por aqui.
// jsdom não implementa DOMMatrix; um stub mínimo é suficiente pra passar da fase de import.
if (typeof globalThis.DOMMatrix === "undefined") {
  // @ts-expect-error stub mínimo só pra satisfazer a checagem de existência do pdfjs-dist no import
  globalThis.DOMMatrix = class DOMMatrix {};
}

// O pdfjs-dist 6.2 faz `Iterator.prototype.join = ...` na importação, **sem guardar
// `typeof Iterator`** — ele assume que o global existe. Existe mesmo no Chromium do Electron
// (iterator helpers desde o Chrome 122), que é onde o app roda; mas NÃO existe no Node 20,
// e a matriz da CI inclui 20.x. Sem isto, 6 arquivos de teste morrem na importação com
// "ReferenceError: Iterator is not defined" — e nenhum teste chega a rodar.
//
// `Iterator.prototype` tem de ser o %IteratorPrototype% de verdade (o protótipo comum a todos
// os iteradores), senão o `join` que o pdfjs pendura nele não chega a iterador nenhum. Daí a
// dupla `getPrototypeOf` a partir de um iterador de array.
// O `Iterator` não está na lib de tipos alvo deste projeto, então o acesso é tipado aqui
// em vez de suprimido — `@ts-expect-error` esconderia também um erro futuro de verdade.
const globalComIterator = globalThis as typeof globalThis & { Iterator?: unknown };
if (typeof globalComIterator.Iterator === "undefined") {
  const iteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
  const IteratorStub = function () {
    throw new TypeError("Iterator não é construível — stub de teste, ver src/test-setup.ts");
  };
  IteratorStub.prototype = iteratorPrototype;
  globalComIterator.Iterator = IteratorStub;
}

// jsdom não implementa scrollIntoView — stub mínimo para testes de componente
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
