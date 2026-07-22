import type { Project, RecursoBiblioteca } from "./types";
import { extrairTextoDeArquivo } from "./file-extraction";
import danos from "../data/danos.json";
import arquetipos from "../data/arquetipos.json";
import setores from "../data/setores.json";

const CHAVE = "sementeira-biblioteca-v1";

/**
 * Documentos que já vêm empacotados com o app (public/biblioteca-docs/, baixados
 * das fontes oficiais — MPF/PR-MG e Cáritas MG — e comprimidos sem perda visível
 * antes de empacotar). `caminhoArquivo`/`textoExtraido` são resolvidos na primeira
 * vez que a Biblioteca abre (ver `resolverDocumentosEmbutidos`), não aqui —
 * nesse momento o app ainda não sabe o caminho real em disco.
 */
const SLOTS_REFERENCIA_SEED: Omit<RecursoBiblioteca, "id">[] = [
  {
    categoria: "referencia",
    titulo: "Proposta Definitiva do Anexo I.1",
    descricao: "Proposta de reparação apresentada no processo judicial — base de todo o Anexo I.1.",
    fonte: "Cáritas Brasileira MG (entidade gestora)",
    fixo: true,
    nomeArquivoEmbutido: "proposta-definitiva-anexo-i.pdf",
  },
  {
    categoria: "referencia",
    titulo: "Acordo Judicial de Reparação (texto integral)",
    descricao: "Termo assinado entre Vale, Governo de MG e Instituições de Justiça — texto completo do acordo de reparação de Brumadinho.",
    fonte: "Governo de Minas Gerais",
    fixo: true,
    nomeArquivoEmbutido: "acordo-judicial-reparacao.pdf",
  },
  {
    categoria: "referencia",
    titulo: "Ofício Conjunto 45/2026",
    descricao: "Resposta das Instituições de Justiça à Entidade Gestora sobre o andamento do Anexo I.1.",
    fonte: "MPF/MPMG/DPMG",
    fixo: true,
    nomeArquivoEmbutido: "oficio-45-2026.pdf",
  },
  {
    categoria: "referencia",
    titulo: "Ofício Conjunto 46/2026",
    descricao: "Diretrizes das Instituições de Justiça à Entidade Gestora — inclui o Plano Obrigatório de Sustentabilidade, citado pelo motor de conformidade.",
    fonte: "MPF/MPMG/DPMG",
    fixo: true,
    nomeArquivoEmbutido: "oficio-46-2026.pdf",
  },
  {
    categoria: "referencia",
    titulo: "Ata de Entendimentos do Anexo I.1",
    descricao: "Registro formal dos entendimentos entre Entidade Gestora e Instituições de Justiça sobre a execução do Anexo I.1.",
    fonte: "MPF/PR-MG",
    fixo: true,
    nomeArquivoEmbutido: "ata-entendimentos-anexo-i1.pdf",
  },
  {
    categoria: "referencia",
    titulo: "Comunicado Conjunto 43 — Atualizações do Anexo I.1",
    descricao: "Comunicado das Instituições de Justiça com atualizações públicas sobre o andamento do programa.",
    fonte: "MPF/PR-MG",
    fixo: true,
    nomeArquivoEmbutido: "comunicado-conjunto-43.pdf",
  },
  {
    categoria: "referencia",
    titulo: "Relatório Técnico — Divisão de Recursos por Instâncias Locais",
    descricao: "Relatório técnico da Entidade Gestora sobre como os recursos do Anexo I.1 se dividem entre as instâncias locais.",
    fonte: "Entidade Gestora (Cáritas MG/ANAB/Conexsus/E-Dinheiro Brasil)",
    fixo: true,
    nomeArquivoEmbutido: "relatorio-tecnico-divisao-recursos.pdf",
  },
];

/** Pesquisa recente já embutida como leitura complementar — mesmo mecanismo dos documentos de referência, só que na outra categoria. */
const LEITURAS_SEED: Omit<RecursoBiblioteca, "id">[] = [
  {
    categoria: "leitura",
    titulo: "Diagnóstico Socioeconômico e Produtivo dos Empreendimentos Econômicos Solidários em MG",
    descricao: "Mapeou 208 grupos de economia solidária em 75 municípios mineiros (fev–ago/2025) — geração de renda, autogestão e organização comunitária. Não é sobre economia circular especificamente, mas é a pesquisa recente da Cáritas MG mais próxima do tema.",
    fonte: "Cáritas Regional Minas Gerais + Instituto Ponte de Assessoria a Projetos",
    fixo: true,
    nomeArquivoEmbutido: "caritas-diagnostico-economia-solidaria-mg.pdf",
  },
];

export function carregarBiblioteca(): RecursoBiblioteca[] {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (raw) return JSON.parse(raw) as RecursoBiblioteca[];
  } catch {
    /* ignora dado corrompido */
  }
  const seed = [...SLOTS_REFERENCIA_SEED, ...LEITURAS_SEED].map((s) => ({ ...s, id: crypto.randomUUID() }));
  salvarBiblioteca(seed);
  return seed;
}

/**
 * Resolve `caminhoArquivo`/`textoExtraido` dos itens embutidos (`nomeArquivoEmbutido`)
 * que ainda não foram processados — roda uma vez por item (idempotente: item já
 * resolvido é ignorado). Precisa do IPC (app desktop) pra achar o caminho real;
 * fora dele os itens embutidos ficam listados mas sem anexo utilizável.
 */
