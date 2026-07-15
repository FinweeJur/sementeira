import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ExtracaoResultado {
  ok: boolean;
  texto?: string;
  erro?: string;
}

async function extrairPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const paginas: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i);
    const conteudo = await pagina.getTextContent();
    const texto = conteudo.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    paginas.push(texto);
  }
  return paginas.join("\n\n");
}

async function extrairDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  // mammoth aceita tanto `buffer` (Node) quanto `arrayBuffer` (browser).
  // No renderer do Electron, `arrayBuffer` falha com "Could not find file in
  // options" em algumas versões — passamos `buffer` (Uint8Array) que sempre funciona.
  const uint8 = new Uint8Array(arrayBuffer);
  const resultado = await mammoth.extractRawText({ buffer: uint8 as unknown as Buffer });
  return resultado.value;
}

/** Extrai texto de .pdf, .docx ou .txt — base para anexos no chat e diretrizes globais. */
export async function extrairTextoDeArquivo(arquivo: File): Promise<ExtracaoResultado> {
  try {
    const nome = arquivo.name.toLowerCase();
    if (nome.endsWith(".pdf")) {
      const buffer = await arquivo.arrayBuffer();
      return { ok: true, texto: await extrairPdf(buffer) };
    }
    if (nome.endsWith(".docx")) {
      const buffer = await arquivo.arrayBuffer();
      return { ok: true, texto: await extrairDocx(buffer) };
    }
    if (nome.endsWith(".txt") || arquivo.type.startsWith("text/")) {
      return { ok: true, texto: await arquivo.text() };
    }
    return { ok: false, erro: "Formato não suportado. Use .pdf, .docx ou .txt." };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? `Falha ao ler o arquivo: ${erro.message}` : "Falha ao ler o arquivo." };
  }
}
