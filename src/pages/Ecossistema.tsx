import { useMemo, useState } from "react";
import type { Project } from "../lib/types";
import { calcularSaldosRealistas, analisarEcossistemaComIA, simularFundoRotativo, carregarAnaliseEcossistema, salvarAnaliseEcossistema, calcularCotaEquidade, type AnaliseEcossistema } from "../lib/ecosystem";
import { lapidarEcossistema, ETAPAS_PORTFOLIO_ROTULO, type ResultadoLapidacaoEcossistema } from "../lib/refinement-ecosystem";
import { exportarEcossistemaDocx } from "../lib/export";
import { carregarClube } from "../lib/clube-beneficios";
import { MapaEcossistema } from "../components/mapa/MapaEcossistema";
import { MapaGeografico } from "../components/mapa/MapaGeografico";
import { derivarConexoes } from "../lib/mapa-estagios";
import { Section } from "../components/Section";
import { Field, inputClass } from "../components/Field";

export function Ecossistema({
  projects,
  onVoltar,
  onAtualizarProjeto,
  onAbrirProjeto,
}: {
  projects: Project[];
  onVoltar: () => void;
  onAtualizarProjeto: (p: Project) => void;
  onAbrirProjeto: (id: string) => void;
}) {
  const [aba, setAba] = useState<"mapa" | "regiao" | "lista">("mapa");
  const [analisando, setAnalisando] = useState(false);
  const [erroAnalise, setErroAnalise] = useState<string | null>(null);
  const [analise, setAnalise] = useState<AnaliseEcossistema | null>(() => carregarAnaliseEcossistema());
  const [percentual, setPercentual] = useState(20);
  const [lapidando, setLapidando] = useState(false);
  const [progressoLapidacao, setProgressoLapidacao] = useState<string | null>(null);
  const [lapidacao, setLapidacao] = useState<ResultadoLapidacaoEcossistema | null>(null);
  const [sugestoesAplicadas, setSugestoesAplicadas] = useState<Set<string>>(new Set());

  const saldos = useMemo(() => calcularSaldosRealistas(projects), [projects]);
  const fundo = useMemo(() => simularFundoRotativo(projects, percentual), [projects, percentual]);
  const cota = useMemo(() => calcularCotaEquidade(projects), [projects]);

  const alertasLogistica = useMemo(() => {
    const conexoes = derivarConexoes(projects);
    const porId = new Map(projects.map((p) => [p.id, p]));
    const fragil = new Set(["estrada-terra", "dificil"]);
    const vistos = new Set<string>();
    const alertas: { chave: string; a: string; b: string; rotulo: string }[] = [];
    for (const c of conexoes) {
      const a = porId.get(c.deId);
      const b = porId.get(c.paraId);
      if (!a || !b) continue;
      const acessoA = a.espacoLogistica?.acesso;
      const acessoB = b.espacoLogistica?.acesso;
      if (!acessoA || !acessoB || !fragil.has(acessoA) || !fragil.has(acessoB)) continue;
      const chave = [a.id, b.id].sort().join("|");
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      alertas.push({ chave, a: a.titulo || "(sem título)", b: b.titulo || "(sem título)", rotulo: c.rotulo });
    }
    return alertas;
  }, [projects]);

  async function analisar() {
    setAnalisando(true);
    setErroAnalise(null);
    const resultado = await analisarEcossistemaComIA(projects);
    setAnalisando(false);
    if (!resultado.ok || !resultado.dado) {
      setErroAnalise(resultado.erro ?? "Não foi possível analisar.");
      return;
    }
    setAnalise(resultado.dado);
    salvarAnaliseEcossistema(resultado.dado);
  }

  async function lapidar() {
    setLapidando(true);
    setLapidacao(null);
    setErroAnalise(null);
    const resultado = await lapidarEcossistema(projects, analise, (etapa) => setProgressoLapidacao(ETAPAS_PORTFOLIO_ROTULO[etapa]));
    setLapidando(false);
    setProgressoLapidacao(null);
    if (!resultado.ok) {
      setErroAnalise(resultado.erro ?? "Não foi possível lapidar.");
      return;
    }
    setLapidacao(resultado);
    setSugestoesAplicadas(new Set());
  }

  function aplicarAnaliseLapidada() {
    if (lapidacao?.analise) {
      setAnalise(lapidacao.analise);
      salvarAnaliseEcossistema(lapidacao.analise);
    }
  }

  function aplicarSugestaoAoProjeto(projectId: string, sugestao: string) {
    const alvo = projects.find((p) => p.id === projectId);
    if (!alvo) return;
    onAtualizarProjeto({ ...alvo, observacoesEcossistema: [...(alvo.observacoesEcossistema ?? []), sugestao] });
    setSugestoesAplicadas((atual) => new Set(atual).add(`${projectId}:${sugestao}`));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <button onClick={onVoltar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
          ← Meus projetos
        </button>
        <button
          onClick={() => exportarEcossistemaDocx(projects, analise, fundo)}
          className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)]"
        >
          Exportar documento do ecossistema (.docx)
        </button>
      </div>

      <h1 className="text-xl font-bold">Ecossistema de projetos</h1>
      <p className="text-sm text-[color:var(--sm-text-dim)]">
        Quanto mais projetos cadastrados, mais o sistema tem para cruzar. Isso não substitui o motor de conformidade de cada projeto — é uma visão de portfólio.
      </p>

      <div className="flex gap-1">
        {(["mapa", "regiao", "lista"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`rounded border px-3 py-1.5 text-sm ${aba === a ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)] hover:border-[color:var(--sm-accent)]"}`}
          >
            {a === "mapa" ? "🗺 Mapa" : a === "regiao" ? "🗾 Região" : "📋 Lista"}
          </button>
        ))}
      </div>

      {aba === "mapa" && (
        <MapaEcossistema
          projects={projects}
          percentualFundo={percentual}
          ofertasPorProjeto={new Map(carregarClube().ofertas.reduce((mapa, o) => mapa.set(o.projectId, (mapa.get(o.projectId) ?? 0) + 1), new Map<string, number>()))}
          onAbrirProjeto={onAbrirProjeto}
        />
      )}

      {aba === "regiao" && <MapaGeografico projects={projects} onAbrirProjeto={onAbrirProjeto} />}

      {aba === "lista" && (
      <>
      <Section title="Cota de equidade agregada (Proposta pág. 53 — mínimo 30%)">
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          % do orçamento total do portfólio alocado a projetos com público prioritário (pessoas mais pobres, PCTs, mulheres, Familiares de Vítimas Fatais, Zona Quente) — conta também projeto marcado
          como "coordenação por mulher(es)", mesmo com outro setor selecionado.
        </p>
        <p className="text-sm">
          <strong className={cota.atingida ? "text-[color:var(--sm-green)]" : "text-[color:var(--sm-red)]"}>{(cota.percentual * 100).toFixed(1)}%</strong>
          {" "}do orçamento (R$ {cota.valorPrioritario.toFixed(2)} de R$ {cota.valorTotal.toFixed(2)}) — meta: {(cota.meta * 100).toFixed(0)}%
          {cota.atingida ? " ✅ atingida" : " 🔴 abaixo da meta"}
        </p>
        {cota.projetosPrioritarios.length > 0 && (
          <ul className="space-y-0.5 text-xs text-[color:var(--sm-text-dim)]">
            {cota.projetosPrioritarios.map((p) => (
              <li key={p.projectId}>
                • {p.titulo} — {p.motivo}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {alertasLogistica.length > 0 && (
        <Section title="🟡 Alerta de logística frágil entre projetos integrados">
          <ul className="space-y-1 text-sm">
            {alertasLogistica.map((a) => (
              <li key={a.chave} className="rounded border border-[color:var(--sm-yellow)]/50 bg-[color:var(--sm-yellow)]/10 p-2">
                <strong>{a.a}</strong> ↔ <strong>{a.b}</strong> ({a.rotulo}) — ambos com acesso de estrada de terra/difícil; risco de custo/atraso na troca de insumos.
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Rede de projetos — saldo mensal (cenário realista)">
        <ul className="space-y-1 text-sm">
          {saldos.map((s) => (
            <li key={s.projectId} className="flex items-center justify-between rounded border border-[color:var(--sm-border)] px-2 py-1">
              <span>{s.titulo}</span>
              <span className={s.saldoMensalRealista >= 0 ? "text-[color:var(--sm-green)]" : "text-[color:var(--sm-red)]"}>
                R$ {s.saldoMensalRealista.toFixed(2)}/mês
              </span>
            </li>
          ))}
          {saldos.length === 0 && <li className="text-[color:var(--sm-text-dim)]">Nenhum projeto cadastrado ainda.</li>}
        </ul>
      </Section>

      <Section title="Análise por IA — complementaridades, redundâncias e mercado comprador">
        <button
          onClick={analisar}
          disabled={analisando}
          className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25 disabled:opacity-40"
        >
          {analisando ? "Analisando..." : "🔎 Analisar ecossistema com IA"}
        </button>
        {erroAnalise && <p className="text-xs text-[color:var(--sm-red)]">{erroAnalise}</p>}
        {analise && (
          <div className="space-y-3 pt-2 text-sm">
            <div>
              <p className="font-medium">Complementaridades (cadeias locais)</p>
              <ul className="list-disc pl-4">
                {analise.complementaridades.length ? analise.complementaridades.map((c, i) => <li key={i}>{c}</li>) : <li className="text-[color:var(--sm-text-dim)]">Nenhuma identificada.</li>}
              </ul>
            </div>
            <div>
              <p className="font-medium">Redundâncias</p>
              <ul className="list-disc pl-4">
                {analise.redundancias.length ? analise.redundancias.map((c, i) => <li key={i}>{c}</li>) : <li className="text-[color:var(--sm-text-dim)]">Nenhuma identificada.</li>}
              </ul>
            </div>
            <div>
              <p className="font-medium">Mercado comprador entre projetos (Ofício 46, 4.1 §4)</p>
              <ul className="list-disc pl-4">
                {analise.mercadosCompradores.length ? analise.mercadosCompradores.map((c, i) => <li key={i}>{c}</li>) : <li className="text-[color:var(--sm-text-dim)]">Nenhuma identificada.</li>}
              </ul>
            </div>
          </div>
        )}
      </Section>

      <Section title="🔁 Lapidar ecossistema (crítico → sugestor → compilador)">
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          Três agentes avaliam o conjunto de projetos e propõem uma versão melhorada da análise + sugestões de integração por projeto. Nada é aplicado sem sua confirmação.
        </p>
        <button
          onClick={lapidar}
          disabled={lapidando}
          className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25 disabled:opacity-40"
        >
          {lapidando ? (progressoLapidacao ?? "Lapidando...") : "🔁 Lapidar com agentes"}
        </button>
        {lapidacao && (
          <div className="space-y-3 pt-2 text-sm">
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
                <p className="font-medium">O que mudaria na análise</p>
                <ul className="list-disc pl-4">
                  {lapidacao.changelog.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {lapidacao.analise && (
              <button onClick={aplicarAnaliseLapidada} className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-3 py-1.5 text-xs hover:bg-[color:var(--sm-accent)]/30">
                ✔ Aplicar análise melhorada
              </button>
            )}
            {lapidacao.sugestoesPorProjeto && lapidacao.sugestoesPorProjeto.length > 0 && (
              <div>
                <p className="font-medium">Sugestões por projeto (aplicar adiciona às "Observações do ecossistema" do projeto)</p>
                <ul className="space-y-1 pl-0">
                  {lapidacao.sugestoesPorProjeto.map((s, i) => {
                    const chave = `${s.projectId}:${s.sugestao}`;
                    const aplicada = sugestoesAplicadas.has(chave);
                    return (
                      <li key={i} className="flex items-start justify-between gap-2 rounded border border-[color:var(--sm-border)] p-2">
                        <span>
                          <strong>{s.titulo}</strong>: {s.sugestao}
                        </span>
                        <button
                          onClick={() => aplicarSugestaoAoProjeto(s.projectId, s.sugestao)}
                          disabled={aplicada}
                          className="shrink-0 rounded border border-[color:var(--sm-accent)] px-2 py-1 text-xs hover:bg-[color:var(--sm-accent)]/20 disabled:opacity-40"
                        >
                          {aplicada ? "✔ aplicada" : "aplicar"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Simulação: Fundo Rotativo Solidário (Proposta 5.5)">
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          Simulação apenas — não move dinheiro real. Projetos com saldo positivo contribuiriam um percentual para um fundo comum, que ajudaria projetos deficitários. Isso precisa ser estruturado como
          fundo/crédito solidário de verdade (não custeio permanente disfarçado — Vedação Geral III).
        </p>
        <Field label="Percentual de contribuição dos projetos superavitários">
          <input type="number" min={0} max={100} className={inputClass} value={percentual} onChange={(e) => setPercentual(Number(e.target.value))} />
        </Field>
        <div className="space-y-2 pt-2 text-sm">
          <p>
            Pool mensal formado: <strong>R$ {fundo.poolMensal.toFixed(2)}</strong>
          </p>
          {fundo.contribuintes.length > 0 && (
            <div>
              <p className="font-medium">Contribuintes</p>
              <ul className="list-disc pl-4">
                {fundo.contribuintes.map((c, i) => (
                  <li key={i}>
                    {c.titulo}: R$ {c.contribuicaoMensal.toFixed(2)}/mês
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fundo.beneficiarios.length > 0 && (
            <div>
              <p className="font-medium">Projetos deficitários e cobertura estimada</p>
              <ul className="list-disc pl-4">
                {fundo.beneficiarios.map((b, i) => (
                  <li key={i}>
                    {b.titulo}: déficit R$ {b.deficitMensal.toFixed(2)}/mês, cobertura estimada R$ {b.coberturaEstimada.toFixed(2)}/mês
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[color:var(--sm-text-dim)]">Pool restante não alocado: R$ {fundo.poolRestante.toFixed(2)}/mês</p>
        </div>
      </Section>
      </>
      )}
    </div>
  );
}
