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

Pré-requisitos: **Node.js 20+**, **Docker** (ou um PostgreSQL e um Redis próprios).

### 1. Banco de dados e Redis

```bash
docker compose up -d
```

Sobe PostgreSQL em `localhost:5433` e Redis em `localhost:6380`
(portas altas para não conflitar com instâncias locais já existentes).

### 2. Backend

```bash
cd backend && npm install && cp .env.example .env && npx prisma migrate dev && npm run seed && npm run dev
```

API em `http://localhost:3333/api/v1`.

### 3. Worker de filas (opcional, em outro terminal)

```bash
cd backend && npm run dev:worker
```

Processa lembretes de agendamento, cobranças recorrentes de aluguel e notificações.
Sem Redis, defina `REDIS_ENABLED=false` no `.env` — a API continua funcionando e as
filas viram no-op.

### 4. Frontend

```bash
cd frontend && npm install && npm run dev
```

Painel em `http://localhost:5173` (o Vite já faz proxy de `/api` e `/socket.io`).

---

## Contas de demonstração (criadas pelo seed)

| Perfil | E-mail | Senha | O que demonstra |
|---|---|---|---|
| Admin da clínica | `admin@clinicabella.com` | `bella@12345` | Empresa plano Business com **todos os módulos** |
| Recepcionista | `recepcao@clinicabella.com` | `bella@12345` | Permissões restritas (sem usuários/configuração) |
| Profissional | `juliana@clinicabella.com` | `bella@12345` | Enxerga apenas a própria agenda e comissões |
| Studio pequeno | `lu@studionails.com` | `studio@12345` | Plano Starter — **só agenda, clientes e serviços** |
| Espaço compartilhado | `marcia@marciavaz.com.br` | `marcia@12345` | **Aluguel por turno** + link público de agendamento |
| Locatária | `ana@marciavaz.com.br` | `marcia@12345` | Aluga turnos e enxerga só os próprios turnos e agenda |
| Super admin do SaaS | `admin@saas.com` | `admin@12345` | Painel da plataforma (empresas, planos, MRR) |

Comparar o login da *Clínica Bella* com o do *Studio Nails Lu* mostra a arquitetura
modular na prática: o menu, as rotas e o dashboard mudam conforme os módulos ativos.

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
| Caixa | serviços dela + aluguéis recebidos | fora do sistema da dona |
| Sobre quem aluga, vê | espaço, turno, dia e se pagou | — |

A dona **não vê** a agenda, as clientes nem o faturamento de quem aluga — e uma
locatária não vê os da outra. Na agenda da dona os turnos alugados aparecem como
ocupação ("Salão · Manhã · Ana Ribeiro · pago"), nunca como atendimento.

Como as salas são físicas e compartilhadas, o motor de conflitos continua
enxergando tudo: uma agenda invisível segue ocupando o espaço, e a mensagem de
conflito que volta é genérica, sem nome de profissional nem de cliente.

---

## Testes

```bash
cd backend && npm run test:e2e
```

Reseta o banco, recria o seed e roda as duas suítes end-to-end contra a API
(**90 verificações**):

**`test:smoke` (43)** — autenticação e rotação de refresh token, **isolamento entre
empresas**, feature flags de módulos, prevenção de conflitos de agenda, finalização
de atendimento gerando receita e comissão, dashboards, aluguéis, permissões por
papel, painel do super admin e onboarding.

**`test:shared-space` (47)** — turnos e preços, reserva sem sobreposição, **página
pública sem login**, "profissional do dia" saindo do aluguel, agendamento pelo link,
**caixa separado** (receita da locatária não entra no da empresa), sala alugada
protegendo a agenda, **link individual de cada profissional**, painel restrito da
locatária e a **parede entre carteiras**:
a dona não vê as clientes nem os agendamentos de quem aluga (nem pelo id direto),
uma locatária não vê a outra, e ninguém escreve na agenda alheia.

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
