import type { Project } from "../lib/types";
import { PORTE_POR_ABRANGENCIA, CONSELHO_POR_ABRANGENCIA } from "../lib/types";
import { avaliarConformidade } from "../lib/compliance-engine";
import { simularTodos, exigenciaPOS, calcularDepreciacaoMensal } from "../lib/simulator";
import { montarChecklistFinal } from "../lib/checklist";
import { Badge } from "../components/Badge";
import { FluxoCaixaChart } from "../components/cronograma/FluxoCaixaChart";
import { CronogramaGantt } from "../components/cronograma/CronogramaGantt";
import { exportarEstatutoAssociacaoDocx, exportarAtaFundacaoDocx, exportarRegimentoSimplesDocx } from "../lib/formalizacao";
import { mesAtualDoProjeto, orientacaoDoMes } from "../lib/acompanhamento";
import danos from "../data/danos.json";
import setores from "../data/setores.json";
import arquetipos from "../data/arquetipos.json";

/**
 * Visão de leitura do projeto inteiro, na mesma ordem da exportação .docx —
 * permite revisar tudo sem exportar e serve de base para o futuro PDF real.
 */
export function ProjectDocumento({
  project,
  onFechar,
  onIrParaPasso,
  onAtualizar,
}: {
  project: Project;
  onFechar: () => void;
  onIrParaPasso: (passoId: string) => void;
  onAtualizar?: (p: Project) => void;
}) {
  const dano = danos.find((d) => d.id === project.danoId);
  const arquetipo = arquetipos.find((a) => a.id === project.arquetipoId);
  const setor = setores.find((s) => s.id === project.setorId);
  const porte = PORTE_POR_ABRANGENCIA[project.abrangencia];
  const teto = project.tetoPorte[porte];
  const totalOrcamento = project.orcamento.reduce((s, l) => s + l.valor, 0);
  const conformidade = avaliarConformidade(project);
  const simulacoes = simularTodos(project);
  const checklist = montarChecklistFinal(project, null);
  const depreciacaoMensal = calcularDepreciacaoMensal(project);
  const espaco = project.espacoLogistica;
  const mesAtual = mesAtualDoProjeto(project);
  const atividadesDoMes = mesAtual != null ? orientacaoDoMes(project, mesAtual) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <button onClick={onFechar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
          ← Voltar ao wizard
        </button>
        <h1 className="text-lg font-semibold">
          📄 Documento completo{(project.versaoLapidacao ?? 0) > 0 && <span className="ml-2 text-sm text-[color:var(--sm-text-dim)]">v{project.versaoLapidacao}</span>}
        </h1>
      </div>

      {onAtualizar && (
        <div className="rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/5 p-3 text-sm">
          {project.dataInicioReal ? (
            <>
              📅 <strong>Mês {mesAtual} de implantação</strong>
              {atividadesDoMes.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-xs text-[color:var(--sm-text-dim)]">
                  {atividadesDoMes.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-[color:var(--sm-text-dim)]">Sem cronograma mensal ainda para este mês — rode a lapidação para detalhar.</p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[color:var(--sm-text-dim)]">Marque quando o projeto sair do papel de verdade para receber orientação mês a mês aqui.</p>
              <button
                onClick={() => onAtualizar({ ...project, dataInicioReal: new Date().toISOString() })}
                className="shrink-0 rounded border border-[color:var(--sm-accent)] px-3 py-1.5 text-xs hover:bg-[color:var(--sm-accent)]/20"
              >
                ▶ Marcar como iniciado hoje
              </button>
            </div>
          )}
        </div>
      )}

      <Bloco titulo="Identificação" onEditar={() => onIrParaPasso("identificacao")}>
        <p className="text-lg font-medium">{project.titulo || "(sem título)"}</p>
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          Local: {project.local || "-"} · Abrangência: {project.abrangencia} ({porte}) · Aprovação: {CONSELHO_POR_ABRANGENCIA[project.abrangencia]}
        </p>
        {(project.contato.coordenador || project.contato.telefone || project.contato.email || project.contato.endereco) && (
          <p className="text-sm text-[color:var(--sm-text-dim)]">
            {project.contato.coordenador && `Coordenação: ${project.contato.coordenador}. `}
            {project.contato.telefone && `Tel.: ${project.contato.telefone}. `}
            {project.contato.email && `E-mail: ${project.contato.email}. `}
            {project.contato.endereco && `Endereço: ${project.contato.endereco}.`}
          </p>
        )}
      </Bloco>

      <Bloco titulo="Dano e tipo de projeto" onEditar={() => onIrParaPasso("dano-arquetipo")}>
        <p className="text-sm">
          <strong>Dano:</strong> {dano?.nome ?? "não selecionado"}
        </p>
        <p className="text-sm">
          <strong>Arquétipo:</strong> {arquetipo ? `${arquetipo.nome} (${arquetipo.tipo})` : "não selecionado"}
        </p>
      </Bloco>

      <Bloco titulo="Objetivo, justificativa e metas" onEditar={() => onIrParaPasso("objetivo")}>
        <p className="text-sm">
          <strong>Objetivo:</strong> {project.objetivo || "-"}
        </p>
        <p className="text-sm">
          <strong>Justificativa:</strong> {project.justificativa || "-"}
        </p>
        {project.metas.length > 0 && (
          <div>
            <p className="text-sm font-medium">Metas / indicadores</p>
            <ul className="list-disc pl-5 text-sm">
              {project.metas.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {project.comoComunidadeAjuda && (
          <p className="text-sm">
            <strong>Como a comunidade ajuda:</strong> {project.comoComunidadeAjuda}
          </p>
        )}
        {project.missaoImpacto && (
          <p className="text-sm">
            <strong>Missão/impacto:</strong> {project.missaoImpacto}
          </p>
        )}
      </Bloco>

      <Bloco titulo="Público" onEditar={() => onIrParaPasso("publico")}>
        <p className="text-sm">
          Setor: {setor?.nome ?? project.setorId} {setor?.cota && "(cota mín. 30%)"}
          {project.coordenacaoFeminina && " · Coordenado por mulher(es)"}
        </p>
      </Bloco>

      <Bloco titulo="Orçamento" onEditar={() => onIrParaPasso("orcamento")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[color:var(--sm-text-dim)]">
              <th className="pb-1">Categoria</th>
              <th className="pb-1">Descrição</th>
              <th className="pb-1 text-right">Valor</th>
              <th className="pb-1 text-right">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {project.orcamento.map((l) => (
              <tr key={l.id} className="border-t border-[color:var(--sm-border)]">
                <td className="py-1">{l.categoria}</td>
                <td className="py-1">{l.descricao}</td>
                <td className="py-1 text-right">R$ {l.valor.toFixed(2)}</td>
                <td className="py-1 text-right">{l.prazoMeses ? `${l.prazoMeses}m` : "-"}</td>
              </tr>
            ))}
            {project.orcamento.length === 0 && (
              <tr>
                <td colSpan={4} className="py-1 text-[color:var(--sm-text-dim)]">
                  Nenhuma linha de orçamento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="pt-2 text-sm">
          Total: <strong>R$ {totalOrcamento.toFixed(2)}</strong> · Teto do porte ({porte}): R$ {teto.toFixed(2)}
          {totalOrcamento > teto && <span className="ml-2 text-[color:var(--sm-red)]">acima do teto configurado</span>}
          {totalOrcamento < 100_000 && <span className="ml-2 text-[color:var(--sm-yellow)]">abaixo do porte mínimo de R$ 100.000,00 (diretriz)</span>}
        </p>
      </Bloco>

      <Bloco titulo="Equipe e cronograma" onEditar={() => onIrParaPasso("equipe")}>
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Equipe
            {project.equipe.filter((m) => m.nome.trim()).length < 2 && (
              <span className="ml-2 text-[color:var(--sm-yellow)]">menos de 2 pessoas — diretriz pede ao menos 2 por 6 meses</span>
            )}
          </p>
          {project.equipe.length > 0 ? (
            <ul className="space-y-1">
              {project.equipe.map((m) => (
                <li key={m.id} className="rounded border border-[color:var(--sm-border)] p-2 text-sm">
                  <p className="font-medium">{m.nome || "(sem nome/papel)"}</p>
                  <p className="text-xs text-[color:var(--sm-text-dim)]">
                    {m.formacaoNecessaria && `Formação: ${m.formacaoNecessaria}. `}
                    {m.horasSemanais ? `${m.horasSemanais}h/semana` : ""}
                    {m.duracaoMeses ? ` por ${m.duracaoMeses} meses.` : ""}
                  </p>
                  {m.planoTrabalho && <p className="text-xs">{m.planoTrabalho}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[color:var(--sm-text-dim)]">-</p>
          )}
        </div>
        <p className="pt-2 text-sm">
          <strong>Cronograma:</strong> {project.cronograma || "-"}
        </p>
        {(project.cronogramaMensal?.length ?? 0) > 0 ? (
          <div className="pt-1">
            <p className="text-sm font-medium">Detalhamento mês a mês</p>
            <ul className="space-y-1 text-sm">
              {project.cronogramaMensal!.map((c) => (
                <li key={c.mes}>
                  <strong>Mês {c.mes}:</strong> {c.atividades.join("; ")}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="pt-1 text-xs text-[color:var(--sm-text-dim)]">Detalhamento mês a mês não gerado ainda — rode a lapidação.</p>
        )}
      </Bloco>

      {(espaco?.areaM2 || espaco?.tipoEspaco || espaco?.acesso || espaco?.distanciaFornecedoresKm || espaco?.observacoes) && (
        <Bloco titulo="Espaço e logística" onEditar={() => onIrParaPasso("espaco-logistica")}>
          <p className="text-sm">
            {espaco?.areaM2 ? `Área necessária: ${espaco.areaM2} m². ` : ""}
            {espaco?.tipoEspaco ? `Tipo: ${espaco.tipoEspaco}. ` : ""}
            {espaco?.acesso ? `Acesso: ${espaco.acesso}. ` : ""}
            {espaco?.distanciaFornecedoresKm ? `Distância estimada a fornecedores/parceiros: ${espaco.distanciaFornecedoresKm} km.` : ""}
          </p>
          {espaco?.observacoes && <p className="text-sm text-[color:var(--sm-text-dim)]">{espaco.observacoes}</p>}
        </Bloco>
      )}

      {(project.planoImplementacao?.length ?? 0) > 0 && (
        <Bloco titulo="🗺 Plano de implementação (pré-produção → operação)">
          <ol className="list-decimal pl-5 text-sm">
            {project.planoImplementacao!.map((passo, i) => (
              <li key={i}>{passo}</li>
            ))}
          </ol>
        </Bloco>
      )}

      <Bloco titulo="📜 Documentos de formalização (associação/cooperativa)">
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          Minutas parametrizadas com os dados deste projeto — exigem revisão por advogado(a)/contador(a) antes de assinatura ou registro em cartório.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => exportarEstatutoAssociacaoDocx(project)}
            className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-accent)]"
          >
            Estatuto de associação (.docx)
          </button>
          <button
            onClick={() => exportarAtaFundacaoDocx(project)}
            className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-accent)]"
          >
            Ata de assembleia de fundação (.docx)
          </button>
          <button
            onClick={() => exportarRegimentoSimplesDocx(project)}
            className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-accent)]"
          >
            Regimento simples (.docx)
          </button>
        </div>
      </Bloco>

      <Bloco titulo="Arrecadação e custos não cobertos" onEditar={() => onIrParaPasso("arrecadacao")}>
        <p className="text-sm">
          <strong>Formas de arrecadação:</strong> {project.formasArrecadacao.length > 0 ? project.formasArrecadacao.join("; ") : "-"}
        </p>
        {project.custosNaoCobertos.length > 0 && (
          <div>
            <p className="text-sm font-medium">Custos não cobertos pelo Anexo</p>
            <ul className="list-disc pl-5 text-sm">
              {project.custosNaoCobertos.map((c) => (
                <li key={c.id}>
                  {c.nome}: R$ {c.valorMensalEstimado.toFixed(2)}/mês {c.fonteCusteioFuturo ? `— fonte futura: ${c.fonteCusteioFuturo}` : "(sem fonte futura indicada)"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Simulação / POS" onEditar={() => onIrParaPasso("simulador")}>
        <div className="space-y-1">
          {simulacoes.map((s) => (
            <p key={s.cenario} className="text-sm capitalize">
              {s.cenario}: saldo R$ {s.saldoMensal.toFixed(2)}/mês {s.autossustentavel ? "🟢" : "🔴"}
            </p>
          ))}
        </div>
        <p className="text-sm text-[color:var(--sm-text-dim)]">Exigência de POS para este porte: {exigenciaPOS(project)}</p>
        {depreciacaoMensal > 0 && (
          <p className="text-sm">
            Depreciação de equipamentos: R$ {depreciacaoMensal.toFixed(2)}/mês — fonte de reposição: {project.fonteReposicaoEquipamentos || "não indicada"}
          </p>
        )}
        {exigenciaPOS(project) === "completo" && (
          <div className="space-y-1 text-sm">
            <p>Responsável pela operação: {project.posCompleto.responsavelOperacao ?? "-"}</p>
            <p>Fonte de custeio futuro geral: {project.posCompleto.fonteCusteioFuturoGeral ?? "-"}</p>
            <p>Metodologia de transição: {project.posCompleto.metodologiaTransicao ?? "-"}</p>
            <p>Indicadores de autonomia: {project.posCompleto.indicadoresAutonomia ?? "-"}</p>
          </div>
        )}

        <div className="space-y-1 pt-2">
          <p className="text-sm font-medium">📅 Cronograma de implantação (por categoria de orçamento)</p>
          <CronogramaGantt project={project} />
        </div>

        <div className="space-y-1 pt-2">
          <p className="text-sm font-medium">📊 Fluxo de caixa estimado (12 meses)</p>
          <FluxoCaixaChart project={project} />
        </div>
      </Bloco>

      <Bloco titulo="Matriz de risco" onEditar={() => onIrParaPasso("riscos")}>
        {project.riscos.length > 0 ? (
          <ul className="list-disc pl-5 text-sm">
            {project.riscos.map((r) => (
              <li key={r.id}>
                {r.descricao} — probabilidade {r.probabilidade}, impacto {r.impacto}. Mitigação: {r.mitigacao || "-"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[color:var(--sm-text-dim)]">-</p>
        )}
      </Bloco>

      {(project.observacoesEcossistema?.length ?? 0) > 0 && (
        <Bloco titulo="Observações do ecossistema">
          <ul className="list-disc pl-5 text-sm">
            {project.observacoesEcossistema!.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </Bloco>
      )}

      <Bloco titulo="Checagem de conformidade">
        <div className="space-y-2">
          {conformidade.map((f, i) => (
            <div key={i} className="flex items-start gap-2 rounded border border-[color:var(--sm-border)] p-2 text-sm">
              <Badge severidade={f.severidade} />
              <div>
                <p className="font-medium">{f.regra}</p>
                <p className="text-[color:var(--sm-text-dim)]">{f.mensagem}</p>
              </div>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Checklist final" onEditar={() => onIrParaPasso("revisao")}>
        <div>
          <p className="text-sm font-medium">Próximos passos</p>
          <ul className="list-disc pl-5 text-sm">
            {checklist.proximosPassos.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
        {checklist.pendencias.length > 0 && (
          <div>
            <p className="text-sm font-medium">Pendências</p>
            <ul className="list-disc pl-5 text-sm text-[color:var(--sm-yellow)]">
              {checklist.pendencias.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </Bloco>
    </div>
  );
}

function Bloco({ titulo, onEditar, children }: { titulo: string; onEditar?: () => void; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded border border-[color:var(--sm-border)] p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[color:var(--sm-accent)]">{titulo}</h2>
        {onEditar && (
          <button onClick={onEditar} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-accent)]">
            ✎ editar
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
