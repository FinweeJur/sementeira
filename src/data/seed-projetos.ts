import type { BudgetLine, EquipeMembro, Project, RiskItem } from "../lib/types";
import { TETO_PADRAO } from "../lib/types";

let contador = 0;
function id(prefixo: string): string {
  contador += 1;
  return `${prefixo}-${contador}`;
}

function linha(l: Omit<BudgetLine, "id">): BudgetLine {
  return { id: id("linha"), ...l };
}

function risco(r: Omit<RiskItem, "id">): RiskItem {
  return { id: id("risco"), ...r };
}

function membro(nome: string): EquipeMembro {
  return { id: id("membro"), nome };
}

function baseProjeto(p: Partial<Project> & Pick<Project, "titulo" | "arquetipoId" | "danoId" | "objetivo" | "justificativa">): Project {
  const now = new Date().toISOString();
  return {
    id: id("proj"),
    ideiaTexto: p.titulo,
    titulo: p.titulo,
    tituloEditadoManualmente: true,
    arquetipoId: p.arquetipoId,
    danoId: p.danoId,
    objetivo: p.objetivo,
    justificativa: p.justificativa,
    metas: p.metas ?? [],
    setorId: p.setorId ?? "pessoas-mais-pobres",
    local: p.local ?? "",
    abrangencia: p.abrangencia ?? "local",
    tetoPorte: { ...TETO_PADRAO },
    orcamento: p.orcamento ?? [],
    equipe: p.equipe ?? [],
    cronograma: p.cronograma ?? "",
    formasArrecadacao: p.formasArrecadacao ?? [],
    custosNaoCobertos: p.custosNaoCobertos ?? [],
    cenarios: p.cenarios ?? [
      { nome: "otimista", receitaMensalEstimada: 0, custoOperacionalMensal: 0 },
      { nome: "realista", receitaMensalEstimada: 0, custoOperacionalMensal: 0 },
      { nome: "pessimista", receitaMensalEstimada: 0, custoOperacionalMensal: 0 },
    ],
    contato: p.contato ?? {},
    coordenacaoFeminina: p.coordenacaoFeminina,
    comoComunidadeAjuda: p.comoComunidadeAjuda,
    missaoImpacto: p.missaoImpacto,
    riscos: p.riscos ?? [],
    posCompleto: p.posCompleto ?? {},
    criadoEm: now,
    atualizadoEm: now,
  };
}

/**
 * Plano completo dos 10 projetos pedidos, com conteúdo real (não placeholder),
 * conformidade já resolvida (fontes futuras preenchidas onde a vedação exige) e
 * conexões de ecossistema desenhadas entre eles (quem fornece pra quem, mercado
 * comprador, cadeia local) — ver `ANALISE_ECOSSISTEMA` no final deste arquivo.
 */
