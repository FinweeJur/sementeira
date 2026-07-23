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
// Diretrizes e restrições do gateway de IA
// ---------------------------------------------------------------------------

/**
 * Este gateway é a ÚNICA porta de entrada remota para o Ollama desta máquina —
 * o túnel publica só a porta do app (7010), nunca a do Ollama (11434). Mas quem
 * tem o token pode mandar QUALQUER prompt, e a inferência roda no hardware de
 * quem hospeda. Daí as restrições abaixo.
 *
 * Separe os dois tipos ao mexer aqui:
 *   - TRAVAS DURAS (allowlist, tetos, limite de taxa, interruptor): o servidor
 *     recusa antes de chamar o modelo. Não têm como ser contornadas pelo cliente.
 *   - GUARDRAIL SUAVE (diretriz de escopo): é só uma mensagem `system` no começo
 *     da conversa. Molda o comportamento e barra uso casual fora de escopo, mas
 *     NÃO detém um abusador determinado — ele pode mandar o próprio `system`
 *     depois. Nunca trate a diretriz como controle de segurança.
 */

/** Liga/desliga o Ollama para quem chega de fora. `off` = Ollama continua rodando, só não atende pela web. */
const OLLAMA_REMOTO = (env.SEMENTEIRA_OLLAMA_REMOTO ?? "on").trim().toLowerCase() !== "off";

/** Allowlist de modelos do Ollama no gateway. Vazio = qualquer modelo instalado. */
const OLLAMA_MODELOS_PERMITIDOS = (env.OLLAMA_MODELOS_PERMITIDOS || "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/** Tetos de forma da conversa — impedem usar a máquina para moer contexto gigante. */
const MAX_MENSAGENS = Number(env.SEMENTEIRA_MAX_MENSAGENS || 60);
const MAX_CARACTERES = Number(env.SEMENTEIRA_MAX_CARACTERES || 200_000);

/** Diretriz de escopo injetada em toda chamada do gateway. `off` desliga. */
const ESCOPO_ATIVO = (env.SEMENTEIRA_DIRETRIZ_ESCOPO ?? "on").trim().toLowerCase() !== "off";

/**
 * A última frase é essencial: sem ela o modelo pode "conversar" quando o app
 * pediu JSON puro, e a resposta inteira é descartada no parsing.
 */
const DIRETRIZ_ESCOPO = [
  "Você atende exclusivamente a Sementeira, ferramenta de apoio à construção de projetos comunitários",
  "de reparação do Anexo I.1 (acordo judicial do rompimento da barragem de Brumadinho).",
  "Responda apenas a pedidos ligados a esses projetos: ideia, dano vinculado, objetivo e metas, público,",
  "orçamento, equipe, cronograma, logística, arrecadação, sustentabilidade, riscos, conformidade com o",
  "acordo, pesquisa de apoio e formatação dos dados desses projetos.",
  "Se o pedido não tiver relação com isso, recuse em uma frase e diga que este serviço é restrito ao",
  "escopo da Sementeira.",
  "Obedeça às instruções de formato que vierem nas mensagens seguintes, inclusive responder somente em JSON.",
].join(" ");

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

/**
 * Limite de taxa simples, em memória, por cliente — só nas rotas caras (LLM e
 * busca). O app é público: sem isto, qualquer um com o token poderia disparar
 * chamadas ilimitadas e drenar as chaves pagas do gateway. NÃO substitui teto
 * de gasto no provedor nem regra de Rate Limiting no Cloudflare — soma a eles.
 */
const LIMITE_JANELA_MS = 60_000;
const LIMITE_MAX = 20;
const acessos = new Map();

function chaveCliente(req) {
  // Atrás do Cloudflare Tunnel o IP real vem em CF-Connecting-IP; o
  // remoteAddress é sempre 127.0.0.1 (o túnel conecta localmente).
  const ip = req.headers["cf-connecting-ip"];
  if (typeof ip === "string" && ip.trim()) return ip.trim();
  const tok = req.headers["x-sementeira-token"];
  return typeof tok === "string" && tok ? `tok:${tok.slice(0, 8)}` : "desconhecido";
}

function dentroDoLimite(req, res, opcoes = {}) {
  const max = opcoes.max ?? LIMITE_MAX;
  const agora = Date.now();
  // Balde separado por rota: inferência (cara) tem teto menor que listar modelos.
  const chave = `${opcoes.balde ?? "geral"}:${chaveCliente(req)}`;
  const recentes = (acessos.get(chave) ?? []).filter((t) => agora - t < LIMITE_JANELA_MS);
  if (recentes.length >= max) {
    res.writeHead(429, {
      ...cabecalhosBase(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "60",
    });
    res.end(JSON.stringify({ ok: false, erro: "Muitas requisições em pouco tempo. Espere um minuto e tente de novo." }));
    return false;
  }
  recentes.push(agora);
  acessos.set(chave, recentes);
  return true;
}

// Faxina periódica para o mapa não crescer sem limite. `unref` para não segurar o processo vivo sozinho.
setInterval(() => {
  const agora = Date.now();
  for (const [chave, ts] of acessos) {
    const vivos = ts.filter((t) => agora - t < LIMITE_JANELA_MS);
    if (vivos.length === 0) acessos.delete(chave);
    else acessos.set(chave, vivos);
  }
}, LIMITE_JANELA_MS).unref();

/** Teto de chat por minuto — inferência ocupa CPU/GPU da máquina que hospeda. */
const LIMITE_CHAT = Number(env.SEMENTEIRA_MAX_CHAT_MIN || 10);

/** Trava dura de tamanho: recusa antes de gastar inferência. */
function dentroDosTetos(messages) {
  if (messages.length > MAX_MENSAGENS) {
    return { ok: false, erro: `Conversa longa demais: ${messages.length} mensagens, o teto é ${MAX_MENSAGENS}.` };
  }
  const total = messages.reduce((soma, m) => soma + String(m?.content ?? "").length, 0);
  if (total > MAX_CARACTERES) {
    return { ok: false, erro: `Conteúdo grande demais: ${total} caracteres, o teto é ${MAX_CARACTERES}.` };
  }
  return { ok: true, total };
}

/** Caminho do log de auditoria. Vazio = escreve no stdout (que some quando roda como tarefa oculta). */
const ARQUIVO_LOG = (env.SEMENTEIRA_LOG || "").trim();

/**
 * Log de auditoria — uma linha JSON por chamada do gateway, para abuso ficar
 * visível. Registra só o FORMATO da chamada (quem, provedor, modelo, tamanho);
 * nunca o conteúdo das mensagens, que é material dos projetos das pessoas.
 * A escrita é best-effort: falha de log jamais derruba o atendimento.
 */
function registrar(dado) {
  const linha = JSON.stringify({ quando: new Date().toISOString(), ...dado });
  if (!ARQUIVO_LOG) return void console.log(linha);
  fsp.appendFile(ARQUIVO_LOG, linha + "\n").catch(() => {});
}

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
      // Reflete o interruptor: se o Ollama não atende pela web, o app não deve oferecê-lo.
      ollama: OLLAMA_REMOTO,
      tavily: Boolean(TAVILY_API_KEY),
    },
  });
}

