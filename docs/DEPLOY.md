# Subir para produção — Railway (API + banco) e Vercel (painel)

Três serviços, nesta ordem: **banco**, **API**, **painel**. A ordem importa —
a API precisa da `DATABASE_URL` para subir, e o painel precisa do domínio da
API para saber com quem falar.

Guarde os endereços conforme forem aparecendo; você vai voltar neles no fim,
quando um lado tiver que aprender o nome do outro.

---

## 1. Banco de dados (Railway)

1. [railway.app](https://railway.app) → **New Project** → *Provision PostgreSQL*
2. Confira a **região** antes de criar qualquer coisa em cima. Volumes seguem a
   região do serviço, e mudar depois — com dados dentro — vira migração manual.
   Para clientes no Brasil, quanto mais perto melhor: a Califórnia custa uns
   150–200ms em cada chamada.
3. A `DATABASE_URL` da aba **Variables** é a interna
   (`postgres.railway.internal`) e não sai da rede do Railway. É a que a API usa,
   e você nunca precisa copiá-la à mão — veja a seção de variáveis da API.

**Não habilite "Public Access"** em *Settings → Networking*. Ele expõe o banco na
internet, como o próprio Railway avisa ("anyone with the string can connect"), e
cobra o tráfego como egress. Nada neste guia precisa disso: os comandos de
primeira subida rodam pela aba **Console**, já dentro do container.

Se um dia precisar abrir o banco no DBeaver, use o túnel em vez da exposição:

```bash
railway connect Postgres --tunnel-only
```

---

## 2. API (Railway)

### Criar o serviço

**New** → **GitHub Repo** → `mizaeldragon/clinicaSaaS`.

Em *Settings* → **Root Directory: `backend`**. Sem isso o build tenta a raiz do
monorepo e não acha o `package.json`.

O resto já está no repositório (`backend/railway.json`): build por Nixpacks,
`prisma migrate deploy` no start — então toda subida aplica as migrations
sozinha — e healthcheck em `/api/v1/health`.

### Volume para as imagens

O serviço precisa **já existir** (primeiro deploy feito) — antes disso a opção
nem aparece. Depois, no canvas do projeto: botão **+ New** → **Volume** → escolha
o serviço **clinicaSaaS** (não o Postgres, que já tem o seu) → **Mount path:
`/app/uploads`**.

Sem isso as logos e fotos que a Márcia subir **desaparecem a cada deploy** — o
disco do container é recriado do zero toda vez. O caminho precisa bater exato: o
`uploads.routes.ts` grava em `process.cwd()/uploads`, e `process.cwd()` no
container é `/app`. Errado, o volume monta num lugar vazio e as imagens somem
sem nenhum erro aparecer.

### Variáveis

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
TIMEZONE=America/Sao_Paulo

JWT_SECRET=<gere abaixo>
REFRESH_TOKEN_SECRET=<gere abaixo>
ENCRYPTION_KEY=<gere abaixo>

APP_URL=https://painel.seu-dominio.com.br
PUBLIC_URL=https://api.seu-dominio.com.br
CORS_ORIGINS=https://painel.seu-dominio.com.br

REDIS_ENABLED=false
```

Gerar os segredos (cada um diferente, 48 bytes):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> Os segredos do seu `.env` local **não servem** aqui. Quem já viu aquele
> arquivo consegue forjar um login válido.

`CORS_ORIGINS` é a lista de quem pode chamar a API pelo navegador. Só o domínio
do painel — em produção o curinga `*` é recusado de propósito.

Ainda não tem domínio próprio? Use por enquanto os endereços que o Railway e a
Vercel geram (`*.up.railway.app` e `*.vercel.app`) e volte aqui depois.

### Primeira subida: os planos e a sua conta

O banco nasce vazio, e duas coisas precisam existir antes de qualquer pessoa
conseguir entrar. Ambas pela aba **Console** do serviço no Railway — ela abre um
terminal dentro do container, com a `DATABASE_URL` já no ambiente. Nada a
configurar na sua máquina, nada de túnel.

**1. Os planos**

```bash
npm run seed:plans
```

Cria **apenas os três planos** — Starter, Pro e Premium. Nenhuma empresa,
nenhum cliente, nenhum agendamento: o banco continua zerado no que interessa. É
`upsert` por slug, então dá para rodar de novo depois se você ajustar um preço.

Não é opcional: sem plano ativo o cadastro recusa a primeira empresa
(`auth.service.ts`, "Nenhum plano disponível para assinatura"), e a tela que
criaria um plano é do super admin — que também não existe num banco vazio.

**2. A sua conta de super admin**

É a que abre `/admin`: métricas da plataforma, MRR, empresas e catálogo de
planos. Não dá para criar pela tela — o super admin não tem empresa, e o
cadastro só sabe criar empresa.

Defina nas **Variables** do serviço:

```
SUPERADMIN_EMAIL=voce@seu-dominio.com.br
SUPERADMIN_PASSWORD=<uma senha forte e só sua>
SUPERADMIN_NAME=Seu Nome
```

E no Console:

```bash
npm run seed:admin
```

Depois **apague as três variáveis**. Nada no sistema as lê depois que a conta
existe, e senha guardada em variável é senha que qualquer pessoa com acesso ao
projeto lê — sendo essa a conta mais poderosa que existe aqui.

A senha passa pela mesma regra de todo mundo: 8 a 72 caracteres, e recusada se
já apareceu em vazamento conhecido. Rodar o comando de novo **não** troca a
senha de uma conta existente — para isso, use "Esqueci minha senha" no painel
(o que exige SMTP configurado).

> **Nunca rode `npm run seed`** (sem sufixo) contra produção: ele cria as
> empresas e contas de demonstração, cujas senhas estão publicadas neste
> repositório.

E se algum dia você apontar a `DATABASE_URL` da sua máquina para produção,
feche a janela depois: um `npm run test:e2e` distraído roda
`migrate reset --force` e **apaga o banco do cliente**.

---

## 3. Painel (Vercel)

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → o mesmo repositório
2. **Root Directory: `frontend`**
3. Framework, build e saída já vêm do `frontend/vercel.json` — não mexa
4. Em **Environment Variables**:

```
VITE_API_URL=https://api.seu-dominio.com.br/api/v1
```

Com o `/api/v1` no fim. O WebSocket deriva a origem daí sozinho — sem essa
variável ele tentaria se conectar à própria Vercel, que não tem WebSocket.

> Variável de front entra no build. Mudou? Precisa **redeploy**, não basta
> salvar.

O `vercel.json` também cuida de duas coisas fáceis de esquecer: manda toda rota
para o `index.html` (senão recarregar `/app/agenda` — ou abrir o link público
que a cliente recebeu — devolve 404) e fixa os cabeçalhos de segurança.

---

## 4. Ligar as pontas

Depois que os três estiverem no ar, com os domínios definitivos:

| Onde | Variável | Valor |
|---|---|---|
| Railway | `CORS_ORIGINS` | o domínio da Vercel |
| Railway | `APP_URL` | o domínio da Vercel |
| Railway | `PUBLIC_URL` | o domínio da própria API |
| Vercel | `VITE_API_URL` | o domínio da API + `/api/v1` |

Redeploy nos dois.

### Conferir

```bash
curl https://api.seu-dominio.com.br/api/v1/health
```

Deve responder `{"status":"ok",...}`. Depois abra o painel, cadastre a primeira
empresa e confirme que entra.

---

## 5. E-mail (antes de entregar para alguém)

Esta é a única parte desta lista que **bloqueia o lançamento de verdade**.

Sem SMTP o sistema sobe e funciona, mas o "esqueci minha senha" não chega a
ninguém — e não existe tela de admin para redefinir a senha de um cliente. Quem
esquecer a senha fica trancado para fora **em definitivo**. A cliente também
não recebe confirmação de agendamento.

O token de redefinição chega a ser criado no banco; só o e-mail não sai. Em
produção o link **não** é escrito no log de propósito: ele vale por uma hora e
daria acesso à conta para quem lesse o log da hospedagem.

```
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
MAIL_FROM=CliniStudio <nao-responda@seu-dominio.com.br>
```

Em produção, SMTP ausente é registrado como **erro** no log, não como aviso.

Depois de configurar, prove que funciona antes de confiar: peça um "esqueci
minha senha" para um e-mail seu e confirme que a mensagem chega — inclusive
olhando o spam. Remetente novo costuma cair lá, e um link de redefinição no
spam é o mesmo que link nenhum.

---

## 6. Cobrança (quando for cobrar)

```
ASAAS_API_KEY=<do painel do Asaas>
ASAAS_ENV=production
ASAAS_WEBHOOK_TOKEN=<você inventa>
BILLING_GRACE_DAYS=5
```

No painel do Asaas, cadastre o webhook em
`https://api.seu-dominio.com.br/api/v1/webhooks/asaas` com **esse mesmo token**.
Ele chega no header `asaas-access-token`; sem conferir, qualquer um postaria
"pagamento confirmado" e liberaria o sistema de graça.

Comece em `sandbox`. **Enquanto não houver `ASAAS_API_KEY`, nenhuma conta é
bloqueada** — o sistema não tranca quem não teria como pagar.

---

## 7. Filas (opcional)

Com `REDIS_ENABLED=false` a API sobe sem Redis e some apenas o **disparo
automático** de lembretes e das cobranças recorrentes de aluguel. Para ligar:
adicione um Redis no Railway, ponha `REDIS_ENABLED=true`,
`REDIS_URL=${{Redis.REDIS_URL}}` e um segundo serviço com
`startCommand: node dist/jobs/worker.js`.

---

## Depois de estar no ar

- **Backup fora do Railway.** O snapshot deles fica no mesmo lugar que o banco.
  Nenhuma outra defesa recupera dado apagado. Uma vez só:

  ```powershell
  .\scripts\agendar-backup.ps1 -Url "<DATABASE_PUBLIC_URL>" -Destino "D:\backups\clinistudio"
  ```

  Isso guarda a URL num arquivo que só o seu usuário lê, registra a tarefa
  diária no Agendador do Windows e **roda um backup na sua frente** para provar
  que funciona. O `backup-db.ps1` confere cada dump com `pg_restore --list` e se
  recusa a rodar a rotação quando o dump sai vazio ou ilegível — senão uma
  `-Url` errada apagaria, em duas semanas, todos os backups bons.

  Conferir depois: `Get-ScheduledTaskInfo -TaskName 'CliniStudio - backup do banco'`
  (`LastTaskResult` 0 é sucesso).

  Duas coisas que o script **não** resolve: ele depende deste computador estar
  ligado, e um backup nunca restaurado é só uma suposição — teste um
  `pg_restore` num banco descartável de vez em quando. E não tente mover isso
  para o GitHub Actions: **o repositório é público** e o dump viraria um
  artifact baixável por qualquer pessoa.
- **O CI já roda sozinho.** `.github/workflows/ci.yml` confere tipos, lint,
  build e `npm audit --omit=dev` dos dois lados a cada push na `main` e em cada
  PR. Railway e Vercel buildam em paralelo com isso, então o CI não segura o
  deploy — ele te avisa. Vale ligar a proteção do branch em *Settings › Branches*
  se quiser que segure de fato.
- **Cloudflare na frente**, se DDoS preocupar. Os limites por IP da API seguram
  um atacante; uma botnet, não.
- **Alertas de segurança do GitHub ligados**: *Settings › Code security* →
  *Dependabot alerts*. Só avisa; não abre PR. As **atualizações automáticas**
  ficam desligadas de propósito — atualização de rotina vira ruído, e quem
  decide a hora de mexer numa biblioteca é você.
- **Conferir vulnerabilidades de vez em quando**, ou quando um alerta chegar:
  `npm audit --omit=dev` nas duas pastas. Só `--omit=dev` interessa — falha em
  ferramenta de desenvolvimento não vai para o ar.
- **Senha da Márcia**: ela vai escolher no cadastro. O sistema recusa senha que
  já vazou, mas vale pedir que ligue a verificação em duas etapas em
  *Configurações › Minha conta* — é o que protege a conta mesmo que a senha
  vaze depois.

---

## Quando algo der errado

| Sintoma | Causa quase sempre |
|---|---|
| Build falha, "no package.json" | falta **Root Directory** (`backend` / `frontend`) |
| Build falha com `EBUSY: rmdir '/app/node_modules/.cache'` (exit 240) | é `npm ci` no `buildCommand`. O Railway monta um cache de build dentro do `node_modules`, e o `npm ci` apaga a pasta inteira antes de instalar — esbarra no ponto de montagem. O [railway.json](../backend/railway.json) usa `npm install`, que instala por cima sem apagar e respeita o `package-lock.json` igual |
| Painel abre, login dá erro de rede | `VITE_API_URL` errada, ou faltou redeploy da Vercel |
| Login responde mas o navegador bloqueia | `CORS_ORIGINS` sem o domínio exato do painel (com `https://`, sem barra no fim) |
| 404 ao recarregar `/app/agenda` | `vercel.json` não subiu, ou Root Directory errado |
| "Nenhum plano disponível para assinatura" | falta rodar `npm run seed:plans` |
| Logo some depois do deploy | falta o volume em `/app/uploads` |
| Tudo em horário errado | falta `TIMEZONE=America/Sao_Paulo` |
