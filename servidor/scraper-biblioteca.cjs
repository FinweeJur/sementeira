/**
 * Scraper da Biblioteca — acompanha as páginas de publicações do site da
 * Entidade Gestora do Anexo I.1 (anexo1-1.ibict.br) e baixa PDFs novos pra
 * dentro da Biblioteca compartilhada. Rodado 1x/dia por uma tarefa agendada
 * (mesmo padrão de "Sementeira Web"/"Sementeira Tunnel" — ver
 * SementeiraDeploy\iniciar-*.vbs), NUNCA pelo processo do gateway em si.
 *
 * Site é WordPress; não expõe os PDFs pela API REST (/wp-json/wp/v2/media
 * não lista nada), então a checagem é por regex simples nas páginas
 * conhecidas — verificado manualmente em 2026-07 que /anexo-11/ e
 * /transparencia/ têm o link do PDF principal. `robots.txt` do site não
 * bloqueia essas páginas.
 *
 * Idempotente: compara com o manifesto local por URL, só baixa o que for
 * novo. Educado: roda 1x/dia, User-Agent identificado, 2-3 páginas por vez.
 *
 * Uso:  node servidor/scraper-biblioteca.cjs
 */
const https = require("node:https");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const DIR_COMPARTILHADA = path.join(__dirname, "biblioteca-compartilhada");
const DIR_ARQUIVOS = path.join(DIR_COMPARTILHADA, "arquivos");
const MANIFESTO_PATH = path.join(DIR_COMPARTILHADA, "manifesto.json");

function carregarEnv(caminho) {
  const config = {};
  if (!fs.existsSync(caminho)) return config;
  for (const linha of fs.readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual < 1) continue;
    config[limpa.slice(0, igual).trim()] = limpa.slice(igual + 1).trim();
  }
  return config;
}
const env = { ...carregarEnv(path.join(__dirname, ".env")), ...process.env };

const BASE_URL = (env.SCRAPER_BIBLIOTECA_URL || "https://anexo1-1.ibict.br/").replace(/\/+$/, "") + "/";
const PAGINAS = (env.SCRAPER_BIBLIOTECA_PAGINAS || "anexo-11/,transparencia/").split(",").map((p) => p.trim()).filter(Boolean);
const USER_AGENT = "SementeiraBibliotecaBot/1.0 (+https://app.sementeiraprojetos.com.br)";
const TIMEOUT_MS = 20_000;

function get(url, { binario = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": USER_AGENT }, timeout: TIMEOUT_MS }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(get(new URL(res.headers.location, url).toString(), { binario }));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} ao buscar ${url}`));
        res.resume();
        return;
      }
      const pedacos = [];
      res.on("data", (d) => pedacos.push(d));
      res.on("end", () => resolve(binario ? Buffer.concat(pedacos) : Buffer.concat(pedacos).toString("utf8")));
    });
    req.on("timeout", () => req.destroy(new Error(`Tempo esgotado ao buscar ${url}`)));
    req.on("error", reject);
  });
}

function extrairLinksPdf(html, urlBase) {
  const achados = new Set();
  const regex = /href\s*=\s*["']([^"']+\.pdf)["']/gi;
  let m;
  while ((m = regex.exec(html))) {
    try {
      achados.add(new URL(m[1], urlBase).toString());
    } catch {
      /* href inválido — ignora */
    }
  }
  return [...achados];
}

