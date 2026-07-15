import type { Project } from "./types";
import { extrairTextoDeArquivo } from "./file-extraction";
import { carregarConfigLLM, enviarMensagemLLM, configuracaoLLMPronta } from "./providers";
import { interpretarRespostaRascunho, aplicarRascunhoAoProjeto, type RascunhoDados } from "./draft-generation";
import { montarBlocoDiretrizesGlobais } from "./diretrizes-globais";
import danos from "../data/danos.json";
import arquetipos from "../data/arquetipos.json";

export interface ImportarResultado {
  ok: boolean;
  projeto?: Project;
  erro?: string;
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
    "Você está recebendo o texto extraído de um documento (PDF ou DOCX) que descreve um projeto comunitário.",
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
 */
export async function importarProjetoDeArquivo(arquivo: File, projetoBase: Project): Promise<ImportarResultado> {
  const ext = arquivo.name.toLowerCase().split(".").pop() ?? "";

  // 1. Valida a extensão antes de tudo — mensagem clara.
  if (ext !== "pdf" && ext !== "docx") {
    return { ok: false, erro: `Formato ".${ext}" não é suportado para importação. Use PDF (.pdf) ou Word (.docx).` };
  }

  // 2. Valida a config de IA — sem IA configurada, não dá pra preencher.
  const config = carregarConfigLLM();
  const configPronta = configuracaoLLMPronta(config);
  if (!configPronta.pronta) {
    return { ok: false, erro: `Para importar e preencher automaticamente, configure a IA primeiro. ${configPronta.motivo ?? ""}` };
  }

  // 3. Extrai o texto do documento.
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

  // 4. Pede ao LLM um rascunho estruturado a partir do texto extraído.
  let resposta;
  try {
    const prompt = montarPromptImportacao(textoExtraido);
    const diretrizes = montarBlocoDiretrizesGlobais();
    resposta = await enviarMensagemLLM(config, [
      { role: "user", content: diretrizes ? `${prompt}\n\n${diretrizes}` : prompt },
    ]);
  } catch (e) {
    return { ok: false, erro: `Erro ao contatar a IA.\n\nDetalhe: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!resposta.ok) {
    return { ok: false, erro: `A IA não conseguiu analisar o documento.\n\nDetalhe: ${resposta.erro ?? "erro desconhecido"}\n\nVerifique se o provedor de IA está configurado corretamente.` };
  }

  // 5. Interpreta a resposta da IA — tolerante a JSON malformado.
  const interpretado = interpretarRespostaRascunho(resposta.conteudo ?? "");
  if (!interpretado) {
    return {
      ok: false,
      erro: "A IA respondeu, mas não foi possível interpretar o resultado como um projeto estruturado.\n\nIsso pode acontecer se o documento estiver mal formatado ou se a IA estiver instável. Tente novamente, ou preencha o projeto manualmente usando o texto extraído.",
    };
  }
  if (interpretado.tipo === "perguntas") {
    return { ok: false, erro: `A IA precisou de mais informações para preencher o projeto:\n\n${interpretado.perguntas.map((p, i) => `${i + 1}. ${p}`).join("\n")}` };
  }

  // 6. Aplica o rascunho ao projeto base.
  const dados: RascunhoDados = interpretado.dados;
  let projeto = aplicarRascunhoAoProjeto(projetoBase, dados);
  // Se o título não foi definido, usa o nome do arquivo.
  if (!projeto.tituloEditadoManualmente && !projeto.titulo) {
    projeto = { ...projeto, titulo: arquivo.name.replace(/\.(pdf|docx)$/i, "") };
  }

  // 7. Salva o binário original no disco via IPC — falha aqui não aborta o projeto.
  let caminhoArquivo: string | undefined;
  let erroSalvamento: string | undefined;
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
      } else if (salvamento && !salvamento.ok) {
        erroSalvamento = salvamento.erro;
      }
    }
  } catch (e) {
    erroSalvamento = e instanceof Error ? e.message : String(e);
  }
  // documentoOrigem sempre fica com o texto extraído, mesmo se o binário não salvou.

  projeto = {
    ...projeto,
    ideiaTexto: projeto.ideiaTexto || `[Importado de "${arquivo.name}"] ${textoExtraido.slice(0, 200)}`,
    documentoOrigem: {
      nomeArquivo: arquivo.name,
      textoExtraido,
      anexadoEm: new Date().toISOString(),
      caminhoArquivo,
    },
  };

  return { ok: true, projeto };
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
