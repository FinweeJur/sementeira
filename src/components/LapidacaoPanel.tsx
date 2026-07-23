import { useEffect, useState } from "react";
import {
  assinarLapidacao,
  atualizarLapidacao,
  limparLapidacao,
  obterLapidacao,
  reiniciarLapidacao,
} from "../lib/lapidacao-em-andamento";
import type { Project } from "../lib/types";
import {
  lapidarProjeto,
  registrarLapidacao,
  commitarVersaoLapidada,
  ETAPAS_ROTULO,
  type EtapaLapidacao,
} from "../lib/refinement-loop";
import { carregarConfigComparacao, nomeProvedor, configuracaoLLMPronta } from "../lib/providers";
import { useTasks } from "../lib/task-context";
import { Badge } from "./Badge";
import { PenLine, Wallet, Search, AlertTriangle, Lightbulb, Puzzle, Square, Map, Scale, Users, Brain, Check, RefreshCw, type LucideIcon } from "lucide-react";

const ETAPAS_ORDEM: EtapaLapidacao[] = ["escritor", "orcamentista", "critico", "riscos", "sugestor", "compilador"];
const ETAPAS_ICONE: Record<EtapaLapidacao, LucideIcon> = {
  escritor: PenLine,
  orcamentista: Wallet,
  critico: Search,
  riscos: AlertTriangle,
  sugestor: Lightbulb,
  compilador: Puzzle,
};

/** Barra de estágio ao vivo, no espírito do indicador de streaming do Hermes/Claude Code — mostra qual agente está rodando agora e permite parar a qualquer momento. */
function BarraDeEstagio({ volta, totalVoltas, etapaAtual, segundos, onParar }: { volta: number; totalVoltas: number; etapaAtual: EtapaLapidacao | null; segundos: number; onParar: () => void }) {
  const indiceAtual = etapaAtual ? ETAPAS_ORDEM.indexOf(etapaAtual) : -1;
  return (
    <div className="space-y-2 rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/5 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          Volta {volta}/{totalVoltas}
          {etapaAtual && (
            <>
              {(() => {
                const Icone = ETAPAS_ICONE[etapaAtual];
                return <Icone size={14} strokeWidth={2} />;
              })()}
              — {ETAPAS_ROTULO[etapaAtual]}
            </>
          )}
        </p>
        <button
          onClick={onParar}
          title="Parar a lapidação agora"
          className="flex items-center gap-1 rounded border border-[color:var(--sm-red)] bg-[color:var(--sm-red)]/10 px-2 py-1 text-xs font-medium text-[color:var(--sm-red)] hover:bg-[color:var(--sm-red)]/20"
        >
          <Square size={12} strokeWidth={2} fill="currentColor" />
          Parar
        </button>
      </div>
      <div className="flex gap-1">
        {ETAPAS_ORDEM.map((etapa, i) => {
          const concluida = indiceAtual > i;
          const emAndamento = indiceAtual === i;
          return (
            <div
              key={etapa}
              title={ETAPAS_ROTULO[etapa]}
              className={`h-1.5 flex-1 rounded-full ${
                concluida ? "bg-[color:var(--sm-accent)]" : emAndamento ? "bg-[color:var(--sm-accent)]/60 sm-etapa-pulsando" : "bg-[color:var(--sm-border)]"
              }`}
            />
          );
        })}
      </div>
      <p className="text-xs text-[color:var(--sm-text-dim)]">
        Rodando há {segundos}s. Com Ollama local pode ser lento — a parada acontece assim que a chamada atual terminar.
      </p>
      <p className="text-xs text-[color:var(--sm-accent)]">
        Pode fechar esta janela e continuar usando o app: a lapidação segue rodando e o resultado fica guardado para quando você
        voltar aqui. Ela só para se você clicar em <strong>Parar</strong>.
      </p>
    </div>
  );
}

