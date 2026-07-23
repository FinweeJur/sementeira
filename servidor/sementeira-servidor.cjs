/**
 * Servidor da versão web da Sementeira.
 *
 * Faz duas coisas num processo só, atrás de um único hostname
 * (app.sementeiraprojetos.com.br, via Cloudflare Tunnel):
 *
 *   1. serve o app estático de `dist/`;
 *   2. expõe `/api/*` como gateway de IA, para os provedores que o navegador
 *      não consegue chamar direto (a Maritaca bloqueia CORS por allowlist).
 *
 * Um hostname só é decisão de projeto: app e gateway na mesma origem dispensam
 * CORS entre eles, um registro DNS e metade do CSP.
 *
 * `node:http` puro, zero dependência nova — roda com o Node que já existe na
 * máquina. Não usa Electron: a lógica de IA vem de `electron/llm-core.cjs`, o
 * mesmo módulo que o app instalado usa.
 *
 * Uso:  node servidor/sementeira-servidor.cjs
 */

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const { chamarLLM, listarModelosOllama, buscarWebTavily } = require("../electron/llm-core.cjs");

const RAIZ = path.join(__dirname, "..");
const DIRETORIO_ESTATICO = path.join(RAIZ, "dist");

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

/** Leitor de .env mínimo — não vale uma dependência só para isto. */
function carregarEnv(caminho) {
  const config = {};
  if (!fs.existsSync(caminho)) return config;
  for (const linha of fs.readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual < 1) continue;
    const chave = limpa.slice(0, igual).trim();
    let valor = limpa.slice(igual + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    config[chave] = valor;
  }
  return config;
}

const env = { ...carregarEnv(path.join(__dirname, ".env")), ...process.env };

const PORTA = Number(env.SEMENTEIRA_PORTA || 7010);
const TOKEN = (env.SEMENTEIRA_TOKEN || "").trim();

/**
 * Provedores que o gateway aceita, com a chave lida do .env.
 *
 * O navegador manda só um `providerId` — NUNCA baseUrl ou chave. Se o cliente
 * pudesse escolher a URL, este servidor viraria um proxy aberto: qualquer um
 * mandaria requisições para qualquer host usando a máquina (e a chave) de quem
 * hospeda. A tabela abaixo é a lista fechada do que pode ser chamado.
 */
const PROVEDORES = {
  deepseek: { kind: "openai-compatible", baseUrl: "https://api.deepseek.com", modeloPadrao: "deepseek-chat", apiKey: env.DEEPSEEK_API_KEY },
  maritaca: { kind: "openai-compatible", baseUrl: "https://chat.maritaca.ai/api", modeloPadrao: "sabia-4", apiKey: env.MARITACA_API_KEY },
  ollama: { kind: "ollama", baseUrl: env.OLLAMA_BASE_URL || "http://127.0.0.1:11434", modeloPadrao: "", apiKey: undefined },
};

const TAVILY_API_KEY = env.TAVILY_API_KEY;

// ---------------------------------------------------------------------------
// HTTP básico
// ---------------------------------------------------------------------------

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".map": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
};