async function carregarManifesto() {
  try {
    const bruto = await fsp.readFile(MANIFESTO_PATH, "utf8");
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

async function salvarManifesto(lista) {
  await fsp.mkdir(DIR_COMPARTILHADA, { recursive: true });
  await fsp.writeFile(MANIFESTO_PATH, JSON.stringify(lista, null, 2), "utf8");
}

/**
 * Extração de texto do PDF é melhor-esforço: usa o pdfjs-dist que o resto do
 * app já depende (não é dependência nova, ver package.json). Se falhar, o
 * item entra no manifesto sem texto — a Biblioteca mostra "confira a fonte"
 * em vez de travar o scraper inteiro por causa de um PDF ruim.
 */
async function extrairTextoPdf(bufferPdf) {
  try {
    // pdfjs-dist só publica build ESM — precisa de import() dinâmico dentro
    // deste script CommonJS, `require()` não carrega .mjs.
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bufferPdf), useWorkerFetch: false, isEvalSupported: false }).promise;
    const paginas = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pagina = await doc.getPage(i);
      const conteudo = await pagina.getTextContent();
      paginas.push(conteudo.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    return paginas.join("\n\n");
  } catch (erro) {
    console.warn(`  aviso: não consegui extrair texto do PDF (${erro instanceof Error ? erro.message : erro})`);
    return null;
  }
}

function nomeArquivoSeguro(url) {
  const base = url.split("/").pop() || "documento.pdf";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/**
 * O CMS do site guarda os PDFs com nome de arquivo aleatório (hash), então o
 * nome do arquivo não serve de título. Em vez disso, procura a primeira
 * linha "de verdade" no texto extraído (letras suficientes, não é só número
 * de página) — normalmente é o título do documento.
 */
function tituloDoTexto(texto, nomeArquivo) {
  if (texto) {
    const linhas = texto.split(/\n+/).map((l) => l.trim());
    const candidata = linhas.find((l) => l.replace(/[^a-zA-ZÀ-ÿ]/g, "").length > 15);
    if (candidata) {
      // Corta antes do início de um sumário ("  1. Introdução", "  2 Objetivos"
      // etc.) — sem isso o "título" vira o sumário inteiro colado.
      const corte = candidata.search(/\s{2,}\d+[.)]?\s+[A-ZÀ-Ý]/);
      return (corte > 10 ? candidata.slice(0, corte) : candidata).replace(/^\d+\s+/, "").trim().slice(0, 140);
    }
  }
  return nomeArquivo.replace(/\.pdf$/i, "");
}

async function main() {
  console.log(`Scraper da Biblioteca — checando ${PAGINAS.length} página(s) em ${BASE_URL}`);
  await fsp.mkdir(DIR_ARQUIVOS, { recursive: true });
  const manifesto = await carregarManifesto();
  const conhecidas = new Set(manifesto.map((m) => m.url));

  const linksEncontrados = new Set();
  for (const pagina of PAGINAS) {
    const url = new URL(pagina, BASE_URL).toString();
    try {
      const html = await get(url);
      for (const link of extrairLinksPdf(html, url)) linksEncontrados.add(link);
    } catch (erro) {
      console.warn(`Falha ao buscar ${url}: ${erro instanceof Error ? erro.message : erro}`);
    }
  }

  const novos = [...linksEncontrados].filter((url) => !conhecidas.has(url));
  console.log(`${linksEncontrados.size} PDF(s) encontrados, ${novos.length} novo(s).`);

  for (const url of novos) {
    const nomeArquivo = nomeArquivoSeguro(url);
    console.log(`Baixando: ${url}`);
    try {
      const bufferPdf = await get(url, { binario: true });
      await fsp.writeFile(path.join(DIR_ARQUIVOS, nomeArquivo), bufferPdf);
      const texto = await extrairTextoPdf(bufferPdf);
      manifesto.push({
        id: require("node:crypto").randomUUID(),
        url,
        nomeArquivo,
        titulo: tituloDoTexto(texto, nomeArquivo),
        baixadoEm: new Date().toISOString(),
        textoExtraido: texto,
      });
    } catch (erro) {
      console.warn(`  falha ao baixar/processar ${url}: ${erro instanceof Error ? erro.message : erro}`);
    }
  }

  if (novos.length > 0) await salvarManifesto(manifesto);
  console.log("Concluído.");
}

main().catch((erro) => {
  console.error("Scraper falhou:", erro);
  process.exitCode = 1;
});
