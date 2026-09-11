# Belezza — SaaS multiempresa para beleza, estética e clínicas

Plataforma SaaS **multi-tenant e modular** para gestão de salões, studios, barbearias,
clínicas de estética e espaços compartilhados de beleza.

Cada empresa ativa **apenas os módulos de que precisa** — do studio de manicure com uma
profissional até a clínica com salas, equipe, recepção e aluguel de espaços.

- Arquitetura completa: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)
- Subir para produção: [docs/DEPLOY.md](docs/DEPLOY.md) — Railway (API + banco) e Vercel (painel)

---

## Stack

| Camada | Tecnologias |
|---|---|
| Backend | Node.js 22, TypeScript strict, Express 4, PostgreSQL 16, Prisma ORM, Redis, BullMQ, Socket.IO, Zod, JWT |
| Frontend | React 18, Vite, TypeScript, TailwindCSS, componentes no estilo shadcn/ui (Radix + CVA), React Router, TanStack Query, Zustand, Recharts |
| Infra dev | Docker Compose (PostgreSQL + Redis) |

---

## Como rodar

Pré-requisitos: **Node.js 20+** e um **PostgreSQL 14+** rodando na máquina
(instalação nativa; o pgAdmin ou o DBeaver servem para olhar o banco).

### 1. Banco de dados, `.env`, migrations e seed

```powershell
.\scripts\setup-local.ps1
```

O script pede a senha do usuário `postgres`, cria o banco `belezza` se ele
ainda não existir, grava a `DATABASE_URL` no `backend/.env` (com a senha
codificada, para um `@` ou `#` não quebrar a URL), aplica as migrations e roda
o seed. Pode ser rodado de novo à vontade — se o banco já existe, ele passa
adiante. Aceita `-Database`, `-Port` e `-SkipSeed`.

Na mão, se preferir: crie o banco (`psql -U postgres -h localhost -c "CREATE
DATABASE belezza"`, ou no DBeaver com o direito na conexão → *Create* →
*Database*), copie `.env.example` para `.env`, troque `SUA_SENHA` na
`DATABASE_URL` e rode `npx prisma migrate deploy && npm run seed`.

### 2. Backend

```bash
cd backend && npm install && npm run dev
```

API em `http://localhost:3333/api/v1`. As imagens enviadas ficam em
`backend/uploads/` e são servidas em `/uploads`.

O processo roda no fuso **America/Sao_Paulo** (`TIMEZONE` no `.env`), fixado
antes de qualquer data ser calculada — a agenda trabalha com horário de parede e
sairia deslocada num servidor em UTC.

### 3. Filas (opcional)

O `.env.example` vem com `REDIS_ENABLED=false`: a API sobe sem Redis e as filas
viram no-op — some só o disparo automático de lembretes e das cobranças
recorrentes de aluguel. Para ligá-las, suba um Redis, ponha `REDIS_ENABLED=true`
e rode o worker em outro terminal:

```bash
cd backend && npm run dev:worker
```

### 4. Frontend

```bash
cd frontend && npm install && npm run dev
```

- Landing do produto: `http://localhost:5173/`
- Painel: `http://localhost:5173/app` (o Vite já faz proxy de `/api` e `/socket.io`)

A landing usa a mesma linguagem visual do login: fundo `slate-950` com os halos
violeta e rosa, alternando seções escuras e claras. O painel é **white label** —
a empresa escolhe a cor em *Configurações › Empresa* e ela pinta menu, botões,
gráficos e a página pública de agendamento. Ao sair, a cor da empresa é
devolvida ao padrão para não vazar para o login nem para a landing.

> O `docker-compose.yml` na raiz continua no repositório como atalho opcional
> (PostgreSQL em `5433`, Redis em `6380`) para quem preferir containers a uma
> instalação local. Não é o caminho padrão.

---

## Contas de demonstração (criadas pelo seed)

