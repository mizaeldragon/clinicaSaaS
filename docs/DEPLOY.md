# Subir para produção — Railway (API + banco) e Vercel (painel)

Três serviços, nesta ordem: **banco**, **API**, **painel**. A ordem importa —
a API precisa da `DATABASE_URL` para subir, e o painel precisa do domínio da
API para saber com quem falar.

Guarde os endereços conforme forem aparecendo; você vai voltar neles no fim,
quando um lado tiver que aprender o nome do outro.

---

## 1. Banco de dados (Railway)

1. [railway.app](https://railway.app) → **New Project** → *Provision PostgreSQL*
2. Na aba **Variables** do serviço, anote as duas:
   - `DATABASE_URL` — a interna (`postgres.railway.internal`). É a que a API usa:
     não sai da rede do Railway.
   - `DATABASE_PUBLIC_URL` — a externa. Serve para você abrir no DBeaver e para
     rodar o seed dos planos da sua máquina.

> A senha do banco é gerada pelo Railway. Não reaproveite a senha do seu
> Postgres local — ela circula em texto puro no seu `.env` e no DBeaver.

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

*Settings* → **Volumes** → **Mount path: `/app/uploads`**.

Sem isso as logos e fotos que a Márcia subir **desaparecem a cada deploy** — o
disco do container é recriado do zero toda vez.

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

### Primeira subida: criar os planos

O banco nasce vazio, e **sem planos o cadastro recusa a primeira empresa**. Uma
vez só, da sua máquina:

```powershell
$env:DATABASE_URL="<a DATABASE_PUBLIC_URL do Railway>"
```

```bash
cd backend && npm run seed:plans
```

Isso cria **apenas os três planos** — Starter, Pro e Premium. Nenhuma empresa,
nenhum cliente, nenhum agendamento: o banco continua zerado no que interessa. É
`upsert` por slug, então dá para rodar de novo depois se você ajustar um preço.

Não é opcional: sem plano ativo o cadastro recusa a primeira empresa
(`auth.service.ts`, "Nenhum plano disponível para assinatura"), e a tela que
criaria um plano é do super admin — que também não existe num banco vazio.

Nunca rode `npm run seed` contra produção:
ele cria as contas de demonstração, cujas senhas estão publicadas neste
repositório.

Feche essa janela do PowerShell depois. Com a `DATABASE_URL` apontando para
produção, um `npm run test:e2e` distraído roda `migrate reset --force` e
**apaga o banco do cliente**.

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
| Painel abre, login dá erro de rede | `VITE_API_URL` errada, ou faltou redeploy da Vercel |
| Login responde mas o navegador bloqueia | `CORS_ORIGINS` sem o domínio exato do painel (com `https://`, sem barra no fim) |
| 404 ao recarregar `/app/agenda` | `vercel.json` não subiu, ou Root Directory errado |
| "Nenhum plano disponível para assinatura" | falta rodar `npm run seed:plans` |
| Logo some depois do deploy | falta o volume em `/app/uploads` |
| Tudo em horário errado | falta `TIMEZONE=America/Sao_Paulo` |
