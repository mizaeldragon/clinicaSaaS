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
| Super admin do SaaS | `admin@saas.com` | `admin@12345` | Painel da plataforma (empresas, planos, MRR) |

Comparar o login da *Clínica Bella* com o do *Studio Nails Lu* mostra a arquitetura
modular na prática: o menu, as rotas e o dashboard mudam conforme os módulos ativos.

---

## Testes

```bash
cd backend && npm run test:smoke
```

Suíte end-to-end contra a API rodando (42 verificações): autenticação e rotação de
refresh token, **isolamento entre empresas**, feature flags de módulos, prevenção de
conflitos de agenda (profissional, sala, horário de funcionamento), finalização de
atendimento gerando receita e comissão, dashboards, aluguéis, permissões por papel,
painel do super admin e onboarding.

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

---

## Estado atual

Todas as 8 fases previstas estão implementadas e funcionando ponta a ponta:
projeto e banco, autenticação multiempresa, dashboard, clientes, serviços,
profissionais, agenda com prevenção de conflitos, financeiro, comissões, recursos,
aluguéis com cobrança recorrente, planos e assinaturas, feature flags, painel super
admin, notificações, filas (BullMQ) e tempo real (WebSockets).
