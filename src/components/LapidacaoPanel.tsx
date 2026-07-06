import { useEffect, useRef, useState } from "react";
import type { Project } from "../lib/types";
import {
  lapidarProjeto,
  registrarLapidacao,
  commitarVersaoLapidada,
  ETAPAS_ROTULO,
  type EtapaLapidacao,
  type ResultadoLapidacao,
} from "../lib/refinement-loop";
import { carregarConfigComparacao, nomeProvedor, configuracaoLLMPronta } from "../lib/providers";
import { Badge } from "./Badge";

const ETAPAS_ORDEM: EtapaLapidacao[] = ["escritor", "orcamentista", "critico", "riscos", "sugestor", "compilador"];
const ETAPAS_ICONE: Record<EtapaLapidacao, string> = {
  escritor: "✍",
  orcamentista: "💰",
  critico: "🔎",
  riscos: "⚠️",
  sugestor: "💡",
  compilador: "🧩",
};

/** Barra de estágio ao vivo, no espírito do indicador de streaming do Hermes/Claude Code — mostra qual agente está rodando agora e permite parar a qualquer momento. */
function BarraDeEstagio({ volta, totalVoltas, etapaAtual, segundos, onParar }: { volta: number; totalVoltas: number; etapaAtual: EtapaLapidacao | null; segundos: number; onParar: () => void }) {
  const indiceAtual = etapaAtual ? ETAPAS_ORDEM.indexOf(etapaAtual) : -1;
  return (
    <div className="space-y-2 rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/5 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Volta {volta}/{totalVoltas} {etapaAtual && `— ${ETAPAS_ICONE[etapaAtual]} ${ETAPAS_ROTULO[etapaAtual]}`}
        </p>
        <button
          onClick={onParar}
          title="Parar a lapidação agora"
          className="flex items-center gap-1 rounded border border-[color:var(--sm-red)] bg-[color:var(--sm-red)]/10 px-2 py-1 text-xs font-medium text-[color:var(--sm-red)] hover:bg-[color:var(--sm-red)]/20"
        >
          ⏹ Parar
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
  const [rodando, setRodando] = useState(false);
  const [volta, setVolta] = useState(1);
  const [etapaAtual, setEtapaAtual] = useState<EtapaLapidacao | null>(null);
  const [resultado, setResultado] = useState<ResultadoLapidacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [inicioEm, setInicioEm] = useState<number | null>(null);
  const [segundosDecorridos, setSegundosDecorridos] = useState(0);
  const [duracaoSeg, setDuracaoSeg] = useState<number | null>(null);
  const canceladoRef = useRef(false);
  const [perguntandoMotivo, setPerguntandoMotivo] = useState(false);
  const [motivoDescarte, setMotivoDescarte] = useState("");

  const configComparacao = carregarConfigComparacao();
  const comparacaoPronta = configComparacao ? configuracaoLLMPronta(configComparacao).pronta : false;
  const [comparar, setComparar] = useState(false);

  // Timer ao vivo enquanto roda — mesmo espírito do indicador de streaming do Hermes/Claude Code.
  useEffect(() => {
    if (!rodando || !inicioEm) return;
    const id = window.setInterval(() => setSegundosDecorridos(Math.round((Date.now() - inicioEm) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [rodando, inicioEm]);

  async function rodar() {
    canceladoRef.current = false;
    setRodando(true);
    setErro(null);
    setResultado(null);
    setDuracaoSeg(null);
    setEtapaAtual(null);
    setVolta(1);
    setSegundosDecorridos(0);
    const inicio = Date.now();
    setInicioEm(inicio);

    const r = await lapidarProjeto(project, {
      voltas,
      onProgresso: (v: number, etapa: EtapaLapidacao) => {
        setVolta(v);
        setEtapaAtual(etapa);
      },
      cancelado: () => canceladoRef.current,
      compararConfig: comparar && comparacaoPronta && configComparacao ? configComparacao : undefined,
      onProgressoComparacao: (v: number) => setVolta(v),
    });

    setRodando(false);
    setEtapaAtual(null);
    setDuracaoSeg(Math.round((Date.now() - inicio) / 1000));

    if (!r.ok) {
      setErro(r.erro ?? "Falha na lapidação.");
      if (r.voltas.length === 0) return;
    }
    setResultado(r);
  }

  function parar() {
    canceladoRef.current = true;
  }

  function aplicar() {
    if (!resultado?.projetoFinal) return;
    registrarLapidacao(true, resultado);
    const ultimaVolta = resultado.voltas[resultado.voltas.length - 1];
    onAplicar(commitarVersaoLapidada(project, resultado.projetoFinal, ultimaVolta?.changelog ?? []));
    onClose();
  }

  function aplicarComparacao() {
    const comp = resultado?.voltas[resultado.voltas.length - 1]?.comparacao;
    if (!comp || !resultado) return;
    registrarLapidacao(true, resultado);
    onAplicar(commitarVersaoLapidada(project, comp.projetoResultante, comp.changelog));
    onClose();
  }

  function pedirMotivoOuFechar() {
    if (resultado) setPerguntandoMotivo(true);
    else onClose();
  }

  function confirmarDescarte(motivo?: string) {
    if (resultado) registrarLapidacao(false, resultado, motivo);
    onClose();
  }

  const ultimaVolta = resultado?.voltas[resultado.voltas.length - 1];
  const scoreInicial = resultado?.voltas[0]?.scoreAntes;
  const scoreFinal = ultimaVolta?.scoreDepois;
  const introduziuBloqueio = resultado?.voltas.some((v) => v.introduziuBloqueio) ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="max-h-[85vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">🔁 Ciclo de Lapidação</h2>
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
                <p className="font-medium">Antes → Depois (medido pelo motor de conformidade)</p>
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
                O ciclo convergiu: a última volta não resolveu item novo (medido pelo motor de conformidade) ou o compilador avaliou que não há mais ganho a extrair — paramos antes de gastar mais chamadas de IA.
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
                        <p>⚖️ <strong>Jurídico-fundiário:</strong> {v.consideracoes.juridica.join(" ")}</p>
                      )}
                      {v.consideracoes.sociologica.length > 0 && (
                        <p>👥 <strong>Sociológico:</strong> {v.consideracoes.sociologica.join(" ")}</p>
                      )}
                      {v.consideracoes.psicologica.length > 0 && (
                        <p>🧠 <strong>Psicológico:</strong> {v.consideracoes.psicologica.join(" ")}</p>
                      )}
                    </div>
                  )}
                  {v.introduziuBloqueio && <p className="text-xs text-[color:var(--sm-red)]">⚠ Esta versão introduziu um bloqueio novo.</p>}
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
                          <li className="text-[color:var(--sm-text-dim)]">Sem changelog descrito.</li>
                        )}
                      </ul>
                      {i === resultado.voltas.length - 1 && (
                        <button
                          onClick={aplicarComparacao}
                          className="mt-1 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1 text-xs hover:bg-[color:var(--sm-accent)]/25"
                        >
                          ✔ Aplicar esta versão ({v.comparacao.providerNome}) em vez da principal
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
                <p className="text-sm font-medium">🗺 Plano de implementação (pré-produção → operação)</p>
                <ol className="list-decimal pl-5 text-sm">
                  {ultimaVolta.dados.planoImplementacao!.map((passo, i) => (
                    <li key={i}>{passo}</li>
                  ))}
                </ol>
                <p className="text-xs text-[color:var(--sm-text-dim)]">Ao aplicar, este roteiro fica salvo no projeto e sai na exportação.</p>
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
              <button onClick={aplicar} className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-4 py-2 text-sm hover:bg-[color:var(--sm-accent)]/30">
                ✔ Aplicar versão lapidada
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
