import { useMemo, useState } from "react";
import type { Project } from "../lib/types";
import { novoProjetoVazio } from "../lib/types";
import arquetipos from "../data/arquetipos.json";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { HistoricoVersoesModal } from "../components/HistoricoVersoesModal";
import type { ProviderConfig } from "../lib/providers";
import { PROVEDORES, configuracaoLLMPronta, nomeProvedor } from "../lib/providers";
import { ehWeb } from "../lib/ambiente";
import { avaliarConformidade } from "../lib/compliance-engine";
import { Tooltip } from "../components/Tooltip";
import { CabecalhoSecao } from "../components/CabecalhoSecao";
import { Settings, CheckCircle2, Square, Sprout, Pencil, Upload, Scale, Table2, Globe, Bot, RefreshCw, BookOpen, Ticket, HeartHandshake } from "lucide-react";

const CHECKLIST_DISPENSADO_KEY = "sementeira-checklist-primeiro-uso-dispensado-v1";
const AVISO_WEB_DISPENSADO_KEY = "sementeira-aviso-web-dispensado-v1";

export function ProjectList({
  projects,
  onOpen,
  onCreate,
  onDelete,
  onRename,
  onAtualizarProjeto,
  onVerTutorial,
  onImportar,
  onAbrirComparacao,
  onAbrirPlanilha,
  onAbrirEcossistema,
  onAbrirCopiloto,
  onAbrirRevisaoGeral,
  onAbrirBiblioteca,
  onAbrirClube,
  onAbrirVoluntarios,
  onAbrirConfig,
  llmConfig,
}: {
  projects: Project[];
  onOpen: (id: string) => void;
  onCreate: (p: Project) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, novoTitulo: string) => void;
  onAtualizarProjeto: (p: Project) => void;
  onVerTutorial: () => void;
  onImportar: () => void;
  onAbrirComparacao: () => void;
  onAbrirPlanilha: () => void;
  onAbrirEcossistema: () => void;
  onAbrirCopiloto: () => void;
  onAbrirRevisaoGeral: () => void;
  onAbrirBiblioteca: () => void;
  onAbrirClube: () => void;
  onAbrirVoluntarios: () => void;
  /** As Configurações vivem no App — ver comentário lá sobre o modal de importação. */
  onAbrirConfig: () => void;
  llmConfig: ProviderConfig;
}) {
  const [paraExcluir, setParaExcluir] = useState<Project | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [tituloEmEdicao, setTituloEmEdicao] = useState("");
  const [historicoDeId, setHistoricoDeId] = useState<string | null>(null);
  const [checklistDispensado, setChecklistDispensado] = useState(() => localStorage.getItem(CHECKLIST_DISPENSADO_KEY) === "1");
  const modoWeb = ehWeb();
  const [avisoWebDispensado, setAvisoWebDispensado] = useState(() => localStorage.getItem(AVISO_WEB_DISPENSADO_KEY) === "1");
  const provedorAtual = PROVEDORES.find((p) => p.id === llmConfig.providerId);

  // Checklist de primeiro uso — espelha o funil de ativação usando só dados que o app já tem.
  const iaConfigurada = configuracaoLLMPronta(llmConfig).pronta;
  const temProjeto = projects.length > 0;
  const temProjetoSemBloqueio = useMemo(
    () => projects.some((p) => avaliarConformidade(p).every((f) => f.severidade !== "bloqueio")),
    [projects],
  );
  const checklistCompleto = iaConfigurada && temProjeto && temProjetoSemBloqueio;

  function dispensarChecklist() {
    localStorage.setItem(CHECKLIST_DISPENSADO_KEY, "1");
    setChecklistDispensado(true);
  }

  function dispensarAvisoWeb() {
    localStorage.setItem(AVISO_WEB_DISPENSADO_KEY, "1");
    setAvisoWebDispensado(true);
  }

  function iniciarEdicao(p: Project) {
    setEditandoId(p.id);
    setTituloEmEdicao(p.titulo);
  }
  function salvarEdicao() {
    if (editandoId) onRename(editandoId, tituloEmEdicao.trim());
    setEditandoId(null);
  }

  return (
    <div className="flex w-full">
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-8 min-w-0">
      <CabecalhoSecao
        icone="h"
        olho="Seu portfólio"
        titulo="Sementeira"
        apoio="Conte a ideia, monte o projeto a partir do dano, confira o que o acordo permite e veja se ele se sustenta depois."
        acoes={
          <Tooltip texto="Escolha e configure o provedor de IA (DeepSeek, Maritaca ou Ollama local)" posicao="bottom">
            <button
              onClick={onAbrirConfig}
              className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]"
            >
              <Settings size={14} strokeWidth={2} />
              Modelo: {provedorAtual?.nome ?? "não configurado"}
            </button>
          </Tooltip>
        }
      />

      {modoWeb && !avisoWebDispensado && (
        <div className="space-y-1 rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium">Você está usando a Sementeira pelo navegador</p>
            <button onClick={dispensarAvisoWeb} className="shrink-0 text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
              entendi
            </button>
          </div>
          <ul className="space-y-1 text-xs text-[color:var(--sm-text-dim)]">
            <li>
              <strong className="text-[color:var(--sm-text)]">Seus projetos ficam só neste navegador, neste computador.</strong> Não existe conta, login
              nem banco de dados nosso.
            </li>
            <li>Por isso mesmo: limpar os dados do navegador apaga tudo. Guarde uma cópia dos projetos que importam para você.</li>
            {/* O texto do projeto só sai daqui quando a pessoa usa IA — e aí é
                honesto dizer para onde vai, com o nome do provedor escolhido. */}
            <li>
              {iaConfigurada ? (
                <>
                  Ao usar a IA, o texto do projeto é enviado para <strong className="text-[color:var(--sm-text)]">{nomeProvedor(llmConfig)}</strong>. Fora
                  isso, nada sai daqui.
                </>
              ) : (
                <>Nenhuma IA está configurada, então nada do que você escreve sai deste computador.</>
              )}
            </li>
            <li>O mapa da região baixa as imagens do OpenStreetMap, que fica sabendo qual área você está olhando.</li>
          </ul>
        </div>
      )}

      {!checklistDispensado && !checklistCompleto && (
        <div className="space-y-1 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Primeiros passos</p>
            <button onClick={dispensarChecklist} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
              dispensar
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-1.5">
              {iaConfigurada ? (
                <CheckCircle2 size={14} strokeWidth={2} className="text-[color:var(--sm-ok-text)]" />
              ) : (
                <Square size={14} strokeWidth={2} className="text-[color:var(--sm-text-dim)]" />
              )}
              Configurar o modelo de IA (botão "Modelo" na barra superior)
            </li>
            <li className="flex items-center gap-1.5">
              {temProjeto ? (
                <CheckCircle2 size={14} strokeWidth={2} className="text-[color:var(--sm-ok-text)]" />
              ) : (
                <Square size={14} strokeWidth={2} className="text-[color:var(--sm-text-dim)]" />
              )}
              Criar ou importar um projeto
            </li>
            <li className="flex items-center gap-1.5">
              {temProjetoSemBloqueio ? (
                <CheckCircle2 size={14} strokeWidth={2} className="text-[color:var(--sm-ok-text)]" />
              ) : (
                <Square size={14} strokeWidth={2} className="text-[color:var(--sm-text-dim)]" />
              )}
              Deixar um projeto sem bloqueios
            </li>
          </ul>
        </div>
      )}

      {/* Mesmas ações da barra superior, repetidas aqui em destaque — a barra é o acesso permanente em qualquer tela, isto aqui é o acesso facilitado a partir da tela inicial. Hierarquia de 3 níveis: criar → analisar projetos → consultar/rede da comunidade. */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip texto="Crie um novo projeto a partir de uma ideia ou importe de um documento" posicao="bottom">
            <button
              onClick={() => onCreate(novoProjetoVazio())}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--sm-bg)]"
            >
              <Sprout size={16} strokeWidth={2} />
              Novo projeto
            </button>
          </Tooltip>
          <Tooltip texto="Importe um projeto já escrito a partir de um PDF ou DOCX — o app lê e preenche os campos" posicao="bottom">
            <button
              onClick={onImportar}
              className="inline-flex items-center gap-1.5 rounded border border-dashed border-[color:var(--sm-border)] px-3 py-2 text-xs text-[color:var(--sm-text-dim)] hover:border-[color:var(--sm-accent)] hover:text-[color:var(--sm-text)]"
            >
              <Upload size={14} strokeWidth={2} />
              ou importar de PDF/DOCX
            </button>
          </Tooltip>
        </div>

        {temProjeto && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--sm-text-dim)]">Analisar projetos</p>
            <div className="flex flex-wrap gap-2">
              {projects.length > 1 && (
                <Tooltip texto="Compare até 3 projetos lado a lado para identificar sobreposições e lacunas" posicao="bottom">
                  <button
                    onClick={onAbrirComparacao}
                    className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]"
                  >
                    <Scale size={14} strokeWidth={2} />
                    Comparar
                  </button>
                </Tooltip>
              )}
              <Tooltip texto="Todos os projetos em tabela: onde, quanto, categoria, público, produção, itens e riscos — e dá para baixar em Excel" posicao="bottom">
                <button
                  onClick={onAbrirPlanilha}
                  className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]"
                >
                  <Table2 size={14} strokeWidth={2} />
                  Planilha
                </button>
              </Tooltip>
              <Tooltip texto="Mapa da região e como os projetos podem se ajudar — um projeto compra do outro" posicao="bottom">
                <button
                  onClick={onAbrirEcossistema}
                  className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]"
                >
                  <Globe size={14} strokeWidth={2} />
                  Ecossistema
                </button>
              </Tooltip>
              <Tooltip texto="Converse por texto para lapidar, exportar ou consultar o status de qualquer projeto" posicao="bottom">
                <button
                  onClick={onAbrirCopiloto}
                  className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]"
                >
                  <Bot size={14} strokeWidth={2} />
                  Copiloto de projetos
                </button>
              </Tooltip>
              <Tooltip texto="Roda 1 volta de lapidação nos projetos selecionados + atualiza ecossistema e clube" posicao="bottom">
                <button
                  onClick={onAbrirRevisaoGeral}
                  className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]"
                >
                  <RefreshCw size={14} strokeWidth={2} />
                  Revisão geral
                </button>
              </Tooltip>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--sm-text-dim)]">Consultar</p>
          <div className="flex flex-wrap gap-2">
            <Tooltip texto="Documentos de referência do processo (Proposta, Acordo, Ofícios) e leituras de apoio que você mesmo cadastra" posicao="bottom">
              <button
                onClick={onAbrirBiblioteca}
                className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]"
              >
                <BookOpen size={14} strokeWidth={2} />
                Biblioteca
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--sm-text-dim)]">Rede da comunidade</p>
          <div className="flex flex-wrap gap-2">
            <Tooltip texto="Programa de pontos e descontos que conecta produtos dos projetos às famílias atingidas" posicao="bottom">
              <button
                onClick={onAbrirClube}
                className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]"
              >
                <Ticket size={14} strokeWidth={2} />
                Clube de benefícios
              </button>
            </Tooltip>
            <Tooltip texto="Cadastro de pessoas disponíveis para mutirões, vinculadas aos projetos de interesse" posicao="bottom">
              <button
                onClick={onAbrirVoluntarios}
                className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]"
              >
                <HeartHandshake size={14} strokeWidth={2} />
                Voluntários
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {projects.map((p) => {
          const arquetipo = arquetipos.find((a) => a.id === p.arquetipoId);
          return (
            <li key={p.id} className="sm-card flex items-center justify-between rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-3">
              {editandoId === p.id ? (
                <input
                  autoFocus
                  className="flex-1 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-bg)] px-2 py-1 text-sm outline-none"
                  value={tituloEmEdicao}
                  onChange={(e) => setTituloEmEdicao(e.target.value)}
                  onBlur={salvarEdicao}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") salvarEdicao();
                    if (e.key === "Escape") setEditandoId(null);
                  }}
                />
              ) : (
                <button className="flex-1 text-left" onClick={() => onOpen(p.id)}>
                  <p className="font-medium">{p.titulo || "(sem título)"}</p>
                  <p className="text-xs text-[color:var(--sm-text-dim)]">{arquetipo?.nome ?? "modelo de projeto não definido"}</p>
                </button>
              )}
              <div className="flex shrink-0 items-center gap-2">
                {(p.versaoLapidacao ?? 0) > 0 && (
                  <button
                    onClick={() => setHistoricoDeId(p.id)}
                    title="Ver histórico de versões lapidadas"
                    className="rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/10 px-1.5 py-0.5 text-xs hover:bg-[color:var(--sm-accent)]/20"
                  >
                    v{p.versaoLapidacao}
                  </button>
                )}
                {editandoId !== p.id && (
                  <button
                    onClick={() => iniciarEdicao(p)}
                    className="inline-flex items-center gap-1 text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]"
                    title="Editar título"
                  >
                    <Pencil size={12} strokeWidth={2} />
                    editar
                  </button>
                )}
                <button onClick={() => setParaExcluir(p)} className="text-xs text-[color:var(--sm-red)]">
                  excluir
                </button>
              </div>
            </li>
          );
        })}
        {projects.length === 0 && (
          <div className="space-y-3 rounded border border-dashed border-[color:var(--sm-border)] p-6 text-center">
            <Sprout size={28} strokeWidth={2} className="mx-auto text-[color:var(--sm-accent)]" />
            <p className="text-sm">
              Um projeto aqui é uma ideia da comunidade transformada em proposta completa — com orçamento, plano de sustentabilidade e checagem automática das regras do Anexo I.1.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => onCreate(novoProjetoVazio())}
                className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-4 py-2 text-sm font-medium hover:bg-[color:var(--sm-accent)]/30"
              >
                <Sprout size={16} strokeWidth={2} />
                Começar meu primeiro projeto
              </button>
            </div>
          </div>
        )}
      </ul>

      <footer>
        <button onClick={onVerTutorial} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
          Ver tutorial de novo
        </button>
      </footer>

      {paraExcluir && (
        <ConfirmDialog
          titulo={`Excluir "${paraExcluir.titulo || "projeto sem título"}"?`}
          mensagem="Essa ação não pode ser desfeita."
          onConfirmar={() => {
            onDelete(paraExcluir.id);
            setParaExcluir(null);
          }}
          onCancelar={() => setParaExcluir(null)}
        />
      )}


    </div>

      {historicoDeId &&
        (() => {
          const projetoDoHistorico = projects.find((p) => p.id === historicoDeId);
          if (!projetoDoHistorico) return null;
          return (
            <HistoricoVersoesModal
              project={projetoDoHistorico}
              onReverter={onAtualizarProjeto}
              onClose={() => setHistoricoDeId(null)}
            />
          );
        })()}
    </div>
  );
}
