import type { ComplianceFinding, Project } from "./types";
import type { RascunhoDados } from "./draft-generation";
import { avaliarConformidade } from "./compliance-engine";
import { carregarConfigLLM, enviarMensagemLLM } from "./providers";
import { montarBlocoDiretrizesGlobais } from "./diretrizes-globais";
import { montarBlocoBiblioteca } from "./biblioteca";
import { extrairBlocoJson } from "./json-parsing";

export interface RevisaoResultado {
  adequado: boolean;
  divergeDoMotor: boolean;
  mudancasSugeridas: RascunhoDados;
  mudancasResumo: string[];
  recomendacoes: string[];
  perguntas: string[];
}

const RESUMO_REGRAS = [
  "Ofício Conjunto 46/2026 — regras que o rascunho precisa respeitar:",
  "1. Todo projeto deve estar vinculado a um dano coletivo (Meta #1 do programa).",
  "2. Vedação Geral III: pagamento permanente de folha de pessoal é proibido sem fonte autônoma/coletiva/pública formalmente assumida de custeio futuro.",
  "3. Capital de giro, insumos iniciais e operação assistida: preferencialmente até 6 meses; prazo maior só com justificativa técnica ligada ao ciclo produtivo (ex. plantio de madeira, que leva anos).",
  "4. Estruturas comunitárias (4.2): vedado financiar permanentemente contas individuais de água/energia/telefonia/internet, ou insumo alimentar diário, salvo arranjo formal de continuidade.",
  "5. Política pública/equipamento público (4.4): exige anuência formal prévia do ente público quanto a manutenção e custeio futuros.",
  "6. Plano Obrigatório de Sustentabilidade (POS): todo projeto continuado precisa demonstrar que se sustenta sozinho depois do repasse — dispensado só se início/fim definidos, não continuado, com execução inferior a 12 meses.",
  "7. Cota de equidade (Proposta Definitiva): mínimo 30% dos recursos devem alcançar pessoas mais pobres, Povos e Comunidades Tradicionais, mulheres, Familiares de Vítimas Fatais ou moradores da Zona Quente.",
  "8. Ofício 45: mencionar dificuldades em matriz de risco NÃO desobriga o cumprimento de metas e prazos — não aceite isso como justificativa de projeto inviável.",
].join("\n");

function resumirFindings(findings: ComplianceFinding[]): string {
  return findings.map((f) => `- [${f.severidade.toUpperCase()}] ${f.regra}: ${f.mensagem}`).join("\n");
}

function montarPromptRevisao(project: Project, findingsMotor: ComplianceFinding[]): string {
  return [
    "Você é um segundo revisor, independente de quem redigiu o rascunho. Sua tarefa é conferir se o projeto abaixo está adequado às regras oficiais, especificamente contra o Ofício 46, o Ofício 45 e a Proposta Definitiva.",
    RESUMO_REGRAS,
    "",
    "Dados do projeto:",
    `Título: ${project.titulo || "(sem título)"}`,
    `Objetivo: ${project.objetivo || "(vazio)"}`,
    `Justificativa: ${project.justificativa || "(vazio)"}`,
    `Metas: ${project.metas.join("; ") || "(vazio)"}`,
    `Abrangência: ${project.abrangencia}`,
    `Orçamento (${project.orcamento.length} itens): ${project.orcamento.map((l) => `${l.categoria}: "${l.descricao}" R$${l.valor} prazo=${l.prazoMeses ?? "-"}m fonteFutura=${l.fonteCusteioFuturo ?? "-"}`).join(" | ") || "(vazio)"}`,
    "",
    "O motor de conformidade determinístico do app já encontrou estes achados (use como referência, mas confira com seu próprio raciocínio — se você discordar, sinalize):",
    resumirFindings(findingsMotor),
    montarBlocoDiretrizesGlobais(),
    montarBlocoBiblioteca(project),
    "",
    "Responda SOMENTE com um bloco json neste formato, sem mais nada:",
    '```json\n{"adequado": true/false, "divergeDoMotor": true/false, "mudancasSugeridas": {"objetivo": "...", "justificativa": "...", "metas": ["..."], "comoComunidadeAjuda": "...", "missaoImpacto": "..."}, "mudancasResumo": ["o que mudou e por quê, item por item"], "recomendacoes": ["..."], "perguntas": ["..."]}\n```',
    "Regras estritas: `mudancasSugeridas` só deve conter campos que você recomenda alterar (omita os que já estão adequados). NUNCA invente fato/valor/link que não esteja nos dados do projeto fornecidos acima. Se está tudo adequado, `mudancasSugeridas` pode ser um objeto vazio {}.",
  ].join("\n");
}

export async function revisarProjetoComOficios(project: Project): Promise<{ ok: boolean; dado?: RevisaoResultado; erro?: string }> {
  const findingsMotor = avaliarConformidade(project);
  const prompt = montarPromptRevisao(project, findingsMotor);
  const config = carregarConfigLLM();
  const resposta = await enviarMensagemLLM(config, [{ role: "user", content: prompt }]);

  if (!resposta.ok) return { ok: false, erro: resposta.erro };

  const bloco = extrairBlocoJson(resposta.conteudo ?? "");
  if (!bloco) return { ok: false, erro: "Não foi possível interpretar a resposta do agente de revisão." };

  try {
    const obj = JSON.parse(bloco.trim());
    const dado: RevisaoResultado = {
      adequado: Boolean(obj.adequado),
      divergeDoMotor: Boolean(obj.divergeDoMotor),
      mudancasSugeridas: {
        objetivo: typeof obj.mudancasSugeridas?.objetivo === "string" ? obj.mudancasSugeridas.objetivo : undefined,
        justificativa: typeof obj.mudancasSugeridas?.justificativa === "string" ? obj.mudancasSugeridas.justificativa : undefined,
        metas: Array.isArray(obj.mudancasSugeridas?.metas) ? obj.mudancasSugeridas.metas.filter((m: unknown) => typeof m === "string") : undefined,
        comoComunidadeAjuda: typeof obj.mudancasSugeridas?.comoComunidadeAjuda === "string" ? obj.mudancasSugeridas.comoComunidadeAjuda : undefined,
        missaoImpacto: typeof obj.mudancasSugeridas?.missaoImpacto === "string" ? obj.mudancasSugeridas.missaoImpacto : undefined,
      },
      mudancasResumo: Array.isArray(obj.mudancasResumo) ? obj.mudancasResumo.filter((m: unknown) => typeof m === "string") : [],
      recomendacoes: Array.isArray(obj.recomendacoes) ? obj.recomendacoes.filter((m: unknown) => typeof m === "string") : [],
      perguntas: Array.isArray(obj.perguntas) ? obj.perguntas.filter((m: unknown) => typeof m === "string") : [],
    };
    return { ok: true, dado };
  } catch {
    return { ok: false, erro: "Não foi possível interpretar a resposta do agente de revisão." };
  }
}
