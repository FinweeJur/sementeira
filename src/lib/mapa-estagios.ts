import type { Project } from "./types";
import { calcularScore } from "./refinement-loop";

export type EstagioCrescimento = "semente" | "broto" | "muda" | "arvore";

export const ESTAGIO_ROTULO: Record<EstagioCrescimento, string> = {
  semente: "🌰 Semente — tem bloqueios 🔴 para resolver",
  broto: "🌱 Broto — sem bloqueios, mas com pendências",
  muda: "🌿 Muda — quase pronto, falta pouco",
  arvore: "🌳 Árvore florida — pronto para exportar",
};

/**
 * Estágio de crescimento do canteiro — gamificação honesta: derivado dos dados
 * reais do motor de conformidade + checklist, nunca decorativo.
 * Heurística: semente = bloqueios; árvore = zero itens abertos;
 * muda = até 2 itens restantes; broto = o resto do caminho.
 */
export function estagioDoProjeto(project: Project): EstagioCrescimento {
  const score = calcularScore(project);
  if (score.bloqueios > 0) return "semente";
  const restantes = score.atencoes + score.pendencias;
  if (restantes === 0) return "arvore";
  if (restantes <= 2) return "muda";
  return "broto";
}

export interface ConexaoMapa {
  deId: string;
  paraId: string;
  rotulo: string;
}

// Regras de conexão por arquétipo — espelham as cadeias descritas no seed do
// ecossistema (quem fornece/forma/vende para quem), aplicadas só aos projetos
// realmente presentes.
const REGRAS_DIRETAS: { de: string; para: string; rotulo: string }[] = [
  { de: "galpao-reciclagem-artesanato", para: "fabrica-materiais-reciclados", rotulo: "fornece material triado" },
  { de: "galpao-reciclagem-artesanato", para: "fabrica-tijolos-ecologicos", rotulo: "fornece material triado" },
  { de: "horta-comunitaria", para: "cozinha-comunitaria", rotulo: "fornece hortaliças" },
  { de: "galpao-costura-estamparia", para: "polo-cultural", rotulo: "vende peças em eventos" },
  { de: "plantio-madeira-venda", para: "fabrica-materiais-reciclados", rotulo: "matéria-prima futura" },
  { de: "tanque-peixes", para: "cozinha-comunitaria", rotulo: "fornece peixe" },
];

const FORMADORES = ["centro-formacao", "informatica-capacitacao"];
const MAX_ARESTAS_FORMACAO = 3;

export function derivarConexoes(projects: Project[]): ConexaoMapa[] {
  const conexoes: ConexaoMapa[] = [];
  const porArquetipo = new Map<string, Project[]>();
  for (const p of projects) {
    const lista = porArquetipo.get(p.arquetipoId) ?? [];
    lista.push(p);
    porArquetipo.set(p.arquetipoId, lista);
  }

  for (const regra of REGRAS_DIRETAS) {
    for (const de of porArquetipo.get(regra.de) ?? []) {
      for (const para of porArquetipo.get(regra.para) ?? []) {
        conexoes.push({ deId: de.id, paraId: para.id, rotulo: regra.rotulo });
      }
    }
  }

  // Formadores conectam aos produtivos (limitado para não virar teia ilegível).
  const produtivos = projects.filter((p) => {
    const arq = p.arquetipoId;
    return !FORMADORES.includes(arq) && arq !== "" && arq !== "cozinha-comunitaria" && arq !== "polo-cultural" && arq !== "horta-comunitaria";
  });
  for (const formadorId of FORMADORES) {
    for (const formador of porArquetipo.get(formadorId) ?? []) {
      for (const alvo of produtivos.slice(0, MAX_ARESTAS_FORMACAO)) {
        conexoes.push({ deId: formador.id, paraId: alvo.id, rotulo: formadorId === "centro-formacao" ? "forma mão de obra" : "forma gestão administrativa" });
      }
    }
  }

  return conexoes;
}
