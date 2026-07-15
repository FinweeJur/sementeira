const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
// electron-updater só funciona no app empacotado (não no dev) — require protegido.
let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch {
  // Em desenvolvimento o módulo pode não resolver — tudo bem, update só roda em produção.
}

let mainWindow = null;

/**
 * Chamada direta ao provedor de LLM a partir do processo main — sem gateway
 * externo (decisão do plano v3: app precisa funcionar offline em campo).
 * `kind` decide o formato da requisição: 'openai-compatible' cobre DeepSeek e
 * Maritaca/Sabiá (ambos expõem uma API estilo /chat/completions); 'ollama'
 * usa a API local do Ollama.
 */
async function chamarLLM({ kind, baseUrl, apiKey, model, messages }) {
  if (kind === "ollama") {
    let resp;
    try {
      resp = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: false }),
      });
    } catch {
      throw new Error(
        `Não foi possível conectar ao Ollama em ${baseUrl}. Confirme que o Ollama está rodando (comando "ollama serve" ou o app do Ollama aberto).`,
      );
    }
    if (resp.status === 404) {
      throw new Error(
        `O modelo "${model}" não está baixado no seu Ollama local. Rode "ollama pull ${model}" no terminal, ou troque o modelo em Configurações por um que já esteja instalado (confira com "ollama list").`,
      );
    }
    if (!resp.ok) throw new Error(`Ollama respondeu ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    return data.message?.content ?? "";
  }

  // openai-compatible (DeepSeek, Maritaca/Sabiá)
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!resp.ok) throw new Error(`Provedor respondeu ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Lista os modelos já baixados no Ollama local via GET /api/tags — evita adivinhar nomes/tags que o usuário talvez não tenha instalado. */
async function listarModelosOllama(baseUrl) {
  const resp = await fetch(`${baseUrl}/api/tags`);
  if (!resp.ok) throw new Error(`Ollama respondeu ${resp.status} ao listar modelos.`);
  const data = await resp.json();
  return (data.models ?? []).map((m) => m.name);
}

/**
 * Deep Research via Tavily — única fonte de "internet" do app. Sem chave
 * configurada, a função nem é chamada (bloqueado antes, no renderer); aqui
 * só tratamos falha de rede/chave inválida com mensagem clara.
 */
async function buscarWebTavily({ apiKey, query }) {
  let resp;
  try {
    resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: "advanced", max_results: 5 }),
    });
  } catch {
    throw new Error("Não foi possível conectar à Tavily — verifique sua conexão com a internet.");
  }
  if (resp.status === 401 || resp.status === 403) {
    throw new Error("Chave da Tavily inválida ou sem permissão. Confira a chave em Configurações.");
  }
  if (!resp.ok) throw new Error(`Tavily respondeu ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const resultados = (data.results ?? []).map((r) => ({
    titulo: r.title ?? "",
    url: r.url ?? "",
    conteudo: r.content ?? "",
  }));
  return resultados;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    backgroundColor: "#0f1410",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServer = process.env.SEMENTEIRA_DEV_SERVER;
  if (devServer) {
    mainWindow.loadURL(devServer);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

ipcMain.handle("sementeira:llm:chat", async (_event, request) => {
  try {
    const conteudo = await chamarLLM(request);
    return { ok: true, conteudo };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
});

ipcMain.handle("sementeira:ollama:listarModelos", async (_event, baseUrl) => {
  try {
    const modelos = await listarModelosOllama(baseUrl);
    return { ok: true, modelos };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
});

ipcMain.handle("sementeira:websearch", async (_event, request) => {
  try {
    const resultados = await buscarWebTavily(request);
    return { ok: true, resultados };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
});

/** PDF real via webContents.printToPDF — imprime exatamente a página atual (o renderer deve estar na visão "Documento completo" antes de chamar isso). */
ipcMain.handle("sementeira:pdf:exportar", async (event, sugestaoNomeArquivo) => {
  try {
    const janela = BrowserWindow.fromWebContents(event.sender);
    if (!janela) return { ok: false, erro: "Janela não encontrada." };
    const resultado = await dialog.showSaveDialog(janela, {
      title: "Exportar PDF",
      defaultPath: sugestaoNomeArquivo || "documento.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (resultado.canceled || !resultado.filePath) return { ok: false, erro: "cancelado" };
    const dadosPdf = await janela.webContents.printToPDF({ printBackground: true });
    await fs.writeFile(resultado.filePath, dadosPdf);
    return { ok: true, caminho: resultado.filePath };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
});

/**
 * Salva o documento original (PDF/DOCX) anexado ao importar um projeto — guarda
 * o binário em userData/documentos/<projectId>/ para consulta posterior fiel.
 * Retorna o caminho absoluto onde o arquivo foi salvo.
 */
ipcMain.handle("sementeira:documento:salvar", async (_event, { projectId, nomeArquivo, conteudoBase64 }) => {
  try {
    if (!projectId || !nomeArquivo || !conteudoBase64) {
      return { ok: false, erro: "Dados incompletos para salvar o documento." };
    }
    // Sanitiza o nome do arquivo e do projectId para evitar path traversal.
    const nomeSeguro = path.basename(nomeArquivo).replace(/[^\w.\-]/g, "_");
    const idSeguro = String(projectId).replace(/[^\w-]/g, "");
    const dirDocumentos = path.join(app.getPath("userData"), "documentos", idSeguro);
    await fs.mkdir(dirDocumentos, { recursive: true });
    const caminhoCompleto = path.join(dirDocumentos, nomeSeguro);
    await fs.writeFile(caminhoCompleto, Buffer.from(conteudoBase64, "base64"));
    return { ok: true, caminho: caminhoCompleto };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
});

/**
 * Abre o documento original salvo no disco no aplicativo padrão do SO —
 * para consulta fiel (PDF/DOCX) quando o usuário clica "Ver documento original".
 */
ipcMain.handle("sementeira:documento:abrir", async (_event, caminho) => {
  try {
    if (!caminho || typeof caminho !== "string") {
      return { ok: false, erro: "Caminho inválido." };
    }
    // Garante que o caminho está dentro do diretório de documentos do app.
    const dirDocumentos = path.join(app.getPath("userData"), "documentos");
    const alvoResolvido = path.resolve(caminho);
    if (!alvoResolvido.startsWith(dirDocumentos)) {
      return { ok: false, erro: "Acesso negado: o documento está fora do diretório permitido." };
    }
    await shell.openPath(alvoResolvido);
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
});

/**
 * Auto-update via GitHub Releases — verifica silenciosamente se há versão nova
 * ao abrir o app. Se houver, baixa em background e pergunta se reinicia ao
 * terminar. Em desenvolvimento (electron . direto) o electron-updater não
 * funciona — só roda no app empacotado. Sem internet, falha silenciosamente
 * (o app é offline-first, não pode depender disto pra abrir).
 */
function configurarAutoUpdate() {
  if (!autoUpdater) return;
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", () => {
    if (!mainWindow) return;
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Atualização pronta",
        message: "Uma nova versão da Sementeira foi baixada.",
        detail:
          "Reiniciar agora para aplicar? Você também pode continuar usando — a atualização será aplicada na próxima vez que fechar o app.",
        buttons: ["Reiniciar agora", "Depois"],
      })
      .then((resultado) => {
        if (resultado.response === 0) autoUpdater.quitAndInstall();
      });
  });

  // Verifica update ao abrir — silencioso (só notifica se houver e terminar o download).
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

app.whenReady().then(() => {
  createWindow();
  configurarAutoUpdate();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
