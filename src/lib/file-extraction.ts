import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ExtracaoResultado {
  ok: boolean;
  texto?: string;
  erro?: string;
}

// Rede de segurança: qualquer trava na leitura vira erro legível em vez de
// spinner infinito. O modal de importação não tem como cancelar, então sem
// isso uma promise pendurada deixa a UI presa para sempre.
const TIMEOUT_EXTRACAO_MS = 45_000;

function comTimeout<T>(promessa: Promise<T>, ms: number, mensagem: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(mensagem)), ms);
    promessa.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function extrairPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdf = await comTimeout(
    pdfjsLib.getDocument({ data: arrayBuffer }).promise,
    TIMEOUT_EXTRACAO_MS,
    "Tempo esgotado ao abrir o PDF (mais de 45s). O arquivo pode estar corrompido ou ser muito grande.",
  );
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
  // O mammoth tem DUAS implementações de `openZip`, e cada uma aceita um
  // conjunto DIFERENTE de opções — quem escolhe é o campo `browser` do
  // package.json do mammoth:
  //   - `browser/unzip.js` (o que o Vite usa no renderer): só `arrayBuffer`
  //   - `lib/unzip.js` (Node, usado em testes/scripts): só `path`/`buffer`/`file`
  // Passar só uma das duas quebra no outro ambiente com a mensagem enganosa
  // "Could not find file in options". Como `openZip` recebe este objeto sem
  // validar chaves desconhecidas, mandamos as DUAS: cada build pega a sua.
  const uint8 = new Uint8Array(arrayBuffer);
  const resultado = await comTimeout(
    mammoth.extractRawText({ arrayBuffer, buffer: uint8 as unknown as Buffer }),
    TIMEOUT_EXTRACAO_MS,
    "Tempo esgotado ao ler o DOCX (mais de 45s). O arquivo pode estar corrompido ou ser muito grande.",
  );
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
