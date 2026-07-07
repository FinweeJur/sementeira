import { useMemo, useState } from "react";
import type { Project } from "../lib/types";
import { novoProjetoVazio } from "../lib/types";
import arquetipos from "../data/arquetipos.json";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SettingsModal } from "../components/SettingsModal";
import { HistoricoVersoesModal } from "../components/HistoricoVersoesModal";
import { RevisaoGeralModal } from "../components/RevisaoGeralModal";
import { AgentePortfolioChat } from "../components/AgentePortfolioChat";
import type { ProviderConfig } from "../lib/providers";
import { PROVEDORES, configuracaoLLMPronta } from "../lib/providers";
import { avaliarConformidade } from "../lib/compliance-engine";

const CHECKLIST_DISPENSADO_KEY = "sementeira-checklist-primeiro-uso-dispensado-v1";

export function ProjectList({
  projects,
  onOpen,
  onCreate,
  onDelete,
  onRename,
  onAtualizarProjeto,
  onVerTutorial,
  onAbrirEcossistema,
  onAbrirClube,
  onAbrirVoluntarios,
  llmConfig,
  onLlmConfigChange,
}: {
  projects: Project[];
  onOpen: (id: string) => void;
  onCreate: (p: Project) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, novoTitulo: string) => void;
  onAtualizarProjeto: (p: Project) => void;
  onVerTutorial: () => void;
  onAbrirEcossistema: () => void;
  onAbrirClube: () => void;
  onAbrirVoluntarios: () => void;
  llmConfig: ProviderConfig;
  onLlmConfigChange: (c: ProviderConfig) => void;
}) {
  const [paraExcluir, setParaExcluir] = useState<Project | null>(null);
  const [configAberta, setConfigAberta] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [tituloEmEdicao, setTituloEmEdicao] = useState("");
  const [historicoDeId, setHistoricoDeId] = useState<string | null>(null);
  const [revisaoGeralAberta, setRevisaoGeralAberta] = useState(false);
  const [agenteAberto, setAgenteAberto] = useState(false);
  const [checklistDispensado, setChecklistDispensado] = useState(() => localStorage.getItem(CHECKLIST_DISPENSADO_KEY) === "1");
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

  function iniciarEdicao(p: Project) {
    setEditandoId(p.id);
    setTituloEmEdicao(p.titulo);
  }
  function salvarEdicao() {
    if (editandoId) onRename(editandoId, tituloEmEdicao.trim());
    setEditandoId(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sementeira</h1>
          <p className="text-sm text-[color:var(--sm-text-dim)]">
            Jogue a ideia, construa o projeto pelo dano, valide a conformidade e simule o dia seguinte ao fim do dinheiro.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setConfigAberta(true)}
            className="rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]"
            title="Trocar o modelo de IA do Copiloto"
          >
            ⚙ Modelo: {provedorAtual?.nome ?? "não configurado"}
          </button>
        </div>
      </header>

      {!checklistDispensado && !checklistCompleto && (
        <div className="space-y-1 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Primeiros passos</p>
            <button onClick={dispensarChecklist} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
              dispensar
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            <li>{iaConfigurada ? "✅" : "⬜"} Configurar o modelo de IA (botão ⚙ acima)</li>
            <li>{temProjeto ? "✅" : "⬜"} Criar ou importar um projeto</li>
            <li>{temProjetoSemBloqueio ? "✅" : "⬜"} Deixar um projeto sem bloqueios 🔴</li>
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onCreate(novoProjetoVazio())}
          className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-4 py-3 text-sm font-medium hover:bg-[color:var(--sm-accent)]/30"
        >
          🌱 Novo projeto
        </button>
        {projects.length > 0 && (
          <button onClick={onAbrirEcossistema} className="rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]">
            🌐 Ecossistema
          </button>
        )}
        <button onClick={onAbrirClube} className="rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]">
          🎟 Clube de benefícios
        </button>
        <button onClick={onAbrirVoluntarios} className="rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]">
          🙋 Voluntários
        </button>
        {projects.length > 0 && (
          <button onClick={() => setAgenteAberto(true)} className="rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]">
            🤖 Copiloto de portfólio
          </button>
        )}
        {projects.length > 0 && (
          <button onClick={() => setRevisaoGeralAberta(true)} className="rounded border border-[color:var(--sm-border)] px-3 py-2 text-xs hover:border-[color:var(--sm-accent)]">
            🔁 Revisão geral
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {projects.map((p) => {
          const arquetipo = arquetipos.find((a) => a.id === p.arquetipoId);
          return (
            <li key={p.id} className="flex items-center justify-between rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-3">
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
                  <p className="text-xs text-[color:var(--sm-text-dim)]">{arquetipo?.nome ?? "arquétipo não definido"}</p>
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
                  <button onClick={() => iniciarEdicao(p)} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]" title="Editar título">
                    ✎ editar
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
            <p className="text-2xl">🌱</p>
            <p className="text-sm">
              Um projeto aqui é uma ideia da comunidade transformada em proposta completa — com orçamento, plano de sustentabilidade e checagem automática das regras do Anexo I.1.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => onCreate(novoProjetoVazio())}
                className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-4 py-2 text-sm font-medium hover:bg-[color:var(--sm-accent)]/30"
              >
                🌱 Começar meu primeiro projeto
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

      {configAberta && <SettingsModal config={llmConfig} onChange={onLlmConfigChange} onFechar={() => setConfigAberta(false)} />}

      {agenteAberto && (
        <AgentePortfolioChat projects={projects} onAtualizarProjeto={onAtualizarProjeto} onAbrirProjeto={onOpen} onClose={() => setAgenteAberto(false)} />
      )}

      {revisaoGeralAberta && (
        <RevisaoGeralModal
          projects={projects}
          onAtualizarProjeto={onAtualizarProjeto}
          onClose={() => setRevisaoGeralAberta(false)}
          onAbrirEcossistema={onAbrirEcossistema}
          onAbrirClube={onAbrirClube}
        />
      )}

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
