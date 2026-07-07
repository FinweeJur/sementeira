import type { Project, Voluntario } from "./types";
import { carregarConfigLLM, enviarMensagemLLM, type ChatMessage } from "./providers";
import { parseJsonDeResposta } from "./json-parsing";
import { lapidarProjeto, commitarVersaoLapidada, calcularScore } from "./refinement-loop";
import { exportarProjetoDocx, exportarProjetoXlsx, exportarProjetoPdf } from "./export";
import { carregarVoluntarios, salvarVoluntarios } from "./voluntarios";
import { mesAtualDoProjeto, orientacaoDoMes } from "./acompanhamento";

/**
 * Copiloto de PORTFÓLIO (Fase 14c) — diferente do CopilotoChat (que só ajuda a
 * preencher UM projeto aberto). Este dialoga sobre qualquer projeto do
 * portfólio e pode executar um conjunto FECHADO de ações determinísticas —
 * nunca escreve/roda código livre. A IA só escolhe QUAL ação e COM QUAIS
 * parâmetros; a execução em si é sempre a mesma função já existente e testada
 * no resto do app (mesmo gate de segurança: versionamento reversível,
 * motor de conformidade como juiz).
 */
export type AcaoAgente = "lapidar_projeto" | "abrir_projeto" | "gerar_documento" | "consultar_status" | "registrar_voluntario" | "marcar_projeto_iniciado" | null;

export interface ComandoInterpretado {
  resposta: string;
  acao: AcaoAgente;
  parametros: Record<string, unknown>;
}

export interface ContextoAgente {
  projects: Project[];
  onAtualizarProjeto: (p: Project) => void;
  onAbrirProjeto: (id: string) => void;
}

function resolverProjetoPorTitulo(titulo: string | undefined, projects: Project[]): Project | undefined {
  if (!titulo) return undefined;
  const alvo = titulo.trim().toLowerCase();
  return projects.find((p) => p.titulo.trim().toLowerCase() === alvo) ?? projects.find((p) => p.titulo.trim().toLowerCase().includes(alvo));
}

const PROMPT_SISTEMA = [
  "Você é o copiloto de portfólio da Sementeira — um app que ajuda pessoas atingidas por Brumadinho a elaborar projetos comunitários do Anexo I.1.",
  "Você DIALOGA normalmente, mas também pode EXECUTAR uma ação de uma lista FECHADA — nunca invente uma ação fora dela, nunca escreva código, nunca prometa uma ação que não está na lista.",
  "Ações possíveis (campo `acao`): " +
    [
      "lapidar_projeto {projetoTitulo, diretrizExtra?} — roda 1 volta de lapidação multi-agente no projeto",
      "abrir_projeto {projetoTitulo} — navega para o projeto",
      "gerar_documento {projetoTitulo, formato: 'docx'|'xlsx'|'pdf'} — exporta o documento do projeto",
      "consultar_status {projetoTitulo} — só responde com informação, não muda nada",
      "registrar_voluntario {nome, telefone?, email?, habilidades?: string[], disponibilidadeHorasSemana?} — cadastra um voluntário citado na conversa",
      "marcar_projeto_iniciado {projetoTitulo} — marca a data de início real do projeto como hoje",
    ].join(" | "),
  "Se a mensagem do usuário não corresponder claramente a nenhuma ação, responda só em texto (acao: null) — não force uma ação parecida.",
  "Se o usuário citar um documento/edital/link colado na conversa como contexto extra para uma lapidação, coloque esse texto em `parametros.diretrizExtra` — ele vale só para esta chamada, nunca vira diretriz permanente sem o usuário pedir isso explicitamente em outra tela.",
  'Responda SEMPRE com um bloco json: ```json\n{"resposta": "texto em português simples para o usuário", "acao": "nome_da_acao_ou_null", "parametros": {}}\n``` — nada fora do bloco.',
].join("\n");

function resumoProjetosPortfolio(projects: Project[]): string {
  return projects
    .map((p) => {
      const score = calcularScore(p);
      const mes = mesAtualDoProjeto(p);
      return `- "${p.titulo || "(sem título)"}" — 🔴${score.bloqueios} 🟡${score.atencoes} · ${mes != null ? `mês ${mes} de implantação` : "não iniciado"}`;
    })
    .join("\n");
}

export async function interpretarComando(mensagem: string, historico: ChatMessage[], projects: Project[]): Promise<{ ok: boolean; dado?: ComandoInterpretado; erro?: string }> {
  const config = carregarConfigLLM();
  const messages: ChatMessage[] = [
    { role: "system", content: `${PROMPT_SISTEMA}\n\nProjetos no portfólio:\n${resumoProjetosPortfolio(projects) || "(nenhum projeto cadastrado ainda)"}` },
    ...historico,
    { role: "user", content: mensagem },
  ];
  const resultado = await enviarMensagemLLM(config, messages);
  if (!resultado.ok || !resultado.conteudo) return { ok: false, erro: resultado.erro ?? "Sem resposta do modelo de IA." };

  const dado = parseJsonDeResposta<ComandoInterpretado>(resultado.conteudo);
  if (!dado) return { ok: false, erro: "Não consegui interpretar a resposta da IA." };
  return { ok: true, dado };
}

