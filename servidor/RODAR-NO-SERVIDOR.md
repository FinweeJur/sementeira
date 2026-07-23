# Rodar a Sementeira web no PC servidor (Windows)

Guia para colocar `app.sementeiraprojetos.com.br` no ar a partir de um PC
Windows que fica ligado. O túnel já foi criado em outra máquina; este PC só
**roda** o que já existe.

Pré-requisitos deste PC: **Node.js**, **git** e **cloudflared** instalados.
Confira com:

```powershell
node --version
git --version
cloudflared --version
```

Se algum faltar: Node em https://nodejs.org (versão LTS), git em
https://git-scm.com, cloudflared em https://github.com/cloudflare/cloudflared/releases
(baixe `cloudflared-windows-amd64.exe`, renomeie para `cloudflared.exe` e ponha
numa pasta do PATH).

---

## 1. Baixar e compilar o app

```powershell
cd C:\
git clone https://github.com/FinweeJur/sementeira.git
cd sementeira
npm ci
npm run build
```

O `npm run build` gera a pasta `dist\`, que é o app pronto que o servidor serve.

## 2. Configurar as chaves de IA

```powershell
copy servidor\.env.example servidor\.env
notepad servidor\.env
```

Preencha:

- `SEMENTEIRA_TOKEN` — gere um com
  `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
  e cole. **O mesmo token vai nas Configurações do app** (campo "Token de acesso
  ao servidor"), senão a IA não responde.
- `DEEPSEEK_API_KEY`, `MARITACA_API_KEY`, `TAVILY_API_KEY` — preencha o que
  tiver. A Maritaca é a que mais justifica o servidor (ela recusa chamada direta
  do navegador). Pode preencher só uma.

Este arquivo **nunca sai da máquina** e não vai para o GitHub (o `.gitignore`
cobre `.env`).

## 3. Instalar a credencial do túnel

O túnel `sementeira` (id `0c10d031-1b13-4fd6-839a-db961f8ed040`) já existe. Para
rodá-lo aqui, este PC precisa do **arquivo de credencial**, que está na máquina
onde o túnel foi criado, em:

```
C:\Users\teste\.cloudflared\0c10d031-1b13-4fd6-839a-db961f8ed040.json
```

**Copie esse arquivo** (por pen drive ou rede — é um segredo, não mande por
e-mail nem chat) para a mesma pasta neste PC:

```
C:\Users\<SEU-USUARIO>\.cloudflared\0c10d031-1b13-4fd6-839a-db961f8ed040.json
```

Se a pasta `.cloudflared` não existir, crie:
`mkdir $env:USERPROFILE\.cloudflared`

> Só este `.json` é preciso para RODAR. O `cert.pem` da outra máquina **não**
> vem — ele serve para criar/gerenciar túneis, não para rodar.

## 4. Configurar o túnel

```powershell
copy C:\sementeira\servidor\config.exemplo.yml $env:USERPROFILE\.cloudflared\config.yml
notepad $env:USERPROFILE\.cloudflared\config.yml
```

Troque `<SEU-USUARIO>` na linha `credentials-file` pelo nome de usuário deste PC
(o que aparece em `C:\Users\`).

## 5. Testar tudo junto, uma vez, na mão

Abra **dois** terminais.

Terminal 1 — o servidor do app:

```powershell
cd C:\sementeira
node servidor\sementeira-servidor.cjs
```

Deve dizer `Sementeira web em http://127.0.0.1:7010`. Confira abrindo esse
endereço no navegador deste PC — o app tem que aparecer.

Terminal 2 — o túnel:

```powershell
cloudflared tunnel run sementeira
```

Deve conectar (linhas `Registered tunnel connection`). Agora abra
`https://app.sementeiraprojetos.com.br` de **qualquer** dispositivo — tem que
abrir o app.

Se abrir, funcionou. Feche os dois terminais (Ctrl+C) e siga para o passo 6,
que faz isso subir sozinho.

## 6. Fazer subir sozinho quando o PC liga

Duas coisas precisam iniciar no logon: o servidor Node e o túnel.

**cloudflared como serviço** (roda sempre, nem precisa de login):

```powershell
cloudflared service install
```

**Servidor Node como tarefa agendada:**

```powershell
$acao = New-ScheduledTaskAction -Execute "node" `
  -Argument "C:\sementeira\servidor\sementeira-servidor.cjs" -WorkingDirectory "C:\sementeira"
$gatilho = New-ScheduledTaskTrigger -AtStartup
$conta = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Register-ScheduledTask -TaskName "Sementeira Web" -Action $acao -Trigger $gatilho -Principal $conta
```

Reinicie o PC e confirme que `https://app.sementeiraprojetos.com.br` abre sem
você ter aberto terminal nenhum.

---

## Atualizar o app depois

Quando houver versão nova no GitHub:

```powershell
cd C:\sementeira
git pull
npm ci
npm run build
```

E reinicie a tarefa "Sementeira Web" (ou o PC). O túnel não precisa mexer.

---

## Se algo não abrir

- **`https://app.sementeiraprojetos.com.br` dá erro 1033 ou "tunnel not found"**
  → o túnel não está rodando, ou o CNAME `app` no painel da Cloudflare não foi
  criado/está cinza. Ele tem que ser **laranja (proxied)**, apontando para
  `0c10d031-1b13-4fd6-839a-db961f8ed040.cfargotunnel.com`.
- **Erro 502** → o túnel está de pé, mas o servidor Node não. Confira o Terminal 1
  / a tarefa agendada.
- **O app abre mas a IA não responde** → o `SEMENTEIRA_TOKEN` do `.env` e o das
  Configurações do app estão diferentes, ou a chave do provedor não foi
  preenchida. Cheque `http://127.0.0.1:7010/api/saude` neste PC.
