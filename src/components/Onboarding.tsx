import { useState } from "react";

const TELAS = [
  {
    titulo: "O que é a Sementeira",
    texto: [
      "A Sementeira é um aplicativo de computador (Windows, funciona sem internet) que ajuda você, pessoa atingida pelo rompimento da barragem de Brumadinho, a transformar uma ideia em um projeto comunitário completo — pronto para levar à Governança Popular.",
      "",
      "Ela não substitui as assembleias, as Comissões de Atingidos nem a Governança. É a ferramenta que prepara o material antes disso.",
    ].join("\n"),
  },
  {
    titulo: "Do dano ao documento",
    texto: [
      "1) Você conta qual dano quer reparar e a app sugere o tipo de projeto mais próximo.",
      "2) A IA ajuda a preencher objetivo, justificativa, metas, orçamento e equipe — sempre revisável.",
      "3) Um motor de conformidade avisa na hora o que é vedado pelo Ofício 46 (folha permanente sem fonte futura, contas de consumo, etc.).",
      "4) Você simula se o projeto se sustenta sozinho depois que o dinheiro acabar (Plano Obrigatório de Sustentabilidade).",
      "5) Exporta tudo pronto em PDF, DOCX ou XLSX.",
    ].join("\n"),
  },
  {
    titulo: "A IA trabalha pra você",
    texto: [
      "🪄 Copiloto dentro do projeto — faz perguntas, sugere melhorias e gera rascunhos completos a partir da sua ideia.",
      "🔁 Ciclo de Lapidação — seis agentes especializados (escritor, orçamentista, crítico, analista de risco, sugestor, compilador) refinam seu projeto em uma versão melhorada. Nada é aplicado sem sua aprovação, e tudo pode ser revertido.",
      "🛡 Revisão independente — um segundo agente de IA confere se o projeto está adequado às regras dos Ofícios 45 e 46, apontando divergências.",
    ].join("\n"),
  },
  {
    titulo: "Visão de portfólio",
    texto: [
      "🌐 Ecossistema de projetos — mapa da região com os ~26 municípios da bacia do Paraopeba, análise de complementaridades e economia circular entre projetos.",
      "⚖ Comparação lado a lado — compare até 3 projetos simultaneamente para identificar sobreposições ou lacunas.",
      "🎟 Clube de benefícios — programa que conecta os produtos de cada projeto às famílias atingidas.",
      "🙋 Voluntários — cadastro de pessoas disponíveis para mutirões, vinculadas aos projetos de interesse.",
      "🤖 Copiloto de portfólio — converse por texto para lapidar, exportar ou consultar o status de qualquer projeto.",
    ].join("\n"),
  },
  {
    titulo: "Configure sua IA",
    texto: [
      "A Sementeira funciona sem internet — formulário, motor de conformidade e simulações rodam offline. Mas a IA e a pesquisa precisam de configuração:",
      "",
      "• Provedor de IA — DeepSeek, Maritaca/Sabiá ou Ollama local (modelos detectados automaticamente, sem lista fixa).",
      "• Deep Research (Tavily) — busca dados públicos, preços de mercado e editais para embasar o projeto. Só cita o que realmente encontrou.",
      "",
      "Sem configurar a IA, o app continua funcional — só os recursos de inteligência artificial ficam desativados até você configurar.",
    ].join("\n"),
  },
  {
    titulo: "Vamos começar",
    texto: [
      "Você pode criar um projeto do zero ou importar um projeto já escrito em PDF/DOCX — a app lê o documento e preenche os campos automaticamente.",
      "",
      "Este tutorial pode ser revisto a qualquer momento pelo botão no rodapé da tela inicial.",
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
