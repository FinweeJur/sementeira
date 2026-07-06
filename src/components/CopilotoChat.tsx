import { useEffect, useRef, useState } from "react";
import type { Project } from "../lib/types";
import { carregarConfigLLM, salvarConfigLLM, enviarMensagemLLM, configuracaoLLMPronta, type ChatMessage, type ProviderConfig } from "../lib/providers";
import { carregarChat, salvarChat } from "../lib/chat-storage";
import { ProviderSettings } from "./ProviderSettings";
import { montarPromptRascunho, interpretarRespostaRascunho, formatarPerguntas, type RascunhoDados } from "../lib/draft-generation";
import { extrairTextoDeArquivo } from "../lib/file-extraction";
import { montarBlocoDiretrizesGlobais } from "../lib/diretrizes-globais";
import danos from "../data/danos.json";
import arquetipos from "../data/arquetipos.json";

function montarPromptSistema(project: Project): string {
  const listaDanos = danos.map((d) => `- ${d.id}: ${d.nome} — ${d.descricao}`).join("\n");
  const listaArquetipos = arquetipos.map((a) => `- ${a.id}: ${a.nome} (tipo ${a.tipo})`).join("\n");
  const blocoDiretrizes = montarBlocoDiretrizesGlobais();
  return [
    "Você é o copiloto da Sementeira, um app que ajuda pessoas atingidas pelo rompimento da barragem em Brumadinho a elaborar projetos para o Anexo I.1.",
    "Responda em português simples, direto, sem jargão jurídico desnecessário. Ajude a pessoa a pensar no dano coletivo, no tipo de projeto, no orçamento e em como o projeto se sustenta depois que o dinheiro do Anexo acabar.",
    "Catálogo de danos coletivos disponíveis:\n" + listaDanos,
    "Catálogo de arquétipos de projeto disponíveis:\n" + listaArquetipos,
    `Estado atual do projeto sendo editado: título="${project.titulo}", ideia="${project.ideiaTexto}", dano selecionado="${project.danoId || "nenhum"}", arquétipo selecionado="${project.arquetipoId || "nenhum"}".`,
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
  const fimRef = useRef<HTMLDivElement>(null);

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

    const systemContent = usarPromptRascunho
      ? montarPromptSistema(project) + "\n\n" + montarPromptRascunho(project)
      : montarPromptSistema(project);

    const resposta = await enviarMensagemLLM(config, [{ role: "system", content: systemContent }, ...novasMensagens]);
    setCarregando(false);

    if (!resposta.ok) {
      setErro(resposta.erro ?? "Falha ao conversar com o provedor de IA.");
      return;
    }

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
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-4"
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

      <button
        onClick={gerarRascunho}
        disabled={gerandoRascunho}
        className="mt-2 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25 disabled:opacity-40"
      >
        {gerandoRascunho ? "Gerando rascunho..." : "🪄 Gerar rascunho do projeto com IA"}
      </button>
      <p className="mt-1 text-xs text-[color:var(--sm-text-dim)]">
        A IA usa o título/ideia para propor dano, arquétipo, objetivo, justificativa e metas. Se faltar informação, ela pergunta antes de rascunhar. Sempre revisável.
      </p>

      <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
        {mensagens.length === 0 && (
          <p className="text-xs text-[color:var(--sm-text-dim)]">
            Ou pergunte algo específico, ex.: "que dano combina com essa ideia?" ou "esse orçamento tem algum problema?".
          </p>
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
        {carregando && <p className="text-xs text-[color:var(--sm-text-dim)]">Pensando...</p>}
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
