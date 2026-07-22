import { useEffect, useRef, useState } from "react";
import type { Project } from "../lib/types";
import type { ChatMessage } from "../lib/providers";
import { carregarChat, salvarChat } from "../lib/chat-storage";
import { interpretarComando, executarAcaoAgente } from "../lib/agente-portfolio";
import { gerarMensagensProativas } from "../lib/acompanhamento";
import { extrairTextoDeArquivo } from "../lib/file-extraction";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useTasks } from "../lib/task-context";
import { Bot } from "lucide-react";

const CHAT_ID = "agente-portfolio";

/**
 * Copiloto de portfólio (Fase 14c/14d) — dialoga sobre qualquer projeto do
 * portfólio e executa um conjunto FECHADO de ações (ver agente-portfolio.ts).
 * Diferente do CopilotoChat, que só ajuda a preencher UM projeto aberto.
 */
export function AgentePortfolioChat({
  projects,
  onAtualizarProjeto,
  onAbrirProjeto,
  onClose,
}: {
  projects: Project[];
  onAtualizarProjeto: (p: Project) => void;
  onAbrirProjeto: (id: string) => void;
  onClose: () => void;
}) {
  const [mensagens, setMensagens] = useState<ChatMessage[]>(() => carregarChat(CHAT_ID));
  const [entrada, setEntrada] = useState("");
  const [anexoTexto, setAnexoTexto] = useState<string | null>(null);
  const [lendoAnexo, setLendoAnexo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const { registrar, concluir, falhar } = useTasks();

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Mensagens proativas de orientação mensal (Fase 14d) — só na primeira abertura desta sessão do componente.
  useEffect(() => {
    const proativas = gerarMensagensProativas(projects);
    if (proativas.length === 0) return;
    setMensagens((atual) => {
      const novo = [...atual, ...proativas.map((texto): ChatMessage => ({ role: "assistant", content: texto }))];
      salvarChat(CHAT_ID, novo);
      return novo;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setLendoAnexo(true);
    const resultado = await extrairTextoDeArquivo(arquivo);
    setLendoAnexo(false);
    if (!resultado.ok || !resultado.texto) {
      setErro(resultado.erro ?? "Não consegui ler o anexo.");
      return;
    }
    setAnexoTexto(resultado.texto);
  }

  async function enviar() {
    if (!entrada.trim() || carregando) return;
    const mensagemUsuario = anexoTexto ? `${entrada.trim()}\n\n[Documento/link anexado]:\n${anexoTexto}` : entrada.trim();
    const novasMensagens: ChatMessage[] = [...mensagens, { role: "user", content: mensagemUsuario }];
    setMensagens(novasMensagens);
    salvarChat(CHAT_ID, novasMensagens);
    setEntrada("");
    setAnexoTexto(null);
    setCarregando(true);
    setErro(null);

    const taskId = registrar("agente-portfolio", "Copiloto de projetos processando...");

    const resultado = await interpretarComando(mensagemUsuario, mensagens, projects);
    setCarregando(false);
    if (!resultado.ok || !resultado.dado) {
      const erro = resultado.erro ?? "Não consegui interpretar sua mensagem.";
      setErro(erro);
      falhar(taskId, erro);
      return;
    }

    const confirmacao = await executarAcaoAgente(resultado.dado, { projects, onAtualizarProjeto, onAbrirProjeto });
    concluir(taskId, undefined, resultado.dado.resposta ? "✅ Ação executada" : undefined);
    const textoResposta = [resultado.dado.resposta, confirmacao].filter(Boolean).join("\n\n");
    const comResposta: ChatMessage[] = [...novasMensagens, { role: "assistant", content: textoResposta }];
    setMensagens(comResposta);
    salvarChat(CHAT_ID, comResposta);
  }

  return (
    <div
      className="flex h-[calc(100vh-37px)] w-80 shrink-0 flex-col border-l border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex items-center justify-between pb-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Bot size={16} strokeWidth={2} />
          Copiloto de projetos — Esc para fechar
        </h2>
        <button onClick={onClose} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
          fechar
        </button>
      </div>
      <p className="text-xs text-[color:var(--sm-text-dim)]">
        Pode dialogar sobre qualquer projeto e executar ações restritas: lapidar, abrir, exportar, consultar status, cadastrar voluntário, marcar como iniciado. Nada fora dessa lista.
      </p>

      <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
        {mensagens.length === 0 && (
          <p className="text-xs text-[color:var(--sm-text-dim)]">
            Ex.: "rode mais uma volta de lapidação no projeto Horta Comunitária considerando este edital" (anexe o documento) ou "qual o status da Cozinha Comunitária?".
          </p>
        )}
        {mensagens.map((m, i) => (
          <div key={i} className={`rounded p-2 text-sm ${m.role === "user" ? "bg-[color:var(--sm-accent)]/10" : "bg-[color:var(--sm-bg)]"}`}>
            <p className="mb-1 text-xs text-[color:var(--sm-text-dim)]">{m.role === "user" ? "Você" : "Copiloto"}</p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {carregando && (
          <div className="rounded p-2">
            <ThinkingIndicator />
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
            placeholder="Peça algo ou converse..."
          />
          <label className="flex shrink-0 cursor-pointer items-center rounded border border-[color:var(--sm-border)] px-2 text-xs hover:border-[color:var(--sm-accent)]">
            {lendoAnexo ? "lendo..." : "+arquivo"}
            <input type="file" accept=".pdf,.docx,.txt,text/plain" className="hidden" onChange={handleAnexo} disabled={lendoAnexo} />
          </label>
          <button
            onClick={enviar}
            disabled={carregando}
            className="shrink-0 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-3 text-sm hover:bg-[color:var(--sm-accent)]/30 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
