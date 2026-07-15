# Sementeira — Onboarding / Memória de Sessão

> Snapshot gerado em 2026-07-13 para qualquer sessão nova entrar fria e entender o projeto
> rapidamente. **Este arquivo é um mapa, não a fonte da verdade** — quando a realidade do
> código discordar daqui, confie no código e atualize este doc.

---

## 1. O que é (em uma frase)

App **desktop Windows (Electron), offline-first** que ajuda pessoas atingidas pelo rompimento da
barragem de Brumadinho (bacia do Paraopeba) a transformar uma ideia em um **projeto comunitário
completo do Anexo I.1** do acordo de reparação — com motor de conformidade determinístico e
simulador de sustentabilidade. **Não é app de mobilização/popular** (ver §10).

- **Repo**: `FinweeJur/sementeira` — **PRIVADO**, branch default `master`
- **Versão atual**: `0.1.0` (tag `v0.1.0` existe; **sem release** automática no GitHub — o workflow
  `release.yml` só dispara em *novas* tags `v*`, e esta tag é anterior ao workflow)
- **Licença**: © 2026 Artur Colito (todos os direitos reservados)

## 2. Stack (essencial)

| Camada        | Tecnologia                                                        |
| ------------- | ----------------------------------------------------------------- |
| Desktop shell | Electron 40 (`electron/main.cjs` processo main, `preload.cjs`)    |
| Renderer      | Vite 6 + React 19 + TypeScript **strict** + Tailwind 4            |
| Build TS      | `tsc -p . --noEmit` (typecheck) · `tsc -b && vite build` (build)  |
| Empacotamento | electron-builder → NSIS `.exe` (`release/`)                       |
| Persistência  | **localStorage** do renderer (chaves `sementeira-*-v1`) — **sem backend** |
| Documentos    | `pdfjs-dist` (leitura), `mammoth` (DOCX), `docx`, `exceljs`, export PDF via `webContents.printToPDF` |
| Mapas         | `leaflet` (OSM tiles reais) + `three` (mapa isométrico do ecossistema) |

**Node mínimo**: 18+ (CI roda em 18 e 20; local aqui tem v22.23.1 via hermes).

## 3. Comandos do dia a dia

```bash
npm run dev         # renderer (vite :5183) + electron juntos (concurrently + wait-on)
npm run typecheck   # tsc -p . --noEmit — OBRIGATÓRIO após toda mudança
npm run build       # tsc -b && vite build → dist/
npm run dist        # build + electron-builder → release/Sementeira Setup 0.1.0.exe
```

**⚠️ Caveat de dev (do AGENTS.md)**: após mudanças, **reinicie o processo Electron** e confirme o
PID via `Get-Process electron`. Ferramentas de preview de browser **não** dirigem a janela Electron
real — só uma aba comum apontando pro Vite dev server. **Funcionalidades via IPC (LLM, Ollama,
Tavily, export PDF) ficam invisíveis** pela rota de preview.

## 4. Arquitetura de IA — 2 camadas, sem backend

```
Renderer (React)  ──IPC──►  electron/main.cjs  ──HTTPS──►  Provedor LLM / Tavily
   ▲                              ▲
   │ envia prompts                │ chama direto (sem gateway — decisão deliberada)
   │                              │
providers.ts (window.sementeira)  chamarLLM() / buscarWebTavily()
```

- **Provedores** (`src/lib/providers.ts`): DeepSeek, Maritaca/Sabiá (`sabia-4`/`sabiazinho-4`),
  Ollama local. DeepSeek/Maritaca usam API OpenAI-compatible (`/chat/completions`); Ollama usa
  `/api/chat`.
- **Ollama**: modelos **auto-detectados** via `GET /api/tags` (nunca lista hardcoded). Se o modelo
  não está baixado, mensagem clara dizendo pra rodar `ollama pull <modelo>`.
- **Deep Research via Tavily** (`src/lib/websearch.ts`): **única** fonte de "internet". Sem chave
  → a função nem é chamada (bloqueada no renderer). **Cita só o que a Tavily retornou — nunca inventa.**

### Pipeline de geração/revisão (dois agentes independentes)
1. **Geração** (`src/lib/draft-generation.ts`) → rascunho JSON estruturado (ou até 3 perguntas
   clarificatórias se faltar info essencial).
2. **Revisão** (`src/lib/revisao-agente.ts`) → agente **independente** reavalia contra as mesmas
   regras do Ofício. **Divergência com `compliance-engine.ts` é mostrada ao usuário, nunca
   resolvida silenciosamente.**