| Perfil | E-mail | Senha | O que demonstra |
|---|---|---|---|
| Admin da clínica | `admin@clinicabella.com` | `bella@12345` | Plano **Pro** — clínica completa, **sem aluguel** |
| Recepcionista | `recepcao@clinicabella.com` | `bella@12345` | Permissões restritas (sem usuários/configuração) |
| Profissional | `juliana@clinicabella.com` | `bella@12345` | Enxerga apenas a própria agenda e comissões |
| Studio pequeno | `lu@studionails.com` | `studio@12345` | Mesmo Pro, mas **só 4 módulos ligados** no onboarding |
| Espaço compartilhado | `marcia@marciavaz.com.br` | `marcia@12345` | Plano **Premium** — **aluguel por turno** + link público |
| Locatária | `ana@marciavaz.com.br` | `marcia@12345` | Aluga turnos e enxerga só os próprios turnos e agenda |
| Super admin do SaaS | `admin@saas.com` | `admin@12345` | Painel da plataforma (empresas, planos, MRR) |

### Os planos decidem o que a empresa vê

São **dois planos**, e o que os separa é a locação:

| Plano | Preço | Para quem | Aluguel de espaços |
|---|---|---|---|
| **Pro** | R$ 300,00 | a clínica que atende as próprias clientes — agenda, equipe, salas, financeiro, comissões e relatórios | **não** |
| **Premium** | R$ 450,00 | o espaço compartilhado: tudo do Pro mais locação por turno ou diária e link público individual por profissional | **sim** |

É o plano que corta, não só o wizard: uma clínica no Pro **não vê "Aluguel"** no
menu, e a API recusa `/rentals` com `MODULE_DISABLED` mesmo que alguém digite o
endereço na barra. No onboarding, um módulo fora do plano aparece como
*"Disponível no plano Premium"* — desligado, com o caminho do upgrade à vista.

O *Studio Nails Lu* assina o mesmo **Pro** da clínica, mas ligou só quatro
módulos no onboarding — é a diferença entre o que o plano **permite** e o que a
empresa **escolheu**. Comparar os três logins mostra os dois cortes agindo
juntos: o menu, as rotas e o dashboard mudam conforme o plano e os módulos ativos.

### Espaço compartilhado (aluguel por turno + agendamento público)

O *Espaço Márcia Vaz* demonstra o cenário de coworking de beleza:

- 3 áreas — salão de cabelo e mesas de manicure **alugadas por turno**, e a sala de
  estética onde a dona atende;
- turnos fixos (Manhã / Tarde / Noite) com **preço por espaço × turno**;
- contratos recorrentes ("toda terça e quinta de manhã") que geram as reservas sozinhos;
- **link público do espaço**: `http://localhost:5173/e/espaco-marcia-vaz`
- **link público individual**, um para cada profissional:
  `/e/espaco-marcia-vaz/marcia-vaz`, `/e/espaco-marcia-vaz/ana-ribeiro`

No link do espaço a cliente escolhe o serviço e o sistema mostra **quem está no
espaço naquele dia** — a disponibilidade das locatárias vem dos turnos que elas
alugaram.

Cada profissional também tem **o próprio link** para divulgar no Instagram: ele
mostra a marca da casa, mas só o nome e os serviços dela, e quem abre marca
direto com ela. O endereço aparece no painel de cada uma, pronto para copiar.

#### Cada uma com a sua carteira

A dona aluga imóvel mobiliado; o que acontece dentro dele é negócio de quem
alugou. O sistema trata isso como um segundo nível de isolamento, dentro da
mesma empresa:

| | A dona (estética + locação) | Cada locatária |
|---|---|---|
| Agenda | só os atendimentos dela | só os dela |
| Clientes | só a carteira da estética | só a carteira dela |
| Serviços e preços | só o catálogo da casa | só o catálogo dela |
| Caixa | serviços dela + aluguéis recebidos | fora do sistema da dona |
| Sobre quem aluga, vê | espaço, turno, dia e se pagou | — |

A dona **não vê** a agenda, as clientes, o catálogo nem o faturamento de quem
aluga — e uma locatária não vê os da outra. O preço que cada uma pratica é
negócio dela: numa casa onde todas disputam a mesma cliente, a tabela da
vizinha não fica à vista. A locatária nova nasce com o catálogo vazio e monta o
dela; a página pública, essa sim, mostra tudo — é lá que a cliente escolhe, e
ela não sabe de carteira nenhuma. Na agenda da dona os turnos alugados aparecem como
ocupação ("Salão · Manhã · Ana Ribeiro · pago"), nunca como atendimento.

