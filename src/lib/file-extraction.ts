import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import mammoth from "mammoth";
import ExcelJS from "exceljs";

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

/** Uma aba de planilha reduzida a matriz de strings — a primeira linha costuma ser o cabeçalho. */
export interface AbaPlanilha {
  nome: string;
  linhas: string[][];
}

export interface PlanilhaResultado {
  ok: boolean;
  abas?: AbaPlanilha[];
  erro?: string;
}

const EXTENSOES_PLANILHA = ["xlsx", "xlsm", "csv"];

export function ehPlanilha(nomeArquivo: string): boolean {
  return EXTENSOES_PLANILHA.includes(nomeArquivo.toLowerCase().split(".").pop() ?? "");
}

/**
 * Converte o valor de uma célula do exceljs em texto. Trata fórmula (usa o
 * resultado calculado, não a fórmula), data, hyperlink e rich text — sem isso
 * a célula viraria "[object Object]" e o mapeamento de colunas falharia calado.
 */
function celulaParaTexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "object") {
    const o = valor as unknown as Record<string, unknown>;
    if ("result" in o) return celulaParaTexto(o.result as ExcelJS.CellValue);
    if ("text" in o && typeof o.text === "string") return o.text.trim();
    if ("richText" in o && Array.isArray(o.richText)) return (o.richText as { text?: string }[]).map((t) => t.text ?? "").join("").trim();
    if ("hyperlink" in o && typeof o.hyperlink === "string") return o.hyperlink;
    if ("error" in o) return "";
  }
  return String(valor).trim();
}

/**
 * Parser de CSV próprio, tolerante a aspas, quebra de linha dentro de campo e
 * separador `;` (o padrão do Excel em pt-BR). Não usamos `workbook.csv.read` do
 * exceljs porque ele depende de streams do Node, que não existem no renderer.
 */
export function parsearCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  // O separador é decidido pela primeira linha: quem aparecer mais, vence.
  const primeiraLinha = limpo.split(/\r?\n/, 1)[0] ?? "";
  const separador = (primeiraLinha.match(/;/g)?.length ?? 0) > (primeiraLinha.match(/,/g)?.length ?? 0) ? ";" : ",";

  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let dentroDeAspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') dentroDeAspas = true;
    else if (c === separador) {
      linha.push(campo.trim());
      campo = "";
    } else if (c === "\n") {
      linha.push(campo.trim());
      linhas.push(linha);
      linha = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo.trim());
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((celula) => celula !== ""));
}

async function extrairXlsx(arrayBuffer: ArrayBuffer): Promise<AbaPlanilha[]> {
  const wb = new ExcelJS.Workbook();
  await comTimeout(
    wb.xlsx.load(arrayBuffer),
    TIMEOUT_EXTRACAO_MS,
    "Tempo esgotado ao ler a planilha (mais de 45s). O arquivo pode estar corrompido ou ser muito grande.",
  );
  const abas: AbaPlanilha[] = [];
  wb.eachSheet((ws) => {
    const linhas: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      // `row.values` é 1-indexado no exceljs (a posição 0 é sempre vazia).
      const valores = row.values as ExcelJS.CellValue[];
      const celulas: string[] = [];
      for (let i = 1; i < valores.length; i++) celulas.push(celulaParaTexto(valores[i]));
      if (celulas.some((c) => c !== "")) linhas.push(celulas);
    });
    if (linhas.length > 0) abas.push({ nome: ws.name, linhas });
  });
  return abas;
}

/** Lê .xlsx/.xlsm/.csv e devolve as abas como matriz de strings. */
export async function extrairPlanilha(arquivo: File): Promise<PlanilhaResultado> {
  const nome = arquivo.name.toLowerCase();
  try {
    if (nome.endsWith(".csv")) {
      const linhas = parsearCsv(await arquivo.text());
      if (linhas.length === 0) return { ok: false, erro: "A planilha está vazia." };
      return { ok: true, abas: [{ nome: arquivo.name.replace(/\.csv$/i, ""), linhas }] };
    }
    if (nome.endsWith(".xlsx") || nome.endsWith(".xlsm")) {
      const abas = await extrairXlsx(await arquivo.arrayBuffer());
      if (abas.length === 0) return { ok: false, erro: "A planilha não tem nenhuma aba com conteúdo." };
      return { ok: true, abas };
    }
    if (nome.endsWith(".xls")) {
      return { ok: false, erro: "O formato .xls (Excel antigo) não é suportado. Abra no Excel e salve como .xlsx." };
    }
    return { ok: false, erro: "Formato de planilha não suportado. Use .xlsx ou .csv." };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? `Falha ao ler a planilha: ${erro.message}` : "Falha ao ler a planilha." };
  }
}

/**
 * Abas de planilha como tabelas Markdown. É assim que uma planilha de formato
 * desconhecido entra no mesmo pipeline dos documentos (IA + plano B
 * heurístico): vira texto, e nada precisa ser tratado como caso especial.
 */
export function planilhaParaTexto(abas: AbaPlanilha[]): string {
  return abas
    .map((aba) => {
      const linhas = aba.linhas.map((l) => `| ${l.join(" | ")} |`);
      const separador = aba.linhas[0] ? `| ${aba.linhas[0].map(() => "---").join(" | ")} |` : "";
      return [`### Aba: ${aba.nome}`, linhas[0] ?? "", separador, ...linhas.slice(1)].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

/** Extrai texto de .pdf, .docx, .txt, .xlsx ou .csv — base para anexos no chat, diretrizes globais e importação. */
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
    if (nome.endsWith(".doc")) {
      return { ok: false, erro: "O formato .doc (Word antigo) não é suportado. Abra no Word e salve como .docx." };
    }
    if (ehPlanilha(nome)) {
      const planilha = await extrairPlanilha(arquivo);
      if (!planilha.ok || !planilha.abas) return { ok: false, erro: planilha.erro };
      return { ok: true, texto: planilhaParaTexto(planilha.abas) };
    }
    if (nome.endsWith(".txt") || arquivo.type.startsWith("text/")) {
      return { ok: true, texto: await arquivo.text() };
    }
    return { ok: false, erro: "Formato não suportado. Use .pdf, .docx, .xlsx, .csv ou .txt." };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? `Falha ao ler o arquivo: ${erro.message}` : "Falha ao ler o arquivo." };
  }
}