async function rotaChat(req, res) {
  if (!exigirToken(req, res)) return;
  if (!dentroDoLimite(req, res, { max: LIMITE_CHAT, balde: "chat" })) return;

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
  if (provedor.kind === "ollama" && !OLLAMA_REMOTO) {
    return responderJson(res, 403, {
      ok: false,
      erro: "O Ollama deste servidor não atende pela web. Use uma chave própria nas Configurações, ou o programa instalado.",
    });
  }
  if (provedor.kind === "openai-compatible" && !provedor.apiKey) {
    return responderJson(res, 503, { ok: false, erro: `O servidor não tem chave configurada para ${corpo.providerId}.` });
  }
  if (!Array.isArray(corpo.messages) || corpo.messages.length === 0) {
    return responderJson(res, 400, { ok: false, erro: "Nenhuma mensagem foi enviada." });
  }

  const modelo = corpo.model || provedor.modeloPadrao;
  if (provedor.kind === "ollama" && OLLAMA_MODELOS_PERMITIDOS.length > 0 && !OLLAMA_MODELOS_PERMITIDOS.includes(modelo)) {
    return responderJson(res, 403, {
      ok: false,
      erro: `O modelo "${modelo}" não está liberado neste servidor. Liberados: ${OLLAMA_MODELOS_PERMITIDOS.join(", ")}.`,
    });
  }

  const tetos = dentroDosTetos(corpo.messages);
  if (!tetos.ok) return responderJson(res, 413, { ok: false, erro: tetos.erro });

  // Guardrail SUAVE — ver o bloco de diretrizes no topo do arquivo.
  const mensagens = ESCOPO_ATIVO ? [{ role: "system", content: DIRETRIZ_ESCOPO }, ...corpo.messages] : corpo.messages;

  registrar({
    evento: "chat",
    cliente: chaveCliente(req),
    provedor: corpo.providerId,
    modelo,
    mensagens: corpo.messages.length,
    caracteres: tetos.total,
  });

  try {
    const conteudo = await chamarLLM({
      kind: provedor.kind,
      baseUrl: provedor.baseUrl,
      apiKey: provedor.apiKey,
      model: modelo,
      messages: mensagens,
      esperaJson: Boolean(corpo.esperaJson),
    });
    responderJson(res, 200, { ok: true, conteudo });
  } catch (erro) {
    responderJson(res, 200, { ok: false, erro: erro instanceof Error ? erro.message : String(erro) });
  }
}

async function rotaModelosOllama(req, res) {
  if (!exigirToken(req, res)) return;
  if (!dentroDoLimite(req, res)) return;
  if (!OLLAMA_REMOTO) {
    return responderJson(res, 403, { ok: false, erro: "O Ollama deste servidor não atende pela web." });
  }
  try {
    const modelos = await listarModelosOllama(PROVEDORES.ollama.baseUrl);
    responderJson(res, 200, { ok: true, modelos });
  } catch (erro) {
    responderJson(res, 200, { ok: false, erro: erro instanceof Error ? erro.message : String(erro) });
  }
}

async function rotaBuscaWeb(req, res) {
  if (!exigirToken(req, res)) return;
  if (!dentroDoLimite(req, res)) return;
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
  // Checa com separador final para não casar uma pasta-irmã tipo `dist-ssr/`
  // (prefixo solto `startsWith(base)` deixaria `../dist-ssr/x` passar).
  if (destino !== DIRETORIO_ESTATICO && !destino.startsWith(DIRETORIO_ESTATICO + path.sep)) {
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
  console.log(`  ollama pela web: ${OLLAMA_REMOTO ? "LIGADO" : "desligado"}`);
  console.log(`  modelos ollama liberados: ${OLLAMA_MODELOS_PERMITIDOS.join(", ") || "todos os instalados"}`);
  console.log(`  tetos: ${LIMITE_CHAT} chat/min · ${LIMITE_MAX} outras/min · ${MAX_MENSAGENS} msgs · ${MAX_CARACTERES} caracteres`);
  console.log(`  diretriz de escopo: ${ESCOPO_ATIVO ? "ativa (guardrail suave)" : "desligada"}`);
});
