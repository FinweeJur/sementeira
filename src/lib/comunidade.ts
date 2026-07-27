/**
 * Cliente da base de dados compartilhada do servidor (sem login) —
 * projetos/voluntários/clube que a pessoa opta por publicar pra comunidade
 * do app. Diferente de tudo mais na Sementeira, que fica só no navegador:
 * isto sai pra um arquivo no servidor, visível a qualquer visitante. Por
 * isso o consentimento (ConfirmDialog) é sempre antes do POST, nunca depois.
 */

export type TipoComunidade = "projetos" | "voluntarios" | "clube";

export interface ItemComunidade<T = Record<string, unknown>> {
  id: string;
  dados: T;
  criadoEm: string;
  atualizadoEm?: string;
}

const TOKENS_KEY = "sementeira-comunidade-tokens-v1";

/** Tokens de edição das entradas QUE ESTE NAVEGADOR criou — é a única forma de editar/apagar depois, sem conta. */
function carregarTokens(): Record<string, string> {
  try {
    const bruto = localStorage.getItem(TOKENS_KEY);
    return bruto ? JSON.parse(bruto) : {};
  } catch {
    return {};
  }
}
function salvarToken(id: string, tokenEdicao: string): void {
  const atuais = carregarTokens();
  atuais[id] = tokenEdicao;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(atuais));
}
/** Este navegador foi quem criou esta entrada (tem o token de edição dela)? */
export function souAutorDe(id: string): boolean {
  return Boolean(carregarTokens()[id]);
}

export interface RespostaComunidade<T> {
  ok: boolean;
  itens?: T[];
  erro?: string;
}

export async function listarComunidade<T = Record<string, unknown>>(tipo: TipoComunidade): Promise<RespostaComunidade<ItemComunidade<T>>> {
  try {
    const resp = await fetch(`/api/comunidade/${tipo}`);
    const data = await resp.json();
    if (!resp.ok || !data?.ok) return { ok: false, erro: data?.erro ?? `Falha ao carregar (${resp.status}).` };
    return { ok: true, itens: data.itens ?? [] };
  } catch {
    return { ok: false, erro: "Não foi possível falar com o servidor. A base compartilhada só funciona na versão web, com o servidor no ar." };
  }
}

export async function criarNaComunidade<T>(tipo: TipoComunidade, dados: T): Promise<{ ok: boolean; id?: string; erro?: string }> {
  try {
    const resp = await fetch(`/api/comunidade/${tipo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dados, confirmouAviso: true }),
    });
    const data = await resp.json();
    if (!resp.ok || !data?.ok) return { ok: false, erro: data?.erro ?? `Falha ao publicar (${resp.status}).` };
    salvarToken(data.id, data.tokenEdicao);
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, erro: "Não foi possível falar com o servidor." };
  }
}

export async function removerDaComunidade(tipo: TipoComunidade, id: string): Promise<{ ok: boolean; erro?: string }> {
  const tokenEdicao = carregarTokens()[id];
  if (!tokenEdicao) return { ok: false, erro: "Este navegador não tem o token de edição desta entrada — só quem criou consegue remover." };
  try {
    const resp = await fetch(`/api/comunidade/${tipo}/${id}`, { method: "DELETE", headers: { "X-Token-Edicao": tokenEdicao } });
    const data = await resp.json();
    return resp.ok && data?.ok ? { ok: true } : { ok: false, erro: data?.erro };
  } catch {
    return { ok: false, erro: "Não foi possível falar com o servidor." };
  }
}