Como as salas são físicas e compartilhadas, o motor de conflitos continua
enxergando tudo: uma agenda invisível segue ocupando o espaço, e a mensagem de
conflito que volta é genérica, sem nome de profissional nem de cliente.

---

## Cobrança da mensalidade (Asaas)

A mensalidade do SaaS é cobrada pelo **Asaas**, por PIX, boleto ou cartão. O
desenho é de espelho, não de fonte: quem decide se uma cobrança foi paga é o
Asaas, e o webhook traz essa decisão para cá. A cópia local existe para o painel
mostrar histórico e segunda via sem depender da API deles a cada tela.

```
ASAAS_API_KEY=...          # sem ela a cobrança fica desligada
ASAAS_ENV=sandbox          # ou production
ASAAS_WEBHOOK_TOKEN=...    # obrigatório em produção
BILLING_GRACE_DAYS=5
```

No painel do Asaas, cadastre o webhook apontando para
`https://sua-api/api/v1/webhooks/asaas` com esse mesmo token. Ele chega no
header `asaas-access-token`; sem conferir, qualquer um poderia postar
"pagamento confirmado" e liberar o sistema de graça.

### Quando o painel tranca

A avaliação é **preguiçosa** — acontece na requisição, lendo as datas da
assinatura. Não depende de job, de Redis nem de cron: numa instalação sem fila
o trial vence do mesmo jeito.

| Situação | O que acontece |
|---|---|
| Trial correndo | tudo liberado; a tela avisa quantos dias faltam |
| Trial vencido | **escrita bloqueada** (402), leitura continua |
| Vencida, dentro da tolerância | liberado, com aviso da data do bloqueio |
| Vencida além da tolerância | escrita bloqueada |
| **Sem `ASAAS_API_KEY`** | **nunca bloqueia** |

Duas decisões que valem explicar. A primeira: **sem gateway não se tranca
ninguém** — não haveria como pagar para destravar, e é o caso do
desenvolvimento e de quem roda por conta própria. A segunda: o que trava é
**escrever**; a agenda do dia continua abrindo, para ninguém deixar cliente na
porta por causa de um boleto. E as rotas de `/billing`, `/company` e `/auth`
ficam sempre de pé — trancar a tela de pagar seria exigir o pagamento e
esconder onde pagar.

Uma assinatura `ACTIVE` com período vencido também bloqueia: acontece quando o
webhook não chegou, e a data manda mais que o rótulo — senão uma entrega falha
viraria mês grátis.

## Senha e e-mail

- **Trocar a senha**: *Configurações › Minha conta*. As sessões dos outros
  aparelhos caem junto.
- **Esqueci minha senha**: link na tela de login. A resposta é a mesma para
  e-mail com e sem conta — se variasse, a rota viraria um verificador de quem
  tem cadastro aqui. O token vale 1 hora, serve uma vez só, e o banco guarda
  apenas o hash dele.
- **Envio**: SMTP via `SMTP_HOST`. Sem isso o e-mail é registrado no log — em
  desenvolvimento o link de redefinição aparece no terminal. Em produção, SMTP
  ausente sai como `error`, não como aviso.

---

## Segurança

O que protege o sistema, e por quê.

### Sessão

| | |
|---|---|
| Access token | JWT de 15 min, **HS256 fixado** na assinatura e na conferência, com emissor e público próprios |
| Refresh token | valor aleatório de 48 bytes; o banco guarda só o HMAC, nunca o token |
| Rotação | cada uso revoga o anterior e emite um par novo |
| **Reuso de token revogado** | derruba **todas** as sessões da pessoa |
| Conta desativada | corta o acesso **na requisição seguinte**, não quando o token vencer |

Fixar o algoritmo fecha a família de ataques de confusão: sem isso, quem
recebe o token decide como verificá-lo a partir do cabeçalho que o próprio
token traz.

