import type { Project } from "../lib/types";
import type { ClubeBeneficios } from "../lib/clube-beneficios";

/**
 * Proposta de Clube de Benefícios ligada aos 10 projetos do seed — vitrine de
 * descontos, programa de pontos de consumo circular e prêmios resgatáveis.
 * `projects` deve ser o array já gerado por `gerarProjetosSeed()`, na mesma
 * ordem, para que os `projectId` batam com os ids reais criados.
 */
export function gerarClubeSeed(projects: Project[]): ClubeBeneficios {
  const [horta, reciclagem, costura, materiaisReciclados, cozinha, centroFormacao, poloCultural, tijolos, informatica] = projects;

  return {
    ofertas: [
      { id: crypto.randomUUID(), projectId: horta.id, titulo: "10% de desconto em hortaliças", descricao: "Válido para famílias associadas ao clube, direto na horta ou na feira comunitária." },
      { id: crypto.randomUUID(), projectId: cozinha.id, titulo: "1 refeição gratuita a cada 10 pagas", descricao: "Cartela de fidelidade na Cozinha Comunitária do Retiro." },
      { id: crypto.randomUUID(), projectId: reciclagem.id, titulo: "Bônus por entrega de material reciclável", descricao: "Quem entrega material triado recebe pontos extras (ver programa de pontos) além do valor de mercado do material." },
      { id: crypto.randomUUID(), projectId: costura.id, titulo: "15% de desconto em peças de costura e estamparia", descricao: "Válido para encomendas de associados do clube." },
      { id: crypto.randomUUID(), projectId: materiaisReciclados.id, titulo: "Preço comunitário em blocos/agregados", descricao: "Tabela reduzida para reformas de casas de famílias atingidas cadastradas no clube." },
      { id: crypto.randomUUID(), projectId: tijolos.id, titulo: "Preço comunitário em tijolos ecológicos", descricao: "Mesma lógica do preço comunitário da fábrica de materiais reciclados, para reconstrução de moradias." },
      { id: crypto.randomUUID(), projectId: centroFormacao.id, titulo: "Vaga prioritária em turmas de formação", descricao: "Associados do clube têm prioridade de matrícula nas turmas do Centro de Formação." },
      { id: crypto.randomUUID(), projectId: poloCultural.id, titulo: "Entrada gratuita em eventos do Polo Cultural", descricao: "Para associados e suas famílias, mediante apresentação da carteirinha/cartão do clube." },
      { id: crypto.randomUUID(), projectId: informatica.id, titulo: "Curso de informática básica gratuito", descricao: "Uma vaga gratuita por família associada, por turma." },
    ],
    regrasPontos: [
      { id: crypto.randomUUID(), descricao: "1 kg de material reciclável separado em casa e entregue no Galpão de Reciclagem", pontosGanhos: 10 },
      { id: crypto.randomUUID(), descricao: "Participação em mutirão (horta, cozinha, plantio, aceiro do plantio de madeira)", pontosGanhos: 50 },
      { id: crypto.randomUUID(), descricao: "Compra em qualquer projeto da rede (a cada R$ 10 gastos)", pontosGanhos: 5 },
      { id: crypto.randomUUID(), descricao: "Conclusão de curso no Centro de Formação ou no Projeto de Informática", pontosGanhos: 100 },
      { id: crypto.randomUUID(), descricao: "Indicação de nova família associada ao clube", pontosGanhos: 30 },
    ],
    premios: [
      { id: crypto.randomUUID(), nome: "Cesta básica com produtos da Horta e da Cozinha Comunitária", custoPontos: 300 },
      { id: crypto.randomUUID(), nome: "Kit de peças de costura/estamparia (valor até R$ 80)", custoPontos: 250 },
      { id: crypto.randomUUID(), nome: "Desconto de R$ 100 em material de construção (Fábrica de Materiais Reciclados ou Tijolos Ecológicos)", custoPontos: 500 },
      { id: crypto.randomUUID(), nome: "Vaga em curso avançado do Centro de Formação", custoPontos: 400 },
      { id: crypto.randomUUID(), nome: "Ingresso VIP em festival do Polo de Projetos Culturais", custoPontos: 150 },
    ],
  };
}
