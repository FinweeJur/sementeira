import { useState } from "react";
import { Moon, Sun, Contrast, Sprout, Upload, Scale, Globe, Bot, RefreshCw, BookOpen, GraduationCap, Ticket, HeartHandshake, Shield, Settings, ChevronRight, ChevronLeft } from "lucide-react";
import type { FontScale, Tema } from "../lib/preferences";
import { Tooltip } from "./Tooltip";

const TEMAS: { id: Tema; rotulo: string; Icone: typeof Moon; dica: string }[] = [
  { id: "escuro", rotulo: "Escuro", Icone: Moon, dica: "Tema escuro (padrão)" },
  { id: "claro", rotulo: "Claro", Icone: Sun, dica: "Tema claro" },
  { id: "alto-contraste", rotulo: "Alto contraste", Icone: Contrast, dica: "Tema de alto contraste (acessibilidade)" },
];

/** Barra fixa presente em todas as telas — tema, tamanho de texto e as ações de portfólio (criar, analisar, consultar, rede) ficam num só lugar, acessíveis de qualquer página.
 *  No mobile (abaixo de `sm`), a barra horizontal do topo dá lugar a uma trilha de ícones fixa na lateral esquerda (colapsável), para não brigar
 *  por espaço com o conteúdo da tela — só o essencial some do topo (marca + tema/fonte continuam visíveis ali). */
