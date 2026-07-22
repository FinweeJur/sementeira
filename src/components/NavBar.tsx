import { Moon, Sun, Contrast, Sprout, Upload, Scale, Globe, Bot, RefreshCw, BookOpen, Ticket, HeartHandshake, Settings } from "lucide-react";
import type { FontScale, Tema } from "../lib/preferences";
import { Tooltip } from "./Tooltip";

const TEMAS: { id: Tema; rotulo: string; Icone: typeof Moon; dica: string }[] = [
  { id: "escuro", rotulo: "Escuro", Icone: Moon, dica: "Tema escuro (padrão)" },
  { id: "claro", rotulo: "Claro", Icone: Sun, dica: "Tema claro" },
  { id: "alto-contraste", rotulo: "Alto contraste", Icone: Contrast, dica: "Tema de alto contraste (acessibilidade)" },
];

/** Barra fixa presente em todas as telas — tema, tamanho de texto e as ações de portfólio (criar, analisar, consultar, rede) ficam num só lugar, acessíveis de qualquer página. */
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
  onClube: () => void;
  onVoluntarios: () => void;
}) {
  return (
    <div className="no-print sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] px-4 py-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--sm-text-dim)]">
          <Sprout size={16} strokeWidth={2} className="text-[color:var(--sm-accent)]" />
          Sementeira
        </span>

        <div className="h-4 w-px bg-[color:var(--sm-border)]" aria-hidden="true" />

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

        {temProjeto && (
          <>
            <div className="h-4 w-px bg-[color:var(--sm-border)]" aria-hidden="true" />
            {temMultiplosProjetos && <NavIconButton icone={Scale} rotulo="Comparar" dica="Compare até 3 projetos lado a lado" onClick={onComparar} />}
            <NavIconButton icone={Globe} rotulo="Mapa" dica="Ecossistema: mapa da região e como os projetos podem se ajudar" onClick={onEcossistema} />
            <NavIconButton icone={Bot} rotulo="Copiloto" dica="Converse por texto para lapidar, exportar ou consultar qualquer projeto" onClick={onCopiloto} />
            <NavIconButton icone={RefreshCw} rotulo="Ciclo" dica="Revisão geral: roda 1 volta de lapidação nos projetos + atualiza ecossistema e clube" onClick={onRevisaoGeral} />
          </>
        )}

        <div className="h-4 w-px bg-[color:var(--sm-border)]" aria-hidden="true" />
        <NavIconButton icone={BookOpen} rotulo="Biblioteca" dica="Documentos de referência do processo e leituras de apoio" onClick={onBiblioteca} />

        <div className="h-4 w-px bg-[color:var(--sm-border)]" aria-hidden="true" />
        <NavIconButton icone={Ticket} rotulo="Clube" dica="Clube de benefícios: programa que conecta produtos dos projetos às famílias atingidas" onClick={onClube} />
        <NavIconButton icone={HeartHandshake} rotulo="Cadastro" dica="Voluntários: pessoas disponíveis para mutirões" onClick={onVoluntarios} />
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
        <div className="flex items-center gap-1 text-xs">
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
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]"
      >
        <Icone size={14} strokeWidth={2} />
        {rotulo}
      </button>
    </Tooltip>
  );
}