/**
 * CSP fecha a origem no que o app realmente precisa. `connect-src` lista os
 * provedores chamados direto do navegador (DeepSeek e Tavily liberam CORS) e o
 * Ollama local; `img-src` precisa do OpenStreetMap porque o mapa do Ecossistema
 * baixa tiles de lá.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // Leaflet e React inserem estilo inline; sem isto o mapa quebra.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://api.deepseek.com https://api.tavily.com http://127.0.0.1:11434 http://localhost:11434",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

function cabecalhosBase() {
  return {
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), interest-cohort=()",
  };
}

function responderJson(res, status, dado) {
  const corpo = JSON.stringify(dado);
  res.writeHead(status, { ...cabecalhosBase(), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(corpo);
}

function lerCorpo(req, limiteBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];
    req.on("data", (parte) => {
      tamanho += parte.length;
      if (tamanho > limiteBytes) {
        reject(new Error("Corpo da requisição grande demais."));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => {
      const texto = Buffer.concat(partes).toString("utf8");
      if (!texto) return resolve({});
      try {
        resolve(JSON.parse(texto));
      } catch {
        reject(new Error("Corpo da requisição não é JSON válido."));
      }
    });
    req.on("error", reject);
  });
}

/** Comparação em tempo constante — comparar token com `===` vaza o prefixo correto por timing. */
function tokenConfere(recebido) {
  if (!TOKEN) return false;
  const a = Buffer.from(String(recebido ?? ""));
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function exigirToken(req, res) {
  if (!TOKEN) {
    responderJson(res, 503, { ok: false, erro: "O servidor está sem SEMENTEIRA_TOKEN configurado, então as rotas de IA estão desligadas." });
    return false;
  }
  if (!tokenConfere(req.headers["x-sementeira-token"])) {
    responderJson(res, 401, { ok: false, erro: "Token de acesso ausente ou inválido. Confira o token nas Configurações do app." });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Rotas /api
// ---------------------------------------------------------------------------

async function rotaSaude(_req, res) {
  // Sem token de propósito: é o que o app consulta para saber se o servidor
  // está no ar antes mesmo de a pessoa ter configurado um token. Só devolve
  // quais provedores existem — nunca as chaves.
  responderJson(res, 200, {
    ok: true,
    servidor: "sementeira",
    exigeToken: Boolean(TOKEN),
    provedores: {
      deepseek: Boolean(PROVEDORES.deepseek.apiKey),
      maritaca: Boolean(PROVEDORES.maritaca.apiKey),
      ollama: true,
      tavily: Boolean(TAVILY_API_KEY),
    },
  });
}

async function rotaChat(req, res) {
  if (!exigirToken(req, res)) return;

  let corpo;
  try {
    corpo = await lerCorpo(req);
  } catch (erro) {
    return responderJson(res, 400, { ok: false, erro: erro.message });
  }

  const provedor = PROVEDORES[corpo.providerId];
  if (!provedor) {
    return responderJson(res, 400, { ok: false, erro: `Provedor "${corpo.providerId}" não é aceito por este servidor.` });
  }
  if (provedor.kind === "openai-compatible" && !provedor.apiKey) {
    return responderJson(res, 503, { ok: false, erro: `O servidor não tem chave configurada para ${corpo.providerId}.` });
  }
  if (!Array.isArray(corpo.messages) || corpo.messages.length === 0) {
    return responderJson(res, 400, { ok: false, erro: "Nenhuma mensagem foi enviada." });
  }

  try {
    const conteudo = await chamarLLM({
      kind: provedor.kind,
      baseUrl: provedor.baseUrl,
      apiKey: provedor.apiKey,
      model: corpo.model || provedor.modeloPadrao,
      messages: corpo.messages,
      esperaJson: Boolean(corpo.esperaJson),
    });
    responderJson(res, 200, { ok: true, conteudo });
  } catch (erro) {
    responderJson(res, 200, { ok: false, erro: erro instanceof Error ? erro.message : String(erro) });
  }
}

async function rotaModelosOllama(req, res) {
  if (!exigirToken(req, res)) return;
  try {
    const modelos = await listarModelosOllama(PROVEDORES.ollama.baseUrl);
    responderJson(res, 200, { ok: true, modelos });
  } catch (erro) {
    responderJson(res, 200, { ok: false, erro: erro instanceof Error ? erro.message : String(erro) });
  }
}

async function rotaBuscaWeb(req, res) {
  if (!exigirToken(req, res)) return;
  if (!TAVILY_API_KEY) {
    return responderJson(res, 503, { ok: false, erro: "O servidor não tem chave da Tavily configurada." });
  }
  let corpo;
  try {
    corpo = await lerCorpo(req);
  } catch (erro) {
    return responderJson(res, 400, { ok: false, erro: erro.message });
  }
  if (!corpo.query || typeof corpo.query !== "string") {
    return responderJson(res, 400, { ok: false, erro: "Nenhuma busca foi informada." });
  }
  try {
    const resultados = await buscarWebTavily({ apiKey: TAVILY_API_KEY, query: corpo.query });
    responderJson(res, 200, { ok: true, resultados });
  } catch (erro) {
    responderJson(res, 200, { ok: false, erro: erro instanceof Error ? erro.message : String(erro) });
  }
}

// ---------------------------------------------------------------------------
// Estático
// ---------------------------------------------------------------------------

/**
 * Assets do Vite trazem hash no nome, então podem ser cacheados para sempre.
 * `index.html` e o service worker NÃO podem: são o ponto de entrada e o
 * mecanismo de atualização — cacheados, prendem o usuário numa versão velha.
 */
function cacheDe(caminhoRelativo) {
  if (caminhoRelativo === "index.html" || caminhoRelativo.endsWith("sw.js")) return "no-cache";
  if (caminhoRelativo.startsWith("assets/")) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
}

async function servirEstatico(req, res, caminhoUrl) {
  const relativo = caminhoUrl === "/" ? "index.html" : decodeURIComponent(caminhoUrl.replace(/^\/+/, ""));
  const destino = path.join(DIRETORIO_ESTATICO, relativo);

  // Trava de path traversal: `..` no caminho não pode escapar de dist/.
  if (!destino.startsWith(DIRETORIO_ESTATICO)) {
    return responderJson(res, 403, { ok: false, erro: "Caminho inválido." });
  }

  let alvo = destino;
  let relativoFinal = relativo;
  try {
    const info = await fsp.stat(alvo);
    if (info.isDirectory()) {
      alvo = path.join(alvo, "index.html");
      relativoFinal = path.join(relativo, "index.html");
    }
  } catch {
    // Rota do app (SPA) ou arquivo inexistente: cai no index.html.
    alvo = path.join(DIRETORIO_ESTATICO, "index.html");
    relativoFinal = "index.html";
  }

  let conteudo;
  try {
    conteudo = await fsp.readFile(alvo);
  } catch {
    res.writeHead(404, { ...cabecalhosBase(), "Content-Type": "text/plain; charset=utf-8" });
    return res.end(
      "O app ainda não foi compilado. Rode `npm run build` na raiz do projeto para gerar a pasta dist/ e reinicie o servidor.",
    );
  }

  res.writeHead(200, {
    ...cabecalhosBase(),
    "Content-Type": TIPOS[path.extname(alvo).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": cacheDe(relativoFinal.replace(/\\/g, "/")),
  });
  res.end(conteudo);
}

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);
  const rota = url.pathname;

  try {
    if (rota === "/api/saude" && req.method === "GET") return await rotaSaude(req, res);
    if (rota === "/api/llm/chat" && req.method === "POST") return await rotaChat(req, res);
    if (rota === "/api/llm/ollama/modelos" && req.method === "GET") return await rotaModelosOllama(req, res);
    if (rota === "/api/websearch" && req.method === "POST") return await rotaBuscaWeb(req, res);
    if (rota.startsWith("/api/")) return responderJson(res, 404, { ok: false, erro: "Rota não encontrada." });

    if (req.method !== "GET" && req.method !== "HEAD") {
      return responderJson(res, 405, { ok: false, erro: "Método não permitido." });
    }
    return await servirEstatico(req, res, rota);
  } catch (erro) {
    responderJson(res, 500, { ok: false, erro: erro instanceof Error ? erro.message : String(erro) });
  }
});

// Bind em 127.0.0.1 de propósito: quem expõe para fora é o Cloudflare Tunnel,
// nunca uma porta aberta no roteador — mesma decisão já adotada no Foz Juris.
servidor.listen(PORTA, "127.0.0.1", () => {
  console.log(`Sementeira web em http://127.0.0.1:${PORTA}`);
  console.log(`  estático: ${DIRETORIO_ESTATICO}${fs.existsSync(DIRETORIO_ESTATICO) ? "" : "  (AUSENTE — rode `npm run build`)"}`);
  console.log(`  token de IA: ${TOKEN ? "configurado" : "AUSENTE — rotas de IA desligadas"}`);
  const comChave = Object.entries(PROVEDORES)
    .filter(([id, p]) => (p.kind === "ollama" ? true : Boolean(p.apiKey)) && id)
    .map(([id]) => id);
  console.log(`  provedores disponíveis: ${comChave.join(", ") || "nenhum"}`);
});