export function gerarProjetosSeed(): Project[] {
  const horta = baseProjeto({
    titulo: "Horta Comunitária do Parque da Cachoeira",
    arquetipoId: "horta-comunitaria",
    danoId: "seguranca-alimentar",
    objetivo: "Reestabelecer a produção própria de alimentos da comunidade, reduzindo a dependência de compra externa causada pela perda de acesso a roças e quintais produtivos após o rompimento.",
    justificativa: "O diagnóstico de danos aponta perda de fontes de alimento próprio como um dos impactos mais recorrentes entre famílias rurais atingidas. Uma horta comunitária recupera parte dessa autonomia alimentar de forma coletiva e replicável.",
    metas: ["30 famílias com acesso regular a hortaliças produzidas na horta em 12 meses", "Redução de 20% no gasto mensal com hortifruti das famílias participantes"],
    setorId: "pessoas-mais-pobres",
    local: "Comunidade Rural do Parque da Cachoeira, Brumadinho/MG",
    abrangencia: "local",
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Preparo de terreno, cercamento e sistema de irrigação por gotejamento", valor: 18000 }),
      linha({ categoria: "equipamento", descricao: "Ferramentas manuais, mangueiras, estufa simples", valor: 6000 }),
      linha({ categoria: "capacitacao", descricao: "Formação em manejo agroecológico e governança da horta", valor: 5000 }),
      linha({ categoria: "insumos-iniciais", descricao: "Sementes, mudas e adubo orgânico para o primeiro ciclo", valor: 4000, prazoMeses: 6 }),
    ],
    equipe: ["Famílias em rodízio de mutirão (sem remuneração fixa)", "1 técnico(a) agrícola temporário por 6 meses"].map(membro),
    cronograma: "Implantação em 4 meses; operação assistida por mais 6 meses — dentro do teto de 12 meses da 1ª onda (projeto local).",
    formasArrecadacao: ["Venda do excedente em feira comunitária local", "Parceria com a Secretaria Municipal de Agricultura para reposição de mudas"],
    custosNaoCobertos: [{ id: id("custo"), nome: "Água (uso permanente)", valorMensalEstimado: 60, fonteCusteioFuturo: "Rodízio de captação em poço/cisterna comunitária já existente, sem conta individual" }],
    cenarios: [
      { nome: "otimista", receitaMensalEstimada: 1200, custoOperacionalMensal: 400 },
      { nome: "realista", receitaMensalEstimada: 700, custoOperacionalMensal: 400 },
      { nome: "pessimista", receitaMensalEstimada: 200, custoOperacionalMensal: 400 },
    ],
    riscos: [risco({ descricao: "Seca prolongada compromete o ciclo de irrigação", probabilidade: "medio", impacto: "alto", mitigacao: "Sistema de gotejamento de baixo consumo + captação de água de chuva" })],
    comoComunidadeAjuda: "Famílias se revezam no cuidado diário (rega, colheita, capina) e trazem sementes crioulas próprias, ampliando a variedade cultivada.",
    missaoImpacto: "Recupera o hábito de cultivo perdido com a contaminação da terra e fornece hortaliças frescas à Cozinha Comunitária (ver ecossistema).",
  });

  const reciclagem = baseProjeto({
    titulo: "Galpão de Reciclagem com Artesanato do Casa Branca",
    arquetipoId: "galpao-reciclagem-artesanato",
    danoId: "renda-trabalho",
    objetivo: "Gerar renda para famílias atingidas por meio da triagem de material reciclável e sua transformação em artesanato de maior valor agregado.",
    justificativa: "A perda de renda e trabalho é um dos danos coletivos mais reportados no diagnóstico. A cadeia de reciclagem com agregação de valor via artesanato cria um ciclo de renda duradouro, sem depender de repasse contínuo do Anexo.",
    metas: ["15 catadores/artesãos com renda mensal complementar em 12 meses", "2 toneladas de material reciclável triado por mês"],
    setorId: "pessoas-mais-pobres",
    local: "Bairro Casa Branca, Brumadinho/MG",
    abrangencia: "local",
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Adequação do galpão de triagem e produção artesanal", valor: 25000 }),
      linha({ categoria: "equipamento", descricao: "Prensa, balança industrial, bancadas, EPIs, ferramentas de artesanato", valor: 15000 }),
      linha({ categoria: "regularizacao", descricao: "Regularização ambiental e sanitária da associação de catadores", valor: 3000 }),
      linha({ categoria: "capacitacao", descricao: "Formação em triagem, segurança do trabalho e técnicas de artesanato", valor: 6000 }),
      linha({ categoria: "capital-giro-inicial", descricao: "Insumos iniciais de produção artesanal", valor: 8000, prazoMeses: 6 }),
      linha({
        categoria: "equipe-implantacao",
        descricao: "Assistência técnica e gerencial temporária de implantação",
        valor: 12000,
        prazoMeses: 6,
        fonteCusteioFuturo: "A partir do mês 7, a gestão passa à associação de catadores, sustentada pela venda de material e artesanato",
      }),
    ],
    equipe: ["12 catadores/triadores (renda por produtividade, não folha fixa)", "3 artesãos", "1 assistente técnico temporário (6 meses)"].map(membro),
    cronograma: "10 meses até operação plena — dentro do teto de 12 meses da 1ª onda (projeto local).",
    formasArrecadacao: ["Venda de material reciclável a sucateiros/indústrias regionais", "Feiras de artesanato e venda direta", "Fornecimento de matéria-prima para a Fábrica de Materiais Reciclados e a Fábrica de Tijolos Ecológicos (ver ecossistema)"],
    riscos: [risco({ descricao: "Queda no preço de mercado do material reciclável", probabilidade: "medio", impacto: "medio", mitigacao: "Diversificar para peças de artesanato de maior valor agregado, menos dependentes do preço do material bruto" })],
    comoComunidadeAjuda: "Moradores separam lixo orgânico do reciclável em casa e entregam nos pontos de coleta vinculados ao galpão.",
    missaoImpacto: "Transforma resíduo em renda e reduz o dano ambiental, virando fornecedor de matéria-prima para outros dois projetos da rede.",
  });

  const costura = baseProjeto({
    titulo: "Galpão de Costura e Estamparia de Aranha",
    arquetipoId: "galpao-costura-estamparia",
    danoId: "renda-trabalho",
    objetivo: "Gerar renda complementar para mulheres e famílias atingidas por meio da produção e venda de peças de costura e estamparia.",
    justificativa: "Reparação da perda de renda das famílias atingidas, com foco em mulheres chefes de família — grupo com cota de equidade prevista na Proposta Definitiva.",
    metas: ["12 costureiras com renda complementar em 12 meses", "Produção de 200 peças por mês"],
    setorId: "mulheres",
    local: "Comunidade de Aranha, Brumadinho/MG",
    abrangencia: "local",
    coordenacaoFeminina: true,
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Adequação do galpão/ateliê", valor: 15000 }),
      linha({ categoria: "equipamento", descricao: "Máquinas de costura industriais, mesa de corte, equipamento de estamparia", valor: 20000 }),
      linha({ categoria: "regularizacao", descricao: "Regularização documental e fiscal do coletivo produtivo", valor: 2000 }),
      linha({ categoria: "capacitacao", descricao: "Formação técnica de costura, estamparia e gestão do negócio", valor: 5000 }),
      linha({ categoria: "capital-giro-inicial", descricao: "Tecidos, linhas e insumos de estamparia iniciais", valor: 6000, prazoMeses: 6 }),
    ],
    equipe: ["12 costureiras (renda por produção)", "1 instrutor(a) de estamparia temporário (4 meses)"].map(membro),
    cronograma: "8 meses até operação plena.",
    formasArrecadacao: ["Encomendas locais e regionais", "Feiras de artesanato e economia solidária", "Parceria com o Polo de Projetos Culturais para venda em eventos (ver ecossistema)"],
    riscos: [risco({ descricao: "Sazonalidade de encomendas", probabilidade: "medio", impacto: "medio", mitigacao: "Diversificar linha de produtos (uniformes, EPIs de tecido, peças utilitárias) para reduzir dependência de encomendas sazonais" })],
    comoComunidadeAjuda: "Moradores doam retalhos e tecidos em bom estado; grupo de mulheres já organizado no bairro assume a governança inicial.",
    missaoImpacto: "Gera renda para mulheres chefes de família e fortalece o protagonismo feminino na reparação econômica.",
  });

  const materiaisReciclados = baseProjeto({
    titulo: "Fábrica Regional de Materiais de Construção Reciclados",
    arquetipoId: "fabrica-materiais-reciclados",
    danoId: "renda-trabalho",
    objetivo: "Produzir blocos e agregados de construção a partir de resíduos reciclados, gerando renda regional e reduzindo o custo de reconstrução das comunidades atingidas.",
    justificativa: "A escala regional do projeto (mais de uma comunidade da Região 3) exige POS completo e responde tanto à perda de renda quanto à necessidade de materiais de reconstrução a baixo custo nas obras do próprio Anexo I.1.",
    metas: ["25 postos de trabalho diretos em 18 meses", "Fornecimento de material para pelo menos 3 obras comunitárias do Anexo I.1 na região"],
    setorId: "pessoas-mais-pobres",
    local: "Região 3 — bacia do Paraopeba (múltiplas comunidades)",
    abrangencia: "regional",
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Adequação do galpão industrial regional", valor: 120000 }),
      linha({ categoria: "equipamento", descricao: "Britadeira, prensa de blocos, EPIs, empilhadeira manual", valor: 180000 }),
      linha({ categoria: "regularizacao", descricao: "Licenciamento ambiental e regularização operacional (cooperativa)", valor: 15000 }),
      linha({ categoria: "capacitacao", descricao: "Formação técnica de produção e segurança do trabalho", valor: 20000 }),
      linha({
        categoria: "capital-giro-inicial",
        descricao: "Insumos iniciais de produção (entulho, cimento, aditivos)",
        valor: 40000,
        prazoMeses: 6,
        fonteCusteioFuturo: "Receita de venda de blocos/agregados assume o capital de giro a partir do mês 7",
      }),
    ],
    equipe: ["25 operadores/cooperados", "1 engenheiro(a) civil consultor temporário", "1 gestor(a) administrativo temporário (6 meses)"].map(membro),
    cronograma: "18 meses até operação plena — projeto regional, 2ª onda conforme cronograma da Entidade Gestora.",
    formasArrecadacao: ["Venda de blocos e agregados a construtoras regionais", "Fornecimento prioritário para obras do próprio Anexo I.1 na Região 3", "Recebe material triado do Galpão de Reciclagem (ver ecossistema)"],
    riscos: [
      risco({ descricao: "Maquinário pesado eleva o porte e a complexidade regulatória", probabilidade: "alto", impacto: "alto", mitigacao: "Formalização antecipada como cooperativa (tipo 4.5) e licenciamento ambiental conduzido em paralelo à obra" }),
      risco({ descricao: "Concorrência de escopo com a Fábrica de Tijolos Ecológicos", probabilidade: "medio", impacto: "medio", mitigacao: "Diferenciação de produto: blocos/agregados genéricos aqui, tijolo solo-cimento específico na outra fábrica — ver nota de possível redundância no documento do ecossistema" }),
    ],
    comoComunidadeAjuda: "Moradores da região encaminham entulho de obras e resíduos de construção para triagem.",
    missaoImpacto: "Barateia a reconstrução das próprias comunidades atingidas e formaliza um mercado comprador estável para o Galpão de Reciclagem.",
    posCompleto: {
      responsavelOperacao: "Cooperativa Regional de Materiais Reciclados (a constituir formalmente antes da contratação)",
      fonteCusteioFuturoGeral: "Receita de venda de blocos e agregados a construtoras e a obras do próprio Anexo I.1 na região",
      metodologiaTransicao: "Assistência técnica e gerencial por 6 meses, com transição gradual da gestão operacional e financeira para a cooperativa formada pelos próprios trabalhadores",
      indicadoresAutonomia: "Volume mensal de vendas cobrindo 100% do custo operacional a partir do mês 9; número de clientes recorrentes; independência de decisão da cooperativa em assembleias registradas",
    },
  });

  const cozinha = baseProjeto({
    titulo: "Cozinha Comunitária do Retiro",
    arquetipoId: "cozinha-comunitaria",
    danoId: "seguranca-alimentar",
    objetivo: "Garantir acesso a refeições coletivas de qualidade para famílias atingidas, fortalecendo também os vínculos comunitários rompidos pelo desastre.",
    justificativa: "Responde diretamente à insegurança alimentar e à ruptura de vínculos comunitários identificadas no diagnóstico — a cozinha é também um espaço de convivência.",
    metas: ["150 refeições coletivas servidas por semana em 12 meses", "Responsável formal pela operação definido e treinado até o mês 6"],
    setorId: "familiares-vitimas",
    local: "Comunidade do Retiro, Brumadinho/MG",
    abrangencia: "local",
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Construção/reforma do espaço da cozinha", valor: 30000 }),
      linha({ categoria: "equipamento", descricao: "Fogões industriais, utensílios, mobiliário", valor: 20000 }),
      linha({ categoria: "regularizacao", descricao: "Regularização sanitária (vigilância sanitária municipal)", valor: 3000 }),
      linha({ categoria: "capacitacao", descricao: "Formação de operadores e da instância de governança local", valor: 4000 }),
      linha({
        categoria: "operacao-assistida",
        descricao: "Fase piloto de operação (implantação + insumos alimentares da fase piloto)",
        valor: 15000,
        prazoMeses: 6,
        fonteCusteioFuturo: "Contribuição coletiva simbólica por refeição (arranjo formal de continuidade) assume os insumos a partir do mês 7 — recebe hortaliças da Horta Comunitária (ver ecossistema)",
      }),
    ],
    equipe: ["4 cozinheiras/operadoras (rodízio remunerado por contribuição coletiva, não folha permanente do Anexo)", "1 responsável formal pela operação"].map(membro),
    cronograma: "9 meses até operação plena.",
    formasArrecadacao: ["Contribuição coletiva mensal simbólica das famílias atendidas", "Doação de hortaliças da Horta Comunitária do Parque da Cachoeira", "Parceria com a Secretaria de Assistência Social para complementação eventual"],
    custosNaoCobertos: [
      { id: id("custo"), nome: "Energia (uso permanente)", valorMensalEstimado: 400, fonteCusteioFuturo: "Contribuição coletiva mensal das famílias atendidas, formalizada em ata da instância de governança" },
    ],
    cenarios: [
      { nome: "otimista", receitaMensalEstimada: 1800, custoOperacionalMensal: 1200 },
      { nome: "realista", receitaMensalEstimada: 1200, custoOperacionalMensal: 1200 },
      { nome: "pessimista", receitaMensalEstimada: 600, custoOperacionalMensal: 1200 },
    ],
    riscos: [risco({ descricao: "Baixa adesão à contribuição coletiva", probabilidade: "medio", impacto: "alto", mitigacao: "Pactuar o valor simbólico em assembleia com as famílias antes do início da operação piloto" })],
    comoComunidadeAjuda: "Famílias se revezam no preparo e na limpeza; parte da comunidade contribui com hortaliças e insumos próprios.",
    missaoImpacto: "Recupera o convívio comunitário perdido, com a alimentação coletiva como ponto de encontro.",
  });

  const centroFormacao = baseProjeto({
    titulo: "Centro de Formação da Bacia do Paraopeba",
    arquetipoId: "centro-formacao",
    danoId: "renda-trabalho",
    objetivo: "Capacitar pessoas atingidas nas competências técnicas e de gestão necessárias para atuar nos demais projetos produtivos financiados pelo Anexo I.1.",
    justificativa: "Diversos projetos da rede (reciclagem, costura, materiais reciclados, tijolos, informática) dependem de mão de obra qualificada — um centro de formação comum evita duplicar capacitações isoladas em cada projeto.",
    metas: ["120 pessoas formadas em 12 meses", "80% dos formados inseridos em algum projeto da rede Sementeira em até 6 meses após a formação"],
    setorId: "geral",
    local: "Sede regional, Brumadinho/MG",
    abrangencia: "local",
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Adequação do espaço de formação", valor: 20000 }),
      linha({ categoria: "equipamento", descricao: "Mobiliário, material didático, equipamentos das áreas formativas", valor: 15000 }),
      linha({ categoria: "capacitacao", descricao: "Cursos, oficinas e processos formativos (gestão, produção, segurança do trabalho)", valor: 25000 }),
      linha({ categoria: "outro", descricao: "Bolsas temporárias vinculadas ao processo formativo (transporte/alimentação durante o curso)", valor: 10000, prazoMeses: 6 }),
    ],
    equipe: ["3 instrutores(as) temporários por área formativa", "1 coordenador(a) pedagógico"].map(membro),
    cronograma: "12 meses, com turmas trimestrais.",
    formasArrecadacao: ["Parceria com SENAI/SENAC para certificação", "Cobrança simbólica por turma de reciclagem profissional após a fase inicial"],
    comoComunidadeAjuda: "Pessoas já formadas em turmas anteriores atuam como monitoras voluntárias das turmas seguintes.",
    missaoImpacto: "Funciona como hub de qualificação para toda a rede de projetos produtivos — ver ecossistema.",
  });

  const poloCultural = baseProjeto({
    titulo: "Polo de Projetos Culturais da Bacia do Paraopeba",
    arquetipoId: "polo-cultural",
    danoId: "cultura-modo-vida",
    objetivo: "Recuperar e fortalecer práticas culturais e manifestações tradicionais das comunidades atingidas, criando um espaço permanente de expressão e encontro.",
    justificativa: "O rompimento impactou diretamente saberes, práticas tradicionais e modos de vida — o polo cultural é uma resposta direta a esse dano coletivo, além de reforçar os vínculos comunitários.",
    metas: ["6 grupos culturais atuando regularmente no polo em 12 meses", "4 eventos/festivais comunitários realizados no primeiro ano"],
    setorId: "pct",
    local: "Casa de Cultura Regional, Brumadinho/MG",
    abrangencia: "local",
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Adequação do espaço cultural/casa de cultura", valor: 25000 }),
      linha({ categoria: "equipamento", descricao: "Instrumentos, som, figurinos, materiais de manifestações culturais", valor: 18000 }),
      linha({ categoria: "capacitacao", descricao: "Oficinas de formação cultural e de gestão de coletivos", valor: 8000 }),
      linha({
        categoria: "operacao-assistida",
        descricao: "Fase inicial de atividades culturais regulares",
        valor: 10000,
        prazoMeses: 6,
        fonteCusteioFuturo: "Editais de fomento cultural e patrocínio local assumem a partir do mês 7",
      }),
    ],
    equipe: ["1 gestor(a) cultural temporário", "Grupos culturais autogeridos (sem folha permanente)"].map(membro),
    cronograma: "8 meses até operação plena.",
    formasArrecadacao: ["Editais municipais/estaduais de fomento cultural", "Bilheteria simbólica em eventos", "Vitrine de venda das peças do Galpão de Costura e Estamparia em feiras culturais (ver ecossistema)"],
    comoComunidadeAjuda: "Grupos culturais já existentes na região cedem tempo voluntário para oficinas e curadoria dos eventos.",
    missaoImpacto: "Fortalece a identidade cultural das comunidades atingidas e vira vitrine de divulgação para os produtos dos demais projetos.",
  });

  const tijolos = baseProjeto({
    titulo: "Fábrica Regional de Tijolos Ecológicos",
    arquetipoId: "fabrica-tijolos-ecologicos",
    danoId: "meio-ambiente",
    objetivo: "Produzir tijolos ecológicos de solo-cimento a partir de resíduos da própria região, reduzindo o dano ambiental e gerando renda.",
    justificativa: "Resposta ao dano ambiental direto (contaminação de solo) combinada à perda de renda — produção de material sustentável para reconstrução das comunidades atingidas.",
    metas: ["18 postos de trabalho em 18 meses", "10.000 tijolos ecológicos produzidos por mês em regime pleno"],
    setorId: "pessoas-mais-pobres",
    local: "Região 3 — bacia do Paraopeba (múltiplas comunidades)",
    abrangencia: "regional",
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Adequação do galpão de produção", valor: 90000 }),
      linha({ categoria: "equipamento", descricao: "Prensa hidráulica de tijolos, misturador, EPIs", valor: 140000 }),
      linha({ categoria: "regularizacao", descricao: "Regularização operacional e ambiental", valor: 12000 }),
      linha({ categoria: "capacitacao", descricao: "Formação técnica de produção e controle de qualidade", valor: 15000 }),
      linha({
        categoria: "capital-giro-inicial",
        descricao: "Insumos iniciais (cimento, solo, aditivos)",
        valor: 30000,
        prazoMeses: 6,
        fonteCusteioFuturo: "Venda dos tijolos para obras locais e da própria reconstrução das comunidades assume a partir do mês 7",
      }),
    ],
    equipe: ["18 operadores/cooperados", "1 técnico(a) de qualidade temporário"].map(membro),
    cronograma: "18 meses até operação plena — projeto regional, 2ª onda conforme cronograma da Entidade Gestora.",
    formasArrecadacao: ["Venda a construtoras e obras de reconstrução do Anexo I.1", "Recebe parte do resíduo triado do Galpão de Reciclagem (ver ecossistema)"],
    riscos: [risco({ descricao: "Sobreposição de mercado com a Fábrica de Materiais Reciclados", probabilidade: "medio", impacto: "medio", mitigacao: "Diferenciar o produto (tijolo estrutural solo-cimento vs. blocos/agregados) e coordenar comercialização conjunta via o documento do ecossistema" })],
    comoComunidadeAjuda: "Moradores da região encaminham entulho e resíduos de construção compatíveis para a produção.",
    missaoImpacto: "Oferece material de construção de baixo custo e sustentável para as próprias obras de reconstrução da bacia.",
    posCompleto: {
      responsavelOperacao: "Cooperativa Regional de Tijolos Ecológicos (a constituir formalmente antes da contratação)",
      fonteCusteioFuturoGeral: "Receita de venda dos tijolos a construtoras e a obras do próprio Anexo I.1 na região",
      metodologiaTransicao: "Assistência técnica por 6 meses, com transição da gestão operacional para a cooperativa formada pelos trabalhadores",
      indicadoresAutonomia: "Volume mensal de vendas cobrindo 100% do custo operacional a partir do mês 9; nº de obras atendidas na região",
    },
  });

  const informatica = baseProjeto({
    titulo: "Projeto de Informática — Capacitação Digital da Bacia",
    arquetipoId: "informatica-capacitacao",
    danoId: "renda-trabalho",
    objetivo: "Capacitar pessoas atingidas em informática básica e avançada, incluindo gestão administrativa e financeira, ampliando oportunidades de renda e apoiando a gestão dos demais projetos da rede.",
    justificativa: "A inclusão digital amplia o acesso a oportunidades de renda e é pré-requisito para funções administrativas (emissão de nota fiscal, controle financeiro) dos demais projetos produtivos financiados pelo Anexo I.1.",
    metas: ["80 pessoas formadas em informática básica/avançada em 12 meses", "1 pessoa capacitada em gestão administrativa alocada em cada projeto produtivo da rede"],
    setorId: "geral",
    local: "Escola Municipal Regional, Brumadinho/MG",
    abrangencia: "local",
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Adequação da sala/laboratório de informática", valor: 10000 }),
      linha({ categoria: "equipamento", descricao: "Computadores, roteador, mobiliário", valor: 35000 }),
      linha({
        categoria: "capacitacao",
        descricao: "Cursos de informática básica/avançada e formação de instrutores",
        valor: 12000,
        prazoMeses: 6,
        fonteCusteioFuturo: "Parceria com escola pública para uso continuado do laboratório, sem custeio permanente de pessoal pelo Anexo",
      }),
    ],
    equipe: ["2 instrutores(as) temporários (6 meses)"].map(membro),
    cronograma: "6 meses de formação intensiva, turmas mensais.",
    formasArrecadacao: ["Parceria com a escola pública/biblioteca municipal para uso continuado do laboratório"],
    comoComunidadeAjuda: "Jovens já com conhecimento básico atuam como monitores voluntários das turmas iniciantes.",
    missaoImpacto: "Forma a mão de obra administrativa que sustenta a gestão financeira/fiscal dos demais projetos da rede — ver ecossistema.",
  });

  const plantioMadeira = baseProjeto({
    titulo: "Plantio de Madeira para Venda — Ciclo Sustentável",
    arquetipoId: "plantio-madeira-venda",
    danoId: "renda-trabalho",
    objetivo: "Gerar renda futura para famílias atingidas por meio do plantio e manejo sustentável de espécies florestais destinadas à venda de madeira.",
    justificativa: "Responde à perda de renda de famílias com acesso a terra, propondo um ativo produtivo de médio/longo prazo alinhado à recuperação ambiental da bacia (também mitiga o dano ambiental).",
    metas: ["8 hectares plantados em 12 meses", "Manejo florestal sustentável certificado até o mês 24"],
    setorId: "pessoas-mais-pobres",
    local: "Área rural da comunidade de Suzana, Brumadinho/MG",
    abrangencia: "local",
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Preparo de área e cercamento", valor: 20000 }),
      linha({ categoria: "equipamento", descricao: "Ferramentas de plantio e manejo florestal", valor: 8000 }),
      linha({ categoria: "capacitacao", descricao: "Formação técnica em manejo florestal sustentável", valor: 6000 }),
      linha({ categoria: "insumos-iniciais", descricao: "Mudas e insumos do plantio inicial", valor: 12000, prazoMeses: 6 }),
      linha({
        categoria: "capital-giro-inicial",
        descricao: "Manutenção do plantio até o primeiro ciclo de corte comercial",
        valor: 25000,
        prazoMeses: 60,
        justificativaCicloProdutivo:
          "O ciclo produtivo de espécies florestais para corte comercial leva entre 5 e 7 anos — muito além do teto preferencial de 6 meses do Ofício 46, item 4.1 §1º. A manutenção do plantio (limpeza, poda, controle fitossanitário) é indispensável durante todo esse período para viabilizar a colheita futura, sendo tecnicamente inseparável do ciclo produtivo da cultura.",
      }),
    ],
    equipe: ["Famílias proprietárias/manejadoras da área (renda futura na venda, sem folha permanente)", "1 engenheiro(a) florestal consultor (visitas periódicas)"].map(membro),
    cronograma: "Plantio nos primeiros 12 meses (1ª onda); manejo e manutenção seguem em fluxo de caixa plurianual detalhado no POS, com colheita comercial estimada a partir do ano 5-6.",
    formasArrecadacao: ["Venda da madeira em pé ou beneficiada no momento do corte", "Possível fornecimento futuro de matéria-prima para projetos de marcenaria/construção da rede"],
    riscos: [
      risco({ descricao: "Incêndio florestal ou praga comprometer o plantio antes do corte", probabilidade: "medio", impacto: "alto", mitigacao: "Aceiros, monitoramento periódico e seguro agrícola quando disponível" }),
      risco({ descricao: "Fluxo de caixa de 5+ anos sem receita intermediária", probabilidade: "alto", impacto: "medio", mitigacao: "Consórcio com culturas de ciclo curto (ex. horta) nas entrelinhas durante os primeiros anos, gerando renda intermediária" }),
    ],
    comoComunidadeAjuda: "Famílias proprietárias da terra cedem a área e participam do manejo periódico (limpeza, aceiros).",
    missaoImpacto: "Cria um ativo de renda de longo prazo, alinhado à recuperação ambiental da bacia, mesmo sem retorno imediato.",
  });

  const abrigoAnimais = baseProjeto({
    titulo: "Abrigo de Animais com Banho e Tosa da Bacia",
    arquetipoId: "abrigo-animais-banho-tosa",
    danoId: "saude-fisica-mental",
    objetivo: "Acolher animais domésticos perdidos, feridos ou abandonados no rompimento e oferecer serviço de banho e tosa acessível às famílias atingidas, gerando renda e bem-estar animal e humano.",
    justificativa: "O diagnóstico de danos registra sofrimento psicológico ligado à perda de animais de estimação no desastre. Um abrigo com serviço de banho e tosa recupera o vínculo com os animais remanescentes e cria uma fonte de renda e ocupação para a comunidade.",
    metas: ["40 animais abrigados/atendidos em 12 meses", "Serviço de banho e tosa disponível a preço social para 100 famílias/ano"],
    setorId: "pessoas-mais-pobres",
    local: "Comunidade de Parauninha, Brumadinho/MG",
    abrangencia: "local",
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Construção de baias, canis e área de banho e tosa com isolamento sanitário", valor: 35000 }),
      linha({ categoria: "equipamento", descricao: "Tosquiadeiras, secadores, mesa de banho/tosa, gaiolas de contenção", valor: 12000 }),
      linha({ categoria: "regularizacao", descricao: "Licença sanitária/ambiental junto à vigilância municipal", valor: 2500 }),
      linha({ categoria: "capacitacao", descricao: "Formação em manejo/bem-estar animal, banho e tosa e protocolo sanitário", valor: 5000 }),
      linha({ categoria: "capital-giro-inicial", descricao: "Ração, medicamentos e insumos veterinários iniciais", valor: 9000, prazoMeses: 6 }),
      linha({
        categoria: "equipe-implantacao",
        descricao: "Assistência técnica veterinária de implantação (protocolo sanitário, castração)",
        valor: 8000,
        prazoMeses: 6,
        fonteCusteioFuturo: "A partir do mês 7, a manutenção veterinária básica é sustentada pela receita do serviço de banho e tosa e por parcerias com clínicas locais",
      }),
    ],
    equipe: ["2 tratadores(as) formados em bem-estar animal", "1 veterinário(a) parceiro em regime de visitas periódicas (não folha fixa)"].map(membro),
    cronograma: "10 meses até operação plena — dentro do teto de 12 meses da 1ª onda (projeto local).",
    formasArrecadacao: ["Cobrança social pelo serviço de banho e tosa", "Campanhas de adoção com taxa simbólica", "Parcerias com clínicas veterinárias e ONGs de proteção animal"],
    custosNaoCobertos: [{ id: id("custo"), nome: "Água e energia do abrigo (uso permanente)", valorMensalEstimado: 220, fonteCusteioFuturo: "Parte da receita do serviço de banho e tosa é destinada a essas contas" }],
    cenarios: [
      { nome: "otimista", receitaMensalEstimada: 1800, custoOperacionalMensal: 1300 },
      { nome: "realista", receitaMensalEstimada: 1100, custoOperacionalMensal: 1300 },
      { nome: "pessimista", receitaMensalEstimada: 500, custoOperacionalMensal: 1300 },
    ],
    riscos: [
      risco({ descricao: "Surto de doença entre os animais abrigados", probabilidade: "medio", impacto: "alto", mitigacao: "Protocolo de quarentena e isolamento sanitário na entrada de novos animais" }),
      risco({ descricao: "Demanda de banho e tosa abaixo do esperado para cobrir custos", probabilidade: "medio", impacto: "medio", mitigacao: "Tabela de preço social escalonada e parceria com o comércio local para divulgação" }),
    ],
    comoComunidadeAjuda: "Famílias voluntárias revezam-se no cuidado diário dos animais e ajudam a divulgar o serviço de banho e tosa no bairro.",
    missaoImpacto: "Cuida de quem cuidou das famílias atingidas — recupera o vínculo com os animais de estimação perdidos ou machucados no desastre, ao mesmo tempo em que gera renda e ocupação.",
    espacoLogistica: { areaM2: 400, tipoEspaco: "Galpão coberto + área externa cercada", acesso: "estrada-terra", distanciaFornecedoresKm: 18 },
  });

  const tanquePeixes = baseProjeto({
    titulo: "Tanque de Peixes do Retiro (Piscicultura Comunitária)",
    arquetipoId: "tanque-peixes",
    danoId: "seguranca-alimentar",
    objetivo: "Recuperar a produção própria de proteína animal perdida com a contaminação do rio Paraopeba, por meio da criação comunitária de peixes em tanques controlados.",
    justificativa: "O rompimento contaminou o principal recurso hídrico da região, impedindo a pesca tradicional que era fonte de alimento e renda. A piscicultura em tanques controlados recupera essa fonte de proteína de forma segura e monitorada.",
    metas: ["3 toneladas de peixe produzidas por ciclo em 12 meses", "25 famílias com acesso a peixe a preço acessível ou complementar à própria produção"],
    setorId: "pessoas-mais-pobres",
    local: "Comunidade do Retiro, Brumadinho/MG",
    abrangencia: "local",
    orcamento: [
      linha({ categoria: "infraestrutura", descricao: "Construção e impermeabilização de tanques de piscicultura", valor: 40000 }),
      linha({ categoria: "equipamento", descricao: "Aeradores, bombas, redes de manejo, balanças", valor: 14000 }),
      linha({ categoria: "regularizacao", descricao: "Outorga de uso da água e licença ambiental (uso de recurso hídrico monitorado dada a contaminação da bacia)", valor: 4000 }),
      linha({ categoria: "capacitacao", descricao: "Formação técnica em manejo de piscicultura e qualidade da água", valor: 5000 }),
      linha({ categoria: "insumos-iniciais", descricao: "Alevinos e ração do primeiro ciclo de engorda", valor: 10000, prazoMeses: 6 }),
      linha({
        categoria: "capital-giro-inicial",
        descricao: "Ração até o primeiro despesque comercial",
        valor: 15000,
        prazoMeses: 8,
        justificativaCicloProdutivo: "O ciclo de engorda de tilápia até o primeiro despesque leva entre 6 e 8 meses — ligeiramente além do teto preferencial de 6 meses do Ofício 46, item 4.1 §1º, mas inseparável do ciclo produtivo da criação.",
      }),
    ],
    equipe: ["3 manejadores(as) formados em piscicultura (renda por produtividade)", "1 técnico(a) em aquicultura consultor periódico"].map(membro),
    cronograma: "10 meses até o primeiro despesque comercial — dentro do teto de 12 meses da 1ª onda (projeto local).",
    formasArrecadacao: ["Venda direta dos peixes à comunidade e ao comércio local", "Fornecimento de peixe para a Cozinha Comunitária do Retiro (ver ecossistema)", "Possível pesque-pague comunitário nos fins de semana"],
    custosNaoCobertos: [{ id: id("custo"), nome: "Energia dos aeradores (uso permanente)", valorMensalEstimado: 180, fonteCusteioFuturo: "Coberta pela receita da venda de peixe a partir do primeiro despesque" }],
    cenarios: [
      { nome: "otimista", receitaMensalEstimada: 2400, custoOperacionalMensal: 1500 },
      { nome: "realista", receitaMensalEstimada: 1600, custoOperacionalMensal: 1500 },
      { nome: "pessimista", receitaMensalEstimada: 700, custoOperacionalMensal: 1500 },
    ],
    riscos: [
      risco({ descricao: "Mortalidade de peixes por qualidade da água ou doença", probabilidade: "medio", impacto: "alto", mitigacao: "Monitoramento periódico da água e protocolo de manejo sanitário" }),
      risco({ descricao: "Ciclo produtivo sazonal gera receita irregular ao longo do ano", probabilidade: "alto", impacto: "medio", mitigacao: "Escalonar os tanques em ciclos defasados para gerar despesque em meses diferentes" }),
    ],
    comoComunidadeAjuda: "Famílias se revezam na alimentação e monitoramento diário dos tanques, e ajudam na despesca nos dias de colheita.",
    missaoImpacto: "Recupera, de forma segura e monitorada, a proteína animal que a comunidade perdeu com a contaminação do rio — sem depender da pesca no rio contaminado.",
    espacoLogistica: { areaM2: 600, tipoEspaco: "Área aberta com acesso a recurso hídrico monitorado", acesso: "estrada-terra", distanciaFornecedoresKm: 12 },
  });

  return [horta, reciclagem, costura, materiaisReciclados, cozinha, centroFormacao, poloCultural, tijolos, informatica, plantioMadeira, abrigoAnimais, tanquePeixes];
}

