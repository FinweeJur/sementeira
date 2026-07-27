import type { PassoWizard } from "./types";

export interface DicaContextual {
  id: string;
  texto: string;
  /** Item da Biblioteca a que a dica se refere — usado pro link "ver na Biblioteca". */
  documento: "proposta-definitiva" | "oficio-46";
}

/**
 * Dica por etapa do wizard — conteúdo extraído das mesmas regras já
 * codificadas em compliance-engine.ts/revisao-agente.ts (ver
 * documentos-base.ts), nunca inventado. Etapas sem entrada aqui não mostram
 * dica (ideia, identificação, espaço/logística, dados opcionais) — não tem
 * regra do Ofício/Proposta especificamente ligada a elas.
 */
export const DICAS_POR_PASSO: Partial<Record<PassoWizard, DicaContextual>> = {
  "dano-arquetipo": {
    id: "dano-arquetipo",
    texto: 'Meta #1 da Proposta Definitiva: todo projeto tem que estar vinculado a um dano coletivo priorizado — não dá pra partir só do título.',
    documento: "proposta-definitiva",
  },
  publico: {
    id: "publico",
    texto: "Cota de equidade da Proposta Definitiva: no mínimo 30% dos recursos precisam alcançar pessoas mais pobres, Povos e Comunidades Tradicionais, mulheres, familiares de vítimas fatais ou moradores da Zona Quente.",
    documento: "proposta-definitiva",
  },
  orcamento: {
    id: "orcamento",
    texto: "Vedação Geral III do Ofício 46: folha de pagamento permanente é proibida sem fonte de custeio futuro autônoma, coletiva ou pública. Capital de giro e insumos iniciais só até 6 meses, salvo justificativa técnica ligada ao ciclo produtivo.",
    documento: "oficio-46",
  },
  equipe: {
    id: "equipe",
    texto: "Equipe de implantação e operação assistida: até 6 meses de custeio pelo Anexo (item 4.1 §1º/§3º do Ofício 46), salvo justificativa técnica.",
    documento: "oficio-46",
  },
  arrecadacao: {
    id: "arrecadacao",
    texto: "Item 4.2 do Ofício 46: contas de água, energia, telefone ou internet individual e alimentação diária não podem ser custeadas de forma permanente, exceto com arranjo formal de continuidade.",
    documento: "oficio-46",
  },
  simulador: {
    id: "simulador",
    texto: 'O Plano Obrigatório de Sustentabilidade (POS, item 1 do Ofício 46) exige mostrar como o projeto se sustenta sozinho depois que o repasse acaba — é por isso que este simulador existe.',
    documento: "oficio-46",
  },
  riscos: {
    id: "riscos",
    texto: "Ofício 45: citar uma dificuldade na matriz de riscos não dispensa cumprir as metas e os prazos do projeto.",
    documento: "oficio-46",
  },
  revisao: {
    id: "revisao",
    texto: "Antes de exportar, vale reler o checklist: ele resume as pendências frente ao Ofício 46 e à Proposta Definitiva.",
    documento: "oficio-46",
  },
};

/** Dica genérica pra telas fora do wizard (portfólio, Biblioteca etc.) — roda em rotação simples por data, sem precisar de estado extra. */
export const DICAS_GERAIS: DicaContextual[] = [
  {
    id: "geral-reparacao-integral",
    texto: 'A luta é por reparação integral: a Sementeira ajuda a escrever, em linguagem técnica, o que a comunidade já sabe que precisa.',
    documento: "proposta-definitiva",
  },
  {
    id: "geral-nao-substitui",
    texto: "A Sementeira não decide nada sozinha — quem decide é a Governança Popular, as Comissões de Atingidos e a assembleia.",
    documento: "oficio-46",
  },
];