export function NavBar({
  tema,
  onTema,
  fontScale,
  onFontScale,
  temProjeto,
  temMultiplosProjetos,
  onNovoProjeto,
  onImportar,
  onComparar,
  onEcossistema,
  onCopiloto,
  onRevisaoGeral,
  onBiblioteca,
  onAprender,
  onPrivacidade,
  onClube,
  onVoluntarios,
}: {
  tema: Tema;
  onTema: (t: Tema) => void;
  fontScale: FontScale;
  onFontScale: (s: FontScale) => void;
  temProjeto: boolean;
  temMultiplosProjetos: boolean;
  onNovoProjeto: () => void;
  onImportar: () => void;
  onComparar: () => void;
  onEcossistema: () => void;
  onCopiloto: () => void;
  onRevisaoGeral: () => void;
  onBiblioteca: () => void;
  onAprender: () => void;
  onPrivacidade: () => void;
  onClube: () => void;
  onVoluntarios: () => void;
}) {
  const [trilhaAberta, setTrilhaAberta] = useState(false);

  const acoesPortfolio = [
    { key: "comparar", icone: Scale, rotulo: "Comparar", dica: "Compare até 3 projetos lado a lado", onClick: onComparar, visivel: temProjeto && temMultiplosProjetos },
    { key: "mapa", icone: Globe, rotulo: "Mapa", dica: "Ecossistema: mapa da região e como os projetos podem se ajudar", onClick: onEcossistema, visivel: temProjeto },
    { key: "copiloto", icone: Bot, rotulo: "Copiloto", dica: "Converse por texto para lapidar, exportar ou consultar qualquer projeto", onClick: onCopiloto, visivel: temProjeto },
    { key: "ciclo", icone: RefreshCw, rotulo: "Ciclo", dica: "Revisão geral: roda 1 volta de lapidação nos projetos + atualiza ecossistema e clube", onClick: onRevisaoGeral, visivel: temProjeto },
    { key: "biblioteca", icone: BookOpen, rotulo: "Biblioteca", dica: "Documentos de referência do processo e leituras de apoio", onClick: onBiblioteca, visivel: true },
    { key: "aprender", icone: GraduationCap, rotulo: "Aprender", dica: "Currículo passo a passo de como montar um projeto na Sementeira", onClick: onAprender, visivel: true },
    { key: "clube", icone: Ticket, rotulo: "Clube", dica: "Clube de benefícios: programa que conecta produtos dos projetos às famílias atingidas", onClick: onClube, visivel: true },
    { key: "cadastro", icone: HeartHandshake, rotulo: "Cadastro", dica: "Voluntários: pessoas disponíveis para mutirões", onClick: onVoluntarios, visivel: true },
    { key: "privacidade", icone: Shield, rotulo: "Privacidade", dica: "Política de privacidade — como a Sementeira trata os dados de quem usa o app (LGPD)", onClick: onPrivacidade, visivel: true },
  ].filter((a) => a.visivel);

  return (
    <>
      {/* Topo: em todas as telas mostra a marca e tema/fonte; as ações de portfólio só aparecem aqui a partir de `sm` (mobile usa a trilha lateral). */}
      <div className="no-print sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] px-3 py-1.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setTrilhaAberta((v) => !v)}
            aria-label={trilhaAberta ? "Fechar menu" : "Abrir menu"}
            aria-expanded={trilhaAberta}
            className="rounded border border-[color:var(--sm-border)] p-1.5 sm:hidden"
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>

          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--sm-text-dim)]">
            <Sprout size={16} strokeWidth={2} className="text-[color:var(--sm-accent)]" />
            Sementeira
          </span>

          <div className="hidden h-4 w-px bg-[color:var(--sm-border)] sm:block" aria-hidden="true" />

          <Tooltip texto="Crie um novo projeto a partir de uma ideia ou importe de um documento" posicao="bottom">
            <button
              onClick={onNovoProjeto}
              className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)] px-2.5 py-1 text-xs font-semibold text-[color:var(--sm-bg)]"
            >
              <Sprout size={14} strokeWidth={2} />
              Novo projeto
            </button>
          </Tooltip>
          <NavIconButton icone={Upload} rotulo="Importar" dica="Importe um projeto já escrito a partir de um PDF ou DOCX" onClick={onImportar} />

          <div className="hidden items-center gap-3 sm:flex">
            {acoesPortfolio.map((a) => (
              <NavIconButton key={a.key} icone={a.icone} rotulo={a.rotulo} dica={a.dica} onClick={a.onClick} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {TEMAS.map((t) => (
              <Tooltip key={t.id} texto={t.dica} posicao="bottom">
                <button
                  onClick={() => onTema(t.id)}
                  aria-label={`Tema ${t.rotulo}`}
                  className={`rounded border p-1.5 ${tema === t.id ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)]"}`}
                >
                  <t.Icone size={14} strokeWidth={2} />
                </button>
              </Tooltip>
            ))}
          </div>
          <div className="hidden items-center gap-1 text-xs sm:flex">
            {(["pequena", "normal", "grande"] as FontScale[]).map((s) => (
              <Tooltip key={s} texto={`Tamanho de fonte ${s}`} posicao="bottom">
                <button
                  onClick={() => onFontScale(s)}
                  className={`rounded border px-2 py-1 ${fontScale === s ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)]"}`}
                >
                  A{s === "pequena" ? "-" : s === "grande" ? "+" : ""}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: trilha lateral colapsável com as ações de portfólio, fora do fluxo (position:fixed) — nunca sobrepõe o conteúdo porque o layout reserva espaço à esquerda (ver App.tsx). */}
      {trilhaAberta && (
        <div className="fixed inset-0 z-30 bg-black/40 sm:hidden" onClick={() => setTrilhaAberta(false)} aria-hidden="true" />
      )}
      <nav
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-48 flex-col gap-1 overflow-y-auto border-r border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-2 transition-transform duration-200 sm:hidden ${
          trilhaAberta ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-xs font-medium text-[color:var(--sm-text-dim)]">Menu</span>
          <button onClick={() => setTrilhaAberta(false)} aria-label="Fechar menu" className="rounded border border-[color:var(--sm-border)] p-1">
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="flex items-center gap-1 px-1 pb-1 text-xs">
          {(["pequena", "normal", "grande"] as FontScale[]).map((s) => (
            <button
              key={s}
              onClick={() => onFontScale(s)}
              className={`rounded border px-2 py-1 ${fontScale === s ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)]"}`}
            >
              A{s === "pequena" ? "-" : s === "grande" ? "+" : ""}
            </button>
          ))}
        </div>
        {acoesPortfolio.map((a) => (
          <button
            key={a.key}
            onClick={() => {
              a.onClick();
              setTrilhaAberta(false);
            }}
            className="flex items-center gap-2 rounded border border-transparent px-2 py-2 text-left text-sm hover:border-[color:var(--sm-border)]"
          >
            <a.icone size={16} strokeWidth={2} />
            {a.rotulo}
          </button>
        ))}
      </nav>
    </>
  );
}

function NavIconButton({
  icone: Icone,
  rotulo,
  dica,
  onClick,
}: {
  icone: typeof Settings;
  rotulo: string;
  dica: string;
  onClick: () => void;
}) {
  return (
    <Tooltip texto={dica} posicao="bottom">
      <button
        onClick={onClick}
        aria-label={rotulo}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]"
      >
        <Icone size={14} strokeWidth={2} />
        <span className="hidden sm:inline">{rotulo}</span>
      </button>
    </Tooltip>
  );
}
