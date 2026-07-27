import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { montarItensNav, type NavAcoes } from "../lib/nav-items";

/**
 * Guia lateral em sanfona: fica recolhida mostrando só os ícones (mesmo
 * espaço ocupado o tempo todo, sem empurrar o conteúdo — é `fixed`) e expande
 * ao clicar, mostrando o nome ao lado de cada ícone. A NavBar de ícones no
 * topo continua existindo do jeito que está; isto é um segundo caminho pros
 * mesmos destinos, pensado pra telas estreitas onde a barra de cima
 * espreme/quebra demais.
 */
export function SidebarNav(acoes: NavAcoes) {
  const [aberta, setAberta] = useState(false);
  const itens = montarItensNav(acoes);

  return (
    <>
      {aberta && <div className="fixed inset-0 z-30 bg-black/40 sm-fade" onClick={() => setAberta(false)} aria-hidden="true" />}
      <nav
        className={`no-print fixed left-0 top-1/2 z-40 flex -translate-y-1/2 flex-col overflow-hidden rounded-r-lg border border-l-0 border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] py-2 shadow-lg transition-[width] duration-200 ease-out ${aberta ? "w-52" : "w-12"}`}
        aria-label="Navegação lateral"
      >
        <button
          onClick={() => setAberta((v) => !v)}
          aria-label={aberta ? "Recolher menu" : "Expandir menu com nomes"}
          aria-expanded={aberta}
          className="flex shrink-0 items-center gap-2 px-3.5 py-2 text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]"
        >
          {aberta ? <ChevronLeft size={16} strokeWidth={2} className="shrink-0" /> : <ChevronRight size={16} strokeWidth={2} className="shrink-0" />}
          {aberta && <span className="whitespace-nowrap text-xs">Menu</span>}
        </button>

        <div className="h-px bg-[color:var(--sm-border)]" aria-hidden="true" />

        {itens.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              item.onClick();
              setAberta(false);
            }}
            title={item.dica}
            aria-label={item.rotulo}
            className="flex shrink-0 items-center gap-2 px-3.5 py-2.5 text-[color:var(--sm-text-dim)] hover:bg-[color:var(--sm-accent)]/10 hover:text-[color:var(--sm-text)]"
          >
            <item.icone size={16} strokeWidth={2} className="shrink-0" />
            {aberta && <span className="whitespace-nowrap text-xs">{item.rotulo}</span>}
          </button>
        ))}
      </nav>
    </>
  );
}