## 5. O coração determinístico — `compliance-engine.ts`

Motor que aplica as vedações do **Ofício Conjunto 46/2026** sobre cada linha de orçamento.
**Sempre é a palavra final sobre o que é permitido** — a IA é sugestão, o motor é lei.

Principais regras codificadas (severidade `bloqueio` 🔴 / `atencao` 🟡 / `ok` 🟢):
- **Vedação Geral III**: folha permanente sem `fonteCusteioFuturo` → 🔴
- **4.2 §1º**: financiamento permanente de contas individuais (água/energia/telefonia/internet)
  ou insumo alimentar diário sem arranjo formal → 🔴
- **4.4**: política pública/equipamento público exige `anuenciaEntePublico` → 🔴
- **4.1 §1º/§3º**: capital de giro/insumos/operação assistida > 6 meses sem
  `justificativaCicloProdutivo` → 🟡
- **POS** (Plano Obrigatório de Sustentabilidade): obrigatório p/ continuados; **completo** p/ porte
  médio/grande (campos em `PosCompleto`) → 🔴
- **Meta #1**: projeto sem `danoId` → 🔴
- **Diretrizes locais**: orçamento < R$100k (porte mínimo), equipe < 2 pessoas → 🟡

## 6. Mapa de arquivos (o que mora onde)

```
src/
├── App.tsx                  # Rotas por estado (não react-router): lista/wizard/ecossistema/clube/voluntários/comparação/onboarding
├── pages/                   # Telas
│   ├── ProjectList.tsx      # Home — lista de projetos, checklist 1º uso, modais
│   ├── ProjectWizard.tsx    # Editor do projeto (70KB — o arquivo mais pesado, núcleo da UX)
│   ├── ProjectDocumento.tsx # Visão "documento completo" + exportação
│   ├── Ecossistema.tsx      # Análise cross-project (Fase 5)
│   ├── CompareProjects.tsx  # Comparação lado a lado (até 3) — commit mais recente (8/jul)
│   ├── ClubeBeneficios.tsx  # Fase 6
│   └── Voluntarios.tsx      # Fase 14a
├── lib/
│   ├── types.ts             # `Project`, `BudgetLine`, `EquipeMembro`, `Indicador`, `novoProjetoVazio()`...
│   ├── compliance-engine.ts # ⭐ motor de regras (ver §5)
│   ├── simulator.ts         # POS, ondas de execução, depreciação mensal
│   ├── draft-generation.ts  # Camada de geração (agente 1)
│   ├── revisao-agente.ts    # Camada de revisão independente (agente 2)
│   ├── refinement-loop.ts   # Ciclo de Lapidação (48KB — 6 papéis: escritor/orçamentista/crítico/risco/sugestor/compilador)
│   ├── providers.ts         # Tipos IPC + `window.sementeira` + configs de LLM
│   ├── storage.ts           # localStorage + `migrarProjeto()` (compat retroativa)
│   ├── export.ts            # .docx/.xlsx/.pdf + minutas (estatuto, ata, regimento)
│   ├── suggestion-engine.ts # Matching de arquétipo — usa `contemPalavra()` com word-boundary
│   ├── websearch.ts         # Tavily wrapper
│   └── preferences.ts       # Tema, font-scale, onboarding visto, seed auto-importado
├── data/                    # Dados estáticos (JSON + seeds)
│   ├── arquetipos.json      # 11 arquétipos (horta, galpão reciclagem, cozinha...)
│   ├── danos.json           # Danos coletivos priorizados
│   ├── municipios-paraopeba.json  # ~26 municípios (mapa regional + distâncias)
│   ├── seed-projetos.ts     # Projetos de exemplo (auto-importados 1x no 1º uso)
│   └── seed-clube.ts
├── components/
│   ├── mapa/                # MapaEcossistema (three/isométrico) + MapaGeografico (leaflet)
│   └── cronograma/          # Gantt + FluxoCaixa
electron/
├── main.cjs                 # IPC: llm:chat, ollama:listarModelos, websearch, pdf:exportar
└── preload.cjs              # Expõe `window.sementeira` (contextIsolation on, nodeIntegration off)
```

## 7. Ciclo de dados (persistência)

- Tudo no **localStorage do renderer** — `loadProjects/upsertProject/deleteProject` (`storage.ts`).
- Chaves em `*-v1` (projetos, config LLM, config comparação, preferências, checklist).
- `migrarProjeto()` preenche campos adicionados depois (equipe era `string[]`, virou
  `EquipeMembro[]`) — **sempre que adicionar campo a `Project`, atualize a migração**.
