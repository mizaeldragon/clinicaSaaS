# Belezza — SaaS multiempresa para beleza, estética e clínicas

Plataforma SaaS **multi-tenant e modular** para gestão de salões, studios, barbearias,
clínicas de estética e espaços compartilhados de beleza.

Cada empresa ativa **apenas os módulos de que precisa** — do studio de manicure com uma
profissional até a clínica com salas, equipe, recepção e aluguel de espaços.

- Arquitetura completa: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)

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

## Testes

```bash
cd backend && npm run test:e2e
```

Reseta o banco, recria o seed e roda as duas suítes end-to-end contra a API
(**166 verificações**):

**`test:smoke` (68)** — autenticação e rotação de refresh token, **isolamento entre
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
como pagar.

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
