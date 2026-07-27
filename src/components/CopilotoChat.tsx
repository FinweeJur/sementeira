import { useEffect, useRef, useState } from "react";
import type { Project } from "../lib/types";
import { carregarConfigLLM, salvarConfigLLM, enviarMensagemLLM, configuracaoLLMPronta, type ChatMessage, type ProviderConfig } from "../lib/providers";
import { carregarChat, salvarChat } from "../lib/chat-storage";
import { ProviderSettings } from "./ProviderSettings";
import { montarPromptRascunho, interpretarRespostaRascunho, formatarPerguntas, type RascunhoDados } from "../lib/draft-generation";
import { extrairTextoDeArquivo } from "../lib/file-extraction";
import { montarBlocoDiretrizesGlobais } from "../lib/diretrizes-globais";
import { montarBlocoDocumentosBase } from "../lib/documentos-base";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useTasks } from "../lib/task-context";
import { ICONE_TIPO, ROTULO_TIPO } from "../lib/task-labels";
import danos from "../data/danos.json";
import arquetipos from "../data/arquetipos.json";
import { Wand2, Zap, ChevronDown, ChevronRight, Check, X as XIcone } from "lucide-react";

const SUGESTOES_PROMPT = [
  "Que dano combina com essa ideia?",
  "Esse orçamento tem algum problema?",
  "Como esse projeto se sustenta depois que o dinheiro do Anexo acabar?",
  "Sugira um objetivo para este projeto",
];