- **Sem sync, sem servidor, sem backup automático.** Os dados vivem no navegador do Electron.

## 8. Configuração de ambiente

- **`.env.local`** (na raiz, **não commitado** — está no `.gitignore`):
  ```env
  VITE_DEEPSEEK_API_KEY=...
  VITE_MARITACA_API_KEY=...
  VITE_TAVILY_API_KEY=...
  VITE_OLLAMA_BASE_URL=http://127.0.0.1:11434
  ```
  (As chaves também ficam em `localStorage` via tela de Configurações — `localStorage` tem
  precedência sobre `.env.local` na UX.)
- **Ollama**: rodar `ollama serve` (ou app aberto) + `ollama pull <modelo>` antes.
- **Sem chaves**: o app **funciona** (formulário, motor de conformidade, simulações) — só LLM e
  Deep Research ficam indisponíveis. É um app offline-first.

## 9. CI/CD (`.github/workflows/`)

- **`ci.yml`**: push/PR em master/main → `npm ci` + `typecheck` + `build`, matrix Node 18/20.
- **`release.yml`**: push de **tag** `v*` → build no `windows-latest` → `.exe` → GitHub Release
  (`softprops/action-gh-release`). **Para gerar uma release**, crie e empurre uma tag nova:
  `git tag v0.2.0 && git push origin v0.2.0`.

## 10. Não-objetivos (importante — evita reescrever)

- **Não** é app de mobilização/denúncia/convocação de atos (ver
  `marketing/sementeira-apresentacao.md`, que corrige uma versão anterior fantasiosa).
- **Não** substitui Governança Popular, Comissões de Atingidos ou assembleias.
- **Não** tem versão mobile nem link público ainda.
- **Não** decide nada sozinho: toda sugestão de IA é revisável; o motor determinístico é a lei.
- **Não** depende de gateway/backend compartilhado com outros projetos (decisão deliberada, **diferente
  do hermes-agent**).
- **Transcrição de áudio** (Whisper.cpp) foi decidida mas **adiada** — empacotar binário nativo é
  trabalho à parte. (A UI já menciona "grava/anexa um áudio", mas a feature ainda não existe.)

## 11. Convenções de código (do AGENTS.md + observadas)

- **TypeScript strict** + `noUnusedLocals` + `noUnusedParameters` — não deixe variáveis órfãs.
- **Matching de arquétipo** usa `contemPalavra()` com **word-boundary** (regex). Substring simples
  já deu falso positivo ("pão" dentro de "galpão"). **Não volte pra `.includes()`.**
- **Diretrizes gerais** (documentos que valem pra todos os projetos) são **sempre subordinadas ao
  Ofício 46** — nunca podem sobrepor as vedações.
- Comentários no código explicam o **porquê** de regras de negócio (referenciam incisos do Ofício,
  página da Proposta). Mantenha esse padrão.
- JSON de saída do LLM é sempre sanitizado antes de aplicar (ver `draft-generation.ts`,
  `revisao-agente.ts`) — **nunca confie cegamente no JSON do modelo**.

## 12. Estado atual (snapshot 2026-07-13)

- **Local = Remote** (`master...origin/master` = `0 0`): o checkout local **está na última versão**.
- `node_modules/` presente (339 pacotes), `electron/dist/electron.exe` baixado, `dist/` buildado
  (mas pode estar desatualizado vs `src/` — rebuildar se for empacotar).
- Último commit funcional: `8ee2bda` (`.opencode/opencode.json`). Antes dele: comparação de
  projetos lado a lado, CI/CD, README, objetivos específicos + boas práticas.
- **Node não está no PATH do sistema** neste ambiente; há um Node v22.23.1 em
  `C:\Users\teste\AppData\Local\hermes\node\node.exe` (com `npm` 10.9.8 via `node_modules/npm`).

## 13. Próximos passos plausíveis (não planejados, só observados)

- Reativar/empacotar a transcrição de áudio (Whisper.cpp) — mencionada na apresentação mas adiada.
- Orientação mensal automática de acompanhamento (Fase 14b — `dataInicioReal` já existe no tipo).
- Gerar uma release real no GitHub (push de tag nova) — hoje só existe o `.exe` local em `release/`.

---

*Para atualizar este doc*: ao mudar arquivos estruturais (novo módulo em `lib/`, novo provedor,
nova regra de conformidade, mudança de stack), ajuste as seções correspondentes. Mantenha conciso —
o README já cobre o "como usar"; este cobre o "como é por dentro".
