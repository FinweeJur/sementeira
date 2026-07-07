export type Abrangencia = "local" | "regional" | "inter-regional";
export type Porte = "pequeno" | "medio" | "grande";

export const PORTE_POR_ABRANGENCIA: Record<Abrangencia, Porte> = {
  local: "pequeno",
  regional: "medio",
  "inter-regional": "grande",
};

export const CONSELHO_POR_ABRANGENCIA: Record<Abrangencia, string> = {
  local: "Conselhos e Setores Locais",
  regional: "Conselhos e Setores Regionais",
  "inter-regional": "Conselho e Setor Inter-regional",
};

export interface TetoPorPorte {
  pequeno: number;
  medio: number;
  grande: number;
}

export const TETO_PADRAO: TetoPorPorte = {
  pequeno: 100_000,
  medio: 500_000,
  grande: 1_500_000,
};

export type CategoriaLinha =
  | "infraestrutura"
  | "equipamento"
  | "regularizacao"
  | "capacitacao"
  | "capital-giro-inicial"
  | "insumos-iniciais"
  | "equipe-implantacao"
  | "operacao-assistida"
  | "folha-permanente"
  | "outro";

/** Proposta recebida de um fornecedor em resposta à solicitação de cotação de uma linha de orçamento. */
export interface PropostaFornecedor {
  id: string;
  fornecedor: string;
  valor: number;
  prazoDias?: number;
  observacoes?: string;
}

export interface BudgetLine {
  id: string;
  categoria: CategoriaLinha;
  descricao: string;
  valor: number;
  prazoMeses?: number;
  fonteCusteioFuturo?: string;
  justificativaCicloProdutivo?: string;
  anuenciaEntePublico?: boolean;
  /** Anos de vida útil (só relevante p/ categoria "equipamento") — base para calcular a depreciação mensal no simulador. */
  vidaUtilAnos?: number;
  /** Propostas recebidas de fornecedores para esta linha — comparar antes de fixar `valor`. */
  propostas?: PropostaFornecedor[];
}

/** Uma pessoa/papel da equipe, com plano de trabalho próprio — não só um nome numa lista. */
export interface EquipeMembro {
  id: string;
  /** Nome ou papel/função (ex.: "Coordenador(a) geral"). */
  nome: string;
  formacaoNecessaria?: string;
  horasSemanais?: number;
  duracaoMeses?: number;
  /** O que a pessoa faz, mês a mês — texto livre. */
  planoTrabalho?: string;
}

/** Pessoa cadastrada como voluntária no portfólio (Fase 14a) — trabalho pontual/mutirão, nunca substitui posto de folha permanente (o motor de conformidade não é relaxado por isso). */
export interface Voluntario {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  /** Texto livre, uma habilidade por item (ex.: "pedreiro", "cozinha", "redes sociais"). */
  habilidades?: string[];
  disponibilidadeHorasSemana?: number;
  /** Ids de Project que a pessoa declarou (ou foi associada) como interesse. */
  projetosDeInteresse?: string[];
  observacoes?: string;
  cadastradoEm: string;
}

/** Um mês do cronograma detalhado, gerado pelo compilador da lapidação — complementa o resumo livre de `Project.cronograma`. */
export interface MesCronograma {
  mes: number;
  atividades: string[];
}

export type AcessoLogistico = "asfalto" | "estrada-terra" | "transporte-publico-proximo" | "dificil";

/** Previsão de espaço físico e logística — usada no plano de implementação e para estimar custo/risco de deslocamento entre projetos da rede (economia circular). */
export interface EspacoLogistica {
  areaM2?: number;
  tipoEspaco?: string;
  acesso?: AcessoLogistico;
  distanciaFornecedoresKm?: number;
  observacoes?: string;
}

export interface Contato {
  coordenador?: string;
  telefone?: string;
  endereco?: string;
  email?: string;
  outros?: Record<string, string>;
}

/** Booleano ortogonal ao setor beneficiário — conta para a cota de 30% de mulheres (Proposta pág. 53) mesmo se o setor selecionado for outro. */
export type CoordenacaoFeminina = boolean | undefined;

export type Severidade = "ok" | "atencao" | "bloqueio";

export interface ComplianceFinding {
  severidade: Severidade;
  linhaId?: string;
  regra: string;
  mensagem: string;
}

export interface CustoNaoCobertoItem {
  id: string;
  nome: string;
  valorMensalEstimado: number;
  fonteCusteioFuturo?: string;
}

