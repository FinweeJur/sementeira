# 🌱 Sementeira

### Da ideia ao projeto de reparação — uma ferramenta a mais na caixa de ferramentas da organização popular

---

## Slide 1 — Capa

**Sementeira**
*Transformar uma ideia em um projeto comunitário completo — do dano à reparação.*

App desktop · Windows · funciona sem internet
Construído para pessoas atingidas pelo rompimento da barragem de Brumadinho

---

## Slide 2 — Por que existe

Em 25 de janeiro de 2019, a barragem da Vale rompeu em Brumadinho.
Mais de 270 vidas perdidas. Comunidades destruídas. Rios, terra e modos de vida arrasados.

Seis anos depois, a reparação ainda é uma luta.

A **Proposta Definitiva do Acordo** prevê que as próprias comunidades proponham projetos de reparação pelo **Anexo I.1** — mas chegar até uma proposta formal, que respeite todas as regras, exige conhecimento técnico que nem sempre está ao alcance.

> A Sementeira existe para encurtar esse caminho: ajuda a pessoa atingida a chegar preparada até a Governança Popular.

---

## Slide 3 — O que é a Sementeira

Um aplicativo de computador (Windows, offline-first) que guia uma pessoa atingida na construção de um **projeto comunitário completo** para o Anexo I.1:

- Da ideia inicial ao documento exportável
- Com motor de conformidade que conhece as regras do Ofício 46
- Com simulador de sustentabilidade ("o dia seguinte ao fim do dinheiro")
- Com inteligência artificial que ajuda a redigir, revisar e lapidar

**Não substitui a Governança Popular — prepara o material antes dela.**

---

## Slide 4 — Do dano ao documento (1/2)

**1. Começa pela ideia, não por um formulário em branco**
Você conta a ideia com suas palavras. O copiloto de IA sugere o dano coletivo e o tipo de projeto mais próximo.

**2. Gera um rascunho completo, com pesquisa real**
A IA propõe objetivo, justificativa, metas, orçamento e formas de arrecadação. Quando há internet, busca dados públicos (Censo/IBGE, preços de mercado, editais) — sempre citando a fonte.

**3. Aponta o que é proibido, em tempo real**
Um motor de conformidade compara cada linha do projeto contra as vedações do Ofício 46 e sinaliza:

> 🟢 Tudo certo · 🟡 Atenção · 🔴 Bloqueio

---

## Slide 5 — Do dano ao documento (2/2)

**4. Simula "o dia seguinte ao fim do dinheiro"**
Três cenários (otimista, realista, pessimista) mostram se o projeto se sustenta sozinho depois do repasse — incluindo depreciação de equipamentos. Gera o Plano Obrigatório de Sustentabilidade automaticamente.

**5. Refina com um ciclo de agentes de IA**
O "Ciclo de Lapidação" roda seis papéis especializados que reescrevem, criticam e consolidam uma versão melhorada. **Nada é aplicado sem aprovação humana.** Toda versão pode ser revertida.

**6. Exporta tudo pronto**
PDF, DOCX e XLSX do projeto completo, do ecossistema e do clube de benefícios.

---

## Slide 6 — A IA trabalha pra você

A inteligência artificial da Sementeira opera em **três camadas independentes**, com o motor determinístico sempre como palavra final:

| Camada | O que faz | Decide sozinha? |
|--------|-----------|-----------------|
| 🪄 **Copiloto** | Faz perguntas, sugere melhorias, gera rascunhos | Não — tudo é revisável |
| 🔁 **Lapidação** | 6 agentes refinam o projeto em sequência | Não — exige aprovação humana |
| 🛡 **Revisão** | Segundo agente confere contra o Ofício 46 | Não — mostra divergências |

> A IA é sugestão. O motor de conformidade determinístico é a lei.

Provedores suportados: **DeepSeek**, **Maritaca/Sabiá** ou **Ollama local** (offline, privado).

---

## Slide 7 — Visão de portfólio

Quando há dois ou mais projetos cadastrados, a Sementeira revela a economia circular entre eles:

- 🌐 **Ecossistema de projetos** — mapa da região dos ~26 municípios da bacia do Paraopeba, análise de complementaridades e redundâncias
- ⚖️ **Comparação lado a lado** — até 3 projetos simultaneamente para identificar sobreposições e lacunas
- 🎟️ **Clube de benefícios** — conecta os produtos de cada projeto às famílias atingidas
- 🙋 **Voluntários** — cadastro de pessoas disponíveis para mutirões
- 🤖 **Copiloto de portfólio** — converse por texto para lapidar, exportar ou consultar o status de qualquer projeto

---

## Slide 8 — O que a Sementeira NÃO é

É tão importante saber o que ela **não faz**:

- ❌ Não é um app de denúncia, mobilização ou convocação de atos
- ❌ Não substitui as Comissões de Atingidos, as assembleias ou a Governança Popular
- ❌ Não tem versão mobile nem link público (ainda)
- ❌ Não decide nada sozinha — toda sugestão de IA é revisável

> A Sementeira é uma ferramenta a mais na caixa de ferramentas da organização popular — não uma substituta dela.

---

## Slide 9 — Por trás da ferramenta

A Sementeira nasce da luta do **Movimento dos Atingidos por Barragens (MAB)** pela reparação integral depois do rompimento da barragem da Vale em Brumadinho.

A Proposta Definitiva do Acordo já previa uma "Sementeira de Ideias" para que as pessoas atingidas sugerissem projetos de forma simplificada.

Este aplicativo é a versão **digital, guiada e ciente das regras** dessa Sementeira.

**Privacidade por设计:**
- Sem backend compartilhado — chamadas de IA vão direto do computador do usuário
- Dados ficam no computador local até exportação explícita
- Funciona offline (exceto IA e pesquisa web)

---

## Slide 10 — Stack e estado atual

**Tecnologia:**
Electron 40 · React 19 · TypeScript · Tailwind 4 · Leaflet + Three.js
LLM direto do processo main (sem gateway) · Deep Research via Tavily · pdfjs-dist + mammoth

**Status (julho 2026):**
- 11 arquétipos de projetos pré-configurados
- Motor de conformidade codificando Ofício 46
- Simulador de sustentabilidade com depreciação
- Ciclo de Lapidação com 6 agentes + histórico de versões
- Ecossistema, comparação, clube de benefícios, voluntários
- Copiloto de portfólio · Importação via PDF/DOCX
- Exportação PDF/DOCX/XLSX

**Licença:** © 2026 Artur Colito — todos os direitos reservados

---

## Slide 11 — Fechamento

> *"A luta é por reparação integral. A Sementeira é a ferramenta que ajuda a escrever, em linguagem técnica, o que a comunidade já sabe que precisa."*

🌱 **Sementeira**
Da ideia à reparação.

---

## Cores e identidade visual

**Paleta (espelhada do app):**
- Fundo escuro: `#0f1410` (terra de noite)
- Painel: `#171d17` (sombra da mata)
- Verde accent: `#6fae55` (broto)
- Verde ênfase: `#4caf50` (folha madura)
- Amarelo: `#d4a017` (terra/semente)
- Vermelho: `#d1453b` (alerta/bloqueio)
- Texto: `#e9efe6` (clarity)

**Tom:** Luta, dignidade, reparação. Sem piegas, sem tecnocracia. Português simples, direto, respeitoso com quem foi atingido.
