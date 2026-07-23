import type { Project } from "./types";
import { extrairTextoDeArquivo } from "./file-extraction";
import { carregarConfigLLM, enviarMensagemLLM, configuracaoLLMPronta } from "./providers";
import { interpretarRespostaRascunho, aplicarRascunhoAoProjeto, contarCamposPreenchidos, type RascunhoDados } from "./draft-generation";
import { montarBlocoDiretrizesGlobais } from "./diretrizes-globais";
import { extrairRascunhoHeuristico } from "./extracao-heuristica";
import danos from "../data/danos.json";
import arquetipos from "../data/arquetipos.json";

/** Extensões que o app sabe transformar em texto — ver `extrairTextoDeArquivo`. */
export const EXTENSOES_IMPORTAVEIS = ["pdf", "docx", "xlsx", "xlsm", "csv"];

/** Ação que a UI oferece como botão junto do aviso. */
export type AcaoSugerida = "configurar-modelo" | "tentar-ia-novamente";

/** Por que o projeto não foi preenchido pela IA. */
export type CausaSemIa =
  | "ia-nao-configurada"
  | "ia-indisponivel"
  | "resposta-ininteligivel"
  | "resposta-vazia"
  | "ia-pediu-informacoes";

export interface ImportarResultado {
  ok: boolean;
  projeto?: Project;
  /** Só nos erros REAIS de insumo: extensão inválida, falha de leitura, texto curto demais. */
  erro?: string;
  acao?: AcaoSugerida;
  /**
   * Presente sempre que o projeto NÃO foi preenchido pela IA. Ausente
   * significa que a IA preencheu. Um objeto só, com discriminante — em vez de
   * espalhar bandeiras soltas pelo resultado.
   */
  semIa?: {
    causa: CausaSemIa;
    /** Frase pronta para a tela, no vocabulário de quem usa. */
    motivo: string;
    /** Detalhe do provedor, mostrado discretamente (ex.: "model not found"). */
    detalheTecnico?: string;
    camposPreenchidos: (keyof RascunhoDados)[];
    /** Só em "ia-pediu-informacoes": vira lista de pendências na tela. */
    perguntas?: string[];
  };
}

/**
 * Converte um File em base64 — para enviar o binário ao processo main via IPC
 * (que salva no disco em userData/documentos/<projectId>/).
 */
function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o prefixo "data:application/pdf;base64," deixando só o base64 puro.
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(arquivo);
  });
}

function montarPromptImportacao(textoDocumento: string): string {
  const listaDanos = danos.map((d) => `- ${d.id}: ${d.nome}`).join("\n");
  const listaArquetipos = arquetipos.map((a) => `- ${a.id}: ${a.nome} (tipo ${a.tipo})`).join("\n");

  return [
    "Você está recebendo o conteúdo de um documento (PDF, Word ou planilha) que descreve um projeto comunitário.",
    "Sua tarefa: extrair deste documento um RASCUNHO estruturado de projeto para o Anexo I.1, preenchendo os campos a partir do que está escrito — sem inventar dados que não estejam no documento.",
    "",
    "Se o documento não tiver informações suficientes para pelo menos objetivo, justificativa e metas, responda com perguntas no formato abaixo para que o usuário complete o que falta:",
    '```json\n{"perguntas": ["pergunta 1", "pergunta 2"]}\n```',
    "",
    "Se já der para extrair, responda SOMENTE com um bloco json neste formato, sem mais nada:",
    '```json\n{"danoId": "um id da lista de danos (ou omita se nenhum combinar)", "arquetipoId": "um id da lista de arquétipos (ou omita)", "objetivo": "objetivo geral extraído", "objetivosEspecificos": ["objetivo específico 1", "objetivo específico 2"], "justificativa": "justificativa extraída", "metas": ["meta 1", "meta 2"], "indicadores": [{"nome": "o que medir", "meta": "valor/prazo", "meioVerificacao": "como comprovar", "frequencia": "mensal/trimestral"}], "boasPraticas": ["prática 1"], "comoComunidadeAjuda": "texto extraído", "missaoImpacto": "texto extraído", "equipe": [{"nome": "papel/função", "formacaoNecessaria": "...", "horasSemanais": 20, "duracaoMeses": 6, "planoTrabalho": "o que faz"}]}\n```',
    "",
    "IMPORTANTE: extraia o que estiver no documento. Se um campo não estiver presente, omita-o do JSON (não invente). Os ids de danoId/arquetipoId DEVEM ser exatamente um dos ids das listas abaixo — nunca invente um id novo.",
    "",
    "Danos coletivos disponíveis:\n" + listaDanos,
    "Arquétipos de projeto disponíveis:\n" + listaArquetipos,
    "",
    "--- INÍCIO DO DOCUMENTO ---",
    textoDocumento.slice(0, 12000),
    "--- FIM DO DOCUMENTO ---",
  ].join("\n");
}

