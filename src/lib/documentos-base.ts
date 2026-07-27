/**
 * Resumo fiel — não o texto integral — da Proposta Definitiva do Anexo I.1 e
 * do Ofício Conjunto 46/2026, extraído das regras já codificadas em
 * compliance-engine.ts, revisao-agente.ts e arquetipos.json. Existe porque a
 * extração de texto desses PDFs na Biblioteca depende da ponte IPC do
 * Electron (não funciona na versão web) — isto garante que a IA sempre tenha
 * pelo menos este contexto, em qualquer ambiente, sem esperar a Biblioteca
 * resolver o documento.
 *
 * Nunca deve ser tratado como transcrição literal: é um resumo interno.
 */
export const RESUMO_DOCUMENTOS_BASE = `Resumo interno (não é o texto integral) da Proposta Definitiva do Anexo I.1 e do Ofício Conjunto 46/2026 — os dois documentos que regem o que um projeto pode e não pode fazer:

Origem e princípio: a reparação depois do rompimento da barragem em Brumadinho é integral — o objetivo de todo projeto é reparar um dano coletivo real, não só gastar um orçamento. A Sementeira nunca decide sozinha: quem decide é a Governança Popular, as Comissões de Atingidos e a assembleia; o app só prepara o material.

Regras que não podem ser quebradas (Ofício 46):
- Meta #1: todo projeto tem que estar vinculado a um dano coletivo priorizado.
- Vedação Geral III: folha de pagamento permanente é proibida sem fonte de custeio futuro autônoma, coletiva ou pública formalmente assumida.
- Capital de giro, insumos iniciais, equipe de implantação e operação assistida: até 6 meses, salvo justificativa técnica ligada ao ciclo produtivo (ex.: plantio de madeira, que leva anos) — item 4.1 §1º/§3º.
- Estruturas comunitárias (item 4.2): proibido custear água, energia, telefone, internet individual ou alimentação diária de forma permanente, exceto arranjo formal de continuidade.
- Política pública / equipamento público (item 4.4): exige anuência formal prévia do ente público sobre manutenção e custeio futuro.
- Plano Obrigatório de Sustentabilidade (POS, item 1): todo projeto continuado precisa mostrar como se sustenta sozinho depois que o repasse acaba — só é dispensado se tiver início e fim definidos, não for continuado, e durar menos de 12 meses.
- Citar uma dificuldade na matriz de riscos NÃO dispensa cumprir metas e prazos (Ofício 45).

Regras da Proposta Definitiva:
- Cota de equidade: no mínimo 30% dos recursos precisam alcançar pessoas mais pobres, Povos e Comunidades Tradicionais, mulheres, familiares de vítimas fatais, ou moradores da Zona Quente.
- Ondas de projetos (pág. 25): a 1ª onda cobre projetos locais e regionais, com teto de 12 meses até a contratação; projetos inter-regionais só entram na 2ª onda.

Tom: luta, dignidade, reparação — sem piegas, sem tecnocracia, em português simples e direto, respeitoso com quem foi atingido.`;

/** Bloco pronto pra concatenar em qualquer prompt de sistema — sempre disponível, sem depender de Biblioteca/IPC. */
export function montarBlocoDocumentosBase(): string {
  return [
    "Resumo dos documentos-base do programa (Proposta Definitiva + Ofício 46) — use como contexto sempre, mesmo sem a Biblioteca aberta:",
    RESUMO_DOCUMENTOS_BASE,
    "IMPORTANTE: isto é um resumo interno da equipe, não a transcrição literal do Ofício/Proposta. Se a Biblioteca tiver o texto completo anexado, prefira citar o texto completo; nunca invente um artigo, página ou item que não esteja aqui ou na Biblioteca.",
  ].join("\n\n");
}
