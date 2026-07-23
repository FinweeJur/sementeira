# Sementeira

**Sementeira** é uma aplicação desktop que guia pessoas afetadas pelo rompimento da barragem Vale/Brumadinho na construção de projetos comunitários de reparação conforme o **Anexo I.1** do acordo judicial de reparação.

A aplicação codifica as regras de conformidade do Ofício Conjunto 45/2026 e 46/2026 em um motor determinístico, garantindo que cada projeto respeite as vedações, metas, orçamento e sustentabilidade exigidos.

## 📋 Características

### 🎯 6 Fases Implementadas

1. **MVP** — Formulário guiado básico para delinear a ideia
2. **Copiloto LLM** — IA faz perguntas clarificatórias e gera esboço automático
3. **Análise de Riscos & POS** — Identifica riscos, valida sustentabilidade financeira
4. **Estimador de Custos** — Pesquisa de preços via Tavily, orçamento estruturado
5. **Ecossistema** — Análise cross-project (complementaridades/redundâncias/mercado)
6. **Clube de Benefícios** — Programa de pontos e descontos vinculado a projetos

### 🤖 Inteligência Artificial

- **Provedores suportados**: DeepSeek, Maritaca/Sabiá, Ollama local
- **Detecção automática Ollama** — Identifica modelos instalados via API `GET /api/tags`
- **Deep Research via Tavily** — Pesquisa justificativas com citações ABNT, lookup de preços, busca de programas de arrecadação
- **Review Agent independente** — Revisa drafts contra regras de conformidade em linguagem natural

### 📄 Recursos

- 11 arquétipos de projetos pré-configurados (Horta Comunitária, Galpão de Reciclagem, Cozinha Comunitária, etc.)
- Extração de texto de **PDF e DOCX** para diretrizes gerais
- Exportação para PDF e DOCX
- Interface com tema dark/light
- Funciona offline (exceto LLM e Deep Research)

## 🚀 Começar

### Requisitos

- Node.js 18+
- npm ou yarn
- (Opcional) Ollama instalado localmente para usar modelos LLM offline

### Instalação

```bash
git clone https://github.com/FinweeJur/sementeira.git
cd sementeira
npm install
```

### Desenvolvimento

```bash
npm run dev
```

Abre a aplicação Electron com hot-reload do Vite.

### Verificação de Tipo

```bash
npm run typecheck
```

### Build & Distribuição

```bash
npm run build      # Compila TypeScript e Vite
npm run dist       # Gera instalador .exe (Windows)
```

O instalador está em `release/Sementeira Setup 0.3.0.exe`.

## 🔧 Configuração

### Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# LLM Providers
VITE_DEEPSEEK_API_KEY=your_key_here
VITE_MARITACA_API_KEY=your_key_here

# Deep Research
VITE_TAVILY_API_KEY=your_key_here

# Ollama (para desenvolvimento local)
VITE_OLLAMA_BASE_URL=http://localhost:11434
```

## 📁 Estrutura do Projeto

```
sementeira/
├── src/
│   ├── components/        # Componentes React
│   ├── lib/
│   │   ├── compliance-engine.ts      # Motor de validação de conformidade
│   │   ├── draft-generation.ts       # Geração automática de esboços
│   │   ├── revisao-agente.ts         # Review agent independente
│   │   ├── websearch.ts              # Integração Tavily
│   │   └── suggestion-engine.ts      # Matching de arquétipos
│   ├── data/
│   │   └── arquetipos.json           # 11 arquétipos predefinidos
│   └── App.tsx
├── electron/
│   └── main.cjs                      # Processo principal Electron + IPC
├── scripts/
│   ├── teste-fluxo-completo.mjs      # Script de e2e (user runs manually)
│   └── gerar-icone.mjs               # Gerador de ícone do app
├── build/
│   └── icon.svg                      # Ícone da aplicação
├── package.json
└── vite.config.ts
```

## 🔐 Segurança & Privacidade

- **Sem backend**: Chamadas LLM vão direto dos provedores (não passam por gateway)
- **Chaves de API**: Armazenadas localmente em variáveis de ambiente `.env.local` (nunca commitadas)
- **Dados offline**: Todos os dados do projeto ficam no computador local até exportação explícita
- **Validação determinística**: Motor de conformidade valida regras antes de qualquer LLM, nunca silenciosamente

## 📚 Referências

- **Ofício Conjunto 45/2026** — Diretrizes técnicas
- **Ofício Conjunto 46/2026** — Vedações e cota de equidade
- **Proposta Definitiva** — Acordo de reparação (Anexo I.1)

## 🙋 Suporte

Para dúvidas sobre o projeto, abra uma issue no repositório.

## 📄 Licença

Todos os direitos reservados © 2026 Artur Colito

---

**Versão**: 0.3.0  
**Última atualização**: 2026-07-08