export async function resolverDocumentosEmbutidos(): Promise<RecursoBiblioteca[]> {
  const itens = carregarBiblioteca();
  const pendentes = itens.filter((r) => r.nomeArquivoEmbutido && !r.caminhoArquivo);
  if (pendentes.length === 0 || !window.sementeira?.caminhoDocumentoEmbutido) return itens;

  const atualizados = await Promise.all(
    itens.map(async (r) => {
      if (!r.nomeArquivoEmbutido || r.caminhoArquivo) return r;
      try {
        const resolvido = await window.sementeira!.caminhoDocumentoEmbutido!(r.nomeArquivoEmbutido);
        if (!resolvido?.ok || !resolvido.caminho) return r;
        let textoExtraido: string | undefined;
        try {
          const resp = await fetch(`./biblioteca-docs/${r.nomeArquivoEmbutido}`);
          if (resp.ok) {
            const blob = await resp.blob();
            const arquivo = new File([blob], r.nomeArquivoEmbutido, { type: "application/pdf" });
            const extracao = await extrairTextoDeArquivo(arquivo);
            if (extracao.ok) textoExtraido = extracao.texto;
          }
        } catch {
          /* extração é um extra — o anexo já resolveu o caminho mesmo sem texto */
        }
        return { ...r, caminhoArquivo: resolvido.caminho, nomeArquivo: r.nomeArquivoEmbutido, textoExtraido, anexadoEm: r.anexadoEm ?? new Date().toISOString() };
      } catch {
        return r;
      }
    }),
  );
  salvarBiblioteca(atualizados);
  return atualizados;
}

export function salvarBiblioteca(itens: RecursoBiblioteca[]): void {
  localStorage.setItem(CHAVE, JSON.stringify(itens));
}

function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(arquivo);
  });
}

/**
 * Salva o binário anexado no disco (userData/biblioteca/<recursoId>/) via IPC —
 * indisponível fora do app desktop. Também extrai o texto (mesmo pipeline de
 * `documentoOrigem` na importação de projeto) pra poder virar contexto de IA
 * depois sem reabrir o arquivo do disco a cada chamada; falha na extração não
 * derruba o anexo — só fica sem trecho disponível pra IA.
 */
export async function anexarArquivoBiblioteca(recursoId: string, arquivo: File): Promise<{ ok: boolean; caminho?: string; textoExtraido?: string; erro?: string }> {
  if (!window.sementeira?.salvarArquivoBiblioteca) {
    return { ok: false, erro: "Anexar arquivos só funciona no app desktop." };
  }
  try {
    const base64 = await arquivoParaBase64(arquivo);
    const resultado = await window.sementeira.salvarArquivoBiblioteca({ recursoId, nomeArquivo: arquivo.name, conteudoBase64: base64 });
    if (!resultado?.ok || !resultado.caminho) return { ok: false, erro: resultado?.erro ?? "Falha ao salvar o arquivo." };
    let textoExtraido: string | undefined;
    try {
      const extracao = await extrairTextoDeArquivo(arquivo);
      if (extracao.ok) textoExtraido = extracao.texto;
    } catch {
      /* extração é um extra — anexo já foi salvo com sucesso mesmo sem texto */
    }
    return { ok: true, caminho: resultado.caminho, textoExtraido };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/** Abre o arquivo anexado no aplicativo padrão do SO. */
export async function abrirArquivoBiblioteca(caminho: string): Promise<{ ok: boolean; erro?: string }> {
  if (!window.sementeira?.abrirArquivoBiblioteca) {
    return { ok: false, erro: "Disponível apenas no app desktop." };
  }
  return window.sementeira.abrirArquivoBiblioteca(caminho);
}

export function contemPalavra(texto: string, palavra: string): boolean {
  const p = palavra.trim().toLowerCase();
  if (!p) return false;
  const escapada = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapada}\\b`, "i").test(texto);
}

/** Termos humanos (nome do dano + palavras-chave, nome do arquétipo, nome do setor) pra casar contra título/descrição da Biblioteca — os campos do projeto guardam só ids curtos. */
function termosDoProjeto(project: Project): string[] {
  const dano = danos.find((d) => d.id === project.danoId);
  const arquetipo = arquetipos.find((a) => a.id === project.arquetipoId);
  const setor = setores.find((s) => s.id === project.setorId);
  return [dano?.nome, ...(dano?.palavrasChave ?? []), arquetipo?.nome, setor?.nome].filter((t): t is string => !!t);
}

/**
 * Bloco de prompt com o que está na Biblioteca — sempre lista os títulos (índice
 * barato, sempre presente), mas só inclui um trecho do conteúdo extraído quando
 * o item parece relevante pro projeto atual (por dano/arquétipo/setor). "Contexto
 * disponível se necessário", não o conteúdo inteiro empurrado em toda chamada.
 */
export function montarBlocoBiblioteca(project?: Project): string {
  const itens = carregarBiblioteca();
  if (itens.length === 0) return "";

  const indice = itens.map((r) => `- ${r.titulo}${r.fonte ? ` (${r.fonte})` : ""}${r.nomeArquivo ? "" : " [sem arquivo anexado ainda — ignore]"}`).join("\n");

  const termos = project ? termosDoProjeto(project) : [];
  const relevantes = termos.length > 0 ? itens.filter((r) => r.textoExtraido && termos.some((t) => contemPalavra(`${r.titulo} ${r.descricao ?? ""}`, t))) : [];
  const trechos = relevantes.map((r) => `--- ${r.titulo} (trecho) ---\n${r.textoExtraido!.slice(0, 2500)}`).join("\n\n");

  return [
    "Biblioteca do usuário (documentos de referência e leituras cadastradas) — disponível como contexto, use só se ajudar de fato:",
    indice,
    trechos && `Trechos possivelmente relevantes para este projeto:\n\n${trechos}`,
    "IMPORTANTE: cite um documento da Biblioteca só se ele realmente ajudar a responder; nunca invente conteúdo de um item sem trecho extraído aqui.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
