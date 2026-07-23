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

## Versão web (`servidor/`)
O mesmo renderer roda no navegador, servido por `servidor/sementeira-servidor.cjs` (node:http puro,
sem dependência nova) em `app.sementeiraprojetos.com.br`, via Cloudflare Tunnel. O app fica em `/` e
o gateway de IA em `/api/` — mesma origem, sem CORS entre os dois.
- `electron/llm-core.cjs` é a fonte única das chamadas de IA: o processo main e o servidor web
  importam o MESMO módulo, para as duas superfícies não divergirem.
- `src/lib/ambiente.ts` diz onde o renderer está rodando; `src/lib/llm-web.ts` é o transporte por
  `fetch` (direto, Ollama local, gateway).
- `public/sw.js` mantém o app abrindo quando a máquina que hospeda está desligada.

## Não-objetivos
- Não depende de gateway/backend compartilhado com outros projetos (decisão deliberada, diferente
  do hermes-agent). **O programa instalado continua sem backend**: chama o provedor direto do
  processo main. O gateway de `servidor/` é opcional e existe só para a versão web, por uma
  limitação medida — a Maritaca responde `400 Disallowed CORS origin` a chamada vinda de navegador,
  enquanto DeepSeek e Tavily liberam (ver `servidor/README.md`). Quem usa DeepSeek no navegador não
  precisa de gateway nenhum.
- Transcrição de áudio local (Whisper.cpp) foi decidida mas adiada — empacotamento de binário nativo
  é trabalho à parte.
