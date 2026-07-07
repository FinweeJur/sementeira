import { useEffect, useMemo, useRef, useState } from "react";
import type { BudgetLine, CategoriaLinha, Cenario, CustoNaoCobertoItem, EquipeMembro, EspacoLogistica, Indicador, PropostaFornecedor, Project, RiskItem } from "../lib/types";
import { PORTE_POR_ABRANGENCIA, CONSELHO_POR_ABRANGENCIA } from "../lib/types";
import { avaliarConformidade } from "../lib/compliance-engine";
import { simularTodos, exigenciaPOS, calcularDepreciacaoMensal } from "../lib/simulator";
import { exportarProjetoDocx, exportarProjetoXlsx, exportarProjetoPdf } from "../lib/export";
import { exportarSolicitacaoCotacaoDocx, sugerirFornecedoresRede } from "../lib/cotacao";
import { derivarConexoes } from "../lib/mapa-estagios";
import { MUNICIPIOS_PARAOPEBA, estimarDistanciaRota, custoLogisticoMensalEstimado, type EstimativaRota } from "../lib/geografia";
import { sugerirDeIdeia, derivarTituloDeIdeia } from "../lib/suggestion-engine";
import { aplicarRascunhoAoProjeto, type RascunhoDados } from "../lib/draft-generation";
import { pesquisarJustificativaComReferencia, pesquisarPrecoItem, pesquisarArrecadacaoSugestoes } from "../lib/geracao-assistida";
import { revisarProjetoComOficios, type RevisaoResultado } from "../lib/revisao-agente";
import { montarChecklistFinal } from "../lib/checklist";
import { Section } from "../components/Section";
import { Field, inputClass } from "../components/Field";
import { Badge } from "../components/Badge";
import { Stepper, type PassoInfo } from "../components/Stepper";
import { CopilotoChat } from "../components/CopilotoChat";
import { LapidacaoPanel } from "../components/LapidacaoPanel";
import { ProjectDocumento } from "./ProjectDocumento";
import danos from "../data/danos.json";
import setores from "../data/setores.json";
import arquetipos from "../data/arquetipos.json";
import custosCatalogo from "../data/custos-nao-cobertos.json";

const CATEGORIAS: CategoriaLinha[] = [
  "infraestrutura",
  "equipamento",
  "regularizacao",
  "capacitacao",
  "capital-giro-inicial",
  "insumos-iniciais",
  "equipe-implantacao",
  "operacao-assistida",
  "folha-permanente",
  "outro",
];

const CATEGORIAS_COM_PRAZO_6M = ["capital-giro-inicial", "insumos-iniciais", "equipe-implantacao", "operacao-assistida"];

const CUSTO_POR_KM_PADRAO = 2.5;
const FREQ_VIAGENS_MES_PADRAO = 4;