A detecção de reuso parte de um fato simples: como a rotação revoga o antigo no
mesmo instante em que entrega o novo, **o cliente honesto nunca reapresenta um
revogado**. Quem faz isso está com uma cópia — ou é o ladrão, ou é a vítima
chegando depois dele. Não dá para saber qual, então a família inteira cai e
todos refazem o login.

A conferência da conta a cada requisição custa uma leitura em cache de 30s, e é
o que faz demitir alguém valer na hora. Quem revoga limpa o cache no ato.

### Senha

Bcrypt com **12 rodadas** (o custo fica dentro do hash, então as senhas antigas
migram sozinhas na próxima troca). O login gasta o mesmo tempo para e-mail que
existe e que não existe — sem isso, o relógio sozinho entregaria quem tem conta
aqui. O token de redefinição vale 1 hora, serve uma vez, e o banco guarda só o
hash dele.

### Entrada

- **Zod em todo body, query e param** — nada chega ao controller sem passar
- **Nenhum `$queryRaw`** no projeto: consulta bruta não passa pela extension que
  isola empresa e carteira
- **Upload conferido nos bytes**, não no `Content-Type` (que quem envia escreve):
  só JPG, PNG e WEBP de verdade entram. **SVG é recusado de propósito** — ele
  executa script quando aberto direto. Nome sorteado, 4 MB, 40 envios por IP a
  cada 10 min
- Permissões avulsas só saem do catálogo; `SUPER_ADMIN` não é atribuível por
  ninguém de dentro de uma empresa

### Limites por IP

| Rota | Teto |
|---|---|
| Geral | 1000/min |
| Login, esqueci e redefinir senha | 10 **falhas** por 15 min (acerto não conta) |
| Página pública — navegar | 120/min |
| Página pública — marcar, remarcar, cancelar | 30 por 10 min |
| Upload | 40 por 10 min |

Contar só o erro no login é o que separa força bruta de um salão inteiro
entrando pela mesma conexão de manhã.

### Log

O log de produção é lido por quem tem acesso ao painel da hospedagem e fica
guardado por semanas. `Authorization`, `Cookie`, o token do webhook, senhas,
tokens e as chaves do `.env` são **apagados** antes de escrever — um
`Authorization` gravado ali é uma sessão viva para quem ler o arquivo.

### Cabeçalhos e origem

`helmet` com `nosniff`, e CORS por lista explícita. O curinga `*` só vale fora
de produção: liberar toda origem junto com `credentials` deixaria qualquer site
abrir chamadas autenticadas em nome de quem estivesse logado.

### Uma porta que ficou aberta e foi fechada

Quando a cobrança pelo Asaas entrou, as rotas antigas de assinatura ficaram no
lugar. `POST /subscription/change-plan` gravava `ACTIVE` com mais um mês de
validade **sem falar com o gateway**: qualquer empresa com o teste vencido se
liberava sozinha, de graça, quantas vezes quisesse. `POST /subscription/cancel`
tinha o defeito espelhado — encerrava no painel e deixava a cobrança correndo
no Asaas.

As duas saíram. `/subscription` é somente leitura; trocar de plano e cancelar
moram em `/billing`, que fala com o gateway. Há teste garantindo que nenhuma
das duas volte.

### Verificação em duas etapas

É a única proteção que continua valendo depois que a senha vaza — e senha vaza
por fora do sistema: site falso, um serviço de terceiro invadido, alguém
olhando por cima do ombro.

Cada pessoa liga a sua em *Configurações › Minha conta*: QR Code, o primeiro
código para provar que o aplicativo funciona, e oito códigos de recuperação
mostrados **uma vez só**. Serve qualquer autenticador (Google, Microsoft,
1Password, Bitwarden).

| | |
|---|---|
| Só liga depois de conferir um código | quem fechou a tela no meio não fica trancado |
| Senha certa devolve um **passe de 5 min**, não a sessão | e o passe não abre nenhuma rota do sistema |
| Segredo **cifrado** no banco (AES-256-GCM) | um dump não vira cópia dos autenticadores |
| Códigos de recuperação em **hash**, uso único | quem lê o banco não entra em conta nenhuma |
| Desligar exige **senha e código** | notebook destrancado não remove a proteção |

### Senha vazada é recusada

