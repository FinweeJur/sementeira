import { useState } from "react";
import type { Project } from "../lib/types";
import { carregarClube, salvarClube, type OfertaBeneficio, type RegraPontos, type Premio } from "../lib/clube-beneficios";
import { lapidarClube, ETAPAS_PORTFOLIO_ROTULO, type ResultadoLapidacaoClube } from "../lib/refinement-ecosystem";
import { exportarClubeBeneficiosDocx } from "../lib/export";
import { Section } from "../components/Section";
import { inputClass } from "../components/Field";
import { CabecalhoSecao } from "../components/CabecalhoSecao";
import { RefreshCw, Check } from "lucide-react";

export function ClubeBeneficios({ projects, onVoltar }: { projects: Project[]; onVoltar: () => void }) {
  const [clube, setClube] = useState(carregarClube());
  const [lapidando, setLapidando] = useState(false);
  const [progressoLapidacao, setProgressoLapidacao] = useState<string | null>(null);
  const [lapidacao, setLapidacao] = useState<ResultadoLapidacaoClube | null>(null);
  const [erroLapidacao, setErroLapidacao] = useState<string | null>(null);

  async function lapidar() {
    setLapidando(true);
    setLapidacao(null);
    setErroLapidacao(null);
    const resultado = await lapidarClube(clube, projects, (etapa) => setProgressoLapidacao(ETAPAS_PORTFOLIO_ROTULO[etapa]));
    setLapidando(false);
    setProgressoLapidacao(null);
    if (!resultado.ok) {
      setErroLapidacao(resultado.erro ?? "Não foi possível lapidar.");
      return;
    }
    setLapidacao(resultado);
  }

  function aplicarClubeLapidado() {
    if (!lapidacao?.clube) return;
    atualizar(lapidacao.clube);
    setLapidacao(null);
  }
  const [novaOferta, setNovaOferta] = useState({ projectId: projects[0]?.id ?? "", titulo: "", descricao: "" });
  const [novaRegra, setNovaRegra] = useState({ descricao: "", pontosGanhos: 0 });
  const [novoPremio, setNovoPremio] = useState({ nome: "", custoPontos: 0 });

  function atualizar(novo: typeof clube) {
    setClube(novo);
    salvarClube(novo);
  }

  function adicionarOferta() {
    if (!novaOferta.titulo.trim() || !novaOferta.projectId) return;
    const oferta: OfertaBeneficio = { id: crypto.randomUUID(), ...novaOferta };
    atualizar({ ...clube, ofertas: [...clube.ofertas, oferta] });
    setNovaOferta({ projectId: projects[0]?.id ?? "", titulo: "", descricao: "" });
  }
  function removerOferta(id: string) {
    atualizar({ ...clube, ofertas: clube.ofertas.filter((o) => o.id !== id) });
  }

  function adicionarRegra() {
    if (!novaRegra.descricao.trim()) return;
    const regra: RegraPontos = { id: crypto.randomUUID(), ...novaRegra };
    atualizar({ ...clube, regrasPontos: [...clube.regrasPontos, regra] });
    setNovaRegra({ descricao: "", pontosGanhos: 0 });
  }
  function removerRegra(id: string) {
    atualizar({ ...clube, regrasPontos: clube.regrasPontos.filter((r) => r.id !== id) });
  }

  function adicionarPremio() {
    if (!novoPremio.nome.trim()) return;
    const premio: Premio = { id: crypto.randomUUID(), ...novoPremio };
    atualizar({ ...clube, premios: [...clube.premios, premio] });
    setNovoPremio({ nome: "", custoPontos: 0 });
  }
  function removerPremio(id: string) {
    atualizar({ ...clube, premios: clube.premios.filter((p) => p.id !== id) });
  }

  function nomeProjeto(id: string): string {
    return projects.find((p) => p.id === id)?.titulo || "(projeto removido)";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <button onClick={onVoltar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
          ← Meus projetos
        </button>
        <button
          onClick={() => exportarClubeBeneficiosDocx(clube, projects)}
          className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)]"
        >
          Exportar documento do clube (.docx)
        </button>
      </div>

      <CabecalhoSecao
        icone="n"
        olho="Rede da comunidade"
        titulo="Clube de Benefícios"
        apoio="Liga o que cada projeto produz às famílias atingidas: cartão de associado com desconto, pontos e prêmios, e uma vitrine dos produtos. Um projeto gera produto, o clube gera demanda, a demanda sustenta o projeto."
      />

      <Section
        title={
          <>
            <RefreshCw size={16} strokeWidth={2} />
            Lapidar clube (crítico → compilador)
          </>
        }
      >
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          Agentes avaliam a coerência do clube com os projetos reais (ofertas faltando, pontos impossíveis, prêmios desbalanceados) e propõem uma versão melhorada. Só substitui o clube atual com sua confirmação.
        </p>
        <button
          onClick={lapidar}
          disabled={lapidando || projects.length === 0}
          className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25 disabled:opacity-40"
        >
          {!lapidando && <RefreshCw size={14} strokeWidth={2} />}
          {lapidando ? (progressoLapidacao ?? "Lapidando...") : "Lapidar com agentes"}
        </button>
        {erroLapidacao && <p className="text-xs text-[color:var(--sm-red)]">{erroLapidacao}</p>}
        {lapidacao?.clube && (
          <div className="space-y-2 pt-2 text-sm">
            {lapidacao.problemas && lapidacao.problemas.length > 0 && (
              <div>
                <p className="font-medium">O que o crítico apontou</p>
                <ul className="list-disc pl-4 text-[color:var(--sm-yellow)]">
                  {lapidacao.problemas.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {lapidacao.changelog && lapidacao.changelog.length > 0 && (
              <div>
                <p className="font-medium">O que mudaria</p>
                <ul className="list-disc pl-4">
                  {lapidacao.changelog.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-[color:var(--sm-text-dim)]">
              Versão proposta: {lapidacao.clube.ofertas.length} oferta(s), {lapidacao.clube.regrasPontos.length} regra(s) de pontos, {lapidacao.clube.premios.length} prêmio(s).
            </p>
            <div className="flex gap-2">
              <button
                onClick={aplicarClubeLapidado}
                className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-3 py-1.5 text-xs hover:bg-[color:var(--sm-accent)]/30"
              >
                <Check size={12} strokeWidth={2} />
                Substituir clube pela versão lapidada
              </button>
              <button onClick={() => setLapidacao(null)} className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-red)]">
                Descartar
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Vitrine — descontos e serviços dos projetos (cartão de associado)">
        <div className="grid grid-cols-12 gap-2">
          <select className={`${inputClass} col-span-3`} value={novaOferta.projectId} onChange={(e) => setNovaOferta({ ...novaOferta, projectId: e.target.value })}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo || "(sem título)"}
              </option>
            ))}
          </select>
          <input
            className={`${inputClass} col-span-3`}
            placeholder="Ex.: Desconto de 10% no pão"
            value={novaOferta.titulo}
            onChange={(e) => setNovaOferta({ ...novaOferta, titulo: e.target.value })}
          />
          <input
            className={`${inputClass} col-span-5`}
            placeholder="Descrição / condições"
            value={novaOferta.descricao}
            onChange={(e) => setNovaOferta({ ...novaOferta, descricao: e.target.value })}
          />
          <button onClick={adicionarOferta} className="col-span-1 rounded border border-[color:var(--sm-accent)] text-xs hover:bg-[color:var(--sm-accent)]/20">
            +
          </button>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {clube.ofertas.map((o) => (
            <li key={o.id} className="flex items-center justify-between rounded border border-[color:var(--sm-border)] px-2 py-1">
              <span>
                <strong>{nomeProjeto(o.projectId)}</strong> — {o.titulo}: {o.descricao}
              </span>
              <button onClick={() => removerOferta(o.id)} className="text-xs text-[color:var(--sm-red)]">
                remover
              </button>
            </li>
          ))}
          {clube.ofertas.length === 0 && <li className="text-[color:var(--sm-text-dim)]">Nenhuma oferta cadastrada.</li>}
        </ul>
      </Section>

      <Section title="Programa de pontos — quando um projeto consome do outro">
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          Exemplo: "1kg de material reciclável separado e entregue = 10 pontos". Isso incentiva as pessoas a comprarem e participarem dos outros projetos da rede.
        </p>
        <div className="grid grid-cols-12 gap-2">
          <input
            className={`${inputClass} col-span-8`}
            placeholder="Ação que gera pontos"
            value={novaRegra.descricao}
            onChange={(e) => setNovaRegra({ ...novaRegra, descricao: e.target.value })}
          />
          <input
            type="number"
            className={`${inputClass} col-span-3`}
            placeholder="Pontos"
            value={novaRegra.pontosGanhos}
            onChange={(e) => setNovaRegra({ ...novaRegra, pontosGanhos: Number(e.target.value) })}
          />
          <button onClick={adicionarRegra} className="col-span-1 rounded border border-[color:var(--sm-accent)] text-xs hover:bg-[color:var(--sm-accent)]/20">
            +
          </button>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {clube.regrasPontos.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded border border-[color:var(--sm-border)] px-2 py-1">
              <span>
                {r.descricao} — {r.pontosGanhos} pontos
              </span>
              <button onClick={() => removerRegra(r.id)} className="text-xs text-[color:var(--sm-red)]">
                remover
              </button>
            </li>
          ))}
          {clube.regrasPontos.length === 0 && <li className="text-[color:var(--sm-text-dim)]">Nenhuma regra cadastrada.</li>}
        </ul>
      </Section>

      <Section title="Prêmios resgatáveis">
        <div className="grid grid-cols-12 gap-2">
          <input className={`${inputClass} col-span-8`} placeholder="Ex.: Cesta básica" value={novoPremio.nome} onChange={(e) => setNovoPremio({ ...novoPremio, nome: e.target.value })} />
          <input
            type="number"
            className={`${inputClass} col-span-3`}
            placeholder="Custo em pontos"
            value={novoPremio.custoPontos}
            onChange={(e) => setNovoPremio({ ...novoPremio, custoPontos: Number(e.target.value) })}
          />
          <button onClick={adicionarPremio} className="col-span-1 rounded border border-[color:var(--sm-accent)] text-xs hover:bg-[color:var(--sm-accent)]/20">
            +
          </button>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {clube.premios.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded border border-[color:var(--sm-border)] px-2 py-1">
              <span>
                {p.nome} — {p.custoPontos} pontos
              </span>
              <button onClick={() => removerPremio(p.id)} className="text-xs text-[color:var(--sm-red)]">
                remover
              </button>
            </li>
          ))}
          {clube.premios.length === 0 && <li className="text-[color:var(--sm-text-dim)]">Nenhum prêmio cadastrado.</li>}
        </ul>
      </Section>
    </div>
  );
}