/** Executa a ação decidida pela IA — SEMPRE através de uma função determinística já existente no app; retorna uma frase de confirmação para anexar à resposta do chat. */
export async function executarAcaoAgente(comando: ComandoInterpretado, contexto: ContextoAgente): Promise<string | null> {
  const { acao, parametros } = comando;
  if (!acao) return null;
  const titulo = typeof parametros.projetoTitulo === "string" ? parametros.projetoTitulo : undefined;

  switch (acao) {
    case "lapidar_projeto": {
      const projeto = resolverProjetoPorTitulo(titulo, contexto.projects);
      if (!projeto) return `⚠ Não encontrei nenhum projeto chamado "${titulo}".`;
      const scoreAntes = calcularScore(projeto);
      const diretrizExtra = typeof parametros.diretrizExtra === "string" ? parametros.diretrizExtra : undefined;
      const resultado = await lapidarProjeto(projeto, { voltas: 1, diretrizExtra });
      if (!resultado.ok || !resultado.projetoFinal) return `⚠ A lapidação de "${projeto.titulo}" falhou: ${resultado.erro ?? "erro desconhecido"}.`;
      const ultimaVolta = resultado.voltas[resultado.voltas.length - 1];
      const projetoComVersao = commitarVersaoLapidada(projeto, resultado.projetoFinal, ultimaVolta?.changelog ?? []);
      contexto.onAtualizarProjeto(projetoComVersao);
      const scoreDepois = ultimaVolta?.scoreDepois ?? scoreAntes;
      return `✅ Rodei 1 volta de lapidação em "${projeto.titulo}" — 🔴 ${scoreAntes.bloqueios}→${scoreDepois.bloqueios} · 🟡 ${scoreAntes.atencoes}→${scoreDepois.atencoes}. Nova versão: v${projetoComVersao.versaoLapidacao} (reversível pelo histórico).`;
    }
    case "abrir_projeto": {
      const projeto = resolverProjetoPorTitulo(titulo, contexto.projects);
      if (!projeto) return `⚠ Não encontrei nenhum projeto chamado "${titulo}".`;
      contexto.onAbrirProjeto(projeto.id);
      return `✅ Abrindo "${projeto.titulo}".`;
    }
    case "gerar_documento": {
      const projeto = resolverProjetoPorTitulo(titulo, contexto.projects);
      if (!projeto) return `⚠ Não encontrei nenhum projeto chamado "${titulo}".`;
      const formato = typeof parametros.formato === "string" ? parametros.formato : "docx";
      if (formato === "xlsx") await exportarProjetoXlsx(projeto);
      else if (formato === "pdf") exportarProjetoPdf();
      else await exportarProjetoDocx(projeto);
      return `✅ Documento .${formato} de "${projeto.titulo}" exportado.`;
    }
    case "consultar_status": {
      const projeto = resolverProjetoPorTitulo(titulo, contexto.projects);
      if (!projeto) return `⚠ Não encontrei nenhum projeto chamado "${titulo}".`;
      const score = calcularScore(projeto);
      const mes = mesAtualDoProjeto(projeto);
      const atividades = mes != null ? orientacaoDoMes(projeto, mes) : [];
      return `📊 "${projeto.titulo}": 🔴 ${score.bloqueios} bloqueios · 🟡 ${score.atencoes} atenções${mes != null ? ` · mês ${mes} de implantação` : " · ainda não marcado como iniciado"}${atividades.length ? ` · atividades do mês: ${atividades.join("; ")}` : ""}.`;
    }
    case "registrar_voluntario": {
      const nome = typeof parametros.nome === "string" ? parametros.nome : undefined;
      if (!nome) return "⚠ Não peguei o nome do voluntário para cadastrar.";
      const voluntarios = carregarVoluntarios();
      const novo: Voluntario = {
        id: crypto.randomUUID(),
        nome,
        telefone: typeof parametros.telefone === "string" ? parametros.telefone : undefined,
        email: typeof parametros.email === "string" ? parametros.email : undefined,
        habilidades: Array.isArray(parametros.habilidades) ? parametros.habilidades.filter((h): h is string => typeof h === "string") : undefined,
        disponibilidadeHorasSemana: typeof parametros.disponibilidadeHorasSemana === "number" ? parametros.disponibilidadeHorasSemana : undefined,
        cadastradoEm: new Date().toISOString(),
      };
      salvarVoluntarios([...voluntarios, novo]);
      return `✅ Cadastrei "${nome}" como voluntário(a).`;
    }
    case "marcar_projeto_iniciado": {
      const projeto = resolverProjetoPorTitulo(titulo, contexto.projects);
      if (!projeto) return `⚠ Não encontrei nenhum projeto chamado "${titulo}".`;
      contexto.onAtualizarProjeto({ ...projeto, dataInicioReal: new Date().toISOString() });
      return `✅ "${projeto.titulo}" marcado como iniciado hoje.`;
    }
    default:
      return null;
  }
}
