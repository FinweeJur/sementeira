/**
 * Núcleo das chamadas de IA e de busca web, compartilhado entre o processo main
 * do Electron (app instalado) e o servidor local que serve a versão web
 * (`servidor/sementeira-servidor.cjs`).
 *
 * Está num módulo próprio, e não dentro do main.cjs, porque as duas superfícies
 * precisam se comportar EXATAMENTE igual: mesma requisição, mesmo parsing, mesmas
 * mensagens de erro. Com uma cópia em cada lado, o primeiro ajuste de provedor já
 * faria a versão web divergir da instalada.
 *
 * Nada aqui depende de Electron — é `fetch` puro, roda em qualquer Node >= 20.
 */

/**
 * Chamada direta ao provedor de LLM. `kind` decide o formato da requisição:
 * 'openai-compatible' cobre DeepSeek e Maritaca/Sabiá (ambos expõem uma API
 * estilo /chat/completions); 'ollama' usa a API local do Ollama.
 */
async function chamarLLM({ kind, baseUrl, apiKey, model, messages, esperaJson }) {
  if (kind === "ollama") {
    const corpo = { model, messages, stream: false };
    if (esperaJson) {
      // `format: "json"` restringe a decodificação a JSON sintaticamente
      // válido. Sem isso, modelo pequeno entrega JSON truncado, vírgula
      // sobrando ou quebra de linha crua dentro de string — e a resposta
      // inteira era descartada.
      corpo.format = "json";
      // Sem `num_ctx` explícito o Ollama usa um contexto curto por padrão, e
      // o prompt de importação (documento + listas de danos e arquétipos)
      // passa disso com folga: a resposta saía cortada no meio.
      corpo.options = { num_ctx: 8192, num_predict: 2048 };
    }
    let resp;
    try {
      resp = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
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
  const corpoOpenai = { model, messages };
  // Equivalente do `format: "json"` do Ollama nessa família de API.
  if (esperaJson) corpoOpenai.response_format = { type: "json_object" };
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(corpoOpenai),
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
  return (data.results ?? []).map((r) => ({
    titulo: r.title ?? "",
    url: r.url ?? "",
    conteudo: r.content ?? "",
  }));
}

module.exports = { chamarLLM, listarModelosOllama, buscarWebTavily };