export interface Cenario {
  nome: "otimista" | "realista" | "pessimista";
  receitaMensalEstimada: number;
  custoOperacionalMensal: number;
}

export type NivelRisco = "baixo" | "medio" | "alto";

export interface RiskItem {
  id: string;
  descricao: string;
  probabilidade: NivelRisco;
  impacto: NivelRisco;
  mitigacao: string;
}

/** Campos extras exigidos quando o POS é "completo" (porte médio/grande — ver exigenciaPOS em simulator.ts). */
export interface PosCompleto {
  responsavelOperacao?: string;
  fonteCusteioFuturoGeral?: string;
  metodologiaTransicao?: string;
  indicadoresAutonomia?: string;
}

export interface Project {
  id: string;
  ideiaTexto: string;
  titulo: string;
  /** Enquanto false/undefined, o título segue automaticamente a ideia. Vira true assim que a pessoa edita o título na mão — não sobrescreve mais depois disso. */
  tituloEditadoManualmente?: boolean;
  arquetipoId: string;
  danoId: string;
  objetivo: string;
  justificativa: string;
  metas: string[];
  setorId: string;
  local: string;
  /** Município da bacia do Paraopeba, para geocodificação offline (mapa regional + cálculo de distância/rota entre projetos da rede). */
  municipioId?: string;
  abrangencia: Abrangencia;
  tetoPorte: TetoPorPorte;
  orcamento: BudgetLine[];
  equipe: EquipeMembro[];
  cronograma: string;
  /** Cronograma mês a mês gerado pela lapidação — complementa o resumo livre acima; ausente até a primeira lapidação. */
  cronogramaMensal?: MesCronograma[];
  formasArrecadacao: string[];
  custosNaoCobertos: CustoNaoCobertoItem[];
  cenarios: Cenario[];
  contato: Contato;
  coordenacaoFeminina?: boolean;
  comoComunidadeAjuda?: string;
  missaoImpacto?: string;
  riscos: RiskItem[];
  posCompleto: PosCompleto;
  /** Sugestões vindas da lapidação do ecossistema, aplicadas com confirmação — exportadas no documento do projeto. */
  observacoesEcossistema?: string[];
  /** Roteiro passo a passo da implementação (pré-produção → operação), produzido pelo compilador da lapidação — editável e exportado. */
  planoImplementacao?: string[];
  /** Previsão de espaço físico e logística necessária para operar o projeto. */
  espacoLogistica?: EspacoLogistica;
  /** Fonte futura para repor equipamentos ao fim da vida útil — evita que o POS superestime a sustentabilidade ignorando a depreciação. */
  fonteReposicaoEquipamentos?: string;
  /** Contagem de lapidações aplicadas (v1, v2, v3...) — 0/undefined = nunca lapidado. */
  versaoLapidacao?: number;
  /** Data (ISO) em que o projeto REALMENTE saiu do papel — marcada manualmente pelo usuário, nunca estimada. Base para a orientação mensal de acompanhamento (Fase 14b). */
  dataInicioReal?: string;
  /** Últimas versões anteriores (máx. 8, mais antiga sai primeiro) — permite reverter uma lapidação aplicada. */
  historicoVersoes?: VersaoSnapshot[];
  criadoEm: string;
  atualizadoEm: string;
}

/** Estado do projeto ANTES de uma lapidação ser aplicada — snapshot para reverter. Não inclui o próprio histórico, para não aninhar recursivamente. */
export interface VersaoSnapshot {
  versao: number;
  aplicadaEm: string;
  changelog: string[];
  snapshot: Omit<Project, "historicoVersoes">;
}

export function novoProjetoVazio(): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ideiaTexto: "",
    titulo: "",
    arquetipoId: "",
    danoId: "",
    objetivo: "",
    justificativa: "",
    metas: [],
    setorId: "geral",
    local: "",
    abrangencia: "local",
    tetoPorte: { ...TETO_PADRAO },
    orcamento: [],
    equipe: [],
    cronograma: "",
    formasArrecadacao: [],
    custosNaoCobertos: [],
    cenarios: [
      { nome: "otimista", receitaMensalEstimada: 0, custoOperacionalMensal: 0 },
      { nome: "realista", receitaMensalEstimada: 0, custoOperacionalMensal: 0 },
      { nome: "pessimista", receitaMensalEstimada: 0, custoOperacionalMensal: 0 },
    ],
    contato: {},
    riscos: [],
    posCompleto: {},
    criadoEm: now,
    atualizadoEm: now,
  };
}
