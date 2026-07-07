# Sementeira

Electron desktop app que ajuda pessoas atingidas pelo rompimento da barragem de Brumadinho
(bacia do Paraopeba) a redigir projetos de reparação comunitária para o **Anexo I.1** do acordo
judicial de reparação. Motor de regras determinístico (não apenas julgamento de LLM) que codifica
o Ofício Conjunto 45/2026, 46/2026 e a Proposta Definitiva.

## Stack
- Electron 40 + Vite + React 19 + TypeScript strict + Tailwind 4
- LLM chamado direto do processo main do Electron (sem gateway/backend) — DeepSeek, Maritaca
  (`sabia-4`/`sabiazinho-4`), Ollama local (modelos auto-detectados via `GET /api/tags`, nunca lista
  hardcoded)
- Deep Research via Tavily (`src/lib/websearch.ts`) — só cita o que a Tavily retornou, nunca inventa
- PDF/DOCX: `pdfjs-dist` + `mammoth`

## Rodando
```
npm run dev            # renderer (vite :5183) + electron juntos
npm run typecheck       # tsc -p . --noEmit — rodar após toda mudança
npm run dist            # build + electron-builder (NSIS installer)
```

## Convenções
- Pipeline de IA em duas camadas: geração (`src/lib/draft-generation.ts`) → revisão por agente
  independente (`src/lib/revisao-agente.ts`) que reavalia contra as mesmas regras do Ofício;
  divergência com `compliance-engine.ts` é mostrada ao usuário, nunca resolvida silenciosamente.
- Matching de arquétipo (`src/lib/suggestion-engine.ts`) usa regex com word-boundary
  (`contemPalavra()`) — substring simples já deu falso positivo ("pão" dentro de "galpão").
- Após qualquer mudança: `npm run typecheck` → reiniciar o processo Electron → confirmar PID via
  `Get-Process electron`. Browser preview tools não conseguem dirigir a janela Electron real (só uma
  aba comum apontando pro Vite dev server) — funcionalidades que dependem de IPC (LLM, Ollama,
  Tavily) ficam invisíveis por essa rota.
- Diretrizes gerais (documentos que valem pra todos os projetos) são sempre subordinadas ao Ofício
  46 — nunca podem sobrepor as vedações.

## Não-objetivos
- Não depende de gateway/backend compartilhado com outros projetos (decisão deliberada, diferente
  do hermes-agent).
- Transcrição de áudio local (Whisper.cpp) foi decidida mas adiada — empacotamento de binário nativo
  é trabalho à parte.
