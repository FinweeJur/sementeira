import { useState } from "react";
import { RefreshCw, ShieldCheck, Globe, Scale, Ticket, HeartHandshake, Bot, Sprout, Upload, BookOpen, type LucideIcon } from "lucide-react";

interface LinhaTela {
  icone?: LucideIcon;
  texto: string;
}

const TELAS: { titulo: string; linhas: LinhaTela[] }[] = [
  {
    titulo: "O que é a Sementeira",
    linhas: [
      { texto: "A Sementeira é um programa para computador com Windows. Funciona sem internet." },
      {
        texto:
          "Ela ajuda você, pessoa atingida pelo rompimento da barragem de Brumadinho, a transformar uma ideia em um projeto pronto para levar à Governança Popular.",
      },
      { texto: "Ela não substitui a assembleia, a Comissão de Atingidos nem a Governança. Ela só prepara o material antes disso." },
    ],
  },
  {
    titulo: "Do dano ao documento",
    linhas: [
      { texto: "1) Você conta qual dano quer reparar. A Sementeira sugere o tipo de projeto mais próximo." },
      { texto: "2) A IA ajuda a preencher objetivo, justificativa, metas, orçamento e equipe. Você revisa tudo." },
      { texto: "3) O programa confere as regras na hora. Se algo não pode — como pagar salário para sempre sem dizer de onde vem o dinheiro depois —, ele avisa." },
      { texto: "4) Você simula se o projeto se sustenta sozinho depois que o dinheiro do repasse acabar." },
      { texto: "5) Exporta tudo pronto em PDF, DOCX ou XLSX." },
    ],
  },
  {
    titulo: "A IA trabalha pra você",
    linhas: [
      { icone: Bot, texto: "Copiloto — fica dentro do projeto, faz perguntas, sugere melhorias e gera rascunhos a partir da sua ideia." },
      {
        icone: RefreshCw,
        texto:
          "Lapidar — dentro de cada projeto (botão no topo da tela do projeto), seis ajudantes de IA revisam o projeto, um de cada vez, e você aprova cada mudança. Nada é aplicado sem você dizer sim, e tudo pode voltar atrás pelo histórico de versões.",
      },
      {
        icone: RefreshCw,
        texto: "Ciclo — na barra de cima, roda 1 volta de lapidação em TODOS os projetos de uma vez e já atualiza o mapa e o clube de benefícios.",
      },
      { icone: ShieldCheck, texto: "Revisão independente — dentro do projeto, um segundo agente de IA confere se ele segue as regras do acordo e mostra onde os dois discordam." },
    ],
  },
  {
    titulo: "Os ícones da barra de cima",
    linhas: [
      { icone: Sprout, texto: "Novo projeto — começa um projeto do zero, a partir de uma ideia." },
      { icone: Upload, texto: "Importar — lê um projeto já escrito em PDF ou DOCX e preenche os campos sozinha." },
      { icone: Scale, texto: "Comparar — até 3 projetos lado a lado, pra ver o que se repete ou o que falta (aparece com 2+ projetos)." },
      { icone: Globe, texto: "Mapa — o ecossistema: os ~26 municípios da bacia do Paraopeba e como os projetos podem se ajudar." },
      { icone: Bot, texto: "Copiloto — converse por texto pra lapidar, exportar ou saber a situação de qualquer projeto." },
      { icone: RefreshCw, texto: "Ciclo — revisão geral: lapida todos os projetos de uma vez." },
      { icone: BookOpen, texto: "Biblioteca — documentos de referência do processo e leituras de apoio." },
      { icone: Ticket, texto: "Clube — o Clube de Benefícios, que liga o que cada projeto produz às famílias atingidas." },
      { icone: HeartHandshake, texto: "Cadastro — de voluntários: pessoas disponíveis pra mutirão, ligadas aos projetos de interesse." },
    ],
  },
  {
    titulo: "Configure sua IA",
    linhas: [
      { texto: "A Sementeira funciona sem internet: formulário, conferência de regras e simulações rodam no seu computador. Só a IA e a pesquisa precisam de configuração." },
      { texto: "• Provedor de IA — DeepSeek, Maritaca/Sabiá ou Ollama no seu computador (os modelos aparecem sozinhos, sem lista fixa)." },
      { texto: "• Pesquisa na internet (Tavily) — busca dados públicos, preços de mercado e editais pra embasar o projeto. Só cita o que realmente encontrou." },
      { texto: "Sem configurar a IA, o app continua funcionando — só os recursos de inteligência artificial ficam desligados até você configurar." },
    ],
  },
  {
    titulo: "Vamos começar",
    linhas: [
      { texto: "Você pode criar um projeto do zero ou importar um projeto já escrito em PDF ou DOCX — a Sementeira lê o documento e preenche os campos sozinha." },
      { texto: "Você pode rever este tutorial quando quiser, pelo botão no rodapé da tela inicial." },
    ],
  },
];

export function Onboarding({ onConcluir }: { onConcluir: (comecarProjeto: boolean) => void }) {
  const [passo, setPasso] = useState(0);
  const tela = TELAS[passo];
  const ultimo = passo === TELAS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col space-y-4 rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-6">
        <div className="flex shrink-0 gap-1">
          {TELAS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full sm-fade"
              style={{ background: i <= passo ? "var(--sm-accent)" : "var(--sm-border)" }}
            />
          ))}
        </div>
        <span className="sm-selo-ico shrink-0" aria-hidden="true">
          <span className="sm-ico">h</span>
        </span>
        <h2 className="shrink-0 text-lg font-semibold">{tela.titulo}</h2>
        <div className="min-h-0 space-y-2 overflow-y-auto text-sm text-[color:var(--sm-text-dim)]">
          {tela.linhas.map((linha, i) => (
            <p key={i} className={linha.icone ? "flex items-start gap-2" : undefined}>
              {linha.icone && <linha.icone size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-[color:var(--sm-accent)]" />}
              <span>{linha.texto}</span>
            </p>
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-between pt-2">
          <button onClick={() => onConcluir(false)} className="text-xs text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
            Pular tutorial
          </button>
          <button
            onClick={() => (ultimo ? onConcluir(true) : setPasso(passo + 1))}
            className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-4 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/30"
          >
            {ultimo && <Sprout size={14} strokeWidth={2} />}
            {ultimo ? "Começar meu primeiro projeto" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
