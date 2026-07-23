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
import { useTasks } from "../lib/task-context";
import { CabecalhoSecao } from "../components/CabecalhoSecao";
import { Map as MapIcon, MapPinned, List, CheckCircle2, Search, RefreshCw, Check } from "lucide-react";

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
  const { registrar, atualizar, concluir, falhar } = useTasks();

  const saldos = useMemo(() => calcularSaldosRealistas(projects), [projects]);
  const fundo = useMemo(() => simularFundoRotativo(projects, percentual), [projects, percentual]);
  const cota = useMemo(() => calcularCotaEquidade(projects), [projects]);
  // Estável entre renders: um Map novo a cada render reconstruía a cena 3D inteira.
  const ofertasPorProjeto = useMemo(
    () => carregarClube().ofertas.reduce((mapa, o) => mapa.set(o.projectId, (mapa.get(o.projectId) ?? 0) + 1), new Map<string, number>()),
    [],
  );

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
    const taskId = registrar("analise-ecossistema", "Analisando ecossistema com IA...");
    const resultado = await analisarEcossistemaComIA(projects);
    setAnalisando(false);
    if (!resultado.ok || !resultado.dado) {
      const erro = resultado.erro ?? "Não foi possível analisar.";
      setErroAnalise(erro);
      falhar(taskId, erro);
      return;
    }
    setAnalise(resultado.dado);
    salvarAnaliseEcossistema(resultado.dado);
    concluir(taskId);
  }

  async function lapidar() {
    setLapidando(true);
    setLapidacao(null);
    setErroAnalise(null);
    const taskId = registrar("lapidacao-ecossistema", "Lapidando ecossistema...");
    const resultado = await lapidarEcossistema(projects, analise, (etapa) => {
      setProgressoLapidacao(ETAPAS_PORTFOLIO_ROTULO[etapa]);
      atualizar(taskId, { progresso: { etapaAtual: ETAPAS_PORTFOLIO_ROTULO[etapa] } });
    });
    setLapidando(false);
    setProgressoLapidacao(null);
    if (!resultado.ok) {
      const erro = resultado.erro ?? "Não foi possível lapidar.";
      setErroAnalise(erro);
      falhar(taskId, erro);
      return;
    }
    setLapidacao(resultado);
    setSugestoesAplicadas(new Set());
    concluir(taskId);
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
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
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

      <CabecalhoSecao
        icone="u"
        olho="Visão geral"
        titulo="Ecossistema de projetos"
        apoio="Quanto mais projetos você cadastra, mais o programa encontra pra cruzar. Isso não muda o que o acordo permite em cada projeto — é só uma vista de conjunto."
      />

      <div className="flex gap-1">
        {(["mapa", "regiao", "lista"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm ${aba === a ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)] hover:border-[color:var(--sm-accent)]"}`}
          >
            {a === "mapa" ? <MapIcon size={14} strokeWidth={2} /> : a === "regiao" ? <MapPinned size={14} strokeWidth={2} /> : <List size={14} strokeWidth={2} />}
            {a === "mapa" ? "Mapa" : a === "regiao" ? "Região" : "Lista"}
          </button>
        ))}
      </div>

      {aba === "mapa" && <MapaEcossistema projects={projects} percentualFundo={percentual} ofertasPorProjeto={ofertasPorProjeto} onAbrirProjeto={onAbrirProjeto} />}

      {aba === "regiao" && <MapaGeografico projects={projects} onAbrirProjeto={onAbrirProjeto} />}

      {aba === "lista" && (
      <>
      <Section title="Quanto vai para quem mais precisa (mínimo 30%)">
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          Porcentagem do orçamento total que vai para projetos com público prioritário: pessoas mais pobres, PCTs (Povos e Comunidades Tradicionais), mulheres, Familiares de Vítimas Fatais, Zona Quente.
          Um projeto marcado como "coordenação por mulher(es)" também conta, mesmo com outro setor selecionado.
        </p>
        <p className="text-sm">
          <strong className={cota.atingida ? "text-[color:var(--sm-green)]" : "text-[color:var(--sm-red)]"}>{(cota.percentual * 100).toFixed(1)}%</strong>
          {" "}do orçamento (R$ {cota.valorPrioritario.toFixed(2)} de R$ {cota.valorTotal.toFixed(2)}) — meta: {(cota.meta * 100).toFixed(0)}%
          {cota.atingida ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 size={14} strokeWidth={2} className="text-[color:var(--sm-ok-text)]" />
              atingida
            </span>
          ) : (
            " 🔴 abaixo da meta"
          )}
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
        <Section title="🟡 Atenção: acesso difícil entre projetos ligados">
          <ul className="space-y-1 text-sm">
            {alertasLogistica.map((a) => (
              <li key={a.chave} className="rounded border border-[color:var(--sm-yellow)]/50 bg-[color:var(--sm-yellow)]/10 p-2">
                <strong>{a.a}</strong> ↔ <strong>{a.b}</strong> ({a.rotulo}) — os dois têm acesso por estrada de terra ou difícil: risco de custo e atraso ao trocar insumos entre eles.
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

      <Section title="Análise por IA — o que se completa, o que se repete, quem compra de quem">
        <button
          onClick={analisar}
          disabled={analisando}
          className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25 disabled:opacity-40"
        >
          {!analisando && <Search size={14} strokeWidth={2} />}
          {analisando ? "Analisando..." : "Analisar ecossistema com IA"}
        </button>
        {erroAnalise && <p className="text-xs text-[color:var(--sm-red)]">{erroAnalise}</p>}
        {analise && (
          <div className="space-y-3 pt-2 text-sm">
            <div>
              <p className="font-medium">O que se completa entre os projetos</p>
              <ul className="list-disc pl-4">
                {analise.complementaridades.length ? analise.complementaridades.map((c, i) => <li key={i}>{c}</li>) : <li className="text-[color:var(--sm-text-dim)]">Nenhuma identificada.</li>}
              </ul>
            </div>
            <div>
              <p className="font-medium">O que se repete</p>
              <ul className="list-disc pl-4">
                {analise.redundancias.length ? analise.redundancias.map((c, i) => <li key={i}>{c}</li>) : <li className="text-[color:var(--sm-text-dim)]">Nenhuma identificada.</li>}
              </ul>
            </div>
            <div>
              <p className="font-medium">Quem pode comprar de quem</p>
              <ul className="list-disc pl-4">
                {analise.mercadosCompradores.length ? analise.mercadosCompradores.map((c, i) => <li key={i}>{c}</li>) : <li className="text-[color:var(--sm-text-dim)]">Nenhuma identificada.</li>}
              </ul>
            </div>
          </div>
        )}
      </Section>

      <Section
        title={
          <>
            <RefreshCw size={16} strokeWidth={2} />
            Lapidar ecossistema (crítico → sugestor → compilador)
          </>
        }
      >
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          Três agentes avaliam o conjunto de projetos e propõem uma versão melhorada da análise + sugestões de integração por projeto. Nada é aplicado sem sua confirmação.
        </p>
        <button
          onClick={lapidar}
          disabled={lapidando}
          className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25 disabled:opacity-40"
        >
          {!lapidando && <RefreshCw size={14} strokeWidth={2} />}
          {lapidando ? (progressoLapidacao ?? "Lapidando...") : "Lapidar com agentes"}
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
              <button
                onClick={aplicarAnaliseLapidada}
                className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-3 py-1.5 text-xs hover:bg-[color:var(--sm-accent)]/30"
              >
                <Check size={12} strokeWidth={2} />
                Aplicar análise melhorada
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
                          {aplicada ? (
                            <span className="inline-flex items-center gap-1">
                              <Check size={12} strokeWidth={2} />
                              aplicada
                            </span>
                          ) : (
                            "aplicar"
                          )}
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

      <Section title="Simulação: fundo de ajuda entre projetos">
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          É só uma simulação — não move dinheiro de verdade. Projetos com saldo positivo dariam uma parte para um fundo comum, que ajudaria os projetos no vermelho. Isso precisa virar um fundo ou
          crédito solidário de verdade: o acordo não permite disfarçar uma despesa permanente assim.
        </p>
        <Field label="Quanto (%) os projetos no positivo contribuem">
          <input type="number" min={0} max={100} className={inputClass} value={percentual} onChange={(e) => setPercentual(Number(e.target.value))} />
        </Field>
        <div className="space-y-2 pt-2 text-sm">
          <p>
            Total reunido no fundo por mês: <strong>R$ {fundo.poolMensal.toFixed(2)}</strong>
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
              <p className="font-medium">Projetos no vermelho e quanto o fundo cobriria</p>
              <ul className="list-disc pl-4">
                {fundo.beneficiarios.map((b, i) => (
                  <li key={i}>
                    {b.titulo}: déficit R$ {b.deficitMensal.toFixed(2)}/mês, cobertura estimada R$ {b.coberturaEstimada.toFixed(2)}/mês
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[color:var(--sm-text-dim)]">Sobra do fundo, sem destino ainda: R$ {fundo.poolRestante.toFixed(2)}/mês</p>
        </div>
      </Section>
      </>
      )}
    </div>
  );
}
