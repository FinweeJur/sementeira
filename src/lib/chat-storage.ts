import type { ChatMessage } from "./providers";

function key(projectId: string): string {
  return `sementeira-chat-${projectId}-v1`;
}

export function carregarChat(projectId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {
    /* ignora histórico corrompido */
  }
  return [];
}

export function salvarChat(projectId: string, mensagens: ChatMessage[]): void {
  localStorage.setItem(key(projectId), JSON.stringify(mensagens));
}
