// Teste end-to-end do Ciclo de Lapidação (Fase 7) — espelha exatamente os
// prompts de src/lib/refinement-loop.ts e src/lib/refinement-ecosystem.ts.
// Rode você mesmo no terminal — a chave nunca aparece aqui.
//
// PowerShell:
//   $env:MARITACA_API_KEY="sua_chave"; node scripts/teste-loop-lapidacao.mjs
//
// Bash:
//   MARITACA_API_KEY="sua_chave" node scripts/teste-loop-lapidacao.mjs

const MARITACA_KEY = process.env.MARITACA_API_KEY;
const MARITACA_MODEL = process.env.MARITACA_MODEL || "sabia-4";
const MARITACA_BASE_URL = "https://chat.maritaca.ai/api";

if (!MARITACA_KEY) {
  console.error("Falta a variável de ambiente MARITACA_API_KEY.");
  process.exit(1);
}

async function chamar(prompt) {
  const resp = await fetch(`${MARITACA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MARITACA_KEY}` },
    body: JSON.stringify({ model: MARITACA_MODEL, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`Maritaca ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function extrairBlocoJson(texto) {
  const match = texto.match(/```json\s*([\s\S]*?)```/i) ?? texto.match(/\{[\s\S]*\}/);
  return match ? (match[1] ?? match[0]) : null;
}

function parseJson(texto) {
  const bloco = extrairBlocoJson(texto);
  if (!bloco) return null;
  try {
    return JSON.parse(bloco.trim());
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------
// Projeto de teste — mesmo shape/conteúdo do seed "Cozinha Comunitária do Retiro"
// -----------------------------------------------------------------------

const PROJETO = {
  titulo: "Cozinha Comunitária do Retiro",
  arquetipo: "Cozinha comunitária",
  tipoOficio46: "4.2",
  dano: "Insegurança alimentar e nutricional",
  local: "Comunidade do Retiro, Brumadinho/MG",
  abrangencia: "local",
  objetivo: "Garantir acesso a refeições coletivas de qualidade para famílias atingidas, fortalecendo também os vínculos comunitários rompidos pelo desastre.",
  justificativa: "Responde diretamente à insegurança alimentar e à ruptura de vínculos comunitários identificadas no diagnóstico — a cozinha é também um espaço de convivência.",
  // Meta propositalmente exagerada para verificar se o Crítico-realista pega.
  metas: ["10.000 refeições coletivas servidas por dia em 12 meses", "Responsável formal pela operação definido e treinado até o mês 6"],
  comoComunidadeAjuda: "Famílias se revezam no preparo e na limpeza; parte da comunidade contribui com hortaliças e insumos próprios.",
  missaoImpacto: "Recupera o convívio comunitário perdido, com a alimentação coletiva como ponto de encontro.",
  cronograma: "9 meses até operação plena.",
  formasArrecadacao: ["Contribuição coletiva mensal simbólica das famílias atendidas", "Doação de hortaliças da Horta Comunitária do Parque da Cachoeira"],
  orcamento: [
    { id: "l1", categoria: "infraestrutura", descricao: "Construção/reforma do espaço da cozinha", valor: 30000 },
    { id: "l2", categoria: "equipamento", descricao: "Fogões industriais, utensílios, mobiliário", valor: 20000 },
    {
      id: "l3",
      categoria: "operacao-assistida",
      descricao: "Fase piloto de operação (implantação + insumos alimentares da fase piloto)",
      valor: 15000,
      prazoMeses: 6,
      fonteCusteioFuturo: "Contribuição coletiva simbólica por refeição assume os insumos a partir do mês 7",
    },
  ],
  custosNaoCobertos: [{ nome: "Energia (uso permanente)", valorMensalEstimado: 400, fonteCusteioFuturo: "Contribuição coletiva mensal das famílias atendidas" }],
  cenarios: [
    { nome: "otimista", receitaMensalEstimada: 1800, custoOperacionalMensal: 1200 },
    { nome: "realista", receitaMensalEstimada: 1200, custoOperacionalMensal: 1200 },
    { nome: "pessimista", receitaMensalEstimada: 600, custoOperacionalMensal: 1200 },
  ],
  riscos: [{ id: "r1", descricao: "Baixa adesão à contribuição coletiva", probabilidade: "medio", impacto: "alto", mitigacao: "Pactuar o valor simbólico em assembleia antes do início da operação piloto" }],
  posCompleto: {},
};

const CONTEXTO_BASE = [
  "Contexto: projeto comunitário do Anexo I.1 (reparação Brumadinho/bacia do Paraopeba). Regras duras do Ofício 46: vedado custeio permanente sem fonte futura; capital de giro/insumos preferencialmente ≤6 meses (exceção só com justificativa de ciclo produtivo); política pública exige anuência do ente público; todo projeto precisa se sustentar sozinho após o repasse (POS).",
  "Responda SEMPRE em português simples. Responda SOMENTE com o bloco json pedido, sem nenhum texto fora dele.",
].join("\n");

function resumoProjeto(p) {
  return JSON.stringify(p, null, 1);
}

function promptEscritor(p) {
  return [
    CONTEXTO_BASE,
    "Papel: ESCRITOR. Melhore a clareza e a especificidade dos textos do projeto abaixo, sem inventar fatos, números ou locais novos — só reescreva melhor o que já existe (mais concreto, menos genérico).",
    "Projeto:", resumoProjeto(p),
    'Formato: ```json\n{"objetivo": "...", "justificativa": "...", "metas": ["..."], "comoComunidadeAjuda": "...", "missaoImpacto": "..."}\n``` (omita campos que já estão bons).',
  ].join("\n\n");
}

function promptOrcamentista(p) {
  return [
    CONTEXTO_BASE,
    "Papel: ORÇAMENTISTA. Revise as linhas de orçamento: valores incoerentes entre si, prazos errados, itens típicos faltando para esse tipo de projeto.",
    "REGRAS ESTRITAS: você pode ajustar linhas EXISTENTES (valor/prazo/descrição) e pode ADICIONAR linhas faltantes, mas toda linha NOVA deve vir com valor 0 e a descrição terminando em '(pesquisar preço)' — NUNCA invente um valor de mercado.",
    "Projeto:", resumoProjeto(p),
    'Formato: ```json\n{"orcamento": [{"id": "id-existente-ou-omitir-se-nova", "categoria": "infraestrutura|equipamento|regularizacao|capacitacao|capital-giro-inicial|insumos-iniciais|equipe-implantacao|operacao-assistida|folha-permanente|outro", "descricao": "...", "valor": 0, "prazoMeses": null, "fonteCusteioFuturo": null, "justificativaCicloProdutivo": null}], "observacoes": ["por que mudou o quê"]}\n``` — devolva a lista COMPLETA de linhas (as mantidas + ajustadas + novas).',
  ].join("\n\n");
}

function promptCritico(p) {
  return [
    CONTEXTO_BASE,
    "Papel: CRÍTICO-REALISTA. Ataque o projeto: metas superdimensionadas ou vagas, receitas otimistas demais, prazos irreais, dependências não declaradas, sustentabilidade frágil. Seja específico e duro, mas justo.",
    "Projeto:", resumoProjeto(p),
    'Formato: ```json\n{"problemas": ["problema concreto 1", "problema concreto 2"]}\n```',
  ].join("\n\n");
}

function promptRiscos(p) {
  return [
    CONTEXTO_BASE,
    "Papel: ANALISTA DE RISCOS. Complete/melhore a matriz de riscos (o que pode barrar ou quebrar o projeto) e aponte insuficiências (campos vazios ou fracos que enfraquecem o projeto perante a Governança). Matriz de risco NÃO é desculpa para atraso (Ofício 45).",
    "Projeto:", resumoProjeto(p),
    'Formato: ```json\n{"riscos": [{"descricao": "...", "probabilidade": "baixo|medio|alto", "impacto": "baixo|medio|alto", "mitigacao": "..."}], "insuficiencias": ["..."]}\n``` — devolva a lista COMPLETA de riscos (existentes melhorados + novos).',
  ].join("\n\n");
}

function promptSugestor(p) {
  return [
    CONTEXTO_BASE,
    "Papel: SUGESTOR. Sugestões acionáveis de melhoria: parcerias possíveis, formas de arrecadação adicionais, integração com outros projetos comunitários, fortalecimento do POS.",
    "Projeto:", resumoProjeto(p),
    'Formato: ```json\n{"sugestoes": ["sugestão acionável 1", "sugestão 2"]}\n```',
  ].join("\n\n");
}

function promptCompilador(p, saidas) {
  return [
    CONTEXTO_BASE,
    "Papel: COMPILADOR. Você recebe o projeto original e as saídas dos outros 5 agentes. Produza UMA versão consolidada melhorada do projeto, incorporando o que for bom e corrigindo o que o crítico apontou. Não invente valores de orçamento novos (linhas novas ficam com valor 0). Não invente fatos.",
    "Projeto original:", resumoProjeto(p),
    "Saída do Escritor:", JSON.stringify(saidas.escritor ?? {}),
    "Saída do Orçamentista:", JSON.stringify(saidas.orcamentista ?? {}),
    "Problemas do Crítico:", JSON.stringify(saidas.critico),
    "Saída do Analista de Riscos:", JSON.stringify(saidas.riscos ?? {}),
    "Sugestões do Sugestor:", JSON.stringify(saidas.sugestor),
    'Formato: ```json\n{"objetivo": "...", "justificativa": "...", "metas": ["..."], "comoComunidadeAjuda": "...", "missaoImpacto": "...", "cronograma": "...", "formasArrecadacao": ["..."], "orcamento": [...], "riscos": [...], "posCompleto": {"responsavelOperacao": "...", "fonteCusteioFuturoGeral": "...", "metodologiaTransicao": "...", "indicadoresAutonomia": "..."}, "changelog": ["o que mudou e por quê — máximo 10 itens"]}\n``` (omita campos sem mudança; changelog obrigatório).',
  ].join("\n\n");
}

// -----------------------------------------------------------------------
// Validações (mesmos guardrails do código real)
// -----------------------------------------------------------------------

const CATEGORIAS_VALIDAS = ["infraestrutura", "equipamento", "regularizacao", "capacitacao", "capital-giro-inicial", "insumos-iniciais", "equipe-implantacao", "operacao-assistida", "folha-permanente", "outro"];
const NIVEIS_VALIDOS = ["baixo", "medio", "alto"];

function validarOrcamentoNovo(linhas, idsOriginais) {
  const problemas = [];
  for (const l of linhas ?? []) {
    const ehNova = !idsOriginais.has(l.id);
    if (ehNova && typeof l.valor === "number" && l.valor > 0) {
      problemas.push(`Linha nova "${l.descricao}" veio com valor R$${l.valor} — deveria ser 0 (guardrail violado pelo modelo, seria corrigido pela sanitização do app).`);
    }
    if (!CATEGORIAS_VALIDAS.includes(l.categoria)) {
      problemas.push(`Categoria inválida "${l.categoria}" na linha "${l.descricao}".`);
    }
  }
  return problemas;
}

function validarRiscos(riscos) {
  const problemas = [];
  for (const r of riscos ?? []) {
    if (!NIVEIS_VALIDOS.includes(r.probabilidade)) problemas.push(`Nível de probabilidade inválido: "${r.probabilidade}"`);
    if (!NIVEIS_VALIDOS.includes(r.impacto)) problemas.push(`Nível de impacto inválido: "${r.impacto}"`);
  }
  return problemas;
}

// -----------------------------------------------------------------------
// Execução — 1 volta do ciclo de 6 papéis
// -----------------------------------------------------------------------

async function testarLoopProjeto() {
  console.log("\n=== TESTE 1: Ciclo de Lapidação (projeto individual, 1 volta) ===");
  console.log(`Projeto: "${PROJETO.titulo}" — meta propositalmente exagerada (10.000 refeições/dia) para testar o Crítico.\n`);

  const idsOriginais = new Set(PROJETO.orcamento.map((l) => l.id));
  const saidas = {};

  for (const [nome, fn] of [["escritor", promptEscritor], ["orcamentista", promptOrcamentista], ["critico", promptCritico], ["riscos", promptRiscos], ["sugestor", promptSugestor]]) {
    process.stdout.write(`  [${nome}] chamando... `);
    const resp = await chamar(fn(PROJETO));
    const json = parseJson(resp);
    saidas[nome] = json ?? {};
    console.log(json ? "OK" : "FALHA (json não interpretável)");
    if (!json) console.log("    resposta bruta (300 chars):", resp.slice(0, 300));
  }

  console.log("\n  Problemas apontados pelo Crítico:", JSON.stringify(saidas.critico?.problemas ?? [], null, 2));
  const mencionaMetaExagerada = (saidas.critico?.problemas ?? []).some((p) => /10\.?000|refeiç/i.test(p));
  console.log(`  Crítico pegou a meta exagerada? ${mencionaMetaExagerada ? "SIM ✔" : "NÃO ✘ (revisar prompt)"}`);

  process.stdout.write("  [compilador] chamando... ");
  const respCompilador = await chamar(promptCompilador(PROJETO, { escritor: saidas.escritor, orcamentista: saidas.orcamentista, critico: saidas.critico?.problemas ?? [], riscos: saidas.riscos, sugestor: saidas.sugestor?.sugestoes ?? [] }));
  const compilado = parseJson(respCompilador);
  console.log(compilado ? "OK" : "FALHA");

  if (compilado) {
    console.log("\n  Changelog do Compilador:");
    for (const item of compilado.changelog ?? []) console.log(`    - ${item}`);

    const problemasOrcamento = validarOrcamentoNovo(compilado.orcamento, idsOriginais);
    const problemasRiscos = validarRiscos(compilado.riscos);
    console.log(`\n  Guardrail orçamento (nenhum valor inventado em linha nova): ${problemasOrcamento.length === 0 ? "OK ✔" : "VIOLADO ✘"}`);
    problemasOrcamento.forEach((p) => console.log(`    ! ${p}`));
    console.log(`  Guardrail riscos (níveis válidos): ${problemasRiscos.length === 0 ? "OK ✔" : "VIOLADO ✘"}`);
    problemasRiscos.forEach((p) => console.log(`    ! ${p}`));

    if (compilado.metas) {
      const aindaExagerada = compilado.metas.some((m) => /10\.?000/.test(m));
      console.log(`  Meta exagerada corrigida na versão final? ${aindaExagerada ? "NÃO ✘ (ainda tem 10.000)" : "SIM ✔"}`);
      console.log("  Novas metas:", JSON.stringify(compilado.metas, null, 2));
    }
  }

  return compilado != null;
}

// -----------------------------------------------------------------------
// Execução — ciclo de 3 papéis (ecossistema), versão reduzida com 2 projetos
// -----------------------------------------------------------------------

const PROJETOS_ECO = [
  { titulo: "Galpão de Reciclagem com Artesanato do Casa Branca", arquetipo: "Galpão de Reciclagem com Artesanato", tipo: "4.1", local: "Bairro Casa Branca", saldo: -800, objetivo: "Gerar renda via triagem de recicláveis e artesanato." },
  { titulo: "Fábrica Regional de Materiais de Construção Reciclados", arquetipo: "Fábrica de Materiais de Construção Reciclados", tipo: "4.1", local: "Região 3", saldo: 1500, objetivo: "Produzir blocos e agregados a partir de resíduos reciclados." },
  { titulo: "Fábrica Regional de Tijolos Ecológicos", arquetipo: "Fábrica de Tijolos Ecológicos", tipo: "4.1", local: "Região 3", saldo: 900, objetivo: "Produzir tijolos ecológicos de solo-cimento." },
];

function resumoPortfolio(projetos) {
  return projetos.map((p, i) => `${i + 1}. "${p.titulo}" — ${p.arquetipo} (${p.tipo}), local: ${p.local}, saldo realista: R$${p.saldo}/mês, objetivo: ${p.objetivo}`).join("\n");
}

const CONTEXTO_PORTFOLIO = [
  "Contexto: portfólio de projetos comunitários do Anexo I.1 (reparação Brumadinho). Regras: Ofício 46 veda custeio permanente sem fonte futura; projetos produtivos precisam de mercado comprador (4.1 §4).",
  "Responda em português simples. Responda SOMENTE com o bloco json pedido, sem texto fora dele.",
].join("\n");

async function testarLoopEcossistema() {
  console.log("\n=== TESTE 2: Ciclo de Lapidação do Ecossistema (3 papéis) ===");
  const resumo = resumoPortfolio(PROJETOS_ECO);
  console.log("Projetos:\n" + resumo + "\n");

  process.stdout.write("  [critico] chamando... ");
  const critico = parseJson(
    await chamar([CONTEXTO_PORTFOLIO, "Papel: CRÍTICO. Avalie o conjunto de projetos: conexões frágeis ou fictícias, redundâncias não tratadas, projetos isolados sem integração.", "Projetos:", resumo, 'Formato: ```json\n{"problemas": ["..."]}\n```'].join("\n\n")),
  );
  console.log(critico ? "OK" : "FALHA");
  console.log("  Problemas:", JSON.stringify(critico?.problemas ?? [], null, 2));

  const detectouSobreposicao = (critico?.problemas ?? []).some((p) => /reciclad|tijolo|concorr|sobrepos|redund/i.test(p));
  console.log(`  Detectou a sobreposição Fábrica de Materiais × Tijolos? ${detectouSobreposicao ? "SIM ✔" : "NÃO — pode ser normal, revisar manualmente"}`);

  process.stdout.write("  [sugestor] chamando... ");
  const sugestor = parseJson(
    await chamar(
      [CONTEXTO_PORTFOLIO, "Papel: SUGESTOR. Proponha integrações concretas entre os projetos (quem fornece/compra de quem). Use SÓ os projetos da lista.", "Projetos:", resumo, "Problemas:", JSON.stringify(critico?.problemas ?? []), 'Formato: ```json\n{"sugestoesPorProjeto": [{"numeroProjeto": 1, "sugestao": "..."}]}\n```'].join(
        "\n\n",
      ),
    ),
  );
  console.log(sugestor ? "OK" : "FALHA");
  const sugestoes = sugestor?.sugestoesPorProjeto ?? [];
  const numerosValidos = sugestoes.every((s) => typeof s.numeroProjeto === "number" && s.numeroProjeto >= 1 && s.numeroProjeto <= PROJETOS_ECO.length);
  console.log(`  Todas as sugestões referenciam projeto real (1-${PROJETOS_ECO.length})? ${numerosValidos ? "SIM ✔" : "NÃO ✘ — projeto inventado detectado"}`);
  sugestoes.forEach((s) => console.log(`    - #${s.numeroProjeto} (${PROJETOS_ECO[s.numeroProjeto - 1]?.titulo ?? "??"}): ${s.sugestao}`));

  process.stdout.write("  [compilador] chamando... ");
  const compilador = parseJson(
    await chamar(
      [CONTEXTO_PORTFOLIO, "Papel: COMPILADOR. Produza a versão melhorada da análise do ecossistema.", "Projetos:", resumo, "Problemas:", JSON.stringify(critico?.problemas ?? []), "Sugestões:", JSON.stringify(sugestoes), 'Formato: ```json\n{"complementaridades": ["..."], "redundancias": ["..."], "mercadosCompradores": ["..."], "changelog": ["máx 10 itens"]}\n```'].join(
        "\n\n",
      ),
    ),
  );
  console.log(compilador ? "OK" : "FALHA");
  if (compilador) {
    console.log("  Redundâncias na versão final:", JSON.stringify(compilador.redundancias, null, 2));
  }

  return compilador != null && numerosValidos;
}

// -----------------------------------------------------------------------

async function main() {
  const r1 = await testarLoopProjeto();
  const r2 = await testarLoopEcossistema();

  console.log("\n\n=== RESUMO ===");
  console.log(`Loop de projeto (6 papéis): ${r1 ? "OK" : "FALHOU"}`);
  console.log(`Loop de ecossistema (3 papéis): ${r2 ? "OK" : "FALHOU"}`);
}

main().catch((e) => {
  console.error("Erro fatal:", e.message);
  process.exit(1);
});
