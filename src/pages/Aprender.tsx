import { useState } from "react";
import type { PassoWizard, Project } from "../lib/types";
import { CabecalhoSecao } from "../components/CabecalhoSecao";
import { ChevronDown, ChevronRight, Sprout } from "lucide-react";

interface Modulo {
  id: string;
  titulo: string;
  texto: string;
  /** Passo do wizard a que este módulo corresponde — habilita o botão "praticar agora". */
  passoId?: PassoWizard;
}

const MODULOS: Modulo[] = [
  {
    id: "por-que",
    titulo: "1. Por que a Sementeira existe",
    texto:
      'A luta é por reparação integral. A Sementeira ajuda a escrever, em linguagem técnica, o que a comunidade já sabe que precisa — mas ela não decide nada sozinha: quem decide um projeto de verdade é a Governança Popular, as Comissões de Atingidos e a assembleia. O app só prepara o material antes disso.',
  },
  {
    id: "dano-projeto",
    titulo: "2. Do dano ao projeto",
    texto:
      'Todo projeto parte de um dano coletivo — não de um título bonito. Primeiro você escolhe qual dano quer reparar (perda de renda, insegurança alimentar, ruptura de vínculos...), depois o tipo de projeto (arquétipo) que melhor resolve esse dano, e só então preenche a identificação (local, abrangência).',
    passoId: "dano-arquetipo",
  },
  {
    id: "objetivo-publico",
    titulo: "3. Objetivo, metas e público",
    texto:
      "Objetivo geral, objetivos específicos mensuráveis e metas viram os indicadores que a Governança vai cobrar depois. No público, lembre da cota de equidade: no mínimo 30% dos recursos precisam alcançar pessoas mais pobres, Povos e Comunidades Tradicionais, mulheres, familiares de vítimas fatais, ou moradores da Zona Quente.",
    passoId: "publico",
  },
  {
    id: "orcamento-vedacoes",
    titulo: "4. Orçamento sem cair nas vedações",
    texto:
      "O erro mais comum: pedir folha de pagamento permanente sem dizer de onde vem o dinheiro depois que o Anexo acaba — isso é proibido (Vedação Geral III). Capital de giro e insumos iniciais só valem por até 6 meses, salvo justificativa técnica ligada ao ciclo produtivo do seu projeto.",
    passoId: "orcamento",
  },
  {
    id: "sustentabilidade",
    titulo: '5. Sustentabilidade — o "dia seguinte"',
    texto:
      "O Plano Obrigatório de Sustentabilidade (POS) exige mostrar como o projeto se sustenta sozinho depois que o repasse acaba. O simulador de cenários (otimista/realista/pessimista) é onde você testa isso antes de qualquer Governança perguntar.",
    passoId: "simulador",
  },
  {
    id: "riscos-equipe",
    titulo: "6. Riscos e equipe mínima",
    texto:
      "Citar uma dificuldade na matriz de riscos não dispensa cumprir metas e prazos — o risco serve pra planejar a mitigação, não pra justificar atraso. Todo projeto continuado precisa de pelo menos 2 pessoas na equipe, com dedicação e período definidos.",
    passoId: "riscos",
  },
  {
    id: "usando-ia",
    titulo: "7. Usando a IA",
    texto:
      'O Copiloto (Dona Lúcia) conversa com você dentro de um projeto, tira dúvidas e gera um rascunho inicial. O botão "Lapidar" roda 6 agentes especialistas em sequência pra revisar o projeto inteiro — você aprova cada mudança. A Revisão independente é um segundo agente de IA que confere se o projeto segue as regras, separado do motor determinístico (que é sempre a palavra final).',
  },
  {
    id: "governanca",
    titulo: "8. Do rascunho à Governança",
    texto:
      "Antes de exportar, confira o checklist final — ele resume o que falta frente ao Ofício 46 e à Proposta Definitiva. Exporte em PDF, DOCX ou XLSX e leve para a Comissão de Atingidos e a assembleia: a decisão final é sempre da comunidade.",
    passoId: "revisao",
  },
];

export function Aprender({
  projects,
  onVoltar,
  onPraticar,
  onCriarProjeto,
}: {
  projects: Project[];
  onVoltar: () => void;
  onPraticar: (projectId: string, passoId: PassoWizard) => void;
  onCriarProjeto: () => void;
}) {
  const [aberto, setAberto] = useState<string | null>(MODULOS[0].id);

  function praticar(passoId: PassoWizard) {
    const alvo = projects[0];
    if (alvo) onPraticar(alvo.id, passoId);
    else onCriarProjeto();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <button onClick={onVoltar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
        ← Meus projetos
      </button>

      <CabecalhoSecao
        icone="t"
        olho="Currículo"
        titulo="Aprender"
        apoio="Passo a passo de como montar um projeto na Sementeira, do dano à entrega pra Governança — cada módulo corresponde a um trecho do formulário."
      />

      <div className="space-y-2">
        {MODULOS.map((m) => {
          const expandido = aberto === m.id;
          return (
            <div key={m.id} className="rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)]">
              <button
                onClick={() => setAberto(expandido ? null : m.id)}
                className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium"
              >
                {m.titulo}
                {expandido ? <ChevronDown size={16} strokeWidth={2} className="shrink-0" /> : <ChevronRight size={16} strokeWidth={2} className="shrink-0" />}
              </button>
              {expandido && (
                <div className="space-y-2 border-t border-[color:var(--sm-border)] p-3 text-sm text-[color:var(--sm-text-dim)]">
                  <p>{m.texto}</p>
                  {m.passoId && (
                    <button
                      onClick={() => praticar(m.passoId!)}
                      className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-2.5 py-1 text-xs hover:bg-[color:var(--sm-accent)]/25"
                    >
                      <Sprout size={12} strokeWidth={2} />
                      {projects.length > 0 ? "Praticar agora" : "Criar meu primeiro projeto"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