Antes de aceitar qualquer senha nova — cadastro, troca, redefinição ou usuário
criado pela empresa — consultamos a base de vazamentos conhecidos. É a defesa
contra *credential stuffing*, o ataque que passa por baixo de todo o resto: se
a pessoa repete aqui a senha de um site que vazou, o invasor acerta na primeira
tentativa e **nenhum limite de força bruta chega a disparar**.

A consulta usa k-anonimato: saem apenas os cinco primeiros caracteres do SHA-1
da senha, voltam alguns milhares de sufixos, e a comparação acontece aqui
dentro. A senha não sai da máquina. Se a consulta não responde, a senha passa —
travar a troca de senha por causa de um serviço de terceiro fora do ar seria
pior que a falta da checagem.

### Aviso de acesso novo

Entrou de um aparelho que nunca apareceu, chega um e-mail. Não previne nada — é
detecção. Se a senha vazar, o sistema não tem como saber que não é você; mas
você sabe, e descobre em minutos em vez de descobrir com a agenda bagunçada.

### Backup

```powershell
.\scriptsackup-db.ps1                 # ultimos 14, em ./backups
.\scriptsackup-db.ps1 -Destino D:kp -Keep 30
```

É a única resposta real a ransomware e a erro humano — nenhuma outra defesa
recupera dado apagado. Restaurar:

```bash
pg_restore --clean --if-exists -d "<URL>" arquivo.dump
```

> Um backup que mora no mesmo disco que o banco não é backup: ransomware cifra
> a pasta inteira. Aponte `-Destino` para outro disco ou sincronize para uma
> nuvem depois.

### Dependências

`npm audit` no backend: **zero vulnerabilidades**.

No frontend restam dois avisos moderados do `react-router` — nenhum alcança
este app: um é de hidratação em SSR (a aplicação é SPA pura, não tem SSR), o
outro é redirecionamento aberto via `<Link>`/`useNavigate`, e **nenhum destino
de navegação aqui vem da URL ou de entrada do usuário**. A correção exige subir
para a v7, uma troca de major que merece sua própria janela.

---

## Testes

```bash
cd backend && npm run test:e2e
```

Reseta o banco, recria o seed e roda as duas suítes end-to-end contra a API
(**199 verificações**):

**`test:smoke` (101)** — autenticação e rotação de refresh token, **isolamento entre
empresas**, feature flags de módulos, prevenção de conflitos de agenda, finalização
de atendimento gerando receita e comissão, dashboards, aluguéis, permissões por
papel, painel do super admin e o **plano decidindo os módulos**: a clínica no Pro
não recebe aluguel nem no menu, nem no dashboard, nem na API; o espaço no Premium
recebe; e uma empresa nova nasce só com o básico, sem destravar aluguel nem
quando responde que aluga — o wizard devolve o que ficou fora do plano. Fecha
com **senha e cobrança**: a troca de senha derruba a senha antiga, "esqueci
minha senha" responde igual para e-mail com e sem conta, o link do e-mail
redefine uma vez só, e a tela de cobrança traz os preços certos, recusa assinar
sem gateway com erro claro em vez de 500 e **não tranca ninguém** quando não há
como pagar. Fecha em **segurança**: token sem assinatura, assinado com outro
segredo ou de outro emissor é recusado; desligar uma conta corta o acesso na
hora, não quando o token vencer; um refresh revogado reapresentado derruba
todas as sessões daquela pessoa; arquivo que não é imagem é recusado mesmo se
declarar `image/png`; permissão fora do catálogo não entra; e o login responde
igual para e-mail com e sem conta.

