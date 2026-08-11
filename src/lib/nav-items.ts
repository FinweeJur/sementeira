import { Sprout, Upload, Scale, Globe, Bot, RefreshCw, BookOpen, GraduationCap, Ticket, HeartHandshake, Shield, Factory, type LucideIcon } from "lucide-react";

export interface ItemNav {
  id: string;
  icone: LucideIcon;
  rotulo: string;
  dica: string;
  onClick: () => void;
  /** Só aparece quando há projeto(s) — ex.: Comparar exige 2+. */
  visivel?: boolean;
}

export interface NavAcoes {
  temProjeto: boolean;
  temMultiplosProjetos: boolean;
  onNovoProjeto: () => void;
  onImportar: () => void;
  onComparar: () => void;
  onEcossistema: () => void;
  onCopiloto: () => void;
  onRevisaoGeral: () => void;
  onBiblioteca: () => void;
  onAprender: () => void;
  onPrivacidade: () => void;
  onClube: () => void;
  onVoluntarios: () => void;
  onTecnologia: () => void;
}

/**
 * Lista única dos destinos de navegação — usada pela NavBar (ícones no topo)
 * e pela SidebarNav (sanfona lateral com ícone + nome). Um lugar só evita que
 * as duas listas divirjam quando um destino novo for adicionado.
 */
export function montarItensNav(acoes: NavAcoes): ItemNav[] {
  return [
    { id: "novo-projeto", icone: Sprout, rotulo: "Novo projeto", dica: "Crie um novo projeto a partir de uma ideia ou importe de um documento", onClick: acoes.onNovoProjeto, visivel: true },
    { id: "importar", icone: Upload, rotulo: "Importar", dica: "Importe um projeto já escrito a partir de um PDF ou DOCX", onClick: acoes.onImportar, visivel: true },
    { id: "comparar", icone: Scale, rotulo: "Comparar", dica: "Compare até 3 projetos lado a lado", onClick: acoes.onComparar, visivel: acoes.temMultiplosProjetos },
    { id: "mapa", icone: Globe, rotulo: "Mapa", dica: "Ecossistema: mapa da região e como os projetos podem se ajudar", onClick: acoes.onEcossistema, visivel: acoes.temProjeto },
    { id: "copiloto", icone: Bot, rotulo: "Copiloto", dica: "Converse por texto para lapidar, exportar ou consultar qualquer projeto", onClick: acoes.onCopiloto, visivel: acoes.temProjeto },
    { id: "ciclo", icone: RefreshCw, rotulo: "Ciclo", dica: "Revisão geral: roda 1 volta de lapidação nos projetos + atualiza ecossistema e clube", onClick: acoes.onRevisaoGeral, visivel: acoes.temProjeto },
    { id: "tecnologia", icone: Factory, rotulo: "Tecnologia", dica: "Procura a máquina que faz o trabalho render mais, com a conta do que custa importar", onClick: acoes.onTecnologia, visivel: true },
    { id: "biblioteca", icone: BookOpen, rotulo: "Biblioteca", dica: "Documentos de referência do processo e leituras de apoio", onClick: acoes.onBiblioteca, visivel: true },
    { id: "aprender", icone: GraduationCap, rotulo: "Aprender", dica: "Currículo passo a passo de como montar um projeto na Sementeira", onClick: acoes.onAprender, visivel: true },
    { id: "clube", icone: Ticket, rotulo: "Clube", dica: "Clube de benefícios: programa que conecta produtos dos projetos às famílias atingidas", onClick: acoes.onClube, visivel: true },
    { id: "cadastro", icone: HeartHandshake, rotulo: "Cadastro", dica: "Voluntários: pessoas disponíveis para mutirões", onClick: acoes.onVoluntarios, visivel: true },
    { id: "privacidade", icone: Shield, rotulo: "Privacidade", dica: "Política de privacidade — como a Sementeira trata os dados de quem usa o app (LGPD)", onClick: acoes.onPrivacidade, visivel: true },
  ].filter((item) => item.visivel);
}
