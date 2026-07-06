// Teste end-to-end das chamadas reais (Maritaca + Tavily) para os 10 projetos.
// Rode você mesmo no terminal — as chaves ficam só na sua máquina, nunca aparecem aqui.
//
// PowerShell:
//   $env:MARITACA_API_KEY="sua_chave"; $env:TAVILY_API_KEY="sua_chave"; node scripts/teste-fluxo-completo.mjs
//
// Bash:
//   MARITACA_API_KEY="sua_chave" TAVILY_API_KEY="sua_chave" node scripts/teste-fluxo-completo.mjs

const MARITACA_KEY = process.env.MARITACA_API_KEY;
const TAVILY_KEY = process.env.TAVILY_API_KEY;
const MARITACA_MODEL = process.env.MARITACA_MODEL || "sabia-4";
const MARITACA_BASE_URL = "https://chat.maritaca.ai/api";

if (!MARITACA_KEY || !TAVILY_KEY) {
  console.error("Faltam as variáveis de ambiente MARITACA_API_KEY e/ou TAVILY_API_KEY.");
  process.exit(1);
}

const PROJETOS = [
  "Horta Comunitária",
  "Galpão de Reciclagem com Artesanato",
  "Galpão de Costura e Estamparia",
  "Fábrica de Materiais de Construção Reciclados",
  "Cozinha Comunitária",
  "Centro de Formação",
  "Polo de Projetos Culturais",
  "Fábrica de Tijolos Ecológicos",
  "Projeto de Informática (Capacitação)",
  "Plantio de Madeira pra Venda",
];

// Mesma lista de danos/arquétipos usada pelo app (reduzida aqui só p/ o teste).
const DANOS = [
  "renda-trabalho: Perda de renda e trabalho",
  "seguranca-alimentar: Insegurança alimentar e nutricional",
  "cultura-modo-vida: Perda de práticas culturais e modo de vida",
  "meio-ambiente: Dano ambiental direto",
];
const ARQUETIPOS = [
  "horta-comunitaria: Horta Comunitária (tipo 4.2)",
  "galpao-reciclagem-artesanato: Galpão de Reciclagem com Artesanato (tipo 4.1)",
  "galpao-costura-estamparia: Galpão de Costura e Estamparia (tipo 4.1)",
  "fabrica-materiais-reciclados: Fábrica de Materiais de Construção Reciclados (tipo 4.1)",
  "cozinha-comunitaria: Cozinha comunitária (tipo 4.2)",
  "centro-formacao: Centro de Formação (tipo 4.3)",
  "polo-cultural: Polo de Projetos Culturais (tipo 4.2)",
  "fabrica-tijolos-ecologicos: Fábrica de Tijolos Ecológicos (tipo 4.1)",
  "informatica-capacitacao: Projeto de Informática (Capacitação) (tipo 4.3)",
  "plantio-madeira-venda: Plantio de Madeira pra Venda (tipo 4.1)",
];

function montarPromptRascunho(titulo) {
  return [
    `A pessoa quer um projeto chamado/descrito como: "${titulo}".`,
    "Sua tarefa: gerar um RASCUNHO completo desse projeto para o Anexo I.1, revisável pela pessoa depois — nunca é a versão final.",
    "",
    "Regras estritas de saída — siga exatamente uma das duas opções:",
    "",
    "OPÇÃO A — se faltar informação essencial, responda SOMENTE com json de perguntas:",
    '```json\n{"perguntas": ["pergunta 1", "pergunta 2", "pergunta 3"]}\n```',
    "",
    "OPÇÃO B — se já der para rascunhar, responda SOMENTE com json neste formato:",
    '```json\n{"danoId": "um id da lista", "arquetipoId": "um id da lista", "objetivo": "1-2 frases", "justificativa": "1-2 frases", "metas": ["meta 1"], "comoComunidadeAjuda": "1 frase", "missaoImpacto": "1 frase"}\n```',
    "",
    "IMPORTANTE: `danoId` e `arquetipoId` DEVEM ser exatamente um dos ids das listas abaixo.",
    "Danos disponíveis:\n" + DANOS.join("\n"),
    "Arquétipos disponíveis:\n" + ARQUETIPOS.join("\n"),
  ].join("\n");
}

async function chamarMaritaca(prompt) {
  const resp = await fetch(`${MARITACA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MARITACA_KEY}` },
    body: JSON.stringify({ model: MARITACA_MODEL, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`Maritaca ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function buscarTavily(query) {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: TAVILY_KEY, query, search_depth: "advanced", max_results: 3 }),
  });
  if (!resp.ok) throw new Error(`Tavily ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return (data.results ?? []).map((r) => r.title);
}

function extrairBlocoJson(texto) {
  const match = texto.match(/```json\s*([\s\S]*?)```/i) ?? texto.match(/\{[\s\S]*\}/);
  return match ? (match[1] ?? match[0]) : null;
}

async function main() {
  let ok = 0;
  let falhas = 0;

  for (const titulo of PROJETOS) {
    console.log(`\n=== ${titulo} ===`);

    try {
      const resposta = await chamarMaritaca(montarPromptRascunho(titulo));
      const bloco = extrairBlocoJson(resposta);
      if (!bloco) {
        console.log(`  [MARITACA] FALHA — resposta não trouxe bloco json reconhecível.`);
        console.log(`  resposta bruta (300 chars): ${resposta.slice(0, 300)}`);
        falhas++;
      } else {
        const obj = JSON.parse(bloco.trim());
        if (Array.isArray(obj.perguntas)) {
          console.log(`  [MARITACA] OK — pediu esclarecimento: ${obj.perguntas.join(" | ")}`);
        } else {
          const danoValido = DANOS.some((d) => d.startsWith(obj.danoId));
          const arquetipoValido = ARQUETIPOS.some((a) => a.startsWith(obj.arquetipoId));
          console.log(`  [MARITACA] OK — dano="${obj.danoId}" (${danoValido ? "válido" : "INVÁLIDO"}), arquétipo="${obj.arquetipoId}" (${arquetipoValido ? "válido" : "INVÁLIDO"})`);
          console.log(`  objetivo: ${obj.objetivo}`);
          if (!danoValido || !arquetipoValido) falhas++;
          else ok++;
        }
      }
    } catch (erro) {
      console.log(`  [MARITACA] ERRO: ${erro.message}`);
      falhas++;
    }

    try {
      const titulos = await buscarTavily(`preço ${titulo} Minas Gerais Brasil 2026`);
      console.log(`  [TAVILY] OK — ${titulos.length} resultado(s): ${titulos.slice(0, 2).join(" | ")}`);
    } catch (erro) {
      console.log(`  [TAVILY] ERRO: ${erro.message}`);
      falhas++;
    }
  }

  console.log(`\n\nResumo: ${ok} projeto(s) com rascunho válido, ${falhas} falha(s)/inválido(s) de ${PROJETOS.length}.`);
}

main();