/**
 * Importa um projeto a partir de um PDF/DOCX: extrai o texto, pede ao LLM um
 * rascunho estruturado, e guarda o documento original no disco (via IPC) para
 * consulta posterior. O texto extraído também fica no projeto para preview/IA.
 *
 * INVARIANTE: passada a extração do texto (passo 2), esta função NUNCA mais
 * devolve `ok: false`. Toda falha da IA — não configurada, fora do ar,
 * resposta ilegível, resposta vazia ou pedido de informação — vira plano B
 * pela heurística determinística, com `semIa.causa` dizendo o que houve.
 * Um documento já lido nunca é jogado fora: preencher metade é melhor que
 * mandar a pessoa começar do zero.
 */
export async function importarProjetoDeArquivo(arquivo: File, projetoBase: Project): Promise<ImportarResultado> {
  const ext = arquivo.name.toLowerCase().split(".").pop() ?? "";

  // 1. Valida a extensão antes de tudo — mensagem clara. Planilha entra aqui
  // só quando o cabeçalho NÃO foi reconhecido (ver importar-planilha.ts): ela
  // vira tabela Markdown e segue por este mesmo pipeline, ganhando a IA e o
  // plano B heurístico em vez de ser descartada por formato.
  if (!EXTENSOES_IMPORTAVEIS.includes(ext)) {
    return { ok: false, erro: `Formato ".${ext}" não é suportado para importação. Use PDF (.pdf), Word (.docx), Excel (.xlsx) ou CSV (.csv).` };
  }

  // 2. Extrai o texto do documento. Vem ANTES de exigir IA de propósito: a
  // leitura não depende de modelo nenhum, e jogar fora um documento já lido
  // só porque não há IA configurada é desperdício — ver o plano B no passo 3.
  let textoExtraido: string;
  try {
    const extracao = await extrairTextoDeArquivo(arquivo);
    if (!extracao.ok || !extracao.texto) {
      return { ok: false, erro: `Não foi possível ler o conteúdo do arquivo.\n\nDetalhe: ${extracao.erro ?? "erro desconhecido"}\n\nVerifique se o arquivo não está corrompido ou protegido por senha.` };
    }
    textoExtraido = extracao.texto;
  } catch (e) {
    return { ok: false, erro: `Erro ao extrair texto do ${ext.toUpperCase()}.\n\nDetalhe: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (textoExtraido.trim().length < 50) {
    return { ok: false, erro: "O documento parece estar vazio ou não tem texto suficiente para extrair (pode ser um PDF de imagens sem OCR, ou um DOCX em branco)." };
  }

  // A partir daqui o documento já está lido: todo caminho termina em projeto.
  const heuristica = extrairRascunhoHeuristico(textoExtraido);

  /** Monta o resultado do plano B — os 5 pontos de queda passam por aqui. */
  async function planoB(
    causa: CausaSemIa,
    motivo: string,
    extras?: { acao?: AcaoSugerida; detalheTecnico?: string; perguntas?: string[] },
  ): Promise<ImportarResultado> {
    const projeto = await finalizarProjeto(aplicarRascunhoAoProjeto(projetoBase, heuristica.dados), arquivo, textoExtraido);
    return {
      ok: true,
      projeto,
      acao: extras?.acao,
      semIa: {
        causa,
        motivo,
        detalheTecnico: extras?.detalheTecnico,
        camposPreenchidos: heuristica.camposPreenchidos,
        perguntas: extras?.perguntas,
      },
    };
  }

  // 3. Sem IA configurada.
  const config = carregarConfigLLM();
  const configPronta = configuracaoLLMPronta(config);
  if (!configPronta.pronta) {
    return planoB("ia-nao-configurada", configPronta.motivo ?? "A IA ainda não está configurada.", { acao: "configurar-modelo" });
  }

  // 4. Pede ao LLM um rascunho estruturado a partir do texto extraído.
  let resposta;
  try {
    const prompt = montarPromptImportacao(textoExtraido);
    const diretrizes = montarBlocoDiretrizesGlobais();
    resposta = await enviarMensagemLLM(config, [
      { role: "user", content: diretrizes ? `${prompt}\n\n${diretrizes}` : prompt },
    ], { esperaJson: true });
  } catch (e) {
    return planoB("ia-indisponivel", "Não foi possível falar com a IA agora.", {
      acao: "configurar-modelo",
      detalheTecnico: e instanceof Error ? e.message : String(e),
    });
  }

  if (!resposta.ok) {
    return planoB("ia-indisponivel", "Não foi possível falar com a IA agora.", {
      acao: "configurar-modelo",
      detalheTecnico: resposta.erro ?? "erro desconhecido",
    });
  }

  // 5. Interpreta a resposta da IA — tolerante a JSON malformado.
  const interpretado = interpretarRespostaRascunho(resposta.conteudo ?? "");
  if (!interpretado) {
    return planoB("resposta-ininteligivel", "A IA respondeu, mas o texto não veio no formato estruturado que o app consegue ler.", {
      acao: "tentar-ia-novamente",
    });
  }
  if (interpretado.tipo === "perguntas") {
    return planoB("ia-pediu-informacoes", "A IA leu o documento mas achou que faltava informação para preencher sozinha.", {
      acao: "tentar-ia-novamente",
      perguntas: interpretado.perguntas,
    });
  }
  if (contarCamposPreenchidos(interpretado.dados) === 0) {
    return planoB("resposta-vazia", "A IA respondeu no formato certo, mas sem nenhum campo preenchido.", {
      acao: "tentar-ia-novamente",
    });
  }

  // 6. Aplica o rascunho. A heurística entra como CAMADA DE BAIXO e a IA
  // sobrepõe: as duas leem o mesmo documento, não competem. Assim um campo
  // que a IA deixou de fora, mas que estava sob um título óbvio, não se perde.
  const dados: RascunhoDados = interpretado.dados;
  const comHeuristica = aplicarRascunhoAoProjeto(projetoBase, heuristica.dados);
  const projeto = await finalizarProjeto(aplicarRascunhoAoProjeto(comHeuristica, dados), arquivo, textoExtraido);
  return { ok: true, projeto };
}

/**
 * Fecha o projeto importado, venha ele da IA ou do plano B: garante título,
 * guarda o binário original no disco via IPC e anexa o texto extraído.
 * Falha ao salvar o binário não aborta nada — o texto já basta para trabalhar.
 */
async function finalizarProjeto(projetoBruto: Project, arquivo: File, textoExtraido: string): Promise<Project> {
  let projeto = projetoBruto;
  if (!projeto.tituloEditadoManualmente && !projeto.titulo) {
    projeto = { ...projeto, titulo: arquivo.name.replace(/\.(pdf|docx|xlsx|xlsm|csv)$/i, "") };
  }

  let caminhoArquivo: string | undefined;
  try {
    if (window.sementeira?.salvarDocumento) {
      const base64 = await arquivoParaBase64(arquivo);
      const salvamento = await window.sementeira.salvarDocumento({
        projectId: projeto.id,
        nomeArquivo: arquivo.name,
        conteudoBase64: base64,
      });
      if (salvamento?.ok && salvamento.caminho) {
        caminhoArquivo = salvamento.caminho;
      }
    }
  } catch {
    // Se falhar ao salvar o binário, o projeto ainda é válido com o texto extraído.
  }

  return {
    ...projeto,
    ideiaTexto: projeto.ideiaTexto || `[Importado de "${arquivo.name}"] ${textoExtraido.slice(0, 200)}`,
    documentoOrigem: {
      nomeArquivo: arquivo.name,
      textoExtraido,
      anexadoEm: new Date().toISOString(),
      caminhoArquivo,
    },
  };
}

/**
 * Abre o documento original (PDF/DOCX) no aplicativo padrão do SO —
 * para consulta fiel quando o usuário clica "Ver documento original".
 */
export async function abrirDocumentoOrigem(caminho: string): Promise<{ ok: boolean; erro?: string }> {
  if (!window.sementeira?.abrirDocumento) {
    return { ok: false, erro: "Recurso disponível apenas no app desktop." };
  }
  const resultado = await window.sementeira.abrirDocumento(caminho);
  if (!resultado.ok) return { ok: false, erro: resultado.erro };
  return { ok: true };
}