export function ProjectWizard({
  project,
  outrosProjetos = [],
  onChange,
  onVoltar,
}: {
  project: Project;
  outrosProjetos?: Project[];
  onChange: (p: Project) => void;
  onVoltar: () => void;
}) {
  const [novaMeta, setNovaMeta] = useState("");
  const [novaForma, setNovaForma] = useState("");
  const [sugestaoAplicada, setSugestaoAplicada] = useState(false);
  const [passoAtual, setPassoAtual] = useState(0);
  const [salvoAgora, setSalvoAgora] = useState(false);
  const [copilotoAberto, setCopilotoAberto] = useState(false);
  const [lapidacaoAberta, setLapidacaoAberta] = useState(false);
  const [verDocumento, setVerDocumento] = useState(false);
  const [autoGerarRascunho, setAutoGerarRascunho] = useState(false);
  const [pesquisandoJustificativa, setPesquisandoJustificativa] = useState(false);
  const [erroJustificativa, setErroJustificativa] = useState<string | null>(null);
  const [subperguntasJustificativa, setSubperguntasJustificativa] = useState<string[] | null>(null);
  const [pesquisandoPrecoId, setPesquisandoPrecoId] = useState<string | null>(null);
  const [erroPreco, setErroPreco] = useState<string | null>(null);
  const [subperguntasPreco, setSubperguntasPreco] = useState<string[] | null>(null);
  const [pesquisandoArrecadacao, setPesquisandoArrecadacao] = useState(false);
  const [erroArrecadacao, setErroArrecadacao] = useState<string | null>(null);
  const [subperguntasArrecadacao, setSubperguntasArrecadacao] = useState<string[] | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [erroRevisao, setErroRevisao] = useState<string | null>(null);
  const [revisao, setRevisao] = useState<RevisaoResultado | null>(null);
  const [rotasCalculando, setRotasCalculando] = useState(false);
  const [rotasPorProjeto, setRotasPorProjeto] = useState<Map<string, EstimativaRota>>(new Map());
  const headingRef = useRef<HTMLHeadingElement>(null);

  const arquetipo = arquetipos.find((a) => a.id === project.arquetipoId);
  const sugestao = useMemo(() => sugerirDeIdeia(project.ideiaTexto), [project.ideiaTexto]);
  const danoSugerido = sugestao.danoId ? danos.find((d) => d.id === sugestao.danoId) : undefined;
  const arquetipoSugerido = sugestao.arquetipoId ? arquetipos.find((a) => a.id === sugestao.arquetipoId) : undefined;
  const conformidade = useMemo(() => avaliarConformidade(project), [project]);
  const simulacoes = useMemo(() => simularTodos(project), [project]);
  const checklist = useMemo(() => montarChecklistFinal(project, revisao), [project, revisao]);
  const totalOrcamento = project.orcamento.reduce((s, l) => s + l.valor, 0);
  const depreciacaoMensal = calcularDepreciacaoMensal(project);
  const porte = PORTE_POR_ABRANGENCIA[project.abrangencia];
  const teto = project.tetoPorte[porte];

  const bloqueios = conformidade.filter((f) => f.severidade === "bloqueio").length;
  // Celebração do momento aha: quando os bloqueios zeram (vindo de >0), o broto "floresce" uma vez.
  const bloqueiosAnteriores = useRef(bloqueios);
  const [florescendo, setFlorescendo] = useState(false);
  useEffect(() => {
    if (bloqueiosAnteriores.current > 0 && bloqueios === 0) {
      setFlorescendo(true);
      const timer = window.setTimeout(() => setFlorescendo(false), 2500);
      return () => window.clearTimeout(timer);
    }
    bloqueiosAnteriores.current = bloqueios;
  }, [bloqueios]);
  const atencoes = conformidade.filter((f) => f.severidade === "atencao").length;
  const orcamentoTemBloqueio = conformidade.some((f) => f.severidade === "bloqueio" && f.linhaId);
  const danoTemBloqueio = conformidade.some((f) => f.severidade === "bloqueio" && f.regra.includes("Meta #1"));

  function update<K extends keyof Project>(key: K, value: Project[K]) {
    onChange({ ...project, [key]: value });
    setSalvoAgora(true);
    window.setTimeout(() => setSalvoAgora(false), 1200);
  }

  /** Segue a ideia e atualiza o título automaticamente — só até a pessoa editar o título na mão pela primeira vez. */
  function handleIdeiaChange(texto: string) {
    const patch: Partial<Project> = { ideiaTexto: texto };
    if (!project.tituloEditadoManualmente) {
      patch.titulo = derivarTituloDeIdeia(texto);
    }
    onChange({ ...project, ...patch });
    setSalvoAgora(true);
    window.setTimeout(() => setSalvoAgora(false), 1200);
    setSugestaoAplicada(false);
  }

  function handleTituloChange(texto: string) {
    onChange({ ...project, titulo: texto, tituloEditadoManualmente: true });
    setSalvoAgora(true);
    window.setTimeout(() => setSalvoAgora(false), 1200);
  }

  function addLinha() {
    const linha: BudgetLine = { id: crypto.randomUUID(), categoria: "outro", descricao: "", valor: 0 };
    update("orcamento", [...project.orcamento, linha]);
  }
  function updateLinha(id: string, patch: Partial<BudgetLine>) {
    update("orcamento", project.orcamento.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function removeLinha(id: string) {
    update("orcamento", project.orcamento.filter((l) => l.id !== id));
  }

  function addMembro() {
    const m: EquipeMembro = { id: crypto.randomUUID(), nome: "" };
    update("equipe", [...project.equipe, m]);
  }
  function updateMembro(id: string, patch: Partial<EquipeMembro>) {
    update("equipe", project.equipe.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function removeMembro(id: string) {
    update("equipe", project.equipe.filter((m) => m.id !== id));
  }

  function preencherOrcamentoSugerido() {
    if (!arquetipo) return;
    const novasLinhas: BudgetLine[] = arquetipo.linhasOrcamentoSugeridas.map((sugestaoLinha) => ({
      id: crypto.randomUUID(),
      categoria: sugestaoLinha.categoria as CategoriaLinha,
      descricao: sugestaoLinha.descricao,
      valor: 0,
      prazoMeses: (sugestaoLinha as { prazoMaximoMeses?: number }).prazoMaximoMeses,
    }));
    update("orcamento", [...project.orcamento, ...novasLinhas]);
  }
  function aplicarSugestao() {
    const patch: Partial<Project> = {};
    if (sugestao.danoId) patch.danoId = sugestao.danoId;
    if (sugestao.arquetipoId) patch.arquetipoId = sugestao.arquetipoId;
    onChange({ ...project, ...patch });
    setSugestaoAplicada(true);
  }
  function handleAplicarRascunho(dados: RascunhoDados) {
    onChange(aplicarRascunhoAoProjeto(project, dados));
  }
  function abrirCopilotoEGerarRascunho() {
    setCopilotoAberto(true);
    setAutoGerarRascunho(true);
  }

  async function pesquisarJustificativa() {
    setPesquisandoJustificativa(true);
    setErroJustificativa(null);
    setSubperguntasJustificativa(null);
    const resultado = await pesquisarJustificativaComReferencia(project);
    setPesquisandoJustificativa(false);
    setSubperguntasJustificativa(resultado.subperguntas ?? null);
    if (!resultado.ok || !resultado.dado) {
      setErroJustificativa(resultado.erro ?? "Não foi possível pesquisar.");
      return;
    }
    update("justificativa", resultado.dado);
  }

  async function pesquisarPrecoLinha(linha: BudgetLine) {
    if (!linha.descricao.trim()) {
      setErroPreco("Preencha a descrição do item antes de pesquisar o preço.");
      return;
    }
    setPesquisandoPrecoId(linha.id);
    setErroPreco(null);
    setSubperguntasPreco(null);
    const resultado = await pesquisarPrecoItem(linha.descricao);
    setPesquisandoPrecoId(null);
    setSubperguntasPreco(resultado.subperguntas ?? null);
    if (!resultado.ok || resultado.dado?.valorEstimado == null) {
      setErroPreco(resultado.erro ?? "Não foi possível pesquisar o preço desse item.");
      return;
    }
    updateLinha(linha.id, { valor: resultado.dado.valorEstimado });
  }

  function gerarCotacao(linha: BudgetLine) {
    const fornecedoresRede = sugerirFornecedoresRede(outrosProjetos, project);
    exportarSolicitacaoCotacaoDocx(project, linha, fornecedoresRede);
  }

  function adicionarProposta(linhaId: string) {
    const nova: PropostaFornecedor = { id: crypto.randomUUID(), fornecedor: "", valor: 0 };
    updateLinha(linhaId, { propostas: [...(project.orcamento.find((l) => l.id === linhaId)?.propostas ?? []), nova] });
  }
  function updateProposta(linhaId: string, propostaId: string, patch: Partial<PropostaFornecedor>) {
    const linha = project.orcamento.find((l) => l.id === linhaId);
    if (!linha) return;
    updateLinha(linhaId, { propostas: (linha.propostas ?? []).map((pr) => (pr.id === propostaId ? { ...pr, ...patch } : pr)) });
  }
  function removerProposta(linhaId: string, propostaId: string) {
    const linha = project.orcamento.find((l) => l.id === linhaId);
    if (!linha) return;
    updateLinha(linhaId, { propostas: (linha.propostas ?? []).filter((pr) => pr.id !== propostaId) });
  }
  function usarProposta(linhaId: string, proposta: PropostaFornecedor) {
    updateLinha(linhaId, { valor: proposta.valor });
  }

  async function pesquisarArrecadacao() {
    setPesquisandoArrecadacao(true);
    setErroArrecadacao(null);
    setSubperguntasArrecadacao(null);
    const resultado = await pesquisarArrecadacaoSugestoes(project);
    setPesquisandoArrecadacao(false);
    setSubperguntasArrecadacao(resultado.subperguntas ?? null);
    if (!resultado.ok || !resultado.dado) {
      setErroArrecadacao(resultado.erro ?? "Não foi possível pesquisar.");
      return;
    }
    update("formasArrecadacao", [...project.formasArrecadacao, ...resultado.dado]);
  }

  async function executarRevisao() {
    setRevisando(true);
    setErroRevisao(null);
    const resultado = await revisarProjetoComOficios(project);
    setRevisando(false);
    if (!resultado.ok || !resultado.dado) {
      setErroRevisao(resultado.erro ?? "Não foi possível revisar o projeto.");
      return;
    }
    setRevisao(resultado.dado);
  }

  function aplicarMudancasDaRevisao() {
    if (!revisao) return;
    onChange(aplicarRascunhoAoProjeto(project, revisao.mudancasSugeridas));
    setRevisao(null);
  }

  function adicionarIndicador() {
    const novo: Indicador = { id: crypto.randomUUID(), nome: "", meta: "" };
    update("indicadores", [...(project.indicadores ?? []), novo]);
  }
  function updateIndicador(id: string, patch: Partial<Indicador>) {
    update("indicadores", (project.indicadores ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function removerIndicador(id: string) {
    update("indicadores", (project.indicadores ?? []).filter((i) => i.id !== id));
  }

  function updateEspacoLogistica(patch: Partial<EspacoLogistica>) {
    update("espacoLogistica", { ...project.espacoLogistica, ...patch });
  }

  const parceirosLogistica = useMemo(() => {
    if (!project.municipioId) return [];
    const conexoes = derivarConexoes([project, ...outrosProjetos]);
    const idsConectados = new Set(conexoes.filter((c) => c.deId === project.id || c.paraId === project.id).map((c) => (c.deId === project.id ? c.paraId : c.deId)));
    return outrosProjetos.filter((p) => idsConectados.has(p.id) && p.municipioId);
  }, [project, outrosProjetos]);

  async function calcularRotasParceiros() {
    if (!project.municipioId || parceirosLogistica.length === 0) return;
    setRotasCalculando(true);
    const novasRotas = new Map(rotasPorProjeto);
    for (const parceiro of parceirosLogistica) {
      const rota = await estimarDistanciaRota(project.municipioId, parceiro.municipioId!);
      if (rota) novasRotas.set(parceiro.id, rota);
    }
    setRotasPorProjeto(novasRotas);
    setRotasCalculando(false);
  }

  function adicionarLinhaCustoLogistico(parceiro: Project, rota: EstimativaRota) {
    const custoMensal = custoLogisticoMensalEstimado(rota.km, FREQ_VIAGENS_MES_PADRAO, CUSTO_POR_KM_PADRAO);
    const linha: BudgetLine = {
      id: crypto.randomUUID(),
      categoria: "operacao-assistida",
      descricao: `Custo logístico estimado — transporte de/para "${parceiro.titulo || "(sem título)"}" (${rota.km.toFixed(0)} km ida, ${FREQ_VIAGENS_MES_PADRAO}x/mês, estimativa ${rota.fonte === "osrm" ? "de rota real (OSRM)" : "offline por linha reta × 1,4"})`,
      valor: custoMensal,
    };
    update("orcamento", [...project.orcamento, linha]);
  }

  function updateCenario(nome: Cenario["nome"], patch: Partial<Cenario>) {
    update("cenarios", project.cenarios.map((c) => (c.nome === nome ? { ...c, ...patch } : c)));
  }
  function toggleCustoNaoCoberto(item: { id: string; nome: string; referenciaPorPorte?: Record<string, number> }) {
    const existe = project.custosNaoCobertos.find((c) => c.id === item.id);
    if (existe) {
      update("custosNaoCobertos", project.custosNaoCobertos.filter((c) => c.id !== item.id));
    } else {
      const valorReferencia = item.referenciaPorPorte?.[porte] ?? 0;
      const novo: CustoNaoCobertoItem = { id: item.id, nome: item.nome, valorMensalEstimado: valorReferencia };
      update("custosNaoCobertos", [...project.custosNaoCobertos, novo]);
    }
  }
  function updateCustoNaoCoberto(id: string, patch: Partial<CustoNaoCobertoItem>) {
    update("custosNaoCobertos", project.custosNaoCobertos.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function adicionarRisco() {
    const novo: RiskItem = { id: crypto.randomUUID(), descricao: "", probabilidade: "medio", impacto: "medio", mitigacao: "" };
    update("riscos", [...project.riscos, novo]);
  }
  function updateRisco(id: string, patch: Partial<RiskItem>) {
    update("riscos", project.riscos.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removerRisco(id: string) {
    update("riscos", project.riscos.filter((r) => r.id !== id));
  }

  const passos: { info: PassoInfo; conteudo: React.ReactNode }[] = [
    {
      info: { id: "ideia", titulo: "Ideia" },
      conteudo: (
        <Section title="Jogue a ideia">
          <Field label="Descreva a ideia com suas palavras" hint="Ex.: 'quero montar uma padaria comunitária para gerar renda'.">
            <textarea
              className={inputClass}
              rows={2}
              value={project.ideiaTexto}
              onChange={(e) => handleIdeiaChange(e.target.value)}
            />
          </Field>
          {(danoSugerido || arquetipoSugerido) && !sugestaoAplicada && (
            <div className="flex items-center justify-between rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/10 p-2 text-sm">
              <p>
                Sugestão: {danoSugerido && <strong>{danoSugerido.nome}</strong>}
                {danoSugerido && arquetipoSugerido && " · "}
                {arquetipoSugerido && <strong>{arquetipoSugerido.nome}</strong>}
              </p>
              <button onClick={aplicarSugestao} className="shrink-0 rounded border border-[color:var(--sm-accent)] px-2 py-1 text-xs hover:bg-[color:var(--sm-accent)]/20">
                Aplicar sugestão
              </button>
            </div>
          )}
          <button
            onClick={abrirCopilotoEGerarRascunho}
            className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25"
          >
            🪄 Gerar proposta completa com IA
          </button>
          <p className="text-xs text-[color:var(--sm-text-dim)]">
            A IA propõe dano, arquétipo, objetivo, justificativa e metas a partir do título/ideia — sempre revisável nos próximos passos. Se faltar informação, ela pergunta antes.
          </p>
        </Section>
      ),
    },
    {
      info: { id: "dano-arquetipo", titulo: "Dano e tipo de projeto", temBloqueio: danoTemBloqueio },
      conteudo: (
        <>
          <Section title="Qual dano coletivo esse projeto ajuda a reparar?">
            <Field label="Dano vinculado" hint="Todo projeto parte de um dano — não de um título.">
              <select className={inputClass} value={project.danoId} onChange={(e) => update("danoId", e.target.value)}>
                <option value="">Selecione o dano...</option>
                {danos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </Field>
            {project.danoId && <p className="text-xs text-[color:var(--sm-text-dim)]">{danos.find((d) => d.id === project.danoId)?.descricao}</p>}
          </Section>
          <Section title="Que tipo de projeto resolve esse dano?">
            <Field label="Arquétipo">
              <select className={inputClass} value={project.arquetipoId} onChange={(e) => update("arquetipoId", e.target.value)}>
                <option value="">Selecione o arquétipo...</option>
                {arquetipos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} ({a.tipo})
                  </option>
                ))}
              </select>
            </Field>
            {arquetipo && (
              <div className="space-y-1 text-xs text-[color:var(--sm-text-dim)]">
                <p>Tipo: {arquetipo.tipoNome} ({arquetipo.tipo})</p>
                <p>Vedações-chave: {arquetipo.vedacoesChave.join("; ")}</p>
                <p>Sustentabilidade sugerida: {arquetipo.modeloSustentabilidadeSugerido}</p>
              </div>
            )}
          </Section>
        </>
      ),
    },
    {
      info: { id: "identificacao", titulo: "Identificação" },
      conteudo: (
        <Section title="Identificação do projeto">
          <Field label="Título" hint={project.tituloEditadoManualmente ? undefined : "Preenchido automaticamente a partir da ideia — edite para travar."}>
            <input className={inputClass} value={project.titulo} onChange={(e) => handleTituloChange(e.target.value)} />
          </Field>
          <Field label="Local">
            <input className={inputClass} value={project.local} onChange={(e) => update("local", e.target.value)} />
          </Field>
          <Field label="Abrangência territorial" hint="Isso decide quem aprova o projeto — não o valor em R$.">
            <select className={inputClass} value={project.abrangencia} onChange={(e) => update("abrangencia", e.target.value as Project["abrangencia"])}>
              <option value="local">Local (conjunto de comunidades)</option>
              <option value="regional">Regional (uma das 5 regiões)</option>
              <option value="inter-regional">Inter-regional (mais de uma região)</option>
            </select>
          </Field>
          <p className="text-xs text-[color:var(--sm-text-dim)]">
            Porte: <strong>{porte}</strong> · Aprovação: {CONSELHO_POR_ABRANGENCIA[project.abrangencia]} · Exigência de POS: <strong>{exigenciaPOS(project)}</strong>
          </p>
          <Field label={`Teto orçamentário do porte "${porte}" (editável)`}>
            <input
              type="number"
              className={inputClass}
              value={project.tetoPorte[porte]}
              onChange={(e) => update("tetoPorte", { ...project.tetoPorte, [porte]: Number(e.target.value) })}
            />
          </Field>
        </Section>
      ),
    },
    {
      info: { id: "objetivo", titulo: "Objetivo e metas" },
      conteudo: (
        <Section title="Objetivo, justificativa e metas">
          <Field label="Objetivo">
            <textarea className={inputClass} rows={2} value={project.objetivo} onChange={(e) => update("objetivo", e.target.value)} />
          </Field>
          <Field label="Justificativa" hint="Amarre ao dano selecionado no passo anterior.">
            <textarea className={inputClass} rows={2} value={project.justificativa} onChange={(e) => update("justificativa", e.target.value)} />
          </Field>
          <div className="space-y-1">
            <button
              onClick={pesquisarJustificativa}
              disabled={pesquisandoJustificativa}
              className="rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/10 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/20 disabled:opacity-40"
            >
              {pesquisandoJustificativa ? "Pesquisando dados públicos (várias buscas)..." : "🔎 Pesquisar dado público (IBGE/Censo) + referência ABNT"}
            </button>
            <p className="text-xs text-[color:var(--sm-text-dim)]">Exige internet e chave da Tavily configurada (Configurações). Substitui o texto acima — revise antes de seguir.</p>
            {subperguntasJustificativa && subperguntasJustificativa.length > 0 && (
              <p className="text-xs text-[color:var(--sm-text-dim)]">Pesquisado: {subperguntasJustificativa.join(" · ")}</p>
            )}
            {erroJustificativa && <p className="text-xs text-[color:var(--sm-red)]">{erroJustificativa}</p>}
          </div>
          <Field label="Metas / indicadores de resultado">
            <div className="flex gap-2">
              <input className={inputClass} value={novaMeta} onChange={(e) => setNovaMeta(e.target.value)} placeholder="Ex.: 20 famílias com renda complementar em 12 meses" />
              <button
                className="shrink-0 rounded border border-[color:var(--sm-border)] px-3 text-sm hover:border-[color:var(--sm-accent)]"
                onClick={() => {
                  if (!novaMeta.trim()) return;
                  update("metas", [...project.metas, novaMeta.trim()]);
                  setNovaMeta("");
                }}
              >
                Adicionar
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {project.metas.map((m, i) => (
                <li key={i} className="flex items-center justify-between rounded border border-[color:var(--sm-border)] px-2 py-1">
                  {m}
                  <button onClick={() => update("metas", project.metas.filter((_, idx) => idx !== i))} className="text-xs text-[color:var(--sm-red)]">
                    remover
                  </button>
                </li>
              ))}
            </ul>
          </Field>
          <Field
            label="Indicadores (padrão marco lógico)"
            hint="Para cada meta acima, o que exatamente vai ser medido, como (meio de verificação) e com que frequência — é o que uma Governança/financiador vai cobrar depois."
          >
            <div className="space-y-2">
              {(project.indicadores ?? []).map((ind) => (
                <div key={ind.id} className="grid grid-cols-12 gap-2 rounded border border-[color:var(--sm-border)] p-2">
                  <input
                    className={`${inputClass} col-span-4`}
                    placeholder="Indicador (ex.: nº de famílias atendidas)"
                    value={ind.nome}
                    onChange={(e) => updateIndicador(ind.id, { nome: e.target.value })}
                  />
                  <input
                    className={`${inputClass} col-span-3`}
                    placeholder="Meta (ex.: 20 até o mês 12)"
                    value={ind.meta}
                    onChange={(e) => updateIndicador(ind.id, { meta: e.target.value })}
                  />
                  <input
                    className={`${inputClass} col-span-3`}
                    placeholder="Meio de verificação (ex.: livro de registro)"
                    value={ind.meioVerificacao ?? ""}
                    onChange={(e) => updateIndicador(ind.id, { meioVerificacao: e.target.value })}
                  />
                  <input
                    className={`${inputClass} col-span-1`}
                    placeholder="Frequência"
                    value={ind.frequencia ?? ""}
                    onChange={(e) => updateIndicador(ind.id, { frequencia: e.target.value })}
                  />
                  <button onClick={() => removerIndicador(ind.id)} className="col-span-1 text-xs text-[color:var(--sm-red)]">
                    x
                  </button>
                </div>
              ))}
              <button onClick={adicionarIndicador} className="rounded border border-dashed border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)]">
                + Adicionar indicador
              </button>
            </div>
          </Field>
          <Field label="Como as pessoas da comunidade podem ajudar?" hint='Ex.: "galpão de reciclagem: moradores separam lixo orgânico do reciclável em casa". Mutirão/trabalho voluntário é uma forma legítima de reduzir custo sem virar folha permanente vedada.'>
            <textarea className={inputClass} rows={2} value={project.comoComunidadeAjuda ?? ""} onChange={(e) => update("comoComunidadeAjuda", e.target.value)} />
          </Field>
          <Field label="Qual a missão do projeto — como ele melhora a vida das pessoas?" hint="Deve ter relação com as metas e o objetivo acima.">
            <textarea className={inputClass} rows={2} value={project.missaoImpacto ?? ""} onChange={(e) => update("missaoImpacto", e.target.value)} />
          </Field>
        </Section>
      ),
    },
    {
      info: { id: "publico", titulo: "Público" },
      conteudo: (
        <Section title="Público potencial alcançado">
          <Field label="Setor / grupo prioritário" hint="Mínimo de 30% dos recursos do Anexo deve alcançar grupos com cota (Proposta pág. 53).">
            <select className={inputClass} value={project.setorId} onChange={(e) => update("setorId", e.target.value)}>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                  {s.cota ? " (cota mín. 30%)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Este projeto é coordenado por mulher(es)?" hint="Conta para a cota de 30% do Anexo mesmo que o setor acima seja outro.">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={project.coordenacaoFeminina ?? false} onChange={(e) => update("coordenacaoFeminina", e.target.checked)} />
              Sim, coordenado por mulher(es)
            </label>
          </Field>
        </Section>
      ),
    },
    {
      info: { id: "orcamento", titulo: "Orçamento", temBloqueio: orcamentoTemBloqueio },
      conteudo: (
        <Section title="Orçamento por item">
          {arquetipo && (
            <button
              onClick={preencherOrcamentoSugerido}
              className="rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/10 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/20"
            >
              + Preencher com itens sugeridos para "{arquetipo.nome}"
            </button>
          )}
          <div className="space-y-2">
            {project.orcamento.map((l) => (
              <div key={l.id} className="grid grid-cols-12 gap-2 rounded border border-[color:var(--sm-border)] p-2">
                <select className={`${inputClass} col-span-3`} value={l.categoria} onChange={(e) => updateLinha(l.id, { categoria: e.target.value as CategoriaLinha })}>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  className={`${inputClass} col-span-4`}
                  placeholder="O que essa despesa paga, exatamente?"
                  value={l.descricao}
                  onChange={(e) => updateLinha(l.id, { descricao: e.target.value })}
                />
                <input type="number" className={`${inputClass} col-span-2`} placeholder="Valor R$" value={l.valor} onChange={(e) => updateLinha(l.id, { valor: Number(e.target.value) })} />
                <input
                  type="number"
                  className={`${inputClass} col-span-2`}
                  placeholder="Prazo (meses)"
                  value={l.prazoMeses ?? ""}
                  onChange={(e) => updateLinha(l.id, { prazoMeses: e.target.value ? Number(e.target.value) : undefined })}
                />
                <button onClick={() => removeLinha(l.id)} className="col-span-1 text-xs text-[color:var(--sm-red)]">
                  x
                </button>
                <button
                  onClick={() => pesquisarPrecoLinha(l)}
                  disabled={pesquisandoPrecoId === l.id}
                  className="col-span-12 justify-self-start rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/10 px-2 py-1 text-xs hover:bg-[color:var(--sm-accent)]/20 disabled:opacity-40"
                >
                  {pesquisandoPrecoId === l.id ? "Pesquisando preço (várias buscas)..." : "🔎 Pesquisar preço de referência (MG/Brasil, jul/2026)"}
                </button>
                <button
                  onClick={() => gerarCotacao(l)}
                  disabled={!l.descricao.trim()}
                  className="col-span-12 justify-self-start rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/10 px-2 py-1 text-xs hover:bg-[color:var(--sm-accent)]/20 disabled:opacity-40"
                >
                  📄 Gerar solicitação de cotação (.docx)
                </button>

                <div className="col-span-12 space-y-1 rounded border border-dashed border-[color:var(--sm-border)] p-2">
                  <p className="text-xs font-medium">Propostas recebidas de fornecedores</p>
                  {(l.propostas ?? []).map((pr) => (
                    <div key={pr.id} className="grid grid-cols-12 gap-1">
                      <input
                        className={`${inputClass} col-span-4`}
                        placeholder="Fornecedor"
                        value={pr.fornecedor}
                        onChange={(e) => updateProposta(l.id, pr.id, { fornecedor: e.target.value })}
                      />
                      <input
                        type="number"
                        className={`${inputClass} col-span-2`}
                        placeholder="Valor R$"
                        value={pr.valor}
                        onChange={(e) => updateProposta(l.id, pr.id, { valor: Number(e.target.value) })}
                      />
                      <input
                        type="number"
                        className={`${inputClass} col-span-2`}
                        placeholder="Prazo (dias)"
                        value={pr.prazoDias ?? ""}
                        onChange={(e) => updateProposta(l.id, pr.id, { prazoDias: e.target.value ? Number(e.target.value) : undefined })}
                      />
                      <input
                        className={`${inputClass} col-span-2`}
                        placeholder="Observações"
                        value={pr.observacoes ?? ""}
                        onChange={(e) => updateProposta(l.id, pr.id, { observacoes: e.target.value })}
                      />
                      <button onClick={() => usarProposta(l.id, pr)} className="col-span-1 text-xs text-[color:var(--sm-accent)]" title="Usar este valor na linha">
                        ✓
                      </button>
                      <button onClick={() => removerProposta(l.id, pr.id)} className="col-span-1 text-xs text-[color:var(--sm-red)]">
                        x
                      </button>
                    </div>
                  ))}
                  <button onClick={() => adicionarProposta(l.id)} className="rounded border border-dashed border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]">
                    + Registrar proposta
                  </button>
                </div>

                {l.categoria === "equipamento" && (
                  <input
                    type="number"
                    className={`${inputClass} col-span-4`}
                    placeholder="Vida útil (anos, padrão 5)"
                    value={l.vidaUtilAnos ?? ""}
                    onChange={(e) => updateLinha(l.id, { vidaUtilAnos: e.target.value ? Number(e.target.value) : undefined })}
                  />
                )}
                {(l.categoria === "folha-permanente" || CATEGORIAS_COM_PRAZO_6M.includes(l.categoria)) && (
                  <input
                    className={`${inputClass} col-span-6`}
                    placeholder="Fonte de custeio futuro (obrigatório p/ evitar bloqueio)"
                    value={l.fonteCusteioFuturo ?? ""}
                    onChange={(e) => updateLinha(l.id, { fonteCusteioFuturo: e.target.value })}
                  />
                )}
                {CATEGORIAS_COM_PRAZO_6M.includes(l.categoria) && (
                  <input
                    className={`${inputClass} col-span-6`}
                    placeholder="Justificativa de ciclo produtivo (se prazo > 6 meses)"
                    value={l.justificativaCicloProdutivo ?? ""}
                    onChange={(e) => updateLinha(l.id, { justificativaCicloProdutivo: e.target.value })}
                  />
                )}
                {arquetipo?.tipo === "4.4" && (
                  <label className="col-span-12 flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={l.anuenciaEntePublico ?? false} onChange={(e) => updateLinha(l.id, { anuenciaEntePublico: e.target.checked })} />
                    Há anuência formal do ente público para manutenção/custeio futuros
                  </label>
                )}
              </div>
            ))}
            <button onClick={addLinha} className="rounded border border-dashed border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)]">
              + Adicionar item
            </button>
          </div>
          {subperguntasPreco && subperguntasPreco.length > 0 && (
            <p className="text-xs text-[color:var(--sm-text-dim)]">Pesquisado: {subperguntasPreco.join(" · ")}</p>
          )}
          {erroPreco && <p className="text-xs text-[color:var(--sm-red)]">{erroPreco}</p>}
          <p className="text-sm">
            Total: <strong>R$ {totalOrcamento.toFixed(2)}</strong> / Teto do porte ({porte}): R$ {teto.toFixed(2)}
            {totalOrcamento > teto && <span className="ml-2 text-[color:var(--sm-red)]">acima do teto configurado</span>}
          </p>
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-medium">Checagem de conformidade</h3>
            {conformidade.map((f, i) => (
              <div key={i} className="flex items-start gap-2 rounded border border-[color:var(--sm-border)] p-2 text-sm sm-fade">
                <Badge severidade={f.severidade} />
                <div>
                  <p className="font-medium">{f.regra}</p>
                  <p className="text-[color:var(--sm-text-dim)]">{f.mensagem}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ),
    },
    {
      info: { id: "equipe", titulo: "Equipe e cronograma" },
      conteudo: (
        <Section title="Equipe e cronograma">
          <Field label="Equipe necessária (dentro do orçamento)" hint="Cada pessoa/papel tem seu próprio plano de trabalho — formação necessária, horas/semana e o que faz mês a mês.">
            <div className="space-y-2">
              {project.equipe.map((m) => (
                <div key={m.id} className="grid grid-cols-12 gap-2 rounded border border-[color:var(--sm-border)] p-2">
                  <input
                    className={`${inputClass} col-span-6`}
                    placeholder="Nome ou papel (ex.: Coordenador(a) geral)"
                    value={m.nome}
                    onChange={(e) => updateMembro(m.id, { nome: e.target.value })}
                  />
                  <button onClick={() => removeMembro(m.id)} className="col-span-6 justify-self-end text-xs text-[color:var(--sm-red)]">
                    remover
                  </button>
                  <input
                    className={`${inputClass} col-span-6`}
                    placeholder="Formação necessária"
                    value={m.formacaoNecessaria ?? ""}
                    onChange={(e) => updateMembro(m.id, { formacaoNecessaria: e.target.value })}
                  />
                  <input
                    type="number"
                    className={`${inputClass} col-span-3`}
                    placeholder="Horas/semana"
                    value={m.horasSemanais ?? ""}
                    onChange={(e) => updateMembro(m.id, { horasSemanais: e.target.value ? Number(e.target.value) : undefined })}
                  />
                  <input
                    type="number"
                    className={`${inputClass} col-span-3`}
                    placeholder="Duração (meses)"
                    value={m.duracaoMeses ?? ""}
                    onChange={(e) => updateMembro(m.id, { duracaoMeses: e.target.value ? Number(e.target.value) : undefined })}
                  />
                  <textarea
                    className={`${inputClass} col-span-12`}
                    rows={2}
                    placeholder="Plano de trabalho — o que a pessoa faz, mês a mês"
                    value={m.planoTrabalho ?? ""}
                    onChange={(e) => updateMembro(m.id, { planoTrabalho: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <button onClick={addMembro} className="mt-2 rounded border border-dashed border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)]">
              + Adicionar pessoa
            </button>
          </Field>
          <Field label="Cronograma" hint="1ª onda: local/regional, teto de 12 meses até a contratação.">
            <textarea className={inputClass} rows={3} value={project.cronograma} onChange={(e) => update("cronograma", e.target.value)} />
          </Field>
        </Section>
      ),
    },
    {
      info: { id: "espaco-logistica", titulo: "Espaço e logística" },
      conteudo: (
        <Section title="Previsão de espaço físico e logística">
          <p className="text-xs text-[color:var(--sm-text-dim)]">
            Ajuda a planejar "conseguir o local" no roteiro de implementação e a estimar custo/risco de troca de insumos com outros projetos da rede (economia circular).
          </p>
          <Field label="Município (bacia do Paraopeba)" hint="Usado para o mapa regional e para calcular distância/custo logístico real com outros projetos da rede.">
            <select className={inputClass} value={project.municipioId ?? ""} onChange={(e) => update("municipioId", e.target.value || undefined)}>
              <option value="">Não definido</option>
              {MUNICIPIOS_PARAOPEBA.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Área necessária (m²)">
            <input
              type="number"
              className={inputClass}
              value={project.espacoLogistica?.areaM2 ?? ""}
              onChange={(e) => updateEspacoLogistica({ areaM2: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
          <Field label="Tipo de espaço" hint="Ex.: galpão coberto, terreno aberto, sala de aula, cozinha industrial.">
            <input
              className={inputClass}
              value={project.espacoLogistica?.tipoEspaco ?? ""}
              onChange={(e) => updateEspacoLogistica({ tipoEspaco: e.target.value })}
            />
          </Field>
          <Field label="Acesso ao local" hint="Afeta o custo/viabilidade de receber insumos e escoar produção.">
            <select
              className={inputClass}
              value={project.espacoLogistica?.acesso ?? ""}
              onChange={(e) => updateEspacoLogistica({ acesso: (e.target.value || undefined) as EspacoLogistica["acesso"] })}
            >
              <option value="">Não definido</option>
              <option value="asfalto">Estrada asfaltada</option>
              <option value="estrada-terra">Estrada de terra</option>
              <option value="transporte-publico-proximo">Transporte público próximo</option>
              <option value="dificil">Acesso difícil</option>
            </select>
          </Field>
          <Field label="Distância estimada até fornecedores/projetos parceiros (km)" hint="Estimativa manual — base para calcular custo logístico quando o projeto troca insumos com a rede.">
            <input
              type="number"
              className={inputClass}
              value={project.espacoLogistica?.distanciaFornecedoresKm ?? ""}
              onChange={(e) => updateEspacoLogistica({ distanciaFornecedoresKm: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
          <Field label="Observações de logística">
            <textarea
              className={inputClass}
              rows={2}
              value={project.espacoLogistica?.observacoes ?? ""}
              onChange={(e) => updateEspacoLogistica({ observacoes: e.target.value })}
            />
          </Field>

          {project.municipioId && parceirosLogistica.length > 0 && (
            <div className="space-y-2 rounded border border-dashed border-[color:var(--sm-border)] p-2">
              <p className="text-sm font-medium">🚚 Distância e custo logístico com projetos parceiros da rede</p>
              <button
                onClick={calcularRotasParceiros}
                disabled={rotasCalculando}
                className="rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/10 px-2 py-1 text-xs hover:bg-[color:var(--sm-accent)]/20 disabled:opacity-40"
              >
                {rotasCalculando ? "Calculando rotas..." : "Calcular distância (rota real com internet, senão estimativa offline)"}
              </button>
              <ul className="space-y-1 text-xs">
                {parceirosLogistica.map((p) => {
                  const rota = rotasPorProjeto.get(p.id);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-[color:var(--sm-border)] p-2">
                      <span>
                        <strong>{p.titulo || "(sem título)"}</strong>
                        {rota && (
                          <>
                            {" "}
                            — {rota.km.toFixed(0)} km ({rota.fonte === "osrm" ? "rota real (OSRM)" : "estimativa offline: linha reta × 1,4"}) · custo logístico sugerido: R${" "}
                            {custoLogisticoMensalEstimado(rota.km, FREQ_VIAGENS_MES_PADRAO, CUSTO_POR_KM_PADRAO).toFixed(2)}/mês
                          </>
                        )}
                      </span>
                      {rota && (
                        <button
                          onClick={() => adicionarLinhaCustoLogistico(p, rota)}
                          className="shrink-0 rounded border border-[color:var(--sm-accent)] px-2 py-1 hover:bg-[color:var(--sm-accent)]/20"
                        >
                          + Adicionar ao orçamento
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-[10px] text-[color:var(--sm-text-dim)]">
                Estimativa de custo: R$ {CUSTO_POR_KM_PADRAO.toFixed(2)}/km, ida e volta, {FREQ_VIAGENS_MES_PADRAO}x/mês — ajuste manualmente a linha depois de adicionada se a frequência real for
                diferente.
              </p>
            </div>
          )}
        </Section>
      ),
    },
    {
      info: { id: "arrecadacao", titulo: "Arrecadação e custos" },
      conteudo: (
        <>
          <Section title="Formas de arrecadação / captação">
            <div className="space-y-1">
              <button
                onClick={pesquisarArrecadacao}
                disabled={pesquisandoArrecadacao}
                className="rounded border border-[color:var(--sm-accent)]/40 bg-[color:var(--sm-accent)]/10 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/20 disabled:opacity-40"
              >
                {pesquisandoArrecadacao ? "Pesquisando políticas públicas (várias buscas)..." : "🔎 Pesquisar editais/linhas de crédito (federal/MG/município)"}
              </button>
              <p className="text-xs text-[color:var(--sm-text-dim)]">Exige internet e chave da Tavily. Só busca municipal se o Local já estiver preenchido.</p>
              {subperguntasArrecadacao && subperguntasArrecadacao.length > 0 && (
                <p className="text-xs text-[color:var(--sm-text-dim)]">Pesquisado: {subperguntasArrecadacao.join(" · ")}</p>
              )}
              {erroArrecadacao && <p className="text-xs text-[color:var(--sm-red)]">{erroArrecadacao}</p>}
            </div>
            <div className="flex gap-2">
              <input className={inputClass} value={novaForma} onChange={(e) => setNovaForma(e.target.value)} placeholder="Ex.: tarifa comunitária, convênio, receita própria" />
              <button
                className="shrink-0 rounded border border-[color:var(--sm-border)] px-3 text-sm hover:border-[color:var(--sm-accent)]"
                onClick={() => {
                  if (!novaForma.trim()) return;
                  update("formasArrecadacao", [...project.formasArrecadacao, novaForma.trim()]);
                  setNovaForma("");
                }}
              >
                Adicionar
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {project.formasArrecadacao.map((f, i) => (
                <li key={i} className="rounded border border-[color:var(--sm-border)] px-2 py-1">
                  {f}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Custos que o Anexo I.1 NÃO cobre de forma permanente">
            <p className="text-xs text-[color:var(--sm-text-dim)]">
              Terreno, construção, água, energia, internet, telefone, contabilidade, jurídico, propaganda — marque os que se aplicam. O valor já vem com uma estimativa inicial de referência para o porte "{porte}" — ajuste conforme sua realidade, e informe a fonte futura.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {custosCatalogo.map((c) => {
                const marcado = project.custosNaoCobertos.find((x) => x.id === c.id);
                return (
                  <div key={c.id} className="rounded border border-[color:var(--sm-border)] p-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!marcado} onChange={() => toggleCustoNaoCoberto(c)} />
                      {c.nome}
                    </label>
                    {marcado && (
                      <div className="mt-1 space-y-1">
                        <input
                          type="number"
                          className={inputClass}
                          placeholder="R$/mês estimado"
                          value={marcado.valorMensalEstimado}
                          onChange={(e) => updateCustoNaoCoberto(c.id, { valorMensalEstimado: Number(e.target.value) })}
                        />
                        <input
                          className={inputClass}
                          placeholder="Fonte de custeio futuro"
                          value={marcado.fonteCusteioFuturo ?? ""}
                          onChange={(e) => updateCustoNaoCoberto(c.id, { fonteCusteioFuturo: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </>
      ),
    },
    {
      info: { id: "simulador", titulo: "Simulação (POS)" },
      conteudo: (
        <Section title="Simulador: o dia seguinte ao fim do dinheiro (POS)">
          <div className="grid grid-cols-3 gap-3">
            {project.cenarios.map((c) => (
              <div key={c.nome} className="space-y-2 rounded border border-[color:var(--sm-border)] p-2">
                <p className="text-sm font-medium capitalize">{c.nome}</p>
                <Field label="Receita mensal estimada (R$)">
                  <input type="number" className={inputClass} value={c.receitaMensalEstimada} onChange={(e) => updateCenario(c.nome, { receitaMensalEstimada: Number(e.target.value) })} />
                </Field>
                <Field label="Custo operacional mensal (R$)" hint="Sem contar os custos não cobertos do passo anterior — eles somam automaticamente.">
                  <input type="number" className={inputClass} value={c.custoOperacionalMensal} onChange={(e) => updateCenario(c.nome, { custoOperacionalMensal: Number(e.target.value) })} />
                </Field>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-2">
            {simulacoes.map((s) => (
              <div key={s.cenario} className="flex items-center justify-between rounded border border-[color:var(--sm-border)] p-2 text-sm sm-fade">
                <span className="capitalize">{s.cenario}</span>
                <span>
                  Saldo/mês: <strong>R$ {s.saldoMensal.toFixed(2)}</strong>
                </span>
                <Badge severidade={s.autossustentavel ? "ok" : "bloqueio"} />
              </div>
            ))}
          </div>

          {depreciacaoMensal > 0 && (
            <div className="space-y-2 rounded border border-[color:var(--sm-yellow)]/40 bg-[color:var(--sm-yellow)]/10 p-2">
              <p className="text-sm">
                Depreciação estimada dos equipamentos: <strong>R$ {depreciacaoMensal.toFixed(2)}/mês</strong> (já somada ao custo operacional acima). Sem repor o equipamento, o projeto para quando ele quebrar.
              </p>
              <Field label="Fonte futura de reposição dos equipamentos">
                <input
                  className={inputClass}
                  value={project.fonteReposicaoEquipamentos ?? ""}
                  onChange={(e) => update("fonteReposicaoEquipamentos", e.target.value)}
                  placeholder="Ex.: fundo de reposição com 5% da receita mensal"
                />
              </Field>
            </div>
          )}

          {exigenciaPOS(project) === "completo" && (
            <div className="space-y-2 rounded border border-[color:var(--sm-yellow)]/40 bg-[color:var(--sm-yellow)]/10 p-2">
              <p className="text-sm font-medium">POS completo (obrigatório para porte médio/grande)</p>
              <Field label="Responsável pela operação e manutenção">
                <input
                  className={inputClass}
                  value={project.posCompleto.responsavelOperacao ?? ""}
                  onChange={(e) => update("posCompleto", { ...project.posCompleto, responsavelOperacao: e.target.value })}
                />
              </Field>
              <Field label="Fonte de custeio futuro geral do projeto">
                <input
                  className={inputClass}
                  value={project.posCompleto.fonteCusteioFuturoGeral ?? ""}
                  onChange={(e) => update("posCompleto", { ...project.posCompleto, fonteCusteioFuturoGeral: e.target.value })}
                />
              </Field>
              <Field label="Metodologia de transição" hint="Como o apoio inicial do Anexo passa a operação para a comunidade/entidade responsável.">
                <textarea
                  className={inputClass}
                  rows={2}
                  value={project.posCompleto.metodologiaTransicao ?? ""}
                  onChange={(e) => update("posCompleto", { ...project.posCompleto, metodologiaTransicao: e.target.value })}
                />
              </Field>
              <Field label="Indicadores de autonomia" hint="Como verificar que o projeto se sustenta sozinho — o que vai ser medido.">
                <textarea
                  className={inputClass}
                  rows={2}
                  value={project.posCompleto.indicadoresAutonomia ?? ""}
                  onChange={(e) => update("posCompleto", { ...project.posCompleto, indicadoresAutonomia: e.target.value })}
                />
              </Field>
            </div>
          )}
        </Section>
      ),
    },
    {
      info: { id: "riscos", titulo: "Riscos" },
      conteudo: (
        <Section title="Matriz de risco">
          <p className="text-xs text-[color:var(--sm-text-dim)]">
            Foco no que barra ou quebra o projeto — não é desculpa: o Ofício 45 é explícito que mencionar dificuldade na matriz de risco não desobriga o cumprimento de metas e prazos.
          </p>
          <div className="space-y-2">
            {project.riscos.map((r) => (
              <div key={r.id} className="grid grid-cols-12 gap-2 rounded border border-[color:var(--sm-border)] p-2">
                <input
                  className={`${inputClass} col-span-5`}
                  placeholder="Descrição do risco"
                  value={r.descricao}
                  onChange={(e) => updateRisco(r.id, { descricao: e.target.value })}
                />
                <select className={`${inputClass} col-span-2`} value={r.probabilidade} onChange={(e) => updateRisco(r.id, { probabilidade: e.target.value as RiskItem["probabilidade"] })}>
                  <option value="baixo">Prob. baixa</option>
                  <option value="medio">Prob. média</option>
                  <option value="alto">Prob. alta</option>
                </select>
                <select className={`${inputClass} col-span-2`} value={r.impacto} onChange={(e) => updateRisco(r.id, { impacto: e.target.value as RiskItem["impacto"] })}>
                  <option value="baixo">Impacto baixo</option>
                  <option value="medio">Impacto médio</option>
                  <option value="alto">Impacto alto</option>
                </select>
                <input
                  className={`${inputClass} col-span-2`}
                  placeholder="Mitigação"
                  value={r.mitigacao}
                  onChange={(e) => updateRisco(r.id, { mitigacao: e.target.value })}
                />
                <button onClick={() => removerRisco(r.id)} className="col-span-1 text-xs text-[color:var(--sm-red)]">
                  x
                </button>
              </div>
            ))}
            <button onClick={adicionarRisco} className="rounded border border-dashed border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)]">
              + Adicionar risco
            </button>
          </div>
        </Section>
      ),
    },
    {
      info: { id: "contato", titulo: "Dados opcionais" },
      conteudo: (
        <Section title="Dados opcionais">
          <Field label="Pessoa coordenadora">
            <input className={inputClass} value={project.contato.coordenador ?? ""} onChange={(e) => update("contato", { ...project.contato, coordenador: e.target.value })} />
          </Field>
          <Field label="Telefone">
            <input className={inputClass} value={project.contato.telefone ?? ""} onChange={(e) => update("contato", { ...project.contato, telefone: e.target.value })} />
          </Field>
          <Field label="Endereço">
            <input className={inputClass} value={project.contato.endereco ?? ""} onChange={(e) => update("contato", { ...project.contato, endereco: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <input className={inputClass} value={project.contato.email ?? ""} onChange={(e) => update("contato", { ...project.contato, email: e.target.value })} />
          </Field>
        </Section>
      ),
    },
    {
      info: { id: "revisao", titulo: "Revisão final" },
      conteudo: (
        <>
          <Section title="Revisão por um segundo agente (Ofícios 45/46 + Proposta Definitiva)">
            <p className="text-xs text-[color:var(--sm-text-dim)]">
              Um agente independente confere o projeto contra as regras oficiais e o motor de conformidade determinístico (não substitui o motor — é uma segunda camada de checagem).
            </p>
            <button
              onClick={executarRevisao}
              disabled={revisando}
              className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25 disabled:opacity-40"
            >
              {revisando ? "Revisando..." : "🛡 Revisar com IA"}
            </button>
            {erroRevisao && <p className="text-xs text-[color:var(--sm-red)]">{erroRevisao}</p>}
            {revisao && (
              <div className="space-y-2 rounded border border-[color:var(--sm-border)] p-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge severidade={revisao.adequado ? "ok" : "atencao"} />
                  <span>{revisao.adequado ? "O agente considera o projeto adequado às regras." : "O agente sugere ajustes antes de finalizar."}</span>
                </div>
                {revisao.divergeDoMotor && (
                  <p className="text-xs text-[color:var(--sm-yellow)]">
                    ⚠ O agente de revisão discordou em algum ponto do motor de conformidade determinístico — confira os dois vereditos antes de decidir.
                  </p>
                )}
                {revisao.mudancasResumo.length > 0 && (
                  <div>
                    <p className="font-medium">O que o agente sugere mudar:</p>
                    <ul className="list-disc pl-4">
                      {revisao.mudancasResumo.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {Object.keys(revisao.mudancasSugeridas).some((k) => (revisao.mudancasSugeridas as Record<string, unknown>)[k] !== undefined) && (
                  <button onClick={aplicarMudancasDaRevisao} className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-2 py-1 text-xs hover:bg-[color:var(--sm-accent)]/30">
                    Aplicar mudanças sugeridas
                  </button>
                )}
              </div>
            )}
          </Section>

          <Section title="Checklist final">
            <div>
              <p className="text-sm font-medium">Próximos passos</p>
              <ul className="list-disc pl-4 text-sm">
                {checklist.proximosPassos.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
            {checklist.pendencias.length > 0 && (
              <div>
                <p className="text-sm font-medium">Pendências</p>
                <ul className="list-disc pl-4 text-sm text-[color:var(--sm-yellow)]">
                  {checklist.pendencias.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {checklist.recomendacoes.length > 0 && (
              <div>
                <p className="text-sm font-medium">Recomendações do agente de revisão</p>
                <ul className="list-disc pl-4 text-sm">
                  {checklist.recomendacoes.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {checklist.perguntas.length > 0 && (
              <div>
                <p className="text-sm font-medium">Perguntas em aberto</p>
                <ul className="list-disc pl-4 text-sm">
                  {checklist.perguntas.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        </>
      ),
    },
  ];

  function irParaPasso(indice: number) {
    setPassoAtual(Math.max(0, Math.min(passos.length - 1, indice)));
  }

  function irParaPassoPorId(id: string) {
    const indice = passos.findIndex((p) => p.info.id === id);
    if (indice >= 0) setPassoAtual(indice);
    setVerDocumento(false);
  }

  useEffect(() => {
    headingRef.current?.focus();
  }, [passoAtual]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        irParaPasso(passoAtual + 1);
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        irParaPasso(passoAtual - 1);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setSalvoAgora(true);
        window.setTimeout(() => setSalvoAgora(false), 1200);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        exportarProjetoDocx(project);
      } else if (e.key === "Escape" && copilotoAberto) {
        setCopilotoAberto(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passoAtual, project, copilotoAberto]);

  if (verDocumento) {
    return <ProjectDocumento project={project} onFechar={() => setVerDocumento(false)} onIrParaPasso={irParaPassoPorId} onAtualizar={onChange} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <button onClick={onVoltar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
          ← Meus projetos
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-xs text-[color:var(--sm-text-dim)] sm-fade ${salvoAgora ? "opacity-100" : "opacity-0"}`}>Salvo automaticamente</span>
          <button
            onClick={() => setVerDocumento(true)}
            className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)]"
          >
            📄 Documento completo
          </button>
          <button
            onClick={() => setLapidacaoAberta(true)}
            className="rounded border border-[color:var(--sm-accent)]/50 bg-[color:var(--sm-accent)]/10 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/20"
            title="Seis agentes de IA revisam e melhoram o projeto — você aprova antes de aplicar"
          >
            🔁 Lapidar
          </button>
          <button
            onClick={() => setCopilotoAberto((v) => !v)}
            className="rounded border border-[color:var(--sm-accent)]/50 bg-[color:var(--sm-accent)]/10 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/20"
          >
            {copilotoAberto ? "Fechar copiloto" : "Copiloto (IA)"}
          </button>
          <div className="flex gap-2">
            <button onClick={() => exportarProjetoDocx(project)} className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)]" title="Ctrl+E">
              Exportar .docx
            </button>
            <button onClick={() => exportarProjetoXlsx(project)} className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)]">
              Exportar .xlsx
            </button>
            <button onClick={() => exportarProjetoPdf()} className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)]">
              Exportar .pdf
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {bloqueios > 0 && <Badge severidade="bloqueio" />}
        {bloqueios > 0 && <span>{bloqueios} bloqueio{bloqueios > 1 ? "s" : ""}</span>}
        {atencoes > 0 && <Badge severidade="atencao" />}
        {atencoes > 0 && <span>{atencoes} atenção</span>}
        {bloqueios === 0 && atencoes === 0 && (
          <>
            <Badge severidade="ok" />
            <span>Projeto sem bloqueios pendentes</span>
            {florescendo && <span className="sm-bloom text-lg">🌸</span>}
          </>
        )}
      </div>

      <Stepper passos={passos.map((p) => p.info)} atual={passoAtual} onIr={irParaPasso} />

      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {passos[passoAtual].info.titulo}
      </h2>

      <div className="space-y-4">{passos[passoAtual].conteudo}</div>

      <div className="flex justify-between pt-2">
        <button
          onClick={() => irParaPasso(passoAtual - 1)}
          disabled={passoAtual === 0}
          className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)] disabled:opacity-30"
        >
          ← Voltar (Alt+←)
        </button>
        <button
          onClick={() => irParaPasso(passoAtual + 1)}
          disabled={passoAtual === passos.length - 1}
          className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-sm hover:border-[color:var(--sm-accent)] disabled:opacity-30"
        >
          Próximo (Alt+→) →
        </button>
      </div>

      {copilotoAberto && (
        <CopilotoChat
          project={project}
          onClose={() => setCopilotoAberto(false)}
          onAplicarRascunho={handleAplicarRascunho}
          autoGerarRascunho={autoGerarRascunho}
          onAutoGerarConsumido={() => setAutoGerarRascunho(false)}
        />
      )}

      {lapidacaoAberta && <LapidacaoPanel project={project} onAplicar={(p) => onChange(p)} onClose={() => setLapidacaoAberta(false)} />}
    </div>
  );
}