export function LapidacaoPanel({
  project,
  onAplicar,
  onClose,
}: {
  project: Project;
  onAplicar: (projetoLapidado: Project) => void;
  onClose: () => void;
}) {
  const [voltas, setVoltas] = useState(1);
  const [segundosDecorridos, setSegundosDecorridos] = useState(0);

  // O andamento e o resultado moram fora do componente: fechar o painel
  // desmonta este componente, e antes disso levava junto o resultado de uma
  // lapidação que continuava rodando. Ver lapidacao-em-andamento.ts.
  const [, forcarRender] = useState(0);
  useEffect(() => assinarLapidacao(project.id, () => forcarRender((n) => n + 1)), [project.id]);
  const emAndamento = obterLapidacao(project.id);
  const { rodando, volta, etapaAtual, resultado, erro, inicioEm, duracaoSeg } = emAndamento;
  const [perguntandoMotivo, setPerguntandoMotivo] = useState(false);
  const [motivoDescarte, setMotivoDescarte] = useState("");

  const configComparacao = carregarConfigComparacao();
  const comparacaoPronta = configComparacao ? configuracaoLLMPronta(configComparacao).pronta : false;
  const [comparar, setComparar] = useState(false);
  const { registrar, atualizar, concluir, falhar, isCancelada } = useTasks();

  // Timer ao vivo enquanto roda — mesmo espírito do indicador de streaming do Hermes/Claude Code.
  useEffect(() => {
    if (!rodando || !inicioEm) return;
    // Calcula na hora também, e não só a cada tique: ao reabrir o painel no
    // meio de uma lapidação, o contador mostraria 0s pelo primeiro segundo.
    const medir = () => setSegundosDecorridos(Math.round((Date.now() - inicioEm) / 1000));
    medir();
    const id = window.setInterval(medir, 1000);
    return () => window.clearInterval(id);
  }, [rodando, inicioEm]);

  async function rodar() {
    const projectId = project.id;
    // Reabrir o painel no meio de uma lapidação não pode disparar uma segunda
    // por cima da primeira — as duas escreveriam no mesmo estado.
    if (obterLapidacao(projectId).rodando) return;
    reiniciarLapidacao(projectId, voltas);
    setSegundosDecorridos(0);
    const inicio = Date.now();

    // Registra a tarefa no TaskContext — sobrevive se o usuário fechar o panel ou navegar.
    const taskId = registrar("lapidacao-projeto", `Lapidando "${project.titulo || "projeto"}"...`, projectId);

    const r = await lapidarProjeto(project, {
      voltas,
      onProgresso: (v: number, etapa: EtapaLapidacao) => {
        atualizarLapidacao(projectId, { volta: v, etapaAtual: etapa });
        atualizar(taskId, { progresso: { volta: v, totalVoltas: voltas, etapaAtual: ETAPAS_ROTULO[etapa] } });
      },
      cancelado: () => obterLapidacao(projectId).cancelado || isCancelada(taskId),
      compararConfig: comparar && comparacaoPronta && configComparacao ? configComparacao : undefined,
      onProgressoComparacao: (v: number) => atualizarLapidacao(projectId, { volta: v }),
    });

    atualizarLapidacao(projectId, {
      rodando: false,
      etapaAtual: null,
      duracaoSeg: Math.round((Date.now() - inicio) / 1000),
    });

    if (!r.ok) {
      atualizarLapidacao(projectId, { erro: r.erro ?? "Falha na lapidação." });
      falhar(taskId, r.erro ?? "Falha na lapidação.");
      if (r.voltas.length === 0) return;
    } else {
      // Diff para a sidebar mostrar
      const scoreInicial = r.voltas[0]?.scoreAntes;
      const scoreFinal = r.voltas[r.voltas.length - 1]?.scoreDepois;
      const diff =
        scoreInicial && scoreFinal
          ? `🔴 ${scoreInicial.bloqueios}→${scoreFinal.bloqueios} · 🟡 ${scoreInicial.atencoes}→${scoreFinal.atencoes}`
          : undefined;
      concluir(taskId, undefined, diff);
    }
    atualizarLapidacao(projectId, { resultado: r });
  }

  function parar() {
    atualizarLapidacao(project.id, { cancelado: true });
  }

  function aplicar() {
    if (!resultado?.projetoFinal) return;
    registrarLapidacao(true, resultado);
    const ultimaVolta = resultado.voltas[resultado.voltas.length - 1];
    onAplicar(commitarVersaoLapidada(project, resultado.projetoFinal, ultimaVolta?.changelog ?? []));
    limparLapidacao(project.id);
    onClose();
  }

  function aplicarComparacao() {
    const comp = resultado?.voltas[resultado.voltas.length - 1]?.comparacao;
    if (!comp || !resultado) return;
    registrarLapidacao(true, resultado);
    onAplicar(commitarVersaoLapidada(project, comp.projetoResultante, comp.changelog));
    limparLapidacao(project.id);
    onClose();
  }

  /** Fechar com o X: só guarda o resultado; nada é descartado nem aplicado. */
  function pedirMotivoOuFechar() {
    if (resultado) setPerguntandoMotivo(true);
    else onClose();
  }

  function confirmarDescarte(motivo?: string) {
    if (resultado) registrarLapidacao(false, resultado, motivo);
    limparLapidacao(project.id);
    onClose();
  }

  const ultimaVolta = resultado?.voltas[resultado.voltas.length - 1];
  const scoreInicial = resultado?.voltas[0]?.scoreAntes;
  const scoreFinal = ultimaVolta?.scoreDepois;
  const introduziuBloqueio = resultado?.voltas.some((v) => v.introduziuBloqueio) ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            <RefreshCw size={16} strokeWidth={2} />
            Ciclo de Lapidação
          </h2>
          <button onClick={pedirMotivoOuFechar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            fechar
          </button>
        </div>
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          Seis agentes revisam o projeto em sequência (escritor → orçamentista → crítico → riscos → sugestor → compilador). Nada muda no projeto até você clicar "Aplicar".
        </p>

        {perguntandoMotivo && (
          <div className="space-y-2 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-3">
            <p className="text-sm font-medium">Por que está descartando esta versão? (opcional)</p>
            <p className="text-xs text-[color:var(--sm-text-dim)]">Ajuda o ciclo a aprender e evitar o mesmo problema nas próximas lapidações (nenhum dado sai do seu computador).</p>
            <textarea
              className="w-full rounded border border-[color:var(--sm-border)] bg-transparent p-2 text-sm"
              rows={2}
              placeholder="Ex.: metas continuam infladas, texto genérico demais, ignorou a rede..."
              value={motivoDescarte}
              onChange={(e) => setMotivoDescarte(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => confirmarDescarte(motivoDescarte)}
                className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-3 py-1.5 text-xs hover:bg-[color:var(--sm-accent)]/30"
              >
                Confirmar descarte
              </button>
              <button onClick={() => confirmarDescarte()} className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-accent)]">
                Descartar sem informar
              </button>
              <button onClick={() => setPerguntandoMotivo(false)} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
                cancelar
              </button>
            </div>
          </div>
        )}

        {!resultado && !rodando && (
          <div className="space-y-2">
            <label className="block text-sm">
              Quantas voltas? (cada volta = 6 chamadas de IA)
              <select
                className="mt-1 w-full rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] px-3 py-2 text-sm"
                value={voltas}
                onChange={(e) => setVoltas(Number(e.target.value))}
              >
                <option value={1}>1 volta (recomendado)</option>
                <option value={2}>2 voltas</option>
                <option value={3}>3 voltas</option>
              </select>
            </label>
            {configComparacao && (
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={comparar} disabled={!comparacaoPronta} onChange={(e) => setComparar(e.target.checked)} className="mt-0.5" />
                <span>
                  Comparar Crítico/Compilador com {nomeProvedor(configComparacao)} (2º modelo)
                  {!comparacaoPronta && " — config. incompleta em Configurações"}
                </span>
              </label>
            )}
            <button
              onClick={rodar}
              className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-4 py-2 text-sm hover:bg-[color:var(--sm-accent)]/25"
            >
              Iniciar lapidação
            </button>
          </div>
        )}

        {rodando && <BarraDeEstagio volta={volta} totalVoltas={voltas} etapaAtual={etapaAtual} segundos={segundosDecorridos} onParar={parar} />}

        {erro && <p className="text-xs text-[color:var(--sm-red)]">{erro}</p>}

        {resultado && ultimaVolta && (
          <div className="space-y-3">
            {scoreInicial && scoreFinal && (
              <div className="rounded border border-[color:var(--sm-border)] p-2 text-sm">
                <p className="font-medium">Antes → Depois (medido pelas regras do acordo)</p>
                <p>
                  🔴 Bloqueios: {scoreInicial.bloqueios} → {scoreFinal.bloqueios} · 🟡 Atenções: {scoreInicial.atencoes} → {scoreFinal.atencoes} · Pendências: {scoreInicial.pendencias} →{" "}
                  {scoreFinal.pendencias}
                </p>
                {duracaoSeg !== null && <p className="text-xs text-[color:var(--sm-text-dim)]">Duração: {duracaoSeg}s · {resultado.voltas.length} volta(s)</p>}
              </div>
            )}

            {introduziuBloqueio && (
              <div className="flex items-start gap-2 rounded border border-[color:var(--sm-red)]/50 bg-[color:var(--sm-red)]/10 p-2 text-sm">
                <Badge severidade="bloqueio" />
                <p>A versão lapidada INTRODUZIU um bloqueio novo que não existia. Revise com cuidado antes de aplicar — a recomendação é descartar ou corrigir manualmente depois.</p>
              </div>
            )}

            {resultado.convergiu && (
              <p className="rounded border border-[color:var(--sm-yellow)]/40 bg-[color:var(--sm-yellow)]/10 p-2 text-xs">
                O ciclo parou sozinho: a última volta não resolveu nada novo (medido pelas regras do acordo), ou o compilador viu que não dava mais pra melhorar — assim evita gastar chamadas de IA à toa.
              </p>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium">O que o compilador mudou em cada versão</p>
              {resultado.voltas.map((v, i) => (
                <div key={i} className="rounded border border-[color:var(--sm-border)] p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Versão {i + 1} (volta {i + 1} de {resultado.voltas.length})</p>
                    <p className="text-xs text-[color:var(--sm-text-dim)]">
                      🔴 {v.scoreAntes.bloqueios}→{v.scoreDepois.bloqueios} · 🟡 {v.scoreAntes.atencoes}→{v.scoreDepois.atencoes} · Pend. {v.scoreAntes.pendencias}→{v.scoreDepois.pendencias}
                    </p>
                  </div>
                  {v.notas && (
                    <p className="text-xs">
                      Notas do crítico: realismo {v.notas.realismo} · sustentabilidade {v.notas.sustentabilidade} · conformidade {v.notas.conformidade} · integração c/ rede {v.notas.integracaoRede} · <strong>média {v.notas.media}</strong>
                    </p>
                  )}
                  {v.consideracoes && (v.consideracoes.juridica.length + v.consideracoes.sociologica.length + v.consideracoes.psicologica.length > 0) && (
                    <div className="mt-1 space-y-1 text-xs">
                      {v.consideracoes.juridica.length > 0 && (
                        <p className="flex items-start gap-1.5">
                          <Scale size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
                          <span><strong>Jurídico-fundiário:</strong> {v.consideracoes.juridica.join(" ")}</span>
                        </p>
                      )}
                      {v.consideracoes.sociologica.length > 0 && (
                        <p className="flex items-start gap-1.5">
                          <Users size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
                          <span><strong>Sociológico:</strong> {v.consideracoes.sociologica.join(" ")}</span>
                        </p>
                      )}
                      {v.consideracoes.psicologica.length > 0 && (
                        <p className="flex items-start gap-1.5">
                          <Brain size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
                          <span><strong>Psicológico:</strong> {v.consideracoes.psicologica.join(" ")}</span>
                        </p>
                      )}
                    </div>
                  )}
                  {v.introduziuBloqueio && (
                    <p className="flex items-center gap-1.5 text-xs text-[color:var(--sm-red)]">
                      <AlertTriangle size={12} strokeWidth={2} />
                      Esta versão introduziu um bloqueio novo.
                    </p>
                  )}
                  <ul className="list-disc pl-4 text-sm">
                    {v.changelog.length > 0 ? (
                      v.changelog.map((c, j) => <li key={j}>{c}</li>)
                    ) : (
                      <li className="text-[color:var(--sm-text-dim)]">O compilador não descreveu mudanças nesta versão.</li>
                    )}
                  </ul>

                  {v.comparacao && (
                    <div className="mt-2 space-y-1 rounded border border-[color:var(--sm-accent)]/30 bg-[color:var(--sm-accent)]/5 p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium">🆚 Versão do modelo {v.comparacao.providerNome}</p>
                        <p className="text-xs text-[color:var(--sm-text-dim)]">
                          🔴 {v.scoreAntes.bloqueios}→{v.comparacao.scoreDepois.bloqueios} · 🟡 {v.scoreAntes.atencoes}→{v.comparacao.scoreDepois.atencoes} · Pend.{" "}
                          {v.scoreAntes.pendencias}→{v.comparacao.scoreDepois.pendencias}
                        </p>
                      </div>
                      {v.comparacao.notas && (
                        <p className="text-xs">
                          Notas: realismo {v.comparacao.notas.realismo} · sustentabilidade {v.comparacao.notas.sustentabilidade} · conformidade {v.comparacao.notas.conformidade} · integração c/ rede{" "}
                          {v.comparacao.notas.integracaoRede} · <strong>média {v.comparacao.notas.media}</strong>
                          {v.notas && ` (vs. ${v.notas.media} do modelo principal)`}
                        </p>
                      )}
                      <ul className="list-disc pl-4 text-xs">
                        {v.comparacao.changelog.length > 0 ? (
                          v.comparacao.changelog.map((c, j) => <li key={j}>{c}</li>)
                        ) : (
                          <li className="text-[color:var(--sm-text-dim)]">Sem lista de mudanças descrita.</li>
                        )}
                      </ul>
                      {i === resultado.voltas.length - 1 && (
                        <button
                          onClick={aplicarComparacao}
                          className="mt-1 inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1 text-xs hover:bg-[color:var(--sm-accent)]/25"
                        >
                          <Check size={12} strokeWidth={2} />
                          Aplicar esta versão ({v.comparacao.providerNome}) em vez da principal
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {ultimaVolta.avaliacaoResumo && (
              <div className="rounded border border-[color:var(--sm-border)] p-2 text-sm">
                <p className="font-medium">Avaliação do compilador (frente às diretrizes e metas)</p>
                <p>{ultimaVolta.avaliacaoResumo}</p>
                {ultimaVolta.recomendaNovaVolta !== undefined && (
                  <p className="text-xs text-[color:var(--sm-text-dim)]">
                    {ultimaVolta.recomendaNovaVolta
                      ? "O compilador acredita que mais uma volta ainda traria ganho."
                      : "O compilador avalia que a versão está madura — os pontos restantes pedem decisão humana, não outra volta de IA."}
                  </p>
                )}
              </div>
            )}

            {(ultimaVolta.dados.planoImplementacao?.length ?? 0) > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Map size={14} strokeWidth={2} />
                  Plano de implementação (pré-produção → operação)
                </p>
                <ol className="list-decimal pl-5 text-sm">
                  {ultimaVolta.dados.planoImplementacao!.map((passo, i) => (
                    <li key={i}>{passo}</li>
                  ))}
                </ol>
                <p className="text-xs text-[color:var(--sm-text-dim)]">Ao aplicar, este roteiro fica salvo no projeto e sai na exportação.</p>
              </div>
            )}

            {ultimaVolta.papeisIlegiveis && ultimaVolta.papeisIlegiveis.length > 0 && (
              <div className="rounded border border-[color:var(--sm-atencao-border)] bg-[color:var(--sm-atencao-bg)] p-2">
                <p className="text-sm font-medium text-[color:var(--sm-atencao-text)]">Esta volta saiu incompleta</p>
                <p className="mt-1 text-xs text-[color:var(--sm-text-dim)]">
                  Não foi possível ler a resposta de: {ultimaVolta.papeisIlegiveis.map((e) => ETAPAS_ROTULO[e]).join(", ")}. Uma lista de problemas vazia aqui
                  não quer dizer que está tudo certo — quer dizer que essa avaliação se perdeu. Rode de novo, ou use um modelo maior. O motor de conformidade
                  continua sendo a palavra final.
                </p>
              </div>
            )}

            {ultimaVolta.problemasApontados.length > 0 && (
              <div>
                <p className="text-sm font-medium">O que o crítico apontou</p>
                <ul className="list-disc pl-4 text-sm text-[color:var(--sm-yellow)]">
                  {ultimaVolta.problemasApontados.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {ultimaVolta.sugestoes.length > 0 && (
              <div>
                <p className="text-sm font-medium">Sugestões</p>
                <ul className="list-disc pl-4 text-sm">
                  {ultimaVolta.sugestoes.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={aplicar}
                className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-4 py-2 text-sm hover:bg-[color:var(--sm-accent)]/30"
              >
                <Check size={14} strokeWidth={2} />
                Aplicar versão lapidada
              </button>
              <button onClick={pedirMotivoOuFechar} className="rounded border border-[color:var(--sm-border)] px-4 py-2 text-sm hover:border-[color:var(--sm-red)]">
                Descartar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