**`test:shared-space` (98)** — turnos e preços, reserva sem sobreposição, **página
pública sem login**, "profissional do dia" saindo do aluguel, agendamento pelo link,
**caixa separado** (receita da locatária não entra no da empresa), sala alugada
protegendo a agenda, **link individual de cada profissional**, painel restrito da
locatária e a **parede entre carteiras**:
a dona não vê as clientes, os agendamentos nem **o catálogo e os preços** de
quem aluga (nem pelo id direto), uma locatária não vê a outra — mas o link
público mostra o catálogo inteiro do espaço —, e ninguém escreve na agenda alheia — inclusive a
guarda de exclusão, que conta histórico fora do recorte para nunca apagar de
verdade uma profissional que tem agenda ou turnos. Fecha percorrendo o
**cadastro de uma locatária nova do zero** (profissional → acesso vinculado →
primeiro login → carteira e catálogo vazios → ela cria o próprio serviço →
link público no ar com ele) e os **formatos reais de
locação**: a semana toda, o mês inteiro em dias fixos, dois turnos no mesmo dia,
período repetido sem duplicar e período invertido recusado. Fecha com o que a
vida real cobra: **a cliente remarca e cancela sozinha** pelo link que recebeu,
**feriado fecha o dia** na agenda e no link público, e a locatária tem **caixa
próprio** — a receita dela não aparece para a casa, e o aluguel que ela paga
entra como despesa dela e receita da casa, no mesmo evento.

As suítes esperam o seed limpo — rode sempre pelo `test:e2e`.

```bash
cd backend && npm run typecheck && npm run lint
cd frontend && npm run typecheck && npm run lint
```

---

## Estrutura

```
backend/src/
├── config/          # env validado com Zod
├── modules/         # auth, companies, onboarding, users, customers, professionals,
│                    # services, appointments, resources, rentals, financial,
│                    # commissions, reports, notifications, subscriptions, admin, audit
├── shared/          # database (Prisma + extension multi-tenant), middlewares, errors, utils
├── queues/  jobs/   # BullMQ (lembretes, cobranças recorrentes, notificações)
├── websocket/       # Socket.IO por empresa/profissional
└── routes/          # composição do router

frontend/src/
├── api/             # client HTTP com refresh automático + hooks TanStack Query
├── components/ui/   # design system (button, dialog, select, table, charts helpers...)
├── components/      # layout, sidebar dinâmica, guards de rota
├── features/        # uma pasta por módulo do produto
└── stores/          # sessão e contexto da empresa (Zustand)
```

---

## Como o isolamento multiempresa é garantido

1. A `companyId` vem **sempre do JWT** — nunca do body, query ou header.
2. Um `AsyncLocalStorage` carrega o tenant por requisição.
3. Uma **Prisma Client Extension** injeta `where: { companyId }` em toda leitura e
   `data: { companyId }` em toda escrita das entidades de domínio; sem contexto de
   empresa, a operação é bloqueada em vez de vazar dados.

Não há `$queryRaw` no projeto, e é de propósito: consulta bruta não passa pela
extension, então empresa e carteira teriam de ser escritas à mão em cada uma —
esquecer um dos dois filtros vazaria dados entre negócios.

### A agenda é lida pela cor

Cada bloco é pintado pela **situação** do atendimento, não pela profissional:
azul agendado, violeta confirmado, âmbar em atendimento, verde finalizado,
rosa cancelado, cinza não compareceu. É o que a dona quer ver de relance ao
abrir a semana — o que já aconteceu, o que ainda vem e o que deu errado. Quem
atende continua identificada pela bolinha ao lado do horário.

As cores são fixas mesmo num painel white label: verde significa "aconteceu" em
qualquer empresa, e amarrá-lo à marca faria o mesmo verde dizer coisas
diferentes em cada uma. A legenda acima da grade conta quantos há de cada
situação no período aberto.

Feature flags (`CompanyModule`) são validados no servidor via `requireModule(...)`.
O frontend esconde o menu, mas quem decide o acesso é a API.

A mesma extension aplica um segundo recorte, agora **dentro** da empresa: a
*carteira* (`ownerProfessionalId`), que separa o negócio da casa do negócio de
cada profissional que aluga o espaço. Detalhes em
[docs/ARQUITETURA.md](docs/ARQUITETURA.md#45-carteira--o-segundo-nível-de-isolamento).

---

## Estado atual

Todas as 8 fases previstas estão implementadas e funcionando ponta a ponta:
projeto e banco, autenticação multiempresa, dashboard, clientes, serviços,
profissionais, agenda com prevenção de conflitos, financeiro, comissões, recursos,
aluguéis com cobrança recorrente, planos e assinaturas, feature flags, painel super
admin, notificações, filas (BullMQ) e tempo real (WebSockets).
