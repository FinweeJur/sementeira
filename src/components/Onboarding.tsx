import { useState } from "react";

const TELAS = [
  {
    titulo: "O que é a Sementeira",
    texto: [
      "A Sementeira é um programa para computador com Windows. Funciona sem internet.",
      "Ela ajuda você, pessoa atingida pelo rompimento da barragem de Brumadinho, a transformar uma ideia em um projeto pronto para levar à Governança Popular.",
      "",
      "Ela não substitui a assembleia, a Comissão de Atingidos nem a Governança. Ela só prepara o material antes disso.",
    ].join("\n"),
  },
  {
    titulo: "Do dano ao documento",
    texto: [
      "1) Você conta qual dano quer reparar. A Sementeira sugere o tipo de projeto mais próximo.",
      "2) A IA ajuda a preencher objetivo, justificativa, metas, orçamento e equipe. Você revisa tudo.",
      "3) O programa confere as regras na hora. Se algo não pode — como pagar salário para sempre sem dizer de onde vem o dinheiro depois —, ele avisa.",
      "4) Você simula se o projeto se sustenta sozinho depois que o dinheiro do repasse acabar.",
      "5) Exporta tudo pronto em PDF, DOCX ou XLSX.",
    ].join("\n"),
  },
  {
    titulo: "A IA trabalha pra você",
    texto: [
      "🪄 Copiloto — fica dentro do projeto, faz perguntas, sugere melhorias e gera rascunhos a partir da sua ideia.",
      "🔁 Ciclo de Lapidação — seis ajudantes de IA revisam o projeto, um de cada vez, e você aprova cada mudança. Nada é aplicado sem você dizer sim, e tudo pode voltar atrás.",
      "🛡 Revisão independente — um segundo agente de IA confere se o projeto segue as regras do acordo e mostra onde os dois discordam.",
    ].join("\n"),
  },
  {
    titulo: "Visão geral dos projetos",
    texto: [
      "🌐 Ecossistema de projetos — mapa da região com os ~26 municípios da bacia do Paraopeba, e como os projetos podem se ajudar (um compra do outro, por exemplo).",
      "⚖ Comparação lado a lado — compare até 3 projetos ao mesmo tempo pra ver o que se repete ou o que falta.",
      "🎟 Clube de benefícios — liga o que cada projeto produz às famílias atingidas.",
      "🙋 Voluntários — cadastro de pessoas disponíveis pra mutirão, ligadas aos projetos de interesse.",
      "🤖 Copiloto de projetos — converse por texto pra lapidar, exportar ou saber a situação de qualquer projeto.",
    ].join("\n"),
  },
  {
    titulo: "Configure sua IA",
    texto: [
      "A Sementeira funciona sem internet: formulário, conferência de regras e simulações rodam no seu computador. Só a IA e a pesquisa precisam de configuração.",
      "",
      "• Provedor de IA — DeepSeek, Maritaca/Sabiá ou Ollama no seu computador (os modelos aparecem sozinhos, sem lista fixa).",
      "• Pesquisa na internet (Tavily) — busca dados públicos, preços de mercado e editais pra embasar o projeto. Só cita o que realmente encontrou.",
      "",
      "Sem configurar a IA, o app continua funcionando — só os recursos de inteligência artificial ficam desligados até você configurar.",
    ].join("\n"),
  },
  {
    titulo: "Vamos começar",
    texto: [
      "Você pode criar um projeto do zero ou importar um projeto já escrito em PDF ou DOCX — a Sementeira lê o documento e preenche os campos sozinha.",
      "",
      "Você pode rever este tutorial quando quiser, pelo botão no rodapé da tela inicial.",
    ].join("\n"),
  },
];

export function Onboarding({ onConcluir }: { onConcluir: (comecarProjeto: boolean) => void }) {
  const [passo, setPasso] = useState(0);
  const tela = TELAS[passo];
  const ultimo = passo === TELAS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-6 space-y-4">
        <div className="flex gap-1">
          {TELAS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full sm-fade"
              style={{ background: i <= passo ? "var(--sm-accent)" : "var(--sm-border)" }}
            />
          ))}
        </div>
        <span className="sm-selo-ico" aria-hidden="true">
          <span className="sm-ico">h</span>
        </span>
        <h2 className="text-lg font-semibold">{tela.titulo}</h2>
        <p className="text-sm text-[color:var(--sm-text-dim)] whitespace-pre-wrap">{tela.texto}</p>
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => onConcluir(false)} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            Pular tutorial
          </button>
          <button
            onClick={() => (ultimo ? onConcluir(true) : setPasso(passo + 1))}
            className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-4 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/30"
          >
            {ultimo ? "🌱 Começar meu primeiro projeto" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