/**
 * Análise de ecossistema escrita a mão (não gerada por IA em tempo real) —
 * documenta as conexões já desenhadas entre os 10 projetos acima. O botão
 * "Analisar ecossistema com IA" na tela Ecossistema pode reproduzir/atualizar
 * isso automaticamente depois que os projetos estiverem importados.
 */
export const ANALISE_ECOSSISTEMA_SEED = {
  complementaridades: [
    "Horta Comunitária → Cozinha Comunitária: hortaliças produzidas na horta abastecem a cozinha, reduzindo o custo de insumos alimentares que seria vedado como custeio permanente.",
    "Galpão de Reciclagem com Artesanato → Fábrica de Materiais de Construção Reciclados e Fábrica de Tijolos Ecológicos: material triado no galpão vira matéria-prima para as duas fábricas regionais.",
    "Centro de Formação → todos os projetos produtivos: forma a mão de obra técnica (produção, segurança do trabalho, gestão) usada por reciclagem, costura, materiais reciclados, tijolos e informática.",
    "Projeto de Informática → todos os projetos produtivos: forma a mão de obra administrativa (emissão de nota, controle financeiro) que sustenta a gestão fiscal dos demais.",
    "Polo de Projetos Culturais ↔ Galpão de Costura e Estamparia: o polo vira vitrine de venda das peças de costura em feiras e eventos culturais.",
    "Fábrica de Materiais Reciclados / Fábrica de Tijolos Ecológicos → obras do próprio Anexo I.1: as duas fábricas regionais viram fornecedoras prioritárias de material para a reconstrução das comunidades atingidas.",
    "Tanque de Peixes do Retiro → Cozinha Comunitária do Retiro: peixe produzido no tanque abastece a cozinha, reduzindo custo de insumo proteico que seria vedado como custeio permanente.",
    "Abrigo de Animais com Banho e Tosa ↔ Centro de Formação: pode receber formação técnica complementar em gestão/administração do Centro de Formação, e oferecer vagas de capacitação em manejo animal para outros projetos que lidem com criação de animais.",
  ],
  redundancias: [
    "Fábrica de Materiais de Construção Reciclados e Fábrica de Tijolos Ecológicos atendem mercado semelhante (construção civil regional) — risco de concorrência entre si por clientes/obras. Recomendação: diferenciar produto (blocos/agregados genéricos vs. tijolo estrutural solo-cimento) e coordenar comercialização conjunta em vez de disputar os mesmos contratos.",
  ],
  mercadosCompradores: [
    "Galpão de Reciclagem com Artesanato é fornecedor regular da Fábrica de Materiais Reciclados e da Fábrica de Tijolos Ecológicos — atende ao requisito de 'mercado comprador' citado no Ofício 46, item 4.1 §4º.",
    "Fábrica de Materiais Reciclados e Fábrica de Tijolos Ecológicos têm nas próprias obras de reconstrução do Anexo I.1 um comprador previsível de médio prazo.",
    "Plantio de Madeira pra Venda pode, no médio/longo prazo, virar fornecedor de matéria-prima para futuros projetos de marcenaria/construção em madeira da rede.",
  ],
};
