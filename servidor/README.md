# Servidor da versão web

Serve o app da Sementeira pelo navegador e funciona como gateway de IA para os
provedores que o navegador não consegue chamar direto.

**Endereço de produção pretendido:** `app.sementeiraprojetos.com.br`
**O que fica onde:** o app em `/`, o gateway em `/api/`. Um hostname só —
mesma origem, sem CORS entre os dois, um registro DNS a menos.

---

## Por que existe um gateway, se a decisão do projeto é não ter backend

A decisão continua valendo **para o programa instalado**, que segue chamando o
provedor direto do processo main, sem servidor nenhum. O gateway é **opcional e
exclusivo da versão web**, e existe por uma limitação medida, não por gosto.

Preflight CORS real, feito em 2026-07-23 com a origem de produção:

| Provedor | Chamada direta do navegador | O que respondeu |
|---|---|---|
| DeepSeek | ✅ funciona | ecoa a origem em `access-control-allow-origin` |
| Tavily | ✅ funciona | idem |
| Maritaca / Sabiá | ❌ recusa | `400 Disallowed CORS origin` |
| Ollama (na máquina de quem acessa) | ⚠️ com ressalvas | ver abaixo |

Ou seja: **quem quiser usar Maritaca pelo navegador precisa do gateway.** Quem
usa DeepSeek não precisa de nada disto — configura a própria chave e pronto.

### Ollama pelo navegador

Funciona, mas exige duas coisas de quem acessa:

1. **Permissão do navegador.** O Chrome 142 passou a exigir consentimento para
   um site público falar com `127.0.0.1` (Local Network Access). Aparece um
   pedido; é preciso aceitar. O servidor local não precisa de header especial.
2. **Autorização no Ollama.** Por padrão ele só aceita chamadas de `localhost`.
   Para aceitar o site, precisa subir com:

   ```
   OLLAMA_ORIGINS=https://app.sementeiraprojetos.com.br
   ```

   A tela de Configurações do app já mostra essa linha pronta, com o endereço
   certo. É uma configuração manual — na prática, caminho para quem já usa
   Ollama, não para o público geral.

---

## Subir o servidor

```bash
# 1. compilar o app
npm run build

# 2. configurar
cp servidor/.env.example servidor/.env
#    e preencher o .env (veja abaixo)

# 3. subir
node servidor/sementeira-servidor.cjs
```

Abre em `http://127.0.0.1:7010`. O bind é em `127.0.0.1` de propósito: quem
expõe para a internet é o Cloudflare Tunnel, nunca uma porta aberta no
roteador — mesma decisão já adotada no Foz Juris.

### Gerar o token

As rotas de IA exigem `SEMENTEIRA_TOKEN`. Sem ele, ficam desligadas (o app
continua servido normalmente). O hostname é público: **sem token, qualquer
pessoa que descobrisse o endereço gastaria a sua chave de API.**

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

O token vai no `.env` e também nas Configurações do app, no campo "Token de
acesso ao servidor".

### O que o `.env` guarda

`DEEPSEEK_API_KEY`, `MARITACA_API_KEY`, `TAVILY_API_KEY` — as chaves **nunca**
saem da máquina. O navegador manda só um `providerId` de uma lista fechada; se
ele pudesse mandar o endereço, o servidor viraria proxy aberto para qualquer
host.

O `.gitignore` cobre `.env` (foi corrigido junto com este servidor — antes não
cobria).

---

## Expor com o Cloudflare Tunnel

**Pré-requisito que não dá para contornar:** a zona `sementeiraprojetos.com.br`
precisa estar na Cloudflare. Hoje ela está na **Hostinger**
(`byte`/`pixel.dns-parking.com`). Um túnel só cria hostname dentro de uma zona
Cloudflare, e o `*.cfargotunnel.com` não é resolvível por CNAME externo.

### 1. Migrar a zona

No painel da Cloudflare, adicionar o domínio e trocar os nameservers no
registrador. Depois, **recriar os registros do site**, que continua no GitHub
Pages:

| Nome | Tipo | Valor | Proxy |
|---|---|---|---|
| `@` | A | 185.199.108.153 | DNS only (cinza) |
| `@` | A | 185.199.109.153 | DNS only |
| `@` | A | 185.199.110.153 | DNS only |
| `@` | A | 185.199.111.153 | DNS only |
| `www` | CNAME | `finweejur.github.io` | DNS only |

**DNS only** nesses: o certificado do Pages é emitido para o domínio, e passar
pelo proxy da Cloudflare pode conflitar. O hub Floresta de Apps e `/paraopeba/`
continuam servidos pelo Pages, intocados.

### 2. O túnel

O túnel `sementeira` **já foi criado** (id
`0c10d031-1b13-4fd6-839a-db961f8ed040`), reusando a credencial da conta —
sem `tunnel login`, para não sobrescrever o `cert.pem` do Foz Juris, que vive
na mesma conta Cloudflare.

⚠️ **O apontamento (route dns) foi feito pelo painel, não pela CLI.** A CLI
`cloudflared tunnel route dns` falha aqui porque o `cert.pem` está amarrado à
zona do `fozjuris.com.br` — ao rotear na zona da Sementeira ele cria um nome
torto (`app.sementeiraprojetos.com.br.fozjuris.com.br`). O certo é criar na mão,
no painel da Cloudflare → zona `sementeiraprojetos.com.br` → DNS:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `app` | `0c10d031-1b13-4fd6-839a-db961f8ed040.cfargotunnel.com` | **Proxied (laranja)** |

**Laranja** aqui, ao contrário dos registros do site (cinza): endereço de túnel
só funciona proxied.

### 3. Rodar no PC servidor

O túnel roda **em outra máquina** (não na que o criou). O passo a passo completo
— clonar, compilar, copiar a credencial, configurar e pôr para subir sozinho —
está em **[RODAR-NO-SERVIDOR.md](RODAR-NO-SERVIDOR.md)**, com o modelo de
configuração em [config.exemplo.yml](config.exemplo.yml).

---

## Rotas

| Rota | Token | O que faz |
|---|---|---|
| `GET /api/saude` | não | Diz se o servidor está no ar e quais provedores têm chave. É o que o botão "testar conexão" consulta. Nunca devolve chave. |
| `POST /api/llm/chat` | **sim** | `{ providerId, model?, messages, esperaJson? }` |
| `GET /api/llm/ollama/modelos` | **sim** | Modelos do Ollama **do servidor** (não o de quem acessa) |
| `POST /api/websearch` | **sim** | `{ query }` — busca Tavily |

Tudo que não começa com `/api/` é servido de `dist/`, com `index.html` de
fallback (é uma SPA).

---

## Desenvolvimento

`npm run dev` sobe o Vite noutra porta, e o servidor **não emite cabeçalho de
CORS de propósito** — em produção app e gateway são a mesma origem. Para o
gateway funcionar em desenvolvimento, o `vite.config.ts` tem um proxy de `/api`
para `http://127.0.0.1:7010`. Para apontar para outro endereço:

```bash
SEMENTEIRA_SERVIDOR=http://127.0.0.1:9000 npm run dev
```

---

## Quando a máquina desliga

O app **continua abrindo** para quem já o visitou: um service worker guarda o
essencial na primeira visita. Nesse intervalo, só a IA fica indisponível — o
formulário guiado, o motor de conformidade e as exportações seguem funcionando,
e os projetos estão no navegador de quem usa, não aqui.

Verificado matando o processo do servidor e recarregando a página: o app abriu
inteiro, com os projetos, e só `/api/` falhou.