function montarPromptSistema(project: Project): string {
  const listaDanos = danos.map((d) => `- ${d.id}: ${d.nome} — ${d.descricao}`).join("\n");
  const listaArquetipos = arquetipos.map((a) => `- ${a.id}: ${a.nome} (tipo ${a.tipo})`).join("\n");
  const blocoDiretrizes = montarBlocoDiretrizesGlobais();
  return [
    'Você é Dona Lúcia, o copiloto da Sementeira. Gosta de ajudar as pessoas e já preencheu tantos formulários do Anexo I.1 que virou "a pessoa que sabe" da região. Fala em português simples, direto, acolhedor — sem jargão jurídico, sem tecnocracia, sem piegas. Trata quem conversa com você com paciência e respeito, do jeito que gostaria de ser tratada.',
    "Você NUNCA decide sozinha: quem decide um projeto de verdade é a Governança Popular, as Comissões de Atingidos e a assembleia — você só ajuda a preparar o material antes disso. Ajude a pessoa a pensar no dano coletivo, no tipo de projeto, no orçamento e em como o projeto se sustenta depois que o dinheiro do Anexo acabar.",
    "Catálogo de danos coletivos disponíveis:\n" + listaDanos,
    "Catálogo de arquétipos de projeto disponíveis:\n" + listaArquetipos,
    `Estado atual do projeto sendo editado: título="${project.titulo}", ideia="${project.ideiaTexto}", dano selecionado="${project.danoId || "nenhum"}", arquétipo selecionado="${project.arquetipoId || "nenhum"}".`,
    'O app tem um botão separado chamado "Lapidar" (no topo da tela, ao lado deste chat) que roda 6 agentes de IA em sequência (escritor, orçamentista, crítico, analista de riscos, sugestor, compilador) para revisar e melhorar o projeto inteiro automaticamente — a pessoa aprova o resultado antes de aplicar. Você (Dona Lúcia, no chat) NÃO consegue disparar essa lapidação nem editar o projeto sozinha: se alguém pedir para "lapidar", "revisar tudo", "melhorar o projeto inteiro" ou algo parecido, explique que é o botão "Lapidar" no topo da tela, não uma coisa que se faz por aqui. Você ajuda em pontos específicos da conversa e, quando pedido, gera um rascunho inicial (botão "Gerar rascunho").',
    montarBlocoDocumentosBase(),
    blocoDiretrizes,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function CopilotoChat({
  project,
  onClose,
  onAplicarRascunho,
  autoGerarRascunho,
  onAutoGerarConsumido,
}: {
  project: Project;
  onClose: () => void;
  onAplicarRascunho: (dados: RascunhoDados) => void;
  autoGerarRascunho?: boolean;
  onAutoGerarConsumido?: () => void;
}) {
  const [config, setConfig] = useState<ProviderConfig>(carregarConfigLLM());
  const configPronta = configuracaoLLMPronta(config);
  // Guarda amigável: se a IA não está configurada, abre a config de cara com
  // orientação, em vez de deixar o leigo esperar por um erro técnico depois.
  const [mostrarConfig, setMostrarConfig] = useState(!configPronta.pronta);
  const [mensagens, setMensagens] = useState<ChatMessage[]>(() => carregarChat(project.id));
  const [entrada, setEntrada] = useState("");
  const [anexoTexto, setAnexoTexto] = useState<string | null>(null);
  const [lendoAnexo, setLendoAnexo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [gerandoRascunho, setGerandoRascunho] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimoRascunho, setUltimoRascunho] = useState<{ indice: number; dados: RascunhoDados } | null>(null);
  const [aguardandoRespostaPerguntas, setAguardandoRespostaPerguntas] = useState(false);
  const [copiadoIndice, setCopiadoIndice] = useState<number | null>(null);
  const [mostrarTarefas, setMostrarTarefas] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const { registrar, concluir, falhar, tarefas } = useTasks();

  // Últimas tarefas de IA rodadas para ESTE projeto (chat, rascunho, lapidação,
  // revisão...) — visão rápida sem precisar abrir o painel de tarefas geral.
  const tarefasDoProjeto = tarefas.filter((t) => t.projectId === project.id).slice(0, 5);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  useEffect(() => {
    if (autoGerarRascunho) {
      gerarRascunho();
      onAutoGerarConsumido?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGerarRascunho]);

  function handleConfigChange(c: ProviderConfig) {
    setConfig(c);
    salvarConfigLLM(c);
  }

  /**
   * Centraliza o envio e a interpretação da resposta. `usarPromptRascunho`
   * decide se o sistema instrui o modelo a responder no formato estruturado
   * (perguntas OU rascunho). Usado tanto pelo botão "gerar rascunho" quanto
   * pelo campo de chat normal enquanto a IA está esperando resposta às
   * perguntas que ela mesma fez — sem isso, a segunda rodada (resposta às
   * perguntas) caía no prompt genérico e nunca produzia o botão de aplicar.
   */
  async function enviarMensagens(novasMensagens: ChatMessage[], usarPromptRascunho: boolean) {
    setCarregando(true);
    setErro(null);

    const taskId = registrar("copiloto-chat", `Copiloto conversando sobre "${project.titulo || "projeto"}"...`, project.id);

    const systemContent = usarPromptRascunho
      ? montarPromptSistema(project) + "\n\n" + montarPromptRascunho(project)
      : montarPromptSistema(project);

    const resposta = await enviarMensagemLLM(config, [{ role: "system", content: systemContent }, ...novasMensagens]);
    setCarregando(false);

    if (!resposta.ok) {
      const erro = resposta.erro ?? "Falha ao conversar com o provedor de IA.";
      setErro(erro);
      falhar(taskId, erro);
      return;
    }
    concluir(taskId);

    const textoResposta = resposta.conteudo ?? "";
    let conteudoExibido = textoResposta;
    let continuaAguardando = false;
    let novoRascunho: RascunhoDados | null = null;

    if (usarPromptRascunho) {
      const interpretado = interpretarRespostaRascunho(textoResposta);
      if (interpretado?.tipo === "perguntas") {
        conteudoExibido = formatarPerguntas(interpretado.perguntas);
        continuaAguardando = true;
      } else if (interpretado?.tipo === "rascunho") {
        novoRascunho = interpretado.dados;
      }
    }

    const comResposta: ChatMessage[] = [...novasMensagens, { role: "assistant", content: conteudoExibido }];
    setMensagens(comResposta);
    salvarChat(project.id, comResposta);
    setAguardandoRespostaPerguntas(continuaAguardando);

    if (novoRascunho) {
      setUltimoRascunho({ indice: comResposta.length - 1, dados: novoRascunho });
    } else if (!continuaAguardando) {
      setUltimoRascunho(null);
    }
  }

  async function enviar() {
    if (!entrada.trim() && !anexoTexto) return;
    const conteudoUsuario = anexoTexto ? `${entrada}\n\n[Anexo]\n${anexoTexto}` : entrada;
    const novasMensagens: ChatMessage[] = [...mensagens, { role: "user", content: conteudoUsuario }];
    setMensagens(novasMensagens);
    salvarChat(project.id, novasMensagens);
    setEntrada("");
    setAnexoTexto(null);
    await enviarMensagens(novasMensagens, aguardandoRespostaPerguntas);
  }

  async function gerarRascunho() {
    if (!project.titulo && !project.ideiaTexto) {
      setErro("Escreva um título ou a ideia do projeto antes de gerar o rascunho.");
      return;
    }
    setGerandoRascunho(true);
    const pedido: ChatMessage = { role: "user", content: "Gerar rascunho do projeto." };
    const novasMensagens = [...mensagens, pedido];
    setMensagens(novasMensagens);
    salvarChat(project.id, novasMensagens);
    await enviarMensagens(novasMensagens, true);
    setGerandoRascunho(false);
  }

  function copiarMensagem(texto: string, indice: number) {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiadoIndice(indice);
      window.setTimeout(() => setCopiadoIndice((atual) => (atual === indice ? null : atual)), 1500);
    });
  }

  async function handleAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setLendoAnexo(true);
    setErro(null);
    const resultado = await extrairTextoDeArquivo(arquivo);
    setLendoAnexo(false);
    if (!resultado.ok || !resultado.texto) {
      setErro(resultado.erro ?? "Falha ao ler o arquivo.");
      return;
    }
    setAnexoTexto(resultado.texto);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex h-full w-full flex-col bg-[color:var(--sm-panel)] p-4 sm:static sm:z-auto sm:h-[calc(100vh-37px)] sm:w-80 sm:shrink-0 sm:border-l sm:border-[color:var(--sm-border)]"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-sm font-semibold">Copiloto (IA) — Esc para fechar</h2>
        <div className="flex gap-2">
          <button onClick={() => setMostrarConfig((v) => !v)} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            {mostrarConfig ? "ocultar modelo" : "trocar modelo"}
          </button>
          <button onClick={onClose} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            fechar
          </button>
        </div>
      </div>

      {!configPronta.pronta && (
        <p className="mt-2 rounded border border-[color:var(--sm-yellow)]/40 bg-[color:var(--sm-yellow)]/10 p-2 text-xs">
          Para usar a IA, escolha um modelo — leva 1 minuto. {configPronta.motivo}
        </p>
      )}
      {mostrarConfig && <ProviderSettings config={config} onChange={handleConfigChange} />}

      {tarefasDoProjeto.length > 0 && (
        <div className="mt-2 rounded border border-[color:var(--sm-border)]">
          <button
            onClick={() => setMostrarTarefas((v) => !v)}
            className="flex w-full items-center justify-between px-2 py-1.5 text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]"
          >
            <span className="inline-flex items-center gap-1.5">
              <Zap size={12} strokeWidth={2} />
              Últimas tarefas de IA neste projeto ({tarefasDoProjeto.length})
            </span>
            {mostrarTarefas ? <ChevronDown size={12} strokeWidth={2} /> : <ChevronRight size={12} strokeWidth={2} />}
          </button>
          {mostrarTarefas && (
            <ul className="space-y-1 border-t border-[color:var(--sm-border)] p-2">
              {tarefasDoProjeto.map((t) => {
                const Icone = ICONE_TIPO[t.tipo];
                return (
                  <li key={t.id} className="flex items-start gap-1.5 text-xs">
                    {Icone && <Icone size={12} strokeWidth={2} className="mt-0.5 shrink-0 text-[color:var(--sm-text-dim)]" />}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1">
                        <span className="font-medium">{ROTULO_TIPO[t.tipo] ?? t.tipo}</span>
                        {t.status === "rodando" && <span className="text-[color:var(--sm-accent)]">rodando…</span>}
                        {t.status === "concluida" && <Check size={11} strokeWidth={2.5} className="text-[color:var(--sm-green)]" />}
                        {t.status === "erro" && <XIcone size={11} strokeWidth={2.5} className="text-[color:var(--sm-red)]" />}
                        {t.status === "cancelada" && <span className="text-[color:var(--sm-text-dim)]">cancelada</span>}
                      </p>
                      <p className="truncate text-[color:var(--sm-text-dim)]" title={t.titulo}>
                        {t.titulo}
                      </p>
                      {t.status === "concluida" && t.diff && <p className="text-[color:var(--sm-green)]">{t.diff}</p>}
                      {t.status === "erro" && t.erro && <p className="text-[color:var(--sm-red)]">{t.erro}</p>}
                    </div>
                    <span className="shrink-0 text-[color:var(--sm-text-dim)]">
                      {new Date(t.criadaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <button
        onClick={gerarRascunho}
        disabled={gerandoRascunho}
        className="mt-2 inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25 disabled:opacity-40"
      >
        {!gerandoRascunho && <Wand2 size={14} strokeWidth={2} />}
        {gerandoRascunho ? "Gerando rascunho..." : "Gerar rascunho do projeto com IA"}
      </button>
      <p className="mt-1 text-xs text-[color:var(--sm-text-dim)]">
        A IA usa o título e a ideia para sugerir o dano, o modelo de projeto, o objetivo, a justificativa e as metas. Se faltar informação, ela pergunta antes de rascunhar. Você revisa tudo depois.
      </p>

      <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
        {mensagens.length === 0 && !entrada.trim() && (
          <div className="space-y-1.5">
            <p className="text-xs text-[color:var(--sm-text-dim)]">Ou pergunte algo específico:</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGESTOES_PROMPT.map((sugestao) => (
                <button
                  key={sugestao}
                  onClick={() => setEntrada(sugestao)}
                  className="rounded-full border border-[color:var(--sm-border)] px-2.5 py-1 text-xs hover:border-[color:var(--sm-accent)] hover:bg-[color:var(--sm-accent)]/10"
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>
        )}
        {aguardandoRespostaPerguntas && (
          <p className="rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/10 p-2 text-xs">
            A IA fez perguntas acima — responda no campo abaixo para ela continuar o rascunho.
          </p>
        )}
        {mensagens.map((m, i) => (
          <div key={i} className={`rounded p-2 text-sm ${m.role === "user" ? "bg-[color:var(--sm-accent)]/10" : "bg-[color:var(--sm-bg)]"}`}>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs text-[color:var(--sm-text-dim)]">{m.role === "user" ? "Você" : "Copiloto"}</p>
              <button onClick={() => copiarMensagem(m.content, i)} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
                {copiadoIndice === i ? "copiado!" : "copiar"}
              </button>
            </div>
            <p className="whitespace-pre-wrap">{m.content}</p>
            {ultimoRascunho?.indice === i && (
              <button
                onClick={() => {
                  onAplicarRascunho(ultimoRascunho.dados);
                  setUltimoRascunho(null);
                }}
                className="mt-2 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-2 py-1 text-xs hover:bg-[color:var(--sm-accent)]/30"
              >
                Aplicar este rascunho ao projeto
              </button>
            )}
          </div>
        ))}
        {carregando && (
          <div className="rounded p-2">
            <ThinkingIndicator persona="dona-lucia" />
          </div>
        )}
        {erro && <p className="text-xs text-[color:var(--sm-red)]">{erro}</p>}
        <div ref={fimRef} />
      </div>

      <div className="space-y-2 pt-2">
        {anexoTexto && <p className="text-xs text-[color:var(--sm-text-dim)]">Anexo pronto para enviar junto ({anexoTexto.length} caracteres).</p>}
        <div className="flex gap-2">
          <input
            className="w-full rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-bg)] px-2 py-1.5 text-sm outline-none focus:border-[color:var(--sm-accent)]"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Escreva sua pergunta..."
          />
          <label className="flex shrink-0 cursor-pointer items-center rounded border border-[color:var(--sm-border)] px-2 text-xs hover:border-[color:var(--sm-accent)]">
            {lendoAnexo ? "lendo..." : "+arquivo"}
            <input type="file" accept=".pdf,.docx,.txt,text/plain" className="hidden" onChange={handleAnexo} disabled={lendoAnexo} />
          </label>
          <button onClick={enviar} disabled={carregando} className="shrink-0 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-3 text-sm hover:bg-[color:var(--sm-accent)]/30 disabled:opacity-40">
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
